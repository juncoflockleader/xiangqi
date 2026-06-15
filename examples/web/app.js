const files = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
const ranks = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const chineseNumerals = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const blackFileLabels = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const pointCount = {
  files: files.length,
  ranks: ranks.length
};

const pieceNames = {
  "zh-CN": {
    red: {
      king: "帅",
      general: "帅",
      advisor: "仕",
      elephant: "相",
      horse: "马",
      rook: "车",
      cannon: "炮",
      pawn: "兵"
    },
    black: {
      king: "将",
      general: "将",
      advisor: "士",
      elephant: "象",
      horse: "马",
      rook: "车",
      cannon: "炮",
      pawn: "卒"
    }
  },
  "zh-TW": {
    red: {
      king: "帥",
      general: "帥",
      advisor: "仕",
      elephant: "相",
      horse: "傌",
      rook: "俥",
      cannon: "炮",
      pawn: "兵"
    },
    black: {
      king: "將",
      general: "將",
      advisor: "士",
      elephant: "象",
      horse: "馬",
      rook: "車",
      cannon: "砲",
      pawn: "卒"
    }
  },
  en: {
    red: {
      king: "Red general",
      general: "Red general",
      advisor: "Red advisor",
      elephant: "Red elephant",
      horse: "Red horse",
      rook: "Red chariot",
      cannon: "Red cannon",
      pawn: "Red soldier"
    },
    black: {
      king: "Black general",
      general: "Black general",
      advisor: "Black advisor",
      elephant: "Black elephant",
      horse: "Black horse",
      rook: "Black chariot",
      cannon: "Black cannon",
      pawn: "Black soldier"
    }
  }
};

const localeMeta = {
  "zh-CN": {
    lang: "zh-CN",
    river: ["楚河", "汉界"],
    redAbbrev: "红",
    blackAbbrev: "黑"
  },
  "zh-TW": {
    lang: "zh-Hant",
    river: ["楚河", "漢界"],
    redAbbrev: "紅",
    blackAbbrev: "黑"
  },
  en: {
    lang: "en",
    river: ["Chu River", "Han Border"],
    redAbbrev: "Red",
    blackAbbrev: "Black"
  }
};

const zhTwTranslations = {
  appTitle: "中國象棋",
  language: "語言",
  localeSimplified: "中文（簡體）",
  localeTraditional: "中文（繁體）",
  localeEnglish: "English",
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
  engineActor: "引擎",
  emptyPoint: "空位"
};

const zhCnTranslations = {
  ...zhTwTranslations,
  appTitle: "中国象棋",
  language: "语言",
  localeSimplified: "中文（简体）",
  localeTraditional: "中文（繁体）",
  red: "红方",
  black: "黑方",
  history: "棋谱",
  starting: "启动中...",
  redToMove: "红方走棋",
  blackToMove: "黑方走棋",
  inCheck: "（被将军）",
  repetition: "重复局面和棋",
  wins: "胜",
  level: "级别",
  time: "用时",
  fallback: "备用",
  whyNot: "为何不选",
  noHint: "暂无提示。",
  noDecision: "尚无决策。",
  engineSelected: "引擎已选择一手。",
  moveReviewed: "已复盘此手。",
  loss: "损失",
  scorePrefix: "评分",
  bookSource: "开局库",
  bestAgreement: "与最佳着法一致",
  bestAlternative: "最佳应为"
};

