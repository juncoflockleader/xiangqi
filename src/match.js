import { createInitialPosition, makeMove, toFen } from "./board.js";
import { generateLegalMoves } from "./movegen.js";
import { runSparringMatch } from "./sparring.js";

const DEFAULT_MAX_PLIES = 200;
const ELO_CLAMP = 800;

/**
 * Play a multi-game match between two engine backends and measure relative
 * strength as an Elo difference with a 95% confidence margin.
 *
 * This is the project's strength signal: per-position agreement with an oracle
 * (compareEngineToOracle) does NOT measure playing strength; head-to-head game
 * results do.
 *
 * @param {object} engineA backend (or {id,name,engine,searchOptions}) playing as "A".
 * @param {object} engineB backend (or {id,name,engine,searchOptions}) playing as "B".
 * @param {object} [options]
 *   - games: number of games to play (default 10). Colors alternate each game.
 *   - openings: array of opening FEN strings; cycled across games. If omitted,
 *     a seeded opening suite is generated so a deterministic engine does not
 *     replay one identical game.
 *   - openingCount / openingPlies / seed: passed to generateOpeningSuite when no
 *     openings are supplied.
 *   - maxPlies: adjudicate unfinished games as draws after this many plies.
 *   - searchOptions: applied to BOTH engines (e.g. { depth, movetime, time }).
 *   - sprt: { elo0, elo1, alpha, beta } to enable SPRT early-stopping. The match
 *     stops as soon as the test accepts H0 (A not stronger than elo0) or H1
 *     (A stronger than elo1). `games` then acts as a maximum.
 *   - onGame(result, index, partialStats): optional progress callback.
 */
export async function runEngineMatch(engineA, engineB, options = {}) {
  const a = normalizeCompetitor(engineA, "A");
  const b = normalizeCompetitor(engineB, "B");
  const games = normalizePositiveInt(options.games, 10, "games");
  const maxPlies = normalizePositiveInt(options.maxPlies, DEFAULT_MAX_PLIES, "maxPlies");
  const openings = resolveOpenings(options, games);
  const sharedSearch = options.searchOptions ?? {};
  const sprtConfig = normalizeSprtConfig(options.sprt);
  const materialThreshold = options.adjudicateMaterialCp ?? 300;

  const startedAt = performanceNow();
  const results = [];
  const positions = options.collectPositions ? [] : null;
  let sprtVerdict = null;

  for (let index = 0; index < games; index += 1) {
    const aIsRed = index % 2 === 0;
    const initialFen = openings[index % openings.length];

    await resetCompetitor(a);
    await resetCompetitor(b);

    const red = aIsRed ? a : b;
    const black = aIsRed ? b : a;

    const report = await runSparringMatch(
      {
        red: competitorPlayer(red, sharedSearch),
        black: competitorPlayer(black, sharedSearch)
      },
      { initialFen, maxPlies, review: false }
    );

    const result = summarizeGameResult(report, { aIsRed, index, initialFen, materialThreshold });
    results.push(result);

    if (positions) {
      // Label every position in the game by its eventual result, from RED's
      // perspective — the standard Texel-tuning labeling.
      const redResult = result.aIsRed ? result.scoreA : 1 - result.scoreA;
      for (const move of report.moves) {
        if (move.positionAfter) positions.push({ fen: move.positionAfter, result: redResult, ply: move.ply });
      }
    }

    const partial = sprtConfig ? computeSprt(tallyResults(results), sprtConfig) : null;
    options.onGame?.(result, index, partial);

    if (partial && partial.verdict !== "continue") {
      sprtVerdict = partial;
      break;
    }
  }

  const elapsedMs = Math.round(performanceNow() - startedAt);
  const report = buildMatchReport({
    a, b, results, elapsedMs, openings, games, maxPlies, sharedSearch, sprtConfig, sprtVerdict
  });
  if (positions) report.positions = positions;
  return report;
}

/**
 * Sequential Probability Ratio Test for A-vs-B game results, using the normal
 * approximation to the log-likelihood ratio of the per-game score. Tests
 * H0: elo(A−B) = elo0 against H1: elo(A−B) = elo1.
 *
 * Returns { llr, lower, upper, verdict } where verdict is "accept-h1"
 * (A is stronger than elo1), "accept-h0" (A is no better than elo0), or
 * "continue" (inconclusive — keep playing).
 */
