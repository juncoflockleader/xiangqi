import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialPosition,
  lineToChineseNotation,
  moveToChineseNotation
} from "../src/index.js";

test("Chinese notation formats opening moves from each side's perspective", () => {
  const position = createInitialPosition();

  assert.equal(moveToChineseNotation(position, "h7-e7"), "炮二平五");
  assert.equal(moveToChineseNotation(position, "h0-g2"), "馬8進7");
  assert.equal(moveToChineseNotation(position, "h9-g7"), "傌二進三");
  assert.equal(moveToChineseNotation(position, "a6-a5"), "兵九進一");
  assert.equal(moveToChineseNotation(position, "a3-a4"), "卒1進1");
});

test("Chinese notation can follow a principal variation", () => {
  const position = createInitialPosition();

  assert.deepEqual(
    lineToChineseNotation(position, ["h7-e7", "h0-g2"]),
    ["炮二平五", "馬8進7"]
  );
});
