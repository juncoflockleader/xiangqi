import test from "node:test";
import assert from "node:assert/strict";
import {
  createEngine,
  createInitialPosition,
  createOpeningBookFromCsv,
  createOpeningBookFromGames,
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
  assert.equal(result.book.name, "Pikafish best: h0-g2");
});

test("opening book follows oracle-generated deeper central cannon lines", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  let position = createInitialPosition();
  for (const move of ["h7-e7", "h0-g2", "h9-g7"]) {
    position = engine.play(position, move);
  }

  const result = engine.chooseMove(position);

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "g3-g4");
  assert.equal(result.book.name, "Pikafish best: g3-g4");
  assert.ok(result.book.tags.includes("pikafish"));
  assert.equal(result.book.database.source, "Pikafish");
  assert.ok(result.book.idea.includes("depth 8"));
  assert.deepEqual(
    result.bookAlternatives.slice(0, 4).map((entry) => entry.move.notation),
    ["g3-g4", "i0-h0", "c3-c4", "b0-c2"]
  );
});

test("opening book includes generated Pikafish early-pawn alternatives", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const result = engine.chooseMove(createInitialPosition(), {
    bannedMoves: ["h7-e7"]
  });

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "g6-g5");
  assert.equal(result.book.name, "Pikafish candidate 2: g6-g5");
  assert.equal(result.book.database.source, "Pikafish");
  assert.equal(result.book.database.engineScore, 27);
});

test("opening book follows the generated central cannon pawn-push branch", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  let position = createInitialPosition();
  for (const move of ["h7-e7", "h0-g2", "g6-g5"]) {
    position = engine.play(position, move);
  }

  const result = engine.chooseMove(position);

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "h2-i2");
  assert.equal(result.book.name, "Pikafish best: h2-i2");
  assert.equal(result.book.database.engineScore, -18);
  assert.deepEqual(
    result.bookAlternatives.slice(0, 3).map((entry) => entry.move.notation),
    ["h2-i2", "i0-h0", "c3-c4"]
  );
});

test("opening book refreshes the central cannon screen-horse reply with Pikafish pawn push", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  let position = createInitialPosition();
  for (const move of ["h7-e7", "h0-g2"]) {
    position = engine.play(position, move);
  }

  const result = engine.chooseMove(position);

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "g6-g5");
  assert.equal(result.book.name, "Pikafish best: g6-g5");
  assert.equal(result.book.database.engineScore, 22);
  assert.deepEqual(
    result.bookAlternatives.slice(0, 3).map((entry) => entry.move.notation),
    ["g6-g5", "h9-g7", "b7-d7"]
  );
});

test("opening book extends the refreshed central cannon pawn-push continuation", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  let position = createInitialPosition();
  for (const move of ["h7-e7", "h0-g2", "g6-g5", "h2-i2"]) {
    position = engine.play(position, move);
  }

  const result = engine.chooseMove(position);

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "b9-c7");
  assert.equal(result.book.name, "Pikafish best: b9-c7");
  assert.equal(result.book.database.engineScore, 25);
});

test("opening book covers generated early-pawn side branches", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  let position = createInitialPosition();
  for (const move of ["g6-g5", "h2-g2"]) {
    position = engine.play(position, move);
  }

  const cannonSide = engine.chooseMove(position);
  assert.equal(cannonSide.source, "opening-book");
  assert.equal(cannonSide.bestMove.notation, "c9-e7");
  assert.equal(cannonSide.book.name, "Pikafish best: c9-e7");
  assert.equal(cannonSide.book.database.engineScore, 27);

  position = createInitialPosition();
  for (const move of ["g6-g5", "c3-c4"]) {
    position = engine.play(position, move);
  }

  const pawnChallenge = engine.chooseMove(position);
  assert.equal(pawnChallenge.source, "opening-book");
  assert.equal(pawnChallenge.bestMove.notation, "b9-a7");
  assert.equal(pawnChallenge.book.name, "Pikafish best: b9-a7");
  assert.equal(pawnChallenge.book.database.engineScore, 34);
});

