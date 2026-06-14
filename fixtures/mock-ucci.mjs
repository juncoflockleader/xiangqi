import readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

let currentPosition = "";
let currentMultiPv = 1;
let currentProtocol = "ucci";
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
  } else if (command === "setoption") {
    appliedOptions.push(trimmed);
    const match = trimmed.match(/\bname\s+MultiPV\s+value\s+(\d+)/i);
    if (match) currentMultiPv = Number.parseInt(match[1], 10) || 1;
  } else if (command === "position") {
    currentPosition = trimmed;
  } else if (command === "go") {
    for (const option of appliedOptions) {
      write(`info string option ${option}`);
    }
    if (currentPosition) {
      write(`info string position ${currentPosition}`);
    }

    if (/\sb(?:\s|$)/.test(currentPosition)) {
      write(`info depth 2 score cp 17 nodes 77 pv ${nativeMove("h0g2")}`);
      write(`bestmove ${nativeMove("h0g2")}`);
    } else if (/\bwtime\s+\d+/i.test(trimmed)) {
      write(`info string command ${trimmed}`);
      write(`info depth 2 score cp 55 nodes 321 pv ${nativeMove("h9g7")} ${nativeMove("h0g2")}`);
      write(`bestmove ${nativeMove("h9g7")}`);
    } else if (hasOption("MockTie")) {
      write(`info multipv 1 depth 2 score cp 42 nodes 123 pv ${nativeMove("h9g7")} ${nativeMove("h0g2")}`);
      write(`info multipv 2 depth 2 score cp 38 nodes 123 pv ${nativeMove("h7e7")} ${nativeMove("h0g2")}`);
      write(`bestmove ${nativeMove("h9g7")}`);
    } else if (/\bmultipv\s+2\b/i.test(trimmed) || currentMultiPv === 2) {
      write(`info multipv 1 depth 1 score cp 20 nodes 40 pv ${nativeMove("a9a8")}`);
      write(`info multipv 2 depth 1 score cp 10 nodes 40 pv ${nativeMove("a6a5")}`);
      write(`info multipv 1 depth 2 score cp 42 nodes 123 pv ${nativeMove("h9g7")} ${nativeMove("h0g2")}`);
      write(`info multipv 2 depth 2 score cp 12 nodes 123 pv ${nativeMove("h7e7")} ${nativeMove("h0g2")}`);
      write(`bestmove ${nativeMove("h9g7")}`);
    } else {
      write(`info depth 2 score cp 42 nodes 123 pv ${nativeMove("h9g7")} ${nativeMove("h0g2")}`);
      write(`bestmove ${nativeMove("h9g7")}`);
    }
  } else if (command === "quit") {
    write("bye");
    process.exit(0);
  }
});

function hasOption(name) {
  return appliedOptions.some((option) => option.includes(`name ${name}`));
}

function nativeMove(moveText) {
  if (currentProtocol !== "uci") return moveText;
  return moveText.replace(/^([a-i])([0-9])([a-i])([0-9])$/i, (_, fromFile, fromRank, toFile, toRank) => (
    `${fromFile}${9 - Number(fromRank)}${toFile}${9 - Number(toRank)}`
  ));
}
