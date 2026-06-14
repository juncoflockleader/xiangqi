import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialPosition,
  createJavaScriptEngineBackend,
  createEngine,
  createOracleReviewEngineBackend,
  createUcciEngineBackend,
  formatPositionStudy,
  parseFen,
  studyPositionWithBackend
} from "../src/index.js";

const MOCK_UCCI_PATH = new URL("../fixtures/mock-ucci.mjs", import.meta.url);

test("engine position study bundles decision, hints, candidates, and pressure", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const study = engine.studyPosition(createInitialPosition(), {
    lines: 2,
    depth: 1,
    timeLimitMs: 500
  });
  const text = formatPositionStudy(study);

  assert.equal(study.type, "position-study");
  assert.equal(study.side, "red");
  assert.equal(study.bestMove, "h7-e7");
  assert.equal(study.decision.bestMove, "h7-e7");
  assert.equal(study.decision.source, "opening-book");
  assert.equal(study.candidateLines.length, 2);
  assert.equal(study.hints.at(-1).kind, "reveal");
  assert.ok(Array.isArray(study.pressure.threats));
  assert.ok(study.nextSteps.length > 0);
  assert.match(text, /Position study: Red to move, best h7-e7/);
});

test("position study can include a played move review", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const study = engine.studyPosition(position, {
    useBook: false,
    depth: 2,
    timeLimitMs: 1000,
    lines: 2,
    playedMove: "e9-f9"
  });

  assert.equal(study.bestMove, "e9-e2");
  assert.equal(study.playedMoveReview.move, "e9-f9");
  assert.equal(study.playedMoveReview.bestMove, "e9-e2");
  assert.equal(study.playedMoveReview.classification, "blunder");
  assert.ok(study.playedMoveReview.centipawnLoss > 1000);
  assert.equal(study.nextSteps[0].kind, "correction");
  assert.ok(study.summary.includes("e9-f9 is blunder"));
});

test("backend position study preserves oracle review evidence", async () => {
  const candidate = createJavaScriptEngineBackend({ depth: 1, timeLimitMs: 100 });
  const oracle = createUcciEngineBackend({
    name: "Mock Oracle",
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-ucci",
    depth: 2,
    timeLimitMs: 100,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000
  });
  const backend = createOracleReviewEngineBackend(candidate, oracle);

  try {
    const study = await studyPositionWithBackend(backend, createInitialPosition(), {
      depth: 1,
      timeLimitMs: 100,
      lines: 2,
      playedMove: "h7-e7"
    });

    assert.equal(study.decision.bestMove, "h7-e7");
    assert.equal(study.decision.oracleReview.bestMove, "h9-g7");
    assert.equal(study.oracleReview.bestMove, "h9-g7");
    assert.equal(study.playedMoveReview.reviewBackend.name, "Mock Oracle");
    assert.equal(study.playedMoveReview.oracleReview.bestMove, "h9-g7");
    assert.ok(study.summary.includes("h7-e7 is good"));
  } finally {
    await backend.close();
  }
});

test("backend position study preserves native score details", async () => {
  const backend = createUcciEngineBackend({
    command: process.execPath,
    args: [MOCK_UCCI_PATH.pathname],
    profile: "native-uci",
    depth: 3,
    timeLimitMs: 100,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    engineOptions: {
      MockMateWdl: true
    }
  });

  try {
    const study = await studyPositionWithBackend(backend, createInitialPosition(), {
      useBook: false,
      depth: 3,
      timeLimitMs: 100,
      lines: 2
    });

    assert.equal(study.bestMove, "h9-g7");
    assert.equal(study.decision.scoreDetail.kind, "mate");
    assert.equal(study.decision.scoreDetail.text, "mate in 2");
    assert.equal(study.decision.scoreText, "mate in 2");
    assert.equal(study.decision.wdl.text, "98% win, 2% draw, 0% loss");
    assert.ok(study.decision.summary.includes("mate in 2"));
    assert.equal(study.candidateLines[0].scoreDetail.text, "mate in 2");
    assert.equal(study.candidateLines[0].scoreText, "mate in 2");
    assert.equal(study.candidateLines[0].wdl.text, "98% win, 2% draw, 0% loss");
    assert.equal(study.coach.scoreDetail.text, "mate in 2");
    assert.equal(study.coach.wdl.text, "98% win, 2% draw, 0% loss");
    assert.equal(study.coach.alternatives[0].scoreDetail.text, "mate in 2");
  } finally {
    await backend.close();
  }
});
