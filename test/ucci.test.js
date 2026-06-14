import test from "node:test";
import assert from "node:assert/strict";
import { UcciSession } from "../src/index.js";

test("UCCI session identifies itself", () => {
  const session = new UcciSession();
  const output = session.handleLine("ucci");

  assert.ok(output.some((line) => line.startsWith("id name")));
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
