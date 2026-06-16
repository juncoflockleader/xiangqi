import readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

let currentPosition = "";
let currentMultiPv = 1;
let currentProtocol = "ucci";
let pendingStopResponse = null;
let mockWaitForStopOnceUsed = false;
let mockMemoryAge = 0;
const appliedOptions = [];

function write(line) {
  process.stdout.write(`${line}\n`);
}

rl.on("line", (line) => {
  const trimmed = line.trim();
  const command = trimmed.split(/\s+/, 1)[0]?.toLowerCase();

  if (command === "ucci") {
    currentProtocol = "ucci";
    write("id name Mock Native UCCI");
    write("id author test");
    write("ucciok");
  } else if (command === "uci") {
    currentProtocol = "uci";
    write("id name Mock Native UCI");
    write("id author test");
    write("uciok");
  } else if (command === "isready") {
    write("readyok");
  } else if (command === "ucinewgame") {
    currentPosition = "";
    pendingStopResponse = null;
    mockMemoryAge = 0;
  } else if (command === "setoption") {
    appliedOptions.push(trimmed);
    const match = trimmed.match(/\bname\s+MultiPV\s+value\s+(\d+)/i);
    if (match) currentMultiPv = Number.parseInt(match[1], 10) || 1;
  } else if (command === "position") {
    currentPosition = trimmed;
  } else if (command === "go") {
    const depth = hasOption("MockDepthFromGo") ? depthFromGo(trimmed) : 2;
    for (const option of appliedOptions) {
      write(`info string option ${option}`);
    }
    if (currentPosition) {
      write(`info string position ${currentPosition}`);
    }

    const respond = () => {
      if (hasOption("MockMateWdl")) {
        const move = /\sb(?:\s|$)/.test(currentPosition) ? "h0g2" : "h9g7";
        const reply = /\sb(?:\s|$)/.test(currentPosition) ? "h9g7" : "h0g2";
        write(`info depth ${depth} score mate 2 wdl 980 20 0 nodes 456 pv ${nativeMove(move)} ${nativeMove(reply)}`);
        write(`bestmove ${nativeMove(move)}`);
      } else if (hasOption("MockRejectHeuristic") && /\sb(?:\s|$)/.test(currentPosition)) {
        write(`info depth ${depth} score cp 240 nodes 88 pv ${nativeMove("g2e3")}`);
        write(`bestmove ${nativeMove("g2e3")}`);
      } else if (hasOption("MockRejectHeuristic")) {
        write(`info depth ${depth} score cp 320 nodes 144 pv ${nativeMove("b7b3")} ${nativeMove("h2h4")}`);
        write(`bestmove ${nativeMove("b7b3")}`);
      } else if (isRookTacticPosition()) {
        write(`info depth ${depth} score cp 1041 nodes 99 pv ${nativeMove("e9e2")}`);
        write(`bestmove ${nativeMove("e9e2")}`);
      } else if (isRookTacticAfterQuietMove()) {
        write(`info depth ${depth} score cp 0 nodes 99 pv ${nativeMove("e2d2")}`);
        write(`bestmove ${nativeMove("e2d2")}`);
      } else if (/\sb(?:\s|$)/.test(currentPosition)) {
        write(`info depth ${depth} score cp 17 nodes 77 pv ${nativeMove("h0g2")}`);
        write(`bestmove ${nativeMove("h0g2")}`);
      } else if (/\bwtime\s+\d+/i.test(trimmed)) {
        write(`info string command ${trimmed}`);
        write(`info depth ${depth} score cp 55 nodes 321 pv ${nativeMove("h9g7")} ${nativeMove("h0g2")}`);
        write(`bestmove ${nativeMove("h9g7")}`);
      } else if (hasOption("MockShortPvPonder")) {
        write(`info depth ${depth} score cp 42 nodes 123 pv ${nativeMove("h9g7")}`);
        write(`bestmove ${nativeMove("h9g7")} ponder ${nativeMove("h0g2")}`);
      } else if (hasOption("MockTelemetry")) {
        write(`info depth ${depth} seldepth ${depth + 4} score cp 42 nodes 123 qnodes 44 time 15 nps 8200 hashfull 321 string tt 5/9 cutoffs 2 ttmove 6 killers 3 history 4 caphist 12 caphstores 5 caphm 7 caphguard 2 nmp 1 nmv 2 nmvfail 1 nmmguard 6 rfp 9 mdp 2 razor 4/1 see 3 pcut 2 pcsearch 7 pcskip 8 futil 6 hprune 5 hpguard 2 delta 12 qdskip 15 qsee 13 lmp 4 lmr 7/2 redply 11 deepred 3 pvguard 5 cutboost 6 imp 10 nimp 4 imprd 2 nimprd 3 implmp 1 nimlmp 2 cm 6 ch 8 chred 3 chredm 1 ce 18 cecap 4 ceblock 9 ceking 5 checkhist 14 checkhstores 9 checkhm 2 checkcache 21/34 iid 4 iidhit 3 rootmoves 12 rootstate 24 rootred 5/2 rootredply 7 roottt 1 rootttstores 3 rootord 7 rootordstores 8 pvs 3 asp 5 aspwide 2 asphi 1 asplo 2 ext 8 recext 1 singtry 4 singext 2 singrej 1 qchecks 5 qcheckhist 6 qcheckhstores 9 qcheckhm 4 qcapguard 3 qcaphist 10 qcapstores 11 qcaphm 12 qtt 11/13 qttstores 17 qttcut 3 qttmove 2 eval 19/23 evalstores 29 evalskip 31 memage 3 pv ${nativeMove("h9g7")} ${nativeMove("h0g2")}`);
        write(`bestmove ${nativeMove("h9g7")}`);
      } else if (hasOption("MockMemoryAge")) {
        mockMemoryAge += 1;
        write(`info depth ${depth} score cp 42 nodes 123 memage ${mockMemoryAge} pv ${nativeMove("h9g7")} ${nativeMove("h0g2")}`);
        write(`bestmove ${nativeMove("h9g7")}`);
      } else if (hasOption("MockScoreBounds")) {
        write(`info multipv 1 depth ${depth} score cp 80 lowerbound nodes 123 pv ${nativeMove("h9g7")} ${nativeMove("h0g2")}`);
        write(`info multipv 2 depth ${depth} score cp 20 upperbound nodes 123 pv ${nativeMove("h7e7")} ${nativeMove("h0g2")}`);
        write(`bestmove ${nativeMove("h9g7")}`);
      } else if (hasOption("MockTie")) {
        write(`info multipv 1 depth ${depth} score cp 42 nodes 123 pv ${nativeMove("h9g7")} ${nativeMove("h0g2")}`);
        write(`info multipv 2 depth ${depth} score cp 38 nodes 123 pv ${nativeMove("h7e7")} ${nativeMove("h0g2")}`);
        write(`bestmove ${nativeMove("h9g7")}`);
      } else if (/\bmultipv\s+2\b/i.test(trimmed) || currentMultiPv === 2) {
        write(`info multipv 1 depth 1 score cp 20 nodes 40 pv ${nativeMove("a9a8")}`);
        write(`info multipv 2 depth 1 score cp 10 nodes 40 pv ${nativeMove("a6a5")}`);
        write(`info multipv 1 depth ${depth} score cp 42 nodes 123 pv ${nativeMove("h9g7")} ${nativeMove("h0g2")}`);
        write(`info multipv 2 depth ${depth} score cp 12 nodes 123 pv ${nativeMove("h7e7")} ${nativeMove("h0g2")}`);
        write(`bestmove ${nativeMove("h9g7")}`);
      } else {
        write(`info depth ${depth} score cp 42 nodes 123 pv ${nativeMove("h9g7")} ${nativeMove("h0g2")}`);
        write(`bestmove ${nativeMove("h9g7")}`);
      }
      if (hasOption("MockExitAfterBestmove")) {
        setImmediate(() => process.exit(0));
      }
    };

    if (hasOption("MockWaitForStopOnce") && !mockWaitForStopOnceUsed) {
      mockWaitForStopOnceUsed = true;
      pendingStopResponse = respond;
      write("info string waiting for stop");
      return;
    }

    respond();
  } else if (command === "stop") {
    const respond = pendingStopResponse;
    pendingStopResponse = null;
    respond?.();
  } else if (command === "quit") {
    if (hasOption("MockIgnoreQuit")) return;
    write("bye");
    process.exit(0);
  }
});

function hasOption(name) {
  return appliedOptions.some((option) => option.includes(`name ${name}`));
}

function isRookTacticPosition() {
  return /4k4\/9\/4r4\/9\/9\/9\/9\/9\/9\/3KR4\s+w\b/.test(currentPosition);
}

function isRookTacticAfterQuietMove() {
  return /4k4\/9\/4r4\/9\/9\/9\/9\/9\/9\/3K1R3\s+b\b/.test(currentPosition);
}

function depthFromGo(command) {
  const match = command.match(/\bdepth\s+(\d+)/i);
  if (match) return Number.parseInt(match[1], 10);
  return hasOption("MockNoDepthDepth64") ? 64 : 2;
}

function nativeMove(moveText) {
  if (currentProtocol !== "uci") return moveText;
  return moveText.replace(/^([a-i])([0-9])([a-i])([0-9])$/i, (_, fromFile, fromRank, toFile, toRank) => (
    `${fromFile}${9 - Number(fromRank)}${toFile}${9 - Number(toRank)}`
  ));
}
