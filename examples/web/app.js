const files = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
const ranks = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const chineseNumerals = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const blackFileLabels = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const DEFAULT_CLIENT_REQUEST_TIMEOUT_MS = 15 * 60 * 1000;
const CLIENT_REQUEST_TIMEOUT_BUFFER_MS = 5000;
const CLIENT_STATE_REFRESH_TIMEOUT_MS = 15000;
const PENDING_STATUS_INTERVAL_MS = 1000;
const TREE_NODE_WIDTH = 188;
const TREE_NODE_HEIGHT = 96;
const TREE_LEVEL_GAP = 96;
const TREE_SIBLING_GAP = 34;
const TREE_LAYOUT_PADDING = 44;
const TREE_MIN_SCALE = 0.35;
const TREE_MAX_SCALE = 1.8;

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

const simplifiedChineseMap = Object.freeze({
  "與": "与",
  "帥": "帅",
  "將": "将",
  "傌": "马",
  "馬": "马",
  "俥": "车",
  "車": "车",
  "砲": "炮",
  "進": "进",
  "後": "后",
  "著": "着",
  "紅": "红",
  "漢": "汉",
  "語": "语",
  "體": "体",
  "啟": "启",
  "動": "动",
  "級": "级",
  "備": "备",
  "暫": "暂",
  "無": "无",
  "選": "选",
  "擇": "择",
  "覆": "复",
  "損": "损",
  "開": "开",
  "庫": "库",
  "預": "预",
  "應": "应",
  "續": "续",
  "題": "题",
  "薦": "荐",
  "評": "评",
  "為": "为",
  "戰": "战",
  "術": "术",
  "狀": "状",
  "態": "态",
  "沒": "没",
  "壓": "压",
  "線": "线",
  "點": "点",
  "權": "权",
  "較": "较",
  "領": "领",
  "計": "计",
  "畫": "画",
  "實": "实",
  "議": "议",
  "慮": "虑",
  "強": "强",
  "協": "协",
  "調": "调",
  "關": "关",
  "係": "系",
  "製": "制",
  "威": "威",
  "脅": "胁",
  "靜": "静",
  "勢": "势",
  "護": "护",
  "躍": "跃",
  "練": "练",
  "掃": "扫",
  "麼": "么",
  "雙": "双",
  "對": "对"
});

const traditionalChineseMap = Object.freeze({
  "与": "與",
  "帅": "帥",
  "将": "將",
  "马": "馬",
  "车": "車",
  "进": "進",
  "后": "後",
  "着": "著",
  "红": "紅",
  "汉": "漢",
  "语": "語",
  "体": "體",
  "启": "啟",
  "动": "動",
  "级": "級",
  "备": "備",
  "暂": "暫",
  "无": "無",
  "选": "選",
  "择": "擇",
  "复": "覆",
  "损": "損",
  "开": "開",
  "库": "庫",
  "预": "預",
  "应": "應",
  "续": "續",
  "题": "題",
  "荐": "薦",
  "评": "評",
  "为": "為",
  "战": "戰",
  "术": "術",
  "状": "狀",
  "态": "態",
  "没": "沒",
  "压": "壓",
  "线": "線",
  "点": "點",
  "权": "權",
  "较": "較",
  "领": "領",
  "计": "計",
  "画": "畫",
  "实": "實",
  "议": "議",
  "虑": "慮",
  "强": "強",
  "协": "協",
  "调": "調",
  "关": "關",
  "系": "係",
  "制": "製",
  "胁": "脅",
  "静": "靜",
  "势": "勢",
  "护": "護",
  "跃": "躍",
  "练": "練",
  "扫": "掃",
  "么": "麼",
  "双": "雙",
  "对": "對"
});

const practiceFocusTranslations = Object.freeze({
  "zh-CN": {
    "missed-material": ["子力战术", "练习在走安静棋前先扫描强制吃子。"],
    "unsafe-capture": ["吃子安全", "练习吃子前检查反吃和保护关系。"],
    "missed-check": ["强制将军", "练习优先看将军，特别是对方将帅暴露时。"],
    "missed-threat": ["建立先手", "练习寻找能制造直接威胁的着法。"],
    "allowed-threat": ["防守威胁", "练习每步之后先问对手威胁什么。"],
    "positional-drift": ["子力协调", "练习从活跃度、保护和长期压力比较安静候选。"]
  },
  "zh-TW": {
    "missed-material": ["子力戰術", "練習在走安靜棋前先掃描強制吃子。"],
    "unsafe-capture": ["吃子安全", "練習吃子前檢查反吃和保護關係。"],
    "missed-check": ["強制將軍", "練習優先看將軍，特別是對方將帥暴露時。"],
    "missed-threat": ["建立先手", "練習尋找能製造直接威脅的著法。"],
    "allowed-threat": ["防守威脅", "練習每步之後先問對手威脅什麼。"],
    "positional-drift": ["子力協調", "練習從活躍度、保護和長期壓力比較安靜候選。"]
  }
});

