import {
  createInitialPosition,
  perft,
  perftDivide
} from "../src/index.js";

const depth = Number.parseInt(process.argv[2] ?? "2", 10);
const position = createInitialPosition();
const divide = perftDivide(position, depth);

console.log(`Initial position perft(${depth}) = ${perft(position, depth)}`);
for (const entry of divide.slice(0, 12)) {
  console.log(`${entry.notation}: ${entry.nodes}`);
}

if (divide.length > 12) {
  console.log(`... ${divide.length - 12} more moves`);
}
