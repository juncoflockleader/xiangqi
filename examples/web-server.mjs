#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  SIDES,
  chooseAndPlayGameMoveAsync,
  chooseGameMoveAsync,
  createGame,
  createLearningEngineBackend,
  describeEngineBackend,
  gameStatus,
  historyKeys,
  indexToCoord,
  moveToNotation,
  opponent,
  parseFen,
  pieceLabel,
  playGameMoveAsync,
  resolveEnginePlayLevel,
  toFen
} from "../src/index.js";

const WEB_ROOT = new URL("./web/", import.meta.url);
const DEFAULT_PORT = 5175;
const DEFAULT_HOST = "127.0.0.1";
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
      startupTimeoutMs: numberOrNull(options.startupTimeoutMs) ?? 5000,
      commandTimeoutMs: numberOrNull(options.commandTimeoutMs) ?? 30000,
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
    return sendJson(context.response, 200, { ok: true, state: serializeState(session, context.engine) });
  }

  sendJson(context.response, 404, { ok: false, error: "Unknown API route." });
}

async function handleApiPost(context, url) {
  const body = await readJsonBody(context.request);

  if (url.pathname === "/api/new") {
    const session = createSession(context.config, body);
    context.sessions.set(session.id, session);
    await enqueueSession(session, () => maybePlayEngineTurn(session, context.engine));
    return sendJson(context.response, 200, { ok: true, state: serializeState(session, context.engine) });
  }

  if (url.pathname === "/api/move") {
    const session = requireSession(context.sessions, body.sessionId);
    await enqueueSession(session, async () => {
      ensurePlayerTurn(session);
      const before = session.game;
      session.game = await playGameMoveAsync(session.game, context.engine, String(body.move ?? ""), {
        actor: "player",
        reviewOptions: searchOptions(session)
      });
      session.undoStack.push(before);
      await maybePlayEngineTurn(session, context.engine);
    });
    return sendJson(context.response, 200, { ok: true, state: serializeState(session, context.engine) });
  }

  if (url.pathname === "/api/hint") {
    const session = requireSession(context.sessions, body.sessionId);
    const hint = await enqueueSession(session, () => context.engine.coachMove(session.game.position, {
      ...searchOptions(session),
      history: historyKeys(session.game)
    }));
    return sendJson(context.response, 200, { ok: true, hint: summarizeCoach(hint), state: serializeState(session, context.engine) });
  }

  if (url.pathname === "/api/best") {
    const session = requireSession(context.sessions, body.sessionId);
    const decision = await enqueueSession(session, () => chooseGameMoveAsync(session.game, context.engine, searchOptions(session)));
    return sendJson(context.response, 200, { ok: true, best: summarizeDecision(decision), state: serializeState(session, context.engine) });
  }

  if (url.pathname === "/api/undo") {
    const session = requireSession(context.sessions, body.sessionId);
    await enqueueSession(session, () => {
      const previous = session.undoStack.pop();
      if (!previous) throw httpError(400, "Nothing to undo.");
      session.game = previous;
    });
    return sendJson(context.response, 200, { ok: true, state: serializeState(session, context.engine) });
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

function serializeState(session, engine) {
  const status = gameStatus(session.game);
  const legalMoves = engine.legalMoves(session.game.position).map(summarizeMove);
  const lastMove = session.game.moves.at(-1) ?? null;
  const lastPlayerMove = [...session.game.moves].reverse().find((move) => move.actor === "player") ?? null;
  const lastEngineMove = [...session.game.moves].reverse().find((move) => move.actor === "engine") ?? null;

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
    history: session.game.moves.map(summarizeHistoryMove),
    lastMove: lastMove ? summarizeHistoryMove(lastMove) : null,
    lastPlayerReview: lastPlayerMove?.review ? summarizeReview(lastPlayerMove.review) : null,
    lastEngineDecision: lastEngineMove?.decision ? summarizeDecision(lastEngineMove.decision) : null,
    backend: describeEngineBackend(engine)
  };
}

function serializeBoard(position) {
  return position.board.map((piece, square) => ({
    square,
    coord: indexToCoord(square),
    piece: piece ? {
      ...piece,
      label: pieceLabel(piece),
      symbol: PIECE_SYMBOLS[piece.side]?.[piece.type] ?? "?"
    } : null
  }));
}

function summarizeHistoryMove(entry) {
  return {
    ply: entry.ply,
    moveNumber: entry.moveNumber,
    side: entry.side,
    actor: entry.actor,
    notation: entry.notation,
    positionBefore: entry.positionBefore,
    positionAfter: entry.positionAfter,
    review: entry.review ? summarizeReview(entry.review) : null,
    decision: entry.decision ? summarizeDecision(entry.decision) : null
  };
}

function summarizeMove(move) {
  return {
    notation: move.notation ?? moveToNotation(move),
    from: move.from,
    to: move.to,
    fromCoord: indexToCoord(move.from),
    toCoord: indexToCoord(move.to),
    piece: move.piece ? {
      ...move.piece,
      label: pieceLabel(move.piece),
      symbol: PIECE_SYMBOLS[move.piece.side]?.[move.piece.type] ?? "?"
    } : null,
    captured: move.captured ? {
      ...move.captured,
      label: pieceLabel(move.captured),
      symbol: PIECE_SYMBOLS[move.captured.side]?.[move.captured.type] ?? "?"
    } : null,
    givesCheck: Boolean(move.givesCheck)
  };
}

function summarizeDecision(decision) {
  if (!decision) return null;
  const explanation = decision.explanation ?? {};
  return {
    source: decision.source ?? "search",
    bestMove: notationFor(decision.bestMove),
    score: Math.round(decision.score ?? 0),
    scoreDetail: decision.scoreDetail ?? explanation.search?.scoreDetail ?? null,
    wdl: decision.wdl ?? explanation.search?.wdl ?? null,
    depth: decision.depth ?? 0,
    nodes: decision.nodes ?? 0,
    summary: explanation.summary ?? "",
    reasons: [...(explanation.reasons ?? [])],
    confidence: explanation.confidence ?? null,
    linePlan: explanation.linePlan ?? null,
    comparison: explanation.comparison ?? null,
    alternatives: explanation.alternatives ?? [],
    principalVariation: (decision.principalVariation ?? explanation.principalVariation ?? [])
      .map(notationFor)
      .filter(Boolean),
    oracleReview: decision.oracleReview ?? explanation.oracleReview ?? null,
    backendFallback: decision.backendFallback ?? null
  };
}

function summarizeReview(review) {
  return {
    move: notationFor(review.move),
    bestMove: notationFor(review.bestMove),
    classification: review.classification ?? null,
    centipawnLoss: Math.round(review.centipawnLoss ?? 0),
    isBestMove: Boolean(review.isBestMove),
    summary: review.explanation?.summary ?? "",
    reasons: [...(review.explanation?.reasons ?? [])],
    playedScore: review.playedScore ?? null,
    bestScore: review.bestScore ?? null,
    playedScoreDetail: review.playedScoreDetail ?? null,
    bestScoreDetail: review.bestAnalysis?.scoreDetail ?? null,
    playedWdl: review.playedWdl ?? null,
    bestWdl: review.bestAnalysis?.wdl ?? null,
    playedLinePlan: review.playedLinePlan ?? null,
    bestLinePlan: review.bestLinePlan ?? null,
    planComparison: review.planComparison ?? null,
    practiceFocus: review.practiceFocus ?? null,
    mistakes: review.mistakes ?? null,
    bestAlternatives: review.bestAlternatives ?? review.bestAnalysis?.explanation?.alternatives ?? []
  };
}

function summarizeCoach(coach) {
  return {
    source: coach.source ?? "search",
    bestMove: notationFor(coach.bestMove),
    score: Math.round(coach.score ?? 0),
    summary: coach.summary ?? "",
    levels: (coach.levels ?? []).map((level) => ({ ...level })),
    alternatives: coach.alternatives ?? [],
    principalVariation: (coach.principalVariation ?? []).map(notationFor).filter(Boolean)
  };
}

function notationFor(move) {
  if (!move) return null;
  if (typeof move === "string") return move;
  return move.notation ?? moveToNotation(move);
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
