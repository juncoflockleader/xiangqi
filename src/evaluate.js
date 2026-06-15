import {
  BOARD_FILES,
  BOARD_RANKS,
  PIECE_NAMES,
  PIECE_VALUES,
  PIECES,
  SIDES
} from "./constants.js";
import {
  fileOf,
  forwardDelta,
  hasCrossedRiver,
  indexOf,
  isInside,
  opponent,
  ownRiverSide,
  palaceContains,
  rankOf
} from "./board.js";
import { generatePseudoMoves, isInCheck } from "./movegen.js";

const MOBILITY_WEIGHTS = Object.freeze({
  [PIECES.KING]: 1,
  [PIECES.ADVISOR]: 1,
  [PIECES.ELEPHANT]: 1,
  [PIECES.HORSE]: 7,
  [PIECES.ROOK]: 5,
  [PIECES.CANNON]: 4,
  [PIECES.PAWN]: 2
});

const KING_ATTACK_WEIGHTS = Object.freeze({
  [PIECES.KING]: 0,
  [PIECES.ADVISOR]: 0,
  [PIECES.ELEPHANT]: 0,
  [PIECES.HORSE]: 16,
  [PIECES.ROOK]: 22,
  [PIECES.CANNON]: 18,
  [PIECES.PAWN]: 14
});

export function evaluatePosition(position, perspective = position.turn, options = {}) {
  const terms = {
    [SIDES.RED]: createTerms(),
    [SIDES.BLACK]: createTerms()
  };
  const pseudoMoves = {
    [SIDES.RED]: generatePseudoMoves(position, SIDES.RED),
    [SIDES.BLACK]: generatePseudoMoves(position, SIDES.BLACK)
  };
  const control = {
    [SIDES.RED]: createControlMap(position, SIDES.RED),
    [SIDES.BLACK]: createControlMap(position, SIDES.BLACK)
  };

  for (let square = 0; square < position.board.length; square += 1) {
    const piece = position.board[square];
    if (!piece) continue;

    terms[piece.side].material += materialValue(piece, square);
    terms[piece.side].placement += placementValue(piece, square);
    terms[piece.side].pawnStructure += pawnValue(position, piece, square);
    terms[piece.side].kingSafety += localDefenseValue(position, piece, square);
    terms[piece.side].coordination += coordinationValue(position, piece, square);
    terms[piece.side].linePressure += linePressureValue(position, piece, square);
  }

  for (const side of [SIDES.RED, SIDES.BLACK]) {
    const sideMoves = pseudoMoves[side];
    terms[side].mobility += mobilityValue(sideMoves);
    terms[side].threats += threatValue(sideMoves);
    terms[side].pieceSafety += pieceSafetyValue(position, side, control[side], control[opponent(side)]);
    terms[side].kingAttack += kingAttackValue(position, side, sideMoves);
    terms[side].kingSafety += globalKingSafety(position, side, control[opponent(side)]);

    if (isInCheck(position, opponent(side))) {
      terms[side].threats += 45;
    }
  }

  const red = totalTerms(terms[SIDES.RED]);
  const black = totalTerms(terms[SIDES.BLACK]);
  const signed = red - black;
  const score = perspective === SIDES.RED ? signed : -signed;

  if (!options.detailed) {
    return { score };
  }

  return {
    score,
    sideScores: {
      [SIDES.RED]: red,
      [SIDES.BLACK]: black
    },
    terms,
    difference: diffTerms(terms, perspective)
  };
}

export function evaluateMoveDelta(before, after, perspective) {
  const beforeEval = evaluatePosition(before, perspective, { detailed: true });
  const afterEval = evaluatePosition(after, perspective, { detailed: true });
  const delta = {};

  for (const key of Object.keys(beforeEval.difference)) {
    delta[key] = afterEval.difference[key] - beforeEval.difference[key];
  }

  return {
    before: beforeEval.score,
    after: afterEval.score,
    deltaScore: afterEval.score - beforeEval.score,
    delta
  };
}

export function describeEvaluationTerms(delta) {
  return Object.entries(delta)
    .filter(([, value]) => Math.abs(value) >= 8)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 4)
    .map(([term, value]) => ({
      term,
      value,
      text: `${value >= 0 ? "improves" : "concedes"} ${readableTerm(term)} by ${Math.abs(Math.round(value))}`
    }));
}

