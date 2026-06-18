import { INITIAL_FEN, PIECES, SIDES } from "./constants.js";
import {
  createInitialPosition,
  fileOf,
  makeMove,
  moveKey,
  moveToNotation,
  parseFen,
  parseMoveNotation,
  positionKey,
  rankOf,
  sameMove
} from "./board.js";
import { generateLegalMoves, annotateMove } from "./movegen.js";
import { extractMoveTokens, parsePortableMoveNotation } from "./notation.js";

const AFTER_RED_CENTRAL_CANNON =
  "rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RHEAKAEHR b";

const ROOT_ENTRIES = Object.freeze([
  freezeBookEntry({
    move: "h7-e7",
    name: "Central Cannon",
    weight: 100,
    idea: "Occupies the central file early, creates direct pressure on Black's palace, and often leads to tactical play.",
    tags: ["initiative", "central file", "tactical"]
  }),
  freezeBookEntry({
    move: "b9-c7",
    name: "Left Horse Development",
    weight: 82,
    idea: "Develops a horse toward the center while keeping the cannons flexible.",
    tags: ["development", "flexible"]
  }),
  freezeBookEntry({
    move: "h9-g7",
    name: "Right Horse Development",
    weight: 82,
    idea: "Develops a horse and supports a balanced setup before committing the cannons.",
    tags: ["development", "balanced"]
  }),
  freezeBookEntry({
    move: "a9-a8",
    name: "Rook Lift",
    weight: 58,
    idea: "Activates the rook early, though it gives up some central-opening pressure.",
    tags: ["rook activity", "quiet"]
  })
]);

const CENTRAL_CANNON_RESPONSES = Object.freeze([
  freezeBookEntry({
    move: "h0-g2",
    name: "Screen Horse Defense",
    weight: 95,
    idea: "Develops the horse toward the center and prepares to meet the central cannon with a resilient screen-horse structure.",
    tags: ["defense", "development", "central cannon"]
  }),
  freezeBookEntry({
    move: "b0-c2",
    name: "Left Screen Horse Defense",
    weight: 92,
    idea: "Mirrors the screen-horse concept from the other wing and keeps Black's formation solid.",
    tags: ["defense", "development", "central cannon"]
  }),
  freezeBookEntry({
    move: "a0-a1",
    name: "Rook Lift Response",
    weight: 55,
    idea: "Activates the rook quickly, but delays central defensive development.",
    tags: ["rook activity", "sideline"]
  })
]);

const OPENING_LINES = Object.freeze([
  Object.freeze([
    ...ROOT_ENTRIES.slice(0, 1),
    ...CENTRAL_CANNON_RESPONSES.slice(0, 1),
    freezeBookEntry({
      move: "h9-g7",
      name: "Right Horse Reinforcement",
      weight: 90,
      idea: "Develops the horse behind the central cannon so Red can support the center before opening a rook lane.",
      tags: ["central cannon", "development", "main line"]
    }),
    freezeBookEntry({
      move: "b0-c2",
      name: "Double Screen Horses",
      weight: 90,
      idea: "Completes the two-horse screen against the central cannon and keeps both flanks defended.",
      tags: ["screen horses", "development", "solid"]
    }),
    freezeBookEntry({
      move: "i9-h9",
      name: "Right Rook Patrol",
      weight: 78,
      idea: "Uses the developed horse to free the rook and increase pressure along the flank.",
      tags: ["rook activity", "development"]
    }),
    freezeBookEntry({
      move: "i0-h0",
      name: "Black Right Rook Patrol",
      weight: 76,
      idea: "Follows the same principle: the horse clears a lane so the rook can enter play.",
      tags: ["rook activity", "development"]
    })
  ]),
  Object.freeze([
    ROOT_ENTRIES[0],
    CENTRAL_CANNON_RESPONSES[1],
    freezeBookEntry({
      move: "b9-c7",
      name: "Left Horse Reinforcement",
      weight: 88,
      idea: "Develops the left horse and keeps the central cannon backed by a flexible formation.",
      tags: ["central cannon", "development"]
    }),
    freezeBookEntry({
      move: "h0-g2",
      name: "Balanced Screen Horse",
      weight: 88,
      idea: "Completes Black's screen-horse structure from the opposite wing.",
      tags: ["screen horses", "development"]
    })
  ]),
  Object.freeze([
    ROOT_ENTRIES[1],
    freezeBookEntry({
      move: "h0-g2",
      name: "Symmetric Horse Development",
      weight: 84,
      idea: "Meets Red's horse development with a centralizing horse of Black's own.",
      tags: ["development", "balanced"]
    }),
    freezeBookEntry({
      move: "h9-g7",
      name: "Double Horse Setup",
      weight: 84,
      idea: "Develops both horses before committing either cannon, a flexible learning-friendly setup.",
      tags: ["development", "flexible"]
    }),
    freezeBookEntry({
      move: "b0-c2",
      name: "Black Double Horse Setup",
      weight: 82,
      idea: "Keeps pace in development and contests the center without early pawn weaknesses.",
      tags: ["development", "balanced"]
    })
  ])
]);

