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
  parseFen,
  parseOpeningBookCsv,
  positionKey
} from "../src/index.js";

test("opening book returns legal annotated entries from the initial position", () => {
  const position = createInitialPosition();
  const book = lookupOpeningBook(position);

  assert.ok(book);
  assert.equal(book.entry.name, "Pikafish best: b7-e7");
  assert.equal(book.move.notation, "b7-e7");
  assert.ok(book.entries.length >= 3);
});

test("engine chooses and explains opening book moves by default", () => {
  const position = createInitialPosition();
  const engine = createEngine({ depth: 2, timeLimitMs: 1000 });
  const result = engine.chooseMove(position);

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "b7-e7");
  assert.equal(result.depth, 0);
  assert.ok(result.explanation.summary.includes("book move"));
  assert.ok(result.explanation.reasons.some((reason) => reason.includes("Opening book")));
  assert.ok(result.explanation.confidence.score >= 45);
  assert.ok(result.explanation.confidence.factors.some((factor) => factor.kind === "book"));
  assert.equal(result.explanation.linePlan.firstMove, "b7-e7");
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
  assert.equal(result.bestMove.notation, "b7-e7");
  assert.equal(result.book.name, "Pikafish best: b7-e7");
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
  assert.equal(result.bestMove.notation, "i0-h0");
  assert.equal(result.book.name, "Pikafish best: i0-h0");
  assert.equal(result.book.database.engineScore, -16);
  assert.deepEqual(
    result.bookAlternatives.slice(0, 3).map((entry) => entry.move.notation),
    ["i0-h0", "h2-i2", "c3-c4"]
  );
});

test("opening book refreshes the central cannon screen-horse reply with Pikafish horse development", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  let position = createInitialPosition();
  for (const move of ["h7-e7", "h0-g2"]) {
    position = engine.play(position, move);
  }

  const result = engine.chooseMove(position);

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "h9-g7");
  assert.equal(result.book.name, "Pikafish best: h9-g7");
  assert.equal(result.book.database.engineScore, 33);
  assert.deepEqual(
    result.bookAlternatives.slice(0, 3).map((entry) => entry.move.notation),
    ["h9-g7", "g6-g5", "b7-d7"]
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
  assert.equal(result.bestMove.notation, "h9-g7");
  assert.equal(result.book.name, "Pikafish best: h9-g7");
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
  assert.equal(cannonSide.bestMove.notation, "h7-e7");
  assert.equal(cannonSide.book.name, "Pikafish best: h7-e7");
  assert.equal(cannonSide.book.database.engineScore, 26);

  position = createInitialPosition();
  for (const move of ["g6-g5", "c3-c4"]) {
    position = engine.play(position, move);
  }

  const pawnChallenge = engine.chooseMove(position);
  assert.equal(pawnChallenge.source, "opening-book");
  assert.equal(pawnChallenge.bestMove.notation, "b9-a7");
  assert.equal(pawnChallenge.book.name, "Pikafish best: b9-a7");
  assert.equal(pawnChallenge.book.database.engineScore, 24);
});

test("opening book covers the c3-c4 central cannon candidate branch", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  let position = createInitialPosition();
  for (const move of ["h7-e7", "h0-g2", "h9-g7", "c3-c4"]) {
    position = engine.play(position, move);
  }

  const result = engine.chooseMove(position);

  assert.equal(result.source, "opening-book");
  assert.equal(result.bestMove.notation, "i9-h9");
  assert.equal(result.book.name, "Pikafish best: i9-h9");
  assert.equal(result.book.database.engineScore, 38);
});