function createTerms() {
  return {
    material: 0,
    placement: 0,
    mobility: 0,
    threats: 0,
    pawnStructure: 0,
    kingSafety: 0,
    kingAttack: 0,
    pieceSafety: 0,
    coordination: 0,
    linePressure: 0
  };
}

function totalTerms(terms) {
  return Object.values(terms).reduce((sum, value) => sum + value, 0);
}

function diffTerms(terms, perspective) {
  const enemy = opponent(perspective);
  const diff = {};

  for (const key of Object.keys(terms[perspective])) {
    diff[key] = terms[perspective][key] - terms[enemy][key];
  }

  return diff;
}

function materialValue(piece, square) {
  if (piece.type !== PIECES.PAWN) return PIECE_VALUES[piece.type];

  const rank = rankOf(square);
  const progress = piece.side === SIDES.RED ? BOARD_RANKS - 1 - rank : rank;
  return PIECE_VALUES[piece.type] + progress * 9 + (hasCrossedRiver(piece.side, rank) ? 45 : 0);
}

function placementValue(piece, square) {
  const file = fileOf(square);
  const rank = rankOf(square);
  const centerFileBonus = 4 - Math.abs(file - 4);
  const sideProgress = piece.side === SIDES.RED ? BOARD_RANKS - 1 - rank : rank;
  const palaceDistance = Math.abs(file - 4) + Math.abs(rank - (piece.side === SIDES.RED ? 8 : 1));

  switch (piece.type) {
    case PIECES.KING:
      return 25 - palaceDistance * 6;
    case PIECES.ADVISOR:
      return 12 - palaceDistance * 2;
    case PIECES.ELEPHANT:
      return 14 + centerFileBonus * 4;
    case PIECES.HORSE:
      return centerFileBonus * 12 + sideProgress * 4;
    case PIECES.ROOK:
      return centerFileBonus * 7 + sideProgress * 3;
    case PIECES.CANNON:
      return centerFileBonus * 9 + (hasCrossedRiver(piece.side, rank) ? 12 : 0);
    case PIECES.PAWN:
      return centerFileBonus * 6 + sideProgress * 7;
    default:
      return 0;
  }
}

function pawnValue(position, piece, square) {
  if (piece.type !== PIECES.PAWN) return 0;

  const rank = rankOf(square);
  const file = fileOf(square);
  const riverBonus = hasCrossedRiver(piece.side, rank) ? 35 : 0;
  const centralPassedBonus = Math.max(0, 3 - Math.abs(file - 4)) * 8;
  const supportBonus = pawnSupportValue(position, piece, file, rank);
  const lastRankPenalty = (piece.side === SIDES.RED ? rank === 0 : rank === BOARD_RANKS - 1) ? -18 : 0;
  return riverBonus + centralPassedBonus + supportBonus + lastRankPenalty;
}

function pawnSupportValue(position, piece, file, rank) {
  let score = 0;

  if (hasCrossedRiver(piece.side, rank)) {
    for (const neighborFile of [file - 1, file + 1]) {
      if (!isFriendlyPawn(position, piece.side, neighborFile, rank)) continue;
      score += 18;
    }
  }

  const supportRank = rank - forwardDelta(piece.side);
  if (isFriendlyPawn(position, piece.side, file, supportRank)) {
    score += hasCrossedRiver(piece.side, rank) ? 14 : 8;
  }

  return score;
}

function isFriendlyPawn(position, side, file, rank) {
  if (!isInside(file, rank)) return false;
  const piece = position.board[indexOf(file, rank)];
  return piece?.side === side && piece.type === PIECES.PAWN;
}

function coordinationValue(position, piece, square) {
  if (piece.type === PIECES.HORSE) {
    return horseLegCoordination(position, piece, square);
  }
  if (piece.type === PIECES.ELEPHANT) {
    return elephantEyeCoordination(position, piece, square);
  }

  return 0;
}

function horseLegCoordination(position, piece, square) {
  const file = fileOf(square);
  const rank = rankOf(square);
  const legSquares = [
    [file, rank - 1],
    [file + 1, rank],
    [file, rank + 1],
    [file - 1, rank]
  ];
  let blockedLegs = 0;
  let score = 0;

  for (const [legFile, legRank] of legSquares) {
    if (!isInside(legFile, legRank)) continue;
    const blocker = position.board[indexOf(legFile, legRank)];
    if (!blocker) continue;

    blockedLegs += 1;
    score -= blocker.side === piece.side ? 18 : 10;
  }

  return blockedLegs === 0 ? score + 18 : score;
}