const PIKAFISH_OPENING_POSITIONS = Object.freeze([
  Object.freeze({
    fen: INITIAL_FEN,
    entries: Object.freeze([
      pikafishEntry("b7-e7", 1, 100, 27, "b7-e7 b0-c2 b9-c7 c3-c4 a9-b9 a0-b0 b9-b5"),
      pikafishEntry("h7-e7", 2, 96, 29, "h7-e7 h0-g2 h9-g7 i0-h0 i9-h9 b0-c2 b9-c7"),
      pikafishEntry("g6-g5", 3, 94, 27, "g6-g5 c3-c4 b7-e7 h0-g2 b9-c7"),
    ])
  }),
  Object.freeze({
    fen: AFTER_RED_CENTRAL_CANNON,
    entries: Object.freeze([
      pikafishEntry("h0-g2", 1, 100, -30, "h0-g2 h9-g7 i0-h0 i9-h9 c3-c4"),
      pikafishEntry("b0-c2", 2, 93, -32, "b0-c2 h9-g7 h0-g2 i9-h9 i0-h0"),
      pikafishEntry("h2-e2", 3, 92, -33, "h2-e2 h9-g7 h0-g2 i9-h9 b0-c2")
    ])
  }),
  Object.freeze({
    fen: "rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RHEAKAEHR r",
    entries: Object.freeze([
      pikafishEntry("h9-g7", 1, 100, 33, "h9-g7 g3-g4 i9-h9 i0-h0 h9-h3"),
      pikafishEntry("b7-d7", 2, 92, 22, "b7-d7 b0-c2 b9-c7 c3-c4 a9-b9"),
      pikafishEntry("g6-g5", 3, 90, 13, "g6-g5 c3-c4 b9-a7 b0-c2 h9-g7")
    ])
  }),
  Object.freeze({
    fen: "r1eakaehr/9/1ch4c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RHEAKAEHR r",
    entries: Object.freeze([
      pikafishEntry("h9-g7", 1, 100, 31, "h9-g7 h0-g2 c6-c5"),
      pikafishEntry("c6-c5", 2, 90, 26, "c6-c5 h2-e2 h9-g7 h0-g2 i9-h9"),
      pikafishEntry("g6-g5", 3, 80, 16, "g6-g5 c3-c4 b9-a7 h0-g2 b7-d7")
    ])
  }),
  Object.freeze({
    fen: "rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1H2/9/RHEAKAE1R b",
    entries: Object.freeze([
      pikafishEntry("g3-g4", 1, 100, -19, "g3-g4 i9-h9 i0-h0 h9-h3 c3-c4 b9-c7 b0-c2"),
      pikafishEntry("i0-h0", 2, 98, -21, "i0-h0 i9-h9 b0-c2 c6-c5 g3-g4"),
      pikafishEntry("c3-c4", 3, 97, -28, "c3-c4 i9-h9 i0-h0 h9-h3 b0-c2"),
      pikafishEntry("b0-c2", 4, 95, -25, "b0-c2 i9-h9 i0-h0 c6-c5 g3-g4")
    ])
  }),
  Object.freeze({
    fen: "rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/3CC4/9/RHEAKAEHR b",
    entries: Object.freeze([
      pikafishEntry("g3-g4", 1, 100, -18, "g3-g4 b9-c7 b2-d2 a9-b9 b0-c2"),
      pikafishEntry("b0-c2", 2, 96, -19, "b0-c2 h9-g7 c3-c4 b9-a7 h2-h4"),
      pikafishEntry("b2-d2", 3, 92, -23, "b2-d2 b9-c7 b0-c2 a9-b9 g3-g4")
    ])
  }),
  Object.freeze({
    fen: "rheakaehr/9/1c5c1/p1p1p1p1p/9/6P2/P1P1P3P/1C5C1/9/RHEAKAEHR b",
    entries: Object.freeze([
      pikafishEntry("h2-g2", 1, 100, -25, "h2-g2 h9-g7 g3-g4 b7-e7 b0-c2"),
      pikafishEntry("c3-c4", 2, 88, -32, "c3-c4 b7-e7 b0-c2 b9-c7 a0-b0"),
      pikafishEntry("b0-c2", 3, 87, -33, "b0-c2 c6-c5 h0-i2 h9-g7 b2-a2")
    ])
  }),
  Object.freeze({
    fen: "rheakae1r/9/1c4hc1/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR b",
    entries: Object.freeze([
      pikafishEntry("i0-h0", 1, 100, -16, "i0-h0 h9-g7 c3-c4 b9-a7 b0-c2"),
      pikafishEntry("h2-i2", 2, 93, -18, "h2-i2 h9-g7 i0-h0 c6-c5 c0-e2"),
      pikafishEntry("b2-e2", 3, 76, -37, "b2-e2 h9-g7 b0-c2 b9-a7 i0-h0")
    ])
  }),
  Object.freeze({
    fen: "rheakae1r/9/1c4hc1/p3p1p1p/2p6/9/P1P1P1P1P/1C2C1H2/9/RHEAKAE1R r",
    entries: Object.freeze([
      pikafishEntry("i9-h9", 1, 100, 38, "i9-h9 i0-h0 b9-a7 b0-c2 g6-g5"),
      pikafishEntry("b9-a7", 2, 94, 27, "b9-a7 b0-c2 i9-h9 i0-h0 g6-g5"),
      pikafishEntry("g6-g5", 3, 91, 23, "g6-g5 b0-c2 i9-h9 i0-h0 b9-a7")
    ])
  }),
  Object.freeze({
    fen: "rheakaer1/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1CH1C1H2/9/R1EAKAE1R r",
    entries: Object.freeze([
      pikafishEntry("i9-h9", 1, 100, 12, "i9-h9 b0-c2 g6-g5 c3-c4 b9-a7"),
      pikafishEntry("b7-a7", 2, 96, 10, "b7-a7 b0-c2 a9-b9 a0-b0 b9-b5"),
      pikafishEntry("c6-c5", 3, 79, 8, "c6-c5 b0-c2 i9-h9 i0-h0 h9-h5"),
      pikafishEntry("b7-b8", 4, 62, -9, "b7-b8 b0-c2 h9-g7 i0-h0 i9-h9")
    ])
  }),
  Object.freeze({
    fen: "r1eakaehr/9/1ch4c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1H2/9/RHEAKAE1R b",
    entries: Object.freeze([
      pikafishEntry("h0-g2", 1, 100, -38, "h0-g2 g6-g5"),
      pikafishEntry("h2-e2", 2, 90, -43, "h2-e2 i9-h9 h0-g2 g6-g5 i0-i1"),
      pikafishEntry("h2-f2", 3, 83, -50, "h2-f2 i9-h9 h0-g2 g6-g5 i0-i1")
    ])
  }),
  Object.freeze({
    fen: "rheakaehr/9/1c4c2/p1p1p1p1p/9/6P2/P1P1P3P/1C2E2C1/9/RH1AKAEHR b",
    entries: Object.freeze([
      pikafishEntry("h0-i2", 1, 100, -3, "h0-i2 h9-g7 i0-h0 i9-h9"),
      pikafishEntry("b2-e2", 2, 96, 5, "b2-e2 i6-i5 h0-i2 i9-i6 i0-h0"),
      pikafishEntry("b0-c2", 3, 67, -23, "b0-c2 h9-g7 b2-a2 c6-c5 h0-i2")
    ])
  }),
  Object.freeze({
    fen: "rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RHEAKAEHR r",
    entries: Object.freeze([
      pikafishEntry("h9-g7", 1, 100, 33, "h9-g7 g3-g4 i9-h9 i0-h0 h9-h3"),
      pikafishEntry("g6-g5", 2, 94, 22, "g6-g5 c3-c4 b7-c7 b0-c2 h9-g7"),
      pikafishEntry("c6-c5", 3, 90, 17, "c6-c5 g3-g4 h9-g7 i0-h0 b9-c7")
    ])
  }),
  Object.freeze({
    fen: "rheakaehr/9/1c4c2/p1p1p1p1p/9/6P2/P1P1P3P/1C5C1/9/RHEAKAEHR r",
    entries: Object.freeze([
      pikafishEntry("h7-e7", 1, 100, 26, "h7-e7 b2-e2 h9-g7 b0-c2 g7-f5"),
      pikafishEntry("b7-e7", 2, 96, 21, "b7-e7 c0-e2 h9-i7 h0-i2 i9-h9 i0-h0 h7-h3 d0-e1 c6-c5 b0-d1 b9-c7"),
      pikafishEntry("b9-c7", 3, 92, 20, "b9-c7 g3-g4 c6-c5 g4-g5 g9-e7 h0-i2 c7-d5 i0-h0 a9-a8 d0-e1 h9-i7"),
      pikafishEntry("c9-e7", 4, 84, 15, "c9-e7 h0-i2 h9-g7 i0-h0 g7-f5")
    ])
  }),
  Object.freeze({
    fen: "rheakaehr/9/1c5c1/p3p1p1p/2p6/6P2/P1P1P3P/1C5C1/9/RHEAKAEHR r",
    entries: Object.freeze([
      pikafishEntry("b9-a7", 1, 100, 24, "b9-a7 b0-c2 h9-g7 c0-e2 g9-e7 h0-i2"),
      pikafishEntry("h9-g7", 2, 96, 28, "h9-g7 h0-i2 b7-c7 b2-e2 b9-a7 h2-g2 a9-b9"),
      pikafishEntry("b7-c7", 3, 92, 31, "b7-c7 c0-e2 h7-e7 b0-c2 h9-g7 h0-i2 b9-a7 a0-b0 i9-h9")
    ])
  }),
  Object.freeze({
    fen: "r1eakaehr/9/1ch4c1/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR b",
    entries: Object.freeze([
      pikafishEntry("g3-g4", 1, 100, -15, "g3-g4 g5-g4 a0-a1 h9-g7 a1-g1"),
      pikafishEntry("g0-e2", 2, 96, -16, "g0-e2 b9-c7 c3-c4 a9-a8 a0-a1"),
      pikafishEntry("c3-c4", 3, 94, -17, "c3-c4 h9-g7 g0-e2 i9-h9 h0-f1")
    ])
  }),
  Object.freeze({
    fen: "rheakaehr/9/1c4c2/p1p1p1p1p/9/6P2/P1P1P3P/4C2C1/9/RHEAKAEHR b",
    entries: Object.freeze([
      pikafishEntry("b2-e2", 1, 100, -16, "b2-e2 b9-c7 h0-i2 h9-g7 i0-h0"),
      pikafishEntry("c0-e2", 2, 96, -17, "c0-e2 h9-i7 h0-i2 i9-h9 i0-h0"),
      pikafishEntry("b0-c2", 3, 93, -19, "b0-c2 b9-c7 h0-i2 h9-g7 i0-h0")
    ])
  }),
  Object.freeze({
    fen: "rheakaehr/9/1c5c1/p3p1p1p/2p6/6P2/P1P1P3P/HC5C1/9/R1EAKAEHR b",
    entries: Object.freeze([
      pikafishEntry("h2-e2", 1, 100, -25, "h2-e2 h9-g7 h0-g2 i9-h9 i0-h0"),
      pikafishEntry("b0-c2", 2, 93, -27, "b0-c2 h9-g7 g0-e2 a9-a8 h0-f1"),
      pikafishEntry("b2-e2", 3, 87, -33, "b2-e2 h9-g7 b0-c2 g9-e7 a0-b0")
    ])
  }),
  Object.freeze({
    fen: "rheakaehr/9/1c5c1/p3p1p1p/2p6/6P2/P1P1P3P/2C4C1/9/RHEAKAEHR b",
    entries: Object.freeze([
      pikafishEntry("b0-c2", 1, 100, -18, "b0-c2 b9-a7 c2-b4 h7-e7 h0-g2"),
      pikafishEntry("b2-e2", 2, 90, -23, "b2-e2 h7-e7 b0-c2 h9-g7 h0-i2"),
      pikafishEntry("g0-e2", 3, 87, -26, "g0-e2 b9-a7 b0-c2 a9-b9 a0-b0")
    ])
  }),
  Object.freeze({
    fen: "rheakae1r/9/1c4h1c/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR r",
    entries: Object.freeze([
      pikafishEntry("h9-g7", 1, 100, 25, "h9-g7 i0-h0 b9-c7 c3-c4 b7-b3"),
      pikafishEntry("b9-c7", 2, 91, 23, "b9-c7 i0-h0 h9-g7 b0-c2"),
      pikafishEntry("b9-a7", 3, 79, 9, "b9-a7 i0-h0 h9-g7 a3-a4 a9-a8")
    ])
  }),
  Object.freeze({
    fen: "rheakaer1/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1C2C1H2/9/RHEAKAER1 r",
    entries: Object.freeze([
      pikafishEntry("c6-c5", 1, 100, 22, "c6-c5 b2-b6 e6-e5 h2-h6 e5-e4 c0-e2"),
      pikafishEntry("h9-h3", 2, 96, 20, "h9-h3 h2-i2 h3-g3 c0-e2 b9-c7"),
      pikafishEntry("h9-h5", 3, 92, 29, "h9-h5 b0-c2 b9-c7 h2-i2 h5-h0"),
      pikafishEntry("b9-c7", 4, 88, 22, "b9-c7 h2-i2 h9-h5 b0-c2")
    ])
  }),
  Object.freeze({
    fen: "rhe1kaeh1/4a4/1c6r/p1pc2p2/4p3p/2P6/P3P1P1P/R1C3H1C/9/1HEAKAE1R b",
    entries: Object.freeze([
      pikafishEntry("i2-f2", 1, 100, -52, "i2-f2 c7-e7 b0-a2 i9-h9 h0-i2 a7-d7 f2-f3 h9-h5 a0-b0"),
      pikafishEntry("i2-d2", 2, 97, -57, "i2-d2 c7-d7 d3-e3 f9-e8 d2-d6 i9-h9 h0-i2 h9-h5 b2-e2"),
      pikafishEntry("i2-h2", 3, 90, -70, "i2-h2 c7-e7 d3-d0 a7-b7 h2-d2 f9-e8 b0-a2")
    ])
  }),
  Object.freeze({
    fen: "1heakaeh1/8r/rc7/p1p6/4p1pCp/6P2/P1P1P3P/c1CA2H2/8R/RHE1KAE2 r",
    entries: Object.freeze([
      pikafishEntry("h4-e4", 1, 100, 419, "h4-e4 i1-d1 b9-a7 g4-g5 a9-b9 d1-d4 e6-e5 h0-i2 c7-c3"),
      pikafishEntry("g5-g4", 2, 82, 337, "g5-g4 a7-d7 h4-e4 i1-g1 g4-f4 g1-g3 g7-f5 b2-g2 g9-e7"),
      pikafishEntry("i8-f8", 3, 70, 280, "i8-f8 g4-g5 b9-a7 h0-i2 h4-h8 g5-g6 g7-i8 b2-e2 a9-b9 a2-d2")
    ])
  }),
  Object.freeze({
    fen: "rhea1aeh1/4k4/1c4c1r/p1p1p1p1p/6P2/2P6/P2CP3P/8C/4A4/RHEAK1EHR b",
    entries: Object.freeze([
      pikafishEntry("g3-g4", 1, 100, -57, "g3-g4 b9-c7 b0-c2 d6-d7 a0-b0 g9-e7"),
      pikafishEntry("e1-e0", 2, 87, -122, "e1-e0 i7-e7 g2-g4 b9-c7 i2-d2 d6-d7 b0-c2"),
      pikafishEntry("i2-h2", 3, 70, -163, "i2-h2 g4-g3 g2-g9 h9-g7 g9-g3 g7-f5")
    ])
  }),
  Object.freeze({
    fen: "rh1akaeh1/1C7/1c2e1c1r/p1p1p1p2/8p/6P2/P1P1P3P/H2C2H2/8R/R1EAKAE2 b",
    entries: Object.freeze([
      pikafishEntry("g3-g4", 1, 100, 128, "g3-g4 i8-h8 i2-i1 h8-h0 g4-g5 d7-b7 g2-g7 h0-h3 b2-b3 a9-a8 i1-d1"),
      pikafishEntry("i2-i1", 2, 92, 116, "i2-i1 d7-b7 g3-g4 i8-h8 g4-g5 h8-h0 g2-g7 h0-h3 b2-b3 a9-a8 i1-d1"),
      pikafishEntry("a0-a1", 3, 84, 105, "a0-a1 d7-b7 g3-g4 g7-e8 g4-g5 i8-h8 g2-h2 h8-g8 g5-f5")
    ])
  }),
  Object.freeze({
    fen: "rh1aka1hr/9/ec6e/p1p1p1pc1/9/8p/P1P1P1P1P/1C6H/R3A3R/1HEAKCE2 r",
    entries: Object.freeze([
      pikafishEntry("i8-h8", 1, 100, 343, "i8-h8 h3-i3 h8-h1 i5-i6 b7-h7 i6-i7 h7-h0 f0-e1"),
      pikafishEntry("i6-i5", 2, 92, 308, "i6-i5 i2-g0 i8-h8 i0-i3 b7-e7 b2-h2 h8-f8 d0-e1"),
      pikafishEntry("b7-e7", 3, 84, 279, "b7-e7 b2-h2 i6-i5 i2-g0 a8-d8 i0-i5 i8-f8 d0-e1")
    ])
  }),
  Object.freeze({
    fen: "rhe1kaeh1/1c2a3r/8c/p1pC2p1p/4p4/9/P1P1P1P1P/6HC1/R3A3R/1HEAK1E2 r",
    entries: Object.freeze([
      pikafishEntry("g6-g5", 1, 100, 153, "g6-g5 i2-b2 g7-h5 h0-i2 i8-f8 i1-f1 f8-f1 b1-f1 h7-e7 b2-e2"),
      pikafishEntry("a8-b8", 2, 96, 147, "a8-b8 b1-a1 g6-g5 b0-c2 g7-h5 i1-f1 b8-b1 h0-g2 h5-g3"),
      pikafishEntry("b9-c7", 3, 82, 130, "b9-c7 h0-g2 a8-b8 i1-h1 i8-h8 b1-c1 b8-b1 c1-c6 c9-e7")
    ])
  }),
  Object.freeze({
    fen: "rheakaehr/7c1/9/p5p1p/1Cp1p4/9/P1P1P1P1P/4E3c/1R2A4/1HE1KACHR b",
    entries: Object.freeze([
      pikafishEntry("e4-e5", 1, 100, -316, "e4-e5 i9-i7 b0-c2 b4-b1 e5-e6 h9-g7 e6-e7 c9-e7 h1-e1"),
      pikafishEntry("i7-i8", 2, 78, -408, "i7-i8 i9-i8 e4-e5 b4-b5 b0-a2 e6-e5 h1-b1 b5-d5"),
      pikafishEntry("c4-c5", 3, 76, -414, "c4-c5 i9-i7 c5-d5 b4-b1 h1-e1 i7-h7 h0-g2 g6-g5")
    ])
  }),
  Object.freeze({
    fen: "1ceaka1hr/rC7/4e4/h3p1pcp/p4C3/2p6/P1P1P1P1P/R8/9/1HEAKAEHR r",
    entries: Object.freeze([
      pikafishEntry("b1-b3", 1, 100, -346, "b1-b3 a1-f1 a7-f7 b0-b9 h9-g7 h3-h7 f7-f6 f1-d1 f9-e8"),
      pikafishEntry("b1-b8", 2, 99, -346, "b1-b8 b0-b9 c6-c5 g3-g4 a7-a9 h0-g2 a9-b9 g2-f4"),
      pikafishEntry("b1-b2", 3, 88, -358, "b1-b2 b0-b9 c6-c5 a1-b1 f4-f2 g3-g4 h9-g7")
    ])
  }),
  Object.freeze({
    fen: "r1eakae1r/h3h4/cc7/p3p1p2/2p5p/2PC5/P3P1PCP/E7R/4K4/RH1A1AEH1 r",
    entries: Object.freeze([
      pikafishEntry("c5-c4", 1, 100, -185, "c5-c4 i0-h0 i7-h7 h0-h4 b9-d8 a0-b0 a9-b9 h4-c4 h6-h0"),
      pikafishEntry("i7-f7", 2, 92, -201, "i7-f7 c4-c5 a7-c5 i0-h0 h6-h7 e1-d3 c5-e7 d3-b4"),
      pikafishEntry("d5-h5", 3, 91, -202, "d5-h5 c4-c5 a7-c5 b2-i2 i7-f7 a0-b0")
    ])
  }),
  Object.freeze({
    fen: "2rakaeh1/3h4r/1c2e2c1/pCp1p1p1p/9/2P3P2/P3P3P/6C2/4K4/RHEA1AEHR b",
    entries: Object.freeze([
      pikafishEntry("i1-f1", 1, 100, 285, "i1-f1 e8-e9 c3-c4 c9-e7 c4-c5"),
      pikafishEntry("c3-c4", 2, 98, 281, "c3-c4 e8-e9 c4-c5 b3-g3 i1-f1 h9-i7 c5-d5 g9-e7"),
      pikafishEntry("h0-i2", 3, 82, 247, "h0-i2 g7-c7 c3-c4 e8-e9 c0-c3 b3-b4 d1-f2 b9-a7")
    ])
  }),
  Object.freeze({
    fen: "rhe1kae1r/4aC3/2c4ch/p1p1p1C1p/9/4P4/P1P3P1P/2H6/9/R1EAKAEHR b",
    entries: Object.freeze([
      pikafishEntry("h2-f2", 1, 100, 335, "h2-f2 g3-g5 i0-i1 h9-g7 i1-f1 i9-h9 f2-e2 g9-e7"),
      pikafishEntry("h2-e2", 2, 99, 333, "h2-e2 g3-g5 i0-i1 f1-f4 e2-e5 f4-f5"),
      pikafishEntry("c2-e2", 3, 82, 289, "c2-e2 f9-e8 h2-f2 g3-f3 i2-g3 h9-g7 g3-f1")
    ])
  }),
  Object.freeze({
    fen: "1he1kaehr/4a4/rc7/p1p1p1p1p/9/7C1/P1P1P1P1P/C8/4A4/RHE1KAEcR r",
    entries: Object.freeze([
      pikafishEntry("h5-a5", 1, 100, 245, "h5-a5 h9-h6 a5-a2 b0-a2 i9-h9 h6-e6 c9-e7 e6-i6"),
      pikafishEntry("b9-c7", 2, 82, 144, "b9-c7 h9-f9 e8-f9 b2-b4 a9-b9 a2-b2 c9-e7 h0-i2"),
      pikafishEntry("i9-h9", 3, 81, 141, "i9-h9 b2-d2 b9-c7 a2-b2 c6-c5 h0-i2 h5-f5 i0-h0")
    ])
  }),
  Object.freeze({
    fen: "2eaka1hr/4c2r1/C1c5e/p1p1p1p1p/9/2P3P1P/P3P4/H3C3R/9/R1EAKAEH1 b",
    entries: Object.freeze([
      pikafishEntry("c0-a2", 1, 100, 16, "c0-a2 h9-g7 g3-g4 g5-g4 h0-f1 g7-f5"),
      pikafishEntry("e1-e6", 2, 82, -54, "e1-e6 d9-e8 c0-a2 h9-g7 e6-e4 g7-f5"),
      pikafishEntry("h1-h9", 3, 66, -104, "h1-h9 a2-a0 e1-e6 d9-e8 i0-i1 i7-i6 c2-e2")
    ])
  }),
  Object.freeze({
    fen: "rheakaehr/9/5c3/p1p3p1p/4p4/7cP/P1P1P1P2/1C4C2/9/RHEAKAEHR r",
    entries: Object.freeze([
      pikafishEntry("b7-e7", 1, 100, 205, "b7-e7 f2-e2 e7-e4 f0-e1 h9-i7 h5-b5 i9-h9 h0-g2"),
      pikafishEntry("h9-i7", 2, 99, 203, "h9-i7 h5-h1 b7-e7 h1-e1 i9-h9 h0-g2 h9-h3 e4-e5 e7-e5 f2-e2"),
      pikafishEntry("g6-g5", 3, 80, 161, "g6-g5 h0-i2 b7-e7 d0-e1 h9-i7 h5-h6 e7-e4 f2-e2 a9-a8 i0-h0")
    ])
  }),
  Object.freeze({
    fen: "r1eakaehr/4c4/hc7/p1p1p1p1p/6P2/9/P1P1P3P/C3C3R/R8/1HEAKAEH1 r",
    entries: Object.freeze([
      pikafishEntry("g4-g3", 1, 100, 274, "g4-g3 h0-i2 g3-f3 i0-h0 a8-f8 h0-h9 f3-f2 i2-g3 f2-f1 e1-e6 e7-e3"),
      pikafishEntry("g4-f4", 2, 91, 252, "g4-f4 a0-b0 b9-c7 h0-g2 a8-d8 i0-h0 h9-g7 c0-e2"),
      pikafishEntry("a7-a3", 3, 74, 204, "a7-a3 a0-b0 g4-g3 h0-i2 a8-f8 i0-h0 i7-f7 g0-e2 f7-f3 h0-g0")
    ])
  }),
  Object.freeze({
    fen: "rheakaehr/9/1c7/p1p1p1p1p/3c5/9/P1P1P1P1P/HC4C2/R3K4/2EA1AEHR b",
    entries: Object.freeze([
      pikafishEntry("b2-e2", 1, 100, 133, "b2-e2 a8-d8 d4-c4 a6-a5 h0-g2 h9-i7 c4-c9 a7-b5 c3-c4 b5-d4 a0-a2 i9-h9"),
      pikafishEntry("h0-g2", 2, 28, 37, "h0-g2 e8-e9 b2-e2 g9-e7 d4-i4 g7-i7 e2-e6 f9-e8 i0-h0 h9-f8 e6-a6 a8-d8 a0-a1 i7-i4 i3-i4"),
      pikafishEntry("h0-i2", 3, 26, 34, "h0-i2 g9-e7 d4-i4 g7-i7 i0-h0")
    ])
  }),
  Object.freeze({
    fen: "rheakaehr/9/9/p1p1p1p1p/9/C8/PCPcP1PcP/R8/4K4/1HEA1AEHR b",
    entries: Object.freeze([
      pikafishEntry("b0-a2", 1, 100, -266, "b0-a2 b6-d6 a0-b0 b9-c7 h0-g2 h9-g7 g3-g4 i9-h9 i0-h0 e8-e9 c3-c4 d6-d7 a2-c3 a5-f5 b0-b8 a7-b7"),
      pikafishEntry("c0-a2", 2, 66, -356, "c0-a2 b6-d6 h0-g2 h9-g7 i0-h0 a7-b7 b0-c2"),
      pikafishEntry("b0-c2", 3, 44, -415, "b0-c2 a5-a0 d6-b6 h9-g7 h0-g2 i9-h9 h6-e6 g7-e6 b6-e6 h9-h1")
    ])
  }),
  Object.freeze({
    fen: "rh1a2ehr/4a4/ec2k4/p1pC2p1p/4p4/9/P1P1P1P1P/1C5c1/4A4/RHEAK1EHR b",
    entries: Object.freeze([
      pikafishEntry("h0-g2", 1, 100, -384, "h0-g2 b7-e7 i0-h0 e6-e5 e2-f2 e7-e4 f2-f1 a9-a7 b2-e2"),
      pikafishEntry("i0-i2", 2, 96, -400, "i0-i2 b7-e7 a0-a1 b9-a7 e2-f2 i9-i8 f2-f1 i8-f8 b2-f2"),
      pikafishEntry("h0-i2", 3, 94, -407, "h0-i2 i9-i8 a0-a1 b7-b0 a1-d1 d3-f3 i0-h0 a9-a7 d1-b1 b0-b2 b1-b2 i8-i7 h7-h2 i7-b7 b2-b7 a7-b7")
    ])
  }),
  Object.freeze({
    fen: "1heakaehr/9/rc7/p1p1p1p1p/1C2c4/2P6/P3P1P1P/H6CE/R3A4/2E1KA1HR b",
    entries: Object.freeze([
      pikafishEntry("b2-e2", 1, 100, 20, "b2-e2 e6-e5 e4-h4 h7-e7 h0-g2 a8-b8 i0-h0 g6-g5 a2-d2 h9-f8 b0-a2 i9-h9 a3-a4 h9-h6 a2-b4"),
      pikafishEntry("b2-f2", 2, 31, -43, "b2-f2 e6-e5 e4-h4 a8-b8 h0-g2 h7-e7 i0-h0 e5-e4"),
      pikafishEntry("b2-i2", 3, 1, -66, "b2-i2 e6-e5 e4-h4 a8-b8 a2-b2 h7-e7 b0-c2 h9-f8 h0-g2 i9-h9")
    ])
  }),
  Object.freeze({
    fen: "1hea1aehr/4k2r1/c8/p1p1p3p/6p2/P1C2c3/2P1P1P1P/7CE/R3H4/1HEAKA2R r",
    entries: Object.freeze([
      pikafishEntry("h7-e7", 1, 100, 348, "h7-e7 g0-e2 e7-e3 e1-f1 e8-c7 h1-h3 e3-e5 f5-f2 a8-b8 c3-c4 b8-b1 f0-e1 e5-i5"),
      pikafishEntry("a8-b8", 2, 99, 346, "a8-b8 h1-h7 b8-b1 e1-e0 c5-c0 d0-e1 b1-b0 a2-e2 e8-c7 e2-d2 i9-i8 i0-i2"),
      pikafishEntry("h7-d7", 3, 76, 264, "h7-d7 c0-e2 a8-b8 e1-e0 b8-b0 h1-d1 d7-e7 h0-g2 b0-b2 c3-c4 c5-b5 f5-a5 i9-h9")
    ])
  }),
  Object.freeze({
    fen: "rheaka1h1/8r/1c5ce/p1p1p3p/3C2p2/7C1/P1P1P1P1P/9/9/RHEAKAEHR b",
    entries: Object.freeze([
      pikafishEntry("h2-e2", 1, 100, 156, "h2-e2 b9-c7 i1-d1 d4-f4 d1-f1 f4-d4 h0-g2 a9-b9 b0-c2 h5-e5"),
      pikafishEntry("h0-g2", 2, 84, 131, "h0-g2 f9-e8 b0-c2 h9-g7 g2-f4 d4-d7 b2-b7 g9-e7 f4-g6 i9-f9 g4-g5"),
      pikafishEntry("h2-g2", 3, 63, 99, "h2-g2 f9-e8 i1-h1 h5-e5 d0-e1 b9-a7 b0-a2 g9-e7 b2-b7 a9-b9 a0-b0 d4-d7 e3-e4")
    ])
  }),
  Object.freeze({
    fen: "rh2ka1hr/4a4/e3c3e/p1p1p3p/6p2/2C3P1P/P1P1Pc3/H3RC3/4A4/2E1KAEHR b",
    entries: Object.freeze([
      pikafishEntry("g4-g5", 1, 100, 8, "g4-g5 c5-e5 e2-e5 e6-e5 f6-f2 e5-e4 f2-e2 e7-e5 h0-f1 e5-g5"),
      pikafishEntry("c3-c4", 2, 1, -71, "c3-c4 c5-e5 e2-g2 h9-i7 g4-g5 e7-d7 c4-c5 c6-c5 e3-e4 e5-d5 b0-c2 i9-h9 c2-e3 c9-e7 h0-f1 h9-h3 i0-h0 h3-f3 e4-e5 d5-g5"),
      pikafishEntry("h0-g2", 3, 1, -84, "h0-g2 g5-g4 i2-g4 h9-g7 f6-g6 e7-d7")
    ])
  }),
  Object.freeze({
    fen: "1heakaehr/r3c4/7c1/p1p1p1pCp/9/P8/2P1PCP1P/9/4K4/RHEA1AEHR b",
    entries: Object.freeze([
      pikafishEntry("e1-e6", 1, 100, 354, "e1-e6 h9-g7 e6-e4 a9-a7 a1-f1 f6-f3 h2-e2 a7-d7 e4-i4 e8-d8"),
      pikafishEntry("e3-e4", 2, 87, 310, "e3-e4 b9-c7 h2-e2 f6-f1 a1-a2 e8-e9 e4-e5 d9-e8 h0-g2 h9-g7 e5-e6 i9-h9 e6-f6 c9-e7"),
      pikafishEntry("h2-e2", 3, 84, 298, "h2-e2 h9-g7 e3-e4 b9-c7 i0-i2 e8-e9 i2-f2 f6-f3 g3-g4 f3-i3 e4-e5")
    ])
  }),
  Object.freeze({
    fen: "rh1a1ae1r/5k3/1c2e3h/4p1C1p/p1p6/4c4/P1P1P1P1P/4E4/4K2C1/RHEA1A1HR r",
    entries: Object.freeze([
      pikafishEntry("e6-e5", 1, 100, 55, "e6-e5 i2-g3 h8-g8 g3-h5 g6-g5 f1-e1 a9-a8 e1-e0 b9-c7 b0-d1"),
      pikafishEntry("g3-h3", 2, 96, 53, "g3-h3 e5-b5 b9-c7 f1-e1 i9-i7 e1-e0 i7-f7 b0-d1"),
      pikafishEntry("h8-g8", 3, 1, -28, "h8-g8 e5-b5 g3-g5 i0-h0 h9-i7 f1-e1 i9-h9")
    ])
  }),
  Object.freeze({
    fen: "rh1akae2/8r/c3e1c1h/p1p3p1p/1C7/2P1p1P2/P7P/H2RE4/1C7/R1EAKA1H1 r",
    entries: Object.freeze([
      pikafishEntry("a9-b9", 1, 100, 70, "a9-b9 d0-e1 a7-c6 i1-h1 c6-e5 h1-h9 b8-e8 h9-h6 b4-b2 e1-d2 e7-g9"),
      pikafishEntry("a7-c6", 2, 94, 66, "a7-c6 i1-h1 h9-g7 h1-h7 c6-e5 h7-g7 d7-d6 g7-h7 e5-d3"),
      pikafishEntry("h9-g7", 3, 89, 62, "h9-g7 g3-g4 a9-b9 b0-c2 a7-c6 g4-g5 e7-g5")
    ])
  }),
  Object.freeze({
    fen: "1he1kae1r/r3a4/1c4h2/p1pCp1p1p/7c1/9/P1P1P1P1P/4E2C1/9/RHEAKA1HR r",
    entries: Object.freeze([
      pikafishEntry("d3-g3", 1, 100, 27, "d3-g3 h4-b4 b9-c7 g0-e2 h9-i7 i0-h0 i9-h9 b0-a2 h7-g7 h0-h9 i7-h9 e1-d0 c6-c5 a1-h1 h9-f8 f0-e1"),
      pikafishEntry("b9-c7", 2, 81, 22, "b9-c7 h4-b4 d3-g3 c3-c4 a9-a8 i0-h0 h9-f8"),
      pikafishEntry("g6-g5", 3, 30, 8, "g6-g5 h4-i4 h9-i7 b2-e2 b9-c7 e3-e4 a9-b9")
    ])
  }),
  Object.freeze({
    fen: "rh1akaeh1/8r/1c2e2c1/p1p1p1p2/8p/2P6/P3P1P1P/EC3C3/9/RH1AKAEHR r",
    entries: Object.freeze([
      pikafishEntry("b9-c7", 1, 100, -19, "b9-c7 b0-d1 h9-g7 h0-i2 i6-i5 i2-h4 i5-i4 h4-f5"),
      pikafishEntry("h9-g7", 2, 98, -21, "h9-g7 h0-i2 b9-c7 i2-h4 g6-g5 b0-d1 d9-e8 a0-c0 a9-d9 c3-c4 c5-c4 c0-c4 c7-d5 c4-d4"),
      pikafishEntry("d9-e8", 3, 94, -24, "d9-e8 c3-c4 h9-g7 h0-i2 i6-i5 i2-h4 i5-i4 c4-c5 a7-c5 b2-b4 g6-g5 i1-i4 i9-i4 b4-i4 c5-e7")
    ])
  }),
  Object.freeze({
    fen: "rhek1a1hr/4a4/2c5e/pcp1p1pCp/9/2P6/P3P1P1P/R1C6/9/1HEAKAEHR r",
    entries: Object.freeze([
      pikafishEntry("a7-b7", 1, 100, 258, "a7-b7 b3-b9 b7-b9 h0-f1 h9-g7 b0-a2 b9-b2 c2-e2 i9-h9 e2-h2"),
      pikafishEntry("i9-i7", 2, 78, 201, "i9-i7 b0-a2 a7-b7 a0-b0 c5-c4 b3-b9 b7-b0 a2-b0 c4-c3 c2-c7 i7-c7 h0-g2 c3-d3 i0-h0 c7-c0 d0-d1 c0-c1 d1-d0"),
      pikafishEntry("h9-g7", 3, 78, 200, "h9-g7 b0-a2 g6-g5 h0-f1 g7-f5 i0-h0 i9-h9 c2-c1 c7-e7 a0-b0 b9-c7 d0-e0")
    ])
  }),
  Object.freeze({
    fen: "rhe1kaehr/1c2a4/9/p1p3p1p/4p4/9/P1c1P1P1P/6C2/4AC3/RHEAK1EHR r",
    entries: Object.freeze([
      pikafishEntry("b9-a7", 1, 100, 59, "b9-a7 c6-b6 h9-i7 c0-e2 i9-h9 b0-d1 a7-c8 b6-b4 c8-d6 a0-d0"),
      pikafishEntry("h9-i7", 2, 77, 36, "h9-i7 b1-c1 b9-a7 c6-c7 a9-b9 b0-a2 g7-e7 c0-e2 i9-h9 a0-b0 b9-b0 a2-b0"),
      pikafishEntry("i9-i7", 3, 75, 34, "i9-i7 b1-c1 g7-e7 h0-g2 b9-a7 i0-h0 a7-c6 c1-c6 e7-e4 c0-e2 f8-f9 g2-e3")
    ])
  }),
  Object.freeze({
    fen: "1heakaehr/9/r6c1/1c2p1p1p/p1p6/9/P1P1P1P1P/1CH3C2/3KA4/R1E2AEHR b",
    entries: Object.freeze([
      pikafishEntry("a2-d2", 1, 100, 264, "a2-d2 g7-d7 b3-c3 d8-d9 c4-c5 c6-c5 c3-c7 d9-e9"),
      pikafishEntry("b3-c3", 2, 76, 240, "b3-c3 d8-d9 c4-c5 c6-c5 c3-c7 c9-e7 a2-b2 g7-c7 b2-b7 c7-c0 d0-e1 d9-e9"),
      pikafishEntry("b0-c2", 3, 1, 143, "b0-c2 d8-d9 c2-d4 d9-e9 b3-c3 c9-e7 h2-d2 h9-i7 a2-b2 b7-a7 d4-f5")
    ])
  }),
  Object.freeze({
    fen: "1hea1ae1r/3k5/r1c3h2/p1p1p1p1p/9/9/P1P1P1PcP/C3E1C1H/4A4/RHE1KA2R b",
    entries: Object.freeze([
      pikafishEntry("a2-b2", 1, 100, -79, "a2-b2 g6-g5 g0-e2 c6-c5 i0-h0 b9-c7 d1-e1 a6-a5 e1-e0 i9-h9 i3-i4"),
      pikafishEntry("d1-e1", 2, 89, -90, "d1-e1 b9-c7 a2-b2 a9-a8 e1-e0 a8-d8 i0-h0 d8-d5"),
      pikafishEntry("c3-c4", 3, 88, -91, "c3-c4 g6-g5 g0-e2 a7-b7 d1-e1 b9-a7 a2-b2 a9-b9 b0-a2 i9-h9")
    ])
  }),
  Object.freeze({
    fen: "1Ceakae1r/9/r5h2/p1p1p1p1p/9/Pc7/2P1P1P1P/9/7CR/RHEAKAEc1 r",
    entries: Object.freeze([
      pikafishEntry("h8-h2", 1, 100, -90, "h8-h2 b5-b2 b9-c7 i0-h0 h2-b2 a2-b2 a9-b9 b2-f2 d9-e8 h0-h7"),
      pikafishEntry("i8-i9", 2, 98, -92, "i8-i9 b5-h5 b9-c7 a2-f2 d9-e8 f2-b2 h8-g8 h9-h6 a9-b9 b2-b9 c7-b9 i0-i1 b9-c7 i1-b1 i6-i5 b1-b0 i9-i6"),
      pikafishEntry("a9-a7", 3, 80, -110, "a9-a7 a2-b2 b0-b5 b2-b5 h8-b8 i0-h0 a7-f7 h9-h6 f7-e7 h6-h4")
    ])
  }),
  Object.freeze({
    fen: "r1e1kaeh1/4a4/1ch5r/pCp1p1p1p/9/7cP/P1P1P1P2/E5H1C/9/RH1AKAE1R b",
    entries: Object.freeze([
      pikafishEntry("g3-g4", 1, 100, 38, "g3-g4 i9-h9 i2-h2 c6-c5 h0-g2 b3-b5 h5-h7 g6-g5 g4-g5 b5-g5 g2-f4 b9-c7 h7-c7"),
      pikafishEntry("h5-b5", 2, 99, 37, "h5-b5 i9-h9 h0-g2 b9-c7 g3-g4 c6-c5 b5-b4 c7-d5 a3-a4 a9-c9 a0-a3 c5-c4 c3-c4 c9-c4 a3-b3 c4-c2 b4-b9 a7-c9"),
      pikafishEntry("i2-f2", 3, 80, 18, "i2-f2 i9-h9 h5-h2 c6-c5 c0-e2 b9-c7 h0-i2 d9-e8 h2-g2 a9-d9 f2-f4")
    ])
  }),
  Object.freeze({
    fen: "rhe1kae1r/1c2a4/c5h2/p1p1p1p2/8p/8P/P1P1P1P2/R1C2C2E/9/1HEAKA1HR b",
    entries: Object.freeze([
      pikafishEntry("b1-b6", 1, 100, 102, "b1-b6 c6-c5 b0-c2 c7-c3 a0-b0 b9-c7 i4-i5 i7-g9 g3-g4 a7-b7 i0-h0"),
      pikafishEntry("b1-b2", 2, 89, 91, "b1-b2 h9-f8 b2-f2 a7-b7 a2-e2 f7-g7 i4-i5 i7-g9"),
      pikafishEntry("a2-b2", 3, 88, 90, "a2-b2 c7-c8 i4-i5 i7-g9 g3-g4 c6-c5 i0-i3 h9-g7 c0-e2 b9-c7 g2-f4 i9-h9 b0-d1")
    ])
  }),
  Object.freeze({
    fen: "rh1a1aehr/4k4/1c2ec3/p1p3p1p/3Cp4/9/P1P1P1P1P/2H6/7C1/R1EAKAEHR r",
    entries: Object.freeze([
      pikafishEntry("e6-e5", 1, 100, 276, "e6-e5 e4-e5 d4-e4 e1-d1 i9-i7 d0-e1 i7-d7 b2-d2 a9-b9 d1-d0"),
      pikafishEntry("a9-b9", 2, 1, 138, "a9-b9 e1-e0 d4-d2 d0-e1 b9-b2 e1-d2 b2-b1 d2-e1 h8-b8 f2-f1 b1-b2 f1-f2"),
      pikafishEntry("h8-e8", 3, 1, 117, "h8-e8 e1-e0 h9-g7 d0-e1 i9-h9 b0-a2 g6-g5 h0-i2 g7-f5")
    ])
  })
]);