const zhTwTranslations = {
  appTitle: "中國象棋",
  boardAria: "象棋棋盤",
  controlsAria: "對局控制",
  language: "語言",
  localeSimplified: "中文（簡體）",
  localeTraditional: "中文（繁體）",
  localeEnglish: "English",
  side: "執方",
  red: "紅方",
  black: "黑方",
  newGame: "新局",
  undo: "悔棋",
  hint: "提示",
  best: "最佳著法",
  engine: "引擎",
  lastMove: "上一手",
  reasoning: "思路",
  history: "棋譜",
  moveTree: "變化樹",
  starting: "啟動中...",
  noMoves: "尚未走棋。",
  treeEmpty: "尚未形成棋樹。",
  mainLine: "主線",
  alternativeLine: "變化",
  branchPoint: "分岔點",
  currentPosition: "當前",
  expand: "展開",
  fold: "收合",
  selectedNode: "已選",
  restorePoint: "回到此處",
  recomputeNode: "重新計算分支",
  recomputingNode: "正在計算分支...",
  generatedBranches: "新分支",
  analysisBranch: "分析分支",
  branchRank: "第 {rank} 選",
  treeFit: "適配",
  treeZoomIn: "放大",
  treeZoomOut: "縮小",
  treeReset: "重置",
  variationPreview: "預覽局面",
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
  bestMove: "最佳著法",
  whyNot: "為何不選",
  noHint: "暫無提示。",
  noDecision: "尚無決策。",
  engineSelected: "引擎已選擇一手。",
  moveReviewed: "已覆盤此手。",
  thinking: "引擎思考中...",
  thinkingShort: "思考中",
  requestTimedOut: "請求等待時間過長，請重試。",
  requestFailed: "連線中斷，請重試。",
  stateRefreshed: "已重新同步當前局面。",
  legalMoves: "合法著法",
  legalMovesSuffix: "的合法著法",
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
  boardAria: "象棋棋盘",
  controlsAria: "对局控制",
  language: "语言",
  localeSimplified: "中文（简体）",
  localeTraditional: "中文（繁体）",
  side: "执方",
  red: "红方",
  black: "黑方",
  best: "最佳着法",
  history: "棋谱",
  moveTree: "变化树",
  starting: "启动中...",
  noMoves: "尚未走棋。",
  treeEmpty: "尚未形成棋树。",
  mainLine: "主线",
  alternativeLine: "变化",
  branchPoint: "分岔点",
  currentPosition: "当前",
  expand: "展开",
  fold: "收起",
  selectedNode: "已选",
  restorePoint: "回到此处",
  recomputeNode: "重新计算分支",
  recomputingNode: "正在计算分支...",
  generatedBranches: "新分支",
  analysisBranch: "分析分支",
  branchRank: "第 {rank} 选",
  treeFit: "适配",
  treeZoomIn: "放大",
  treeZoomOut: "缩小",
  treeReset: "重置",
  variationPreview: "预览局面",
  askPrompt: "可查看最佳着法、提示，或直接走棋。",
  redToMove: "红方走棋",
  blackToMove: "黑方走棋",
  inCheck: "（被将军）",
  gameOver: "终局",
  repetition: "重复局面和棋",
  wins: "胜",
  level: "级别",
  depth: "深度",
  time: "用时",
  lines: "候选",
  fallback: "备用",
  confidence: "信心",
  bestMove: "最佳着法",
  whyNot: "为何不选",
  noHint: "暂无提示。",
  noDecision: "尚无决策。",
  engineSelected: "引擎已选择一手。",
  moveReviewed: "已复盘此手。",
  thinking: "引擎思考中...",
  thinkingShort: "思考中",
  requestTimedOut: "请求等待时间过长，请重试。",
  requestFailed: "连接中断，请重试。",
  stateRefreshed: "已重新同步当前局面。",
  legalMoves: "合法着法",
  legalMovesSuffix: "的合法着法",
  candidate: "候选",
  expectedReply: "预期",
  loss: "损失",
  scorePrefix: "评分",
  bookSource: "开局库",
  searchSource: "搜索",
  suggests: "建议",
  bestAgreement: "与最佳着法一致",
  bestAlternative: "最佳应为",
  player: "你",
  engineActor: "引擎",
  emptyPoint: "空位"
};

const translations = {
  "zh-CN": zhCnTranslations,
  "zh-TW": zhTwTranslations,
  en: {
    appTitle: "Xiangqi",
    boardAria: "Xiangqi board",
    controlsAria: "Game controls",
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
    moveTree: "Move Tree",
    starting: "Starting...",
    noMoves: "No moves yet.",
    treeEmpty: "No tree yet.",
    mainLine: "main",
    alternativeLine: "variation",
    branchPoint: "branch point",
    currentPosition: "current",
    expand: "Expand",
    fold: "Collapse",
    selectedNode: "selected",
    restorePoint: "Restore here",
    recomputeNode: "Recompute branches",
    recomputingNode: "Computing branches...",
    generatedBranches: "new branches",
    analysisBranch: "analysis branch",
    branchRank: "line {rank}",
    treeFit: "Fit",
    treeZoomIn: "Zoom in",
    treeZoomOut: "Zoom out",
    treeReset: "Reset",
    variationPreview: "preview position",
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
    thinking: "Engine thinking...",
    thinkingShort: "Thinking",
    requestTimedOut: "The request waited too long. Please try again.",
    requestFailed: "The connection was interrupted. Please try again.",
    stateRefreshed: "Current position resynced.",
    legalMoves: "Legal moves",
    legalMovesSuffix: " legal moves",
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
  selectedMoves: document.querySelector("#selectedMoves"),
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
  historyList: document.querySelector("#historyList"),
  treeViewport: document.querySelector("#treeViewport"),
  treeFitButton: document.querySelector("#treeFitButton"),
  treeZoomInButton: document.querySelector("#treeZoomInButton"),
  treeZoomOutButton: document.querySelector("#treeZoomOutButton"),
  treeResetButton: document.querySelector("#treeResetButton")
};

const state = {
  sessionId: null,
  game: null,
  selected: null,
  pending: false,
  pendingSince: null,
  errorMessage: null,
  panel: null,
  treeCollapsed: new Set(),
  treeSelectedId: null,
  treeAnalysis: new Map(),
  treeAnalysisPendingId: null,
  treeView: {
    x: 24,
    y: 24,
    scale: 1,
    layoutWidth: 0,
    layoutHeight: 0,
    userPositioned: false
  },
  locale: loadLocale()
};

let pendingRenderTimer = null;
let treeDrag = null;

elements.newButton.addEventListener("click", () => newGame());
elements.undoButton.addEventListener("click", () => undoMove());
elements.hintButton.addEventListener("click", () => requestHint());
elements.bestButton.addEventListener("click", () => requestBest());
elements.treeFitButton.addEventListener("click", () => fitTreeView({ userInitiated: true }));
elements.treeZoomInButton.addEventListener("click", () => zoomTreeView(1.16));
elements.treeZoomOutButton.addEventListener("click", () => zoomTreeView(1 / 1.16));
elements.treeResetButton.addEventListener("click", () => resetTreeView());
elements.treeViewport.addEventListener("pointerdown", handleTreePointerDown);
elements.treeViewport.addEventListener("pointermove", handleTreePointerMove);
elements.treeViewport.addEventListener("pointerup", handleTreePointerUp);
elements.treeViewport.addEventListener("pointercancel", handleTreePointerUp);
elements.treeViewport.addEventListener("wheel", handleTreeWheel, { passive: false });
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
  state.treeCollapsed.clear();
  state.treeSelectedId = null;
  state.treeAnalysis.clear();
  state.treeAnalysisPendingId = null;
  resetTreeView({ autoFit: true });
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
    state.treeSelectedId = latestMainlineNodeId(result.state);
    state.panel = panelFromMove(result.state);
    setGame(result.state);
  });
}

async function undoMove() {
  await runRequest(async () => {
    const result = await api("/api/undo", {
      sessionId: state.sessionId
    });
    state.treeSelectedId = latestMainlineNodeId(result.state);
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
  state.pendingSince = Date.now();
  state.errorMessage = null;
  startPendingTicker();
  renderStatus();
  updateDisabled();
  try {
    await task();
  } catch (error) {
    const refreshed = await refreshStateAfterFailure();
    state.errorMessage = refreshed
      ? `${error.message} ${t("stateRefreshed")}`
      : error.message;
  } finally {
    state.pending = false;
    state.pendingSince = null;
    stopPendingTicker();
    if (state.game) render();
    else {
      updateDisabled();
      if (state.errorMessage) renderError(state.errorMessage);
    }
  }
}

async function api(path, payload) {
  const timeoutMs = currentRequestTimeoutMs();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload ?? {}),
      signal: controller.signal
    });
  } catch (error) {
    throw normalizeRequestError(error, timeoutMs);
  } finally {
    window.clearTimeout(timeout);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`Request failed: ${response.status}`);
  }

  if (!response.ok || result.ok === false) {
    throw new Error(result.error ?? `Request failed: ${response.status}`);
  }
  return result;
}