function elephantEyeCoordination(position, piece, square) {
  const file = fileOf(square);
  const rank = rankOf(square);
  let openEyes = 0;
  let score = 0;

  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const targetFile = file + dx * 2;
    const targetRank = rank + dy * 2;
    const eyeFile = file + dx;
    const eyeRank = rank + dy;
    if (!isInside(targetFile, targetRank)) continue;
    if (!ownRiverSide(piece.side, targetRank)) continue;

    const blocker = position.board[indexOf(eyeFile, eyeRank)];
    if (blocker) {
      score -= blocker.side === piece.side ? 14 : 18;
      continue;
    }

    openEyes += 1;
    score += 7;
  }

  return openEyes >= 2 ? score + 6 : score;
}

function linePressureValue(position, piece, square) {
  if (piece.type !== PIECES.ROOK && piece.type !== PIECES.CANNON) return 0;

  const enemyKingSquare = position.board.findIndex(
    (candidate) => candidate?.side === opponent(piece.side) && candidate.type === PIECES.KING
  );
  if (enemyKingSquare === -1) return 0;

  const sourceFile = fileOf(square);
  const sourceRank = rankOf(square);
  const kingFile = fileOf(enemyKingSquare);
  const kingRank = rankOf(enemyKingSquare);

  if (sourceFile !== kingFile && sourceRank !== kingRank) return 0;

  const blockers = countLineBlockers(position, square, enemyKingSquare);

  if (piece.type === PIECES.ROOK) {
    if (blockers === 0) return 90;
    if (blockers === 1) return 36;
    return 0;
  }

  if (blockers === 1) return 95;
  if (blockers === 0) return 22;
  if (blockers === 2) return 14;
  return 0;
}

function countLineBlockers(position, from, to) {
  const fromFile = fileOf(from);
  const fromRank = rankOf(from);
  const toFile = fileOf(to);
  const toRank = rankOf(to);
  const fileStep = Math.sign(toFile - fromFile);
  const rankStep = Math.sign(toRank - fromRank);
  let file = fromFile + fileStep;
  let rank = fromRank + rankStep;
  let blockers = 0;

  while (file !== toFile || rank !== toRank) {
    if (position.board[indexOf(file, rank)]) blockers += 1;
    file += fileStep;
    rank += rankStep;
  }

  return blockers;
}

function localDefenseValue(position, piece, square) {
  if (piece.type !== PIECES.ADVISOR && piece.type !== PIECES.ELEPHANT) return 0;

  const ownKingSquare = position.board.findIndex(
    (candidate) => candidate?.side === piece.side && candidate.type === PIECES.KING
  );
  if (ownKingSquare === -1) return 0;

  const distance = Math.abs(fileOf(square) - fileOf(ownKingSquare)) + Math.abs(rankOf(square) - rankOf(ownKingSquare));
  return Math.max(0, 28 - distance * 6);
}

function mobilityValue(moves) {
  return moves.reduce((sum, move) => sum + (MOBILITY_WEIGHTS[move.piece.type] ?? 1), 0);
}

function threatValue(moves) {
  let score = 0;

  for (const move of moves) {
    if (!move.captured) continue;
    const victim = PIECE_VALUES[move.captured.type];
    const attacker = PIECE_VALUES[move.piece.type];
    score += Math.max(4, victim * 0.08 - attacker * 0.01);
  }

  return score;
}

function pieceSafetyValue(position, side, ownControl, enemyControl) {
  let score = 0;

  for (let square = 0; square < position.board.length; square += 1) {
    const piece = position.board[square];
    if (!piece || piece.side !== side || piece.type === PIECES.KING) continue;

    const value = PIECE_VALUES[piece.type];
    const own = ownControl.get(square);
    const enemy = enemyControl.get(square);

    if (enemy) {
      const defenders = own?.count ?? 0;
      const attackers = enemy.count;
      const loosePenalty = defenders === 0
        ? Math.min(180, value * 0.16)
        : Math.min(80, value * 0.06);
      const overloadPenalty = Math.max(0, attackers - defenders) * 10;
      const cheapAttackerPenalty = enemy.minAttackerValue < value ? 14 : 0;

      score -= Math.round(loosePenalty + overloadPenalty + cheapAttackerPenalty);
      continue;
    }

    if (own && value >= PIECE_VALUES[PIECES.HORSE]) {
      score += Math.min(18, Math.round(value * 0.018)) + Math.min(2, own.count) * 2;
    }
  }

  return score;
}