export const DEFAULT_OPENING_BOOK = buildDefaultOpeningBook();

export function createOpeningBook(data = {}, options = {}) {
  const spec = Array.isArray(data) ? { lines: data } : data ?? {};
  const positions = new Map();
  const initialPosition = normalizeInitialPosition(
    spec.initialPosition ?? options.initialPosition ?? spec.initialFen ?? options.initialFen
  );

  if (spec.baseBook || options.baseBook) {
    addBookPositions(positions, spec.baseBook ?? options.baseBook, { aggregate: true });
  }

  if (spec.positions || options.positions) {
    addBookPositions(positions, spec.positions ?? options.positions, {
      aggregate: options.aggregatePositions === true
    });
  }

  const lineDefaults = {
    ...(options.defaults ?? {}),
    ...(spec.defaults ?? {})
  };
  const aggregateLines = options.aggregateLines !== false;

  for (const line of spec.lines ?? options.lines ?? []) {
    const entries = normalizeOpeningLine(line, lineDefaults);
    addOpeningLine(positions, entries, { initialPosition, aggregate: aggregateLines });
  }

  const aggregateRecords = options.aggregateRecords !== false;
  for (const record of spec.records ?? options.records ?? []) {
    addOpeningRecord(positions, record, {
      initialPosition,
      defaults: lineDefaults,
      aggregate: aggregateRecords
    });
  }

  return freezeOpeningPositions(positions);
}

