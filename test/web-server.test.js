import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveWebPlayerReviewOptions,
  resolveWebServerCommandTimeoutMs,
  resolveWebServerRequestTimeoutMs,
  startWebServer
} from "../examples/web-server.mjs";

test("web server scales native command timeout for deeper searches", () => {
  assert.equal(resolveWebServerCommandTimeoutMs({ depth: 1, timeLimitMs: 50 }), 30000);
  assert.equal(resolveWebServerCommandTimeoutMs({ depth: 7, timeLimitMs: 8000 }), 630000);
  assert.equal(resolveWebServerCommandTimeoutMs({ depth: 7, timeLimitMs: 25000 }), 630000);
  assert.equal(resolveWebServerCommandTimeoutMs({ commandTimeoutMs: 45000, depth: 7, timeLimitMs: 8000 }), 45000);
});

test("web server keeps HTTP requests open longer than deep native searches", () => {
  const commandTimeoutMs = resolveWebServerCommandTimeoutMs({ depth: 7, timeLimitMs: 8000 });

  assert.equal(commandTimeoutMs, 630000);
  assert.equal(resolveWebServerRequestTimeoutMs({ depth: 7, timeLimitMs: 8000 }, commandTimeoutMs), 690000);
  assert.equal(resolveWebServerRequestTimeoutMs({ commandTimeoutMs: 45000 }), 105000);
  assert.equal(resolveWebServerRequestTimeoutMs({ requestTimeoutMs: 90000, commandTimeoutMs: 45000 }), 90000);
});

test("web server caps live player review budget for deep play", () => {
  assert.deepEqual(resolveWebPlayerReviewOptions({
    depth: 7,
    timeLimitMs: 8000,
    lines: 2,
    useBook: true
  }), {
    depth: 3,
    timeLimitMs: 1000,
    commandTimeoutMs: 30000,
    lines: 2,
    useBook: true
  });

  assert.deepEqual(resolveWebPlayerReviewOptions({
    depth: 1,
    timeLimitMs: 50,
    lines: 2,
    useBook: false
  }), {
    depth: 1,
    timeLimitMs: 50,
    commandTimeoutMs: 30000,
    lines: 2,
    useBook: false
  });
});

test("web server serves the browser game and starts a session", async () => {
  const app = await startWebServer({
    port: 0,
    native: false,
    depth: 1,
    timeLimitMs: 50,
    lines: 2,
    useBook: false
  });

  try {
    const page = await fetchText(`${app.url}/`);
    const script = await fetchText(`${app.url}/app.js`);
    const stylesheet = await fetchText(`${app.url}/app.css`);
    const created = await postJson(`${app.url}/api/new`, { side: "red" });

    assert.equal(app.server.requestTimeout, 90000);
    assert.equal(app.server.timeout, 90000);
    // ---- redesigned UI: page structure ----
    assert.match(page, /class="board-felt"/);
    assert.match(page, /id="board"/);
    assert.match(page, /楚 河/);
    assert.match(page, /漢 界/);
    assert.match(page, /中文（简体）/);
    assert.match(page, /中文（繁體）/);
    assert.match(page, />English</);
    assert.match(page, /data-i18n="appTitle"/);
    assert.match(page, /id="coachCard"/);
    assert.match(page, /id="moveList"/);
    assert.match(page, /id="settings"/);
    assert.match(page, /id="newButton"/);
    assert.match(page, /id="hintButton"/);
    assert.match(page, /id="bestButton"/);
    assert.match(page, /id="localeSelect"/);
    assert.match(page, /id="sideSelect"/);
    assert.match(page, /id="levelSelect"/);
    assert.match(page, /class="grid-palace"/);
    assert.match(page, /M3 0L5 2 M5 0L3 2/);
    // ---- redesigned UI: client wires the API + render ----
    assert.match(script, /function renderBoard/);
    assert.match(script, /function renderCoach/);
    assert.match(script, /function renderMoveList/);
    assert.match(script, /"\/api\/new"/);
    assert.match(script, /"\/api\/move"/);
    assert.match(script, /"\/api\/hint"/);
    assert.match(script, /"\/api\/best"/);
    assert.match(script, /"\/api\/undo"/);
    assert.match(script, /"\/api\/select-node"/); // move list + replay navigate non-destructively
    assert.match(script, /--file:\$\{file\}/);
    // ---- redesigned UI: stylesheet ----
    assert.match(stylesheet, /\.board-felt/);
    assert.match(stylesheet, /\.piece/);
    assert.match(stylesheet, /\.point/);
    assert.match(stylesheet, /\.coach/);
    assert.match(stylesheet, /\.movelist/);
    assert.match(stylesheet, /vector-effect: non-scaling-stroke/);
    assert.equal(created.ok, true);
    assert.equal(created.state.playerSide, "red");
    assert.equal(created.state.engineSide, "black");
    assert.equal(created.state.web.commandTimeoutMs, 30000);
    assert.equal(created.state.web.requestTimeoutMs, 90000);
    assert.equal(created.state.board.length, 90);
    assert.equal(created.state.board.find((cell) => cell.coord === "a0").piece.zhLabel, "黑方車");
    assert.equal(created.state.board.find((cell) => cell.coord === "e9").piece.zhLabel, "紅方帥");
    assert.equal(created.state.playerTurn, true);
    assert.ok(created.state.legalMoves.some((move) => move.notation === "h7-e7"));
    assert.ok(created.state.legalMoves.some((move) => move.zhNotation === "炮二平五"));
    assert.equal(created.state.backend.kind, "javascript");
  } finally {
    await app.close();
  }
});

