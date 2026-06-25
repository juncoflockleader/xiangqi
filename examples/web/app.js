// ============================================================
// Xiangqi web UI — polished client (talks to the existing server API)
// ============================================================

const I18N = {
  "zh-CN": {
    appTitle: "中国象棋", booting: "启动中…",
    newGame: "新局", undo: "悔棋", hint: "提示", best: "最佳",
    coach: "教练分析", coachEmpty: "走一步棋，或点“提示 / 最佳”查看分析。",
    moves: "着法", settings: "设置", side: "执方", red: "红方", black: "黑方",
    level: "难度", lvlBeginner: "入门", lvlCasual: "休闲", lvlClub: "棋友", lvlExpert: "高手",
    language: "语言", settingsNote: "更改执方或难度将开始新对局。",
    thinking: "引擎思考中…", yourTurn: "轮到你了", check: "将军！",
    youWin: "你赢了！", youLose: "你输了", draw: "和棋", redToMove: "红方走棋", blackToMove: "黑方走棋",
    youPlayed: "你的着法", engineReplied: "引擎应着", enginePlan: "引擎计划",
    bestMove: "最佳着法", expectedReply: "预计应着",
    loss: "损失", cp: "分", bestTag: "最佳", hintTag: "提示",
    reviewPending: "复盘中…", noMoves: "尚未走子。",
    cls_best: "最佳", cls_brilliant: "精彩", cls_excellent: "极佳", cls_good: "良好",
    cls_inaccuracy: "欠精确", cls_mistake: "失误", cls_blunder: "漏着", cls_book: "定式",
    review: "复盘", reviewTitle: "复盘 · 变化树", reviewCollapse: "折叠全部分支",
    reviewHelp: "点小棋盘跳到该局面 · 点 ▸ 展开引擎候选分支",
    startPos: "起始局面", noGameYet: "尚无棋局可复盘。",
    errMove: "无法走子", errGeneric: "出错了"
  },
  "zh-TW": {
    appTitle: "中國象棋", booting: "啟動中…",
    newGame: "新局", undo: "悔棋", hint: "提示", best: "最佳",
    coach: "教練分析", coachEmpty: "走一步棋，或點「提示 / 最佳」查看分析。",
    moves: "著法", settings: "設定", side: "執方", red: "紅方", black: "黑方",
    level: "難度", lvlBeginner: "入門", lvlCasual: "休閒", lvlClub: "棋友", lvlExpert: "高手",
    language: "語言", settingsNote: "更改執方或難度將開始新對局。",
    thinking: "引擎思考中…", yourTurn: "輪到你了", check: "將軍！",
    youWin: "你贏了！", youLose: "你輸了", draw: "和棋", redToMove: "紅方走棋", blackToMove: "黑方走棋",
    youPlayed: "你的著法", engineReplied: "引擎應著", enginePlan: "引擎計劃",
    bestMove: "最佳著法", expectedReply: "預計應著",
    loss: "損失", cp: "分", bestTag: "最佳", hintTag: "提示",
    reviewPending: "覆盤中…", noMoves: "尚未走子。",
    cls_best: "最佳", cls_brilliant: "精彩", cls_excellent: "極佳", cls_good: "良好",
    cls_inaccuracy: "欠精確", cls_mistake: "失誤", cls_blunder: "漏著", cls_book: "定式",
    review: "覆盤", reviewTitle: "覆盤 · 變化樹", reviewCollapse: "摺疊全部分支",
    reviewHelp: "點小棋盤跳到該局面 · 點 ▸ 展開引擎候選分支",
    startPos: "起始局面", noGameYet: "尚無棋局可覆盤。",
    errMove: "無法走子", errGeneric: "出錯了"
  },
  en: {
    appTitle: "Xiangqi", booting: "Starting…",
    newGame: "New", undo: "Undo", hint: "Hint", best: "Best",
    coach: "Coach", coachEmpty: "Make a move, or tap Hint / Best for analysis.",
    moves: "Moves", settings: "Settings", side: "Side", red: "Red", black: "Black",
    level: "Level", lvlBeginner: "Beginner", lvlCasual: "Casual", lvlClub: "Club", lvlExpert: "Expert",
    language: "Language", settingsNote: "Changing side or level starts a new game.",
    thinking: "Engine thinking…", yourTurn: "Your move", check: "Check!",
    youWin: "You win!", youLose: "You lost", draw: "Draw", redToMove: "Red to move", blackToMove: "Black to move",
    youPlayed: "You played", engineReplied: "Engine replied", enginePlan: "Engine plan",
    bestMove: "Best move", expectedReply: "Expected reply",
    loss: "loss", cp: "cp", bestTag: "Best", hintTag: "Hint",
    reviewPending: "Reviewing…", noMoves: "No moves yet.",
    cls_best: "Best", cls_brilliant: "Brilliant", cls_excellent: "Excellent", cls_good: "Good",
    cls_inaccuracy: "Inaccuracy", cls_mistake: "Mistake", cls_blunder: "Blunder", cls_book: "Book",
    review: "Review", reviewTitle: "Review · Variation Tree", reviewCollapse: "Collapse all",
    reviewHelp: "Click a mini-board to jump · click ▸ to expand engine variations",
    startPos: "Start", noGameYet: "No game to review yet.",
    errMove: "Illegal move", errGeneric: "Something went wrong"
  }
};