test("opening book follows refreshed Pikafish priors in shifted branches", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const cases = [
    {
      fen: "rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/3CC4/9/RHEAKAEHR b",
      move: "g3-g4"
    },
    {
      fen: "r1eakaehr/9/1ch4c1/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR b",
      move: "g3-g4"
    },
    {
      fen: "rheakaehr/9/1c4c2/p1p1p1p1p/9/6P2/P1P1P3P/4C2C1/9/RHEAKAEHR b",
      move: "b2-e2"
    },
    {
      fen: "rheakaer1/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1CH1C1H2/9/R1EAKAE1R r",
      move: "i9-h9"
    },
    {
      fen: "rheakaehr/7c1/2c6/pCp1p1p1p/8P/9/P1P1P1P2/3C4H/9/RHEAKAE1R b",
      move: "c3-c4"
    }
  ];

  for (const { fen, move } of cases) {
    const result = engine.chooseMove(parseFen(fen), { openingHeuristics: false });

    assert.equal(result.source, "opening-book");
    assert.equal(result.bestMove.notation, move);
    assert.equal(result.book.name, `Pikafish best: ${move}`);
  }
});

test("opening book follows fresh random 1839 oracle priors", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const cases = [
    ["r1eakaehr/9/h3c4/pcp3p1p/4p4/2P6/P3P1P1P/1C2E2C1/4K4/RHEA1A1HR b", "e2-e6"],
    ["rheak1eh1/4a3r/c8/p1p1p3p/6p2/1C6P/P1P1P1P2/7CR/R6c1/1HEAKAEH1 b", "a2-h2"],
    ["rh1aka1hr/2c6/e3e4/p1p1p1p1p/3C5/1c6P/P1P1P1P2/HC7/2R6/2EAKAEHR b", "b0-c2"],
    ["2eakae1r/9/1C2rc2h/p1p1p1p2/1c6p/P5E2/2P1P1P1P/H1C2A3/9/R1EAK2HR b", "f2-b2"],
    ["rhea1aeh1/1C2k4/3c4r/p1p1p4/6p2/8C/P1P1P1PcP/E5H2/9/RH1AKAE1R b", "e1-e0"],
    ["rhe1k2hr/4a4/4ea3/p1p1p1pcp/9/P5P2/2c1P3P/4C3C/5K3/RHEA1AEHR r", "h9-g7"],
    ["rheakaeh1/8r/6cc1/p3p3p/2p3p2/4P3P/PCP3P2/4C3H/9/RHEAKAE1R b", "g2-e2"],
    ["2eakae1r/4r4/8h/pCp1p4/1c2c1p2/4P3p/P1P3P1P/H4C2R/5K3/R1EA1AEH1 r", "e5-e4"],
    ["1heak2hr/r3a4/4e4/p1p1p1p1p/9/Pc2PcP2/2P1C3P/C8/4K4/RHEA1AEHR b", "h0-g2"]
  ];

  for (const [fen, move] of cases) {
    const result = engine.chooseMove(parseFen(fen), { openingHeuristics: false });

    assert.equal(result.source, "opening-book");
    assert.equal(result.bestMove.notation, move);
    assert.equal(result.book.name, `Pikafish best: ${move}`);
  }
});

test("opening book follows fresh random 1840 oracle priors", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const cases = [
    ["rh1ak1eh1/4a4/e7r/p1p1p1p1p/9/P4c3/2P1P1PcP/1CC1E4/4A3R/RHEK1A1H1 r", "h9-g7"],
    ["rheaka1hr/6c2/7c1/p1p1p1p1p/6e2/9/P1P1P1P1P/2C4CE/4K4/RHEA1A1HR b", "h2-e2"],
    ["1he1ka2r/3ra4/c5hce/p1p1p1p2/8p/8P/P1P1P1P2/E8/4A2CC/RH1AK1EHR r", "i8-i4"],
    ["r1e1kaehr/4a2C1/2h6/p1p1pc2p/6p2/1c3C2P/P1P1P1P2/4E4/R8/1H1AKAEHR r", "h9-i7"],
    ["rh1akc1hr/1C2a4/e3e1c2/p3p1p1p/2p2C3/6P2/P1P1P3P/3AE3R/9/RH2KAEH1 b", "a0-a1"],
    ["rheak1ehr/4a4/1c2c4/p1p1p1p1p/9/P8/2P1P1P1P/3C3C1/9/RHEAKAEHR r", "h9-g7"],
    ["rCeakaehr/9/1c7/p1p1p1p1p/9/9/P1c1P3P/4E1H1E/4K4/RH1A1A1CR b", "a0-b0"]
  ];

  for (const [fen, move] of cases) {
    const result = engine.chooseMove(parseFen(fen), { openingHeuristics: false });

    assert.equal(result.source, "opening-book");
    assert.equal(result.bestMove.notation, move);
    assert.equal(result.book.name, `Pikafish best: ${move}`);
  }
});