function createControlMap(position, side) {
  const control = new Map();

  for (let square = 0; square < position.board.length; square += 1) {
    const piece = position.board[square];
    if (!piece || piece.side !== side) continue;

    for (const target of controlledSquares(position, square, piece)) {
      addControl(control, target, piece);
    }
  }

  return control;
}

function addControl(control, square, piece) {
  const current = control.get(square) ?? {
    count: 0,
    minAttackerValue: Number.POSITIVE_INFINITY
  };
  current.count += 1;
  current.minAttackerValue = Math.min(current.minAttackerValue, PIECE_VALUES[piece.type]);
  control.set(square, current);
}

function controlledSquares(position, square, piece) {
  switch (piece.type) {
    case PIECES.KING:
      return shortRangeControls(square, piece, [[0, -1], [1, 0], [0, 1], [-1, 0]], palaceContains);
    case PIECES.ADVISOR:
      return shortRangeControls(square, piece, [[1, 1], [1, -1], [-1, 1], [-1, -1]], palaceContains);
    case PIECES.ELEPHANT:
      return elephantControls(position, square, piece);
    case PIECES.HORSE:
      return horseControls(position, square);
    case PIECES.ROOK:
      return rookControls(position, square);
    case PIECES.CANNON:
      return cannonControls(position, square);
    case PIECES.PAWN:
      return pawnControls(square, piece);
    default:
      return [];
  }
}

function shortRangeControls(square, piece, deltas, contains) {
  const file = fileOf(square);
  const rank = rankOf(square);
  const controls = [];

  for (const [dx, dy] of deltas) {
    const targetFile = file + dx;
    const targetRank = rank + dy;
    if (!contains(piece.side, targetFile, targetRank)) continue;
    controls.push(indexOf(targetFile, targetRank));
  }

  return controls;
}

function elephantControls(position, square, piece) {
  const file = fileOf(square);
  const rank = rankOf(square);
  const controls = [];

  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const targetFile = file + dx * 2;
    const targetRank = rank + dy * 2;
    const eyeFile = file + dx;
    const eyeRank = rank + dy;
    if (!isInside(targetFile, targetRank)) continue;
    if (!ownRiverSide(piece.side, targetRank)) continue;
    if (position.board[indexOf(eyeFile, eyeRank)]) continue;
    controls.push(indexOf(targetFile, targetRank));
  }

  return controls;
}

function horseControls(position, square) {
  const file = fileOf(square);
  const rank = rankOf(square);
  const controls = [];

  for (const [dx, dy] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
    const targetFile = file + dx;
    const targetRank = rank + dy;
    if (!isInside(targetFile, targetRank)) continue;

    const legFile = Math.abs(dx) === 2 ? file + Math.sign(dx) : file;
    const legRank = Math.abs(dy) === 2 ? rank + Math.sign(dy) : rank;
    if (position.board[indexOf(legFile, legRank)]) continue;
    controls.push(indexOf(targetFile, targetRank));
  }

  return controls;
}

function rookControls(position, square) {
  const controls = [];
  forEachRay(square, (target) => {
    controls.push(target);
    return !position.board[target];
  });
  return controls;
}

function cannonControls(position, square) {
  const controls = [];
  const file = fileOf(square);
  const rank = rankOf(square);

  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    let targetFile = file + dx;
    let targetRank = rank + dy;
    let screenFound = false;

    while (isInside(targetFile, targetRank)) {
      const target = indexOf(targetFile, targetRank);
      const occupant = position.board[target];
      if (!screenFound) {
        if (occupant) screenFound = true;
      } else if (occupant) {
        controls.push(target);
        break;
      }

      targetFile += dx;
      targetRank += dy;
    }
  }

  return controls;
}

function pawnControls(square, piece) {
  const file = fileOf(square);
  const rank = rankOf(square);
  const controls = [];
  const forwardRank = rank + forwardDelta(piece.side);
  if (isInside(file, forwardRank)) controls.push(indexOf(file, forwardRank));

  if (hasCrossedRiver(piece.side, rank)) {
    for (const sideFile of [file - 1, file + 1]) {
      if (isInside(sideFile, rank)) controls.push(indexOf(sideFile, rank));
    }
  }

  return controls;
}

