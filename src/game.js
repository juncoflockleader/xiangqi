import {
  createInitialPosition,
  moveToNotation,
  opponent,
  parseMoveNotation,
  positionKey,
  sameMove,
  toFen
} from "./board.js";
import { describeEngineBackendStatus } from "./backend.js";
import { SIDES } from "./constants.js";
import { generateLegalMoves, isInCheck } from "./movegen.js";

export function createGame(initialPosition = createInitialPosition()) {
  return {
    initialPosition,
    position: initialPosition,
    moves: [],
    positions: [initialPosition],
    positionCounts: new Map([[positionKey(initialPosition), 1]])
  };
}

export function playGameMove(game, engine, moveOrNotation, options = {}) {
  const before = game.position;
  const legalMove = resolveGameMove(before, moveOrNotation);
  const reviewOptions = {
    history: historyKeys(game),
    ...(options.reviewOptions ?? {})
  };
  const review = options.review === false ? null : engine.reviewMove(before, legalMove, reviewOptions);

  return appendGameMove(game, engine, before, legalMove, {
    actor: options.actor ?? "player",
    decision: options.decision ?? null,
    review
  });
}

export async function playGameMoveAsync(game, engine, moveOrNotation, options = {}) {
  const before = game.position;
  const legalMove = resolveGameMove(before, moveOrNotation);
  const reviewOptions = {
    history: historyKeys(game),
    ...(options.reviewOptions ?? {})
  };
  const review = options.review === false ? null : await engine.reviewMove(before, legalMove, reviewOptions);

  return appendGameMove(game, engine, before, legalMove, {
    actor: options.actor ?? "player",
    decision: options.decision ?? null,
    review
  });
}

export function chooseGameMove(game, engine, options = {}) {
  return engine.chooseMove(game.position, {
    ...options,
    history: historyKeys(game)
  });
}

export async function chooseGameMoveAsync(game, engine, options = {}) {
  return engine.chooseMove(game.position, {
    ...options,
    history: historyKeys(game)
  });
}

export function chooseAndPlayGameMove(game, engine, options = {}) {
  const decision = chooseGameMove(game, engine, gameSearchOptions(options));
  if (!decision.bestMove) {
    return {
      ...game,
      lastDecision: summarizeDecision(decision)
    };
  }

  return playGameMove(game, engine, decision.bestMove, {
    actor: options.actor ?? "engine",
    decision,
    review: options.review,
    reviewOptions: options.reviewOptions
  });
}

export async function chooseAndPlayGameMoveAsync(game, engine, options = {}) {
  const decision = await chooseGameMoveAsync(game, engine, gameSearchOptions(options));
  if (!decision.bestMove) {
    return {
      ...game,
      lastDecision: summarizeDecision(decision)
    };
  }

  return playGameMoveAsync(game, engine, decision.bestMove, {
    actor: options.actor ?? "engine",
    decision,
    review: options.review,
    reviewOptions: options.reviewOptions
  });
}

export function gameStatus(game) {
  const legalMoves = generateLegalMoves(game.position, game.position.turn);
  const key = positionKey(game.position);
  const repetitionCount = positionRepetitionCount(game, key);
  const inCheck = isInCheck(game.position, game.position.turn);

  if (legalMoves.length === 0) {
    return {
      state: inCheck ? "checkmate" : "stalemate",
      outcome: "loss",
      winner: opponent(game.position.turn),
      loser: game.position.turn,
      legalMoves: 0,
      repetitionCount,
      inCheck
    };
  }

  if (repetitionCount >= 3) {
    return {
      state: "repetition",
      outcome: "draw",
      winner: null,
      loser: null,
      legalMoves: legalMoves.length,
      repetitionCount,
      inCheck,
      repetition: classifyRepetition(game, key)
    };
  }

  return {
    state: "playing",
    outcome: null,
    winner: null,
    loser: null,
    legalMoves: legalMoves.length,
    repetitionCount,
    inCheck
  };
}

export function historyKeys(game) {
  return game.positions.map((position) => positionKey(position));
}

