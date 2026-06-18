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
    assert.match(page, /<main class="app-shell"/);
    assert.match(page, /class="play-section"/);
    assert.match(page, /id="treeViewport"/);
    assert.match(page, /楚河/);
    assert.match(page, /汉界/);
    assert.match(page, /中文（简体）/);
    assert.match(page, /中文（繁體）/);
    assert.match(page, /aria-label="象棋棋盘"/);
    assert.match(page, /data-i18n-aria-label="boardAria"/);
    assert.match(page, /class="board-grid"/);
    assert.match(page, /M1 0V4 M1 5V9/);
    assert.match(page, /M0 4H8 M0 5H8/);
    assert.match(page, /M3 0L5 2 M5 0L3 2/);
    assert.match(page, /class="board-palace-line"/);
    assert.match(page, /file-labels-north/);
    assert.match(page, /id="selectedMoves"/);
    assert.match(page, />九</);
    assert.match(page, /id="localeSelect"/);
    assert.match(page, /data-i18n="moveTree"/);
    assert.match(page, /class="tree-toolbar"/);
    assert.match(page, /role="tree"/);
    assert.match(script, /function renderBoard/);
    assert.match(script, /function buildMoveTree/);
    assert.match(script, /function moveOptionsForPly/);
    assert.match(script, /function layoutMoveTree/);
    assert.match(script, /function renderTreeEdges/);
    assert.match(script, /function renderTreeEdgeLabel/);
    assert.match(script, /function renderTreeNode/);
    assert.match(script, /function renderMiniBoard/);
    assert.match(script, /function recomputeTreeNode/);
    assert.match(script, /"\/api\/engine-move"/);
    assert.match(script, /"\/api\/select-node"/);
    assert.match(script, /deferEngine: true/);
    assert.match(script, /kind: "teachingPair"/);
    assert.match(script, /function latestTeachingPair/);
    assert.match(script, /function latestPlayerTeachingPair/);
    assert.match(script, /function focusLatestPlayerTeachingTurn/);
    assert.match(script, /focusLatestPlayerTeachingTurn\(result\.state\)/);
    assert.match(script, /function teachingPairForSelectedTreeNode/);
    assert.match(script, /function teachingPairForMainlineNode/);
    assert.match(script, /function activeTeachingPair/);
    assert.match(script, /teachingTurnFocusId/);
    assert.match(script, /function focusTeachingTurnForMove/);
    assert.match(script, /function panelFromTeachingFocus/);
    assert.match(script, /function focusedTeachingPair/);
    assert.match(script, /function teachingTurnById/);
    assert.match(script, /function teachingTurnIdForMove/);
    assert.match(script, /game\.teachingPair/);
    assert.match(script, /game\.teachingTurn/);
    assert.match(script, /game\.teachingTurns/);
    assert.match(script, /game\?\.latestPlayerTeachingTurn/);
    assert.match(script, /playerReviewPending/);
    assert.match(script, /engineThinking/);
    assert.match(script, /function teachingTurnFromState/);
    assert.match(script, /function normalizeTeachingTurns/);
    assert.match(script, /function normalizeTeachingPair/);
    assert.match(script, /function renderTeachingMoveCard/);
    assert.match(script, /function renderTeachingPairCards/);
    assert.match(script, /function pairWithPreservedHumanMove/);
    assert.match(script, /function hasHumanTeachingMove/);
    assert.match(script, /function teachingReviewScoreText/);
    assert.match(script, /function renderReasoningPrompt/);
    assert.match(script, /if \(!panel\) {\n    renderReasoningPrompt\(\);/);
    assert.match(script, /teachingTurn: "本回合复盘"/);
    assert.match(script, /compact: true/);
    assert.match(script, /function renderTeachingPairReasoning/);
    assert.match(script, /TEACHING_REVIEW_HOLD_MS = 5000/);
    assert.match(script, /function holdTeachingReviewBeforeEngineReply/);
    assert.match(script, /function shouldHoldTeachingReview/);
    assert.match(script, /function teachingPairForMove/);
    assert.match(script, /function actorMoveAtPly/);
    assert.match(script, /reviewPending: "正在复盘你的上一手\.\.\."/);
    assert.match(script, /replyPending: "引擎正在思考应手\.\.\."/);
    assert.match(script, /function fitTreeView/);
    assert.match(script, /function zoomTreeView/);
    assert.match(script, /function handleTreeWheel/);
    assert.match(script, /function boardCellsForTreeSelection/);
    assert.match(script, /node\.alternative\.boardAfter/);
    assert.match(script, /t\("variationPreview"\)/);
    assert.match(script, /"\/api\/analyze-node"/);
    assert.match(script, /function restoreTreeNode/);
    assert.match(script, /"\/api\/jump"/);
    assert.match(script, /button\.style\.setProperty\("--file", point\.file\)/);
    assert.match(script, /button\.style\.setProperty\("--rank", point\.rank\)/);
    assert.match(script, /const glyphLocale = isChineseLocale\(\) \? state\.locale : "zh-TW"/);
    assert.match(script, /glyph\.className = "piece-glyph"/);
    assert.match(script, /function renderSelectedMoves/);
    assert.match(script, /function localizedChineseText/);
    assert.match(script, /thinking: "引擎思考中\.\.\."/);
    assert.match(script, /thinkingShort: "思考中"/);
    assert.match(script, /DEFAULT_CLIENT_REQUEST_TIMEOUT_MS = 15 \* 60 \* 1000/);
    assert.match(script, /function currentRequestTimeoutMs/);
    assert.match(script, /function fetchState/);
    assert.match(script, /function refreshStateAfterFailure/);
    assert.match(script, /state\.errorMessage = refreshed/);
    assert.match(script, /function pendingStatusText/);
    assert.match(script, /requestTimedOut: "请求等待时间过长，请重试。"/);
    assert.match(script, /stateRefreshed: "已重新同步当前局面。"/);
    assert.match(script, /className = "turn-pill thinking"/);
    assert.match(script, /traditionalChineseMap/);
    assert.match(script, /function moveLabelText/);
    assert.match(script, /function moveTitleText/);
    assert.match(script, /moveLabel\.textContent = moveLabelText/);
    assert.match(script, /aria-label="\$\{escapeHtml\(label\)\}"/);
    assert.match(script, /boardAria: "象棋棋盘"/);
    assert.match(script, /moveTree: "变化树"/);
    assert.match(script, /treeFit: "适配"/);
    assert.match(script, /suggests: "建议"/);
    assert.match(script, /move-label/);
    assert.match(script, /legalMovesSuffix/);
    assert.match(stylesheet, /\.file-labels/);
    assert.match(stylesheet, /\.selected-moves/);
    assert.match(stylesheet, /\.play-section/);
    assert.match(stylesheet, /\.command-panel/);
    assert.match(stylesheet, /\.tree-viewport/);
    assert.match(stylesheet, /\.move-tree-canvas/);
    assert.match(stylesheet, /\.move-tree-edges/);
    assert.match(stylesheet, /\.move-tree-edge-label/);
    assert.match(stylesheet, /\.move-tree-node-card/);
    assert.match(stylesheet, /\.mini-board/);
    assert.match(stylesheet, /\.move-tree-recompute/);
    assert.match(stylesheet, /\.tree-toolbar/);
    assert.match(stylesheet, /\.tree-panel/);
    assert.match(stylesheet, /\.tree-restore-button/);
    assert.match(stylesheet, /\.teaching-pair-grid/);
    assert.match(stylesheet, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(stylesheet, /\.teaching-pair-reasoning/);
    assert.match(stylesheet, /\.teaching-card\.pending/);
    assert.match(stylesheet, /\.teaching-card\.compact/);
    assert.match(stylesheet, /\.teaching-card/);
    assert.match(stylesheet, /\.board-wrap\.tree-preview/);
    assert.match(stylesheet, /\.move-label/);
    assert.match(stylesheet, /width: var\(--board-play-width\)/);
    assert.match(stylesheet, /--board-frame-width: calc\(100% - var\(--board-padding\) - var\(--board-padding\)\)/);
    assert.match(stylesheet, /inset: var\(--grid-inset-y\) var\(--grid-inset-x\)/);
    assert.match(stylesheet, /--grid-inset-x: calc\(100% \/ 18\)/);
    assert.match(stylesheet, /--grid-inset-y: calc\(100% \/ 20\)/);
    assert.match(stylesheet, /--edge-label-offset: clamp\(14px, 3\.6%, 20px\)/);
    assert.match(stylesheet, /grid-template-rows: minmax\(280px, 40vh\) minmax\(0, 1fr\)/);
    assert.match(stylesheet, /width: min\(100%, 270px\)/);
    assert.match(stylesheet, /--grid-files: 8/);
    assert.match(stylesheet, /--grid-ranks: 9/);
    assert.match(stylesheet, /--point-size: clamp\(24px, 8\.1%, 34px\)/);
    assert.match(stylesheet, /--piece-size: clamp\(22px, 80%, 30px\)/);
    assert.match(stylesheet, /--piece-font-size: 11px/);
    assert.match(stylesheet, /--piece-inner-inset: clamp\(4px, 13%, 6px\)/);
    assert.match(stylesheet, /\.turn-pill\.thinking/);
    assert.match(stylesheet, /\.piece-glyph/);
    assert.match(stylesheet, /width: 62%/);
    assert.match(stylesheet, /\.board-lines::before/);
    assert.match(stylesheet, /top: calc\(400% \/ 9\)/);
    assert.match(stylesheet, /--marker-size: clamp\(15px, 3\.4%, 22px\)/);
    assert.match(stylesheet, /--marker-arm: clamp\(5px, 1\.35%, 7px\)/);
    assert.match(stylesheet, /left: calc\(var\(--file\) \* \(100% \/ var\(--grid-files\)\)\)/);
    assert.match(stylesheet, /top: calc\(var\(--rank\) \* \(100% \/ var\(--grid-ranks\)\)\)/);
    assert.match(stylesheet, /left: calc\(var\(--file\) \* 100% \/ var\(--grid-files\)\)/);
    assert.match(stylesheet, /top: calc\(var\(--rank\) \* 100% \/ var\(--grid-ranks\)\)/);
    assert.match(stylesheet, /top: calc\(-100% \/ 18 - var\(--edge-label-offset\)\)/);
    assert.match(stylesheet, /transform: translate3d\(-50%, -50%, 0\)/);
    assert.match(stylesheet, /appearance: none/);
    assert.match(stylesheet, /height: auto/);
    assert.match(stylesheet, /aspect-ratio: 1/);
    assert.doesNotMatch(stylesheet, /0 0 0 6px rgba\(61, 35, 13, 0\.3\)/);
    assert.match(stylesheet, /\.board-grid-major/);
    assert.match(stylesheet, /\.board-palace-line/);
    assert.match(stylesheet, /vector-effect: non-scaling-stroke/);
    assert.match(stylesheet, /\.move-chip \.move-notation/);
    assert.match(stylesheet, /min-height: 0/);
    assert.doesNotMatch(stylesheet, /rotate\(180deg\)/);
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
      deferEngine: true
    });

    assert.equal(deferred.ok, true);
    assert.equal(deferred.state.history.length, 1);
    assert.equal(deferred.state.history[0].notation, "h7-e7");
    assert.equal(deferred.state.history[0].review.move, "h7-e7");
    assert.equal(deferred.state.lastPlayerReview.move, "h7-e7");
    assert.equal(deferred.state.teachingPair.playerMove.notation, "h7-e7");
    assert.equal(deferred.state.teachingPair.id, "turn-1");
    assert.equal(deferred.state.teachingPair.playerReview.move, "h7-e7");
    assert.equal(deferred.state.teachingPair.engineMove, null);
    assert.equal(deferred.state.teachingPair.engineDecision, null);
    assert.equal(deferred.state.teachingPair.engineThinking, true);
    assert.equal(deferred.state.teachingTurns.length, 1);
    assert.equal(deferred.state.teachingTurns[0].id, "turn-1");
    assert.equal(deferred.state.teachingTurns[0].playerMove.notation, "h7-e7");
    assert.equal(deferred.state.teachingTurns[0].playerReview.move, "h7-e7");
    assert.equal(deferred.state.teachingTurns[0].engineMove, null);
    assert.equal(deferred.state.teachingTurns[0].engineDecision, null);
    assert.equal(deferred.state.teachingTurns[0].engineThinking, true);
    assert.equal(deferred.state.latestPlayerTeachingTurn.id, "turn-1");
    assert.equal(deferred.state.latestPlayerTeachingTurn.playerReview.move, "h7-e7");
    assert.equal(deferred.state.latestPlayerTeachingTurn.engineMove, null);
    assert.equal(deferred.state.latestPlayerTeachingTurn.engineThinking, true);
    assert.equal(deferred.state.teachingTurn.playerMove.notation, "h7-e7");
    assert.equal(deferred.state.teachingTurn.id, "turn-1");
    assert.equal(deferred.state.teachingTurn.playerReview.move, "h7-e7");
    assert.equal(deferred.state.teachingTurn.engineMove, null);
    assert.equal(deferred.state.teachingTurn.engineDecision, null);
    assert.equal(deferred.state.teachingTurn.engineThinking, true);
    assert.equal(deferred.state.turn, "black");
    assert.equal(deferred.state.playerTurn, false);

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
    assert.equal(created.state.teachingPair.id, "turn-engine-1");
    assert.equal(created.state.teachingPair.engineMove.notation, created.state.history[0].notation);
    assert.equal(created.state.playerTurn, true);

    const playerMove = created.state.legalMoves[0].notation;
    const deferred = await postJson(`${app.url}/api/move`, {
      sessionId,
      move: playerMove,
      deferEngine: true
    });

    assert.equal(deferred.state.history.length, 2);
    assert.equal(deferred.state.history[1].actor, "player");
    assert.equal(deferred.state.teachingTurns.length, 2);
    assert.equal(deferred.state.teachingTurns[1].id, "turn-2");
    assert.equal(deferred.state.teachingTurns[0].engineMove.notation, created.state.history[0].notation);
    assert.equal(deferred.state.teachingTurns[1].playerMove.notation, playerMove);
    assert.equal(deferred.state.teachingTurns[1].playerReview.move, playerMove);
    assert.equal(deferred.state.teachingTurns[1].engineMove, null);
    assert.equal(deferred.state.teachingTurns[1].engineThinking, true);
    assert.equal(deferred.state.latestPlayerTeachingTurn.id, "turn-2");
    assert.equal(deferred.state.latestPlayerTeachingTurn.playerMove.notation, playerMove);
    assert.equal(deferred.state.latestPlayerTeachingTurn.playerReview.move, playerMove);
    assert.equal(deferred.state.latestPlayerTeachingTurn.engineMove, null);
    assert.equal(deferred.state.teachingPair.playerMove.notation, playerMove);
    assert.equal(deferred.state.teachingPair.id, "turn-2");
    assert.equal(deferred.state.teachingPair.playerReview.move, playerMove);

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
    assert.equal(replied.state.teachingPair.id, "turn-2");
    assert.equal(replied.state.teachingPair.playerReview.move, playerMove);
    assert.equal(replied.state.teachingPair.engineMove.notation, replied.state.history[2].notation);
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