export function createOpeningBookFromText(text, options = {}) {
  return createOpeningBook({
    baseBook: options.baseBook,
    positions: options.positions,
    initialPosition: options.initialPosition,
    initialFen: options.initialFen,
    defaults: options.defaults,
    records: options.records,
    lines: parseOpeningBookText(text)
  }, options);
}

export function createOpeningBookFromRecords(records, options = {}) {
  return createOpeningBook({
    baseBook: options.baseBook,
    positions: options.positions,
    initialPosition: options.initialPosition,
    initialFen: options.initialFen,
    defaults: options.defaults,
    records
  }, options);
}

export function createOpeningBookFromGames(data = {}, options = {}) {
  const spec = Array.isArray(data) ? { games: data } : data ?? {};
  const records = aggregateOpeningGameRecords(spec.games ?? [], {
    ...options,
    initialPosition: spec.initialPosition ?? spec.initialFen ?? spec.startFen ?? options.initialPosition ?? options.initialFen,
    maxPly: spec.maxPly ?? spec.maxPlies ?? spec.plies ?? options.maxPly ?? options.maxPlies ?? options.plies,
    minGames: spec.minGames ?? options.minGames,
    source: spec.source ?? options.source,
    name: spec.name ?? options.name,
    idea: spec.idea ?? options.idea,
    tags: uniqueTags([
      ...normalizeTags(options.tags),
      ...normalizeTags(spec.tags),
      "game-db"
    ])
  });

  return createOpeningBookFromRecords(records, {
    ...options,
    initialPosition: spec.initialPosition ?? spec.initialFen ?? spec.startFen ?? options.initialPosition ?? options.initialFen,
    aggregateRecords: true
  });
}