export function classifyRepetition(game, key = positionKey(game.position)) {
  const positions = Array.isArray(game.positions) ? game.positions : [];
  const moves = Array.isArray(game.moves) ? game.moves : [];
  const currentIndex = findCurrentPositionIndex(positions, key, game.position);
  const previousIndex = findPreviousPositionIndex(positions, key, currentIndex);

  if (currentIndex < 1 || previousIndex < 0) {
    return {
      kind: "unknown",
      adjudication: "draw-assumed",
      reason: "position-history-unavailable",
      cycleLength: null,
      fromPly: null,
      toPly: null,
      checkingSides: [],
      continuousCheckingSides: [],
      possiblePerpetualCheckSide: null,
      moves: []
    };
  }

  const movesBySide = createSideCounts();
  const checksBySide = createSideCounts();
  const cycleMoves = [];

  for (let index = previousIndex; index < currentIndex; index += 1) {
    const before = positions[index];
    const after = positions[index + 1];
    const move = moves[index];
    const side = move?.side ?? before?.turn ?? null;
    const givesCheck = Boolean(after && isInCheck(after, after.turn));

    if (side && Object.prototype.hasOwnProperty.call(movesBySide, side)) {
      movesBySide[side] += 1;
      if (givesCheck) checksBySide[side] += 1;
    }

    cycleMoves.push({
      ply: index + 1,
      side,
      notation: move?.notation ?? null,
      givesCheck
    });
  }

  const sides = [SIDES.RED, SIDES.BLACK];
  const checkingSides = sides.filter((side) => checksBySide[side] > 0);
  const continuousCheckingSides = sides.filter(
    (side) => movesBySide[side] > 0 && checksBySide[side] === movesBySide[side]
  );
  const kind = classifyRepetitionKind(checkingSides, continuousCheckingSides);

  return {
    kind,
    adjudication: "draw-assumed",
    cycleLength: currentIndex - previousIndex,
    fromPly: previousIndex + 1,
    toPly: currentIndex,
    checkingSides,
    continuousCheckingSides,
    possiblePerpetualCheckSide: kind === "perpetual-check-candidate"
      ? continuousCheckingSides[0]
      : null,
    movesBySide,
    checksBySide,
    moves: cycleMoves
  };
}

function appendGameMove(game, engine, before, legalMove, details) {
  const notation = moveToNotation(legalMove);
  const after = engine.play(before, notation);
  const key = positionKey(after);
  const ply = game.moves.length + 1;

  return {
    ...game,
    position: after,
    moves: [
      ...game.moves,
      {
        ply,
        moveNumber: Math.floor((ply - 1) / 2) + 1,
        side: before.turn,
        actor: details.actor,
        move: legalMove,
        notation,
        positionBefore: toFen(before),
        positionAfter: toFen(after),
        decision: details.decision ? summarizeDecision(details.decision, engine) : null,
        review: details.review
      }
    ],
    positions: [...game.positions, after],
    positionCounts: incrementCount(game.positionCounts, key)
  };
}

function summarizeDecision(decision, engine = null) {
  return {
    source: decision.source ?? "search",
    bestMove: decision.bestMove ?? null,
    score: Math.round(decision.score ?? 0),
    depth: decision.depth ?? 0,
    nodes: decision.nodes ?? 0,
    principalVariation: (decision.principalVariation ?? [])
      .map((move) => move.notation ?? moveToNotation(move)),
    explanation: decision.explanation ?? null,
    backendFallback: decision.backendFallback ?? null,
    backendStatus: engine ? describeEngineBackendStatus(engine) : null
  };
}

function gameSearchOptions(options) {
  if (options.searchOptions) return options.searchOptions;

  const {
    actor,
    decision,
    review,
    reviewOptions,
    ...searchOptions
  } = options;
  return searchOptions;
}

function resolveGameMove(position, moveOrNotation) {
  const rawMove = typeof moveOrNotation === "string"
    ? parseMoveNotation(moveOrNotation)
    : moveOrNotation;
  const legalMove = generateLegalMoves(position, position.turn)
    .find((move) => sameMove(move, rawMove));

  if (!legalMove) {
    throw new Error(`Illegal game move: ${moveToNotation(rawMove)}`);
  }

  return legalMove;
}

function incrementCount(counts, key) {
  const next = new Map(counts);
  next.set(key, (next.get(key) ?? 0) + 1);
  return next;
}

function positionRepetitionCount(game, key) {
  if (game.positionCounts?.get) {
    return game.positionCounts.get(key) ?? 0;
  }

  if (Array.isArray(game.positions)) {
    return game.positions.reduce(
      (count, position) => count + (positionKey(position) === key ? 1 : 0),
      0
    );
  }

  return positionKey(game.position) === key ? 1 : 0;
}

function findCurrentPositionIndex(positions, key, currentPosition) {
  for (let index = positions.length - 1; index >= 0; index -= 1) {
    if (positionKey(positions[index]) === key) return index;
  }

  if (currentPosition && positionKey(currentPosition) === key) {
    return positions.length;
  }

  return -1;
}

function findPreviousPositionIndex(positions, key, currentIndex) {
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (positionKey(positions[index]) === key) return index;
  }

  return -1;
}

function createSideCounts() {
  return {
    [SIDES.RED]: 0,
    [SIDES.BLACK]: 0
  };
}

function classifyRepetitionKind(checkingSides, continuousCheckingSides) {
  if (continuousCheckingSides.length > 1) return "mutual-check-cycle";
  if (continuousCheckingSides.length === 1 && checkingSides.length === 1) {
    return "perpetual-check-candidate";
  }
  if (checkingSides.length > 0) return "checking-cycle";
  return "cycle";
}