test("web server plays a player move, engine reply, hints, best move, and undo", async () => {
  const app = await startWebServer({
    port: 0,
    native: false,
    depth: 1,
    timeLimitMs: 50,
    lines: 2,
    useBook: false
  });

  try {
    const created = await postJson(`${app.url}/api/new`, { side: "red" });
    const sessionId = created.state.sessionId;
    const best = await postJson(`${app.url}/api/best`, { sessionId });
    const hint = await postJson(`${app.url}/api/hint`, { sessionId });
    const moved = await postJson(`${app.url}/api/move`, { sessionId, move: "h7-e7" });
    const analyzedNode = await postJson(`${app.url}/api/analyze-node`, {
      sessionId,
      node: { kind: "main", ply: 1 }
    });
    const undone = await postJson(`${app.url}/api/undo`, { sessionId });
    const movedAgain = await postJson(`${app.url}/api/move`, { sessionId, move: "h7-e7" });
    const jumped = await postJson(`${app.url}/api/jump`, { sessionId, ply: 0 });

    assert.equal(best.ok, true);
    assert.equal(typeof best.best.bestMove, "string");
    assert.equal(typeof best.best.zhBestMove, "string");
    assert.equal(typeof best.best.zhReasons[0], "string");
    assert.ok(best.best.alternatives.length >= 1);
    assert.equal(typeof best.best.alternatives[0].zhMove, "string");
    assert.equal(best.best.alternatives[0].boardAfter.length, 90);
    assert.equal(hint.ok, true);
    assert.ok(hint.hint.levels.length >= 1);
    assert.ok(hint.hint.zhLevels.some((level) => /最佳著法|候選|局面/.test(level.title + level.text)));
    assert.equal(typeof hint.hint.zhBestMove, "string");
    assert.equal(moved.ok, true);
    assert.equal(moved.state.history[0].notation, "h7-e7");
    assert.equal(moved.state.history[0].zhNotation, "炮二平五");
    assert.equal(moved.state.history[0].boardBefore.length, 90);
    assert.equal(moved.state.history[0].boardAfter.length, 90);
    assert.ok(moved.state.history[0].review.bestAlternatives.some((alternative) => alternative.boardAfter?.length === 90));
    assert.equal(typeof moved.state.history[1].zhNotation, "string");
    assert.equal(moved.state.history[1].boardBefore.length, 90);
    assert.equal(moved.state.history[1].boardAfter.length, 90);
    assert.ok(moved.state.history[1].decision.alternatives.some((alternative) => alternative.boardAfter?.length === 90));
    assert.equal(moved.state.history.length, 2);
    assert.equal(moved.state.playerTurn, true);
    assert.equal(moved.state.lastPlayerReview.move, "h7-e7");
    assert.equal(moved.state.lastPlayerReview.zhMove, "炮二平五");
    assert.equal(moved.state.teachingPair.playerMove.notation, "h7-e7");
    assert.equal(moved.state.teachingPair.playerReview.move, "h7-e7");
    assert.equal(moved.state.teachingPair.engineMove.notation, moved.state.history[1].notation);
    assert.equal(moved.state.teachingPair.engineDecision.bestMove, moved.state.history[1].notation);
    assert.equal(moved.state.teachingTurns.length, 1);
    assert.equal(moved.state.teachingTurns[0].playerMove.notation, "h7-e7");
    assert.equal(moved.state.teachingTurns[0].playerReview.move, "h7-e7");
    assert.equal(moved.state.teachingTurns[0].engineMove.notation, moved.state.history[1].notation);
    assert.equal(moved.state.teachingTurns[0].engineDecision.bestMove, moved.state.history[1].notation);
    assert.equal(moved.state.latestPlayerTeachingTurn.playerMove.notation, "h7-e7");
    assert.equal(moved.state.latestPlayerTeachingTurn.playerReview.move, "h7-e7");
    assert.equal(moved.state.latestPlayerTeachingTurn.engineMove.notation, moved.state.history[1].notation);
    assert.equal(moved.state.currentTeachingTurn.playerMove.notation, "h7-e7");
    assert.equal(moved.state.currentTeachingTurn.playerReview.move, "h7-e7");
    assert.equal(moved.state.currentTeachingTurn.engineMove.notation, moved.state.history[1].notation);
    assert.equal(moved.state.currentTeachingTurn.engineDecision.bestMove, moved.state.history[1].notation);
    assert.equal(moved.state.teachingTurn.playerMove.notation, "h7-e7");
    assert.equal(moved.state.teachingTurn.playerReview.move, "h7-e7");
    assert.equal(moved.state.teachingTurn.engineMove.notation, moved.state.history[1].notation);
    assert.equal(moved.state.teachingTurn.engineDecision.bestMove, moved.state.history[1].notation);
    if (moved.state.lastPlayerReview.planComparison) {
      assert.equal(typeof moved.state.lastPlayerReview.planComparison.zhSummary, "string");
    }
    assert.equal(analyzedNode.ok, true);
    assert.equal(analyzedNode.analysis.board.length, 90);
    assert.equal(analyzedNode.analysis.branches.length, 2);
    assert.equal(analyzedNode.analysis.branches[0].boardAfter.length, 90);
    assert.equal(typeof analyzedNode.analysis.branches[0].zhMove, "string");
    // each line carries its PV played out as boards + FENs (for variation playout)
    assert.ok(Array.isArray(analyzedNode.analysis.branches[0].pvBoards));
    assert.ok(Array.isArray(analyzedNode.analysis.branches[0].pvFens));
    assert.equal(analyzedNode.analysis.branches[0].pvBoards.length, analyzedNode.analysis.branches[0].pvFens.length);
    if (analyzedNode.analysis.branches[0].pvBoards.length) {
      assert.equal(analyzedNode.analysis.branches[0].pvBoards[0].length, 90);
      assert.equal(typeof analyzedNode.analysis.branches[0].pvFens[0], "string");
    }
    assert.equal(analyzedNode.state.history.length, 2);
    assert.equal(undone.ok, true);
    assert.equal(undone.state.history.length, 0);
    assert.equal(undone.state.playerTurn, true);
    assert.equal(movedAgain.ok, true);
    assert.equal(movedAgain.state.history.length, 2);
    assert.equal(jumped.ok, true);
    assert.equal(jumped.state.history.length, 0);
    assert.equal(jumped.state.playerTurn, true);
    assert.equal(jumped.state.canUndo, true);
  } finally {
    await app.close();
  }
});