export function computeSprt({ winsA = 0, winsB = 0, draws = 0 }, config = {}) {
  const { elo0 = 0, elo1 = 10, alpha = 0.05, beta = 0.05, minGames = 8 } = config;
  const lower = Math.log(beta / (1 - alpha));
  const upper = Math.log((1 - beta) / alpha);
  const n = winsA + winsB + draws;
  if (n === 0) {
    return { llr: 0, lower: round3(lower), upper: round3(upper), verdict: "continue", games: 0 };
  }

  const mu0 = expectedScore(elo0);
  const mu1 = expectedScore(elo1);
  const total = winsA + draws * 0.5;
  const mean = total / n;
  // Sample variance of the per-game score, floored at a small epsilon. The
  // degenerate all-identical case (variance → 0, LLR → ∞) is handled by the
  // minGames guard below, not by inflating the variance (which would slow the
  // test to a crawl).
  const variance = Math.max(
    (winsA * (1 - mean) ** 2 + draws * (0.5 - mean) ** 2 + winsB * (0 - mean) ** 2) / n,
    1e-3
  );
  // Normal-approximation LLR for a mean with known (estimated) variance.
  const llr = ((mu1 - mu0) / variance) * (total - n * (mu0 + mu1) / 2);

  let verdict = "continue";
  // Require a minimum sample before concluding — protects against tiny-n noise.
  if (n >= minGames) {
    if (llr >= upper) verdict = "accept-h1";
    else if (llr <= lower) verdict = "accept-h0";
  }

  return {
    llr: round3(llr),
    lower: round3(lower),
    upper: round3(upper),
    verdict,
    games: n,
    elo0,
    elo1
  };
}

/**
 * Generate a diverse, legal set of opening positions by playing a few random
 * plies from the start with a seeded PRNG. Deterministic for a given seed, so
 * runs are reproducible. Dedupes identical FENs.
 */
export function generateOpeningSuite(options = {}) {
  const count = normalizePositiveInt(options.count, 12, "count");
  const plies = normalizePositiveInt(options.plies, 4, "plies");
  const includeStart = options.includeStart ?? true;
  const rng = makeRng(options.seed ?? 0x9e3779b9);
  const initial = options.initialPosition ?? createInitialPosition();

  const seen = new Set();
  const fens = [];

  if (includeStart) {
    const startFen = toFen(initial);
    seen.add(startFen);
    fens.push(startFen);
  }

  const maxAttempts = count * 60;
  for (let attempt = 0; attempt < maxAttempts && fens.length < count; attempt += 1) {
    let position = initial;
    let aborted = false;
    for (let ply = 0; ply < plies; ply += 1) {
      const moves = generateLegalMoves(position, position.turn);
      if (moves.length === 0) {
        aborted = true;
        break;
      }
      position = makeMove(position, moves[Math.floor(rng() * moves.length)]);
    }
    if (aborted) continue;
    const fen = toFen(position);
    if (seen.has(fen)) continue;
    seen.add(fen);
    fens.push(fen);
  }

  return fens;
}

/**
 * Turn raw win/loss/draw counts into an Elo difference (A relative to B) with a
 * 95% confidence margin and likelihood-of-superiority. Pure; unit-testable.
 */
export function computeMatchStatistics({ winsA = 0, winsB = 0, draws = 0 }) {
  const total = winsA + winsB + draws;
  if (total === 0) {
    return { games: 0, winsA, winsB, draws, scoreA: 0, eloDiff: 0, eloMargin: 0, los: 0.5 };
  }

  const scoreA = (winsA + draws * 0.5) / total;
  const eloDiff = eloFromScore(scoreA);

  // Standard error of the per-game score, then propagate to Elo via dElo/dp.
  const variance = (winsA * (1 - scoreA) ** 2 + winsB * (0 - scoreA) ** 2 + draws * (0.5 - scoreA) ** 2) / total;
  const stderr = Math.sqrt(variance / total);
  const p = clamp(scoreA, 1e-6, 1 - 1e-6);
  const dEloDp = 400 / (Math.LN10 * p * (1 - p));
  const eloMargin = Number.isFinite(eloDiff) ? round1(1.96 * stderr * dEloDp) : 0;

  return {
    games: total,
    winsA,
    winsB,
    draws,
    scoreA: round3(scoreA),
    eloDiff: clampElo(round1(eloDiff)),
    eloMargin,
    los: round3(likelihoodOfSuperiority(winsA, winsB))
  };
}

