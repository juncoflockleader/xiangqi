import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialPosition,
  importGameMoveText,
  parseGameMoveText,
  parsePortableMoveNotation,
  parseWesternMoveNotation
} from "../src/index.js";

const HU_GAME_COORDINATES = Object.freeze([
  "h7-e7", "h0-g2",
  "h9-g7", "g3-g4",
  "b9-c7", "i0-h0",
  "b7-a7", "b0-c2",
  "a9-b9", "a0-b0",
  "i9-h9", "c3-c4",
  "b9-b5", "g0-e2",
  "c6-c5", "c4-c5",
  "b5-c5", "c2-d4",
  "e6-e5", "h2-h4"
]);

test("western Xiangqi notation resolves against legal moves", () => {
  const position = createInitialPosition();
  const red = parseWesternMoveNotation(position, "C2=5");

  assert.equal(red.notation, "h7-e7");
  assert.throws(
    () => parseWesternMoveNotation(position, "R2=5"),
    /No legal move matches/
  );
});

test("game move text imports Xiangqi.com western notation", () => {
  const text = `
    1.C2=5 n8+7 2.N2+3 p7+1 3.N8+7 r9=8
    4.C8=9 n2+3 5.R9=8 r1=2 6.R1=2 p3+1
    7.R8+4 b7+5 8.P7+1 p3+1 9.R8=7 n3+4
    10.P5+1 c8+2
  `;

  assert.deepEqual(parseGameMoveText(text), HU_GAME_COORDINATES);
});

test("game move text imports compressed Xiangqi.com move lists", () => {
  const text = "1.C2=5n8+72.N2+3p7+13.N8+7r9=84.C8=9n2+35.R9=8r1=26.R1=2p3+17.R8+4b7+58.P7+1p3+19.R8=7n3+410.P5+1c8+2";

  assert.deepEqual(parseGameMoveText(text), HU_GAME_COORDINATES);
});

test("structured game move import preserves metadata and diagnostics", () => {
  const imported = importGameMoveText(`
    [Event "Hu bot sparring"]
    Site: Xiangqi.com
    Round: test
    1. C2=5 {central cannon} n8+7
    2. N2+3 p7+1 result *
  `);

  assert.deepEqual(imported.moves, ["h7-e7", "h0-g2", "h9-g7", "g3-g4"]);
  assert.equal(imported.metadata.Event, "Hu bot sparring");
  assert.equal(imported.metadata.Site, "Xiangqi.com");
  assert.equal(imported.metadata.Round, "test");
  assert.equal(imported.tokens[0].token, "C2=5");
  assert.equal(imported.tokens[0].notation, "h7-e7");
  assert.equal(imported.tokens[0].side, "red");
  assert.ok(imported.diagnostics.some((diagnostic) => diagnostic.kind === "comment" && diagnostic.text === "central cannon"));
  assert.ok(imported.diagnostics.some((diagnostic) => diagnostic.kind === "skipped-token" && diagnostic.token === "result"));
  assert.match(imported.finalFen, / r$/);
});

test("structured game move import accepts JSON metadata", () => {
  const imported = importGameMoveText(JSON.stringify({
    event: "JSON Game",
    metadata: {
      source: "fixture"
    },
    moves: ["h7-e7", "h0-g2"]
  }));

  assert.deepEqual(imported.moves, ["h7-e7", "h0-g2"]);
  assert.equal(imported.metadata.event, "JSON Game");
  assert.equal(imported.metadata.source, "fixture");
  assert.equal(imported.diagnostics.length, 0);
});

test("portable move notation also accepts coordinate notation", () => {
  const move = parsePortableMoveNotation(createInitialPosition(), "h7e7");

  assert.equal(move.notation, "h7-e7");
  assert.deepEqual(parseGameMoveText(["h7-e7", "h0-g2"]), ["h7-e7", "h0-g2"]);
});
