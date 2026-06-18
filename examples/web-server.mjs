#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  SIDES,
  applyLegalMove,
  chooseAndPlayGameMoveAsync,
  chooseGameMoveAsync,
  createGame,
  createLearningEngineBackend,
  describeEngineBackend,
  gameStatus,
  historyKeys,
  indexToCoord,
  lineToChineseNotation,
  moveToNotation,
  moveToChineseNotation,
  moveHistory,
  opponent,
  parseFen,
  parseMoveNotation,
  pieceLabel,
  positionKey,
  playGameMoveAsync,
  resolveEnginePlayLevel,
  toFen
} from "../src/index.js";

const WEB_ROOT = new URL("./web/", import.meta.url);
const DEFAULT_PORT = 5175;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_STARTUP_TIMEOUT_MS = 5000;
const DEFAULT_COMMAND_TIMEOUT_MS = 30000;
const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
const COMMAND_TIMEOUT_DEPTH_MS = 90000;
const COMMAND_TIMEOUT_TIME_MULTIPLIER = 20;
const REQUEST_TIMEOUT_BUFFER_MS = 30000;
const PLAYER_REVIEW_DEPTH_CAP = 3;
const PLAYER_REVIEW_TIME_CAP_MS = 1000;
const JSON_LIMIT_BYTES = 64 * 1024;

const PIECE_SYMBOLS = Object.freeze({
  red: Object.freeze({
    king: "帥",
    general: "帥",
    advisor: "仕",
    elephant: "相",
    horse: "傌",
    rook: "俥",
    cannon: "炮",
    pawn: "兵"
  }),
  black: Object.freeze({
    king: "將",
    general: "將",
    advisor: "士",
    elephant: "象",
    horse: "馬",
    rook: "車",
    cannon: "砲",
    pawn: "卒"
  })
});

const PIECE_LABELS_ZH = Object.freeze({
  red: Object.freeze({
    king: "紅方帥",
    general: "紅方帥",
    advisor: "紅方仕",
    elephant: "紅方相",
    horse: "紅方傌",
    rook: "紅方俥",
    cannon: "紅方炮",
    pawn: "紅方兵"
  }),
  black: Object.freeze({
    king: "黑方將",
    general: "黑方將",
    advisor: "黑方士",
    elephant: "黑方象",
    horse: "黑方馬",
    rook: "黑方車",
    cannon: "黑方砲",
    pawn: "黑方卒"
  })
});

const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
});

export async function startWebServer(options = {}) {
  const config = resolveServerOptions(options);
  const engine = options.engine ?? createLearningEngineBackend(config.engineOptions);
  const sessions = new Map();
  const server = createServer((request, response) => {
    handleRequest({ request, response, config, engine, sessions })
      .catch((error) => sendError(response, error));
  });
  server.requestTimeout = config.requestTimeoutMs;
  server.headersTimeout = Math.min(config.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS);
  server.setTimeout(config.requestTimeoutMs);

  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(config.port, config.host, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address();
  const actualHost = typeof address === "object" && address ? address.address : config.host;
  const actualPort = typeof address === "object" && address ? address.port : config.port;
  const url = `http://${actualHost === "::" ? "127.0.0.1" : actualHost}:${actualPort}`;

  return {
    server,
    engine,
    sessions,
    url,
    async close() {
      await new Promise((resolveClose, rejectClose) => {
        server.close((error) => error ? rejectClose(error) : resolveClose());
      });
      await engine.close?.();
    }
  };
}

function resolveServerOptions(options) {
  const depth = numberOrNull(options.depth);
  const timeLimitMs = numberOrNull(options.timeLimitMs);
  const lines = numberOrNull(options.lines) ?? 2;
  const playLevel = textOrNull(options.playLevel) ?? "casual";
  const nativePreset = options.nativePreset === false ? null : textOrNull(options.nativePreset) ?? "pikafish";
  const startupTimeoutMs = numberOrNull(options.startupTimeoutMs) ?? DEFAULT_STARTUP_TIMEOUT_MS;
  const commandTimeoutMs = resolveWebServerCommandTimeoutMs(options, depth, timeLimitMs);
  const requestTimeoutMs = resolveWebServerRequestTimeoutMs(options, commandTimeoutMs);

  return {
    host: textOrNull(options.host) ?? DEFAULT_HOST,
    port: numberOrNull(options.port) ?? DEFAULT_PORT,
    playerSide: normalizeSide(options.playerSide ?? options.side, SIDES.RED),
    initialFen: textOrNull(options.initialFen ?? options.fen),
    useBook: options.useBook !== false,
    depth,
    timeLimitMs,
    lines,
    playLevel,
    commandTimeoutMs,
    requestTimeoutMs,
    engineOptions: {
      native: options.native,
      preferNative: options.preferNative,
      nativePreset,
      command: textOrNull(options.engineCommand ?? options.command),
      args: options.engineArgs ?? options.args,
      protocol: textOrNull(options.engineProtocol ?? options.protocol),
      evalFile: textOrNull(options.engineEvalFile ?? options.evalFile),
      fallbackOnNativeError: options.fallbackOnNativeError,
      playLevel,
      ...(depth ? { depth } : {}),
      ...(timeLimitMs ? { timeLimitMs } : {}),
      lines,
      startupTimeoutMs,
      commandTimeoutMs,
      javascript: {
        profile: "balanced",
        ...(depth ? { depth } : {}),
        ...(timeLimitMs ? { timeLimitMs } : {}),
        lines
      },
      env: process.env
    }
  };
}

export function resolveWebServerCommandTimeoutMs(options = {}, depth = numberOrNull(options.depth), timeLimitMs = numberOrNull(options.timeLimitMs)) {
  const explicit = numberOrNull(options.commandTimeoutMs);
  if (explicit) return explicit;

  const depthBudget = depth && depth > 1 ? depth * COMMAND_TIMEOUT_DEPTH_MS : 0;
  const timeBudget = timeLimitMs ? timeLimitMs * COMMAND_TIMEOUT_TIME_MULTIPLIER : 0;
  return Math.max(DEFAULT_COMMAND_TIMEOUT_MS, depthBudget, timeBudget);
}

export function resolveWebServerRequestTimeoutMs(options = {}, commandTimeoutMs = resolveWebServerCommandTimeoutMs(options)) {
  const explicit = numberOrNull(options.requestTimeoutMs);
  if (explicit) return explicit;
  const timeLimitMs = numberOrNull(options.timeLimitMs);
  const reviewTimeLimitMs = timeLimitMs
    ? Math.min(timeLimitMs, PLAYER_REVIEW_TIME_CAP_MS)
    : PLAYER_REVIEW_TIME_CAP_MS;
  const reviewCommandTimeoutMs = resolveWebPlayerReviewCommandTimeoutMs(reviewTimeLimitMs);
  return Math.max(DEFAULT_REQUEST_TIMEOUT_MS, commandTimeoutMs + reviewCommandTimeoutMs + REQUEST_TIMEOUT_BUFFER_MS);
}

async function handleRequest(context) {
  const { request, response } = context;
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname.startsWith("/api/")) {
    return handleApiGet(context, url);
  }
  if (request.method === "POST" && url.pathname.startsWith("/api/")) {
    return handleApiPost(context, url);
  }
  if (request.method === "GET" || request.method === "HEAD") {
    return serveStatic(response, url.pathname, request.method === "HEAD");
  }

  sendJson(response, 405, { ok: false, error: "Method not allowed." });
}

