import {
  createEngine,
  createInitialPosition,
  formatBoard
} from "../src/index.js";

const position = createInitialPosition();
const engine = createEngine({ depth: 3, timeLimitMs: 1500 });
const result = engine.chooseMove(position);

console.log(formatBoard(position));
console.log("");
console.log(`Best move: ${result.bestMove.notation}`);
console.log(result.explanation.summary);
console.log("");
console.log("Why:");
for (const reason of result.explanation.reasons) {
  console.log(`- ${reason}`);
}
console.log("");
console.log(`Principal variation: ${result.explanation.principalVariationText}`);
console.log("");
console.log("Top candidates:");
for (const candidate of result.explanation.alternatives) {
  console.log(`${candidate.rank}. ${candidate.move} (${candidate.score}) ${candidate.note}`);
}

const reviewPosition = engine.play(position, "a9-a8");
const review = engine.reviewMove(reviewPosition, "a0-a1", { depth: 2, timeLimitMs: 500 });

console.log("");
console.log(`Review sample: ${review.move.notation}`);
console.log(review.explanation.summary);
for (const reason of review.explanation.reasons.slice(0, 3)) {
  console.log(`- ${reason}`);
}
