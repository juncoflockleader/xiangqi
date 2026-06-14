import {
  createInitialPosition,
  moveToNotation,
  parseMoveNotation,
  positionKey,
  sameMove
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
  const after = engine.play(before, moveToNotation(legalMove));
  const key = positionKey(after);

  return {
    ...game,
    position: after,
    moves: [
      ...game.moves,
      {
        move: legalMove,
        notation: moveToNotation(legalMove),
        review
      }
    ],
    positions: [...game.positions, after],
    positionCounts: incrementCount(game.positionCounts, key)
  };
}

export function chooseGameMove(game, engine, options = {}) {
  return engine.chooseMove(game.position, {
    ...options,
    history: historyKeys(game)
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
