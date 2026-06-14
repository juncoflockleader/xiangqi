import {
  createInitialPosition,
  moveToNotation,
  parseMoveNotation,
  positionKey,
  sameMove,
  toFen
} from "./board.js";
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
  const repetitionCount = game.positionCounts.get(key) ?? 0;

  if (legalMoves.length === 0) {
    return {
      state: isInCheck(game.position, game.position.turn) ? "checkmate" : "stalemate",
      legalMoves: 0,
      repetitionCount,
      inCheck: isInCheck(game.position, game.position.turn)
    };
  }

  if (repetitionCount >= 3) {
    return {
      state: "repetition",
      legalMoves: legalMoves.length,
      repetitionCount,
      inCheck: isInCheck(game.position, game.position.turn)
    };
  }

  return {
    state: "playing",
    legalMoves: legalMoves.length,
    repetitionCount,
    inCheck: isInCheck(game.position, game.position.turn)
  };
}

export function historyKeys(game) {
  return game.positions.map((position) => positionKey(position));
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
        decision: details.decision ? summarizeDecision(details.decision) : null,
        review: details.review
      }
    ],
    positions: [...game.positions, after],
    positionCounts: incrementCount(game.positionCounts, key)
  };
}

function summarizeDecision(decision) {
  return {
    source: decision.source ?? "search",
    bestMove: decision.bestMove ?? null,
    score: Math.round(decision.score ?? 0),
    depth: decision.depth ?? 0,
    nodes: decision.nodes ?? 0,
    principalVariation: (decision.principalVariation ?? [])
      .map((move) => move.notation ?? moveToNotation(move)),
    explanation: decision.explanation ?? null
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