const translations = {
  "zh-CN": zhCnTranslations,
  "zh-TW": zhTwTranslations,
  en: {
    appTitle: "Xiangqi",
    language: "Language",
    localeSimplified: "Chinese (Simplified)",
    localeTraditional: "Chinese (Traditional)",
    localeEnglish: "English",
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
    engineActor: "engine",
    emptyPoint: "empty point"
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
  state.locale = normalizeLocale(elements.localeSelect.value);
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
  const legalFrom = legalMovesFrom();
  const legalTargetMoves = selectedTargetMoves();
  const legalTargets = new Set(legalTargetMoves.keys());

  elements.boardWrap.classList.toggle("black-view", game.playerSide === "black");
  renderBoardLabels(game.playerSide);
  elements.board.innerHTML = "";

  for (const rank of ranks) {
    for (const file of files) {
      const coord = `${file}${rank}`;
      const cell = cellsByCoord.get(coord);
      const point = visualPoint(coord, game.playerSide);
      const targetMove = legalTargetMoves.get(coord);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.coord = coord;
      button.style.left = intersectionPercent(point.file, pointCount.files);
      button.style.top = intersectionPercent(point.rank, pointCount.ranks);
      button.disabled = state.pending || !game.playerTurn;
      button.title = cellTitle(cell, coord, targetMove);
      button.setAttribute("aria-label", cellTitle(cell, coord, targetMove));
      if (state.selected === coord) button.classList.add("selected");
      if (legalTargets.has(coord)) button.classList.add("target");

      if (cell?.piece) {
        const piece = document.createElement("span");
        piece.className = `piece ${cell.piece.side}`;
        piece.textContent = pieceSymbol(cell.piece);
        piece.title = cellTitle(cell, coord);
        button.append(piece);
      }
      if (targetMove) {
        const moveLabel = document.createElement("span");
        moveLabel.className = `move-label ${point.file % 2 === 0 ? "move-label-high" : "move-label-low"}`;
        moveLabel.textContent = moveText(targetMove.notation, targetMove.zhNotation);
        button.append(moveLabel);
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
  const linePlanSummary = localizedLinePlanSummary(decision.linePlan);
  if (linePlanSummary) parts.push(`<div class="line">${escapeHtml(linePlanSummary)}</div>`);
  if (decision.comparison?.reason) parts.push(`<div class="line">${escapeHtml(decision.comparison.reason)}</div>`);
  if (decision.confidence?.label) {
    parts.push(`<div class="score">${t("confidence")}: ${escapeHtml(confidenceLabel(decision.confidence))} (${Math.round(decision.confidence.score ?? 0)}/100)</div>`);
  }
  if (decision.alternatives?.length) {
    parts.push(renderAlternatives(decision.alternatives));
  }
  const reasons = localizedReasons(decision);
  if (reasons.length) {
    parts.push(`<ul class="reason-list">${reasons.slice(0, 5).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`);
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
  const levels = isChineseLocale() && hint?.zhLevels?.length ? hint.zhLevels : hint?.levels ?? [];
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
    const verdict = isChineseLocale() && (!alternative.verdict || alternative.verdict === "candidate")
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
  return new Set(selectedTargetMoves().keys());
}

function selectedTargetMoves() {
  if (!state.selected) return new Map();
  return new Map(
    (state.game?.legalMoves ?? [])
      .filter((move) => move.fromCoord === state.selected)
      .map((move) => [move.toCoord, move])
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
  document.documentElement.lang = localeMeta[state.locale]?.lang ?? "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    element.textContent = t(key);
  });
  setOptionText(elements.localeSelect, "zh-CN", t("localeSimplified"));
  setOptionText(elements.localeSelect, "zh-TW", t("localeTraditional"));
  setOptionText(elements.localeSelect, "en", t("localeEnglish"));
  setOptionText(elements.sideSelect, "red", sideName("red"));
  setOptionText(elements.sideSelect, "black", sideName("black"));
  renderBoardLabels(state.game?.playerSide ?? elements.sideSelect.value);

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
    return isChineseLocale()
      ? `${sideName(status.winner)}${t("wins")}`
      : `${capitalize(status.state)}. ${capitalize(status.winner)} ${t("wins")}`;
  }
  return capitalize(status.state);
}

function t(key) {
  return translations[state.locale]?.[key] ?? translations.en[key] ?? key;
}

function isChineseLocale() {
  return state.locale === "zh-CN" || state.locale === "zh-TW";
}

function renderBoardLabels(playerSide = "red") {
  const viewSide = playerSide === "black" ? "black" : "red";
  const northSide = viewSide === "black" ? "red" : "black";
  const southSide = viewSide === "black" ? "black" : "red";
  const [riverLeft, riverRight] = localeMeta[state.locale]?.river ?? localeMeta.en.river;

  document.querySelector(".river-left").textContent = riverLeft;
  document.querySelector(".river-right").textContent = riverRight;
  renderFileLabels(".file-labels-north .file-label", northSide, viewSide);
  renderFileLabels(".file-labels-south .file-label", southSide, viewSide);
}

function renderFileLabels(selector, side, viewSide) {
  document.querySelectorAll(selector).forEach((label, visualFile) => {
    const file = viewSide === "black" ? files.length - 1 - visualFile : visualFile;
    label.textContent = fileLabel(side, file);
  });
}

function fileLabel(side, file) {
  if (side === "black") return blackFileLabels[file] ?? String(file + 1);
  return chineseNumerals[files.length - 1 - file] ?? String(files.length - file);
}

function setOptionText(select, value, text) {
  const option = Array.from(select.options).find((candidate) => candidate.value === value);
  if (option) option.textContent = text;
}

function visualPoint(coord, playerSide) {
  const file = files.indexOf(coord[0]);
  const rank = ranks.indexOf(coord[1]);
  return {
    file: playerSide === "black" ? files.length - 1 - file : file,
    rank: playerSide === "black" ? ranks.length - 1 - rank : rank
  };
}

function intersectionPercent(index, count) {
  if (count <= 1) return "50%";
  const edgeInset = 50 / count;
  const span = 100 - edgeInset * 2;
  return `${edgeInset + (index * span) / (count - 1)}%`;
}

function cellTitle(cell, coord, targetMove = null) {
  const point = localizedPoint(coord);
  const move = targetMove ? `，${moveText(targetMove.notation, targetMove.zhNotation)}` : "";
  if (!cell?.piece) return `${t("emptyPoint")} ${point}${move}`;
  return `${pieceName(cell.piece)} ${point}${move}`;
}

function pieceName(piece) {
  if (isChineseLocale()) {
    return `${sideName(piece.side)}${pieceSymbol(piece)}`;
  }
  return piece.label ?? pieceNames.en[piece.side]?.[piece.type] ?? piece.symbol ?? "";
}

function pieceSymbol(piece) {
  return pieceNames[state.locale]?.[piece.side]?.[piece.type]
    ?? pieceNames["zh-TW"]?.[piece.side]?.[piece.type]
    ?? piece.symbol
    ?? "";
}

function sideName(side) {
  return side === "black" ? t("black") : t("red");
}

function actorName(actor) {
  if (actor === "engine") return t("engineActor");
  if (actor === "player") return t("player");
  return actor ?? "";
}

function localizedPoint(coord) {
  if (!isChineseLocale()) return coord;
  const file = files.indexOf(coord[0]);
  if (file === -1) return coord;
  const meta = localeMeta[state.locale] ?? localeMeta["zh-CN"];
  return `${coord}（${meta.redAbbrev}${chineseNumerals[files.length - 1 - file]}路／${meta.blackAbbrev}${file + 1}路）`;
}

function localizedDecisionSummary(decision) {
  if (!isChineseLocale()) return decision.summary ?? t("engineSelected");
  const move = moveText(decision.bestMove, decision.zhBestMove);
  const source = decision.source === "book" || decision.source?.startsWith("opening") || /book move|opening book/i.test(decision.summary ?? "")
    ? t("bookSource")
    : t("searchSource");
  const score = Number.isFinite(decision.score) ? `，${t("scorePrefix")} ${formatCentipawns(decision.score)}` : "";
  return move ? `${source}${t("suggests")} ${move}${score}。` : t("engineSelected");
}

function localizedReviewSummary(review) {
  if (!isChineseLocale()) return review.summary ?? t("moveReviewed");
  const move = moveText(review.move, review.zhMove);
  if (review.isBestMove) return move ? `${move}${t("bestAgreement")}。` : t("moveReviewed");
  const best = moveText(review.bestMove, review.zhBestMove);
  const loss = Number.isFinite(review.centipawnLoss) ? `，${t("loss")}約 ${review.centipawnLoss} cp` : "";
  return move && best ? `${move}：${t("bestAlternative")} ${best}${loss}。` : t("moveReviewed");
}

function moveText(notation, zhNotation) {
  if (isChineseLocale() && zhNotation) return localizedChineseNotation(zhNotation);
  return notation ?? zhNotation ?? "";
}

function localizedChineseNotation(text) {
  if (state.locale !== "zh-CN") return text;
  return String(text ?? "")
    .replace(/[帥]/g, "帅")
    .replace(/[將]/g, "将")
    .replace(/[傌馬]/g, "马")
    .replace(/[俥車]/g, "车")
    .replace(/[砲]/g, "炮")
    .replace(/[進]/g, "进")
    .replace(/[後]/g, "后");
}

function localizedLinePlanSummary(linePlan) {
  if (!linePlan) return "";
  return isChineseLocale() ? linePlan.zhSummary ?? linePlan.summary ?? "" : linePlan.summary ?? linePlan.zhSummary ?? "";
}

function localizedReasons(decision) {
  if (isChineseLocale() && decision.zhReasons?.length) return decision.zhReasons;
  return decision.reasons ?? [];
}

function confidenceLabel(confidence) {
  if (!isChineseLocale()) return confidence.label;
  return {
    "very-high": "信心很高",
    high: "信心高",
    medium: "信心中等",
    low: "信心偏低"
  }[confidence.level] ?? confidence.label;
}

function formatMoveHtml(notation, zhNotation) {
  const primary = moveText(notation, zhNotation);
  const secondary = isChineseLocale() ? notation : zhNotation;
  if (!primary) return "";
  const secondaryHtml = secondary && secondary !== primary
    ? `<span class="notation-secondary">${escapeHtml(secondary)}</span>`
    : "";
  return `<span class="move-notation">${escapeHtml(primary)}</span>${secondaryHtml}`;
}

function loadLocale() {
  try {
    return normalizeLocale(localStorage.getItem("xiangqi.locale"));
  } catch {
    return "zh-CN";
  }
}

function saveLocale(locale) {
  try {
    localStorage.setItem("xiangqi.locale", locale);
  } catch {
    // Local storage can be unavailable in strict browser contexts.
  }
}

function normalizeLocale(locale) {
  if (locale === "zh-TW" || locale === "zh-Hant") return "zh-TW";
  if (locale === "zh-CN" || locale === "zh-Hans" || locale === "zh") return "zh-CN";
  if (locale === "en") return "en";
  return "zh-CN";
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
