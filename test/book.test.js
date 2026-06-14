import test from "node:test";
import assert from "node:assert/strict";
import {
  createEngine,
  createInitialPosition,
  createOpeningBookFromCsv,
  createOpeningBookFromRecords,
  createOpeningBookFromText,
  DEFAULT_OPENING_BOOK,
  lookupOpeningBook,
  mergeOpeningBooks,
  parseOpeningBookCsv,
  positionKey
} from "../src/index.js";

test("opening book returns legal annotated entries from the initial position", () => {
  const position = createInitialPosition();
  const book = lookupOpeningBook(position);

  assert.ok(book);
  assert.equal(book.entry.name, "Central Cannon");
  assert.equal(book.move.notation, "h7-e7");
  assert.ok(book.entries.length >= 3);
});

test("engine chooses and explains opening book moves by default", () => {
  const position = createInitialPosition();
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const result = engine.chooseMove(position);

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "h7-e7");
  assert.equal(result.depth, 0);
  assert.ok(result.explanation.summary.includes("book move"));
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("Opening book")));
  assert.ok(result.explanation.confidence.score >= 45);
  assert.ok(result.explanation.confidence.factors.some((factor) => factor.kind === "book"));
  assert.equal(result.explanation.linePlan.firstMove, "h7-e7");
  assert.equal(result.explanation.linePlan.moves[0].role, "opening-choice");
});

test("opening book can be disabled for pure search", () => {
  const position = createInitialPosition();
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const result = engine.chooseMove(position, { useBook: false, depth: 1, timeLimitMs: 500 });

  assert.notEqual(result.source, "opening-book");
  assert.ok(result.depth >= 1);
});

test("opening book respects banned moves", () => {
  const position = createInitialPosition();
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const result = engine.chooseMove(position, {
    bannedMoves: ["h7-e7"]
  });

  assert.equal(result.source, "opening-book");
  assert.notEqual(result.bestMove.notation, "h7-e7");
});

test("opening book handles the next move in a known line", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const position = engine.play(createInitialPosition(), "h7-e7");
  const result = engine.chooseMove(position);

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "h0-g2");
});

test("opening book follows named deeper central cannon lines", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  let position = createInitialPosition();
  for (const move of ["h7-e7", "h0-g2", "h9-g7"]) {
    position = engine.play(position, move);
  }

  const result = engine.chooseMove(position);

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "b0-c2");
  assert.equal(result.book.name, "Double Screen Horses");
});

test("opening heuristics cover early positions outside exact book", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const position = engine.play(createInitialPosition(), "a9-a8");
  const result = engine.chooseMove(position);

  assert.equal(result.source, "opening-heuristic");
  assert.ok(["b0-c2", "h0-g2"].includes(result.bestMove.notation));
  assert.ok(result.book.tags.includes("heuristic"));
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("Opening heuristic")));
});

test("opening book can be imported from weighted text lines", () => {
  const imported = createOpeningBookFromText(`
    h9g7 h0g2 | weight=4 | name=Imported Horse System | tags=database,horse | idea=Imported games prefer quick horse development.
    h9-g7 b0-c2 | count=2 | name=Imported Horse System | tags=database,horse
    h7-e7 h0-g2 | weight=1 | name=Imported Central Cannon
  `);
  const engine = createEngine({ book: imported, openingHeuristics: false, depth: 1, timeLimitMs: 500 });
  const position = createInitialPosition();
  const result = engine.chooseMove(position);

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "h9-g7");
  assert.equal(result.book.weight, 6);
  assert.ok(result.book.tags.includes("imported"));
  assert.ok(result.book.tags.includes("database"));

  const afterHorse = engine.play(position, "h9-g7");
  const reply = engine.openingBook(afterHorse, { openingHeuristics: false });
  assert.equal(reply.bestMove?.notation ?? reply.move.notation, "h0-g2");
  assert.equal(reply.entries[0].weight, 4);
  assert.equal(reply.entries[1].weight, 2);
});

test("imported opening data can merge with the curated default book", () => {
  const imported = createOpeningBookFromText(`
    b9-c7 | games=45 | name=Imported Left Horse Popularity | tags=database
  `);
  const merged = mergeOpeningBooks(DEFAULT_OPENING_BOOK, imported);
  const engine = createEngine({ book: merged, depth: 1, timeLimitMs: 500 });
  const result = engine.chooseMove(createInitialPosition());

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "b9-c7");
  assert.equal(result.book.weight, 127);
  assert.ok(result.book.tags.includes("database"));
});