// Difficulty is time-based. We pass a high `depth` deliberately: the server's
// play-level config defaults depth to as low as 4 (profiles.js), and a hard
// shallow depth makes the engine pick unsound moves (depth 4 → b2g2) for BOTH
// colors. Sending a non-binding depth overrides that so the movetime governs and
// iterative deepening converges to sound play (h2e2). Shorter time = weaker.
const UNCAPPED_DEPTH = 64;
const LEVELS = {
  beginner: { depth: UNCAPPED_DEPTH, timeLimitMs: 250, lines: 2 },
  casual: { depth: UNCAPPED_DEPTH, timeLimitMs: 800, lines: 2 },
  club: { depth: UNCAPPED_DEPTH, timeLimitMs: 2000, lines: 2 },
  expert: { depth: UNCAPPED_DEPTH, timeLimitMs: 5000, lines: 2 }
};

const FILE_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const FILE_HANZI = ["九", "八", "七", "六", "五", "四", "三", "二", "一"];

const state = {
  sessionId: null,
  locale: "zh-CN",
  side: "red",
  level: "club",
  game: null,
  selected: null,
  busy: false,
  coachOverride: null // { kind: 'hint'|'best', data }
};

// Floating review tree: branches keyed by FEN so they survive re-renders and
// live game updates. expanded = set of FENs whose children are shown.
const review = {
  open: false,
  // Persistent game tree of everything actually played this session, keyed by
  // FEN, so navigating back never erases forward lines — they become branches.
  gameTree: new Map(), // fen -> { fen, board, parentFen, move, children:Set<fen> }
  rootFen: null,
  branches: new Map(), // fen -> [engine-candidate child] (on-demand analyze)
  expanded: new Set(), // fen with engine candidates shown
  loading: new Set(),  // fen currently fetching
  nodeIndex: new Map(), // fen -> display node (rebuilt each render)
  view: { scale: 0.8, fitted: false }
};

const el = {};
function cache() {
  for (const id of [
    "board", "boardArea", "filesTop", "filesBottom", "thinking", "thinkingText",
    "engineBadge", "turnPill", "turnText", "gameStatus",
    "newButton", "undoButton", "hintButton", "bestButton",
    "coachCard", "coachTitle", "coachTag", "coachBody",
    "moveList", "moveCount", "sideSelect", "levelSelect", "localeSelect",
    "settings", "settingsNote", "toast",
    "reviewButton", "reviewWindow", "rwHead", "rwClose", "rwCollapse", "rwResize", "reviewTree", "rwHint",
    "rwZoomIn", "rwZoomOut", "rwFit"
  ]) el[id] = document.getElementById(id);
}

const t = (key) => I18N[state.locale]?.[key] ?? I18N["zh-CN"][key] ?? key;
const isZh = () => state.locale.startsWith("zh");

// ---- coordinate helpers (square = rank*9 + file; coord like "e2") ----
const fileOfSq = (sq) => sq % 9;
const rankOfSq = (sq) => Math.floor(sq / 9);
function coordToSquare(coord) {
  if (!coord || coord.length < 2) return null;
  const file = coord.charCodeAt(0) - 97; // 'a'
  const rank = Number(coord[1]);
  if (Number.isNaN(rank) || file < 0 || file > 8) return null;
  return rank * 9 + file;
}
function visualPoint(sq, side) {
  let file = fileOfSq(sq);
  let rank = rankOfSq(sq);
  if (side === "black") { file = 8 - file; rank = 9 - rank; }
  return { file, rank };
}
function parseMoveSquares(notation) {
  if (!notation) return null;
  const m = String(notation).toLowerCase().replace(/-/g, "");
  if (!/^[a-i][0-9][a-i][0-9]$/.test(m)) return null;
  return { from: coordToSquare(m.slice(0, 2)), to: coordToSquare(m.slice(2, 4)) };
}

// ---- API ----
async function api(path, payload) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {})
  });
  let data = {};
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok || data.ok === false) throw new Error(data.error || `${res.status}`);
  return data;
}

function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  requestAnimationFrame(() => el.toast.classList.add("show"));
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    el.toast.classList.remove("show");
    setTimeout(() => { el.toast.hidden = true; }, 250);
  }, 2600);
}

// ============================================================
// Rendering
// ============================================================
function render() {
  const g = state.game;
  applyChrome();
  if (!g) return;

  renderTurnStatus(g);
  renderBoard(g);
  renderMoveList(g);
  renderCoach(g);
  renderControls(g);
  accumulateGameTree(); // record played lines even while the review window is closed
  if (review.open) renderReviewTree();
}

