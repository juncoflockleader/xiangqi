const files = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
const ranks = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

const elements = {
  board: document.querySelector("#board"),
  gameStatus: document.querySelector("#gameStatus"),
  turnPill: document.querySelector("#turnPill"),
  sideSelect: document.querySelector("#sideSelect"),
  newButton: document.querySelector("#newButton"),
  undoButton: document.querySelector("#undoButton"),
  hintButton: document.querySelector("#hintButton"),
  bestButton: document.querySelector("#bestButton"),
  engineInfo: document.querySelector("#engineInfo"),
  lastMovePanel: document.querySelector("#lastMovePanel"),
  reasoningPanel: document.querySelector("#reasoningPanel"),
  historyList: document.querySelector("#historyList")
};

const state = {
  sessionId: null,
  game: null,
  selected: null,
  pending: false,
  panel: null
};

elements.newButton.addEventListener("click", () => newGame());
elements.undoButton.addEventListener("click", () => undoMove());
elements.hintButton.addEventListener("click", () => requestHint());
elements.bestButton.addEventListener("click", () => requestBest());
elements.sideSelect.addEventListener("change", () => newGame());

newGame();

async function newGame() {
  state.selected = null;
  state.panel = null;
  await runRequest(async () => {
    const result = await api("/api/new", {
      side: elements.sideSelect.value
    });
    setGame(result.state);
  });
}

async function playMove(notation) {
  await runRequest(async () => {
    const result = await api("/api/move", {
      sessionId: state.sessionId,
      move: notation
    });
    state.panel = panelFromMove(result.state);
    setGame(result.state);
  });
}

async function undoMove() {
  await runRequest(async () => {
    const result = await api("/api/undo", {
      sessionId: state.sessionId
    });
    state.panel = null;
    setGame(result.state);
  });
}

async function requestHint() {
  await runRequest(async () => {
    const result = await api("/api/hint", {
      sessionId: state.sessionId
    });
    state.panel = {
      kind: "hint",
      hint: result.hint
    };
    setGame(result.state);
  });
}

async function requestBest() {
  await runRequest(async () => {
    const result = await api("/api/best", {
      sessionId: state.sessionId
    });
    state.panel = {
      kind: "best",
      decision: result.best
    };
    setGame(result.state);
  });
}

async function runRequest(task) {
  if (state.pending) return;
  state.pending = true;
  updateDisabled();
  try {
    await task();
  } catch (error) {
    renderError(error.message);
  } finally {
    state.pending = false;
    if (state.game) renderBoard();
    updateDisabled();
  }
}

async function api(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload ?? {})
  });
  const result = await response.json();
  if (!response.ok || result.ok === false) {
    throw new Error(result.error ?? `Request failed: ${response.status}`);
  }
  return result;
}

function setGame(game) {
  state.game = game;
  state.sessionId = game.sessionId;
  if (!state.panel) {
    state.panel = panelFromMove(game);
  }
  render();
}

function render() {
  renderStatus();
  renderBoard();
  renderEngineInfo();
  renderLastMove();
  renderReasoning();
  renderHistory();
  updateDisabled();
}

function renderStatus() {
  const game = state.game;
  if (!game) return;

  const status = game.status;
  const side = capitalize(game.turn);
  const check = status.inCheck ? " in check" : "";
  const suffix = status.state === "playing"
    ? `${side} to move${check}`
    : gameOverText(status);

  elements.gameStatus.textContent = suffix;
  elements.turnPill.textContent = status.state === "playing" ? side : "Game over";
  elements.turnPill.className = `turn-pill ${game.turn}`;
}

function renderBoard() {
  const game = state.game;
  if (!game) return;

  const cellsByCoord = new Map(game.board.map((cell) => [cell.coord, cell]));
  const viewRanks = game.playerSide === "black" ? [...ranks].reverse() : ranks;
  const viewFiles = game.playerSide === "black" ? [...files].reverse() : files;
  const legalFrom = legalMovesFrom();
  const legalTargets = selectedTargets();

  elements.board.innerHTML = "";
  for (const rank of viewRanks) {
    for (const file of viewFiles) {
      const coord = `${file}${rank}`;
      const cell = cellsByCoord.get(coord);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.coord = coord;
      button.disabled = state.pending || !game.playerTurn;
      if (state.selected === coord) button.classList.add("selected");
      if (legalTargets.has(coord)) button.classList.add("target");

      if (cell?.piece) {
        const piece = document.createElement("span");
        piece.className = `piece ${cell.piece.side}`;
        piece.textContent = cell.piece.symbol;
        piece.title = `${cell.piece.label} ${coord}`;
        button.append(piece);
      }

      if (game.playerTurn && (cell?.piece?.side === game.playerSide || legalTargets.has(coord) || legalFrom.has(coord))) {
        button.addEventListener("click", () => handleCellClick(coord));
      }
      elements.board.append(button);
    }
  }
}