test("web server defers engine replies and can continue from tree nodes", async () => {
  const app = await startWebServer({
    port: 0,
    native: false,
    depth: 1,
    timeLimitMs: 50,
    lines: 2,
    useBook: false
  });

  try {
    const created = await postJson(`${app.url}/api/new`, { side: "red" });
    const sessionId = created.state.sessionId;
    const deferred = await postJson(`${app.url}/api/move`, {
      sessionId,
      move: "h7-e7",
      reviewPlayer: false,
      deferEngine: true
    });

    assert.equal(deferred.ok, true);
    assert.equal(deferred.state.history.length, 1);
    assert.equal(deferred.state.history[0].notation, "h7-e7");
    assert.equal(deferred.state.history[0].review, null);
    assert.equal(deferred.state.lastPlayerReview, null);
    assert.equal(deferred.state.teachingPair.playerMove.notation, "h7-e7");
    assert.equal(deferred.state.teachingPair.id, "turn-1");
    assert.equal(deferred.state.teachingPair.playerReview, null);
    assert.equal(deferred.state.teachingPair.playerReviewPending, true);
    assert.equal(deferred.state.teachingPair.engineMove, null);
    assert.equal(deferred.state.teachingPair.engineDecision, null);
    assert.equal(deferred.state.teachingPair.engineThinking, true);
    assert.equal(deferred.state.teachingTurns.length, 1);
    assert.equal(deferred.state.teachingTurns[0].id, "turn-1");
    assert.equal(deferred.state.teachingTurns[0].playerMove.notation, "h7-e7");
    assert.equal(deferred.state.teachingTurns[0].playerReview, null);
    assert.equal(deferred.state.teachingTurns[0].playerReviewPending, true);
    assert.equal(deferred.state.teachingTurns[0].engineMove, null);
    assert.equal(deferred.state.teachingTurns[0].engineDecision, null);
    assert.equal(deferred.state.teachingTurns[0].engineThinking, true);
    assert.equal(deferred.state.latestPlayerTeachingTurn.id, "turn-1");
    assert.equal(deferred.state.latestPlayerTeachingTurn.playerReview, null);
    assert.equal(deferred.state.latestPlayerTeachingTurn.playerReviewPending, true);
    assert.equal(deferred.state.latestPlayerTeachingTurn.engineMove, null);
    assert.equal(deferred.state.latestPlayerTeachingTurn.engineThinking, true);
    assert.equal(deferred.state.currentTeachingTurn.playerMove.notation, "h7-e7");
    assert.equal(deferred.state.currentTeachingTurn.id, "turn-1");
    assert.equal(deferred.state.currentTeachingTurn.playerReview, null);
    assert.equal(deferred.state.currentTeachingTurn.playerReviewPending, true);
    assert.equal(deferred.state.currentTeachingTurn.engineMove, null);
    assert.equal(deferred.state.currentTeachingTurn.engineDecision, null);
    assert.equal(deferred.state.currentTeachingTurn.engineThinking, true);
    assert.equal(deferred.state.teachingTurn.playerMove.notation, "h7-e7");
    assert.equal(deferred.state.teachingTurn.id, "turn-1");
    assert.equal(deferred.state.teachingTurn.playerReview, null);
    assert.equal(deferred.state.teachingTurn.playerReviewPending, true);
    assert.equal(deferred.state.teachingTurn.engineMove, null);
    assert.equal(deferred.state.teachingTurn.engineDecision, null);
    assert.equal(deferred.state.teachingTurn.engineThinking, true);
    assert.equal(deferred.state.turn, "black");
    assert.equal(deferred.state.playerTurn, false);

    const reviewed = await postJson(`${app.url}/api/review-last-player-move`, { sessionId });
    assert.equal(reviewed.ok, true);
    assert.equal(reviewed.state.history.length, 1);
    assert.equal(reviewed.state.history[0].review.move, "h7-e7");
    assert.equal(reviewed.state.lastPlayerReview.move, "h7-e7");
    assert.equal(reviewed.state.teachingPair.id, "turn-1");
    assert.equal(reviewed.state.teachingPair.playerReview.move, "h7-e7");
    assert.equal(reviewed.state.teachingPair.playerReviewPending, false);
    assert.equal(reviewed.state.teachingPair.engineMove, null);
    assert.equal(reviewed.state.teachingPair.engineThinking, true);
    assert.equal(reviewed.state.latestPlayerTeachingTurn.playerReview.move, "h7-e7");
    assert.equal(reviewed.state.currentTeachingTurn.playerReview.move, "h7-e7");
    assert.equal(reviewed.state.currentTeachingTurn.engineThinking, true);
    assert.equal(reviewed.state.teachingTurn.playerReview.move, "h7-e7");
    assert.equal(reviewed.state.playerTurn, false);

    const engineReply = await postJson(`${app.url}/api/engine-move`, { sessionId });
    assert.equal(engineReply.ok, true);
    assert.equal(engineReply.state.history.length, 2);
    assert.equal(engineReply.state.lastPlayerReview.move, "h7-e7");
    assert.equal(engineReply.state.lastEngineDecision.bestMove, engineReply.state.history[1].notation);
    assert.equal(engineReply.state.teachingPair.id, "turn-1");
    assert.equal(engineReply.state.teachingPair.playerReview.move, "h7-e7");
    assert.equal(engineReply.state.teachingPair.engineMove.notation, engineReply.state.history[1].notation);
    assert.equal(engineReply.state.teachingPair.engineDecision.bestMove, engineReply.state.history[1].notation);
    assert.equal(engineReply.state.teachingPair.engineThinking, false);
    assert.equal(engineReply.state.teachingTurns.length, 1);
    assert.equal(engineReply.state.teachingTurns[0].id, "turn-1");
    assert.equal(engineReply.state.teachingTurns[0].playerReview.move, "h7-e7");
    assert.equal(engineReply.state.teachingTurns[0].engineMove.notation, engineReply.state.history[1].notation);
    assert.equal(engineReply.state.teachingTurns[0].engineDecision.bestMove, engineReply.state.history[1].notation);
    assert.equal(engineReply.state.teachingTurns[0].engineThinking, false);
    assert.equal(engineReply.state.latestPlayerTeachingTurn.id, "turn-1");
    assert.equal(engineReply.state.latestPlayerTeachingTurn.playerReview.move, "h7-e7");
    assert.equal(engineReply.state.latestPlayerTeachingTurn.engineMove.notation, engineReply.state.history[1].notation);
    assert.equal(engineReply.state.latestPlayerTeachingTurn.engineThinking, false);
    assert.equal(engineReply.state.currentTeachingTurn.playerMove.notation, "h7-e7");
    assert.equal(engineReply.state.currentTeachingTurn.id, "turn-1");
    assert.equal(engineReply.state.currentTeachingTurn.playerReview.move, "h7-e7");
    assert.equal(engineReply.state.currentTeachingTurn.engineMove.notation, engineReply.state.history[1].notation);
    assert.equal(engineReply.state.currentTeachingTurn.engineDecision.bestMove, engineReply.state.history[1].notation);
    assert.equal(engineReply.state.currentTeachingTurn.engineThinking, false);
    assert.equal(engineReply.state.teachingTurn.playerMove.notation, "h7-e7");
    assert.equal(engineReply.state.teachingTurn.id, "turn-1");
    assert.equal(engineReply.state.teachingTurn.playerReview.move, "h7-e7");
    assert.equal(engineReply.state.teachingTurn.engineMove.notation, engineReply.state.history[1].notation);
    assert.equal(engineReply.state.teachingTurn.engineDecision.bestMove, engineReply.state.history[1].notation);
    assert.equal(engineReply.state.teachingTurn.engineThinking, false);
    assert.equal(engineReply.state.playerTurn, true);

    const alternative = engineReply.state.history[1].decision.alternatives[0];
    const selected = await postJson(`${app.url}/api/select-node`, {
      sessionId,
      node: {
        kind: "alternative",
        parentPly: 2,
        move: alternative.move
      }
    });

    assert.equal(selected.ok, true);
    assert.equal(selected.state.history.length, 2);
    assert.equal(selected.state.lastMove.notation, alternative.move);
    assert.equal(selected.state.playerTurn, true);
    assert.equal(selected.state.legalMoves.length > 0, true);

    const deferredJump = await postJson(`${app.url}/api/jump`, {
      sessionId,
      ply: 1,
      deferEngine: true
    });
    assert.equal(deferredJump.ok, true);
    assert.equal(deferredJump.state.history.length, 1);
    assert.equal(deferredJump.state.history[0].notation, "h7-e7");
    assert.equal(deferredJump.state.teachingPair.id, "turn-1");
    assert.equal(deferredJump.state.teachingPair.playerReview.move, "h7-e7");
    assert.equal(deferredJump.state.teachingTurn.playerReview.move, "h7-e7");
    assert.equal(deferredJump.state.teachingPair.engineMove, null);
    assert.equal(deferredJump.state.teachingPair.engineThinking, true);
    assert.equal(deferredJump.state.playerTurn, false);

    const reviewedAgain = await postJson(`${app.url}/api/review-last-player-move`, { sessionId });
    assert.equal(reviewedAgain.ok, true);
    assert.equal(reviewedAgain.state.history[0].review.move, "h7-e7");
    assert.equal(reviewedAgain.state.teachingTurn.playerReview.move, "h7-e7");

    const continued = await postJson(`${app.url}/api/engine-move`, { sessionId });
    assert.equal(continued.ok, true);
    assert.equal(continued.state.history.length, 2);
    assert.equal(continued.state.teachingPair.id, "turn-1");
    assert.equal(continued.state.teachingPair.playerReview.move, "h7-e7");
    assert.equal(continued.state.teachingTurn.playerReview.move, "h7-e7");
    assert.equal(continued.state.teachingPair.engineMove.notation, continued.state.history[1].notation);
    assert.equal(continued.state.teachingTurn.engineMove.notation, continued.state.history[1].notation);
    assert.equal(continued.state.playerTurn, true);
  } finally {
    await app.close();
  }
});

