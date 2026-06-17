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
    assert.match(page, /role="tree"/);
    assert.match(script, /function renderBoard/);
    assert.match(script, /function buildMoveTree/);
    assert.match(script, /function renderMainlineTreeNode/);
    assert.match(script, /function boardCellsForTreeSelection/);
    assert.match(script, /node\.alternative\.boardAfter/);
    assert.match(script, /t\("variationPreview"\)/);
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
    assert.match(script, /className = "turn-pill thinking"/);
    assert.match(script, /traditionalChineseMap/);
    assert.match(script, /function moveLabelText/);
    assert.match(script, /function moveTitleText/);
    assert.match(script, /moveLabel\.textContent = moveLabelText/);
    assert.match(script, /aria-label="\$\{escapeHtml\(label\)\}"/);
    assert.match(script, /boardAria: "象棋棋盘"/);
    assert.match(script, /moveTree: "变化树"/);
    assert.match(script, /suggests: "建议"/);
    assert.match(script, /move-label/);
    assert.match(script, /legalMovesSuffix/);
    assert.match(stylesheet, /\.file-labels/);
    assert.match(stylesheet, /\.selected-moves/);
    assert.match(stylesheet, /\.move-tree-list/);
    assert.match(stylesheet, /\.move-tree-branches/);
    assert.match(stylesheet, /\.tree-restore-button/);
    assert.match(stylesheet, /\.board-wrap\.tree-preview/);
    assert.match(stylesheet, /\.move-label/);
    assert.match(stylesheet, /width: var\(--board-play-width\)/);
    assert.match(stylesheet, /--board-frame-width: calc\(100% - var\(--board-padding\) - var\(--board-padding\)\)/);
    assert.match(stylesheet, /inset: var\(--grid-inset-y\) var\(--grid-inset-x\)/);
    assert.match(stylesheet, /--grid-inset-x: calc\(100% \/ 18\)/);
    assert.match(stylesheet, /--grid-inset-y: calc\(100% \/ 20\)/);
    assert.match(stylesheet, /--edge-label-offset: clamp\(14px, 3\.6%, 20px\)/);
    assert.match(stylesheet, /width: min\(100%, 700px, calc\(\(100vh - 112px\) \* 0\.9\)\)/);
    assert.match(stylesheet, /--grid-files: 8/);
    assert.match(stylesheet, /--grid-ranks: 9/);
    assert.match(stylesheet, /--point-size: clamp\(31px, 8\.7%, 43px\)/);
    assert.match(stylesheet, /--piece-size: clamp\(30px, 88%, 38px\)/);
    assert.match(stylesheet, /--piece-font-size: 12\.5px/);
    assert.match(stylesheet, /--piece-inner-inset: clamp\(5px, 15%, 7px\)/);
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
    if (moved.state.lastPlayerReview.planComparison) {
      assert.equal(typeof moved.state.lastPlayerReview.planComparison.zhSummary, "string");
    }
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
