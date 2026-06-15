import { PIECES, PIECE_NAMES, PIECE_VALUES } from "./constants.js";
import {
  fileOf,
  indexOf,
  indexToCoord,
  isInside,
  makeMove,
  moveToNotation,
  opponent,
  positionKey,
  rankOf
} from "./board.js";
import { generateLegalMoves, isInCheck } from "./movegen.js";

const DEFAULT_MAX_EXCHANGE_PLIES = 12;

export function analyzeCapture(position, move) {
  if (!move.captured) return null;

  const capturedValue = PIECE_VALUES[move.captured.type];
  const attackerValue = PIECE_VALUES[move.piece.type];
  const after = makeMove(position, move);
  const exchange = analyzeStaticExchange(position, move);
  const recaptures = generateLegalMoves(after, after.turn)
    .filter((reply) => reply.to === move.to && reply.captured)
    .sort((a, b) => PIECE_VALUES[a.piece.type] - PIECE_VALUES[b.piece.type])
    .map((reply) => ({
      move: reply,
      notation: moveToNotation(reply),
      piece: reply.piece,
      pieceName: PIECE_NAMES[reply.piece.type],
      pieceValue: PIECE_VALUES[reply.piece.type]
    }));

  const cheapestRecapture = recaptures[0] ?? null;
  const exchangeScore = exchange.score;

  return {
    capturedValue,
    attackerValue,
    grossGain: capturedValue,
    exchangeScore,
    staticExchangeScore: exchange.score,
    exchangeLine: exchange.line,
    isSafe: recaptures.length === 0 || exchangeScore >= 0,
    isWinning: exchangeScore > 0,
    recaptures,
    cheapestRecapture,
    summary: summarizeCapture(move, exchangeScore, cheapestRecapture)
  };
}

export function captureExchangeScore(position, move) {
  return analyzeCapture(position, move)?.exchangeScore ?? 0;
}

export function analyzeFork(position, move, options = {}) {
  if (!move) return null;

  const side = move.piece?.side ?? position.turn;
  const after = makeMove(position, move);
  const movedPiece = after.board[move.to];
  if (!movedPiece || movedPiece.side !== side) return null;

  const minTargetValue = options.minTargetValue ?? PIECE_VALUES[PIECES.PAWN];
  const targets = new Map();
  const enemy = opponent(side);

  for (const attack of generateLegalMoves(after, side)) {
    if (attack.from !== move.to || !attack.captured) continue;
    if (attack.captured.type !== PIECES.KING && PIECE_VALUES[attack.captured.type] < minTargetValue) continue;
    targets.set(attack.to, forkTarget(attack.to, attack.captured, attack));
  }

  if (isInCheck(after, enemy)) {
    const kingSquare = after.board.findIndex((piece) => piece?.side === enemy && piece.type === PIECES.KING);
    if (kingSquare !== -1) {
      targets.set(kingSquare, forkTarget(kingSquare, after.board[kingSquare], null));
    }
  }

  const orderedTargets = [...targets.values()]
    .sort((a, b) => b.value - a.value || a.square - b.square);
  if (orderedTargets.length < 2) return null;

  const score = orderedTargets.reduce((sum, target) => (
    sum + (target.type === PIECES.KING ? 1200 : Math.min(900, target.value))
  ), 0);

  return {
    move,
    notation: moveToNotation(move),
    piece: movedPiece,
    pieceName: PIECE_NAMES[movedPiece.type],
    targetCount: orderedTargets.length,
    targets: orderedTargets,
    score,
    summary: summarizeFork(move, movedPiece, orderedTargets)
  };
}

export function analyzePins(position, move) {
  if (!move) return null;

  const side = move.piece?.side ?? position.turn;
  const after = makeMove(position, move);
  const pinningPiece = after.board[move.to];
  if (!pinningPiece || pinningPiece.side !== side) return null;
  if (!canPinAlongLine(pinningPiece.type)) return null;

  const enemy = opponent(side);
  const enemyKingSquare = after.board.findIndex((piece) => piece?.side === enemy && piece.type === PIECES.KING);
  if (enemyKingSquare === -1 || !lineAligned(move.to, enemyKingSquare)) return null;
  if (pinningPiece.type === PIECES.KING && fileOf(move.to) !== fileOf(enemyKingSquare)) return null;

  const blockers = occupiedBetween(after, move.to, enemyKingSquare);
  const pin = pinFromBlockers({ move, pinningPiece, blockers, enemy });
  if (!pin) return null;

  return {
    move,
    notation: moveToNotation(move),
    piece: pinningPiece,
    pieceName: PIECE_NAMES[pinningPiece.type],
    pins: [pin],
    score: Math.min(1200, pin.value + (pin.screen ? 80 : 0)),
    summary: summarizePins(move, pinningPiece, [pin])
  };
}

export function analyzeStaticExchange(position, move, options = {}) {
  if (!move.captured) {
    return {
      score: 0,
      line: []
    };
  }

  const maxPlies = options.maxPlies ?? DEFAULT_MAX_EXCHANGE_PLIES;
  const after = makeMove(position, move);
  const reply = bestExchangeReply(after, move.to, after.turn, maxPlies - 1, new Map());
  const score = PIECE_VALUES[move.captured.type] - Math.max(0, reply.score);

  return {
    score,
    line: [
      exchangeLineEntry(move),
      ...reply.line
    ]
  };
}

