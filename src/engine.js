import { applyLegalMove, annotateMove, generateLegalMoves, legalMovesWithNotation } from "./movegen.js";
import { makeMove, moveToNotation, parseMoveNotation, sameMove } from "./board.js";
import { bookMoveToCandidate, lookupOpeningBook } from "./book.js";
import { evaluatePosition } from "./evaluate.js";
import { analyzePressure } from "./pressure.js";
import { explainBookMove, explainCandidateMove, explainMove, explainReviewedMove } from "./reasoning.js";
import { analyzeReviewMistakes } from "./mistakes.js";
import { reviewGameWithEngine } from "./review.js";
import { coachMoveWithEngine } from "./coach.js";
import { createLessonPlanWithEngine } from "./lesson.js";
import { resolveEngineOptions } from "./profiles.js";
import { searchBestMove } from "./search.js";
import { createTranspositionTable } from "./transposition.js";

export function createEngine(defaultOptions = {}) {
  const engineOptions = resolveEngineOptions(defaultOptions);
  const transpositionTable = createTranspositionTable({
    maxEntries: engineOptions.maxTranspositionEntries ?? engineOptions.ttSize,
    replacementSample: engineOptions.transpositionReplacementSample
  });

  return {
    chooseMove(position, options = {}) {
      const mergedOptions = { ...engineOptions, ...options };
      const bookResult = maybeBookResult(position, mergedOptions, transpositionTable.size);
      if (bookResult) return bookResult;

      const search = searchBestMove(position, {
        ...mergedOptions,
        transpositionTable
      });

      return {
        ...search,
        explanation: explainMove(position, search)
      };
    },

    openingBook(position, options = {}) {
      return lookupOpeningBook(position, {
        ...engineOptions,
        ...options
      });
    },

    analyzePosition(position, options = {}) {
      const lineCount = normalizeLineCount(options.lines ?? options.multiPv ?? options.multipv ?? 5);
      const search = searchBestMove(position, {
        ...engineOptions,
        ...options,
        candidateLimit: lineCount,
        transpositionTable
      });
      const bestScore = search.score;
      const lines = search.candidates.slice(0, lineCount).map((candidate, index) => ({
        rank: index + 1,
        move: candidate.move,
        score: Math.round(candidate.score),
        centipawnLoss: Math.max(0, Math.round(bestScore - candidate.score)),
        repetition: candidate.repetition ?? null,
        principalVariation: candidate.principalVariation.map((pvMove) => pvMove.notation ?? moveToNotation(pvMove)),
        explanation: explainCandidateMove(position, candidate, {
          rank: index + 1,
          bestScore,
          depth: search.depth
        })
      }));

      return {
        ...search,
        lines,
        explanation: explainMove(position, search)
      };
    },

    reviewMove(position, moveOrNotation, options = {}) {
      const move = resolveLegalMove(position, moveOrNotation);
      const search = searchBestMove(position, {
        ...engineOptions,
        ...options,
        candidateLimit: Number.POSITIVE_INFINITY,
        priorityMoves: [move],
        transpositionTable
      });
      const candidate = search.candidates.find((entry) => sameMove(entry.move, move))
        ?? fallbackReviewedCandidate(position, move);

      const bestMove = search.bestMove;
      const isBestMove = sameMove(move, bestMove);
      const centipawnLoss = Math.max(0, search.score - candidate.score);
      const bestExplanation = explainMove(position, search);
      const reviewed = {
        move: annotateMove(position, move),
        bestMove,
        bestScore: Math.round(search.score),
        playedScore: Math.round(candidate.score),
        centipawnLoss: Math.round(centipawnLoss),
        classification: isBestMove ? "best" : classifyMoveLoss(Math.max(16, centipawnLoss)),
        isBestMove,
        principalVariation: candidate.principalVariation.map((pvMove) => pvMove.notation ?? moveToNotation(pvMove)),
        bestAnalysis: {
          ...search,
          explanation: bestExplanation
        },
        bestExplanation,
        depth: search.depth,
        nodes: search.nodes
      };
      reviewed.mistakes = analyzeReviewMistakes(position, reviewed);

      return {
        ...reviewed,
        explanation: explainReviewedMove(position, reviewed)
      };
    },

    reviewGame(moves, options = {}) {
      return reviewGameWithEngine(this, moves, {
        ...options,
        reviewOptions: {
          ...engineOptions,
          ...(options.reviewOptions ?? {})
        }
      });
    },

    coachMove(position, options = {}) {
      return coachMoveWithEngine(this, position, {
        ...engineOptions,
        ...options
      });
    },

    lessonPlan(moves, options = {}) {
      return createLessonPlanWithEngine(this, moves, {
        ...options,
        reviewOptions: {
          ...engineOptions,
          ...(options.reviewOptions ?? {})
        }
      });
    },

    evaluate(position, options = {}) {
      return evaluatePosition(position, options.perspective ?? position.turn, {
        detailed: options.detailed ?? true
      });
    },

    pressure(position, options = {}) {
      return analyzePressure(position, options);
    },

    legalMoves(position) {
      return legalMovesWithNotation(position);
    },

    play(position, notation) {
      return applyLegalMove(position, parseMoveNotation(notation), position.turn);
    },

    resetCache() {
      transpositionTable.clear();
    },

    get cacheSize() {
      return transpositionTable.size;
    },

    get cacheCapacity() {
      return transpositionTable.maxEntries;
    }
  };
}

