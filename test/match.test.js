import test from "node:test";
import assert from "node:assert/strict";
import {
  computeMatchStatistics,
  computeSprt,
  createJavaScriptEngineBackend,
  formatMatchReport,
  generateOpeningSuite,
  parseFen,
  runEngineMatch
} from "../src/index.js";

test("computeMatchStatistics returns 0 Elo for an even score", () => {
  const stats = computeMatchStatistics({ winsA: 5, winsB: 5, draws: 0 });
  assert.equal(stats.games, 10);
  assert.equal(stats.scoreA, 0.5);
  assert.equal(stats.eloDiff, 0);
  assert.equal(stats.los, 0.5);
});

test("computeMatchStatistics gives positive Elo and high LOS when A dominates", () => {
  const stats = computeMatchStatistics({ winsA: 9, winsB: 1, draws: 0 });
  assert.ok(stats.eloDiff > 0, "winner should have positive Elo");
  assert.ok(stats.eloMargin > 0, "should report a confidence margin");
  assert.ok(stats.los > 0.95, `LOS should be high, got ${stats.los}`);
});

test("computeMatchStatistics clamps a perfect score instead of returning Infinity", () => {
  const stats = computeMatchStatistics({ winsA: 10, winsB: 0, draws: 0 });
  assert.ok(Number.isFinite(stats.eloDiff));
  assert.equal(stats.eloDiff, 800);
  assert.equal(stats.scoreA, 1);
});

test("computeMatchStatistics is symmetric for the loser", () => {
  const winner = computeMatchStatistics({ winsA: 7, winsB: 3, draws: 0 });
  const loser = computeMatchStatistics({ winsA: 3, winsB: 7, draws: 0 });
  assert.equal(winner.eloDiff, -loser.eloDiff);
});

test("generateOpeningSuite produces distinct, legal positions deterministically", () => {
  const a = generateOpeningSuite({ count: 8, plies: 4, seed: 42 });
  const b = generateOpeningSuite({ count: 8, plies: 4, seed: 42 });

  assert.equal(a.length, 8);
  assert.deepEqual(a, b, "same seed should reproduce the same suite");
  assert.equal(new Set(a).size, a.length, "openings should be unique");

  // Every generated FEN must parse back into a valid position.
  for (const fen of a) {
    assert.doesNotThrow(() => parseFen(fen), `FEN should be legal: ${fen}`);
  }

  const c = generateOpeningSuite({ count: 8, plies: 4, seed: 7 });
  assert.notDeepEqual(a, c, "different seeds should differ");
});

test("computeSprt accepts H1 when A dominates and H0 when B dominates", () => {
  const config = { elo0: 0, elo1: 20, alpha: 0.05, beta: 0.05 };
  const aWins = computeSprt({ winsA: 40, winsB: 5, draws: 5 }, config);
  assert.equal(aWins.verdict, "accept-h1");
  assert.ok(aWins.llr >= aWins.upper);

  const bWins = computeSprt({ winsA: 5, winsB: 40, draws: 5 }, config);
  assert.equal(bWins.verdict, "accept-h0");
  assert.ok(bWins.llr <= bWins.lower);

  const early = computeSprt({ winsA: 1, winsB: 1, draws: 0 }, config);
  assert.equal(early.verdict, "continue");
});

test("runEngineMatch threads SPRT through and respects the minGames guard", async () => {
  const a = createJavaScriptEngineBackend({ id: "a", name: "A", depth: 1, timeLimitMs: 30 });
  const b = createJavaScriptEngineBackend({ id: "b", name: "B", depth: 1, timeLimitMs: 30 });

  const report = await runEngineMatch(
    { id: "a", name: "A", engine: a },
    { id: "b", name: "B", engine: b },
    {
      games: 6,
      maxPlies: 16,
      seed: 5,
      searchOptions: { depth: 1, timeLimitMs: 30, useBook: false },
      sprt: { elo0: 0, elo1: 50, minGames: 8 }
    }
  );

  assert.ok(report.sprt, "report should include SPRT data");
  // minGames (8) exceeds the 6-game cap, so it cannot stop early here.
  assert.equal(report.sprt.verdict, "continue");
  assert.equal(report.stoppedEarly, false);
  assert.equal(report.gamesPlayed, 6);
  assert.equal(report.tally.winsA + report.tally.winsB + report.tally.draws, 6);
});

test("unfinished games are adjudicated by material, not silently drawn", async () => {
  // Engine A captures a hanging rook early; with a tight ply cap the game won't
  // reach mate, but A is up a rook — it must be scored a win, not a draw.
  const a = createJavaScriptEngineBackend({ id: "a", name: "A", profile: "balanced" });
  const b = createJavaScriptEngineBackend({ id: "b", name: "B", profile: "balanced" });

  const report = await runEngineMatch(
    { id: "a", name: "A", engine: a },
    { id: "b", name: "B", engine: b },
    {
      games: 1,
      // Stop right after Red's first move so the rook capture stands and the
      // position is adjudicated before shallow play can blunder it back.
      maxPlies: 1,
      openings: ["4k4/9/4r4/9/9/9/9/9/9/3KR4 r"],
      searchOptions: { depth: 2, timeLimitMs: 80, useBook: false },
      adjudicateMaterialCp: 300
    }
  );

  assert.equal(report.gamesPlayed, 1);
  const game = report.games_[0];
  assert.equal(game.adjudication, "material", "should adjudicate by material");
  assert.equal(report.tally.winsA, 1, "A is up a rook and should be credited the win");
  assert.equal(report.tally.draws, 0);
});

test("runEngineMatch plays a full match and books every game as W/L/D", async () => {
  const a = createJavaScriptEngineBackend({ id: "a", name: "A", depth: 1, timeLimitMs: 60 });
  const b = createJavaScriptEngineBackend({ id: "b", name: "B", depth: 1, timeLimitMs: 60 });

  const report = await runEngineMatch(
    { id: "a", name: "A", engine: a },
    { id: "b", name: "B", engine: b },
    { games: 4, maxPlies: 12, seed: 1, searchOptions: { depth: 1, timeLimitMs: 60, useBook: false } }
  );

  const { winsA, winsB, draws } = report.tally;
  assert.equal(winsA + winsB + draws, 4, "every game must be booked");
  assert.equal(report.stats.games, 4);
  assert.ok(Number.isFinite(report.stats.eloDiff));
  assert.equal(report.games_.length, 4);

  // Colors must alternate so a deterministic engine doesn't replay one game.
  assert.equal(report.games_[0].aIsRed, true);
  assert.equal(report.games_[1].aIsRed, false);

  const text = formatMatchReport(report);
  assert.ok(text.includes("Match: A (A) vs B (B)"));
  assert.ok(text.includes("Elo(A−B):"));
});