export function staticExchangeScore(position, move, options = {}) {
  return analyzeStaticExchange(position, move, options).score;
}

function forkTarget(square, piece, attack) {
  return {
    square,
    coord: indexToCoord(square),
    type: piece.type,
    piece,
    pieceName: PIECE_NAMES[piece.type],
    value: PIECE_VALUES[piece.type],
    notation: attack ? moveToNotation(attack) : null
  };
}

function summarizeFork(move, piece, targets) {
  const targetText = targets
    .slice(0, 3)
    .map((target) => `${target.pieceName} on ${target.coord}`)
    .join(" and ");
  return `The ${PIECE_NAMES[piece.type]} ${moveToNotation(move)} creates a fork on ${targetText}.`;
}

function canPinAlongLine(type) {
  return type === PIECES.ROOK || type === PIECES.CANNON || type === PIECES.KING;
}

function lineAligned(first, second) {
  return fileOf(first) === fileOf(second) || rankOf(first) === rankOf(second);
}

function occupiedBetween(position, from, to) {
  const fromFile = fileOf(from);
  const fromRank = rankOf(from);
  const toFile = fileOf(to);
  const toRank = rankOf(to);
  const fileStep = Math.sign(toFile - fromFile);
  const rankStep = Math.sign(toRank - fromRank);
  const blockers = [];
  let file = fromFile + fileStep;
  let rank = fromRank + rankStep;

  while (isInside(file, rank) && (file !== toFile || rank !== toRank)) {
    const square = indexOf(file, rank);
    const piece = position.board[square];
    if (piece) {
      blockers.push({
        square,
        coord: indexToCoord(square),
        piece,
        pieceName: PIECE_NAMES[piece.type],
        value: PIECE_VALUES[piece.type]
      });
    }
    file += fileStep;
    rank += rankStep;
  }

  return blockers;
}

function pinFromBlockers({ move, pinningPiece, blockers, enemy }) {
  if (pinningPiece.type === PIECES.CANNON) {
    if (blockers.length !== 2) return null;
    const [screen, target] = blockers;
    if (target.piece.side !== enemy || target.piece.type === PIECES.KING) return null;
    return pinEntry(target, { screen, method: "cannon-screen", move });
  }

  if (blockers.length !== 1) return null;
  const [target] = blockers;
  if (target.piece.side !== enemy || target.piece.type === PIECES.KING) return null;
  return pinEntry(target, { screen: null, method: pinningPiece.type === PIECES.KING ? "flying-general" : "line", move });
}

function pinEntry(target, { screen, method, move }) {
  return {
    targetSquare: target.square,
    targetCoord: target.coord,
    targetPiece: target.piece,
    targetName: target.pieceName,
    value: target.value,
    screen,
    method,
    notation: moveToNotation(move)
  };
}

function summarizePins(move, piece, pins) {
  const pin = pins[0];
  const screenText = pin.screen ? ` using the ${pin.screen.pieceName} on ${pin.screen.coord} as a screen` : "";
  return `The ${PIECE_NAMES[piece.type]} ${moveToNotation(move)} pins the ${pin.targetName} on ${pin.targetCoord} to the general${screenText}.`;
}

function summarizeCapture(move, exchangeScore, cheapestRecapture) {
  const victim = PIECE_NAMES[move.captured.type];
  const attacker = PIECE_NAMES[move.piece.type];

  if (!cheapestRecapture) {
    return `The ${attacker} wins a ${victim} without an immediate recapture.`;
  }

  if (exchangeScore >= 0) {
    return `The ${attacker} can be recaptured by a ${cheapestRecapture.pieceName}, but the full exchange remains acceptable.`;
  }

  return `The ${attacker} captures a ${victim}, but ${cheapestRecapture.notation} can recapture it.`;
}

function bestExchangeReply(position, target, side, pliesRemaining, cache) {
  if (pliesRemaining <= 0) {
    return {
      score: 0,
      line: []
    };
  }

  const key = `${positionKey(position)}:${target}:${side}:${pliesRemaining}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const replies = generateLegalMoves(position, side)
    .filter((reply) => reply.to === target && reply.captured)
    .sort((a, b) => PIECE_VALUES[a.piece.type] - PIECE_VALUES[b.piece.type]);

  let best = null;

  for (const reply of replies) {
    const after = makeMove(position, reply);
    const continuation = bestExchangeReply(after, target, after.turn, pliesRemaining - 1, cache);
    const score = PIECE_VALUES[reply.captured.type] - Math.max(0, continuation.score);
    const line = [exchangeLineEntry(reply), ...continuation.line];

    if (!best || score > best.score) {
      best = { score, line };
    }
  }

  const result = !best || best.score < 0
    ? { score: 0, line: [] }
    : best;

  cache.set(key, result);
  return result;
}

function exchangeLineEntry(move) {
  return {
    move,
    notation: moveToNotation(move),
    side: move.piece.side,
    piece: move.piece,
    pieceName: PIECE_NAMES[move.piece.type],
    captured: move.captured,
    capturedName: PIECE_NAMES[move.captured.type],
    capturedValue: PIECE_VALUES[move.captured.type]
  };
}