async function handleApiGet(context, url) {
  if (url.pathname === "/api/state") {
    const session = requireSession(context.sessions, url.searchParams.get("session"));
    return sendJson(context.response, 200, { ok: true, state: serializeState(session, context.engine, context.config) });
  }

  sendJson(context.response, 404, { ok: false, error: "Unknown API route." });
}

async function handleApiPost(context, url) {
  const body = await readJsonBody(context.request);

  if (url.pathname === "/api/new") {
    const session = createSession(context.config, body);
    context.sessions.set(session.id, session);
    await enqueueSession(session, () => maybePlayEngineTurn(session, context.engine));
    return sendJson(context.response, 200, { ok: true, state: serializeState(session, context.engine, context.config) });
  }

  if (url.pathname === "/api/move") {
    const session = requireSession(context.sessions, body.sessionId);
    await enqueueSession(session, async () => {
      ensurePlayerTurn(session);
      const before = session.game;
      session.game = await playGameMoveAsync(session.game, context.engine, String(body.move ?? ""), {
        actor: "player",
        reviewOptions: resolveWebPlayerReviewOptions(session)
      });
      session.undoStack.push(before);
      if (body.deferEngine !== true) {
        await maybePlayEngineTurn(session, context.engine);
      }
    });
    return sendJson(context.response, 200, { ok: true, state: serializeState(session, context.engine, context.config) });
  }

  if (url.pathname === "/api/engine-move") {
    const session = requireSession(context.sessions, body.sessionId);
    await enqueueSession(session, () => maybePlayEngineTurn(session, context.engine));
    return sendJson(context.response, 200, { ok: true, state: serializeState(session, context.engine, context.config) });
  }

  if (url.pathname === "/api/hint") {
    const session = requireSession(context.sessions, body.sessionId);
    const hint = await enqueueSession(session, () => context.engine.coachMove(session.game.position, {
      ...searchOptions(session),
      history: historyKeys(session.game),
      initialPosition: session.game.initialPosition,
      moveHistory: moveHistory(session.game)
    }));
    return sendJson(context.response, 200, {
      ok: true,
      hint: summarizeCoach(hint, session.game.position),
      state: serializeState(session, context.engine, context.config)
    });
  }

  if (url.pathname === "/api/best") {
    const session = requireSession(context.sessions, body.sessionId);
    const decision = await enqueueSession(session, () => chooseGameMoveAsync(session.game, context.engine, searchOptions(session)));
    return sendJson(context.response, 200, {
      ok: true,
      best: summarizeDecision(decision, session.game.position),
      state: serializeState(session, context.engine, context.config)
    });
  }

  if (url.pathname === "/api/analyze-node") {
    const session = requireSession(context.sessions, body.sessionId);
    const analysis = await enqueueSession(session, async () => {
      const target = resolveTreeAnalysisTarget(session.game, body.node ?? body);
      const result = await context.engine.analyzePosition(target.position, {
        ...searchOptions(session),
        history: target.history,
        initialPosition: session.game.initialPosition,
        moveHistory: target.moveHistory
      });
      return summarizeTreeAnalysis(result, target.position);
    });
    return sendJson(context.response, 200, {
      ok: true,
      analysis,
      state: serializeState(session, context.engine, context.config)
    });
  }

  if (url.pathname === "/api/select-node") {
    const session = requireSession(context.sessions, body.sessionId);
    await enqueueSession(session, async () => {
      const before = session.game;
      session.game = await gameFromTreeNode(session, context.engine, body.node ?? body);
      session.undoStack.push(before);
    });
    return sendJson(context.response, 200, { ok: true, state: serializeState(session, context.engine, context.config) });
  }

  if (url.pathname === "/api/undo") {
    const session = requireSession(context.sessions, body.sessionId);
    await enqueueSession(session, () => {
      const previous = session.undoStack.pop();
      if (!previous) throw httpError(400, "Nothing to undo.");
      session.game = previous;
    });
    return sendJson(context.response, 200, { ok: true, state: serializeState(session, context.engine, context.config) });
  }

  if (url.pathname === "/api/jump") {
    const session = requireSession(context.sessions, body.sessionId);
    await enqueueSession(session, async () => {
      const ply = parsePly(body.ply, session.game.moves.length);
      const before = session.game;
      session.game = truncateGameAtPly(session.game, ply);
      session.undoStack.push(before);
      if (body.deferEngine !== true) {
        await maybePlayEngineTurn(session, context.engine);
      }
    });
    return sendJson(context.response, 200, { ok: true, state: serializeState(session, context.engine, context.config) });
  }

  sendJson(context.response, 404, { ok: false, error: "Unknown API route." });
}