function applyChrome() {
  document.documentElement.lang = state.locale;
  document.title = `${t("appTitle")} · Xiangqi`;
  for (const node of document.querySelectorAll("[data-i18n]")) {
    const key = node.getAttribute("data-i18n");
    if (I18N[state.locale]?.[key] !== undefined || I18N["zh-CN"][key] !== undefined) node.textContent = t(key);
  }
  el.thinkingText.textContent = t("thinking");
  // localized file labels (depend on view side)
  renderFileLabels();
}

function renderFileLabels() {
  const side = state.game?.playerSide ?? state.side;
  // top = opponent's numbering, bottom = player's. Keep it simple: bottom hanzi(player red convention), top arabic.
  const top = FILE_DIGITS;
  const bottom = side === "black" ? FILE_DIGITS.slice().reverse() : FILE_HANZI;
  el.filesTop.innerHTML = top.map((d) => `<span>${d}</span>`).join("");
  el.filesBottom.innerHTML = bottom.map((d) => `<span>${d}</span>`).join("");
}

function sideName(side) { return side === "red" ? t("red") : t("black"); }

function renderTurnStatus(g) {
  const turn = g.turn;
  el.turnPill.classList.toggle("black", turn === "black");
  el.turnText.textContent = sideName(turn) + (g.playerTurn ? " · " + t("yourTurn") : "");

  el.gameStatus.className = "status";
  const s = g.status?.state;
  if (s === "checkmate" || s === "stalemate") {
    const playerWon = g.status.winner === g.playerSide;
    el.gameStatus.textContent = playerWon ? t("youWin") : t("youLose");
    el.gameStatus.classList.add(playerWon ? "win" : "lose");
  } else if (s === "repetition") {
    el.gameStatus.textContent = t("draw");
  } else if (g.status?.inCheck) {
    el.gameStatus.textContent = t("check");
    el.gameStatus.classList.add("check");
  } else if (state.busy && !g.playerTurn) {
    el.gameStatus.textContent = t("thinking");
  } else {
    el.gameStatus.textContent = turn === "red" ? t("redToMove") : t("blackToMove");
  }

  const backend = g.backend?.name ?? "";
  el.engineBadge.textContent = `${backend.split(" with ")[0]} · ${t("lvl" + cap(state.level))}`;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function renderBoard(g) {
  const side = g.playerSide;
  const selected = state.selected;
  const targets = new Map(); // toSquare -> isCapture
  if (selected != null) {
    for (const m of g.legalMoves) {
      if (m.from === selected) targets.set(m.to, Boolean(m.captured));
    }
  }
  const last = parseMoveSquares(g.lastMove?.notation);
  let checkSq = null;
  if (g.status?.inCheck) {
    const k = g.board.find((c) => c.piece && c.piece.type === "king" && c.piece.side === g.turn);
    if (k) checkSq = k.square;
  }
  const canSelect = g.playerTurn && !state.busy;

  let html = "";
  for (const cell of g.board) {
    const sq = cell.square;
    const { file, rank } = visualPoint(sq, side);
    const classes = ["point"];
    const isTarget = targets.has(sq);
    if (isTarget) { classes.push("target"); if (targets.get(sq)) classes.push("capture"); }
    if (sq === selected) classes.push("selected");
    if (last && sq === last.from) classes.push("last-from");
    if (last && sq === last.to) classes.push("last-to");
    if (sq === checkSq) classes.push("in-check");
    const ownPiece = cell.piece && cell.piece.side === side;
    if ((canSelect && ownPiece) || isTarget) classes.push("actionable");

    const inner = cell.piece
      ? `<span class="piece ${cell.piece.side}">${cell.piece.symbol}</span>`
      : `<span class="marker"></span>`;
    const markerForOccupied = isTarget && cell.piece ? `<span class="marker"></span>` : "";
    html += `<div class="${classes.join(" ")}" data-square="${sq}" style="--file:${file};--rank:${rank}">${inner}${markerForOccupied}</div>`;
  }
  el.board.innerHTML = html;
}

function scoreClass(cp) { return cp > 30 ? "pos" : cp < -30 ? "neg" : "even"; }
function fmtScore(cp, text) {
  if (text && !/^[-+]?\d/.test(String(text))) return text; // verbose like "winning by force"
  const v = Math.round(cp ?? 0);
  return `${v >= 0 ? "+" : ""}${(v / 100).toFixed(2)}`;
}
function pvHtml(pv) {
  if (!pv || !pv.length) return "";
  return `<div class="pv">${pv.slice(0, 6).map((m) => `<span class="pv-move">${esc(m)}</span>`).join("")}</div>`;
}
function reasonsHtml(reasons) {
  if (!reasons || !reasons.length) return "";
  return `<ul class="reasons">${reasons.slice(0, 4).map((r) => `<li>${esc(r)}</li>`).join("")}</ul>`;
}
function classBadge(classification, isBest) {
  const c = (classification || (isBest ? "best" : "neutral")).toLowerCase();
  const label = t("cls_" + c) || c;
  const known = ["best", "brilliant", "excellent", "good", "inaccuracy", "mistake", "blunder"];
  const cls = known.includes(c) ? c : "neutral";
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

function renderCoach(g) {
  el.coachTag.hidden = true;

  if (state.coachOverride?.kind === "best") {
    const d = state.coachOverride.data;
    el.coachTitle.textContent = t("coach");
    setTag(t("bestTag"));
    const mv = isZh() ? (d.zhBestMove || d.bestMove) : d.bestMove;
    const pv = isZh() ? (d.zhPrincipalVariation?.length ? d.zhPrincipalVariation : d.principalVariation) : d.principalVariation;
    el.coachBody.innerHTML = `
      <div class="coach-block">
        <div class="coach-line"><span class="who">${esc(t("bestMove"))}</span>
          <span class="move-chip ${g.turn}">${esc(mv || "—")}</span>
          <span class="score ${scoreClass(d.score)}">${esc(fmtScore(d.score, d.scoreText))}</span></div>
        ${(!isZh() && d.summary) ? `<p class="coach-summary">${esc(d.summary)}</p>` : ""}
        ${reasonsHtml(isZh() ? (d.zhReasons?.length ? d.zhReasons : d.reasons) : d.reasons)}
        ${pvHtml(pv)}
      </div>`;
    return;
  }

  if (state.coachOverride?.kind === "hint") {
    const h = state.coachOverride.data;
    el.coachTitle.textContent = t("coach");
    setTag(t("hintTag"));
    const levels = isZh() ? (h.zhLevels?.length ? h.zhLevels : h.levels) : h.levels;
    const items = (levels || []).map((lv, i) => `
      <details class="level" ${i === 0 ? "open" : ""}>
        <summary>${esc(lv.title || ("· " + (i + 1)))}</summary>
        <p>${esc(lv.text || "")}</p>
      </details>`).join("");
    el.coachBody.innerHTML = `<div class="levels">${items || `<p class="muted">${esc(t("coachEmpty"))}</p>`}</div>`;
    return;
  }

  // default: the latest teaching turn (your move review + engine reply)
  el.coachTitle.textContent = t("coach");
  const turn = g.latestPlayerTeachingTurn || g.currentTeachingTurn;
  if (!turn || (!turn.playerMove && !turn.engineMove && !turn.engineThinking)) {
    el.coachBody.innerHTML = `<p class="muted">${esc(t("coachEmpty"))}</p>`;
    return;
  }

  let html = "";
  // your move + review
  if (turn.playerMove) {
    const pm = turn.playerMove;
    const review = turn.playerReview;
    const mv = isZh() ? (pm.zhNotation || pm.notation) : pm.notation;
    let badge = "", lossChip = "", detail = "";
    if (review) {
      badge = classBadge(review.classification, review.isBestMove);
      if (review.centipawnLoss > 5 && !review.isBestMove) {
        lossChip = `<span class="score neg">−${(review.centipawnLoss / 100).toFixed(2)}</span>`;
      }
      const rreasons = isZh() ? (review.zhReasons?.length ? review.zhReasons : review.reasons) : review.reasons;
      const sLine = (!isZh() && review.summary) ? `<p class="coach-summary">${esc(review.summary)}</p>` : "";
      detail = sLine + reasonsHtml(rreasons);
    } else if (turn.playerReviewPending) {
      badge = `<span class="badge neutral">${esc(t("reviewPending"))}</span>`;
    }
    html += `<div class="coach-block">
      <div class="coach-line"><span class="who">${esc(t("youPlayed"))}</span>
        <span class="move-chip ${pm.side}">${esc(mv)}</span>${badge}${lossChip}</div>
      ${detail}
    </div>`;
  }

  // engine reply / plan
  if (turn.engineThinking) {
    html += `<div class="coach-block"><div class="coach-line"><span class="who">${esc(t("engineReplied"))}</span><span class="muted">${esc(t("thinking"))}</span></div></div>`;
  } else if (turn.engineMove) {
    const em = turn.engineMove;
    const dec = em.decision;
    const mv = isZh() ? (em.zhNotation || em.notation) : em.notation;
    const summary = dec?.summary;
    const reasons = isZh() ? (dec?.zhReasons?.length ? dec.zhReasons : dec?.reasons) : dec?.reasons;
    const pv = isZh() ? (dec?.zhPrincipalVariation?.length ? dec.zhPrincipalVariation : dec?.principalVariation) : dec?.principalVariation;
    html += `<div class="coach-block">
      <div class="coach-line"><span class="who">${esc(t("engineReplied"))}</span>
        <span class="move-chip ${em.side}">${esc(mv)}</span>
        ${dec ? `<span class="score ${scoreClass(dec.score)}">${esc(fmtScore(dec.score, dec.scoreText))}</span>` : ""}</div>
      ${(!isZh() && summary) ? `<p class="coach-summary">${esc(summary)}</p>` : ""}
      ${reasonsHtml(reasons)}
      ${pvHtml(pv)}
    </div>`;
  }

  el.coachBody.innerHTML = html || `<p class="muted">${esc(t("coachEmpty"))}</p>`;
}
function setTag(text) { el.coachTag.textContent = text; el.coachTag.hidden = false; }

function renderMoveList(g) {
  const hist = g.history || [];
  el.moveCount.textContent = String(hist.length);
  if (!hist.length) {
    el.moveList.innerHTML = `<p class="muted empty-note">${esc(t("noMoves"))}</p>`;
    return;
  }
  // group into rows by moveNumber (red, black)
  const rows = new Map();
  for (const m of hist) {
    const n = m.moveNumber;
    if (!rows.has(n)) rows.set(n, { red: null, black: null });
    rows.get(n)[m.side] = m;
  }
  const currentPly = hist.length;
  let html = "";
  for (const [n, row] of rows) {
    html += `<div class="move-row"><span class="no">${n}.</span>${plyCell(row.red, currentPly)}${plyCell(row.black, currentPly)}</div>`;
  }
  el.moveList.innerHTML = html;
}
function plyCell(m, currentPly) {
  if (!m) return `<span class="ply empty">·</span>`;
  const label = isZh() ? (m.zhNotation || m.notation) : m.notation;
  const cls = m.ply === currentPly ? "ply current" : "ply";
  const tick = m.review?.classification
    ? `<span class="tick ${m.review.classification}">${tickGlyph(m.review.classification)}</span>` : "";
  return `<button class="${cls}" data-ply="${m.ply}">${esc(label)}${tick}</button>`;
}
function tickGlyph(c) {
  if (["mistake", "blunder"].includes(c)) return "✕";
  if (c === "inaccuracy") return "?";
  if (["best", "brilliant", "excellent", "good"].includes(c)) return "✓";
  return "";
}

function renderControls(g) {
  const playing = g.status?.state === "playing";
  el.undoButton.disabled = state.busy || !g.canUndo;
  el.hintButton.disabled = state.busy || !g.playerTurn || !playing;
  el.bestButton.disabled = state.busy || !playing;
  el.newButton.disabled = state.busy;
}

function setBusy(b) {
  state.busy = b;
  el.thinking.hidden = !b;
  if (state.game) renderControls(state.game);
}

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]); }

