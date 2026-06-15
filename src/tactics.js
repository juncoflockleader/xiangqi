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

export function analyzeDiscoveredCheck(position, move) {
  if (!move) return null;

  const side = move.piece?.side ?? position.turn;
  const after = makeMove(position, move);
  const movedPiece = after.board[move.to];
  if (!movedPiece || movedPiece.side !== side) return null;

  const enemy = opponent(side);
  const enemyKingSquare = after.board.findIndex((piece) => piece?.side === enemy && piece.type === PIECES.KING);
  if (enemyKingSquare === -1 || !isInCheck(after, enemy)) return null;

  const attackers = checkingAttackers(after, side, enemyKingSquare);
  const discoveries = attackers
    .filter((attacker) => attacker.square !== move.to)
    .map((attacker) => discoveredCheckEntry(position, after, move, attacker, enemyKingSquare))
    .filter(Boolean);

  if (discoveries.length === 0) return null;

  const directCheck = attackers.some((attacker) => attacker.square === move.to);
  const score = discoveries.reduce((sum, entry) => (
    sum + (entry.method === "horse-leg" ? 520 : 460) + entry.pieceValue / 8
  ), directCheck ? 180 : 0);

  return {
    move,
    notation: moveToNotation(move),
    piece: movedPiece,
    pieceName: PIECE_NAMES[movedPiece.type],
    discoveredChecks: discoveries,
    directCheck,
    score: Math.round(score),
    summary: summarizeDiscoveredCheck(move, movedPiece, discoveries, directCheck)
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

function checkingAttackers(position, side, enemyKingSquare) {
  const attackers = [];

  for (let square = 0; square < position.board.length; square += 1) {
    const piece = position.board[square];
    if (!piece || piece.side !== side) continue;
    const attack = checkAttackEntry(position, square, piece, enemyKingSquare);
    if (attack) attackers.push(attack);
  }

  return attackers;
}

function checkAttackEntry(position, square, piece, enemyKingSquare) {
  if (piece.type === PIECES.ROOK || piece.type === PIECES.CANNON || piece.type === PIECES.KING) {
    if (!lineAligned(square, enemyKingSquare)) return null;
    if (piece.type === PIECES.KING && fileOf(square) !== fileOf(enemyKingSquare)) return null;
    const blockers = occupiedBetween(position, square, enemyKingSquare);
    if (piece.type === PIECES.CANNON ? blockers.length !== 1 : blockers.length !== 0) return null;
    return attackEntry(square, piece, piece.type === PIECES.CANNON ? { screen: blockers[0] } : {});
  }

  if (piece.type === PIECES.HORSE) {
    const leg = horseLegSquare(square, enemyKingSquare);
    if (leg === null || position.board[leg]) return null;
    return attackEntry(square, piece, { leg });
  }

  return null;
}

function attackEntry(square, piece, details = {}) {
  return {
    square,
    coord: indexToCoord(square),
    piece,
    pieceName: PIECE_NAMES[piece.type],
    pieceValue: PIECE_VALUES[piece.type],
    ...details
  };
}

function discoveredCheckEntry(before, after, move, attacker, enemyKingSquare) {
  if (attacker.piece.type === PIECES.HORSE) {
    return horseDiscoveredCheckEntry(before, after, move, attacker);
  }

  return lineDiscoveredCheckEntry(before, after, move, attacker, enemyKingSquare);
}

function lineDiscoveredCheckEntry(before, after, move, attacker, enemyKingSquare) {
  if (!lineAligned(attacker.square, enemyKingSquare)) return null;
  if (attacker.piece.type === PIECES.KING && fileOf(attacker.square) !== fileOf(enemyKingSquare)) return null;

  const beforeBlockers = occupiedBetween(before, attacker.square, enemyKingSquare);
  if (!beforeBlockers.some((blocker) => blocker.square === move.from)) return null;

  const afterBlockers = occupiedBetween(after, attacker.square, enemyKingSquare);
  if (attacker.piece.type === PIECES.CANNON) {
    if (afterBlockers.length !== 1) return null;
    return discoveredEntry(attacker, {
      method: "cannon-line",
      screen: afterBlockers[0],
      uncoveredFrom: indexToCoord(move.from)
    });
  }

  if (afterBlockers.length !== 0) return null;
  return discoveredEntry(attacker, {
    method: attacker.piece.type === PIECES.KING ? "flying-general" : "line",
    uncoveredFrom: indexToCoord(move.from)
  });
}

function horseDiscoveredCheckEntry(before, after, move, attacker) {
  if (attacker.leg !== move.from) return null;
  if (!before.board[move.from] || after.board[move.from]) return null;
  return discoveredEntry(attacker, {
    method: "horse-leg",
    uncoveredFrom: indexToCoord(move.from)
  });
}

function discoveredEntry(attacker, details) {
  return {
    attackerSquare: attacker.square,
    attackerCoord: attacker.coord,
    attackerPiece: attacker.piece,
    attackerName: attacker.pieceName,
    pieceValue: attacker.pieceValue,
    ...details
  };
}

function horseLegSquare(from, to) {
  const fromFile = fileOf(from);
  const fromRank = rankOf(from);
  const toFile = fileOf(to);
  const toRank = rankOf(to);
  const dx = toFile - fromFile;
  const dy = toRank - fromRank;
  if (!((Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1))) {
    return null;
  }

  const legFile = Math.abs(dx) === 2 ? fromFile + Math.sign(dx) : fromFile;
  const legRank = Math.abs(dy) === 2 ? fromRank + Math.sign(dy) : fromRank;
  return indexOf(legFile, legRank);
}

function summarizeDiscoveredCheck(move, piece, discoveries, directCheck) {
  const first = discoveries[0];
  const screenText = first.screen ? ` using the ${first.screen.pieceName} on ${first.screen.coord} as a screen` : "";
  const doubleText = directCheck || discoveries.length > 1 ? " and creates a double-check motif" : "";
  return `The ${PIECE_NAMES[piece.type]} ${moveToNotation(move)} uncovers a ${first.attackerName} check from ${first.attackerCoord}${screenText}${doubleText}.`;
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
