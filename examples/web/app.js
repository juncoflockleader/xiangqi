const files = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
const ranks = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

const translations = {
  zh: {
    appTitle: "中國象棋",
    language: "語言",
    side: "方位",
    red: "紅方",
    black: "黑方",
    newGame: "新局",
    undo: "悔棋",
    hint: "提示",
    best: "最佳",
    engine: "引擎",
    lastMove: "上一手",
    reasoning: "思路",
    history: "棋譜",
    starting: "啟動中...",
    noMoves: "尚未走棋。",
    askPrompt: "可查看最佳、提示，或直接走棋。",
    redToMove: "紅方走棋",
    blackToMove: "黑方走棋",
    inCheck: "（被將軍）",
    gameOver: "終局",
    repetition: "重複局面和棋",
    wins: "勝",
    level: "級別",
    depth: "深度",
    time: "用時",
    lines: "候選",
    fallback: "備援",
    confidence: "信心",
    bestMove: "最佳",
    whyNot: "為何不選",
    noHint: "暫無提示。",
    noDecision: "尚無決策。",
    engineSelected: "引擎已選擇一手。",
    moveReviewed: "已覆盤此手。",
    candidate: "候選",
    expectedReply: "預期",
    loss: "損失",
    scorePrefix: "評分",
    bookSource: "開局庫",
    searchSource: "搜索",
    suggests: "建議",
    bestAgreement: "與最佳著法一致",
    bestAlternative: "最佳應為",
    player: "你",
    engineActor: "引擎"
  },
  en: {
    appTitle: "Xiangqi",
    language: "Language",
    side: "Side",
    red: "Red",
    black: "Black",
    newGame: "New",
    undo: "Undo",
    hint: "Hint",
    best: "Best",
    engine: "Engine",
    lastMove: "Last Move",
    reasoning: "Reasoning",
    history: "History",
    starting: "Starting...",
    noMoves: "No moves yet.",
    askPrompt: "Ask for Best, Hint, or make a move.",
    redToMove: "Red to move",
    blackToMove: "Black to move",
    inCheck: " in check",
    gameOver: "Game over",
    repetition: "Repetition draw",
    wins: "wins",
    level: "Level",
    depth: "Depth",
    time: "Time",
    lines: "Lines",
    fallback: "Fallback",
    confidence: "Confidence",
    bestMove: "Best",
    whyNot: "Why not",
    noHint: "No hint available.",
    noDecision: "No decision yet.",
    engineSelected: "Engine selected a move.",
    moveReviewed: "Move reviewed.",
    candidate: "candidate",
    expectedReply: "expects",
    loss: "loss",
    scorePrefix: "score",
    bookSource: "opening book",
    searchSource: "search",
    suggests: "suggests",
    bestAgreement: "matches the best move",
    bestAlternative: "best was",
    player: "player",
    engineActor: "engine"
  }
};

const elements = {
  board: document.querySelector("#board"),
  boardWrap: document.querySelector("#boardWrap"),
  gameStatus: document.querySelector("#gameStatus"),
  turnPill: document.querySelector("#turnPill"),
  localeSelect: document.querySelector("#localeSelect"),
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
  panel: null,
  locale: loadLocale()
};

elements.newButton.addEventListener("click", () => newGame());
elements.undoButton.addEventListener("click", () => undoMove());
elements.hintButton.addEventListener("click", () => requestHint());
elements.bestButton.addEventListener("click", () => requestBest());
elements.sideSelect.addEventListener("change", () => newGame());
elements.localeSelect.addEventListener("change", () => {
  state.locale = elements.localeSelect.value === "en" ? "en" : "zh";
  saveLocale(state.locale);
  applyLocale();
});

