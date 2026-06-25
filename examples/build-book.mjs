#!/usr/bin/env node
// Generate a high-quality opening book by querying Pikafish (GPLv3, locally
// installed) across the opening tree. Output is a book.js-compatible JSON
// ({ fen: [{move, weight, score, ...}] }) — pure engine analysis we generate,
// so it carries no third-party-data licensing concerns.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  createInitialPosition, makeMove, toFen, parseMoveNotation, sameMove,
  parseChineseMoveNotation, generateLegalMoves, createLearningEngineBackend
} from "../src/index.js";

// Popular main lines to guarantee deep coverage (Pikafish's root scores are so
// flat that pure score-greedy BFS skips the central cannon). Every position
// along each line is enqueued and analyzed, so the lines players actually reach
// get booked to full depth. Zh notation; replayed from the start.
const SEED_LINES = [
  "炮二平五 馬8進7 傌二進三 卒7進1 俥一平二 車9平8 俥二進六 馬2進3 俥二平三 砲8退1",
  "炮二平五 馬8進7 傌二進三 車9平8 俥一平二 卒7進1 俥二進六 馬2進3",
  "炮二平五 馬2進3 傌二進三 卒7進1 俥一平二 馬8進7 俥二進六 砲8平9",
  "炮八平五 馬2進3 傌八進七 卒3進1 俥九平八 車1平2 俥八進六 馬8進7"
];

const opt = parseArgs(process.argv.slice(2));
if (opt.help) { printUsage(); process.exit(0); }

const engine = createLearningEngineBackend({
  nativePreset: "pikafish", protocol: "uci", fallbackOnNativeError: false,
  engineOptions: opt.threads ? [{ name: "Threads", value: opt.threads }] : []
});

const book = opt.merge ? loadMergeBook(opt.merge) : {}; // fen -> entries[]
const visited = new Set();
let analyzed = 0;
const startedAt = Date.now();

try {
  // BFS. Seed the popular main lines first so they get booked to full depth,
  // then (unless --seeds-only) the start position for breadth.
  const queue = [];
  for (const line of SEED_LINES) {
    let p = createInitialPosition();
    const moves = line.trim().split(/\s+/);
    for (let i = 0; i < moves.length; i += 1) {
      queue.push({ pos: p, ply: i });
      try { p = makeMove(p, parseChineseMoveNotation(p, moves[i])); }
      catch { console.error(`seed move illegal: ${moves[i]} in "${line}"`); break; }
    }
    queue.push({ pos: p, ply: moves.length });
  }
  if (!opt.seedsOnly) queue.push({ pos: createInitialPosition(), ply: 0 });
  while (queue.length && analyzed < opt.budget) {
    const { pos, ply } = queue.shift();
    const fen = toFen(pos);
    if (visited.has(fen)) continue;
    visited.add(fen);

    const dec = await engine.chooseMove(pos, {
      depth: opt.depth, timeLimitMs: opt.time, lines: opt.lines, useBook: false
    });
    analyzed += 1;

    // Collect candidate (move, score) pairs from the multipv alternatives,
    // falling back to the single best move.
    const cands = (dec.explanation?.alternatives ?? [])
      .map((a) => ({ move: a.move, score: a.score }))
      .filter((c) => c.move != null && Number.isFinite(c.score));
    if (!cands.length && dec.bestMove) cands.push({ move: dec.bestMove.notation, score: dec.score ?? 0 });
    if (!cands.length) continue;

    const bestScore = Math.max(...cands.map((c) => c.score));
    // Keep moves within `margin` cp of best = sound book choices.
    const sound = cands.filter((c) => bestScore - c.score <= opt.margin)
      .sort((a, b) => b.score - a.score);

    book[fen] = sound.map((c) => ({
      move: c.move,
      weight: Math.max(1, Math.round(100 - (bestScore - c.score))),
      score: Math.round(c.score),
      tags: ["pikafish"],
      database: { source: "pikafish", depth: dec.depth ?? null }
    }));

    process.stderr.write(`\r  ${analyzed}/${opt.budget} positions  (queue ${queue.length}, ply≤${ply})   `);

    // Expand the top few sound moves to keep the tree relevant + bounded.
    if (ply < opt.maxPly) {
      const expandN = ply < opt.wideUntil ? opt.wide : 1;
      for (const c of sound.slice(0, expandN)) {
        const legal = generateLegalMoves(pos, pos.turn).find((m) => sameMove(m, parseMoveNotation(c.move)));
        if (legal) queue.push({ pos: makeMove(pos, legal), ply: ply + 1 });
      }
    }
  }
  process.stderr.write("\n");

  const payload = {
    meta: {
      source: "pikafish", generated: "build-book.mjs",
      depth: opt.depth, timeMs: opt.time, lines: opt.lines, marginCp: opt.margin,
      maxPly: opt.maxPly, positions: Object.keys(book).length,
      elapsedMs: Date.now() - startedAt
    },
    positions: book
  };
  mkdirSync(dirname(opt.out), { recursive: true });
  writeFileSync(opt.out, JSON.stringify(payload, null, 0));
  console.log(`Wrote ${Object.keys(book).length} positions to ${opt.out} in ${Math.round((Date.now()-startedAt)/1000)}s`);
} finally {
  await engine.close?.();
}

function loadMergeBook(file) {
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    const positions = data.positions ?? data;
    console.error(`Merging into ${Object.keys(positions).length} existing positions from ${file}`);
    return { ...positions };
  } catch (e) {
    console.error(`Could not load --merge ${file}: ${e.message}`);
    return {};
  }
}

function parseArgs(args) {
  const o = { depth: 16, time: 800, lines: 4, margin: 25, maxPly: 16, wide: 3, wideUntil: 6,
    budget: 200, threads: 2, out: "data/opening-book.json", merge: null, seedsOnly: false };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--help" || a === "-h") return { ...o, help: true };
    else if (a === "--merge") o.merge = args[++i];
    else if (a === "--seeds-only") o.seedsOnly = true;
    else if (a === "--depth") o.depth = Number(args[++i]);
    else if (a === "--time") o.time = Number(args[++i]);
    else if (a === "--lines") o.lines = Number(args[++i]);
    else if (a === "--margin") o.margin = Number(args[++i]);
    else if (a === "--max-ply") o.maxPly = Number(args[++i]);
    else if (a === "--wide") o.wide = Number(args[++i]);
    else if (a === "--wide-until") o.wideUntil = Number(args[++i]);
    else if (a === "--budget") o.budget = Number(args[++i]);
    else if (a === "--threads") o.threads = Number(args[++i]);
    else if (a === "--out") o.out = args[++i];
    else throw new Error(`Unknown option: ${a}`);
  }
  return o;
}

function printUsage() {
  console.log(`Usage: node examples/build-book.mjs [options]

Builds an opening book by querying Pikafish across the opening tree (BFS).

  --depth N      Pikafish search depth per position (default 16)
  --time MS      Movetime cap per position (default 800)
  --lines N      MultiPV candidates to request (default 4)
  --margin CP    Keep alternatives within CP of best as book moves (default 25)
  --max-ply N    Expand the tree up to this ply (default 16)
  --wide N       Expand top-N sound moves per node (default 3)
  --wide-until P Use wide expansion until this ply, then top-1 (default 6)
  --budget N     Max positions to analyze (default 200)
  --threads N    Pikafish threads (default 2)
  --out FILE     Output JSON (default data/opening-book.json)

Requires Pikafish installed (npm run install:pikafish).`);
}