// ============================================================
// Floating review tree — visual node-link graph with mini-boards
// ============================================================
const RW = { NW: 132, NH: 180, GX: 46, GY: 26 };

function turnFromFen(fen) {
  const tok = String(fen || "").trim().split(/\s+/)[1];
  return tok === "b" ? "black" : "red";
}

// Render a tiny board from a serialized 90-cell array, oriented to the view side.
function miniBoard(board, viewSide, { navFen = null } = {}) {
  if (!board) return "";
  let cells = "";
  for (let r = 0; r < 10; r += 1) {
    for (let f = 0; f < 9; f += 1) {
      const file = viewSide === "black" ? 8 - f : f;
      const rank = viewSide === "black" ? 9 - r : r;
      const sq = rank * 9 + file;
      const piece = board[sq]?.piece;
      cells += `<span class="mc">${piece ? `<span class="mp ${piece.side}">${esc(piece.symbol)}</span>` : ""}</span>`;
    }
  }
  const navAttr = navFen ? ` data-nav="${esc(navFen)}"` : "";
  return `<div class="mini${navFen ? " jumpable" : ""}"${navAttr}>${cells}</div>`;
}

function scoreChip(score) {
  if (score == null || !Number.isFinite(score)) return "";
  const cls = score > 30 ? "pos" : score < -30 ? "neg" : "even";
  return `<span class="node-score ${cls}">${score >= 0 ? "+" : ""}${(score / 100).toFixed(2)}</span>`;
}