async function serveStatic(response, pathname, headOnly = false) {
  const filePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (filePath.includes("..")) throw httpError(400, "Invalid path.");

  const url = new URL(filePath, WEB_ROOT);
  let data;
  try {
    data = await readFile(url);
  } catch {
    throw httpError(404, "Not found.");
  }

  const type = MIME_TYPES[extname(filePath)] ?? "application/octet-stream";
  response.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  if (!headOnly) response.end(data);
  else response.end();
}

function createSession(config, body = {}) {
  const playerSide = normalizeSide(body.side, config.playerSide);
  const fen = textOrNull(body.fen) ?? config.initialFen;
  const game = fen ? createGame(parseFen(fen)) : createGame();
  return {
    id: randomUUID(),
    game,
    playerSide,
    engineSide: opponent(playerSide),
    undoStack: [],
    queue: Promise.resolve(),
    useBook: body.useBook ?? config.useBook,
    depth: numberOrNull(body.depth) ?? config.depth,
    timeLimitMs: numberOrNull(body.timeLimitMs) ?? config.timeLimitMs,
    lines: numberOrNull(body.lines) ?? config.lines,
    createdAt: new Date().toISOString()
  };
}

async function maybePlayEngineTurn(session, engine) {
  const status = gameStatus(session.game);
  if (status.state !== "playing") return;
  if (session.game.position.turn !== session.engineSide) return;

  session.game = await chooseAndPlayGameMoveAsync(session.game, engine, {
    actor: "engine",
    review: false,
    searchOptions: searchOptions(session)
  });
}

function searchOptions(session) {
  return {
    ...(session.depth ? { depth: session.depth } : {}),
    ...(session.timeLimitMs ? { timeLimitMs: session.timeLimitMs } : {}),
    lines: session.lines,
    useBook: session.useBook
  };
}

export function resolveWebPlayerReviewOptions(session) {
  const reviewDepth = session.depth
    ? Math.min(session.depth, PLAYER_REVIEW_DEPTH_CAP)
    : PLAYER_REVIEW_DEPTH_CAP;
  const reviewTimeLimitMs = session.timeLimitMs
    ? Math.min(session.timeLimitMs, PLAYER_REVIEW_TIME_CAP_MS)
    : PLAYER_REVIEW_TIME_CAP_MS;
  return {
    ...searchOptions(session),
    depth: reviewDepth,
    timeLimitMs: reviewTimeLimitMs,
    commandTimeoutMs: resolveWebPlayerReviewCommandTimeoutMs(reviewTimeLimitMs)
  };
}

export function resolveWebPlayerReviewCommandTimeoutMs(timeLimitMs = PLAYER_REVIEW_TIME_CAP_MS) {
  const timeBudget = (numberOrNull(timeLimitMs) ?? 0) * COMMAND_TIMEOUT_TIME_MULTIPLIER;
  return Math.max(DEFAULT_COMMAND_TIMEOUT_MS, timeBudget);
}

function parsePly(value, maxPly) {
  const ply = Number.parseInt(value, 10);
  if (!Number.isInteger(ply) || ply < 0 || ply > maxPly) {
    throw httpError(400, `Unsupported tree ply: ${value}.`);
  }
  return ply;
}

function truncateGameAtPly(game, ply) {
  const moves = game.moves.slice(0, ply);
  const positions = game.positions.slice(0, ply + 1);
  const position = positions.at(-1) ?? game.initialPosition;

  return {
    ...game,
    position,
    moves,
    positions,
    positionCounts: countPositions(positions)
  };
}

async function gameFromTreeNode(session, engine, node = {}) {
  if (node.fen) {
    return createGame(parseFen(String(node.fen)));
  }

  if (node.kind === "alternative") {
    const parentPly = parsePly(node.parentPly, session.game.moves.length);
    if (parentPly < 1) throw httpError(400, "Alternative nodes require a parent move.");
    const game = truncateGameAtPly(session.game, parentPly - 1);
    const actor = game.position.turn === session.playerSide ? "player" : "engine";
    return playGameMoveAsync(game, engine, String(node.move ?? ""), {
      actor,
      review: false
    });
  }

  const ply = parsePly(node.ply, session.game.moves.length);
  return truncateGameAtPly(session.game, ply);
}

