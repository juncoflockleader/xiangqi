import readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function write(line) {
  process.stdout.write(`${line}\n`);
}

rl.on("line", (line) => {
  const trimmed = line.trim();
  const command = trimmed.split(/\s+/, 1)[0]?.toLowerCase();

  if (command === "ucci") {
    write("id name Mock Native UCCI");
    write("id author test");
    write("ucciok");
  } else if (command === "isready") {
    write("readyok");
  } else if (command === "go") {
    if (/\bwtime\s+\d+/i.test(trimmed)) {
      write(`info string command ${trimmed}`);
      write("info depth 2 score cp 55 nodes 321 pv h9g7 h0g2");
    } else if (/\bmultipv\s+2\b/i.test(trimmed)) {
      write("info multipv 1 depth 2 score cp 42 nodes 123 pv h9g7 h0g2");
      write("info multipv 2 depth 2 score cp 12 nodes 123 pv h7e7 h0g2");
    } else {
      write("info depth 2 score cp 42 nodes 123 pv h9g7 h0g2");
    }
    write("bestmove h9g7");
  } else if (command === "quit") {
    write("bye");
    process.exit(0);
  }
});