export function formatMatchReport(report) {
  const { a, b, stats } = report;
  const sign = stats.eloDiff >= 0 ? "+" : "";
  const lines = [
    `Match: ${a.name} (A) vs ${b.name} (B) — ${report.games} games, ${report.elapsedMs}ms`,
    `Score: A ${report.tally.winsA}  B ${report.tally.winsB}  draws ${report.tally.draws}` +
      (report.tally.adjudicated ? `  (material-adj ${report.tally.adjudicated})` : "") +
      (report.tally.unfinished ? `  (unfinished→draw ${report.tally.unfinished})` : "") +
      (report.tally.forfeits ? `  forfeits ${report.tally.forfeits}` : ""),
    `Elo(A−B): ${sign}${stats.eloDiff} ± ${stats.eloMargin}   scoreA ${stats.scoreA}   LOS ${(stats.los * 100).toFixed(1)}%`
  ];

  if (report.searchOptions && Object.keys(report.searchOptions).length > 0) {
    lines.push(`Search (both): ${formatSearchOptions(report.searchOptions)}`);
  }

  if (report.sprt) {
    const s = report.sprt;
    const verdictText = s.verdict === "accept-h1"
      ? `H1 accepted: A is stronger than ${s.elo1} Elo`
      : s.verdict === "accept-h0"
        ? `H0 accepted: A is not stronger than ${s.elo0} Elo`
        : "inconclusive (hit game cap)";
    lines.push(
      `SPRT[${s.elo0},${s.elo1}]: LLR ${s.llr} (bounds ${s.lower}..${s.upper}) — ${verdictText}` +
        (report.stoppedEarly ? ` — stopped at game ${report.gamesPlayed}` : "")
    );
  }

  for (const game of report.games_) {
    const tag = game.adjudication ? ` [${game.adjudication}]` : "";
    lines.push(
      `  G${game.index + 1}: ${game.redName} (R) vs ${game.blackName} (B) → ${game.outcomeText}` +
        ` in ${game.plies} plies${tag}`
    );
  }

  return lines.join("\n");
}

// --- internals ---------------------------------------------------------------

function summarizeGameResult(report, { aIsRed, index, initialFen, materialThreshold }) {
  const status = report.status ?? {};
  const stopReason = report.stopReason ?? null;
  const aSide = aIsRed ? "red" : "black";

  let scoreA = 0.5;
  let outcome = "draw";
  let adjudication = null;
  let forfeit = false;

  if (status.winner) {
    scoreA = status.winner === aSide ? 1 : 0;
    outcome = status.winner === aSide ? "A wins" : "B wins";
  } else if (stopReason === "no-move") {
    // Side to move produced no legal/usable move: forfeit loss for that side.
    const toMove = report.game?.position?.turn ?? null;
    forfeit = true;
    adjudication = "forfeit";
    if (toMove) {
      scoreA = toMove === aSide ? 0 : 1;
      outcome = toMove === aSide ? "B wins" : "A wins";
    }
  } else if (status.state === "playing" || stopReason === "max-plies") {
    // Unfinished: adjudicate by material so a decisive but unconcluded game
    // isn't silently scored as a draw (which would dilute the Elo signal).
    const balance = materialBalanceFromFen(report.finalFen); // red − black, centipawns
    if (balance >= materialThreshold) {
      scoreA = aSide === "red" ? 1 : 0;
      outcome = aSide === "red" ? "A wins" : "B wins";
      adjudication = "material";
    } else if (balance <= -materialThreshold) {
      scoreA = aSide === "red" ? 0 : 1;
      outcome = aSide === "red" ? "B wins" : "A wins";
      adjudication = "material";
    } else {
      scoreA = 0.5;
      outcome = "draw";
      adjudication = "unfinished";
    }
  } else {
    // repetition / stalemate-as-draw and other explicit draws
    outcome = "draw";
    scoreA = 0.5;
  }

  return {
    index,
    initialFen,
    aIsRed,
    redName: report.players.red.name,
    blackName: report.players.black.name,
    state: status.state ?? null,
    stopReason,
    plies: report.totalPlies ?? 0,
    scoreA,
    outcome,
    outcomeText: outcome,
    adjudication,
    forfeit
  };
}

function buildMatchReport({
  a, b, results, elapsedMs, openings, games, maxPlies, sharedSearch, sprtConfig, sprtVerdict
}) {
  const tally = tallyResults(results);
  const stats = computeMatchStatistics(tally);
  const sprt = sprtConfig
    ? (sprtVerdict ?? computeSprt(tally, sprtConfig))
    : null;

  return {
    a: { id: a.id, name: a.name },
    b: { id: b.id, name: b.name },
    gamesRequested: games,
    gamesPlayed: results.length,
    games: results.length,
    maxPlies,
    elapsedMs,
    openings: [...openings],
    searchOptions: { ...sharedSearch },
    tally,
    stats,
    sprt,
    stoppedEarly: Boolean(sprtVerdict),
    games_: results
  };
}

