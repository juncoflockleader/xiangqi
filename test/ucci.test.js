import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AsyncUcciSession, UcciSession } from "../src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MOCK_UCCI_PATH = resolve(root, "fixtures/mock-ucci.mjs");

test("UCCI session identifies itself", () => {
  const session = new UcciSession();
  const output = session.handleLine("ucci");

  assert.ok(output.some((line) => line.startsWith("id name")));
  assert.ok(output.some((line) => line.includes("MultiPV")));
  assert.ok(output.some((line) => line.includes("HintLevels")));
  assert.ok(output.some((line) => line.includes("HashEntries")));
  assert.ok(output.some((line) => line.includes("UseBook")));
  assert.ok(output.includes("ucciok"));
});

test("UCCI session searches a FEN position", () => {
  const session = new UcciSession({ depth: 2, timeLimitMs: 1000 });
  session.handleLine("position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const output = session.handleLine("go depth 2 movetime 1000");

  assert.ok(output.some((line) => line.startsWith("info depth 2 score cp")));
  assert.ok(output.some((line) => line.startsWith("info depth 1 currmove")));
  assert.ok(output.some((line) => line.includes("stable true")));
  assert.ok(output.some((line) => line.includes("nodes")));
  assert.ok(output.some((line) => line.includes("qchecks")));
  assert.ok(output.some((line) => /\bqtthits \d+/.test(line)));
  assert.ok(output.some((line) => /\bqttstores \d+/.test(line)));
  assert.ok(output.some((line) => /\bevalhits \d+/.test(line)));
  assert.ok(output.some((line) => /\bevalstores \d+/.test(line)));
  assert.ok(output.some((line) => /\btacthits \d+/.test(line)));
  assert.ok(output.some((line) => /\btactstores \d+/.test(line)));
  assert.ok(output.some((line) => /\btactord \d+/.test(line)));
  assert.ok(output.some((line) => line.includes("ttstores")));
  assert.ok(output.some((line) => line.includes("mdp")));
  assert.ok(output.some((line) => line.includes("razor")));
  assert.ok(output.some((line) => line.includes("singext")));
  assert.ok(output.some((line) => /\brfp \d+/.test(line)));
  assert.ok(output.some((line) => line.includes("pcut")));
  assert.ok(output.some((line) => line.includes("futil")));
  assert.ok(output.some((line) => /\blmp \d+/.test(line)));
  assert.ok(output.some((line) => /\bkiller \d+/.test(line)));
  assert.ok(output.some((line) => /\bkillerhit \d+/.test(line)));
  assert.ok(output.some((line) => /\bcaphist \d+/.test(line)));
  assert.ok(output.some((line) => /\bcheckhist \d+/.test(line)));
  assert.ok(output.some((line) => /\bcheckhm \d+/.test(line)));
  assert.ok(output.some((line) => /\bch \d+/.test(line)));
  assert.ok(output.some((line) => /\bchred \d+/.test(line)));
  assert.ok(output.some((line) => /\bchredm \d+/.test(line)));
  assert.ok(output.some((line) => /\bce \d+/.test(line)));
  assert.ok(output.some((line) => /\bcecap \d+/.test(line)));
  assert.ok(output.some((line) => /\bceblock \d+/.test(line)));
  assert.ok(output.some((line) => /\bceking \d+/.test(line)));
  assert.ok(output.some((line) => line.includes("hmalus")));
  assert.ok(output.some((line) => /\bhgrav \d+/.test(line)));
  assert.ok(output.includes("bestmove e9e2"));
  assert.ok(output.some((line) => line.includes("reason: Wins a rook")));
  assert.ok(output.some((line) => line.includes("go plan: Start with e9e2") || line.includes("go plan: Start with e9-e2")));
  assert.ok(output.some((line) => line.includes("go plan step 1 red engine-choice e9e2")));
});

test("UCCI HashEntries option bounds the transposition cache", () => {
  const session = new UcciSession({ depth: 3, timeLimitMs: 1000 });
  session.handleLine("setoption name HashEntries value 128");
  session.handleLine("position fen 2bakab2/9/4c4/4p4/9/4P4/4C4/9/9/2BAKAB2 r");
  const output = session.handleLine("go depth 3 movetime 1000");

  assert.equal(session.engine.cacheCapacity, 128);
  assert.ok(session.engine.cacheSize <= 128);
  assert.ok(output.some((line) => line.includes("ttstores")));
});

test("UCCI go uses the opening book from startpos by default", () => {
  const session = new UcciSession({ depth: 2, timeLimitMs: 1000 });
  session.handleLine("position startpos");
  const output = session.handleLine("go depth 2 movetime 1000");

  assert.ok(output.some((line) => line.includes("book Central Cannon")));
  assert.ok(output.includes("bestmove h7e7"));
});

test("UCCI UseBook option disables book selection", () => {
  const session = new UcciSession({ depth: 1, timeLimitMs: 500 });
  session.handleLine("setoption name UseBook value false");
  session.handleLine("position startpos");
  const output = session.handleLine("go depth 1 movetime 500");

  assert.equal(output.some((line) => line.includes("book Central Cannon")), false);
  assert.ok(output.some((line) => line.startsWith("info depth 1")));
});

test("UCCI go derives search time from clock controls", () => {
  const session = new UcciSession({ depth: 1, timeLimitMs: 500 });
  session.handleLine("setoption name UseBook value false");
  session.handleLine("position startpos");
  const output = session.handleLine("go depth 1 wtime 30000 btime 20000 winc 1000 binc 500 movestogo 20");

  assert.equal(output.some((line) => line.includes("book Central Cannon")), false);
  assert.ok(output.some((line) => line.startsWith("info depth 1")));
  assert.ok(output.some((line) => line.startsWith("bestmove ")));
});

test("UCCI book command lists available opening entries", () => {
  const session = new UcciSession();
  session.handleLine("position startpos");
  const output = session.handleLine("book");

  assert.ok(output.some((line) => line.includes("h7-e7 Central Cannon")));
});

test("UCCI analyze returns multiple principal variations", () => {
  const session = new UcciSession({ depth: 2, timeLimitMs: 1000 });
  session.handleLine("position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const output = session.handleLine("analyze depth 2 movetime 1000 lines 2");

  assert.ok(output.some((line) => line.startsWith("info multipv 1 depth 2")));
  assert.ok(output.some((line) => line.startsWith("info multipv 2 depth 2")));
  assert.ok(output.some((line) => line.includes("line 1 reason:")));
  assert.ok(output.some((line) => line.includes("line 1 plan: Start with")));
  assert.ok(output.includes("bestmove e9e2"));
});

test("UCCI go multipv delegates to analysis output", () => {
  const session = new UcciSession({ depth: 1, timeLimitMs: 500 });
  session.handleLine("position startpos");
  const output = session.handleLine("go depth 1 movetime 500 multipv 3");

  assert.equal(output.filter((line) => line.startsWith("info multipv ")).length, 3);
  assert.ok(output.some((line) => line.startsWith("bestmove ")));
});

test("async UCCI session can search through a native backend", async () => {
  const session = new AsyncUcciSession({
    command: process.execPath,
    args: [MOCK_UCCI_PATH],
    protocol: "uci",
    depth: 2,
    timeLimitMs: 100,
    startupTimeoutMs: 1000,
    commandTimeoutMs: 1000,
    useBook: false,
    engineOptions: {
      MockTie: true
    }
  });

  try {
    assert.deepEqual(await session.handleLine("isready"), ["readyok"]);
    assert.deepEqual(await session.handleLine("position startpos"), []);
    const output = await session.handleLine("go depth 2 movetime 100 multipv 2");

    assert.equal(output.filter((line) => line.startsWith("info multipv ")).length, 2);
    assert.ok(output.some((line) => line.includes("Native UCI Engine")));
    assert.ok(output.some((line) => line.includes("line 1 plan: Start with h9-g7")));
    assert.ok(output.includes("bestmove h9g7"));
  } finally {
    await session.close();
  }
});

test("xiangqi-ucci CLI can use a native backend from environment", async () => {
  const result = await runUcciCli([
    "ucci",
    "isready",
    "position startpos",
    "go depth 2 movetime 100",
    "quit"
  ].join("\n"), {
    XIANGQI_ENGINE_COMMAND: process.execPath,
    XIANGQI_ENGINE_ARGS: "fixtures/mock-ucci.mjs",
    XIANGQI_ENGINE_PROTOCOL: "uci",
    XIANGQI_ENGINE_OPTIONS: "MockTie=true",
    XIANGQI_ENGINE_USE_BOOK: "false",
    XIANGQI_ENGINE_STARTUP_TIMEOUT_MS: "1000",
    XIANGQI_ENGINE_COMMAND_TIMEOUT_MS: "1000"
  });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /id name Xiangqi Learning Engine/);
  assert.match(result.stdout, /readyok/);
  assert.match(result.stdout, /Native UCI Engine/);
  assert.match(result.stdout, /bestmove h9g7/);
  assert.match(result.stdout, /bye/);
});

test("UCCI MultiPV option changes default go output", () => {
  const session = new UcciSession({ depth: 1, timeLimitMs: 500 });
  session.handleLine("setoption name MultiPV value 2");
  session.handleLine("position startpos");
  const output = session.handleLine("go depth 1 movetime 500");

  assert.equal(output.filter((line) => line.startsWith("info multipv ")).length, 2);
});

test("UCCI banmoves excludes a root move", () => {
  const session = new UcciSession({ depth: 2, timeLimitMs: 1000 });
  session.handleLine("position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  session.handleLine("banmoves e9e2");
  const output = session.handleLine("go depth 2 movetime 1000");

  assert.ok(output.some((line) => line.startsWith("bestmove ")));
  assert.equal(output.includes("bestmove e9e2"), false);
});

test("UCCI position startpos accepts moves", () => {
  const session = new UcciSession({ depth: 1, timeLimitMs: 200 });
  const output = session.handleLine("position startpos moves a9a8 a0a1");

  assert.deepEqual(output, []);
  assert.ok(session.position);
});

test("UCCI pressure reports immediate threats", () => {
  const session = new UcciSession({ depth: 1, timeLimitMs: 500 });
  session.handleLine("position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const output = session.handleLine("pressure limit 1");

  assert.ok(output.some((line) => line.includes("pressure side red")));
  assert.ok(output.some((line) => line.includes("threat e9e2") || line.includes("threat e9-e2")));
  assert.ok(output.some((line) => line.includes("opponent-threat")));
});

test("UCCI review summarizes loaded move history", () => {
  const session = new UcciSession({ depth: 1, timeLimitMs: 500 });
  session.handleLine("position startpos moves h7e7 h0g2");
  const output = session.handleLine("review depth 1 movetime 500");

  assert.ok(output.some((line) => line.includes("review moves 2")));
  assert.ok(output.some((line) => line.includes("book 2")));
  assert.ok(output.some((line) => line.includes("moment 1 score played")));
  assert.ok(output.some((line) => line.includes("moment 1 played plan: Start with")));
  assert.ok(output.some((line) => line.includes("moment 1 best plan: Start with")));
  assert.ok(output.some((line) => line.includes("moment 1 plan comparison:")));
});

test("UCCI reviewmove reviews a candidate in the current position", () => {
  const session = new UcciSession({ depth: 2, timeLimitMs: 1000 });
  session.handleLine("position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const output = session.handleLine("reviewmove e9f9 depth 2 movetime 1000");

  assert.ok(output.some((line) => line.includes("reviewmove played e9f9")));
  assert.ok(output.some((line) => line.includes("blunder")));
  assert.ok(output.some((line) => line.includes("best e9e2")));
  assert.ok(output.some((line) => line.includes("reviewmove score played")));
  assert.ok(output.some((line) => line.includes("reviewmove practice candidate-captures Material tactics")));
  assert.ok(output.some((line) => line.includes("reviewmove played plan: Start with e9-f9")));
  assert.ok(output.some((line) => line.includes("reviewmove best plan: Start with e9-e2")));
  assert.ok(output.some((line) => line.includes("reviewmove plan comparison: Your plan starts with e9-f9")));
  assert.ok(output.some((line) => line.includes("reviewmove reason:")));
  assert.ok(output.includes("bestmove e9e2"));
});

test("UCCI review emits practice focus for key moments", () => {
  const session = new UcciSession({ depth: 2, timeLimitMs: 1000 });
  session.handleLine("position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r moves e9f9");
  const output = session.handleLine("review depth 2 movetime 1000");

  assert.ok(output.some((line) => line.includes("moment 1 practice candidate-captures Material tactics")));
});

test("UCCI reviewmove accepts an explicit move token", () => {
  const session = new UcciSession({ depth: 1, timeLimitMs: 500 });
  session.handleLine("position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r");
  const output = session.handleLine("reviewmove depth 1 move e9f9 movetime 500");

  assert.ok(output.some((line) => line.includes("reviewmove played e9f9")));
  assert.ok(output.includes("bestmove e9e2"));
});

test("UCCI review reports no moves when history is empty", () => {
  const session = new UcciSession();
  session.handleLine("position startpos");

  assert.deepEqual(session.handleLine("review"), ["info string review no moves"]);
});

test("UCCI lesson summarizes reviewed move history as cards", () => {
  const session = new UcciSession({ depth: 1, timeLimitMs: 500 });
  session.handleLine("position startpos moves h7e7 h0g2");
  const output = session.handleLine("lesson depth 1 movetime 500 cards 1");

  assert.ok(output.some((line) => line.includes("lesson cards 1")));
  assert.ok(output.some((line) => line.includes("lesson 1 opening")));
  assert.ok(output.some((line) => line.includes("prompt:")));
  assert.ok(output.some((line) => line.includes("hint 1")));
  assert.ok(output.some((line) => line.includes("lesson 1 score played")));
  assert.ok(output.some((line) => line.includes("lesson 1 played plan: Start with")));
  assert.ok(output.some((line) => line.includes("lesson 1 best plan: Start with")));
  assert.ok(output.some((line) => line.includes("lesson 1 plan comparison:")));
  assert.ok(output.some((line) => line.includes("answer")));
});

test("UCCI lesson emits practice focus for correction cards", () => {
  const session = new UcciSession({ depth: 2, timeLimitMs: 1000 });
  session.handleLine("position fen 4k4/9/4r4/9/9/9/9/9/9/3KR4 r moves e9f9");
  const output = session.handleLine("lesson depth 2 movetime 1000 cards 1");

  assert.ok(output.some((line) => line.includes("lesson cards 1")));
  assert.ok(output.some((line) => line.includes("practice 1")));
  assert.ok(output.some((line) => line.includes("lesson 1 correction")));
  assert.ok(output.some((line) => line.includes("lesson 1 practice candidate-captures Material tactics")));
});

test("UCCI lesson can filter opening-book cards", () => {
  const session = new UcciSession({ depth: 1, timeLimitMs: 500 });
  session.handleLine("position startpos moves h7e7 h0g2");
  const output = session.handleLine("lessons depth 1 movetime 500 book false");

  assert.ok(output.some((line) => line.includes("lesson cards 0")));
  assert.equal(output.some((line) => line.includes("lesson 1 ")), false);
});

test("UCCI lesson reports no moves when history is empty", () => {
  const session = new UcciSession();
  session.handleLine("position startpos");

  assert.deepEqual(session.handleLine("lesson"), ["info string lesson no moves"]);
});

test("UCCI hint returns progressive coach levels and reveal", () => {
  const session = new UcciSession({ depth: 2, timeLimitMs: 1000 });
  session.handleLine("position startpos");
  const output = session.handleLine("hint depth 2 movetime 1000 lines 2");

  assert.ok(output.some((line) => line.includes("hint side red source opening-book")));
  assert.ok(output.some((line) => line.includes("hint level 1 concept Opening Idea")));
  assert.ok(output.some((line) => line.includes("hint level 4 reveal Best Move")));
  assert.ok(output.some((line) => line.includes("hint candidate 1 h7e7")));
  assert.ok(output.some((line) => line.includes("hint best h7e7 pv h7e7")));
  assert.ok(output.includes("bestmove h7e7"));
});

test("UCCI hint can stop before revealing the best move", () => {
  const session = new UcciSession({ depth: 2, timeLimitMs: 1000 });
  session.handleLine("position startpos");
  const output = session.handleLine("coach depth 2 movetime 1000 levels 2");

  assert.ok(output.some((line) => line.includes("hint level 1")));
  assert.ok(output.some((line) => line.includes("hint level 2")));
  assert.equal(output.some((line) => line.includes("hint level 4")), false);
  assert.equal(output.some((line) => line.startsWith("bestmove ")), false);
});

test("UCCI HintLevels option controls default hint depth", () => {
  const session = new UcciSession({ depth: 2, timeLimitMs: 1000 });
  session.handleLine("setoption name HintLevels value 2");
  session.handleLine("position startpos");
  const output = session.handleLine("hint depth 2 movetime 1000");

  assert.ok(output.some((line) => line.includes("hint level 2")));
  assert.equal(output.some((line) => line.includes("hint level 3")), false);
  assert.equal(output.some((line) => line.startsWith("bestmove ")), false);
});

function runUcciCli(input, env = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["bin/xiangqi-ucci.mjs"], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env
      }
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`xiangqi-ucci CLI timed out\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, 5000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolvePromise({ code, stdout, stderr });
    });

    child.stdin.end(`${input}\n`);
  });
}