test("web server keeps earlier human reviews after later engine replies", async () => {
  const app = await startWebServer({
    port: 0,
    native: false,
    depth: 1,
    timeLimitMs: 50,
    lines: 2,
    useBook: false
  });

  try {
    const created = await postJson(`${app.url}/api/new`, { side: "red" });
    const sessionId = created.state.sessionId;
    const first = await postJson(`${app.url}/api/move`, { sessionId, move: "h7-e7" });
    const secondMove = first.state.legalMoves[0].notation;
    const second = await postJson(`${app.url}/api/move`, { sessionId, move: secondMove });

    assert.equal(first.state.history.length, 2);
    assert.equal(first.state.teachingTurns.length, 1);
    assert.equal(first.state.teachingTurns[0].playerMove.notation, "h7-e7");
    assert.equal(first.state.teachingTurns[0].playerReview.move, "h7-e7");
    assert.equal(first.state.teachingTurns[0].engineMove.notation, first.state.history[1].notation);

    assert.equal(second.state.history.length, 4);
    assert.equal(second.state.teachingTurns.length, 2);
    assert.equal(second.state.teachingTurns[0].playerMove.notation, "h7-e7");
    assert.equal(second.state.teachingTurns[0].playerReview.move, "h7-e7");
    assert.equal(second.state.teachingTurns[0].engineMove.notation, first.state.history[1].notation);
    assert.equal(second.state.teachingTurns[1].playerMove.notation, secondMove);
    assert.equal(second.state.teachingTurns[1].playerReview.move, secondMove);
    assert.equal(second.state.teachingTurns[1].engineMove.notation, second.state.history[3].notation);
    assert.equal(second.state.latestPlayerTeachingTurn.id, second.state.teachingTurns[1].id);
    assert.equal(second.state.latestPlayerTeachingTurn.playerReview.move, secondMove);
    assert.equal(second.state.teachingPair.id, second.state.teachingTurns[1].id);
    assert.equal(second.state.teachingPair.playerReview.move, secondMove);
  } finally {
    await app.close();
  }
});