function renderEngineInfo() {
  const backend = state.game?.backend;
  if (!backend) return;

  const settings = backend.settings ?? {};
  elements.engineInfo.innerHTML = [
    `<span><strong>${escapeHtml(backend.name)}</strong> (${escapeHtml(backend.kind)})</span>`,
    settings.playLevel ? `<span>Level: ${escapeHtml(settings.playLevel)}</span>` : "",
    Number.isFinite(settings.depth) ? `<span>Depth: ${settings.depth}</span>` : "",
    Number.isFinite(settings.timeLimitMs) ? `<span>Time: ${settings.timeLimitMs} ms</span>` : "",
    Number.isFinite(settings.lines) ? `<span>Lines: ${settings.lines}</span>` : "",
    backend.status?.fallbackActive ? `<span class="status-error">Fallback: ${escapeHtml(backend.status.fallbackReason ?? "active")}</span>` : ""
  ].filter(Boolean).join("");
}

function renderLastMove() {
  const last = state.game?.lastMove;
  if (!last) {
    elements.lastMovePanel.className = "stack muted";
    elements.lastMovePanel.textContent = "No moves yet.";
    return;
  }

  const review = state.game.lastPlayerReview;
  const decision = last.decision;
  const details = [];
  details.push(`<div class="line"><strong>${escapeHtml(capitalize(last.side))}</strong> ${escapeHtml(last.notation)} <span class="score">${escapeHtml(last.actor)}</span></div>`);
  if (decision?.summary) details.push(`<div>${escapeHtml(decision.summary)}</div>`);
  if (review?.summary) details.push(`<div>${escapeHtml(review.summary)}</div>`);
  if (review?.practiceFocus) {
    details.push(`<div class="line"><strong>${escapeHtml(review.practiceFocus.title)}</strong><br>${escapeHtml(review.practiceFocus.text)}</div>`);
  }
  if (review?.planComparison?.summary) {
    details.push(`<div class="line">${escapeHtml(review.planComparison.summary)}</div>`);
  }

  elements.lastMovePanel.className = "stack";
  elements.lastMovePanel.innerHTML = details.join("");
}

function renderReasoning() {
  const panel = state.panel;
  if (!panel) return;

  if (panel.kind === "hint") {
    renderHint(panel.hint);
    return;
  }
  if (panel.kind === "best") {
    renderDecision(panel.decision);
    return;
  }
  if (panel.kind === "move" && panel.decision) {
    renderDecision(panel.decision);
    return;
  }
  if (panel.kind === "move" && panel.review) {
    renderReview(panel.review);
    return;
  }

  elements.reasoningPanel.className = "stack muted";
  elements.reasoningPanel.textContent = "Ask for Best, Hint, or make a move.";
}

function renderDecision(decision) {
  if (!decision) {
    elements.reasoningPanel.className = "stack muted";
    elements.reasoningPanel.textContent = "No decision yet.";
    return;
  }

  const parts = [];
  parts.push(`<div>${escapeHtml(decision.summary ?? "Engine selected a move.")}</div>`);
  if (decision.linePlan?.summary) parts.push(`<div class="line">${escapeHtml(decision.linePlan.summary)}</div>`);
  if (decision.comparison?.reason) parts.push(`<div class="line">${escapeHtml(decision.comparison.reason)}</div>`);
  if (decision.confidence?.label) {
    parts.push(`<div class="score">Confidence: ${escapeHtml(decision.confidence.label)} (${Math.round(decision.confidence.score ?? 0)}/100)</div>`);
  }
  if (decision.alternatives?.length) {
    parts.push(renderAlternatives(decision.alternatives));
  }
  if (decision.reasons?.length) {
    parts.push(`<ul class="reason-list">${decision.reasons.slice(0, 5).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`);
  }

  elements.reasoningPanel.className = "stack";
  elements.reasoningPanel.innerHTML = parts.join("");
}

function renderReview(review) {
  const parts = [
    `<div>${escapeHtml(review.summary ?? "Move reviewed.")}</div>`
  ];
  if (review.planComparison?.summary) parts.push(`<div class="line">${escapeHtml(review.planComparison.summary)}</div>`);
  if (review.practiceFocus) {
    parts.push(`<div class="line"><strong>${escapeHtml(review.practiceFocus.title)}</strong><br>${escapeHtml(review.practiceFocus.text)}</div>`);
  }
  elements.reasoningPanel.className = "stack";
  elements.reasoningPanel.innerHTML = parts.join("");
}