// Fold the current game's move list into the persistent game tree. Called on
// every state update, so lines played before a jump-back survive as branches.
function accumulateGameTree() {
  const g = state.game;
  if (!g) return;
  const hist = g.history || [];
  const ensure = (fen, board) => {
    if (!fen) return null;
    let n = review.gameTree.get(fen);
    if (!n) { n = { fen, board: board ?? null, parentFen: null, move: null, children: new Set() }; review.gameTree.set(fen, n); }
    else if (board && !n.board) n.board = board;
    return n;
  };
  const rootFen = hist[0]?.positionBefore ?? g.fen;
  ensure(rootFen, hist[0]?.boardBefore ?? g.board);
  if (!review.rootFen) review.rootFen = rootFen;
  for (const m of hist) {
    const child = ensure(m.positionAfter, m.boardAfter);
    if (!child) continue;
    child.parentFen = m.positionBefore;
    child.move = {
      notation: m.notation, zhNotation: m.zhNotation, side: m.side,
      moveNumber: m.moveNumber, score: m.decision?.score ?? null
    };
    ensure(m.positionBefore, m.boardBefore)?.children.add(m.positionAfter);
  }
}

// Build the display tree from the persistent game tree (played lines) plus any
// expanded engine-candidate branches. Current line = path from the live
// position back to the root; it forms the straight spine.
function buildReviewModel() {
  const g = state.game;
  const index = new Map();
  const rootFen = review.rootFen ?? g.fen;

  const onPath = new Set();
  for (let f = g.fen; f && review.gameTree.has(f); f = review.gameTree.get(f).parentFen) onPath.add(f);

  function build(fen, seen) {
    if (seen.has(fen)) return null; // guard against transposition cycles
    seen.add(fen);
    const tn = review.gameTree.get(fen);
    if (!tn) return null;
    const node = {
      id: fen, fen, board: tn.board,
      isStart: !tn.move,
      label: tn.move ? (isZh() ? (tn.move.zhNotation || tn.move.notation) : tn.move.notation) : null,
      side: tn.move?.side, moveNumber: tn.move?.moveNumber, score: tn.move?.score,
      onPath: onPath.has(fen), isCurrent: fen === g.fen, isEngine: false, children: []
    };
    index.set(fen, node);

    // Played children: the on-path one first so the current line stays straight.
    const kids = [...tn.children].sort((a, b) => (onPath.has(b) ? 1 : 0) - (onPath.has(a) ? 1 : 0));
    for (const ck of kids) { const c = build(ck, seen); if (c) node.children.push(c); }

    // Engine-candidate branches (preview-only, one level): shown when expanded,
    // skipping any that coincide with a real played child.
    if (review.expanded.has(fen) && review.branches.has(fen)) {
      for (const b of review.branches.get(fen)) {
        if (!b.fen || tn.children.has(b.fen)) continue;
        const child = {
          id: `eng:${fen}>${b.move}`, fen: b.fen, board: b.board, label: b.label,
          side: b.side, score: b.score, isEngine: true, onPath: false, isStart: false, children: []
        };
        index.set(child.id, child);
        node.children.push(child);
      }
    }
    seen.delete(fen);
    return node;
  }

  const root = build(rootFen, new Set()) ?? { id: rootFen, fen: rootFen, board: g.board, isStart: true, onPath: true, isCurrent: g.fen === rootFen, children: [] };
  if (!index.has(root.fen)) index.set(root.fen, root);
  review.nodeIndex = index;
  return root;
}