test("structured opening records preserve database priors for explanations", () => {
  const imported = createOpeningBookFromRecords([
    {
      moves: ["h7-e7"],
      games: 80,
      redWinRate: 0.68,
      drawRate: 0.2,
      blackWinRate: 0.12,
      engineScore: 32,
      source: "sample-master-db",
      year: 2026,
      name: "Database Central Cannon",
      tags: ["master"]
    },
    {
      moves: ["b9-c7"],
      games: 90,
      redWinRate: 0.4,
      drawRate: 0.2,
      blackWinRate: 0.4,
      name: "Database Horse Opening"
    }
  ]);
  const engine = createEngine({ book: imported, openingHeuristics: false, depth: 1, timeLimitMs: 500 });
  const result = engine.chooseMove(createInitialPosition());

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "h7-e7");
  assert.equal(result.book.database.games, 80);
  assert.equal(Math.round(result.book.database.expectedScore * 100), 78);
  assert.ok(result.book.database.summary.includes("80 database games"));
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("sample-master-db")));
  assert.ok(result.explanation.confidence.factors.some((factor) => factor.kind === "database-games"));
  assert.ok(result.book.tags.includes("master"));
});

test("structured opening lines weight replies for the side to move", () => {
  const imported = createOpeningBookFromRecords([
    {
      moves: ["h7-e7", "h0-g2"],
      games: 100,
      redWinRate: 0.62,
      drawRate: 0.18,
      blackWinRate: 0.2,
      name: "Central Cannon Red-Favored Line"
    },
    {
      moves: ["h7-e7", "b0-c2"],
      games: 90,
      redWinRate: 0.3,
      drawRate: 0.2,
      blackWinRate: 0.5,
      name: "Central Cannon Black-Resilient Line"
    }
  ]);
  const engine = createEngine({ book: imported, openingHeuristics: false, depth: 1, timeLimitMs: 500 });
  const afterCentralCannon = engine.play(createInitialPosition(), "h7-e7");
  const reply = engine.openingBook(afterCentralCannon);

  assert.equal(reply.move.notation, "b0-c2");
  assert.equal(reply.entry.name, "Central Cannon Black-Resilient Line");
  assert.equal(Math.round(reply.entry.database.expectedScore * 100), 60);
  assert.ok(reply.entry.weight > reply.entries.find((entry) => entry.notation === "h0-g2").weight);
});

test("structured opening records can target a specific FEN position", () => {
  const helper = createEngine({ depth: 1, timeLimitMs: 500 });
  const afterCentralCannon = helper.play(createInitialPosition(), "h7-e7");
  const imported = createOpeningBookFromRecords([
    {
      fen: positionKey(afterCentralCannon),
      move: "b0-c2",
      games: 40,
      redWinRate: 0.28,
      drawRate: 0.2,
      blackWinRate: 0.52,
      source: "position-table",
      name: "Position Table Left Screen Horse"
    }
  ]);
  const engine = createEngine({ book: imported, openingHeuristics: false, depth: 1, timeLimitMs: 500 });
  const reply = engine.openingBook(afterCentralCannon);

  assert.equal(reply.move.notation, "b0-c2");
  assert.equal(reply.entry.database.side, "black");
  assert.equal(reply.entry.database.source, "position-table");
});

test("opening database CSV imports weighted lines with column aliases", () => {
  const imported = createOpeningBookFromCsv(`
    moves,games,red_win_rate,draw_rate,black_win_rate,cp,source,name,tags
    "h7-e7 h0-g2",120,0.62,0.2,0.18,24,master-csv,"CSV Central Cannon","database,csv,cannon"
    "b9-c7 h0-g2",80,0.45,0.22,0.33,0,master-csv,"CSV Horse Opening","database,csv,horse"
  `);
  const engine = createEngine({ book: imported, openingHeuristics: false, depth: 1, timeLimitMs: 500 });
  const result = engine.chooseMove(createInitialPosition());

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "h7-e7");
  assert.equal(result.book.name, "CSV Central Cannon");
  assert.equal(result.book.database.source, "master-csv");
  assert.equal(Math.round(result.book.database.expectedScore * 100), 72);
  assert.ok(result.book.tags.includes("csv"));

  const reply = engine.openingBook(engine.play(createInitialPosition(), "h7-e7"));
  assert.equal(reply.move.notation, "h0-g2");
  assert.equal(reply.entry.database.side, "black");
});

test("opening database parser auto-detects TSV exports", () => {
  const records = parseOpeningBookCsv([
    "line\tgames\tblack_win_rate\tdraw_rate\tred_win_rate\tname",
    "h7-e7 b0-c2\t90\t0.5\t0.2\t0.3\tTSV Screen Horse"
  ].join("\n"));

  assert.equal(records.length, 1);
  assert.equal(records[0].moves, "h7-e7 b0-c2");
  assert.equal(records[0].blackWinRate, "0.5");
  assert.equal(records[0].drawRate, "0.2");
  assert.equal(records[0].name, "TSV Screen Horse");
});
