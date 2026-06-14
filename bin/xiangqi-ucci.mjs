#!/usr/bin/env node
import readline from "node:readline";
import { UcciSession } from "../src/protocol/ucci.js";

const session = new UcciSession();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on("line", (line) => {
  const outputs = session.handleLine(line);
  for (const output of outputs) {
    console.log(output);
  }

  if (outputs.includes("bye")) {
    rl.close();
  }
});
