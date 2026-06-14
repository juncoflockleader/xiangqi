import {
  createEngine,
  createInitialPosition,
  formatBoard
} from "../src/index.js";

const position = createInitialPosition();
const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
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

const offBookOpening = engine.play(position, "a9-a8");
const heuristicOpening = engine.chooseMove(offBookOpening);
console.log("");
console.log(`Opening fallback: ${heuristicOpening.bestMove.notation}`);
console.log(heuristicOpening.explanation.summary);

const analysis = engine.analyzePosition(position, { lines: 3, depth: 2, timeLimitMs: 2000 });
console.log("");
console.log("Analysis lines:");
for (const line of analysis.lines) {
  console.log(`${line.rank}. ${line.move.notation} ${line.explanation.summary}`);
}
console.log(`Search stats: ${analysis.nodes} nodes, ${analysis.stats.qnodes} qnodes, ${analysis.stats.qchecks} quiet checks, ${analysis.stats.ttStores} TT stores, ${analysis.stats.ttEvictions} TT evictions, ${analysis.stats.aspirationSearches} aspiration searches, ${analysis.stats.futilityPrunes} futility prunes, ${analysis.stats.pvsResearches} PVS re-searches, ${analysis.stats.nullMovePrunes} null-move prunes`);
const latestIteration = analysis.explanation.search.iterations.at(-1);
if (latestIteration) {
  const stability = latestIteration.stableBestMove === null ? "initial pick" : latestIteration.stableBestMove ? "stable" : "changed";
  console.log(`Depth trace: depth ${latestIteration.depth} best ${latestIteration.bestMove} (${stability})`);
}

const hint = engine.coachMove(position, { depth: 2, timeLimitMs: 1000 });
console.log("");
console.log("Coach hint ladder:");
for (const level of hint.levels) {
  console.log(`${level.level}. ${level.title}: ${level.text}`);
}

const pressure = engine.pressure(position, { limit: 2 });
console.log("");
console.log("Immediate pressure:");
for (const threat of pressure.threats) {
  console.log(`- ${threat.summary}`);
}

const reviewPosition = engine.play(position, "a9-a8");
const review = engine.reviewMove(reviewPosition, "a0-a1", { depth: 2, timeLimitMs: 500 });

console.log("");
console.log(`Review sample: ${review.move.notation}`);
console.log(review.explanation.summary);
for (const reason of review.explanation.reasons.slice(0, 3)) {
  console.log(`- ${reason}`);
}

const gameReview = engine.reviewGame(["h7-e7", "h0-g2"], {
  reviewOptions: { depth: 1, timeLimitMs: 500 }
});
console.log("");
console.log(`Game review: ${gameReview.summary.totalMoves} moves, ${gameReview.summary.bookMoves} book moves`);
for (const moment of gameReview.keyMoments.slice(0, 2)) {
  console.log(`- ${moment.side} ${moment.notation}: ${moment.summary}`);
}

const lesson = engine.lessonPlan(["h7-e7", "h0-g2"], {
  reviewOptions: { depth: 1, timeLimitMs: 500 },
  lessonOptions: { maxCards: 1 }
});
const firstCard = lesson.cards[0];
if (firstCard) {
  console.log("");
  console.log(`Lesson card: ${firstCard.title}`);
  console.log(firstCard.prompt);
  console.log(`Answer: ${firstCard.answer.move}`);
}