elements.localeSelect.value = state.locale;
applyLocale();
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
  const check = status.inCheck ? t("inCheck") : "";
  const suffix = status.state === "playing"
    ? `${t(`${game.turn}ToMove`)}${check}`
    : gameOverText(status);

  elements.gameStatus.textContent = suffix;
  elements.turnPill.textContent = status.state === "playing" ? sideName(game.turn) : t("gameOver");
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

  elements.boardWrap.classList.toggle("black-view", game.playerSide === "black");
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
    settings.playLevel ? `<span>${t("level")}: ${escapeHtml(settings.playLevel)}</span>` : "",
    Number.isFinite(settings.depth) ? `<span>${t("depth")}: ${settings.depth}</span>` : "",
    Number.isFinite(settings.timeLimitMs) ? `<span>${t("time")}: ${settings.timeLimitMs} ms</span>` : "",
    Number.isFinite(settings.lines) ? `<span>${t("lines")}: ${settings.lines}</span>` : "",
    backend.status?.fallbackActive ? `<span class="status-error">${t("fallback")}: ${escapeHtml(backend.status.fallbackReason ?? "active")}</span>` : ""
  ].filter(Boolean).join("");
}

function renderLastMove() {
  const last = state.game?.lastMove;
  if (!last) {
    elements.lastMovePanel.className = "stack muted";
    elements.lastMovePanel.textContent = t("noMoves");
    return;
  }

  const review = state.game.lastPlayerReview;
  const decision = last.decision;
  const details = [];
  details.push(`<div class="line"><strong>${escapeHtml(sideName(last.side))}</strong> ${formatMoveHtml(last.notation, last.zhNotation)} <span class="score">${escapeHtml(actorName(last.actor))}</span></div>`);
  if (decision) details.push(`<div>${escapeHtml(localizedDecisionSummary(decision))}</div>`);
  if (review) details.push(`<div>${escapeHtml(localizedReviewSummary(review))}</div>`);
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
  elements.reasoningPanel.textContent = t("askPrompt");
}

function renderDecision(decision) {
  if (!decision) {
    elements.reasoningPanel.className = "stack muted";
    elements.reasoningPanel.textContent = t("noDecision");
    return;
  }

  const parts = [];
  if (decision.bestMove) {
    parts.push(`<div class="line"><strong>${t("bestMove")}</strong> ${formatMoveHtml(decision.bestMove, decision.zhBestMove)}</div>`);
  }
  parts.push(`<div>${escapeHtml(localizedDecisionSummary(decision))}</div>`);
  if (decision.linePlan?.summary) parts.push(`<div class="line">${escapeHtml(decision.linePlan.summary)}</div>`);
  if (decision.comparison?.reason) parts.push(`<div class="line">${escapeHtml(decision.comparison.reason)}</div>`);
  if (decision.confidence?.label) {
    parts.push(`<div class="score">${t("confidence")}: ${escapeHtml(decision.confidence.label)} (${Math.round(decision.confidence.score ?? 0)}/100)</div>`);
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
    `<div>${escapeHtml(localizedReviewSummary(review))}</div>`
  ];
  if (review.move) parts.unshift(`<div class="line">${formatMoveHtml(review.move, review.zhMove)}</div>`);
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
  if (hint?.bestMove) parts.push(`<div class="score">${t("bestMove")}: ${formatMoveHtml(hint.bestMove, hint.zhBestMove)}</div>`);

  elements.reasoningPanel.className = "stack";
  elements.reasoningPanel.innerHTML = parts.length ? parts.join("") : t("noHint");
}

function renderAlternatives(alternatives) {
  const rows = alternatives.slice(0, 4).map((alternative) => {
    const score = alternative.scoreDetail?.text ?? (Number.isFinite(alternative.score) ? formatCentipawns(alternative.score) : "unscored");
    const loss = Number.isFinite(alternative.centipawnLoss) ? `, ${t("loss")} ${alternative.centipawnLoss} cp` : "";
    const reply = alternative.expectedReply ? `, ${t("expectedReply")} ${moveText(alternative.expectedReply, alternative.zhExpectedReply)}` : "";
    const why = alternative.planComparison?.summary
      ? `<div class="score">${t("whyNot")}: ${escapeHtml(alternative.planComparison.summary)}</div>`
      : "";
    const verdict = state.locale === "zh" && (!alternative.verdict || alternative.verdict === "candidate")
      ? t("candidate")
      : alternative.verdict ?? t("candidate");
    return `<li><strong>${formatMoveHtml(alternative.move, alternative.zhMove)}</strong> <span class="score">${escapeHtml(verdict)}, ${escapeHtml(score)}${escapeHtml(loss)}${escapeHtml(reply)}</span>${why}</li>`;
  });
  return `<ol class="alternative-list">${rows.join("")}</ol>`;
}