// Layered layout: depth → column (x), mainline stays on its row, each extra
// branch reserves a fresh row below everything placed so far.
function layoutReview(root) {
  let maxRow = 0, maxCol = 0;
  (function assign(node, col, row) {
    node.col = col; node.row = row;
    node.x = col * (RW.NW + RW.GX);
    node.y = row * (RW.NH + RW.GY);
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
    node.children.forEach((child, i) => {
      if (i === 0) assign(child, col + 1, row);
      else { maxRow += 1; assign(child, col + 1, maxRow); }
    });
  })(root, 0, 0);
  root._maxRow = maxRow; root._maxCol = maxCol;
}

function edgePath(parent, child) {
  const x1 = parent.x + RW.NW, y1 = parent.y + RW.NH / 2;
  const x2 = child.x, y2 = child.y + RW.NH / 2;
  const dx = Math.max(22, (x2 - x1) / 2);
  const cls = child.onPath ? "edge main" : "edge branch";
  return `<path class="${cls}" d="M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}"/>`;
}

function gnodeHtml(node, viewSide) {
  const open = review.expanded.has(node.fen);
  const loading = review.loading.has(node.fen);
  const expandCls = `gnode-exp${open ? " open" : ""}${loading ? " loading" : ""}`;
  let cap;
  if (node.isStart) {
    cap = `<span class="node-label start">${esc(t("startPos"))}</span>`;
  } else {
    const no = node.moveNumber ? `<span class="node-no">${node.moveNumber}.</span>` : "";
    cap = `${no}<span class="node-label ${node.side}">${esc(node.label)}</span>${scoreChip(node.score)}`;
  }
  const cls = node.isEngine ? "branch engine" : node.onPath ? "mainline" : "branch";
  // Played positions are navigable (jump the live game there) and expandable for
  // engine candidates; engine previews are neither.
  const navFen = node.isEngine ? null : node.fen;
  const expandBtn = node.isEngine ? "" : `<button class="${expandCls}" data-expand="${esc(node.fen)}" aria-label="expand">▸</button>`;
  return `<div class="gnode ${cls}${node.isCurrent ? " current" : ""}" style="left:${node.x}px;top:${node.y}px;width:${RW.NW}px;">
      ${miniBoard(node.board, viewSide, { navFen })}
      <div class="gnode-cap">${cap}${expandBtn}</div>
    </div>`;
}

function renderReviewTree() {
  const g = state.game;
  el.rwHint.textContent = t("reviewHelp");
  document.querySelector("#reviewWindow .rw-title span").textContent = t("reviewTitle");
  if (!g) { el.reviewTree.innerHTML = `<p class="rw-empty">${esc(t("noGameYet"))}</p>`; return; }

  const root = buildReviewModel();
  layoutReview(root);
  const nodes = [...review.nodeIndex.values()];
  const W = (root._maxCol + 1) * (RW.NW + RW.GX);
  const H = (root._maxRow + 1) * (RW.NH + RW.GY);
  const s = review.view.scale;

  let edges = "";
  for (const n of nodes) for (const c of n.children) edges += edgePath(n, c);
  let cards = "";
  for (const n of nodes) cards += gnodeHtml(n, g.playerSide);

  el.reviewTree.innerHTML =
    `<div class="rw-viewport" style="width:${Math.round(W * s)}px;height:${Math.round(H * s)}px;">
       <div class="rw-world" style="width:${W}px;height:${H}px;transform:scale(${s});">
         <svg class="rw-edges" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${edges}</svg>
         ${cards}
       </div>
     </div>`;
}