export function createOpeningBookFromCsv(text, options = {}) {
  return createOpeningBookFromRecords(parseOpeningBookCsv(text, options), options);
}

export function parseOpeningBookText(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line, index) => parseOpeningBookLine(line, index + 1))
    .filter(Boolean);
}

export function parseOpeningBookCsv(text, options = {}) {
  const delimiter = options.delimiter ?? detectCsvDelimiter(text);
  const rows = parseDelimitedRows(String(text), delimiter);
  if (rows.length === 0) return [];

  const headers = rows[0].map(normalizeCsvHeader);
  return rows.slice(1).map((row, index) => {
    const record = {};

    for (let column = 0; column < headers.length; column += 1) {
      const key = headers[column];
      const value = row[column]?.trim() ?? "";
      if (!key || value === "") continue;
      record[key] = value;
    }

    if (!record.moves && !record.line && !record.pv && !record.move) {
      throw new Error(`Opening CSV row ${index + 2} requires a moves, line, pv, or move column.`);
    }

    return record;
  });
}

export function mergeOpeningBooks(...books) {
  const positions = new Map();
  for (const book of books) {
    addBookPositions(positions, book, { aggregate: true });
  }
  return freezeOpeningPositions(positions);
}

export function lookupOpeningBook(position, options = {}) {
  const book = options.book ?? DEFAULT_OPENING_BOOK;
  if (book === false) return null;

  let entries = book[positionKey(position)] ?? [];
  let source = "opening-book";
  if (entries.length === 0 && options.openingHeuristics !== false && isOpeningPhase(position)) {
    entries = heuristicOpeningEntries(position);
    source = "opening-heuristic";
  }
  if (entries.length === 0) return null;

  const bannedMoveKeys = new Set((options.bannedMoves ?? []).map(toBookMoveKey));
  const legalMoves = generateLegalMoves(position, position.turn);
  const legalEntries = entries
    .map((entry) => resolveBookEntry(position, entry, legalMoves))
    .filter((entry) => entry && !bannedMoveKeys.has(moveKey(entry.move)))
    .sort(compareBookEntries);

  if (legalEntries.length === 0) return null;

  return {
    source,
    key: positionKey(position),
    move: legalEntries[0].move,
    entry: legalEntries[0],
    entries: legalEntries
  };
}