test("opening book follows fresh random 1841 oracle priors", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const cases = [
    ["rhe1k1ehr/4a4/5a1c1/pcp1p1p1p/P8/4P1P2/2P5P/1C1AEC3/9/RHEAK2HR r", "b7-a7"],
    ["rh1akaeh1/9/e3c3r/p1p1p4/6p1p/2P4c1/PC2P1P1P/8R/R1C1K4/1HEA1AEH1 b", "e2-e6"],
    ["2e1kae1r/r2c5/2ha3ch/p1p1p1p1p/1C7/P8/2P1P1P1P/EC2E3R/4A4/RH1AK2H1 b", "c3-c4"],
    ["rhea1aeh1/4k4/1c5cr/p1p1p1p1p/9/6P2/P1P1P3P/1CC6/9/RHEAKAEHR b", "h2-g2"],
    ["rheakaehr/9/7c1/p1p1p1p1p/1C7/9/P1P1P1PcP/6C2/4K4/RHEA1AEHR b", "h6-e6"],
    ["rh1a1aehr/4k4/c3e1c2/p1p1p1pCp/1C7/9/P1P1P1P1P/9/4R4/1HEAKAEHR r", "h3-e3"],
    ["rheakaeh1/9/2c5r/p3p1p1p/8P/2p5R/P1P1P1P2/1C5C1/4K4/RHEA1AEc1 r", "e8-e9"]
  ];

  for (const [fen, move] of cases) {
    const result = engine.chooseMove(parseFen(fen), { openingHeuristics: false });

    assert.equal(result.source, "opening-book");
    assert.equal(result.bestMove.notation, move);
    assert.equal(result.book.name, `Pikafish best: ${move}`);
  }
});

test("opening book follows fresh random 1842 oracle priors", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const cases = [
    ["rh1akaehr/6c2/e5c2/p1p1p3p/6p2/3C5/P1P1P1P1P/8R/C8/RHEAKAEH1 r", "a8-a3"],
    ["rh1akaehr/9/ec1c5/p1p1p1p1p/9/1C7/P1P1P1P1P/6HC1/8R/RHEAKAE2 b", "g3-g4"],
    ["rheaka1hr/1C6c/8e/6p1P/p1p1p4/6P2/PcP1P4/4E2C1/4A4/R3KAEHR r", "i9-i4"],
    ["r1eakaehr/9/hc7/p5p1p/2p1p4/6PcP/P1P1P4/4C4/1C7/RHEAKAEHR b", "c0-e2"],
    ["rCeakaeh1/1c7/2c5r/p1p1p1p1p/9/2P4CP/P3P1P2/9/9/RHEAKAEHR r", "b0-d0"],
    ["rheak1ehr/1c2a4/7c1/p1p3p1p/4p4/2P6/P3P1P1P/1C5CH/9/RHEAKAE1R b", "b1-c1"],
    ["1h2kaehr/r3a4/e6c1/p1p1p1p1p/9/P1P3P2/4c3P/2C5C/9/RHEAKAEHR b", "h2-h6"],
    ["r1eaka2r/5h3/hc3c3/p1p3p1p/6e2/PCP1p1PCP/4P4/4E4/9/RH1AKAEHR r", "b5-e5"]
  ];

  for (const [fen, move] of cases) {
    const result = engine.chooseMove(parseFen(fen), { openingHeuristics: false });

    assert.equal(result.source, "opening-book");
    assert.equal(result.bestMove.notation, move);
    assert.equal(result.book.name, `Pikafish best: ${move}`);
  }
});