test("web server preserves teaching turns when the engine opens first", async () => {
  const app = await startWebServer({
    port: 0,
    native: false,
    depth: 1,
    timeLimitMs: 50,
    lines: 2,
    useBook: false
  });

  try {
    const created = await postJson(`${app.url}/api/new`, { side: "black" });
    const sessionId = created.state.sessionId;

    assert.equal(created.state.playerSide, "black");
    assert.equal(created.state.history.length, 1);
    assert.equal(created.state.history[0].actor, "engine");
    assert.equal(created.state.teachingTurns.length, 1);
    assert.equal(created.state.teachingTurns[0].id, "turn-engine-1");
    assert.equal(created.state.teachingTurns[0].playerMove, null);
    assert.equal(created.state.teachingTurns[0].engineMove.notation, created.state.history[0].notation);
    assert.equal(created.state.latestPlayerTeachingTurn, null);
    assert.equal(created.state.currentTeachingTurn.id, "turn-engine-1");
    assert.equal(created.state.currentTeachingTurn.playerMove, null);
    assert.equal(created.state.currentTeachingTurn.engineMove.notation, created.state.history[0].notation);
    assert.equal(created.state.teachingPair.id, "turn-engine-1");
    assert.equal(created.state.teachingPair.engineMove.notation, created.state.history[0].notation);
    assert.equal(created.state.playerTurn, true);

    const playerMove = created.state.legalMoves[0].notation;
    const deferred = await postJson(`${app.url}/api/move`, {
      sessionId,
      move: playerMove,
      reviewPlayer: false,
      deferEngine: true
    });

    assert.equal(deferred.state.history.length, 2);
    assert.equal(deferred.state.history[1].actor, "player");
    assert.equal(deferred.state.teachingTurns.length, 2);
    assert.equal(deferred.state.teachingTurns[1].id, "turn-2");
    assert.equal(deferred.state.teachingTurns[0].engineMove.notation, created.state.history[0].notation);
    assert.equal(deferred.state.teachingTurns[1].playerMove.notation, playerMove);
    assert.equal(deferred.state.teachingTurns[1].playerReview, null);
    assert.equal(deferred.state.teachingTurns[1].playerReviewPending, true);
    assert.equal(deferred.state.teachingTurns[1].engineMove, null);
    assert.equal(deferred.state.teachingTurns[1].engineThinking, true);
    assert.equal(deferred.state.latestPlayerTeachingTurn.id, "turn-2");
    assert.equal(deferred.state.latestPlayerTeachingTurn.playerMove.notation, playerMove);
    assert.equal(deferred.state.latestPlayerTeachingTurn.playerReview, null);
    assert.equal(deferred.state.latestPlayerTeachingTurn.playerReviewPending, true);
    assert.equal(deferred.state.latestPlayerTeachingTurn.engineMove, null);
    assert.equal(deferred.state.teachingPair.playerMove.notation, playerMove);
    assert.equal(deferred.state.teachingPair.id, "turn-2");
    assert.equal(deferred.state.teachingPair.playerReview, null);
    assert.equal(deferred.state.teachingPair.playerReviewPending, true);

    const reviewed = await postJson(`${app.url}/api/review-last-player-move`, { sessionId });
    assert.equal(reviewed.state.history.length, 2);
    assert.equal(reviewed.state.history[1].review.move, playerMove);
    assert.equal(reviewed.state.teachingTurns[1].playerReview.move, playerMove);
    assert.equal(reviewed.state.latestPlayerTeachingTurn.playerReview.move, playerMove);
    assert.equal(reviewed.state.teachingPair.playerReview.move, playerMove);

    const replied = await postJson(`${app.url}/api/engine-move`, { sessionId });
    assert.equal(replied.state.history.length, 3);
    assert.equal(replied.state.history[2].actor, "engine");
    assert.equal(replied.state.teachingTurns.length, 2);
    assert.equal(replied.state.teachingTurns[1].id, "turn-2");
    assert.equal(replied.state.teachingTurns[0].engineMove.notation, created.state.history[0].notation);
    assert.equal(replied.state.teachingTurns[1].playerMove.notation, playerMove);
    assert.equal(replied.state.teachingTurns[1].engineMove.notation, replied.state.history[2].notation);
    assert.equal(replied.state.teachingTurns[1].engineMove.ply, replied.state.teachingTurns[1].playerMove.ply + 1);
    assert.equal(replied.state.latestPlayerTeachingTurn.id, "turn-2");
    assert.equal(replied.state.latestPlayerTeachingTurn.playerMove.notation, playerMove);
    assert.equal(replied.state.latestPlayerTeachingTurn.engineMove.notation, replied.state.history[2].notation);
    assert.equal(replied.state.currentTeachingTurn.id, "turn-2");
    assert.equal(replied.state.currentTeachingTurn.playerMove.notation, playerMove);
    assert.equal(replied.state.currentTeachingTurn.playerReview.move, playerMove);
    assert.equal(replied.state.currentTeachingTurn.engineMove.notation, replied.state.history[2].notation);
    assert.equal(replied.state.teachingPair.id, "turn-2");
    assert.equal(replied.state.teachingPair.playerReview.move, playerMove);
    assert.equal(replied.state.teachingPair.engineMove.notation, replied.state.history[2].notation);
  } finally {
    await app.close();
  }
});