export function bookMoveToCandidate(entry) {
  return {
    move: entry.move,
    score: entry.weight,
    principalVariation: [entry.move],
    book: {
      name: entry.name,
      idea: entry.idea,
      tags: entry.tags,
      weight: entry.weight,
      database: entry.database
    }
  };
}

function resolveBookEntry(position, entry, legalMoves) {
  const parsed = parsePortableMoveNotation(position, entry.move);
  const legalMove = legalMoves.find((move) => sameMove(move, parsed));
  if (!legalMove) return null;

  return {
    ...entry,
    move: annotateMove(position, legalMove),
    notation: moveToNotation(legalMove)
  };
}

function freezeBookEntry(entry, options = {}) {
  const database = freezeDatabaseMetadata(entry.database);
  return Object.freeze({
    ...entry,
    move: canonicalMoveNotation(entry.move, options.position),
    name: entry.name ?? "Imported Opening Continuation",
    weight: normalizeWeight(entry.weight),
    idea: entry.idea ?? "This continuation comes from imported opening data and is weighted by its source frequency.",
    tags: Object.freeze(normalizeTags(entry.tags)),
    ...(database ? { database } : {})
  });
}

function toBookMoveKey(move) {
  return moveKey(typeof move === "string" ? parseMoveNotation(move) : move);
}

function buildDefaultOpeningBook() {
  const positions = new Map();
  addEntries(positions, INITIAL_FEN, ROOT_ENTRIES);
  addEntries(positions, AFTER_RED_CENTRAL_CANNON, CENTRAL_CANNON_RESPONSES);

  for (const line of OPENING_LINES) {
    addOpeningLine(positions, line);
  }

  for (const position of PIKAFISH_OPENING_POSITIONS) {
    addEntries(positions, position.fen, position.entries);
  }
  addPikafishPrincipalVariationContinuations(positions);

  return freezeOpeningPositions(positions);
}

function pikafishEntry(move, rank, weight, engineScore, pv) {
  const scoreText = engineScore >= 0 ? `+${engineScore}` : String(engineScore);
  const label = rank === 1 ? "best" : `candidate ${rank}`;
  return freezeBookEntry({
    move,
    name: `Pikafish ${label}: ${move}`,
    weight,
    idea: `Pikafish ranks ${move} as ${label} in this position at depth 8, score ${scoreText} cp. Principal variation: ${pv}.`,
    tags: ["oracle", "pikafish", "generated", "opening", rank === 1 ? "best" : "alternative"],
    database: {
      source: "Pikafish",
      engineScore,
      principalVariation: pv
    },
    principalVariation: pv
  });
}

function addPikafishPrincipalVariationContinuations(positions) {
  for (const position of PIKAFISH_OPENING_POSITIONS) {
    for (const entry of position.entries) {
      addLegalPrincipalVariationPrefix(positions, parseFen(position.fen), entry, entry.principalVariation, {
        includeFirst: false
      });
    }
  }
}

function addLegalPrincipalVariationPrefix(positions, initialPosition, entry, principalVariation, options = {}) {
  const moves = extractMoveTokens(principalVariation ?? "");
  if (moves.length < 2) return;

  let position = initialPosition;

  for (let index = 0; index < moves.length; index += 1) {
    const continuation = principalVariationContinuationEntry(entry, moves[index], index, moves.join(" "));
    let normalized;
    let nextPosition;

    try {
      normalized = freezeBookEntry(continuation, { position });
      if (index === 0 && normalized.move !== entry.move) break;
      nextPosition = applyBookMove(position, normalized.move);
    } catch {
      break;
    }

    if (index > 0 || options.includeFirst !== false) {
      addEntries(positions, positionKey(position), [normalized], { aggregate: options.aggregate });
    }
    position = nextPosition;
  }
}

function principalVariationContinuationEntry(entry, move, index, principalVariation) {
  if (index === 0) return entry;

  const source = entry.database?.source ?? entry.source ?? "Oracle";
  return {
    move,
    name: `${source} PV continuation: ${move}`,
    weight: Math.max(1, entry.weight - index * 8),
    idea: `Continues the ${source} principal variation after ${entry.move}. Source PV: ${principalVariation}.`,
    tags: uniqueTags([...entry.tags, "pv-continuation"]),
    database: {
      ...entry.database,
      principalVariation,
      sourceMove: entry.move,
      pvPly: index + 1
    },
    principalVariation
  };
}

function addOpeningLine(positions, line, options = {}) {
  let position = options.initialPosition ?? createInitialPosition();

  for (const entry of line) {
    const normalized = freezeBookEntry(entry, { position });
    addEntries(positions, positionKey(position), [normalized], { aggregate: options.aggregate });
    position = applyBookMove(position, normalized.move);
  }
}

function addEntries(positions, key, entries, options = {}) {
  const byMove = positions.get(key) ?? new Map();

  for (const entry of entries) {
    const normalized = freezeBookEntry(entry);
    const existing = byMove.get(normalized.move);
    if (existing && options.aggregate) {
      byMove.set(normalized.move, mergeBookEntries(existing, normalized));
    } else if (!existing || normalized.weight > existing.weight) {
      byMove.set(normalized.move, normalized);
    }
  }

  positions.set(key, byMove);
}

function freezeOpeningPositions(positions) {
  return Object.freeze(Object.fromEntries(
    [...positions.entries()].map(([key, entries]) => [
      key,
      Object.freeze([...entries.values()].sort(compareBookEntries))
    ])
  ));
}

function compareBookEntries(a, b) {
  return b.weight - a.weight || bookEntryMove(a).localeCompare(bookEntryMove(b));
}

function bookEntryMove(entry) {
  return entry.move?.notation ?? entry.notation ?? entry.move ?? "";
}

function addBookPositions(positions, book, options = {}) {
  if (!book) return;

  if (Array.isArray(book)) {
    for (const record of book) {
      addEntries(positions, record.key ?? record.fen, record.entries ?? [], options);
    }
    return;
  }

  for (const [key, entries] of Object.entries(book)) {
    addEntries(positions, key, entries, options);
  }
}

function mergeBookEntries(existing, incoming) {
  return freezeBookEntry({
    ...existing,
    weight: existing.weight + incoming.weight,
    tags: uniqueTags([...existing.tags, ...incoming.tags]),
    sources: (existing.sources ?? 1) + (incoming.sources ?? 1),
    database: mergeDatabaseMetadata(existing.database, incoming.database)
  });
}

function aggregateOpeningGameRecords(games, options = {}) {
  const initialPosition = normalizeInitialPosition(options.initialPosition ?? options.initialFen);
  const maxPly = normalizeGamePlyLimit(options.maxPly ?? options.maxPlies ?? options.plies ?? 40);
  const minGames = normalizeMinimumGames(options.minGames ?? 1);
  const groups = new Map();

  for (let gameIndex = 0; gameIndex < games.length; gameIndex += 1) {
    const game = games[gameIndex];
    const moves = normalizeGameMoves(game);
    const result = normalizeGameResult(game);
    let position = normalizeInitialPosition(
      game?.initialPosition
        ?? game?.initialFen
        ?? game?.startFen
        ?? game?.fen
        ?? initialPosition
    );

    for (let ply = 0; ply < Math.min(moves.length, maxPly); ply += 1) {
      const moveText = gameMoveText(moves[ply], gameIndex, ply);
      const legalMove = resolveGameBookMove(position, moveText, gameIndex, ply);
      const notation = moveToNotation(legalMove);
      const key = positionKey(position);
      const groupKey = `${key}|${notation}`;
      const group = groups.get(groupKey) ?? {
        fen: key,
        move: notation,
        games: 0,
        resultGames: 0,
        redWins: 0,
        blackWins: 0,
        draws: 0,
        sources: new Set(),
        years: new Set(),
        tags: new Set(normalizeTags(options.tags))
      };

      group.games += 1;
      if (result === "red") {
        group.resultGames += 1;
        group.redWins += 1;
      } else if (result === "black") {
        group.resultGames += 1;
        group.blackWins += 1;
      } else if (result === "draw") {
        group.resultGames += 1;
        group.draws += 1;
      }

      const source = game?.source ?? game?.database ?? game?.db ?? options.source;
      if (source) group.sources.add(String(source));
      const year = normalizeOptionalNumber(game?.year);
      if (year !== null) group.years.add(Math.round(year));
      for (const tag of normalizeTags(game?.tags)) group.tags.add(tag);
      groups.set(groupKey, group);
      position = makeMove(position, legalMove);
    }
  }

  return [...groups.values()]
    .filter((group) => group.games >= minGames)
    .sort((a, b) => a.fen.localeCompare(b.fen) || a.move.localeCompare(b.move))
    .map((group) => gameGroupRecord(group, options));
}