function tallyResults(results) {
  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let unfinished = 0;
  let adjudicated = 0;
  let forfeits = 0;

  for (const result of results) {
    if (result.scoreA === 1) winsA += 1;
    else if (result.scoreA === 0) winsB += 1;
    else draws += 1;
    if (result.adjudication === "unfinished") unfinished += 1;
    if (result.adjudication === "material") adjudicated += 1;
    if (result.forfeit) forfeits += 1;
  }

  return { winsA, winsB, draws, unfinished, adjudicated, forfeits };
}

function normalizeSprtConfig(sprt) {
  if (!sprt) return null;
  return {
    elo0: sprt.elo0 ?? 0,
    elo1: sprt.elo1 ?? 10,
    alpha: sprt.alpha ?? 0.05,
    beta: sprt.beta ?? 0.05,
    minGames: sprt.minGames ?? 8
  };
}

function expectedScore(elo) {
  return 1 / (1 + Math.pow(10, -elo / 400));
}

// Centipawn material balance (red − black) from a FEN's placement field. Used to
// adjudicate unfinished games. Letters: r rook, c cannon, h horse, a advisor,
// e elephant, p pawn (kings ignored). Uppercase = red, lowercase = black.
const MATERIAL_VALUES = { r: 900, c: 470, h: 430, e: 120, a: 120, p: 90, k: 0 };

function materialBalanceFromFen(fen) {
  if (typeof fen !== "string") return 0;
  const placement = fen.split(/\s+/)[0] ?? "";
  let balance = 0;
  for (const char of placement) {
    const value = MATERIAL_VALUES[char.toLowerCase()];
    if (value === undefined) continue;
    balance += char === char.toUpperCase() ? value : -value;
  }
  return balance;
}

function resolveOpenings(options, games) {
  if (Array.isArray(options.openings) && options.openings.length > 0) {
    return options.openings;
  }
  const count = options.openingCount ?? Math.max(games, 6);
  return generateOpeningSuite({
    count,
    plies: options.openingPlies ?? 4,
    seed: options.seed,
    includeStart: options.includeStart ?? true
  });
}

function normalizeCompetitor(entry, fallbackId) {
  const engine = entry?.engine ?? entry?.backend ?? entry;
  if (!engine || typeof engine.chooseMove !== "function" || typeof engine.play !== "function") {
    throw new Error(`Match competitor ${fallbackId} must be an engine backend with chooseMove and play.`);
  }
  return {
    id: entry?.id ?? engine.id ?? fallbackId,
    name: entry?.name ?? engine.name ?? fallbackId,
    engine,
    searchOptions: entry?.searchOptions ?? {}
  };
}

function competitorPlayer(competitor, sharedSearch) {
  return {
    id: competitor.id,
    name: competitor.name,
    engine: competitor.engine,
    searchOptions: { ...sharedSearch, ...competitor.searchOptions }
  };
}

async function resetCompetitor(competitor) {
  try {
    if (typeof competitor.engine.newGame === "function") {
      await competitor.engine.newGame();
    } else if (typeof competitor.engine.resetCache === "function") {
      competitor.engine.resetCache();
    }
  } catch {
    // Resetting is best-effort; a failure here shouldn't abort the match.
  }
}

function eloFromScore(score) {
  if (score <= 0) return -Infinity;
  if (score >= 1) return Infinity;
  return -400 * Math.log10(1 / score - 1);
}

function clampElo(value) {
  if (value === Infinity) return ELO_CLAMP;
  if (value === -Infinity) return -ELO_CLAMP;
  return value === 0 ? 0 : value; // normalize -0 → 0
}

function likelihoodOfSuperiority(winsA, winsB) {
  const decisive = winsA + winsB;
  if (decisive === 0) return 0.5;
  return 0.5 * (1 + erf((winsA - winsB) / Math.sqrt(2 * decisive)));
}

// Abramowitz & Stegun 7.1.26 approximation.
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}

function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizePositiveInt(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function formatSearchOptions(options) {
  return Object.entries(options)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function performanceNow() {
  if (globalThis.performance?.now) return globalThis.performance.now();
  return Date.now();
}