async function fetchState() {
  if (!state.sessionId) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CLIENT_STATE_REFRESH_TIMEOUT_MS);
  try {
    const response = await fetch(`/api/state?session=${encodeURIComponent(state.sessionId)}`, {
      cache: "no-store",
      signal: controller.signal
    });
    const result = await response.json();
    if (!response.ok || result.ok === false) return null;
    return result.state ?? null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function refreshStateAfterFailure() {
  const latest = await fetchState();
  if (!latest) return false;
  setGame(latest);
  return true;
}

function currentRequestTimeoutMs() {
  const serverBudget = Number(state.game?.web?.requestTimeoutMs);
  if (Number.isFinite(serverBudget) && serverBudget > 0) {
    return serverBudget + CLIENT_REQUEST_TIMEOUT_BUFFER_MS;
  }
  return DEFAULT_CLIENT_REQUEST_TIMEOUT_MS;
}

function normalizeRequestError(error, timeoutMs) {
  if (error?.name === "AbortError") {
    return new Error(`${t("requestTimedOut")} (${formatDuration(timeoutMs)})`);
  }
  return new Error(t("requestFailed"));
}

function startPendingTicker() {
  stopPendingTicker();
  pendingRenderTimer = window.setInterval(() => {
    if (state.pending) renderStatus();
  }, PENDING_STATUS_INTERVAL_MS);
}

function stopPendingTicker() {
  if (!pendingRenderTimer) return;
  window.clearInterval(pendingRenderTimer);
  pendingRenderTimer = null;
}

function setGame(game) {
  state.game = game;
  state.sessionId = game.sessionId;
  syncTreeSelection();
  if (!state.panel) {
    state.panel = panelFromTreeSelection() ?? panelFromMove(game);
  }
  render();
}

function render() {
  renderStatus();
  renderBoard();
  renderSelectedMoves();
  renderEngineInfo();
  renderLastMove();
  renderReasoning();
  renderHistory();
  updateDisabled();
}

function renderStatus() {
  const game = state.game;
  if (!game) return;

  if (state.pending) {
    elements.gameStatus.textContent = pendingStatusText();
    elements.turnPill.textContent = t("thinkingShort");
    elements.turnPill.className = "turn-pill thinking";
    return;
  }

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

  const boardView = boardCellsForTreeSelection();
  const previewing = isTreeBoardPreview();
  const cellsByCoord = new Map(boardView.map((cell) => [cell.coord, cell]));
  const legalFrom = previewing ? new Set() : legalMovesFrom();
  const legalTargetMoves = previewing ? new Map() : selectedTargetMoves();
  const legalTargets = new Set(legalTargetMoves.keys());

  elements.boardWrap.classList.toggle("black-view", game.playerSide === "black");
  elements.boardWrap.classList.toggle("tree-preview", previewing);
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
      button.style.setProperty("--file", point.file);
      button.style.setProperty("--rank", point.rank);
      button.disabled = state.pending || previewing || !game.playerTurn;
      button.title = cellTitle(cell, coord, targetMove);
      button.setAttribute("aria-label", cellTitle(cell, coord, targetMove));
      if (state.selected === coord) button.classList.add("selected");
      if (legalTargets.has(coord)) button.classList.add("target");

      if (cell?.piece) {
        const piece = document.createElement("span");
        piece.className = `piece ${cell.piece.side}`;
        piece.title = cellTitle(cell, coord);
        const glyph = document.createElement("span");
        glyph.className = "piece-glyph";
        glyph.textContent = pieceSymbol(cell.piece);
        piece.append(glyph);
        button.append(piece);
      }
      if (targetMove) {
        const moveLabel = document.createElement("span");
        moveLabel.className = `move-label ${point.file % 2 === 0 ? "move-label-high" : "move-label-low"}`;
        moveLabel.textContent = moveLabelText(targetMove.notation, targetMove.zhNotation);
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
  const treeNode = selectedTreeNode();
  if (treeNode?.kind === "analysis") {
    renderAnalysisBranchSummary(treeNode);
    return;
  }
  if (treeNode && state.treeAnalysis.has(treeNode.id)) {
    renderTreeAnalysisSummary(treeNode);
    return;
  }
  if (treeNode?.kind === "alternative") {
    renderAlternativeSummary(treeNode);
    return;
  }

  const last = treeNode?.kind === "main" ? treeNode.move : state.game?.lastMove;
  if (!last) {
    elements.lastMovePanel.className = "stack muted";
    elements.lastMovePanel.textContent = t("noMoves");
    return;
  }

  const review = last.review;
  const decision = last.decision;
  const details = [];
  details.push(`<div class="line"><strong>${escapeHtml(sideName(last.side))}</strong> ${formatMoveHtml(last.notation, last.zhNotation)} <span class="score">${escapeHtml(actorName(last.actor))}</span></div>`);
  if (decision) details.push(`<div>${escapeHtml(localizedDecisionSummary(decision))}</div>`);
  if (review) details.push(`<div>${escapeHtml(localizedReviewSummary(review))}</div>`);
  if (review?.practiceFocus) {
    const focus = localizedPracticeFocus(review.practiceFocus);
    details.push(`<div class="line"><strong>${escapeHtml(focus.title)}</strong><br>${escapeHtml(focus.text)}</div>`);
  }
  if (review?.planComparison?.summary) {
    details.push(`<div class="line">${escapeHtml(localizedPlanComparisonSummary(review.planComparison))}</div>`);
  }
  if (treeNode?.kind === "main") details.push(renderSelectedNodeActions(treeNode));

  elements.lastMovePanel.className = "stack";
  elements.lastMovePanel.innerHTML = details.join("");
  bindTreeRestoreAction();
  bindTreeRecomputeActions(elements.lastMovePanel);
}

function renderTreeAnalysisSummary(node) {
  const analysis = state.treeAnalysis.get(node.id);
  const best = analysis?.best;
  const details = [
    `<div class="line"><strong>${escapeHtml(t("generatedBranches"))}</strong> <span class="score">${escapeHtml(treeNodePrefix(node))}</span></div>`
  ];
  if (best?.bestMove) {
    details.push(`<div>${escapeHtml(localizedDecisionSummary(best))}</div>`);
  }
  if (analysis?.branches?.length) {
    details.push(`<div class="score">${analysis.branches.length} ${escapeHtml(t("generatedBranches"))}</div>`);
  }
  details.push(renderSelectedNodeActions(node));

  elements.lastMovePanel.className = "stack";
  elements.lastMovePanel.innerHTML = details.join("");
  bindTreeRestoreAction();
  bindTreeRecomputeActions(elements.lastMovePanel);
}

function renderAlternativeSummary(node) {
  const alternative = node.alternative;
  const details = [
    `<div class="line"><strong>${escapeHtml(t("alternativeLine"))}</strong> ${formatMoveHtml(alternative.move, alternative.zhMove)} <span class="score">${escapeHtml(t("branchPoint"))}: ${formatMoveHtml(node.parentMove.notation, node.parentMove.zhNotation)}</span></div>`
  ];
  if (alternative.boardAfter) {
    details.push(`<div class="score">${escapeHtml(t("variationPreview"))}: ${formatMoveHtml(alternative.move, alternative.zhMove)}</div>`);
  }
  const reply = alternative.expectedReply
    ? `<div class="score">${escapeHtml(t("expectedReply"))}: ${formatMoveHtml(alternative.expectedReply, alternative.zhExpectedReply)}</div>`
    : "";
  const loss = Number.isFinite(alternative.centipawnLoss)
    ? `<div class="score">${escapeHtml(t("loss"))}: ${Math.round(alternative.centipawnLoss)} cp</div>`
    : "";
  const score = alternative.scoreDetail?.text ?? (Number.isFinite(alternative.score) ? formatCentipawns(alternative.score) : "");
  if (score) details.push(`<div class="score">${escapeHtml(t("scorePrefix"))}: ${escapeHtml(score)}</div>`);
  if (reply) details.push(reply);
  if (loss) details.push(loss);
  details.push(renderSelectedNodeActions(node));

  elements.lastMovePanel.className = "stack";
  elements.lastMovePanel.innerHTML = details.join("");
  bindTreeRecomputeActions(elements.lastMovePanel);
}

function renderAnalysisBranchSummary(node) {
  const branch = node.branch;
  const details = [
    `<div class="line"><strong>${escapeHtml(t("analysisBranch"))}</strong> ${formatMoveHtml(branch.move, branch.zhMove)} <span class="score">${escapeHtml(treeNodePrefix(node))}</span></div>`
  ];
  const summary = analysisBranchSummaryText(branch);
  if (summary) details.push(`<div class="score">${escapeHtml(summary)}</div>`);
  if (branch.summary) details.push(`<div>${escapeHtml(localizedChineseText(branch.summary))}</div>`);
  details.push(renderSelectedNodeActions(node));

  elements.lastMovePanel.className = "stack";
  elements.lastMovePanel.innerHTML = details.join("");
  bindTreeRecomputeActions(elements.lastMovePanel);
}

function renderSelectedNodeActions(node) {
  const actions = [
    `<button class="tree-restore-button" type="button" data-tree-recompute="${escapeHtml(node.id)}">${escapeHtml(t("recomputeNode"))}</button>`
  ];
  if (node.kind === "main" && node.id !== latestMainlineNodeId()) {
    actions.unshift(`<button class="tree-restore-button" type="button" data-tree-restore="${escapeHtml(node.id)}">${escapeHtml(t("restorePoint"))}</button>`);
  }
  return `<div class="tree-action-row">${actions.join("")}</div>`;
}

function renderReasoning() {
  if (state.errorMessage) {
    renderError(state.errorMessage);
    return;
  }

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
  if (panel.kind === "treeAlternative") {
    renderAlternativeReasoning(panel.node);
    return;
  }
  if (panel.kind === "treeAnalysis") {
    renderTreeAnalysisReasoning(panel.nodeId);
    return;
  }
  if (panel.kind === "treeBranch") {
    renderAnalysisBranchReasoning(panel.nodeId);
    return;
  }

  elements.reasoningPanel.className = "stack muted";
  elements.reasoningPanel.textContent = t("askPrompt");
}

function renderTreeAnalysisReasoning(nodeId) {
  const analysis = state.treeAnalysis.get(nodeId);
  if (!analysis?.best) {
    elements.reasoningPanel.className = "stack muted";
    elements.reasoningPanel.textContent = t("noDecision");
    return;
  }
  renderDecision(analysis.best);
}

function renderAnalysisBranchReasoning(nodeId) {
  const node = findTreeNode(nodeId);
  const branch = node?.branch;
  if (!branch) {
    elements.reasoningPanel.className = "stack muted";
    elements.reasoningPanel.textContent = t("noDecision");
    return;
  }

  const parts = [
    `<div>${formatMoveHtml(branch.move, branch.zhMove)} <span class="score">${escapeHtml(analysisBranchSummaryText(branch))}</span></div>`
  ];
  if (branch.expectedReply) {
    parts.push(`<div class="line"><strong>${escapeHtml(t("expectedReply"))}</strong> ${formatMoveHtml(branch.expectedReply, branch.zhExpectedReply)}</div>`);
  }
  if (branch.summary) {
    parts.push(`<div class="line">${escapeHtml(localizedChineseText(branch.summary))}</div>`);
  }
  if (branch.reasons?.length) {
    parts.push(`<ul class="reason-list">${branch.reasons.slice(0, 4).map((reason) => `<li>${escapeHtml(localizedChineseText(reason))}</li>`).join("")}</ul>`);
  }

  elements.reasoningPanel.className = "stack";
  elements.reasoningPanel.innerHTML = parts.join("");
}

function renderAlternativeReasoning(node) {
  const alternative = node?.alternative;
  if (!alternative) {
    elements.reasoningPanel.className = "stack muted";
    elements.reasoningPanel.textContent = t("noDecision");
    return;
  }

  const parts = [
    `<div>${formatMoveHtml(alternative.move, alternative.zhMove)} <span class="score">${escapeHtml(alternativeSummaryText(alternative))}</span></div>`
  ];
  if (alternative.boardAfter) {
    parts.push(`<div class="score">${escapeHtml(t("variationPreview"))}: ${formatMoveHtml(alternative.move, alternative.zhMove)}</div>`);
  }
  const comparisonSummary = localizedPlanComparisonSummary(alternative.planComparison);
  if (comparisonSummary) {
    parts.push(`<div class="line">${escapeHtml(comparisonSummary)}</div>`);
  }
  if (alternative.expectedReply) {
    parts.push(`<div class="line"><strong>${escapeHtml(t("expectedReply"))}</strong> ${formatMoveHtml(alternative.expectedReply, alternative.zhExpectedReply)}</div>`);
  }

  elements.reasoningPanel.className = "stack";
  elements.reasoningPanel.innerHTML = parts.join("");
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
  if (decision.comparison?.reason && !isChineseLocale()) parts.push(`<div class="line">${escapeHtml(decision.comparison.reason)}</div>`);
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
  if (review.planComparison?.summary) parts.push(`<div class="line">${escapeHtml(localizedPlanComparisonSummary(review.planComparison))}</div>`);
  if (review.practiceFocus) {
    const focus = localizedPracticeFocus(review.practiceFocus);
    parts.push(`<div class="line"><strong>${escapeHtml(focus.title)}</strong><br>${escapeHtml(focus.text)}</div>`);
  }
  elements.reasoningPanel.className = "stack";
  elements.reasoningPanel.innerHTML = parts.join("");
}

function renderHint(hint) {
  const levels = isChineseLocale() && hint?.zhLevels?.length ? hint.zhLevels : hint?.levels ?? [];
  const parts = levels.slice(0, 4).map((level) => (
    `<div class="line"><strong>${escapeHtml(localizedChineseText(level.title ?? `Hint ${level.level}`))}</strong><br>${escapeHtml(localizedChineseText(level.text ?? ""))}</div>`
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
      ? `<div class="score">${t("whyNot")}: ${escapeHtml(localizedPlanComparisonSummary(alternative.planComparison))}</div>`
      : "";
    const verdict = isChineseLocale() && (!alternative.verdict || alternative.verdict === "candidate")
      ? t("candidate")
      : alternative.verdict ?? t("candidate");
    return `<li><strong>${formatMoveHtml(alternative.move, alternative.zhMove)}</strong> <span class="score">${escapeHtml(verdict)}, ${escapeHtml(score)}${escapeHtml(loss)}${escapeHtml(reply)}</span>${why}</li>`;
  });
  return `<ol class="alternative-list">${rows.join("")}</ol>`;
}

function renderHistory() {
  const tree = buildMoveTree();
  if (!tree.length) {
    state.treeView.layoutWidth = 0;
    state.treeView.layoutHeight = 0;
    elements.historyList.className = "move-tree-canvas muted";
    elements.historyList.style.width = "";
    elements.historyList.style.height = "";
    elements.historyList.innerHTML = `<div class="move-tree-empty">${escapeHtml(t("treeEmpty"))}</div>`;
    applyTreeTransform();
    return;
  }

  const layout = layoutMoveTree(tree);
  state.treeView.layoutWidth = layout.width;
  state.treeView.layoutHeight = layout.height;
  elements.historyList.className = "move-tree-canvas";
  elements.historyList.style.width = `${layout.width}px`;
  elements.historyList.style.height = `${layout.height}px`;
  elements.historyList.style.setProperty("--tree-node-width", `${TREE_NODE_WIDTH}px`);
  elements.historyList.style.setProperty("--tree-node-height", `${TREE_NODE_HEIGHT}px`);
  elements.historyList.innerHTML = [
    renderTreeEdges(layout),
    layout.edges.map(renderTreeEdgeLabel).join(""),
    layout.nodes.map(renderTreeNode).join("")
  ].join("");
  elements.historyList.querySelectorAll("[data-tree-node]").forEach((button) => {
    button.addEventListener("click", () => selectTreeNode(button.dataset.treeNode));
  });
  elements.historyList.querySelectorAll("[data-tree-toggle]").forEach((button) => {
    button.addEventListener("click", () => toggleTreeNode(button.dataset.treeToggle));
  });
  elements.historyList.querySelectorAll("[data-tree-recompute]").forEach((button) => {
    button.addEventListener("click", () => recomputeTreeNode(button.dataset.treeRecompute));
  });
  window.requestAnimationFrame(() => {
    if (state.treeView.userPositioned) applyTreeTransform();
    else fitTreeView();
  });
}

function buildMoveTree() {
  const history = state.game?.history ?? [];
  if (!history.length) return [];

  const mainline = history.map((move) => ({
      id: mainlineNodeId(move.ply),
      kind: "main",
      move,
      children: []
  }));

  mainline.forEach((node, index) => {
    const next = mainline[index + 1];
    node.children = next ? moveOptionsForPly(next) : [];
  });

  return moveOptionsForPly(mainline[0]).map(attachAnalyzedChildren);
}

function moveOptionsForPly(mainNode) {
  return [
    mainNode,
    ...treeAlternativesForMove(mainNode.move, mainNode.id)
  ];
}

function treeAlternativesForMove(move, siblingOfId) {
  const sources = [{
    kind: "decision",
    alternatives: move.decision?.alternatives ?? []
  }, {
    kind: "review",
    alternatives: move.review?.bestAlternatives ?? []
  }];
  const seen = new Set([move.notation]);
  const alternatives = [];

  for (const source of sources) {
    source.alternatives.forEach((alternative, index) => {
      if (!alternative?.move || seen.has(alternative.move)) return;
      seen.add(alternative.move);
      alternatives.push({
        id: `alt-${move.ply}-${source.kind}-${index}`,
        kind: "alternative",
        siblingOfId,
        parentMove: move,
        source: source.kind,
        alternative,
        children: []
      });
    });
  }

  return alternatives.slice(0, 4);
}

function attachAnalyzedChildren(node) {
  const analysis = state.treeAnalysis.get(node.id) ?? null;
  const existingChildren = (node.children ?? []).map(attachAnalyzedChildren);
  const generated = (analysis?.branches ?? []).map((branch, index) => attachAnalyzedChildren({
    id: analysisNodeId(node.id, branch, index),
    kind: "analysis",
    parentId: node.id,
    branch,
    children: []
  }));
  return {
    ...node,
    analysis,
    children: [
      ...existingChildren,
      ...generated
    ]
  };
}

function analysisNodeId(parentId, branch, index) {
  const rank = Number.isFinite(branch?.rank) ? branch.rank : index + 1;
  return `${parentId}-line-${rank}-${sanitizeTreeId(branch?.move)}`;
}

function sanitizeTreeId(value) {
  return String(value ?? "node").replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function layoutMoveTree(roots) {
  let leafCursor = 0;
  const nodes = [];
  const edges = [];

  function place(node, depth) {
    const hasChildren = (node.children ?? []).length > 0;
    const expanded = !state.treeCollapsed.has(node.id);
    const visibleChildren = hasChildren && expanded ? node.children : [];
    const childItems = visibleChildren.map((child) => place(child, depth + 1));
    const y = childItems.length
      ? (childItems[0].y + childItems.at(-1).y) / 2
      : TREE_LAYOUT_PADDING + allocateLeafY();
    const item = {
      node,
      x: TREE_LAYOUT_PADDING + depth * (TREE_NODE_WIDTH + TREE_LEVEL_GAP),
      y,
      depth,
      hasChildren,
      expanded
    };

    nodes.push(item);
    childItems.forEach((childItem) => {
      edges.push({
        from: item,
        to: childItem,
        child: childItem.node
      });
    });
    return item;
  }

  function allocateLeafY() {
    const y = leafCursor;
    leafCursor += TREE_NODE_HEIGHT + TREE_SIBLING_GAP;
    return y;
  }

  roots.forEach((root) => place(root, 0));
  const width = Math.max(...nodes.map((item) => item.x + TREE_NODE_WIDTH), 0) + TREE_LAYOUT_PADDING;
  const height = Math.max(...nodes.map((item) => item.y + TREE_NODE_HEIGHT), 0) + TREE_LAYOUT_PADDING;

  return {
    nodes,
    edges,
    width,
    height
  };
}

function renderTreeEdges(layout) {
  const paths = layout.edges.map((edge) => {
    const x1 = edge.from.x + TREE_NODE_WIDTH;
    const y1 = edge.from.y + TREE_NODE_HEIGHT / 2;
    const x2 = edge.to.x;
    const y2 = edge.to.y + TREE_NODE_HEIGHT / 2;
    const handle = Math.max(44, (x2 - x1) * 0.46);
    const d = `M${x1} ${y1} C${x1 + handle} ${y1} ${x2 - handle} ${y2} ${x2} ${y2}`;
    return `<path class="move-tree-edge ${escapeHtml(edge.child.kind)}" d="${d}"></path>`;
  });
  return `<svg class="move-tree-edges" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">${paths.join("")}</svg>`;
}

function renderTreeEdgeLabel(edge) {
  const x1 = edge.from.x + TREE_NODE_WIDTH;
  const y1 = edge.from.y + TREE_NODE_HEIGHT / 2;
  const x2 = edge.to.x;
  const y2 = edge.to.y + TREE_NODE_HEIGHT / 2;
  const labelX = x1 + (x2 - x1) * 0.5;
  const labelY = y1 + (y2 - y1) * 0.5 - 14;
  return `<span class="move-tree-edge-label ${escapeHtml(edge.child.kind)}" style="left:${labelX}px;top:${labelY}px">${escapeHtml(treeNodeMoveText(edge.child))}</span>`;
}

function renderTreeNode(item) {
  const node = item.node;
  const selected = state.treeSelectedId === node.id;
  const current = node.kind === "main" && node.id === latestMainlineNodeId();
  const cardClasses = [
    "move-tree-node-card",
    `move-tree-${node.kind}`,
    selected ? "selected" : "",
    current ? "current" : ""
  ].filter(Boolean).join(" ");
  const ariaExpanded = item.hasChildren ? ` aria-expanded="${item.expanded ? "true" : "false"}"` : "";

  return `<div class="${cardClasses}" style="--tree-x:${item.x}px;--tree-y:${item.y}px" role="treeitem" aria-selected="${selected ? "true" : "false"}"${ariaExpanded}>${[
    renderTreeNodeButton(node, selected, current, item.hasChildren, item.expanded),
    renderTreeNodeActions(node, item)
  ].join("")}</div>`;
}

function renderTreeNodeButton(node, selected, current, hasChildren, expanded) {
  const ariaExpanded = hasChildren ? ` aria-expanded="${expanded ? "true" : "false"}"` : "";
  const tags = [
    `<span class="move-tree-tag">${escapeHtml(treeNodeKindLabel(node))}</span>`,
    current ? `<span class="move-tree-tag current">${escapeHtml(t("currentPosition"))}</span>` : "",
    selected ? `<span class="move-tree-tag selected">${escapeHtml(t("selectedNode"))}</span>` : "",
    node.analysis?.branches?.length ? `<span class="move-tree-tag generated">${escapeHtml(`${node.analysis.branches.length} ${t("generatedBranches")}`)}</span>` : ""
  ].filter(Boolean).join("");

  return `<button class="move-tree-node ${escapeHtml(node.kind)}" type="button" data-tree-node="${escapeHtml(node.id)}"${ariaExpanded}>${[
    renderMiniBoard(treeNodeBoard(node)),
    `<span class="move-tree-copy">` + [
      `<span class="move-tree-ply">${escapeHtml(treeNodePrefix(node))}</span>`,
      `<span class="move-tree-move">${treeNodeMoveHtml(node)}</span>`,
      `<span class="move-tree-meta">${escapeHtml(treeNodeSummaryText(node))}${tags}</span>`
    ].join("") + `</span>`
  ].join("")}</button>`;
}

function renderTreeNodeActions(node, item) {
  const toggle = item.hasChildren
    ? `<button class="move-tree-toggle" type="button" data-tree-toggle="${escapeHtml(node.id)}" title="${escapeHtml(item.expanded ? t("fold") : t("expand"))}" aria-label="${escapeHtml(item.expanded ? t("fold") : t("expand"))}">${item.expanded ? "−" : "+"}</button>`
    : "";
  const className = item.hasChildren ? "move-tree-node-actions" : "move-tree-node-actions single";
  return `<span class="${className}">${toggle}${renderTreeRecomputeButton(node)}</span>`;
}

function renderTreeRecomputeButton(node) {
  const pending = state.pending && state.treeAnalysisPendingId === node.id;
  return `<button class="move-tree-recompute" type="button" data-tree-recompute="${escapeHtml(node.id)}" title="${escapeHtml(t("recomputeNode"))}" aria-label="${escapeHtml(t("recomputeNode"))}"${state.pending ? " disabled" : ""}>${pending ? "…" : "↻"}</button>`;
}

function renderMiniBoard(board) {
  const cells = Array.isArray(board) ? board : [];
  const pieces = cells
    .filter((cell) => cell?.piece)
    .map((cell) => {
      const point = visualPoint(cell.coord, state.game?.playerSide ?? "red");
      return `<span class="mini-piece ${escapeHtml(cell.piece.side)}" style="--file:${point.file};--rank:${point.rank}">${escapeHtml(pieceSymbol(cell.piece))}</span>`;
    });
  return `<span class="mini-board" aria-hidden="true">${pieces.join("")}</span>`;
}

function treeNodeKindLabel(node) {
  if (node.kind === "main") return t("mainLine");
  if (node.kind === "alternative") return t("alternativeLine");
  return t("analysisBranch");
}

function treeNodePrefix(node) {
  if (node.kind === "main") {
    const move = node.move;
    return move.side === "black" ? `${move.moveNumber}...` : `${move.moveNumber}.`;
  }
  if (node.kind === "analysis") {
    return t("branchRank").replace("{rank}", String(node.branch?.rank ?? ""));
  }
  return t("alternativeLine");
}

function treeNodeMoveHtml(node) {
  if (node.kind === "main") return formatMoveHtml(node.move.notation, node.move.zhNotation);
  if (node.kind === "analysis") return formatMoveHtml(node.branch.move, node.branch.zhMove);
  return formatMoveHtml(node.alternative.move, node.alternative.zhMove);
}

function treeNodeMoveText(node) {
  if (node.kind === "main") return moveText(node.move.notation, node.move.zhNotation);
  if (node.kind === "analysis") return moveText(node.branch.move, node.branch.zhMove);
  return moveText(node.alternative.move, node.alternative.zhMove);
}

function treeNodeSummaryText(node) {
  if (node.kind === "main") return actorName(node.move.actor);
  if (node.kind === "analysis") return analysisBranchSummaryText(node.branch);
  return alternativeSummaryText(node.alternative);
}

function treeNodeBoard(node) {
  if (node?.kind === "main") return node.move.boardAfter ?? state.game?.board ?? [];
  if (node?.kind === "alternative") return node.alternative.boardAfter ?? node.parentMove.boardBefore ?? state.game?.board ?? [];
  if (node?.kind === "analysis") return node.branch.boardAfter ?? state.game?.board ?? [];
  return state.game?.board ?? [];
}

function alternativeSummaryText(alternative) {
  const parts = [];
  if (alternative.expectedReply) {
    parts.push(`${t("expectedReply")} ${moveText(alternative.expectedReply, alternative.zhExpectedReply)}`);
  }
  if (Number.isFinite(alternative.centipawnLoss)) {
    parts.push(`${t("loss")} ${Math.round(alternative.centipawnLoss)} cp`);
  } else if (Number.isFinite(alternative.score)) {
    parts.push(`${t("scorePrefix")} ${formatCentipawns(alternative.score)}`);
  }
  if (!parts.length && alternative.verdict) parts.push(localizedChineseText(alternative.verdict));
  return parts.join(" · ");
}

function analysisBranchSummaryText(branch) {
  const parts = [];
  if (branch.expectedReply) {
    parts.push(`${t("expectedReply")} ${moveText(branch.expectedReply, branch.zhExpectedReply)}`);
  }
  if (Number.isFinite(branch.centipawnLoss)) {
    parts.push(`${t("loss")} ${Math.round(branch.centipawnLoss)} cp`);
  } else if (Number.isFinite(branch.score)) {
    parts.push(`${t("scorePrefix")} ${formatCentipawns(branch.score)}`);
  }
  return parts.join(" · ");
}

function selectTreeNode(id) {
  if (!id) return;
  state.treeSelectedId = id;
  state.selected = null;
  state.panel = panelFromTreeSelection() ?? panelFromMove(state.game);
  render();
}

async function recomputeTreeNode(id) {
  const node = findTreeNode(id);
  const requestNode = analysisRequestForTreeNode(node);
  if (!requestNode) return;

  state.treeAnalysisPendingId = id;
  await runRequest(async () => {
    const result = await api("/api/analyze-node", {
      sessionId: state.sessionId,
      node: requestNode
    });
    state.treeAnalysis.set(id, result.analysis);
    state.treeSelectedId = id;
    state.panel = {
      kind: "treeAnalysis",
      nodeId: id
    };
    state.selected = null;
    setGame(result.state);
  });
  state.treeAnalysisPendingId = null;
  if (state.game) render();
}

function analysisRequestForTreeNode(node) {
  if (!node) return null;
  if (node.kind === "main") {
    return {
      kind: "main",
      ply: node.move.ply
    };
  }
  if (node.kind === "alternative") {
    return {
      kind: "alternative",
      parentPly: node.parentMove.ply,
      move: node.alternative.move
    };
  }
  if (node.kind === "analysis" && node.branch.fenAfter) {
    return {
      kind: "fen",
      fen: node.branch.fenAfter
    };
  }
  return null;
}

async function restoreTreeNode(id) {
  const node = findTreeNode(id);
  if (node?.kind !== "main") return;
  await runRequest(async () => {
    const result = await api("/api/jump", {
      sessionId: state.sessionId,
      ply: node.move.ply
    });
    state.treeSelectedId = latestMainlineNodeId(result.state);
    state.panel = panelFromMove(result.state);
    state.selected = null;
    setGame(result.state);
  });
}

function bindTreeRestoreAction() {
  elements.lastMovePanel.querySelectorAll("[data-tree-restore]").forEach((button) => {
    button.addEventListener("click", () => restoreTreeNode(button.dataset.treeRestore));
  });
}

function bindTreeRecomputeActions(root) {
  root.querySelectorAll("[data-tree-recompute]").forEach((button) => {
    button.addEventListener("click", () => recomputeTreeNode(button.dataset.treeRecompute));
  });
}

function toggleTreeNode(id) {
  if (!id) return;
  if (state.treeCollapsed.has(id)) state.treeCollapsed.delete(id);
  else state.treeCollapsed.add(id);
  renderHistory();
}

function applyTreeTransform() {
  elements.historyList.style.transform = `translate(${state.treeView.x}px, ${state.treeView.y}px) scale(${state.treeView.scale})`;
}

function fitTreeView(options = {}) {
  const viewport = elements.treeViewport;
  const width = state.treeView.layoutWidth;
  const height = state.treeView.layoutHeight;
  if (!viewport || !width || !height) {
    applyTreeTransform();
    return;
  }

  const rect = viewport.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    applyTreeTransform();
    return;
  }

  const padding = 34;
  const fittedScale = Math.min(
    (rect.width - padding * 2) / width,
    (rect.height - padding * 2) / height
  );
  const scale = clamp(fittedScale, TREE_MIN_SCALE, Math.min(1.08, TREE_MAX_SCALE));
  state.treeView.scale = scale;
  state.treeView.x = Math.round((rect.width - width * scale) / 2);
  state.treeView.y = Math.round((rect.height - height * scale) / 2);
  if (options.userInitiated) state.treeView.userPositioned = true;
  applyTreeTransform();
}

function zoomTreeView(factor, origin = null) {
  const viewport = elements.treeViewport;
  if (!viewport) return;

  const rect = viewport.getBoundingClientRect();
  const originX = origin?.x ?? rect.width / 2;
  const originY = origin?.y ?? rect.height / 2;
  const beforeX = (originX - state.treeView.x) / state.treeView.scale;
  const beforeY = (originY - state.treeView.y) / state.treeView.scale;
  const nextScale = clamp(state.treeView.scale * factor, TREE_MIN_SCALE, TREE_MAX_SCALE);

  state.treeView.scale = nextScale;
  state.treeView.x = originX - beforeX * nextScale;
  state.treeView.y = originY - beforeY * nextScale;
  state.treeView.userPositioned = true;
  applyTreeTransform();
}

function resetTreeView(options = {}) {
  state.treeView.x = 24;
  state.treeView.y = 24;
  state.treeView.scale = 1;
  state.treeView.userPositioned = Boolean(options.autoFit) ? false : true;
  applyTreeTransform();
}

function handleTreePointerDown(event) {
  if (event.button !== 0 || event.target.closest("button")) return;
  treeDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    viewX: state.treeView.x,
    viewY: state.treeView.y
  };
  state.treeView.userPositioned = true;
  elements.treeViewport.classList.add("dragging");
  elements.treeViewport.setPointerCapture(event.pointerId);
}

function handleTreePointerMove(event) {
  if (!treeDrag || treeDrag.pointerId !== event.pointerId) return;
  state.treeView.x = treeDrag.viewX + event.clientX - treeDrag.startX;
  state.treeView.y = treeDrag.viewY + event.clientY - treeDrag.startY;
  applyTreeTransform();
}

function handleTreePointerUp(event) {
  if (!treeDrag || treeDrag.pointerId !== event.pointerId) return;
  treeDrag = null;
  elements.treeViewport.classList.remove("dragging");
  if (elements.treeViewport.hasPointerCapture(event.pointerId)) {
    elements.treeViewport.releasePointerCapture(event.pointerId);
  }
}

function handleTreeWheel(event) {
  event.preventDefault();
  const rect = elements.treeViewport.getBoundingClientRect();
  const factor = event.deltaY > 0 ? 0.9 : 1.1;
  zoomTreeView(factor, {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  });
}

function syncTreeSelection() {
  const tree = buildMoveTree();
  const ids = new Set();
  for (const node of tree) {
    collectTreeNodeIds(node, ids);
  }
  for (const id of state.treeAnalysis.keys()) {
    if (!ids.has(id)) state.treeAnalysis.delete(id);
  }
  if (!state.treeSelectedId || !ids.has(state.treeSelectedId)) {
    state.treeSelectedId = latestMainlineNodeId();
  }
}

function collectTreeNodeIds(node, ids) {
  if (!node) return;
  ids.add(node.id);
  node.children?.forEach((child) => collectTreeNodeIds(child, ids));
}

function latestMainlineNodeId(game = state.game) {
  const last = game?.history?.at(-1);
  return last ? mainlineNodeId(last.ply) : null;
}

function mainlineNodeId(ply) {
  return `main-${ply}`;
}

function selectedTreeNode() {
  if (!state.treeSelectedId) return null;
  return findTreeNode(state.treeSelectedId);
}

function findTreeNode(id) {
  for (const node of buildMoveTree()) {
    const found = findTreeNodeInSubtree(node, id);
    if (found) return found;
  }
  return null;
}

function findTreeNodeInSubtree(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findTreeNodeInSubtree(child, id);
    if (found) return found;
  }
  return null;
}