function renderHistory() {
  const history = state.game?.history ?? [];
  elements.historyList.innerHTML = history.slice(-12).map((move) => (
    `<li><strong>${move.ply}.</strong> ${formatMoveHtml(move.notation, move.zhNotation)} <span class="score">${escapeHtml(actorName(move.actor))}</span></li>`
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
  elements.localeSelect.disabled = state.pending;
}

function applyLocale() {
  document.documentElement.lang = state.locale === "zh" ? "zh-Hant" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    element.textContent = t(key);
  });
  setOptionText(elements.sideSelect, "red", sideName("red"));
  setOptionText(elements.sideSelect, "black", sideName("black"));

  if (state.game) {
    render();
    return;
  }

  elements.gameStatus.textContent = t("starting");
  elements.turnPill.textContent = sideName("red");
  elements.lastMovePanel.textContent = t("noMoves");
  elements.reasoningPanel.textContent = t("askPrompt");
}

function gameOverText(status) {
  if (status.state === "repetition") return t("repetition");
  if (status.winner) {
    return state.locale === "zh"
      ? `${sideName(status.winner)}${t("wins")}`
      : `${capitalize(status.state)}. ${capitalize(status.winner)} ${t("wins")}`;
  }
  return capitalize(status.state);
}

function t(key) {
  return translations[state.locale]?.[key] ?? translations.en[key] ?? key;
}

function setOptionText(select, value, text) {
  const option = Array.from(select.options).find((candidate) => candidate.value === value);
  if (option) option.textContent = text;
}

function sideName(side) {
  return side === "black" ? t("black") : t("red");
}

function actorName(actor) {
  if (actor === "engine") return t("engineActor");
  if (actor === "player") return t("player");
  return actor ?? "";
}

function localizedDecisionSummary(decision) {
  if (state.locale !== "zh") return decision.summary ?? t("engineSelected");
  const move = moveText(decision.bestMove, decision.zhBestMove);
  const source = decision.source === "book" || /book move|opening book/i.test(decision.summary ?? "")
    ? t("bookSource")
    : t("searchSource");
  const score = Number.isFinite(decision.score) ? `，${t("scorePrefix")} ${formatCentipawns(decision.score)}` : "";
  return move ? `${source}${t("suggests")} ${move}${score}。` : t("engineSelected");
}

function localizedReviewSummary(review) {
  if (state.locale !== "zh") return review.summary ?? t("moveReviewed");
  const move = moveText(review.move, review.zhMove);
  if (review.isBestMove) return move ? `${move}${t("bestAgreement")}。` : t("moveReviewed");
  const best = moveText(review.bestMove, review.zhBestMove);
  const loss = Number.isFinite(review.centipawnLoss) ? `，${t("loss")}約 ${review.centipawnLoss} cp` : "";
  return move && best ? `${move}：${t("bestAlternative")} ${best}${loss}。` : t("moveReviewed");
}

function moveText(notation, zhNotation) {
  if (state.locale === "zh" && zhNotation) return zhNotation;
  return notation ?? zhNotation ?? "";
}

function formatMoveHtml(notation, zhNotation) {
  const primary = moveText(notation, zhNotation);
  const secondary = state.locale === "zh" ? notation : zhNotation;
  if (!primary) return "";
  const secondaryHtml = secondary && secondary !== primary
    ? `<span class="notation-secondary">${escapeHtml(secondary)}</span>`
    : "";
  return `<span class="move-notation">${escapeHtml(primary)}</span>${secondaryHtml}`;
}

function loadLocale() {
  try {
    return localStorage.getItem("xiangqi.locale") === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

function saveLocale(locale) {
  try {
    localStorage.setItem("xiangqi.locale", locale);
  } catch {
    // Local storage can be unavailable in strict browser contexts.
  }
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
