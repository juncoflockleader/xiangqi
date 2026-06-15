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
    terms[piece.side].passedSoldier += passedSoldierValue(position, piece, square);
    terms[piece.side].kingSafety += localDefenseValue(position, piece, square);
    terms[piece.side].coordination += coordinationValue(position, piece, square);
    terms[piece.side].linkedHorse += linkedHorseValue(position, piece, square);
    terms[piece.side].linePressure += linePressureValue(position, piece, square);
    terms[piece.side].cannonPlatform += cannonPlatformValue(position, piece, square);
    terms[piece.side].pinPressure += pinPressureValue(position, piece, square);
    terms[piece.side].rookActivity += rookActivityValue(position, piece, square);
    terms[piece.side].riverControl += riverControlValue(position, piece, square);
    terms[piece.side].horsePressure += horsePressureValue(position, piece, square);
  }

  for (const side of [SIDES.RED, SIDES.BLACK]) {
    const sideMoves = pseudoMoves[side];
    terms[side].mobility += mobilityValue(sideMoves);
    terms[side].threats += threatValue(sideMoves);
    terms[side].pieceSafety += pieceSafetyValue(position, side, control[side], control[opponent(side)]);
    terms[side].kingAttack += kingAttackValue(position, side, sideMoves);
    terms[side].kingSafety += globalKingSafety(position, side, control[opponent(side)]);
    terms[side].palaceShape += palaceShapeValue(position, side);
    terms[side].batteryPressure += batteryPressureValue(position, side);

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
    .slice(0, 5)
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
    passedSoldier: 0,
    kingSafety: 0,
    palaceShape: 0,
    kingAttack: 0,
    pieceSafety: 0,
    coordination: 0,
    linkedHorse: 0,
    linePressure: 0,
    cannonPlatform: 0,
    pinPressure: 0,
    batteryPressure: 0,
    rookActivity: 0,
    riverControl: 0,
    horsePressure: 0
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
  const invasionBonus = pawnInvasionValue(position, piece, square, file, rank);
  const lastRankPenalty = (piece.side === SIDES.RED ? rank === 0 : rank === BOARD_RANKS - 1) ? -18 : 0;
  return riverBonus + centralPassedBonus + supportBonus + invasionBonus + lastRankPenalty;
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

function pawnInvasionValue(position, piece, square, file, rank) {
  if (!hasCrossedRiver(piece.side, rank)) return 0;

  const enemy = opponent(piece.side);
  const enemyKingSquare = position.board.findIndex(
    (candidate) => candidate?.side === enemy && candidate.type === PIECES.KING
  );
  if (enemyKingSquare === -1) return 0;

  const kingFile = fileOf(enemyKingSquare);
  const kingRank = rankOf(enemyKingSquare);
  const fileDistance = Math.abs(file - kingFile);
  const rankDistance = Math.abs(rank - kingRank);
  let score = 0;

  if (palaceContains(enemy, file, rank)) {
    score += 36;
    if (fileDistance === 0) score += 28;
    else if (fileDistance === 1) score += 16;
    score += Math.max(0, 3 - rankDistance) * 8;
  }

  if (fileDistance === 0 && isPawnInFrontOfEnemyKing(piece.side, rank, kingRank)) {
    score += Math.max(0, 32 - rankDistance * 5);
  }

  if (pawnControls(square, piece).includes(enemyKingSquare)) {
    score += 70;
  }

  return score;
}

function passedSoldierValue(position, piece, square) {
  if (piece.type !== PIECES.PAWN) return 0;

  const rank = rankOf(square);
  if (!hasCrossedRiver(piece.side, rank)) return 0;

  const file = fileOf(square);
  const enemy = opponent(piece.side);
  const progress = piece.side === SIDES.RED ? BOARD_RANKS - 1 - rank : rank;
  const centrality = Math.max(0, 4 - Math.abs(file - 4));
  const forward = forwardDelta(piece.side);
  const lane = forwardLaneStatus(position, piece.side, file, rank);
  let score = Math.max(0, progress - 4) * 9;

  score += centrality * 4;
  if (file >= 3 && file <= 5) score += 10;

  if (!lane.blocker) {
    score += 16;
  } else if (lane.blocker.side === piece.side) {
    score -= 12;
  } else {
    score += Math.min(18, Math.round((PIECE_VALUES[lane.blocker.type] ?? 0) * 0.025));
  }

  if (!enemyPawnCanContest(position, enemy, square) && !lane.enemyPawnAhead) {
    score += 12;
  }

  const targetRank = rank + forward;
  if (isInside(file, targetRank) && palaceContains(enemy, file, targetRank)) {
    score += 14;
  }
  if (palaceContains(enemy, file, rank)) {
    score += 18;
  }

  return score;
}

function forwardLaneStatus(position, side, file, rank) {
  const forward = forwardDelta(side);
  let targetRank = rank + forward;

  while (isInside(file, targetRank)) {
    const blocker = position.board[indexOf(file, targetRank)];
    if (blocker) {
      return {
        blocker,
        enemyPawnAhead: blocker.side !== side && blocker.type === PIECES.PAWN
      };
    }
    targetRank += forward;
  }

  return {
    blocker: null,
    enemyPawnAhead: false
  };
}

function enemyPawnCanContest(position, enemy, square) {
  for (let candidate = 0; candidate < position.board.length; candidate += 1) {
    const piece = position.board[candidate];
    if (piece?.side !== enemy || piece.type !== PIECES.PAWN) continue;
    if (pawnControls(candidate, piece).includes(square)) return true;
  }

  return false;
}

function isPawnInFrontOfEnemyKing(side, pawnRank, kingRank) {
  return side === SIDES.RED ? pawnRank > kingRank : pawnRank < kingRank;
}

function palaceShapeValue(position, side) {
  const kingSquare = position.board.findIndex((piece) => piece?.side === side && piece.type === PIECES.KING);
  if (kingSquare === -1) return -20000;

  const centerSquare = indexOf(4, side === SIDES.RED ? BOARD_RANKS - 2 : 1);
  const centerPiece = position.board[centerSquare];
  if (!centerPiece || centerPiece.side !== side) return 0;
  if (centerPiece.type === PIECES.KING || centerPiece.type === PIECES.ADVISOR) return 0;

  let penalty = palaceCenterBlockPenalty(centerPiece.type);
  if (lineAligned(centerSquare, kingSquare) && countLineBlockers(position, centerSquare, kingSquare) === 0) {
    penalty += 10;
  }

  return -penalty;
}

function palaceCenterBlockPenalty(type) {
  switch (type) {
    case PIECES.HORSE:
      return 58;
    case PIECES.ROOK:
    case PIECES.CANNON:
      return 36;
    case PIECES.PAWN:
      return 30;
    case PIECES.ELEPHANT:
      return 24;
    default:
      return 20;
  }
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

function linkedHorseValue(position, piece, square) {
  if (piece.type !== PIECES.HORSE) return 0;

  const file = fileOf(square);
  const rank = rankOf(square);
  const controls = horseControls(position, square);
  let score = 0;

  for (const target of controls) {
    if (target <= square) continue;
    const partner = position.board[target];
    if (partner?.side !== piece.side || partner.type !== PIECES.HORSE) continue;
    if (!horseControls(position, target).includes(square)) continue;

    const partnerFile = fileOf(target);
    const partnerRank = rankOf(target);
    const centrality = Math.max(0, 4 - Math.abs(file - 4)) + Math.max(0, 4 - Math.abs(partnerFile - 4));
    const advanced = hasCrossedRiver(piece.side, rank) || hasCrossedRiver(piece.side, partnerRank);

    score += 26;
    score += centrality * 3;
    if (advanced) score += 8;
  }

  return score;
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

function cannonPlatformValue(position, piece, square) {
  if (piece.type !== PIECES.CANNON) return 0;

  let score = 0;
  for (const [fileStep, rankStep] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const platform = cannonPlatformRay(position, square, fileStep, rankStep);
    if (!platform.screen) continue;

    if (!platform.target) {
      if (platform.screen.piece.side === piece.side && platform.emptiesBeforeScreen <= 2) score += 2;
      continue;
    }

    if (platform.target.piece.side === piece.side) {
      score -= platform.emptiesAfterScreen <= 1 ? 5 : 2;
      continue;
    }

    score += platform.screen.piece.side === piece.side ? 8 : 5;
    score += cannonTargetPressure(platform.target.piece);
    score += Math.max(0, 4 - Math.min(4, platform.emptiesBeforeScreen)) * 2;
    if (platform.emptiesAfterScreen <= 1) score += 6;
    else if (platform.emptiesAfterScreen <= 3) score += 3;

    if (palaceContains(opponent(piece.side), fileOf(platform.target.square), rankOf(platform.target.square))) {
      score += 10;
    }
  }

  return score;
}

function cannonPlatformRay(position, square, fileStep, rankStep) {
  let targetFile = fileOf(square) + fileStep;
  let targetRank = rankOf(square) + rankStep;
  let emptiesBeforeScreen = 0;

  while (isInside(targetFile, targetRank)) {
    const target = indexOf(targetFile, targetRank);
    const piece = position.board[target];
    if (piece) {
      const platformTarget = cannonPlatformTarget(position, targetFile + fileStep, targetRank + rankStep, fileStep, rankStep);
      return {
        screen: { square: target, piece },
        target: platformTarget,
        emptiesBeforeScreen,
        emptiesAfterScreen: platformTarget?.emptiesBeforeTarget ?? 0
      };
    }
    emptiesBeforeScreen += 1;
    targetFile += fileStep;
    targetRank += rankStep;
  }

  return {
    screen: null,
    target: null,
    emptiesBeforeScreen,
    emptiesAfterScreen: 0
  };
}

function cannonPlatformTarget(position, file, rank, fileStep, rankStep) {
  let emptiesBeforeTarget = 0;
  let targetFile = file;
  let targetRank = rank;

  while (isInside(targetFile, targetRank)) {
    const square = indexOf(targetFile, targetRank);
    const piece = position.board[square];
    if (piece) return { square, piece, emptiesBeforeTarget };
    emptiesBeforeTarget += 1;
    targetFile += fileStep;
    targetRank += rankStep;
  }

  return null;
}

function cannonTargetPressure(piece) {
  if (piece.type === PIECES.KING) return 90;
  return Math.min(54, Math.round((PIECE_VALUES[piece.type] ?? 0) * 0.055));
}

function pinPressureValue(position, piece, square) {
  if (piece.type !== PIECES.ROOK && piece.type !== PIECES.CANNON) return 0;

  const enemy = opponent(piece.side);
  const enemyKingSquare = position.board.findIndex(
    (candidate) => candidate?.side === enemy && candidate.type === PIECES.KING
  );
  if (enemyKingSquare === -1 || !lineAligned(square, enemyKingSquare)) return 0;

  const blockers = linePiecesBetween(position, square, enemyKingSquare);
  if (piece.type === PIECES.ROOK) {
    if (blockers.length !== 1) return 0;
    const [target] = blockers;
    return pinnedTargetValue(target, enemy);
  }

  if (blockers.length !== 2) return 0;
  const [screen, target] = blockers;
  const screenBonus = screen.piece.side === piece.side ? 14 : 6;
  return pinnedTargetValue(target, enemy) + screenBonus;
}

function pinnedTargetValue(target, enemy) {
  if (target.piece.side !== enemy || target.piece.type === PIECES.KING) return 0;

  const file = fileOf(target.square);
  const rank = rankOf(target.square);
  const value = PIECE_VALUES[target.piece.type] ?? 0;
  let score = Math.min(86, Math.round(value * 0.09));

  if (palaceContains(enemy, file, rank)) score += 18;
  if (file === 4) score += 10;
  if (target.piece.type === PIECES.ADVISOR || target.piece.type === PIECES.ELEPHANT) score += 12;

  return score;
}

function batteryPressureValue(position, side) {
  const enemy = opponent(side);
  const enemyKingSquare = position.board.findIndex((piece) => piece?.side === enemy && piece.type === PIECES.KING);
  if (enemyKingSquare === -1) return 0;

  let score = 0;
  for (const ray of raysFromSquare(position, enemyKingSquare)) {
    const ownLinePieces = ray
      .map((entry, index) => ({ ...entry, index }))
      .filter((entry) => entry.piece.side === side && isLineAttacker(entry.piece));
    if (ownLinePieces.length < 2) continue;

    const [lead, support] = ownLinePieces;
    const blockersBeforeLead = lead.index;
    if (blockersBeforeLead > 2) continue;

    score += 30;
    score += Math.max(0, 2 - blockersBeforeLead) * 16;
    score += lineBatteryPieceBonus(lead.piece) + lineBatteryPieceBonus(support.piece);
    if (fileOf(lead.square) === fileOf(enemyKingSquare)) score += 10;
    if (ownLinePieces.length > 2) score += 16;

    const pinnedGuards = ray
      .slice(0, lead.index)
      .filter((entry) => entry.piece.side === enemy && (entry.piece.type === PIECES.ADVISOR || entry.piece.type === PIECES.ELEPHANT))
      .length;
    score += pinnedGuards * 10;
  }

  return score;
}

function raysFromSquare(position, square) {
  const rays = [];
  const file = fileOf(square);
  const rank = rankOf(square);

  for (const [fileStep, rankStep] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const ray = [];
    let targetFile = file + fileStep;
    let targetRank = rank + rankStep;

    while (isInside(targetFile, targetRank)) {
      const target = indexOf(targetFile, targetRank);
      const piece = position.board[target];
      if (piece) ray.push({ square: target, piece });
      targetFile += fileStep;
      targetRank += rankStep;
    }

    rays.push(ray);
  }

  return rays;
}

function isLineAttacker(piece) {
  return piece.type === PIECES.ROOK || piece.type === PIECES.CANNON;
}

function lineBatteryPieceBonus(piece) {
  return piece.type === PIECES.ROOK ? 18 : 14;
}

function riverControlValue(position, piece, square) {
  if (piece.type !== PIECES.ROOK && piece.type !== PIECES.CANNON) return 0;

  const rank = rankOf(square);
  if (!riverRanks(piece.side).includes(rank)) return 0;

  const file = fileOf(square);
  const left = rookRayActivity(position, file, rank, -1, 0);
  const right = rookRayActivity(position, file, rank, 1, 0);
  const forward = rookRayActivity(position, file, rank, 0, forwardDelta(piece.side));
  const horizontalReach = left.empty + right.empty;
  let score = piece.type === PIECES.ROOK ? 14 : 10;

  score += Math.min(14, horizontalReach * 2);
  score += Math.max(0, 4 - Math.abs(file - 4)) * 3;
  if (rank === enemyRiverBank(piece.side)) score += 6;

  if (!forward.blocker) {
    score += 7;
  } else if (forward.blocker.side !== piece.side) {
    score += Math.min(10, Math.round((PIECE_VALUES[forward.blocker.type] ?? 0) * 0.014));
  } else {
    score -= 5;
  }

  if (horizontalReach <= 2) score -= 10;
  return score;
}

function riverRanks(side) {
  return side === SIDES.RED ? [5, 4] : [4, 5];
}

function enemyRiverBank(side) {
  return side === SIDES.RED ? 4 : 5;
}

function rookActivityValue(position, piece, square) {
  if (piece.type !== PIECES.ROOK) return 0;

  const file = fileOf(square);
  const rank = rankOf(square);
  const forward = forwardDelta(piece.side);
  const forwardRay = rookRayActivity(position, file, rank, 0, forward);
  const backRay = rookRayActivity(position, file, rank, 0, -forward);
  const leftRay = rookRayActivity(position, file, rank, -1, 0);
  const rightRay = rookRayActivity(position, file, rank, 1, 0);
  const quietReach = forwardRay.empty + backRay.empty + leftRay.empty + rightRay.empty;
  let score = 0;

  score += Math.min(36, quietReach * 3);
  score += Math.min(24, forwardRay.empty * 5);

  if (!forwardRay.blocker) {
    score += 16;
  } else if (forwardRay.blocker.side !== piece.side) {
    score += Math.min(22, Math.round((PIECE_VALUES[forwardRay.blocker.type] ?? 0) * 0.03));
  } else {
    score -= 10;
  }

  if (hasCrossedRiver(piece.side, rank)) score += 10;
  if (quietReach <= 3) score -= 30;
  else if (quietReach <= 5) score -= 12;

  const homeRank = piece.side === SIDES.RED ? BOARD_RANKS - 1 : 0;
  if (rank === homeRank && forwardRay.empty <= 1) score -= 10;

  return score;
}

function rookRayActivity(position, file, rank, fileStep, rankStep) {
  let targetFile = file + fileStep;
  let targetRank = rank + rankStep;
  let empty = 0;

  while (isInside(targetFile, targetRank)) {
    const occupant = position.board[indexOf(targetFile, targetRank)];
    if (occupant) {
      return { empty, blocker: occupant };
    }
    empty += 1;
    targetFile += fileStep;
    targetRank += rankStep;
  }

  return { empty, blocker: null };
}

function horsePressureValue(position, piece, square) {
  if (piece.type !== PIECES.HORSE) return 0;

  const enemy = opponent(piece.side);
  const enemyKingSquare = position.board.findIndex((candidate) => candidate?.side === enemy && candidate.type === PIECES.KING);
  if (enemyKingSquare === -1) return 0;

  const file = fileOf(square);
  const rank = rankOf(square);
  const kingFile = fileOf(enemyKingSquare);
  const kingRank = rankOf(enemyKingSquare);
  const controls = horseControls(position, square);
  const palaceControls = controls.filter((target) => palaceContains(enemy, fileOf(target), rankOf(target)));
  const escapeControls = new Set(kingEscapeSquares(position, enemy, enemyKingSquare));
  let score = 0;

  score += palaceControls.length * 16;
  score += controls.filter((target) => escapeControls.has(target)).length * 14;

  if (controls.includes(enemyKingSquare)) score += 62;
  if (hasCrossedRiver(piece.side, rank)) score += 10;

  const kingDistance = Math.abs(file - kingFile) + Math.abs(rank - kingRank);
  if (kingDistance <= 5) score += Math.max(0, 34 - kingDistance * 5);
  if (isHorsePalaceOutpost(enemy, file, rank)) score += 28;

  return score;
}

function isHorsePalaceOutpost(defendingSide, file, rank) {
  const targetRank = defendingSide === SIDES.RED ? BOARD_RANKS - 3 : 2;
  if (rank !== targetRank) return false;
  return Math.abs(file - 4) === 1 || Math.abs(file - 4) === 2;
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

function linePiecesBetween(position, from, to) {
  const fromFile = fileOf(from);
  const fromRank = rankOf(from);
  const toFile = fileOf(to);
  const toRank = rankOf(to);
  const fileStep = Math.sign(toFile - fromFile);
  const rankStep = Math.sign(toRank - fromRank);
  const pieces = [];
  let file = fromFile + fileStep;
  let rank = fromRank + rankStep;

  while (file !== toFile || rank !== toRank) {
    const square = indexOf(file, rank);
    const piece = position.board[square];
    if (piece) pieces.push({ square, piece });
    file += fileStep;
    rank += rankStep;
  }

  return pieces;
}

function lineAligned(first, second) {
  return fileOf(first) === fileOf(second) || rankOf(first) === rankOf(second);
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
    pawnStructure: "pawn progress, support, and palace invasion",
    passedSoldier: "passed soldier pressure",
    kingSafety: "king safety",
    palaceShape: "palace shape and congestion",
    kingAttack: "pressure on the general",
    pieceSafety: "piece safety",
    coordination: "piece coordination",
    linkedHorse: "linked horse coordination",
    linePressure: "rook and cannon line pressure",
    cannonPlatform: "cannon platform pressure",
    pinPressure: "palace pin pressure",
    batteryPressure: "rook-cannon battery pressure",
    rookActivity: "rook activity",
    riverControl: "river-rank control",
    horsePressure: "horse outpost pressure"
  };

  return labels[term] ?? term;
}

export function describeCapture(move) {
  if (!move.captured) return null;
  return `wins a ${PIECE_NAMES[move.captured.type]} with the ${PIECE_NAMES[move.piece.type]}`;
}