test("web server imports a game from Chinese notation and exposes replay UI", async () => {
  const app = await startWebServer({
    port: 0,
    native: false,
    depth: 1,
    timeLimitMs: 50,
    lines: 2,
    useBook: false
  });

  try {
    const page = await fetchText(`${app.url}/`);
    const script = await fetchText(`${app.url}/app.js`);

    // ---- replay + import UI is wired into the page/client ----
    assert.match(page, /id="replayBar"/);
    assert.match(page, /id="stepNextButton"/);
    assert.match(page, /id="stepPrevButton"/);
    assert.match(page, /id="importMovesText"/);
    assert.match(page, /id="importMovesButton"/);
    assert.match(page, /id="variationsButton"/);
    assert.match(script, /"\/api\/import"/);
    assert.match(script, /function stepNext/);
    assert.match(script, /function cachedAnalysis/);
    assert.match(script, /function showVariations/);
    assert.match(script, /function mergeVariation/);

    // ---- /api/import parses mixed Chinese + coordinate notation ----
    const imported = await postJson(`${app.url}/api/import`, {
      side: "red",
      moves: "1. 炮二平五 馬8進7 2. 傌二進三 卒7進1 3. b9-c7"
    });
    assert.equal(imported.ok, true);
    assert.equal(imported.applied, 5);
    assert.equal(imported.total, 5);
    assert.equal(imported.error, null);
    assert.equal(imported.state.history.length, 5);
    assert.equal(imported.state.history[0].zhNotation, "炮二平五");
    assert.equal(imported.state.history[1].zhNotation, "馬8進7");
    assert.equal(imported.state.history[4].notation, "b9-c7");

    // ---- a well-formed but illegal token stops cleanly (no 500) ----
    const illegal = await postJson(`${app.url}/api/import`, {
      side: "red",
      moves: "炮二平五 馬8進7 a0-a5"
    });
    assert.equal(illegal.ok, true);
    assert.equal(illegal.applied, 2);
    assert.equal(illegal.error, "a0-a5");

    // ---- analyze-node honors lines + useBook overrides for variation playout ----
    const variations = await postJson(`${app.url}/api/analyze-node`, {
      sessionId: imported.state.sessionId,
      node: { fen: imported.state.fen },
      lines: 2,
      useBook: false
    });
    assert.equal(variations.ok, true);
    assert.ok(variations.analysis.branches.length >= 1);
    assert.ok(variations.analysis.branches.every((b) => Array.isArray(b.pvBoards) && Array.isArray(b.pvFens)));

    // ---- a bad token stops cleanly and reports where ----
    const partial = await postJson(`${app.url}/api/import`, {
      side: "red",
      moves: "炮二平五 馬8進7 这不是着法 傌二進三"
    });
    assert.equal(partial.applied, 2);
    assert.equal(partial.error, "这不是着法");
    assert.equal(partial.state.history.length, 2);
  } finally {
    await app.close();
  }
});

async function fetchText(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  return response.text();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  assert.equal(response.status, 200, data.error);
  return data;
}