function panelFromTreeSelection() {
  const node = selectedTreeNode();
  if (!node) return null;
  if (state.treeAnalysis.has(node.id)) return { kind: "treeAnalysis", nodeId: node.id };
  if (node.kind === "analysis") return { kind: "treeBranch", nodeId: node.id };
  if (node.kind === "alternative") return { kind: "treeAlternative", node };
  if (node.move?.decision) return { kind: "move", decision: node.move.decision };
  if (node.move?.review) return { kind: "move", review: node.move.review };
  return null;
}

function boardCellsForTreeSelection() {
  const node = selectedTreeNode();
  if (node) return treeNodeBoard(node);
  return state.game?.board ?? [];
}

function isTreeBoardPreview() {
  const node = selectedTreeNode();
  if (!node) return false;
  if (node.kind === "alternative") return true;
  return node.id !== latestMainlineNodeId();
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
    renderSelectedMoves();
    return;
  }

  if (cell?.piece?.side === game.playerSide && legalFrom.has(coord)) {
    state.selected = coord;
    renderBoard();
    renderSelectedMoves();
    return;
  }

  state.selected = null;
  renderBoard();
  renderSelectedMoves();
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

function renderSelectedMoves() {
  const panel = elements.selectedMoves;
  if (!panel) return;

  const game = state.game;
  const moves = [...selectedTargetMoves().values()];
  const selectedCell = game?.board.find((item) => item.coord === state.selected);
  if (!game || !state.selected || moves.length === 0 || !selectedCell?.piece) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }

  panel.hidden = false;
  const selectedName = pieceName(selectedCell.piece);
  const selectedHeading = `${selectedName}${t("legalMovesSuffix")}`;
  const chips = moves.map((move) => {
    const label = moveTitleText(move.notation, move.zhNotation);
    return `<button class="move-chip" type="button" data-move="${escapeHtml(move.notation)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${formatMoveHtml(move.notation, move.zhNotation)}</button>`;
  });
  panel.innerHTML = [
    `<div class="selected-moves-heading">${escapeHtml(selectedHeading)}</div>`,
    `<div class="selected-moves-grid">${chips.join("")}</div>`
  ].join("");
  panel.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("click", () => {
      const notation = button.dataset.move;
      state.selected = null;
      renderBoard();
      renderSelectedMoves();
      playMove(notation);
    });
  });
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
  document.title = t("appTitle");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    element.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    const key = element.dataset.i18nAriaLabel;
    element.setAttribute("aria-label", t(key));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    const key = element.dataset.i18nTitle;
    element.setAttribute("title", t(key));
    element.setAttribute("aria-label", t(key));
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

