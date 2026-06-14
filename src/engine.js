import { applyLegalMove, annotateMove, generateLegalMoves, legalMovesWithNotation } from "./movegen.js";
import { moveToNotation, parseMoveNotation, sameMove } from "./board.js";
import { evaluatePosition } from "./evaluate.js";
import { explainCandidateMove, explainMove, explainReviewedMove } from "./reasoning.js";
import { searchBestMove } from "./search.js";

export function createEngine(defaultOptions = {}) {
  const transpositionTable = new Map();

  return {
    chooseMove(position, options = {}) {
      const search = searchBestMove(position, {
        ...defaultOptions,
        ...options,
        transpositionTable
      });

      return {
        ...search,
        explanation: explainMove(position, search)
      };
    },

    analyzePosition(position, options = {}) {
      const lineCount = normalizeLineCount(options.lines ?? options.multiPv ?? options.multipv ?? 5);
      const search = searchBestMove(position, {
        ...defaultOptions,
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
        ...defaultOptions,
        ...options,
        candidateLimit: Number.POSITIVE_INFINITY,
        transpositionTable
      });
      const candidate = search.candidates.find((entry) => sameMove(entry.move, move));

      if (!candidate) {
        throw new Error(`Search did not score legal move ${moveToNotation(move)}.`);
      }

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

      return {
        ...reviewed,
        explanation: explainReviewedMove(position, reviewed)
      };
    },

    evaluate(position, options = {}) {
      return evaluatePosition(position, options.perspective ?? position.turn, {
        detailed: options.detailed ?? true
      });
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

function normalizeLineCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(1, Math.min(12, parsed));
}
