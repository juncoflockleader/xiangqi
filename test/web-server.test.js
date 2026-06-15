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
    const created = await postJson(`${app.url}/api/new`, { side: "red" });

    assert.match(page, /<main class="app-shell"/);
    assert.match(script, /function renderBoard/);
    assert.equal(created.ok, true);
    assert.equal(created.state.playerSide, "red");
    assert.equal(created.state.engineSide, "black");
    assert.equal(created.state.board.length, 90);
    assert.equal(created.state.playerTurn, true);
    assert.ok(created.state.legalMoves.some((move) => move.notation === "h7-e7"));
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
    assert.ok(best.best.alternatives.length >= 1);
    assert.equal(hint.ok, true);
    assert.ok(hint.hint.levels.length >= 1);
    assert.equal(moved.ok, true);
    assert.equal(moved.state.history[0].notation, "h7-e7");
    assert.equal(moved.state.history.length, 2);
    assert.equal(moved.state.playerTurn, true);
    assert.equal(moved.state.lastPlayerReview.move, "h7-e7");
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