function forEachRay(square, visit) {
  const file = fileOf(square);
  const rank = rankOf(square);

  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    let targetFile = file + dx;
    let targetRank = rank + dy;

    while (isInside(targetFile, targetRank)) {
      const shouldContinue = visit(indexOf(targetFile, targetRank));
      if (!shouldContinue) break;
      targetFile += dx;
      targetRank += dy;
    }
  }
}

function kingAttackValue(position, side, pseudoMoves) {
  const enemy = opponent(side);
  const enemyKingSquare = position.board.findIndex((piece) => piece?.side === enemy && piece.type === PIECES.KING);
  if (enemyKingSquare === -1) return 0;

  const kingFile = fileOf(enemyKingSquare);
  const kingRank = rankOf(enemyKingSquare);
  const attackedPalaceSquares = new Set();
  const attackers = new Set();
  let score = 0;

  for (const move of pseudoMoves) {
    const targetFile = fileOf(move.to);
    const targetRank = rankOf(move.to);
    if (!palaceContains(enemy, targetFile, targetRank)) continue;

    const pieceWeight = KING_ATTACK_WEIGHTS[move.piece.type] ?? 0;
    if (pieceWeight <= 0) continue;

    const distance = Math.abs(targetFile - kingFile) + Math.abs(targetRank - kingRank);
    const proximity = Math.max(0, 10 - distance * 3);

    score += pieceWeight + proximity;
    attackedPalaceSquares.add(move.to);
    attackers.add(move.from);

    if (move.to === enemyKingSquare) score += 60;
    if (move.captured) {
      score += Math.min(40, PIECE_VALUES[move.captured.type] * 0.05);
    }
  }

  if (score === 0) return 0;

  score += Math.max(0, attackedPalaceSquares.size - 1) * 5;
  score += Math.max(0, attackers.size - 1) * 10;
  score += Math.max(0, 4 - countGuards(position, enemy)) * 5;
  return score;
}

function globalKingSafety(position, side, enemyControl) {
  const kingSquare = position.board.findIndex((piece) => piece?.side === side && piece.type === PIECES.KING);
  if (kingSquare === -1) return -20000;

  let score = 0;
  const file = fileOf(kingSquare);
  const rank = rankOf(kingSquare);
  const enemy = opponent(side);

  const guardCount = countGuards(position, side);
  score += Math.min(4, guardCount) * 18;
  score += fortressShapeValue(position, side, kingSquare);

  if (isOpenFileTowardEnemyKing(position, kingSquare, side)) {
    score -= 80;
  }

  for (let direction of [-1, 1]) {
    const neighborFile = file + direction;
    if (neighborFile < 0 || neighborFile >= BOARD_FILES) continue;
    const neighbor = position.board[indexOf(neighborFile, rank)];
    if (!neighbor || neighbor.side !== side) score -= 6;
  }

  const enemyForwardRank = rank - forwardDelta(enemy);
  if (enemyForwardRank >= 0 && enemyForwardRank < BOARD_RANKS) {
    const frontal = position.board[indexOf(file, enemyForwardRank)];
    if (frontal?.side === enemy && frontal.type === PIECES.PAWN) score -= 45;
  }

  score += palaceControlSafety(position, side, kingSquare, enemyControl);

  return score;
}

function fortressShapeValue(position, side, kingSquare) {
  const advisors = pieceSquares(position, side, PIECES.ADVISOR);
  const elephants = pieceSquares(position, side, PIECES.ELEPHANT);
  const advisorCount = advisors.length;
  const elephantCount = elephants.length;
  let score = 0;

  score -= Math.max(0, 2 - advisorCount) * 12;
  score -= Math.max(0, 2 - elephantCount) * 8;

  if (advisorCount >= 2) score += 18;
  if (elephantCount >= 2) score += 14;
  if (advisorCount >= 2 && elephantCount >= 2) score += 18;

  score += advisorShapeValue(side, advisors);
  score += elephantShapeValue(side, elephants);

  const homeRank = side === SIDES.RED ? BOARD_RANKS - 1 : 0;
  if (fileOf(kingSquare) === 4 && rankOf(kingSquare) === homeRank && advisorCount >= 2 && elephantCount >= 2) {
    score += 8;
  }

  return score;
}

function pieceSquares(position, side, type) {
  const squares = [];
  for (let square = 0; square < position.board.length; square += 1) {
    const piece = position.board[square];
    if (piece?.side === side && piece.type === type) squares.push(square);
  }
  return squares;
}