test("opening book follows fresh random 1843 oracle priors", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const cases = [
    ["r1eakaehr/9/c1h6/p3p3p/2pc2p2/PC7/2P1P1P1P/4C3H/R8/1HEAKAE1R r", "b5-i5"],
    ["1Ceakaehr/5r3/4c4/p3p3p/2p3p2/P3P4/2P3PCP/H8/1c1K5/R1EA1AEHR b", "i0-i1"],
    ["r1eakaehr/9/hc7/p1p1p1p1p/4P2c1/9/P1P3P1P/4E2CR/1C7/RH1AKAEH1 b", "h4-i4"],
    ["1heakaehr/rC7/3c5/2p1p1p1p/p8/9/c1P1P1P1P/4E2CH/9/RH1AKAE1R r", "a9-a6"],
    ["rheakaehr/9/4c4/p1p1p1p1p/9/2P1P4/Pc4P1P/1C5C1/9/RHEAKAEHR r", "d9-e8"],
    ["r1eakaehr/9/4c2c1/2ph2p1p/p3p4/9/P1P1P1P1P/R2C4R/1C7/1HEAKAEH1 b", "e2-e6"],
    ["rheakaehr/9/1c3c3/pCp3p1p/4p4/9/P1P1P1P1P/4E1C2/9/RH1AKAEHR r", "h9-i7"],
    ["rheakaehr/9/3c5/pCp1p1p1p/9/9/P1P1P1P1P/1c7/5C2H/RHEAKAE1R b", "h0-g2"],
    ["r1eakaeh1/9/1ch3c1r/p1p1p1p1p/7C1/6P2/P1P1P3P/1C7/4A4/RHE1KAEHR r", "h9-i7"],
    ["1heakaehr/r8/c6c1/p1p1p1p1p/9/9/P1P1P1P1P/4C4/7C1/RHEAKAEHR r", "e7-e3"],
    ["r1eaka1h1/9/2h3r1e/pCp1p1p1p/9/6P1P/P1P1c4/9/2H5C/R1EAKAER1 b", "g2-f2"],
    ["1heakaeh1/9/r3c3r/p1p1p1p1p/4c2C1/8P/P1P1P1P2/4C3E/3R5/RHEAKA1H1 r", "d8-d5"],
    ["2eak1eh1/1C2a4/r7r/p1p3p1p/4p4/9/P1P1c1P1P/4E2C1/4A4/RHEAK2R1 b", "i2-b2"],
    ["rh1akaehr/9/9/p1p1p3p/2e3pc1/9/PcP1P1P1P/2H1C4/1C7/R1EAKAEHR r", "e7-e3"]
  ];

  for (const [fen, move] of cases) {
    const result = engine.chooseMove(parseFen(fen), { openingHeuristics: false });

    assert.equal(result.source, "opening-book");
    assert.equal(result.bestMove.notation, move);
    assert.equal(result.book.name, `Pikafish best: ${move}`);
  }
});