export function chooseMove(position, options = {}) {
  return createEngine(options).chooseMove(position, options);
}

export function analyzePosition(position, options = {}) {
  return createEngine(options).analyzePosition(position, options);
}

export function hasLegalMoves(position) {
  return generateLegalMoves(position, position.turn).length > 0;
}

export function classifyMoveLoss(centipawnLoss) {
  if (centipawnLoss <= 15) return "best";
  if (centipawnLoss <= 40) return "excellent";
  if (centipawnLoss <= 90) return "good";
  if (centipawnLoss <= 160) return "inaccuracy";
  if (centipawnLoss <= 320) return "mistake";
  return "blunder";
}

function resolveLegalMove(position, moveOrNotation) {
  const rawMove = typeof moveOrNotation === "string" ? parseMoveNotation(moveOrNotation) : moveOrNotation;
  const move = generateLegalMoves(position, position.turn).find((candidate) => sameMove(candidate, rawMove));

  if (!move) {
    throw new Error(`Illegal move: ${moveToNotation(rawMove)}`);
  }

  return move;
}

function fallbackReviewedCandidate(position, move) {
  const annotated = annotateMove(position, move);
  const after = makeMove(position, move);
  return {
    move: annotated,
    score: evaluatePosition(after, position.turn, { detailed: false }).score,
    principalVariation: [annotated],
    fallback: "static-evaluation"
  };
}

function normalizeLineCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(1, Math.min(12, parsed));
}

function maybeBookResult(position, options, tableSize) {
  if (options.useBook === false) return null;

  const bookHit = lookupOpeningBook(position, options);
  if (!bookHit) return null;

  const candidates = bookHit.entries.map(bookMoveToCandidate);
  const result = {
    source: bookHit.source ?? "opening-book",
    bestMove: bookHit.move,
    score: bookHit.entry.weight,
    depth: 0,
    nodes: 0,
    principalVariation: [bookHit.move],
    candidates,
    iterations: [],
    timedOut: false,
    tableSize,
    stats: {
      nodes: 0,
      qnodes: 0,
      qchecks: 0,
      ttHits: 0,
      ttStores: 0,
      ttReplacements: 0,
      ttEvictions: 0,
      ttSkips: 0,
      cutoffs: 0,
      aspirationSearches: 0,
      aspirationFailHigh: 0,
      aspirationFailLow: 0,
      extensions: 0,
      futilityPrunes: 0,
      deltaPrunes: 0,
      reductions: 0,
      lmrResearches: 0,
      pvsResearches: 0,
      nullMovePrunes: 0,
      countermoveStores: 0,
      countermoveHits: 0,
      rootScoreOrderHits: 0,
      repetitions: 0
    },
    book: {
      name: bookHit.entry.name,
      idea: bookHit.entry.idea,
      tags: bookHit.entry.tags,
      weight: bookHit.entry.weight,
      database: bookHit.entry.database
    },
    bookAlternatives: bookHit.entries
  };

  return {
    ...result,
    explanation: explainBookMove(position, result)
  };
}