test("opening book covers the c3-c4 central cannon candidate branch", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  let position = createInitialPosition();
  for (const move of ["h7-e7", "h0-g2", "h9-g7", "c3-c4"]) {
    position = engine.play(position, move);
  }

  const result = engine.chooseMove(position);

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "b9-a7");
  assert.equal(result.book.name, "Pikafish best: b9-a7");
  assert.equal(result.book.database.engineScore, 27);
});

test("opening book follows Pikafish principal-variation continuations past exact oracle nodes", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  let position = createInitialPosition();
  for (const move of ["h7-e7", "h0-g2", "h9-g7", "g3-g4", "i9-h9"]) {
    position = engine.play(position, move);
  }

  const result = engine.chooseMove(position, { openingHeuristics: false });

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "i0-h0");
  assert.equal(result.book.name, "Pikafish PV continuation: i0-h0");
  assert.ok(result.book.tags.includes("pv-continuation"));
  assert.equal(result.book.database.source, "Pikafish");
  assert.equal(result.book.database.sourceMove, "g3-g4");
  assert.equal(result.book.database.principalVariation, "g3-g4 i9-h9 i0-h0 h9-h5 h2-i2");
});

test("opening heuristics cover early positions outside exact book when requested raw", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const position = engine.play(createInitialPosition(), "a9-a8");
  const result = engine.chooseMove(position, { validateOpeningHeuristics: false });

  assert.equal(result.source, "opening-heuristic");
  assert.ok(["b0-c2", "h0-g2"].includes(result.bestMove.notation));
  assert.ok(result.book.tags.includes("heuristic"));
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("Opening heuristic")));
});

test("opening heuristic validation rejects immediate tactical losses", () => {
  const engine = createEngine({ depth: 2, timeLimitMs: 2000 });
  const position = engine.play(createInitialPosition(), "a9-a8");
  const raw = engine.chooseMove(position, { validateOpeningHeuristics: false });
  const result = engine.chooseMove(position, {
    openingHeuristicValidationDepth: 1,
    openingHeuristicValidationTimeMs: 2000
  });

  assert.equal(raw.source, "opening-heuristic");
  assert.notEqual(result.source, "opening-heuristic");
  assert.equal(result.openingHeuristicValidation.status, "rejected");
  assert.equal(result.openingHeuristicValidation.heuristicMove, raw.bestMove.notation);
  assert.ok(result.openingHeuristicValidation.centipawnLoss > result.openingHeuristicValidation.maxCentipawnLoss);
});