async function expandReviewNode(fen) {
  if (review.expanded.has(fen)) { review.expanded.delete(fen); renderReviewTree(); return; }
  if (review.branches.has(fen)) { review.expanded.add(fen); renderReviewTree(); return; }

  review.loading.add(fen);
  renderReviewTree();
  try {
    const data = await api("/api/analyze-node", { sessionId: state.sessionId, node: { fen } });
    const moverSide = turnFromFen(fen);
    const children = (data.analysis?.branches || [])
      .map((b) => ({
        fen: b.fenAfter, board: b.boardAfter, move: b.move,
        label: isZh() ? (b.zhMove || b.move) : b.move, side: moverSide, score: b.score
      }))
      .filter((c) => c.fen && c.board);
    review.branches.set(fen, children);
    review.expanded.add(fen);
  } catch (e) {
    showToast(t("errGeneric"));
  } finally {
    review.loading.delete(fen);
    renderReviewTree();
  }
}

// Navigate the live game to any position in the tree (by FEN). The server starts
// a fresh continuable game from that position; the persistent tree keeps every
// other line, so playing a different move here just adds a branch.
async function navigateToFen(fen) {
  if (!fen || fen === state.game?.fen) return;
  setBusy(true);
  try {
    const data = await api("/api/select-node", { sessionId: state.sessionId, node: { fen } });
    state.selected = null;
    state.coachOverride = null;
    state.game = data.state;
  } catch (e) {
    showToast(t("errGeneric"));
  } finally {
    setBusy(false);
    render();
  }
}

function setReviewScale(scale) {
  review.view.scale = Math.max(0.3, Math.min(1.5, scale));
  renderReviewTree();
}

function fitReviewTree() {
  const vp = el.reviewTree;
  const world = vp.querySelector(".rw-world");
  if (!world) return;
  const W = world.offsetWidth, H = world.offsetHeight;
  if (W <= 0 || H <= 0) return;
  const s = Math.min((vp.clientWidth - 24) / W, (vp.clientHeight - 24) / H, 1.2);
  setReviewScale(s);
  vp.scrollLeft = 0; vp.scrollTop = 0;
}

function toggleReview() {
  review.open = !review.open;
  el.reviewWindow.hidden = !review.open;
  if (review.open) { renderReviewTree(); requestAnimationFrame(fitReviewTree); }
}

// drag/resize the floating window; pan/zoom/click the graph canvas
function setupReviewWindowControls() {
  let drag = null, resize = null, pan = null;

  el.rwHead.addEventListener("mousedown", (ev) => {
    if (ev.target.closest(".rw-icon")) return;
    const rect = el.reviewWindow.getBoundingClientRect();
    el.reviewWindow.style.transform = "none";
    el.reviewWindow.style.left = `${rect.left}px`;
    el.reviewWindow.style.top = `${rect.top}px`;
    drag = { x: ev.clientX, y: ev.clientY, left: rect.left, top: rect.top };
    ev.preventDefault();
  });
  el.rwResize.addEventListener("mousedown", (ev) => {
    const rect = el.reviewWindow.getBoundingClientRect();
    resize = { x: ev.clientX, y: ev.clientY, w: rect.width, h: rect.height };
    ev.preventDefault(); ev.stopPropagation();
  });
  el.reviewTree.addEventListener("mousedown", (ev) => {
    if (ev.target.closest(".gnode")) return; // node interactions handle themselves
    pan = { x: ev.clientX, y: ev.clientY, sl: el.reviewTree.scrollLeft, st: el.reviewTree.scrollTop };
    el.reviewTree.classList.add("panning");
    ev.preventDefault();
  });

  window.addEventListener("mousemove", (ev) => {
    if (drag) {
      el.reviewWindow.style.left = `${Math.max(0, drag.left + ev.clientX - drag.x)}px`;
      el.reviewWindow.style.top = `${Math.max(0, drag.top + ev.clientY - drag.y)}px`;
    } else if (resize) {
      el.reviewWindow.style.width = `${Math.max(360, resize.w + ev.clientX - resize.x)}px`;
      el.reviewWindow.style.height = `${Math.max(280, resize.h + ev.clientY - resize.y)}px`;
    } else if (pan) {
      el.reviewTree.scrollLeft = pan.sl - (ev.clientX - pan.x);
      el.reviewTree.scrollTop = pan.st - (ev.clientY - pan.y);
    }
  });
  window.addEventListener("mouseup", () => {
    drag = null; resize = null;
    if (pan) { pan = null; el.reviewTree.classList.remove("panning"); }
  });

  el.reviewTree.addEventListener("click", (ev) => {
    const expandBtn = ev.target.closest("[data-expand]");
    if (expandBtn) { expandReviewNode(expandBtn.dataset.expand); return; }
    const nav = ev.target.closest("[data-nav]");
    if (nav) navigateToFen(nav.dataset.nav);
  });
}

