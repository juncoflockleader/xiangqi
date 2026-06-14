import test from "node:test";
import assert from "node:assert/strict";
import { UcciSession } from "../src/index.js";

test("UCCI session identifies itself", () => {
  const session = new UcciSession();
  const output = session.handleLine("ucci");

  assert.ok(output.some((line) => line.startsWith("id name")));
  assert.ok(output.some((line) => line.includes("MultiPV")));
  assert.ok(output.some((line) => line.includes("UseBook")));
  assert.ok(output.includes("ucciok"));
});

test("UCCI session searches a FEN position", () => {
  const session = new UcciSession({ depth: 2, timeLimitMs: 1000 });
  session.handleLine("position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const output = session.handleLine("go depth 2 movetime 1000");

  assert.ok(output.some((line) => line.startsWith("info depth 2 score cp")));
  assert.ok(output.some((line) => line.includes("nodes")));
  assert.ok(output.includes("bestmove e9e2"));
  assert.ok(output.some((line) => line.includes("reason: Wins a rook")));
});

test("UCCI go uses the opening book from startpos by default", () => {
  const session = new UcciSession({ depth: 2, timeLimitMs: 1000 });
  session.handleLine("position startpos");
  const output = session.handleLine("go depth 2 movetime 1000");

  assert.ok(output.some((line) => line.includes("book Central Cannon")));
  assert.ok(output.includes("bestmove h7e7"));
});

test("UCCI UseBook option disables book selection", () => {
  const session = new UcciSession({ depth: 1, timeLimitMs: 500 });
  session.handleLine("setoption name UseBook value false");
  session.handleLine("position startpos");
  const output = session.handleLine("go depth 1 movetime 500");

  assert.equal(output.some((line) => line.includes("book Central Cannon")), false);
  assert.ok(output.some((line) => line.startsWith("info depth 1")));
});

test("UCCI book command lists available opening entries", () => {
  const session = new UcciSession();
  session.handleLine("position startpos");
  const output = session.handleLine("book");

  assert.ok(output.some((line) => line.includes("h7-e7 Central Cannon")));
});

test("UCCI analyze returns multiple principal variations", () => {
  const session = new UcciSession({ depth: 2, timeLimitMs: 1000 });
  session.handleLine("position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const output = session.handleLine("analyze depth 2 movetime 1000 lines 2");

  assert.ok(output.some((line) => line.startsWith("info multipv 1 depth 2")));
  assert.ok(output.some((line) => line.startsWith("info multipv 2 depth 2")));
  assert.ok(output.some((line) => line.includes("line 1 reason:")));
  assert.ok(output.includes("bestmove e9e2"));
});

test("UCCI go multipv delegates to analysis output", () => {
  const session = new UcciSession({ depth: 1, timeLimitMs: 500 });
  session.handleLine("position startpos");
  const output = session.handleLine("go depth 1 movetime 500 multipv 3");

  assert.equal(output.filter((line) => line.startsWith("info multipv ")).length, 3);
  assert.ok(output.some((line) => line.startsWith("bestmove ")));
});

test("UCCI MultiPV option changes default go output", () => {
  const session = new UcciSession({ depth: 1, timeLimitMs: 500 });
  session.handleLine("setoption name MultiPV value 2");
  session.handleLine("position startpos");
  const output = session.handleLine("go depth 1 movetime 500");

  assert.equal(output.filter((line) => line.startsWith("info multipv ")).length, 2);
});

test("UCCI banmoves excludes a root move", () => {
  const session = new UcciSession({ depth: 2, timeLimitMs: 1000 });
  session.handleLine("position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  session.handleLine("banmoves e9e2");
  const output = session.handleLine("go depth 2 movetime 1000");

  assert.ok(output.some((line) => line.startsWith("bestmove ")));
  assert.equal(output.includes("bestmove e9e2"), false);
});

test("UCCI position startpos accepts moves", () => {
  const session = new UcciSession({ depth: 1, timeLimitMs: 200 });
  const output = session.handleLine("position startpos moves a9a8 a0a1");

  assert.deepEqual(output, []);
  assert.ok(session.position);
});

test("UCCI pressure reports immediate threats", () => {
  const session = new UcciSession({ depth: 1, timeLimitMs: 500 });
  session.handleLine("position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const output = session.handleLine("pressure limit 1");

  assert.ok(output.some((line) => line.includes("pressure side red")));
  assert.ok(output.some((line) => line.includes("threat e9e2") || line.includes("threat e9-e2")));
  assert.ok(output.some((line) => line.includes("opponent-threat")));
});

test("UCCI review summarizes loaded move history", () => {
  const session = new UcciSession({ depth: 1, timeLimitMs: 500 });
  session.handleLine("position startpos moves h7e7 h0g2");
  const output = session.handleLine("review depth 1 movetime 500");

  assert.ok(output.some((line) => line.includes("review moves 2")));
  assert.ok(output.some((line) => line.includes("book 2")));
});

test("UCCI review reports no moves when history is empty", () => {
  const session = new UcciSession();
  session.handleLine("position startpos");

  assert.deepEqual(session.handleLine("review"), ["info string review no moves"]);
});
