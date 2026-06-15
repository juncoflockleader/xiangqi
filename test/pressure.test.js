import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzePressure,
  analyzeThreats,
  createEngine,
  parseFen,
  topThreat
} from "../src/index.js";

test("threat analysis finds clean material threats", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const threats = analyzeThreats(position);

  assert.equal(threats[0].notation, "e9-e2");
  assert.ok(threats[0].summary.includes("wins a rook"));
  assert.ok(threats[0].motifs.includes("safe capture"));
});

test("pressure analysis reports both sides", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const pressure = analyzePressure(position);

  assert.equal(pressure.side, "red");
  assert.equal(pressure.inCheck, false);
  assert.ok(pressure.threats.length > 0);
  assert.ok(pressure.opponentThreats.length > 0);
});

test("topThreat returns null when there is no immediate forcing move", () => {
  const position = parseFen("4k4/9/9/9/9/9/9/9/9/3K5 r");

  assert.equal(topThreat(position), null);
});

test("engine pressure API and explanations surface immediate threats", () => {
  const position = parseFen("4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const pressure = engine.pressure(position);
  const result = engine.chooseMove(position);

  assert.equal(pressure.threats[0].notation, "e9-e2");
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("immediate threat")));
});

test("pressure describes attacks on the general without material language", () => {
  const position = parseFen("4k4/9/4R4/9/9/9/9/9/9/3K5 r");
  const threat = topThreat(position);

  assert.equal(threat.notation, "e2-e0");
  assert.ok(threat.summary.includes("opposing general"));
  assert.equal(threat.summary.includes("wins a general"), false);
});

test("pressure labels discovered checks as a tactical motif", () => {
  const position = parseFen("4k4/9/9/9/4P4/9/4R4/9/9/4K4 r");
  const threat = topThreat(position);

  assert.equal(threat.notation, "e4-d4");
  assert.ok(threat.motifs.includes("discovered check"));
  assert.ok(threat.summary.includes("uncovers a rook check"));
});

test("pressure labels skewers as a tactical motif", () => {
  const position = parseFen("4r4/9/4k4/9/3R5/9/4P4/9/9/4K4 r");
  const threat = topThreat(position);

  assert.equal(threat.notation, "d4-e4");
  assert.ok(threat.motifs.includes("skewer"));
  assert.ok(threat.summary.includes("skewers the general"));
});