function normalizeGameMoves(game) {
  if (Array.isArray(game)) return game;
  if (typeof game === "string") return extractMoveTokens(game);

  const moves = game?.moves ?? game?.line ?? game?.pv;
  if (Array.isArray(moves)) return moves;
  if (typeof moves === "string") return extractMoveTokens(moves);

  throw new Error("Opening game record requires moves.");
}

function normalizeGameResult(game) {
  const value = typeof game === "object" && game !== null
    ? game.result ?? game.outcome ?? game.winner
    : null;
  if (value === undefined || value === null || value === "") return null;

  const normalized = String(value).trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (["1-0", "red", "r", "red-win", "redwin"].includes(normalized)) return "red";
  if (["0-1", "black", "b", "black-win", "blackwin"].includes(normalized)) return "black";
  if (["1/2-1/2", "0.5-0.5", "draw", "d", "tie"].includes(normalized)) return "draw";
  return null;
}

function gameMoveText(move, gameIndex, ply) {
  const value = typeof move === "string" ? move : move?.move ?? move?.notation;
  if (!value) {
    throw new Error(`Opening game ${gameIndex + 1} move ${ply + 1} has no move notation.`);
  }
  return value;
}

function resolveGameBookMove(position, notation, gameIndex, ply) {
  const parsed = parsePortableMoveNotation(position, notation);
  const legalMove = generateLegalMoves(position, position.turn)
    .find((move) => sameMove(move, parsed));

  if (!legalMove) {
    throw new Error(`Illegal opening game move ${notation} in game ${gameIndex + 1} at ply ${ply + 1} from ${positionKey(position)}`);
  }

  return legalMove;
}

function gameGroupRecord(group, options) {
  const resultStats = group.resultGames > 0
    ? {
        redWins: group.redWins,
        blackWins: group.blackWins,
        draws: group.draws,
        redWinRate: group.redWins / group.resultGames,
        blackWinRate: group.blackWins / group.resultGames,
        drawRate: group.draws / group.resultGames
      }
    : {};
  const sources = [...group.sources];
  const years = [...group.years].sort((a, b) => a - b);

  return {
    fen: group.fen,
    move: group.move,
    games: group.games,
    ...resultStats,
    source: sources.length > 0 ? sources.join(", ") : options.source,
    year: years.length === 1 ? years[0] : undefined,
    name: options.name ?? "Game Database Continuation",
    idea: options.idea ?? "This continuation is aggregated from raw game records and weighted by early-game popularity and results.",
    tags: uniqueTags([...group.tags, "game-db"])
  };
}

function addOpeningRecord(positions, record, options = {}) {
  if (!record) return;

  if (isOpeningLineRecord(record)) {
    addOpeningLineRecord(positions, record, options);
    return;
  }

  if (!record.move) {
    throw new Error("Opening database record requires either a move or a moves array.");
  }

  const position = normalizeInitialPosition(record.key ?? record.fen ?? options.initialPosition);
  const key = record.key ?? record.fen ?? positionKey(position);
  const entry = normalizeDatabaseMove(record, record.move, position.turn, 0, options.defaults, position);
  addEntries(positions, key, [entry], { aggregate: options.aggregate });
  addLegalPrincipalVariationPrefix(positions, position, entry, record.principalVariation, {
    includeFirst: false,
    aggregate: options.aggregate
  });
}

function addOpeningLineRecord(positions, record, options = {}) {
  const moves = normalizeRecordMoves(record);
  let position = normalizeRecordInitialPosition(record, options);

  for (let index = 0; index < moves.length; index += 1) {
    const moveSpec = moves[index];
    const move = typeof moveSpec === "string" ? moveSpec : moveSpec.move ?? moveSpec.notation;
    const entry = normalizeDatabaseMove(record, moveSpec, position.turn, index, options.defaults, position);
    addEntries(positions, positionKey(position), [entry], { aggregate: options.aggregate });
    position = applyBookMove(position, move ?? entry.move);
  }
}

function isOpeningLineRecord(record) {
  return Array.isArray(record)
    || typeof record === "string"
    || Array.isArray(record.moves)
    || typeof record.moves === "string"
    || Array.isArray(record.line)
    || typeof record.line === "string"
    || Array.isArray(record.pv)
    || typeof record.pv === "string";
}

function normalizeRecordMoves(record) {
  if (Array.isArray(record)) return record;
  if (typeof record === "string") return extractMoveTokens(record);

  const moves = record.moves ?? record.line ?? record.pv;
  if (Array.isArray(moves)) return moves;
  if (typeof moves === "string") return extractMoveTokens(moves);

  throw new Error("Opening database line record requires moves.");
}

function normalizeRecordInitialPosition(record, options) {
  const explicit = record.initialPosition
    ?? record.initialFen
    ?? (record.moves || record.line || record.pv ? record.fen ?? record.key : null);

  return normalizeInitialPosition(explicit ?? options.initialPosition);
}

function normalizeDatabaseMove(record, moveSpec, side, index, defaults = {}, position = null) {
  const moveRecord = typeof moveSpec === "string"
    ? { move: moveSpec }
    : moveSpec;
  const move = moveRecord.move ?? moveRecord.notation;
  if (!move) {
    throw new Error(`Opening database record ${index + 1} has no move.`);
  }

  const metadata = {
    ...defaults,
    ...record,
    ...moveRecord
  };
  const database = freezeDatabaseMetadata(normalizeDatabaseMetadata(metadata, side));
  const name = metadata.name
    ?? metadata.opening
    ?? metadata.label
    ?? `Database Opening Continuation ${index + 1}`;
  const idea = metadata.idea
    ?? database.summary
    ?? "This continuation is weighted by structured opening-database popularity and result statistics.";
  const tags = uniqueTags([
    ...normalizeTags(defaults.tags),
    ...normalizeTags(record.tags),
    ...normalizeTags(moveRecord.tags),
    "imported",
    "database"
  ]);

  return freezeBookEntry({
    move,
    name,
    idea,
    tags,
    weight: recordWeight(metadata, database),
    database
  }, { position });
}

function normalizeDatabaseMetadata(record, side) {
  const games = normalizeOptionalNumber(record.games ?? record.count ?? record.frequency ?? record.played);
  const redWins = normalizeOptionalNumber(record.redWins ?? record.redWin ?? record.red);
  const blackWins = normalizeOptionalNumber(record.blackWins ?? record.blackWin ?? record.black);
  const draws = normalizeOptionalNumber(record.draws ?? record.draw);
  const resultGames = games ?? sumDefined(redWins, blackWins, draws);
  const redWinRate = normalizeRate(record.redWinRate ?? record.redRate, redWins, resultGames);
  const blackWinRate = normalizeRate(record.blackWinRate ?? record.blackRate, blackWins, resultGames);
  const drawRate = normalizeRate(record.drawRate, draws, resultGames);
  const sideWinRate = normalizeRate(record.sideWinRate ?? record.winRate);
  const sideLossRate = normalizeRate(record.sideLossRate ?? record.lossRate);
  const expectedScore = normalizeExpectedScore(record.expectedScore ?? record.expected)
    ?? expectedScoreForSide({
      side,
      redWinRate,
      blackWinRate,
      drawRate,
      sideWinRate,
      sideLossRate
    });
  const engineScore = normalizeOptionalNumber(record.engineScore ?? record.cp ?? record.centipawns);
  const source = record.source
    ?? (typeof record.database === "string" ? record.database : record.database?.source)
    ?? record.db;
  const year = normalizeOptionalNumber(record.year);

  return {
    side,
    ...(resultGames ? { games: resultGames } : {}),
    ...(redWinRate !== null ? { redWinRate } : {}),
    ...(drawRate !== null ? { drawRate } : {}),
    ...(blackWinRate !== null ? { blackWinRate } : {}),
    ...(expectedScore !== null ? { expectedScore } : {}),
    ...(engineScore !== null ? { engineScore } : {}),
    ...(source ? { source } : {}),
    ...(year ? { year } : {})
  };
}

function recordWeight(record, database) {
  if (record.weight !== undefined) return normalizeWeight(record.weight);

  const popularity = normalizeWeight(database.games ?? record.count ?? record.frequency ?? 1);
  const resultBonus = database.expectedScore === undefined
    ? 0
    : Math.round((database.expectedScore - 0.5) * 120);
  const engineBonus = database.engineScore === undefined
    ? 0
    : Math.round(clamp(database.engineScore, -200, 200) / 4);

  return Math.max(1, popularity + resultBonus + engineBonus);
}

function freezeDatabaseMetadata(database) {
  if (!database) return null;
  const normalized = {
    ...database
  };
  const summary = database.summary ?? summarizeDatabaseMetadata(normalized);
  if (summary) normalized.summary = summary;
  return Object.freeze(normalized);
}

function mergeDatabaseMetadata(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const games = (existing.games ?? 0) + (incoming.games ?? 0);
  const weightA = existing.games ?? 1;
  const weightB = incoming.games ?? 1;
  const source = uniqueTags([existing.source, incoming.source]).join(", ");
  const merged = {
    side: existing.side ?? incoming.side,
    ...(games > 0 ? { games } : {}),
    ...mergeWeightedRate("redWinRate", existing, incoming, weightA, weightB),
    ...mergeWeightedRate("drawRate", existing, incoming, weightA, weightB),
    ...mergeWeightedRate("blackWinRate", existing, incoming, weightA, weightB),
    ...mergeWeightedRate("expectedScore", existing, incoming, weightA, weightB),
    ...mergeWeightedRate("engineScore", existing, incoming, weightA, weightB),
    ...(source ? { source } : {})
  };

  return freezeDatabaseMetadata(merged);
}

function mergeWeightedRate(key, a, b, weightA, weightB) {
  if (a[key] === undefined && b[key] === undefined) return {};
  if (a[key] === undefined) return { [key]: b[key] };
  if (b[key] === undefined) return { [key]: a[key] };
  return {
    [key]: ((a[key] * weightA) + (b[key] * weightB)) / (weightA + weightB)
  };
}

function normalizeOpeningLine(line, defaults = {}) {
  if (Array.isArray(line)) {
    return line.map((entry, index) => normalizeLineMove(entry, defaults, index));
  }

  if (typeof line === "string") {
    return normalizeOpeningLine({ moves: extractMoveTokens(line) }, defaults);
  }

  if (!line || !Array.isArray(line.moves)) {
    throw new Error("Opening line requires a moves array.");
  }

  const lineDefaults = {
    ...defaults,
    name: line.name ?? defaults.name,
    idea: line.idea ?? defaults.idea,
    weight: line.weight ?? line.count ?? line.frequency ?? line.games ?? defaults.weight,
    tags: uniqueTags([...normalizeTags(defaults.tags), ...normalizeTags(line.tags), "imported"])
  };

  return line.moves.map((entry, index) => normalizeLineMove(entry, lineDefaults, index));
}