test("opening book follows fresh random 1844 oracle priors", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const cases = [
    ["rheakaehr/9/3C5/p1p1p1p1p/3c5/1C7/P1P1P2cP/6H2/4K4/RHEA1AE1R r", "i9-h9"],
    ["1reakae2/9/3c2h1r/2p1p1p1p/p6C1/2E6/P1P1P1P1P/4E4/4A4/RH1AK2R1 b", "i2-h2"],
    ["rheak2hr/4a4/1c6e/p1p3p1p/4p4/9/R1P3P1P/3CE2C1/9/1H1AKAEHR b", "b2-e2"],
    ["rheakCe2/8r/7c1/pCp1p1p1p/9/9/P1P1c1P1P/9/9/RHEAKAEHR r", "h9-g7"],
    ["1rea1kehr/9/1c1a1c3/p1p1p1p2/8p/2C6/P1P1P1P1P/4E4/9/RHEAKA1HR r", "b9-c7"],
    ["rheakaehr/9/1c7/p1p1p1p1p/7C1/9/P1P1c1P1P/3C5/9/RHEAKAEHR b", "b2-e2"],
    ["1heakaehr/9/r8/p1p1p1p1p/1cc6/4P4/P1P3PRP/C3ECH2/4K4/R2A1AE2 r", "g6-g5"],
    ["rheaka1hr/9/7ce/p3C1p1p/2p6/P7P/2P1PcP2/7C1/9/RHEAKAEHR r", "h7-e7"],
    ["rheakaeCr/9/9/2p1p1p1p/p8/1C6P/P1P1PcP2/6H2/9/RcEAKAE1R r", "i9-h9"],
    ["rheaka1hr/9/8C/p1p3p1p/2c6/4p4/P4C1cP/4E1H2/9/RH1AKAE1R r", "i2-b2"],
    ["rhea1ae2/4k2r1/9/p1p1p4/6p1p/Pc2c1P2/2P5P/RC4H2/9/1HEAKAE1R r", "i9-h9"],
    ["r2aka1hr/9/1c6e/2p1p1pCp/p1e6/P8/2P1P1P1P/4E3E/7R1/RH1AKA3 r", "h3-e3"]
  ];

  for (const [fen, move] of cases) {
    const result = engine.chooseMove(parseFen(fen), { openingHeuristics: false });

    assert.equal(result.source, "opening-book");
    assert.equal(result.bestMove.notation, move);
    assert.equal(result.book.name, `Pikafish best: ${move}`);
  }
});

test("opening book follows fresh random 1845 oracle priors", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const cases = [
    ["r1e1k1Ch1/4a4/1c4c2/p1p1p1p1p/9/4C4/P1P1P1P1P/5r3/9/RHEAKAEHR b", "e3-e4"],
    ["r2aka1hr/9/2h1e2ce/p1p1p1p1p/9/9/1cP3P1P/EC7/4K3C/RH1A1AEHR r", "e8-e9"],
    ["rhea1aehr/1c7/3k5/p1p1C2cp/6p2/8P/P1P1P1P2/EC7/9/RH1AKAEHR r", "e3-e5"],
    ["r1eaka1h1/8r/2h1e2c1/p1p1p1pCp/9/2P4c1/P3P1P1P/E8/6C2/RH1AKAEHR b", "a0-b0"],
    ["rh1a1ke1r/9/1c2e2c1/p1p1p1p1p/9/9/P1P1P1P1P/8C/9/RHEAKAEHR b", "i0-h0"],
    ["rheakaer1/7c1/4C4/p1p3p1p/9/7c1/P1P1P1P1P/E8/9/RH1AKAEH1 b", "c0-e2"],
    ["rheakaeh1/5C2r/1c5C1/p1p1p1p1p/9/9/P1P1c1P1P/8E/9/RHEAKA1HR b", "b2-b4"],
    ["rheakae2/1c2r4/6h2/p1C1p1p1p/9/P8/2P1P1P1P/H7C/8R/R1EAKcE2 b", "f9-f7"],
    ["rheakaeh1/9/7cr/p1p1p1pCp/1c7/9/P1P1P1P1P/1C7/4K4/RHEA1AEHR r", "h3-e3"]
  ];

  for (const [fen, move] of cases) {
    const result = engine.chooseMove(parseFen(fen), { openingHeuristics: false });

    assert.equal(result.source, "opening-book");
    assert.equal(result.bestMove.notation, move);
    assert.equal(result.book.name, `Pikafish best: ${move}`);
  }
});