test("opening heuristic validation avoids the Hu bot central cannon trap with no exact book", () => {
  const engine = createEngine({ book: {}, depth: 3, timeLimitMs: 4000 });
  let position = createInitialPosition();
  for (const move of ["h7-e7", "h0-g2", "h9-g7", "g3-g4", "b9-c7", "i0-h0"]) {
    position = engine.play(position, move);
  }

  const raw = engine.chooseMove(position, { validateOpeningHeuristics: false });
  const result = engine.chooseMove(position, {
    openingHeuristicValidationDepth: 2,
    openingHeuristicValidationTimeMs: 4000
  });

  assert.equal(raw.source, "opening-heuristic");
  assert.equal(raw.bestMove.notation, "e7-e3");
  assert.equal(result.openingHeuristicValidation.status, "rejected");
  assert.equal(result.openingHeuristicValidation.heuristicMove, "e7-e3");
  assert.notEqual(result.bestMove.notation, "e7-e3");
  assert.ok(result.openingHeuristicValidation.centipawnLoss > result.openingHeuristicValidation.maxCentipawnLoss);
  assert.ok(result.explanation.summary.includes(result.bestMove.notation));
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

test("opening book imports Chinese notation lines", () => {
  const imported = createOpeningBookFromText(`
    炮二平五 馬8進7 | weight=4 | name=Chinese Central Cannon | tags=database,zh
    傌二進三 馬8進7 | weight=7 | name=Chinese Horse Opening | tags=database,zh
  `);
  const engine = createEngine({ book: imported, openingHeuristics: false, depth: 1, timeLimitMs: 500 });
  const result = engine.chooseMove(createInitialPosition());
  const reply = engine.openingBook(engine.play(createInitialPosition(), "h9-g7"));

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "h9-g7");
  assert.equal(result.book.name, "Chinese Horse Opening");
  assert.ok(result.book.tags.includes("zh"));
  assert.equal(reply.move.notation, "h0-g2");
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

test("raw game records aggregate Chinese notation openings", () => {
  const book = createOpeningBookFromGames({
    source: "sample-zh-db",
    maxPly: 2,
    games: [
      { moves: "炮二平五馬8進7", result: "1-0" },
      { moves: "炮二平五 馬8進7", result: "1/2-1/2" },
      { moves: "傌二進三 馬8進7", result: "0-1" }
    ]
  });
  const engine = createEngine({ book, openingHeuristics: false, depth: 1, timeLimitMs: 500 });
  const root = engine.openingBook(createInitialPosition());
  const afterCentral = engine.openingBook(engine.play(createInitialPosition(), "h7-e7"));

  assert.equal(root.move.notation, "h7-e7");
  assert.equal(root.entry.database.games, 2);
  assert.equal(Math.round(root.entry.database.expectedScore * 100), 75);
  assert.equal(root.entry.database.source, "sample-zh-db");
  assert.equal(afterCentral.move.notation, "h0-g2");
  assert.equal(afterCentral.entry.database.side, "black");
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

test("structured opening records accept Chinese notation", () => {
  const imported = createOpeningBookFromRecords([
    {
      moves: "炮二平五 馬8進7",
      games: 100,
      redWinRate: 0.62,
      drawRate: 0.18,
      blackWinRate: 0.2,
      name: "Chinese Central Cannon Line"
    },
    {
      moves: "炮二平五 馬2進3",
      games: 90,
      redWinRate: 0.3,
      drawRate: 0.2,
      blackWinRate: 0.5,
      name: "Chinese Left Screen Horse"
    }
  ]);
  const engine = createEngine({ book: imported, openingHeuristics: false, depth: 1, timeLimitMs: 500 });
  const afterCentralCannon = engine.play(createInitialPosition(), "h7-e7");
  const reply = engine.openingBook(afterCentralCannon);

  assert.equal(reply.move.notation, "b0-c2");
  assert.equal(reply.entry.name, "Chinese Left Screen Horse");
  assert.equal(Math.round(reply.entry.database.expectedScore * 100), 60);
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

test("raw game records aggregate into opening-book database priors", () => {
  const book = createOpeningBookFromGames({
    source: "sample-game-db",
    maxPly: 2,
    games: [
      { moves: ["h9-g7", "h0-g2"], result: "1-0", year: 2025, tags: ["master"] },
      { moves: "h9-g7 h0-g2", result: "1/2-1/2", year: 2026 },
      { moves: ["h7-e7", "b0-c2"], result: "0-1", year: 2026 }
    ]
  });
  const engine = createEngine({ book, openingHeuristics: false, depth: 1, timeLimitMs: 500 });
  const root = engine.openingBook(createInitialPosition());
  const afterHorse = engine.openingBook(engine.play(createInitialPosition(), "h9-g7"));

  assert.equal(root.move.notation, "h9-g7");
  assert.equal(root.entry.database.games, 2);
  assert.equal(Math.round(root.entry.database.redWinRate * 100), 50);
  assert.equal(Math.round(root.entry.database.drawRate * 100), 50);
  assert.equal(Math.round(root.entry.database.expectedScore * 100), 75);
  assert.equal(root.entry.database.source, "sample-game-db");
  assert.ok(root.entry.database.summary.includes("2 database games"));
  assert.ok(root.entry.tags.includes("game-db"));
  assert.ok(root.entry.tags.includes("master"));
  assert.equal(afterHorse.move.notation, "h0-g2");
  assert.equal(afterHorse.entry.database.side, "black");
  assert.equal(afterHorse.entry.database.games, 2);
});

test("raw game opening aggregation can filter rare moves", () => {
  const book = createOpeningBookFromGames([
    { moves: ["h9-g7", "h0-g2"], result: "1-0" },
    { moves: ["h9-g7", "b0-c2"], result: "1-0" },
    { moves: ["h7-e7", "h0-g2"], result: "0-1" }
  ], { maxPly: 1, minGames: 2 });
  const root = lookupOpeningBook(createInitialPosition(), {
    book,
    openingHeuristics: false
  });

  assert.equal(root.move.notation, "h9-g7");
  assert.equal(root.entries.length, 1);
  assert.equal(root.entry.database.games, 2);
});