function pendingStatusText() {
  const elapsedMs = state.pendingSince ? Date.now() - state.pendingSince : 0;
  if (elapsedMs < PENDING_STATUS_INTERVAL_MS) return t("thinking");
  return `${t("thinking")} ${formatDuration(elapsedMs)}`;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (isChineseLocale()) {
    return minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
  }
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
  if (!isChineseLocale()) return String(files.length - file);
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

function cellTitle(cell, coord, targetMove = null) {
  const point = localizedPoint(coord);
  const separator = isChineseLocale() ? "，" : ", ";
  const move = targetMove ? `${separator}${moveTitleText(targetMove.notation, targetMove.zhNotation)}` : "";
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
  const glyphLocale = isChineseLocale() ? state.locale : "zh-TW";
  return pieceNames[glyphLocale]?.[piece.side]?.[piece.type]
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

function moveLabelText(notation, zhNotation) {
  if (zhNotation) return localizedChineseNotation(zhNotation);
  return notation ?? "";
}

function moveTitleText(notation, zhNotation) {
  const primary = moveText(notation, zhNotation);
  const secondary = isChineseLocale() ? notation : localizedChineseNotation(zhNotation);
  if (!secondary || secondary === primary) return primary;
  return `${primary} / ${secondary}`;
}

function localizedChineseNotation(text) {
  return localizedChineseText(text);
}

function localizedLinePlanSummary(linePlan) {
  if (!linePlan) return "";
  const text = isChineseLocale() ? linePlan.zhSummary ?? linePlan.summary ?? "" : linePlan.summary ?? linePlan.zhSummary ?? "";
  return localizedChineseText(text);
}

function localizedReasons(decision) {
  if (isChineseLocale() && decision.zhReasons?.length) return decision.zhReasons.map(localizedChineseText);
  return decision.reasons ?? [];
}

function localizedPlanComparisonSummary(comparison) {
  if (!comparison) return "";
  const text = isChineseLocale()
    ? comparison.zhSummary ?? (hasChineseText(comparison.summary) ? comparison.summary : "")
    : comparison.summary ?? comparison.zhSummary ?? "";
  return localizedChineseText(text);
}

function hasChineseText(text) {
  return /[\u3400-\u9fff]/.test(String(text ?? ""));
}

function localizedPracticeFocus(focus) {
  if (!focus || !isChineseLocale()) return focus;
  const [title, text] = practiceFocusTranslations[state.locale]?.[focus.category] ?? [];
  return {
    ...focus,
    title: title ?? localizedChineseText(focus.title ?? ""),
    text: text ?? localizedChineseText(focus.text ?? "")
  };
}

function localizedChineseText(text) {
  const value = String(text ?? "");
  if (state.locale === "zh-CN") return value.replace(/[\u3400-\u9fff]/g, (char) => simplifiedChineseMap[char] ?? char);
  if (state.locale === "zh-TW") return value.replace(/[\u3400-\u9fff]/g, (char) => traditionalChineseMap[char] ?? char);
  return value;
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
  const secondary = isChineseLocale() ? notation : localizedChineseNotation(zhNotation);
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