function renderHint(hint) {
  const levels = hint?.levels ?? [];
  const parts = levels.slice(0, 4).map((level) => (
    `<div class="line"><strong>${escapeHtml(level.title ?? `Hint ${level.level}`)}</strong><br>${escapeHtml(level.text ?? "")}</div>`
  ));
  if (hint?.bestMove) parts.push(`<div class="score">Best: ${escapeHtml(hint.bestMove)}</div>`);

  elements.reasoningPanel.className = "stack";
  elements.reasoningPanel.innerHTML = parts.length ? parts.join("") : "No hint available.";
}

function renderAlternatives(alternatives) {
  const rows = alternatives.slice(0, 4).map((alternative) => {
    const score = alternative.scoreDetail?.text ?? (Number.isFinite(alternative.score) ? formatCentipawns(alternative.score) : "unscored");
    const loss = Number.isFinite(alternative.centipawnLoss) ? `, loss ${alternative.centipawnLoss} cp` : "";
    const reply = alternative.expectedReply ? `, expects ${alternative.expectedReply}` : "";
    const why = alternative.planComparison?.summary
      ? `<div class="score">Why not: ${escapeHtml(alternative.planComparison.summary)}</div>`
      : "";
    return `<li><strong>${escapeHtml(alternative.move)}</strong> <span class="score">${escapeHtml(alternative.verdict ?? "candidate")}, ${escapeHtml(score)}${escapeHtml(loss)}${escapeHtml(reply)}</span>${why}</li>`;
  });
  return `<ol class="alternative-list">${rows.join("")}</ol>`;
}

function renderHistory() {
  const history = state.game?.history ?? [];
  elements.historyList.innerHTML = history.slice(-12).map((move) => (
    `<li><strong>${move.ply}.</strong> ${escapeHtml(move.notation)} <span class="score">${escapeHtml(move.actor)}</span></li>`
  )).join("");
}

function renderError(message) {
  elements.reasoningPanel.className = "stack";
  elements.reasoningPanel.innerHTML = `<div class="line status-error">${escapeHtml(message)}</div>`;
}

function handleCellClick(coord) {
  const game = state.game;
  if (!game?.playerTurn) return;

  const cell = game.board.find((item) => item.coord === coord);
  const legalFrom = legalMovesFrom();
  const targets = selectedTargets();

  if (state.selected && targets.has(coord)) {
    playMove(`${state.selected}-${coord}`);
    state.selected = null;
    renderBoard();
    return;
  }

  if (cell?.piece?.side === game.playerSide && legalFrom.has(coord)) {
    state.selected = coord;
    renderBoard();
    return;
  }

  state.selected = null;
  renderBoard();
}

function legalMovesFrom() {
  return new Set((state.game?.legalMoves ?? []).map((move) => move.fromCoord));
}

function selectedTargets() {
  if (!state.selected) return new Set();
  return new Set(
    (state.game?.legalMoves ?? [])
      .filter((move) => move.fromCoord === state.selected)
      .map((move) => move.toCoord)
  );
}

function panelFromMove(game) {
  const last = game.lastMove;
  if (last?.decision) return { kind: "move", decision: last.decision };
  if (last?.review) return { kind: "move", review: last.review };
  if (game.lastEngineDecision) return { kind: "move", decision: game.lastEngineDecision };
  if (game.lastPlayerReview) return { kind: "move", review: game.lastPlayerReview };
  return null;
}

function updateDisabled() {
  const disabled = state.pending || !state.game;
  elements.newButton.disabled = state.pending;
  elements.undoButton.disabled = disabled || !state.game?.canUndo;
  elements.hintButton.disabled = disabled || state.game?.status?.state !== "playing";
  elements.bestButton.disabled = disabled || state.game?.status?.state !== "playing";
  elements.sideSelect.disabled = state.pending;
}

function gameOverText(status) {
  if (status.state === "repetition") return "Repetition draw";
  if (status.winner) return `${capitalize(status.state)}. ${capitalize(status.winner)} wins`;
  return capitalize(status.state);
}

function formatCentipawns(value) {
  const rounded = Math.round(value ?? 0);
  return `${rounded >= 0 ? "+" : ""}${rounded} cp`;
}

function capitalize(text) {
  const value = String(text ?? "");
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
