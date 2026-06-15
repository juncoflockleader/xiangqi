import test from "node:test";
import assert from "node:assert/strict";
import { startWebServer } from "../examples/web-server.mjs";

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

    assert.match(page, /<main class="app-shell"/);
    assert.match(page, /楚河/);
    assert.match(page, /漢界/);
    assert.match(page, /file-labels-north/);
    assert.match(page, />九</);
    assert.match(page, /id="localeSelect"/);
    assert.match(script, /function renderBoard/);
    assert.match(script, /function intersectionPercent/);
    assert.match(script, /move-label/);
    assert.match(stylesheet, /\.file-labels/);
    assert.match(stylesheet, /\.move-label/);
    assert.match(stylesheet, /min-height: 0/);
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

    assert.equal(best.ok, true);
    assert.equal(typeof best.best.bestMove, "string");
    assert.equal(typeof best.best.zhBestMove, "string");
    assert.equal(typeof best.best.zhReasons[0], "string");
    assert.ok(best.best.alternatives.length >= 1);
    assert.equal(typeof best.best.alternatives[0].zhMove, "string");
    assert.equal(hint.ok, true);
    assert.ok(hint.hint.levels.length >= 1);
    assert.ok(hint.hint.zhLevels.some((level) => /最佳著法|候選|局面/.test(level.title + level.text)));
    assert.equal(typeof hint.hint.zhBestMove, "string");
    assert.equal(moved.ok, true);
    assert.equal(moved.state.history[0].notation, "h7-e7");
    assert.equal(moved.state.history[0].zhNotation, "炮二平五");
    assert.equal(typeof moved.state.history[1].zhNotation, "string");
    assert.equal(moved.state.history.length, 2);
    assert.equal(moved.state.playerTurn, true);
    assert.equal(moved.state.lastPlayerReview.move, "h7-e7");
    assert.equal(moved.state.lastPlayerReview.zhMove, "炮二平五");
    assert.equal(undone.ok, true);
    assert.equal(undone.state.history.length, 0);
    assert.equal(undone.state.playerTurn, true);
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