function normalizeLineMove(entry, defaults, index) {
  if (typeof entry === "string") {
    return {
      move: entry,
      name: defaults.name ?? `Imported Opening Continuation ${index + 1}`,
      idea: defaults.idea,
      weight: defaults.weight,
      tags: defaults.tags
    };
  }

  return {
    ...defaults,
    ...entry,
    tags: uniqueTags([...normalizeTags(defaults.tags), ...normalizeTags(entry.tags)])
  };
}

function parseOpeningBookLine(line, lineNumber) {
  const trimmed = stripOpeningComment(line).trim();
  if (!trimmed) return null;

  const [movePart, ...metadataParts] = trimmed.split("|").map((part) => part.trim()).filter(Boolean);
  const moves = extractMoveTokens(movePart);
  if (moves.length === 0) {
    throw new Error(`Opening book line ${lineNumber} has no moves.`);
  }

  return {
    moves,
    ...parseLineMetadata(metadataParts)
  };
}

function parseLineMetadata(parts) {
  const metadata = {};

  for (const part of parts) {
    const match = part.match(/^([\w-]+)\s*(=|:)\s*(.*)$/);
    if (!match) {
      metadata.name = metadata.name ?? part;
      continue;
    }

    const key = match[1].toLowerCase();
    const value = match[3].trim();
    if (["weight", "count", "frequency", "games"].includes(key)) {
      metadata.weight = normalizeWeight(value);
    } else if (key === "name") {
      metadata.name = value;
    } else if (key === "idea") {
      metadata.idea = value;
    } else if (key === "tags") {
      metadata.tags = normalizeTags(value);
    }
  }

  return metadata;
}

function parseDelimitedRows(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === "\"") {
        if (text[index + 1] === "\"") {
          field += "\"";
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      pushDelimitedRow(rows, row);
      row = [];
      field = "";
    } else if (char === "\r") {
      row.push(field);
      pushDelimitedRow(rows, row);
      row = [];
      field = "";
      if (text[index + 1] === "\n") index += 1;
    } else {
      field += char;
    }
  }

  if (quoted) {
    throw new Error("Opening CSV has an unterminated quoted field.");
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    pushDelimitedRow(rows, row);
  }

  return rows;
}

function pushDelimitedRow(rows, row) {
  const trimmed = row.map((field) => field.trim());
  if (trimmed.every((field) => field === "")) return;
  const first = trimmed.find((field) => field !== "") ?? "";
  if (first.startsWith("#") || first.startsWith("//")) return;
  rows.push(trimmed);
}

function detectCsvDelimiter(text) {
  const firstLine = String(text)
    .split(/\r?\n/)
    .find((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("//");
    }) ?? "";

  return firstLine.includes("\t") ? "\t" : ",";
}

function normalizeCsvHeader(header) {
  const normalized = String(header)
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return CSV_HEADER_ALIASES[normalized] ?? String(header).trim();
}

const CSV_HEADER_ALIASES = Object.freeze({
  moves: "moves",
  line: "moves",
  pv: "moves",
  variation: "moves",
  sequence: "moves",
  move: "move",
  notation: "move",
  bestmove: "move",
  fen: "fen",
  key: "key",
  position: "fen",
  initialfen: "initialFen",
  startfen: "initialFen",
  name: "name",
  opening: "opening",
  label: "label",
  idea: "idea",
  tags: "tags",
  weight: "weight",
  games: "games",
  count: "count",
  frequency: "frequency",
  played: "played",
  redwins: "redWins",
  blackwins: "blackWins",
  draws: "draws",
  redwinrate: "redWinRate",
  redrate: "redRate",
  blackwinrate: "blackWinRate",
  blackrate: "blackRate",
  drawrate: "drawRate",
  expectedscore: "expectedScore",
  expected: "expectedScore",
  sidewinrate: "sideWinRate",
  winrate: "winRate",
  sidelossrate: "sideLossRate",
  lossrate: "lossRate",
  enginescore: "engineScore",
  cp: "engineScore",
  centipawns: "engineScore",
  source: "source",
  db: "db",
  database: "database",
  year: "year"
});

function stripOpeningComment(line) {
  return line.replace(/\s*(#|\/\/).*$/, "");
}

function normalizeInitialPosition(value) {
  if (!value) return createInitialPosition();
  if (typeof value === "string") return parseFen(value);
  return value;
}

function canonicalMoveNotation(move, position = null) {
  if (typeof move !== "string") return moveToNotation(move);
  const parsed = position
    ? parsePortableMoveNotation(position, move)
    : parseMoveNotation(move);
  return moveToNotation(parsed);
}

function normalizeWeight(value) {
  const parsed = Number(value ?? 1);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

function normalizeGamePlyLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 40;
  return Math.max(1, Math.min(200, parsed));
}

function normalizeMinimumGames(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, parsed);
}

function normalizeOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(String(value).replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function sumDefined(...values) {
  const present = values.filter((value) => value !== null && value !== undefined);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0);
}

function normalizeRate(value, count = null, total = null) {
  let parsed = normalizeOptionalNumber(value);
  if (parsed === null && count !== null && total) {
    parsed = count / total;
  }
  if (parsed === null) return null;
  if (parsed > 1) parsed /= 100;
  return clamp(parsed, 0, 1);
}

function normalizeExpectedScore(value) {
  const parsed = normalizeRate(value);
  return parsed === null ? null : parsed;
}

function expectedScoreForSide({
  side,
  redWinRate,
  blackWinRate,
  drawRate,
  sideWinRate,
  sideLossRate
}) {
  if (sideWinRate !== null) {
    const inferredDraw = drawRate ?? (sideLossRate !== null ? Math.max(0, 1 - sideWinRate - sideLossRate) : 0);
    return clamp(sideWinRate + inferredDraw * 0.5, 0, 1);
  }

  if (redWinRate === null && blackWinRate === null && drawRate === null) return null;
  const winRate = side === SIDES.RED ? redWinRate : blackWinRate;
  if (winRate === null) return null;
  return clamp(winRate + (drawRate ?? 0) * 0.5, 0, 1);
}

function summarizeDatabaseMetadata(database) {
  const parts = [];
  if (database.games) parts.push(`${Math.round(database.games)} database games`);
  if (database.expectedScore !== undefined) {
    parts.push(`${Math.round(database.expectedScore * 100)}% expected score for ${database.side}`);
  }
  if (database.engineScore !== undefined) {
    parts.push(`engine prior ${database.engineScore >= 0 ? "+" : ""}${Math.round(database.engineScore)} cp`);
  }
  if (database.source) parts.push(`source ${database.source}`);
  if (database.year) parts.push(String(Math.round(database.year)));

  return parts.length > 0 ? `Database prior: ${parts.join(", ")}.` : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (typeof tags === "string") return uniqueTags(tags.split(",").map((tag) => tag.trim()));
  return uniqueTags(tags);
}

function uniqueTags(tags) {
  return [...new Set(tags.filter(Boolean))];
}

function applyBookMove(position, notation) {
  const parsed = parsePortableMoveNotation(position, notation);
  const legalMove = generateLegalMoves(position, position.turn)
    .find((move) => sameMove(move, parsed));

  if (!legalMove) {
    throw new Error(`Illegal opening-book move ${notation} from ${positionKey(position)}`);
  }

  return makeMove(position, legalMove);
}

function isOpeningPhase(position) {
  return (position.fullmove ?? 1) <= 12 && countPieces(position) >= 24;
}

function countPieces(position) {
  return position.board.reduce((count, piece) => count + (piece ? 1 : 0), 0);
}

function heuristicOpeningEntries(position) {
  return generateLegalMoves(position, position.turn)
    .map((move) => heuristicEntry(position, move))
    .filter(Boolean)
    .sort((a, b) => b.weight - a.weight || a.move.localeCompare(b.move))
    .slice(0, 6)
    .map(freezeBookEntry);
}

function heuristicEntry(position, move) {
  const piece = move.piece;
  const fromFile = fileOf(move.from);
  const toFile = fileOf(move.to);
  const fromRank = rankOf(move.from);
  const toRank = rankOf(move.to);

  if (piece.type === PIECES.HORSE && isHomeHorse(piece.side, fromFile, fromRank)) {
    return {
      move: move.notation,
      name: "Opening Horse Development",
      weight: 86 + centralFileBonus(toFile),
      idea: "Develops a horse toward the center, a reliable early-game priority before the board opens.",
      tags: ["heuristic", "development", "horse"]
    };
  }

  if (piece.type === PIECES.CANNON && toFile === 4) {
    return {
      move: move.notation,
      name: "Heuristic Central Cannon",
      weight: 84,
      idea: "Takes the central file with a cannon to pressure the palace and make the opponent defend accurately.",
      tags: ["heuristic", "central file", "cannon"]
    };
  }

  if (piece.type === PIECES.CANNON && isHomeCannon(piece.side, fromRank)) {
    return {
      move: move.notation,
      name: "Cannon Reposition",
      weight: 58 + centralFileBonus(toFile),
      idea: "Repositions a cannon while keeping attacking options flexible.",
      tags: ["heuristic", "cannon", "flexible"]
    };
  }

  if (piece.type === PIECES.ROOK && isHomeRook(piece.side, fromFile, fromRank)) {
    return {
      move: move.notation,
      name: "Rook Activation",
      weight: 68,
      idea: "Brings a corner rook into play once a lane is available, a major opening priority.",
      tags: ["heuristic", "rook activity"]
    };
  }

  if (piece.type === PIECES.PAWN && Math.abs(toFile - 4) <= 1) {
    return {
      move: move.notation,
      name: "Central Pawn Probe",
      weight: 48,
      idea: "Gains central space with a pawn, useful after the main pieces have begun developing.",
      tags: ["heuristic", "space", "pawn"]
    };
  }

  return null;
}

function isHomeHorse(side, file, rank) {
  const homeRank = side === SIDES.RED ? 9 : 0;
  return rank === homeRank && (file === 1 || file === 7);
}

function isHomeCannon(side, rank) {
  return side === SIDES.RED ? rank === 7 : rank === 2;
}

function isHomeRook(side, file, rank) {
  const homeRank = side === SIDES.RED ? 9 : 0;
  return rank === homeRank && (file === 0 || file === 8);
}

function centralFileBonus(file) {
  return Math.max(0, 4 - Math.abs(file - 4));
}