function advisorShapeValue(side, advisors) {
  const homeRank = side === SIDES.RED ? BOARD_RANKS - 1 : 0;
  const centerRank = side === SIDES.RED ? BOARD_RANKS - 2 : 1;
  let score = 0;

  const homeCornerCount = advisors.filter((square) => {
    const file = fileOf(square);
    return rankOf(square) === homeRank && (file === 3 || file === 5);
  }).length;
  const centerCount = advisors.filter((square) => fileOf(square) === 4 && rankOf(square) === centerRank).length;

  score += homeCornerCount * 6;
  score += centerCount * 8;
  if (homeCornerCount >= 2) score += 10;
  if (homeCornerCount >= 1 && centerCount >= 1) score += 6;

  return score;
}

function elephantShapeValue(side, elephants) {
  const homeRank = side === SIDES.RED ? BOARD_RANKS - 1 : 0;
  const advancedRank = side === SIDES.RED ? BOARD_RANKS - 3 : 2;
  let score = 0;

  const homeWingCount = elephants.filter((square) => {
    const file = fileOf(square);
    return rankOf(square) === homeRank && (file === 2 || file === 6);
  }).length;
  const centralGuardCount = elephants.filter((square) => {
    const file = fileOf(square);
    return rankOf(square) === advancedRank && file === 4;
  }).length;

  score += homeWingCount * 4;
  score += centralGuardCount * 8;
  if (homeWingCount >= 2) score += 12;

  return score;
}

function palaceControlSafety(position, side, kingSquare, enemyControl) {
  if (!enemyControl) return 0;

  const kingFile = fileOf(kingSquare);
  const kingRank = rankOf(kingSquare);
  let penalty = 0;

  for (let rank = 0; rank < BOARD_RANKS; rank += 1) {
    for (let file = 3; file <= 5; file += 1) {
      if (!palaceContains(side, file, rank)) continue;

      const square = indexOf(file, rank);
      const enemy = enemyControl.get(square);
      if (!enemy) continue;

      const distance = Math.abs(file - kingFile) + Math.abs(rank - kingRank);
      if (square === kingSquare) {
        penalty += 80 + enemy.count * 18;
      } else if (distance === 1) {
        penalty += 22 + enemy.count * 7;
      } else {
        penalty += 8 + enemy.count * 4;
      }
    }
  }

  const safeEscapes = kingEscapeSquares(position, side, kingSquare)
    .filter((square) => !enemyControl.has(square)).length;
  if (safeEscapes === 0) penalty += 30;
  else if (safeEscapes === 1) penalty += 12;

  return -penalty;
}

function kingEscapeSquares(position, side, kingSquare) {
  const file = fileOf(kingSquare);
  const rank = rankOf(kingSquare);
  const squares = [];

  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const targetFile = file + dx;
    const targetRank = rank + dy;
    if (!palaceContains(side, targetFile, targetRank)) continue;

    const target = indexOf(targetFile, targetRank);
    const occupant = position.board[target];
    if (occupant?.side === side) continue;
    squares.push(target);
  }

  return squares;
}

function countGuards(position, side) {
  return position.board.filter(
    (piece) => piece?.side === side && (piece.type === PIECES.ADVISOR || piece.type === PIECES.ELEPHANT)
  ).length;
}

function isOpenFileTowardEnemyKing(position, kingSquare, side) {
  const file = fileOf(kingSquare);
  const rank = rankOf(kingSquare);
  const step = side === SIDES.RED ? -1 : 1;

  for (let targetRank = rank + step; targetRank >= 0 && targetRank < BOARD_RANKS; targetRank += step) {
    const piece = position.board[indexOf(file, targetRank)];
    if (!piece) continue;
    return piece.type === PIECES.KING && piece.side !== side;
  }

  return false;
}

function readableTerm(term) {
  const labels = {
    material: "material balance",
    placement: "piece placement",
    mobility: "mobility",
    threats: "tactical pressure",
    pawnStructure: "pawn progress and support",
    kingSafety: "king safety",
    kingAttack: "pressure on the general",
    pieceSafety: "piece safety",
    coordination: "piece coordination",
    linePressure: "rook and cannon line pressure"
  };

  return labels[term] ?? term;
}

export function describeCapture(move) {
  if (!move.captured) return null;
  return `wins a ${PIECE_NAMES[move.captured.type]} with the ${PIECE_NAMES[move.piece.type]}`;
}