// ============================================================
// Actions
// ============================================================
async function newGame() {
  setBusy(true);
  try {
    const data = await api("/api/new", { side: state.side, ...LEVELS[state.level] });
    state.sessionId = data.state.sessionId;
    state.selected = null;
    state.coachOverride = null;
    review.expanded.clear();
    review.branches.clear();
    review.gameTree.clear();
    review.rootFen = null;
    state.game = data.state;
  } catch (e) {
    showToast(t("errGeneric") + ": " + e.message);
  } finally {
    setBusy(false);
    render();
  }
}

async function sendMove(notation) {
  setBusy(true);
  state.selected = null;
  state.coachOverride = null;
  render();
  try {
    const data = await api("/api/move", { sessionId: state.sessionId, move: notation });
    state.game = data.state;
  } catch (e) {
    showToast(t("errMove"));
  } finally {
    setBusy(false);
    render();
  }
}

async function undo() {
  setBusy(true);
  try {
    // undo engine reply + player move (two pops) when possible
    let data = await api("/api/undo", { sessionId: state.sessionId });
    if (data.state && !data.state.playerTurn && data.state.canUndo) {
      data = await api("/api/undo", { sessionId: state.sessionId });
    }
    state.selected = null;
    state.coachOverride = null;
    state.game = data.state;
  } catch (e) {
    showToast(t("errGeneric"));
  } finally {
    setBusy(false);
    render();
  }
}

async function requestHint() {
  setBusy(true);
  try {
    const data = await api("/api/hint", { sessionId: state.sessionId });
    state.game = data.state;
    state.coachOverride = { kind: "hint", data: data.hint };
  } catch (e) {
    showToast(t("errGeneric"));
  } finally {
    setBusy(false);
    render();
  }
}

async function requestBest() {
  setBusy(true);
  try {
    const data = await api("/api/best", { sessionId: state.sessionId });
    state.game = data.state;
    state.coachOverride = { kind: "best", data: data.best };
  } catch (e) {
    showToast(t("errGeneric"));
  } finally {
    setBusy(false);
    render();
  }
}

async function jumpToPly(ply) {
  setBusy(true);
  try {
    const data = await api("/api/jump", { sessionId: state.sessionId, ply, deferEngine: true });
    state.selected = null;
    state.coachOverride = null;
    state.game = data.state;
  } catch (e) {
    showToast(t("errGeneric"));
  } finally {
    setBusy(false);
    render();
  }
}

// ============================================================
// Board interaction
// ============================================================
function onBoardClick(ev) {
  const point = ev.target.closest(".point");
  if (!point) return;
  const g = state.game;
  if (!g || state.busy || !g.playerTurn) return;
  const sq = Number(point.dataset.square);

  // is this a legal target of the current selection?
  if (state.selected != null) {
    const move = g.legalMoves.find((m) => m.from === state.selected && m.to === sq);
    if (move) { sendMove(move.notation); return; }
  }

  // otherwise (re)select an own piece
  const cell = g.board[sq];
  if (cell?.piece && cell.piece.side === g.playerSide) {
    state.selected = state.selected === sq ? null : sq;
    renderBoard(g);
  } else {
    state.selected = null;
    renderBoard(g);
  }
}

// ============================================================
// Init
// ============================================================
function init() {
  cache();
  el.localeSelect.value = state.locale;
  el.sideSelect.value = state.side;
  el.levelSelect.value = state.level;

  el.board.addEventListener("click", onBoardClick);
  el.newButton.addEventListener("click", newGame);
  el.undoButton.addEventListener("click", undo);
  el.hintButton.addEventListener("click", requestHint);
  el.bestButton.addEventListener("click", requestBest);
  el.moveList.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".ply[data-ply]");
    if (btn) jumpToPly(Number(btn.dataset.ply));
  });
  el.localeSelect.addEventListener("change", () => { state.locale = el.localeSelect.value; render(); });
  el.sideSelect.addEventListener("change", () => { state.side = el.sideSelect.value; newGame(); });
  el.levelSelect.addEventListener("change", () => { state.level = el.levelSelect.value; newGame(); });

  if (typeof window !== "undefined") window.__xq = { state, review }; // dev inspection
  el.reviewButton.addEventListener("click", toggleReview);
  el.rwClose.addEventListener("click", toggleReview);
  el.rwCollapse.addEventListener("click", () => { review.expanded.clear(); review.branches.clear(); renderReviewTree(); });
  el.rwZoomIn.addEventListener("click", () => setReviewScale(review.view.scale * 1.2));
  el.rwZoomOut.addEventListener("click", () => setReviewScale(review.view.scale / 1.2));
  el.rwFit.addEventListener("click", fitReviewTree);
  setupReviewWindowControls();

  newGame();
}

init();