test("opening book follows fresh random 1846 oracle priors", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const cases = [
    ["rheaka1hr/9/4e4/p5p1c/2p1p3p/6PCP/P1P1P4/6C2/9/1REAKAEHR b", "b0-c2"],
    ["rheakaehr/9/4c3c/p1p1p1p1p/9/9/P1P1P1P1P/EC1C5/9/RH1AKAEHR r", "h9-g7"],
    ["rheakaehr/9/1c7/p1p1p1p1p/9/7C1/P1PcP1P1P/E4C3/9/RH1AKAEHR b", "d6-a6"],
    ["rheakaehr/9/3c5/p1p1p1p1p/9/9/P1P1P1PcP/5C3/RC7/1HEAKAEHR b", "h6-e6"],
    ["1h1akaehr/6r2/e8/p1p1p1pcp/1c7/2E1C4/P1P1P1P1P/6C2/4A4/RH2KAEHR b", "f0-e1"],
    ["2e2aehr/4ak3/h1c6/p1p1p1p2/8p/1rP5P/P3P1Pc1/C2C5/R7R/1HEAKAEH1 b", "h0-g2"],
    ["rheakaer1/9/4c2c1/p1p1p1p1p/9/8P/P1P1P1P2/1C7/9/RHEAKAEHR r", "h9-g7"],
    ["rhe1ka1h1/4a2c1/1c2e3r/p1p1p1pC1/P7p/4P4/2P3P1P/5AC1R/9/RHE1KAEH1 b", "h1-h9"]
  ];

  for (const [fen, move] of cases) {
    const result = engine.chooseMove(parseFen(fen), { openingHeuristics: false });

    assert.equal(result.source, "opening-book");
    assert.equal(result.bestMove.notation, move);
    assert.equal(result.book.name, `Pikafish best: ${move}`);
  }
});

test("opening book follows fresh random 1847 oracle priors", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const cases = [
    ["rheakaehr/7C1/6c2/pcp1p1p1p/9/P3P4/2P3P1P/3C5/R8/1HEAKAEHR b", "g2-e2"],
    ["1heakae1r/r8/8h/2p1p1p1p/p4c3/9/P1PcP1P1P/E4C1C1/4A3R/RH2KAEH1 b", "i0-h0"],
    ["rh1a1aehr/4k4/2c1e4/p1p1p3p/6p2/1C4E2/P1P1P1P1P/H6c1/7C1/R2AKAEHR r", "g5-e7"],
    ["rCeakaehr/9/1c4c2/pC6p/2p1p1p2/9/P1P1P1P1P/H8/9/R1EAKAEHR r", "b3-b6"],
    ["rheakaehr/9/3c5/p1p1p1p1p/9/1C7/P1P1P1PcP/4E2C1/4K4/RHEA1A1HR b", "h6-e6"],
    ["rheakaehr/9/9/pcC1p1p1p/9/9/P1P1c1P1P/2RC4E/4K1R2/1HEA1A1H1 b", "b0-a2"],
    ["1h1a1aehr/4k4/2r4c1/p1p1p1p1p/2e6/7C1/P1P1c1P1P/7CR/9/RHEAKAEH1 r", "h7-h2"],
    ["rh1akaehr/9/e3c4/p1p1p1p1p/9/4P4/P1P3P1P/3C5/3C5/RHEAKAEcR b", "h9-h4"],
    ["1heaka1h1/rr7/1c4c1e/p1p1pCp1p/9/2P6/P3P1P1P/9/7C1/RHEAKAEHR b", "b1-f1"],
    ["rheakaehr/9/5c3/p1p1p1p1p/9/Pc7/2P1P1P1P/HC5C1/8R/R1EAKAEH1 b", "b5-b2"],
    ["rh1a1ke1r/5c3/e8/pCp1p1p1p/7c1/9/P1P1P1P1P/E5H2/9/RH1AKAE1R r", "i9-h9"],
    ["1h1akaehr/r8/e4c3/2p1c1p1p/p3p4/2P6/P3P1PCP/1CH5R/4A4/R1E1KAEH1 b", "h0-g2"]
  ];

  for (const [fen, move] of cases) {
    const result = engine.chooseMove(parseFen(fen), { openingHeuristics: false });

    assert.equal(result.source, "opening-book");
    assert.equal(result.bestMove.notation, move);
    assert.equal(result.book.name, `Pikafish best: ${move}`);
  }
});