function resolveTreeAnalysisTarget(game, node = {}) {
  if (node.fen) {
    const position = parseFen(String(node.fen));
    return {
      position,
      history: [positionKey(position)],
      moveHistory: []
    };
  }

  if (node.kind === "alternative") {
    const parentPly = parsePly(node.parentPly, game.moves.length);
    if (parentPly < 1) throw httpError(400, "Alternative nodes require a parent move.");
    const before = game.positions[parentPly - 1];
    if (!before) throw httpError(400, `No position before ply ${parentPly}.`);
    const moveNotation = String(node.move ?? "");
    const position = applyLegalMove(before, parseMoveNotation(moveNotation), before.turn);
    return {
      position,
      history: [...game.positions.slice(0, parentPly), position].map(positionKey),
      moveHistory: [
        ...game.moves.slice(0, parentPly - 1).map((move) => move.notation),
        moveNotation
      ]
    };
  }

  const ply = parsePly(node.ply, game.moves.length);
  const position = game.positions[ply];
  if (!position) throw httpError(400, `No position at ply ${ply}.`);
  return {
    position,
    history: game.positions.slice(0, ply + 1).map(positionKey),
    moveHistory: game.moves.slice(0, ply).map((move) => move.notation)
  };
}

function countPositions(positions) {
  const counts = new Map();
  for (const position of positions) {
    const key = positionKey(position);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function serializeState(session, engine, config = {}) {
  const status = gameStatus(session.game);
  const legalMoves = engine.legalMoves(session.game.position)
    .map((move) => summarizeMove(move, session.game.position));
  const lastMove = session.game.moves.at(-1) ?? null;
  const lastPlayerMove = [...session.game.moves].reverse().find((move) => move.actor === "player") ?? null;
  const lastEngineMove = [...session.game.moves].reverse().find((move) => move.actor === "engine") ?? null;
  const lastPlayerPosition = positionBeforeEntry(lastPlayerMove);
  const lastEnginePosition = positionBeforeEntry(lastEngineMove);
  const history = session.game.moves.map(summarizeHistoryMove);
  const teachingTurns = summarizeTeachingTurns(history, session, status);
  const teachingTurn = teachingTurns.at(-1) ?? summarizeTeachingPair(history, session, status);

  return {
    sessionId: session.id,
    playerSide: session.playerSide,
    engineSide: session.engineSide,
    turn: session.game.position.turn,
    fen: toFen(session.game.position),
    status,
    board: serializeBoard(session.game.position),
    legalMoves,
    playerTurn: status.state === "playing" && session.game.position.turn === session.playerSide,
    canUndo: session.undoStack.length > 0,
    moveCount: session.game.moves.length,
    history,
    lastMove: lastMove ? summarizeHistoryMove(lastMove) : null,
    lastPlayerReview: lastPlayerMove?.review ? summarizeReview(lastPlayerMove.review, lastPlayerPosition) : null,
    lastEngineDecision: lastEngineMove?.decision ? summarizeDecision(lastEngineMove.decision, lastEnginePosition) : null,
    teachingTurns,
    teachingPair: teachingTurn,
    teachingTurn,
    backend: describeEngineBackend(engine),
    web: {
      commandTimeoutMs: config.commandTimeoutMs ?? null,
      requestTimeoutMs: config.requestTimeoutMs ?? null
    }
  };
}

function summarizeTeachingTurns(history, session, status) {
  if (!history.length) return [];

  return history
    .map((move) => {
      if (move.actor === "player") {
        return summarizeTeachingTurn(move, nextEngineReply(history, move), session, status);
      }
      if (move.actor === "engine" && !previousPlayerMove(history, move)) {
        return summarizeTeachingTurn(null, move, session, status);
      }
      return null;
    })
    .filter(Boolean);
}

function summarizeTeachingTurn(playerMove, engineMove, session, status) {
  const engineThinking = Boolean(
    playerMove
    && !engineMove
    && status.state === "playing"
    && session.game.position.turn === session.engineSide
  );

  return {
    id: playerMove ? `turn-${playerMove.ply}` : `turn-engine-${engineMove?.ply ?? 0}`,
    moveNumber: playerMove?.moveNumber ?? engineMove?.moveNumber ?? null,
    playerMove,
    playerReview: playerMove?.review ?? null,
    playerReviewPending: Boolean(playerMove && !playerMove.review),
    engineMove,
    engineDecision: engineMove?.decision ?? null,
    engineThinking
  };
}

function summarizeTeachingPair(history, session, status) {
  if (!history.length) return null;

  const last = history.at(-1);
  const playerMove = last?.actor === "player"
    ? last
    : previousPlayerMove(history, last);
  const engineMove = last?.actor === "engine"
    ? last
    : playerMove
      ? nextEngineReply(history, playerMove)
      : [...history].reverse().find((move) => move.actor === "engine") ?? null;
  const engineThinking = Boolean(
    playerMove
    && !engineMove
    && status.state === "playing"
    && session.game.position.turn === session.engineSide
  );

  if (!playerMove && !engineMove && !engineThinking) return null;
  return {
    id: playerMove ? `turn-${playerMove.ply}` : `turn-engine-${engineMove?.ply ?? 0}`,
    moveNumber: playerMove?.moveNumber ?? engineMove?.moveNumber ?? null,
    playerMove,
    playerReview: playerMove?.review ?? null,
    playerReviewPending: Boolean(playerMove && !playerMove.review),
    engineMove,
    engineDecision: engineMove?.decision ?? null,
    engineThinking
  };
}

function nextEngineReply(history, playerMove) {
  if (!playerMove) return null;
  return history.find((move) => move.actor === "engine" && move.ply === playerMove.ply + 1) ?? null;
}

function previousPlayerMove(history, engineMove) {
  if (!engineMove) return null;
  return history.find((move) => move.actor === "player" && move.ply === engineMove.ply - 1) ?? null;
}

function serializeBoard(position) {
  return position.board.map((piece, square) => ({
    square,
    coord: indexToCoord(square),
    piece: piece ? {
      ...piece,
      label: pieceLabel(piece),
      zhLabel: pieceLabelZh(piece),
      symbol: PIECE_SYMBOLS[piece.side]?.[piece.type] ?? "?"
    } : null
  }));
}

function summarizeHistoryMove(entry) {
  const position = positionBeforeEntry(entry);
  const after = positionAfterEntry(entry);
  return {
    ply: entry.ply,
    moveNumber: entry.moveNumber,
    side: entry.side,
    actor: entry.actor,
    notation: entry.notation,
    zhNotation: chineseNotationFor(position, entry.move ?? entry.notation),
    positionBefore: entry.positionBefore,
    positionAfter: entry.positionAfter,
    boardBefore: position ? serializeBoard(position) : null,
    boardAfter: after ? serializeBoard(after) : null,
    review: entry.review ? summarizeReview(entry.review, position) : null,
    decision: entry.decision ? summarizeDecision(entry.decision, position) : null
  };
}

function summarizeMove(move, position = null) {
  return {
    notation: move.notation ?? moveToNotation(move),
    zhNotation: chineseNotationFor(position, move),
    from: move.from,
    to: move.to,
    fromCoord: indexToCoord(move.from),
    toCoord: indexToCoord(move.to),
    piece: move.piece ? {
      ...move.piece,
      label: pieceLabel(move.piece),
      zhLabel: pieceLabelZh(move.piece),
      symbol: PIECE_SYMBOLS[move.piece.side]?.[move.piece.type] ?? "?"
    } : null,
    captured: move.captured ? {
      ...move.captured,
      label: pieceLabel(move.captured),
      zhLabel: pieceLabelZh(move.captured),
      symbol: PIECE_SYMBOLS[move.captured.side]?.[move.captured.type] ?? "?"
    } : null,
    givesCheck: Boolean(move.givesCheck)
  };
}

function summarizeDecision(decision, position = null) {
  if (!decision) return null;
  const explanation = decision.explanation ?? {};
  const principalVariation = (decision.principalVariation ?? explanation.principalVariation ?? [])
    .map(notationFor)
    .filter(Boolean);
  const alternatives = annotateAlternatives(position, explanation.alternatives);
  const summary = {
    source: decision.source ?? "search",
    bestMove: notationFor(decision.bestMove),
    zhBestMove: chineseNotationFor(position, decision.bestMove),
    score: Math.round(decision.score ?? 0),
    scoreDetail: decision.scoreDetail ?? explanation.search?.scoreDetail ?? null,
    scoreText: scoreTextFor(decision, explanation),
    wdl: decision.wdl ?? explanation.search?.wdl ?? null,
    depth: decision.depth ?? 0,
    nodes: decision.nodes ?? 0,
    summary: explanation.summary ?? "",
    reasons: [...(explanation.reasons ?? [])],
    confidence: explanation.confidence ?? null,
    linePlan: annotateLinePlan(position, explanation.linePlan),
    comparison: explanation.comparison ?? null,
    alternatives,
    principalVariation,
    zhPrincipalVariation: chineseLineFor(position, principalVariation),
    oracleReview: decision.oracleReview ?? explanation.oracleReview ?? null,
    backendFallback: decision.backendFallback ?? null
  };
  return {
    ...summary,
    zhReasons: summarizeDecisionReasonsZh(summary)
  };
}

function summarizeReview(review, position = null) {
  const summary = {
    move: notationFor(review.move),
    zhMove: chineseNotationFor(position, review.move),
    bestMove: notationFor(review.bestMove),
    zhBestMove: chineseNotationFor(position, review.bestMove),
    classification: review.classification ?? null,
    centipawnLoss: Math.round(review.centipawnLoss ?? 0),
    isBestMove: Boolean(review.isBestMove),
    summary: review.explanation?.summary ?? "",
    reasons: [...(review.explanation?.reasons ?? [])],
    zhReasons: [],
    playedScore: review.playedScore ?? null,
    bestScore: review.bestScore ?? null,
    playedScoreDetail: review.playedScoreDetail ?? null,
    bestScoreDetail: review.bestAnalysis?.scoreDetail ?? null,
    playedWdl: review.playedWdl ?? null,
    bestWdl: review.bestAnalysis?.wdl ?? null,
    playedLinePlan: annotateLinePlan(position, review.playedLinePlan),
    bestLinePlan: annotateLinePlan(position, review.bestLinePlan),
    planComparison: annotatePlanComparison(position, review.planComparison),
    practiceFocus: review.practiceFocus ?? null,
    mistakes: review.mistakes ?? null,
    bestAlternatives: annotateAlternatives(position, review.bestAlternatives ?? review.bestAnalysis?.explanation?.alternatives)
  };
  return {
    ...summary,
    zhReasons: summarizeReviewReasonsZh(summary)
  };
}

function summarizeCoach(coach, position = null) {
  const principalVariation = (coach.principalVariation ?? []).map(notationFor).filter(Boolean);
  const summary = {
    source: coach.source ?? "search",
    bestMove: notationFor(coach.bestMove),
    zhBestMove: chineseNotationFor(position, coach.bestMove),
    score: Math.round(coach.score ?? 0),
    scoreText: scoreTextFor(coach),
    summary: coach.summary ?? "",
    levels: (coach.levels ?? []).map((level) => ({ ...level })),
    alternatives: annotateAlternatives(position, coach.alternatives),
    principalVariation,
    zhPrincipalVariation: chineseLineFor(position, principalVariation)
  };
  return {
    ...summary,
    zhLevels: summarizeCoachLevelsZh(summary)
  };
}

function summarizeTreeAnalysis(analysis, position) {
  const lines = Array.isArray(analysis?.lines) ? analysis.lines : [];
  return {
    fen: toFen(position),
    turn: position.turn,
    board: serializeBoard(position),
    best: summarizeDecision(analysis, position),
    branches: lines.map((line, index) => summarizeAnalysisLine(line, position, index))
  };
}

function summarizeAnalysisLine(line, position, index) {
  const move = notationFor(line.move);
  const rawPv = (line.principalVariation ?? []).map(notationFor).filter(Boolean);
  const principalVariation = move && rawPv[0] !== move ? [move, ...rawPv] : rawPv;
  const zhPrincipalVariation = chineseLineFor(position, principalVariation);
  const expectedReply = principalVariation[1] ?? null;
  const afterMove = positionAfterMove(position, move);
  const afterReply = afterMove ? positionAfterMove(afterMove, expectedReply) : null;

  return {
    rank: line.rank ?? index + 1,
    source: "analysis",
    move,
    zhMove: zhPrincipalVariation[0] ?? chineseNotationFor(position, line.move ?? move),
    score: Number.isFinite(line.score) ? Math.round(line.score) : null,
    scoreDetail: line.scoreDetail ?? null,
    centipawnLoss: Number.isFinite(line.centipawnLoss) ? Math.round(line.centipawnLoss) : null,
    expectedReply,
    zhExpectedReply: zhPrincipalVariation[1] ?? null,
    principalVariation,
    zhPrincipalVariation,
    boardAfter: afterMove ? serializeBoard(afterMove) : null,
    replyBoardAfter: afterReply ? serializeBoard(afterReply) : null,
    fenAfter: afterMove ? toFen(afterMove) : null,
    fenReplyAfter: afterReply ? toFen(afterReply) : null,
    summary: line.explanation?.summary ?? "",
    reasons: [...(line.explanation?.reasons ?? [])]
  };
}

function annotateAlternatives(position, alternatives = []) {
  if (!Array.isArray(alternatives)) return [];
  return alternatives.map((alternative) => {
    const line = [alternative.move, alternative.expectedReply].filter(Boolean);
    const zhLine = chineseLineFor(position, line);
    const afterMove = positionAfterMove(position, alternative.move);
    const afterReply = afterMove ? positionAfterMove(afterMove, alternative.expectedReply) : null;
    return {
      ...alternative,
      zhMove: zhLine[0] ?? chineseNotationFor(position, alternative.move),
      zhExpectedReply: zhLine[1] ?? null,
      boardAfter: afterMove ? serializeBoard(afterMove) : null,
      replyBoardAfter: afterReply ? serializeBoard(afterReply) : null,
      planComparison: annotatePlanComparison(position, alternative.planComparison)
    };
  });
}

function positionAfterMove(position, move) {
  if (!position || !move) return null;
  try {
    const parsed = typeof move === "string" ? parseMoveNotation(move) : move;
    return applyLegalMove(position, parsed, position.turn);
  } catch {
    return null;
  }
}

function annotateLinePlan(position, linePlan) {
  if (!linePlan) return null;
  const line = [
    linePlan.firstMove,
    linePlan.expectedReply,
    ...(linePlan.continuation ?? [])
  ].filter(Boolean);
  const zhLine = chineseLineFor(position, line);
  return {
    ...linePlan,
    zhFirstMove: zhLine[0] ?? null,
    zhExpectedReply: zhLine[1] ?? null,
    zhContinuation: zhLine.slice(2),
    zhSummary: summarizeLinePlanZh(linePlan, zhLine),
    moves: (linePlan.moves ?? []).map((move, index) => ({
      ...move,
      zhNotation: zhLine[index] ?? null
    }))
  };
}

function annotatePlanComparison(position, comparison) {
  if (!comparison) return null;
  return {
    ...comparison,
    zhSummary: summarizePlanComparisonZh(position, comparison)
  };
}

function positionBeforeEntry(entry) {
  if (!entry?.positionBefore) return null;
  try {
    return parseFen(entry.positionBefore);
  } catch {
    return null;
  }
}

function positionAfterEntry(entry) {
  if (!entry?.positionAfter) return null;
  try {
    return parseFen(entry.positionAfter);
  } catch {
    return null;
  }
}

function pieceLabelZh(piece) {
  return PIECE_LABELS_ZH[piece?.side]?.[piece?.type] ?? PIECE_SYMBOLS[piece?.side]?.[piece?.type] ?? "";
}

function chineseNotationFor(position, move) {
  if (!position || !move) return null;
  try {
    return moveToChineseNotation(position, move);
  } catch {
    return null;
  }
}

function chineseLineFor(position, moves) {
  if (!position || !moves?.length) return [];
  try {
    return lineToChineseNotation(position, moves);
  } catch {
    return [];
  }
}

function notationFor(move) {
  if (!move) return null;
  if (typeof move === "string") return move;
  return move.notation ?? moveToNotation(move);
}

function summarizeLinePlanZh(linePlan, zhLine) {
  if (!linePlan || zhLine.length === 0) return "";
  const [first, reply, ...rest] = zhLine;
  const replyText = reply ? `，預期應手 ${reply}` : "";
  const continuation = rest.length > 0 ? `，後續 ${rest.join(" ")}` : "";
  const motifs = linePlan.motifs?.length ? `；主題：${linePlan.motifs.map(motifZh).join("、")}` : "";
  return `先走 ${first}${replyText}${continuation}${motifs}。`;
}

function summarizePlanComparisonZh(position, comparison) {
  if (!comparison) return "";
  const playedMove = chineseNotationFor(position, comparison.playedMove) ?? comparison.playedMove;
  const bestMove = chineseNotationFor(position, comparison.bestMove) ?? comparison.bestMove;
  const gap = Number.isFinite(comparison.centipawnLoss) && comparison.centipawnLoss > 0
    ? `，差距約 ${Math.round(comparison.centipawnLoss)} cp`
    : "";

  if (comparison.sameFirstMove && bestMove) {
    return `實戰計畫與引擎首選 ${bestMove} 一致。`;
  }
  if (playedMove && bestMove) {
    return `實戰計畫從 ${playedMove} 開始；引擎更建議 ${bestMove}${gap}。`;
  }
  if (bestMove) return `引擎更建議 ${bestMove}${gap}。`;
  return comparison.summary ?? "";
}

function summarizeDecisionReasonsZh(decision) {
  const reasons = [];
  const move = decision.zhBestMove ?? decision.bestMove;
  if (!move) return reasons;

  const source = decision.source?.startsWith("opening") || decision.source === "book"
    ? "開局庫"
    : decision.source?.startsWith("native")
      ? "原生引擎"
      : "搜索";

  if (decision.depth > 0) {
    reasons.push(`${source}在深度 ${decision.depth} 推薦 ${move}。`);
  } else {
    reasons.push(`${source}推薦 ${move}。`);
  }

  if (decision.scoreText) {
    reasons.push(`局面評分為 ${decision.scoreText}。`);
  }

  if (decision.linePlan?.zhSummary) {
    reasons.push(decision.linePlan.zhSummary);
  }

  const next = (decision.alternatives ?? []).find((alternative) => alternative.move !== decision.bestMove);
  if (next) {
    const gap = Number.isFinite(next.centipawnLoss)
      ? next.centipawnLoss
      : Math.max(0, Math.round((decision.score ?? 0) - (next.score ?? 0)));
    const unit = decision.source?.startsWith("opening") || decision.source === "book" ? "權重點" : "cp";
    if (gap > 0) {
      reasons.push(`相較 ${next.zhMove ?? next.move}，首選約領先 ${gap} ${unit}。`);
    } else {
      reasons.push(`${next.zhMove ?? next.move} 與首選接近，適合一起比較。`);
    }
  }

  return reasons.slice(0, 6);
}

function summarizeReviewReasonsZh(review) {
  const reasons = [];
  const move = review.zhMove ?? review.move;
  const best = review.zhBestMove ?? review.bestMove;

  if (review.isBestMove) {
    reasons.push(`${move} 與引擎首選一致。`);
  } else if (move && best) {
    reasons.push(`${move} 損失約 ${review.centipawnLoss} cp，建議比較 ${best}。`);
  }
  if (review.playedLinePlan?.zhSummary) {
    reasons.push(`實戰計畫：${review.playedLinePlan.zhSummary}`);
  }
  if (review.bestLinePlan?.zhSummary) {
    reasons.push(`建議計畫：${review.bestLinePlan.zhSummary}`);
  }

  return reasons.slice(0, 6);
}

function summarizeCoachLevelsZh(coach) {
  const move = coach.zhBestMove ?? coach.bestMove;
  if (!move) {
    return [{
      level: 1,
      kind: "status",
      title: "狀態",
      text: "此局面沒有可提示的合法著法。"
    }];
  }

  const next = (coach.alternatives ?? []).find((alternative) => alternative.move !== coach.bestMove);
  return [{
    level: 1,
    kind: "concept",
    title: coach.source?.startsWith("opening") || coach.source === "book" ? "開局方向" : "局面方向",
    text: coach.source?.startsWith("opening") || coach.source === "book"
      ? `先考慮 ${move}，用開局庫思路建立子力活躍度。`
      : "先找能改善協調、限制對手或製造威脅的候選著法。"
  }, {
    level: 2,
    kind: "tactic",
    title: "戰術線索",
    text: coach.scoreText ? `目前評分線索為 ${coach.scoreText}。` : "留意將軍、得子和直接威脅。"
  }, {
    level: 3,
    kind: "candidate",
    title: "候選比較",
    text: next
      ? `把 ${move} 與 ${next.zhMove ?? next.move} 放在一起比較。`
      : `${move} 是目前候選列表中的首選。`
  }, {
    level: 4,
    kind: "reveal",
    title: "最佳著法",
    text: `最佳著法是 ${move}。`
  }];
}

function motifZh(motif) {
  if (/discovered/i.test(motif)) return "閃擊將軍";
  if (/check/i.test(motif)) return "將軍";
  if (/capture|wins/i.test(motif)) return "得子";
  if (/skewer/i.test(motif)) return "串打";
  if (/threat/i.test(motif)) return "威脅";
  if (/pin/i.test(motif)) return "牽制";
  if (/safe/i.test(motif)) return "安全";
  if (/recapture/i.test(motif)) return "反吃";
  if (/development|activity/i.test(motif)) return "出子";
  return motif;
}

function scoreTextFor(entry, explanation = null) {
  const detail = entry?.scoreDetail ?? entry?.native?.scoreDetail ?? explanation?.search?.scoreDetail;
  if (detail?.text) return detail.text;
  if (Number.isFinite(entry?.score)) return formatCentipawns(entry.score);
  return null;
}

function formatCentipawns(value) {
  const rounded = Math.round(value ?? 0);
  return `${rounded >= 0 ? "+" : ""}${rounded} cp`;
}

function ensurePlayerTurn(session) {
  const status = gameStatus(session.game);
  if (status.state !== "playing") throw httpError(400, `Game is over: ${status.state}.`);
  if (session.game.position.turn !== session.playerSide) {
    throw httpError(409, "It is not the player's turn.");
  }
}

function requireSession(sessions, id) {
  const session = sessions.get(String(id ?? ""));
  if (!session) throw httpError(404, "Session not found.");
  return session;
}

function enqueueSession(session, task) {
  const run = session.queue.catch(() => null).then(task);
  session.queue = run.catch(() => null);
  return run;
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > JSON_LIMIT_BYTES) throw httpError(413, "Request body too large.");
  }
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw httpError(400, "Invalid JSON body.");
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendError(response, error) {
  const status = error.statusCode ?? 500;
  sendJson(response, status, {
    ok: false,
    error: status >= 500 ? "Internal server error." : error.message
  });
  if (status >= 500) {
    console.error(error);
  }
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeSide(value, fallback) {
  const side = String(value ?? fallback ?? SIDES.RED).toLowerCase();
  if (side === SIDES.RED || side === "r") return SIDES.RED;
  if (side === SIDES.BLACK || side === "b") return SIDES.BLACK;
  throw httpError(400, `Unsupported side: ${value}.`);
}

function textOrNull(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--host") options.host = args[++index];
    else if (arg === "--port") options.port = Number(args[++index]);
    else if (arg === "--side") options.side = args[++index];
    else if (arg === "--fen") options.fen = args[++index];
    else if (arg === "--level") options.playLevel = args[++index];
    else if (arg === "--depth") options.depth = Number(args[++index]);
    else if (arg === "--time") options.timeLimitMs = Number(args[++index]);
    else if (arg === "--lines") options.lines = Number(args[++index]);
    else if (arg === "--no-book") options.useBook = false;
    else if (arg === "--no-native") options.native = false;
    else if (arg === "--engine-preset") options.nativePreset = args[++index];
    else if (arg === "--engine-command") options.engineCommand = args[++index];
    else if (arg === "--engine-protocol") options.engineProtocol = args[++index];
    else if (arg === "--engine-eval-file") options.engineEvalFile = args[++index];
    else if (arg === "--startup-timeout") options.startupTimeoutMs = Number(args[++index]);
    else if (arg === "--command-timeout") options.commandTimeoutMs = Number(args[++index]);
    else if (arg === "--request-timeout") options.requestTimeoutMs = Number(args[++index]);
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function printUsage() {
  console.log(`
Usage:
  npm run web
  npm run web -- --port 5175 --side red --level casual
  npm run web -- --engine-preset pikafish
  npm run web -- --no-native

Options:
  --host value          Host to bind. Default: 127.0.0.1.
  --port n             Port to bind. Default: 5175.
  --side red|black     Human side. Default: red.
  --level name         Play level: beginner, casual, club, expert, or master.
  --depth n            Override search depth.
  --time ms            Override move time budget.
  --lines n            Candidate lines to compare. Default: 2.
  --fen FEN            Start new sessions from a supplied FEN.
  --no-book            Disable opening book moves.
  --no-native          Force the JavaScript engine.
  --engine-preset name Native engine preset. Default: pikafish.
  --request-timeout ms HTTP wait budget. Default: engine command timeout + capped review timeout + 30000ms.
`.trim());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error("");
    printUsage();
    process.exit(1);
  }

  if (options.help) {
    printUsage();
    process.exit(0);
  }

  const app = await startWebServer(options);
  const level = resolveEnginePlayLevel(options.playLevel ?? "casual");
  console.log(`Xiangqi web game: ${app.url}`);
  console.log(`Engine backend: ${app.engine.name} (${app.engine.kind})`);
  console.log(`Level: ${level?.name ?? options.playLevel ?? "casual"}`);
  console.log("Press Ctrl+C to stop.");

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