test("opening book follows fresh random 1848 oracle priors", () => {
  const engine = createEngine({ depth: 1, timeLimitMs: 500 });
  const cases = [
    ["rheaka1hr/9/3c3c1/p1p1p1p1p/6e2/2E6/P1P1P1P1P/1C6H/5C3/RH1AKAE1R b", "h2-e2"],
    ["rheakae1r/1C2c4/1c6h/p1p1p1p1p/9/P8/2P1P1P1P/4E1HC1/9/RHEAKA2R b", "i0-h0"],
    ["rheakaehr/4c4/9/2p1p1p1p/p4C3/9/P1P1P1P1P/R6C1/3cA4/1HEAK1EHR r", "a7-d7"],
    ["1heakaehr/r8/1c7/2p1p1p1p/p8/8P/P1P1P1P2/E3C2C1/9/RH1AKAEcR b", "h9-f9"],
    ["rh1akaeh1/1c6c/4e3r/p1p5p/4p1p2/2E6/P1P1P1P1P/C6C1/4K4/RH1A1AEHR b", "e4-e5"],
    ["1heakae2/8r/r1c3h2/p1p1p1p1p/9/1c7/P1P1P1P1P/1C4HC1/5K3/RHEA1AER1 r", "f8-e8"],
    ["rh1akaeC1/8r/e6c1/p1p1p1p1p/9/P3P4/1cP3P1P/1C7/8R/RHEAKAEH1 b", "h2-e2"],
    ["rheakaehr/9/1c7/p1p1p1p2/7cp/9/P1P1P1P1P/H2C5/4C4/R1EAKAEHR r", "e8-e3"],
    ["rh1akaehr/1c7/9/p1p1p1p1p/6e2/P1P6/4P1PcP/HC3C2E/3K5/R1EA1A1HR b", "h6-e6"],
    ["r1eaka1hr/9/2h1e4/p1p1p1p1p/7c1/6PC1/P1P1P3P/2H4C1/1c7/1REAKAEHR b", "h4-h7"],
    ["1he1ka1hr/4a4/r7e/p1p3p1p/1c2p4/6Ec1/P1P1P1PCP/2H3C2/9/R1EAKA1HR r", "a9-b9"],
    ["r1ea1a1hr/2h1k4/8e/pcp1p1p1p/1C7/9/P1P1P1PcP/6H2/R8/1HEAKAERC b", "b3-b9"],
    ["rCeakaeh1/4c3r/c8/p1p1p1p1p/9/4P4/P1P3P1P/4E2CE/9/RH1AKA1HR r", "b0-b7"],
    ["rhea1ae1r/4k4/6hc1/p1p3p1p/4p4/7CP/PcP1P1P2/R3C4/9/1HEAKAEHR b", "g2-e3"],
    ["rheakaeh1/8r/7c1/p1p1p1pCp/9/9/P1P1P1P1P/E2cC4/8R/RH1AKAEH1 r", "h3-e3"]
  ];

  for (const [fen, move] of cases) {
    const result = engine.chooseMove(parseFen(fen), { openingHeuristics: false });

    assert.equal(result.source, "opening-book");
    assert.equal(result.bestMove.notation, move);
    assert.equal(result.book.name, `Pikafish best: ${move}`);
  }
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
  assert.equal(result.book.database.principalVariation, "g3-g4 i9-h9 i0-h0 h9-h3 c3-c4 b9-c7 b0-c2");
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

test("opening heuristic validation rejects losses above the configured threshold", () => {
  const engine = createEngine({ depth: 2, timeLimitMs: 2000 });
  const position = engine.play(createInitialPosition(), "c6-c5");
  const raw = engine.chooseMove(position, { validateOpeningHeuristics: false });
  const result = engine.chooseMove(position, {
    openingHeuristicValidationDepth: 2,
    openingHeuristicValidationTimeMs: 2000,
    openingHeuristicMaxCentipawnLoss: 40
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
