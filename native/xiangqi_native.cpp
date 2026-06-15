#include <algorithm>
#include <array>
#include <chrono>
#include <cctype>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <limits>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

namespace {

constexpr int kFiles = 9;
constexpr int kRanks = 10;
constexpr int kSquares = kFiles * kRanks;
constexpr int kRed = 1;
constexpr int kBlack = -1;
constexpr int kInf = 1000000;
constexpr int kMate = 100000;
constexpr int kMaxPly = 128;
constexpr int kHistoryMax = 200000;

enum PieceType {
  Empty = 0,
  King = 1,
  Advisor = 2,
  Elephant = 3,
  Horse = 4,
  Rook = 5,
  Cannon = 6,
  Pawn = 7
};

struct Move {
  int from = -1;
  int to = -1;
  int piece = 0;
  int captured = 0;
};

struct Board {
  std::array<int, kSquares> cells{};
  int side = kRed;
  uint64_t key = 0;
};

struct RootLine {
  Move move;
  int score = -kInf;
  std::vector<Move> pv;
};

class TranspositionTable;

struct SearchState {
  std::chrono::steady_clock::time_point started;
  std::chrono::steady_clock::time_point deadline;
  bool hasDeadline = false;
  bool stopped = false;
  int64_t nodes = 0;
  int completedDepth = 0;
  int64_t ttProbes = 0;
  int64_t ttHits = 0;
  int64_t ttCutoffs = 0;
  int64_t killerHits = 0;
  int64_t historyUpdates = 0;
  int ttHashfull = 0;
  TranspositionTable* tt = nullptr;
  std::array<std::array<Move, 2>, kMaxPly> killers{};
  std::array<std::array<int, kSquares>, kSquares> quietHistory{};
  std::array<std::array<int, kSquares>, kSquares> captureHistory{};
};

struct TtEntry {
  uint64_t key = 0;
  int depth = -1;
  int score = 0;
  int flag = 0;
  Move bestMove;
  int generation = 0;
  bool occupied = false;
};

constexpr int kTtExact = 1;
constexpr int kTtLower = 2;
constexpr int kTtUpper = 3;

class TranspositionTable {
 public:
  explicit TranspositionTable(int megabytes = 32) {
    resize(megabytes);
  }

  void resize(int megabytes) {
    const std::size_t bytes = static_cast<std::size_t>(std::max(1, megabytes)) * 1024ULL * 1024ULL;
    const std::size_t entries = std::max<std::size_t>(1024, bytes / sizeof(TtEntry));
    table_.assign(entries, {});
    generation_ = 1;
  }

  void clear() {
    std::fill(table_.begin(), table_.end(), TtEntry{});
    generation_ = 1;
  }

  void newSearch() {
    generation_ += 1;
    if (generation_ > 1000000) {
      generation_ = 1;
      for (TtEntry& entry : table_) entry.generation = 0;
    }
  }

  const TtEntry* probe(uint64_t key) const {
    if (table_.empty()) return nullptr;
    const TtEntry& entry = table_[index(key)];
    return entry.occupied && entry.key == key ? &entry : nullptr;
  }

  void store(uint64_t key, int depth, int score, int flag, const Move& bestMove) {
    if (table_.empty()) return;
    TtEntry& entry = table_[index(key)];
    if (entry.occupied && entry.key != key && entry.depth > depth && entry.generation == generation_) return;
    if (entry.occupied && entry.key == key && entry.depth > depth && entry.flag == kTtExact) return;
    entry = {key, depth, score, flag, bestMove, generation_, true};
  }

  int hashfull() const {
    if (table_.empty()) return 0;
    const std::size_t sample = std::min<std::size_t>(1000, table_.size());
    int used = 0;
    for (std::size_t index = 0; index < sample; index += 1) {
      if (table_[index].occupied && table_[index].generation == generation_) used += 1;
    }
    return static_cast<int>(used * 1000 / sample);
  }

 private:
  std::size_t index(uint64_t key) const {
    return static_cast<std::size_t>(key % table_.size());
  }

  std::vector<TtEntry> table_;
  int generation_ = 1;
};

int indexOf(int file, int rank) {
  return rank * kFiles + file;
}

int fileOf(int square) {
  return square % kFiles;
}

int rankOf(int square) {
  return square / kFiles;
}

bool inside(int file, int rank) {
  return file >= 0 && file < kFiles && rank >= 0 && rank < kRanks;
}

int sideOf(int piece) {
  if (piece > 0) return kRed;
  if (piece < 0) return kBlack;
  return 0;
}

int typeOf(int piece) {
  return std::abs(piece);
}

bool palaceContains(int side, int file, int rank) {
  if (file < 3 || file > 5) return false;
  return side == kRed ? (rank >= 7 && rank <= 9) : (rank >= 0 && rank <= 2);
}

bool ownRiverSide(int side, int rank) {
  return side == kRed ? rank >= 5 : rank <= 4;
}

bool crossedRiver(int side, int rank) {
  return side == kRed ? rank <= 4 : rank >= 5;
}

int forwardDelta(int side) {
  return side == kRed ? -1 : 1;
}

std::vector<std::string> split(const std::string& text) {
  std::istringstream in(text);
  std::vector<std::string> tokens;
  std::string token;
  while (in >> token) tokens.push_back(token);
  return tokens;
}

std::string lower(std::string text) {
  for (char& c : text) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  return text;
}

uint64_t splitmix64(uint64_t value) {
  value += 0x9e3779b97f4a7c15ULL;
  value = (value ^ (value >> 30)) * 0xbf58476d1ce4e5b9ULL;
  value = (value ^ (value >> 27)) * 0x94d049bb133111ebULL;
  return value ^ (value >> 31);
}

int pieceValue(int pieceOrType) {
  switch (std::abs(pieceOrType)) {
    case King: return 20000;
    case Rook: return 1000;
    case Cannon: return 500;
    case Horse: return 450;
    case Advisor: return 125;
    case Elephant: return 125;
    case Pawn: return 100;
    default: return 0;
  }
}

int fenPiece(char c) {
  const bool red = std::isupper(static_cast<unsigned char>(c));
  const char p = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  int type = Empty;
  if (p == 'k') type = King;
  if (p == 'a') type = Advisor;
  if (p == 'b' || p == 'e') type = Elephant;
  if (p == 'n' || p == 'h') type = Horse;
  if (p == 'r') type = Rook;
  if (p == 'c') type = Cannon;
  if (p == 'p') type = Pawn;
  return red ? type : -type;
}

int pieceSlot(int piece) {
  if (piece == 0) return 0;
  return piece > 0 ? typeOf(piece) : typeOf(piece) + 7;
}

uint64_t pieceHash(int square, int piece) {
  const uint64_t seed = 0x6a09e667f3bcc909ULL;
  return splitmix64(seed ^ (static_cast<uint64_t>(square + 1) * 0x100000001b3ULL) ^ static_cast<uint64_t>(pieceSlot(piece) * 0x9e3779b1U));
}

uint64_t sideHash() {
  return splitmix64(0xbb67ae8584caa73bULL);
}

uint64_t computeKey(const Board& board) {
  uint64_t key = 0;
  for (int square = 0; square < kSquares; square += 1) {
    const int piece = board.cells[square];
    if (piece != 0) key ^= pieceHash(square, piece);
  }
  if (board.side == kBlack) key ^= sideHash();
  return key;
}

bool parseFen(Board& board, const std::string& fenText) {
  const auto tokens = split(fenText);
  if (tokens.empty()) return false;
  board.cells.fill(0);

  const std::string& rowsText = tokens[0];
  int rank = 0;
  int file = 0;
  for (char c : rowsText) {
    if (c == '/') {
      if (file != kFiles) return false;
      file = 0;
      rank += 1;
      continue;
    }
    if (std::isdigit(static_cast<unsigned char>(c))) {
      file += c - '0';
      if (file > kFiles) return false;
      continue;
    }
    if (!inside(file, rank)) return false;
    const int piece = fenPiece(c);
    if (piece == 0) return false;
    board.cells[indexOf(file, rank)] = piece;
    file += 1;
  }

  if (rank != kRanks - 1 || file != kFiles) return false;
  const std::string side = tokens.size() > 1 ? lower(tokens[1]) : "w";
  board.side = (side == "b" || side == "black") ? kBlack : kRed;
  board.key = computeKey(board);
  return true;
}

std::string initialFen() {
  return "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w";
}

std::string moveToUci(const Move& move) {
  if (move.from < 0 || move.to < 0) return "0000";
  std::string text;
  text.push_back(static_cast<char>('a' + fileOf(move.from)));
  text.push_back(static_cast<char>('0' + (9 - rankOf(move.from))));
  text.push_back(static_cast<char>('a' + fileOf(move.to)));
  text.push_back(static_cast<char>('0' + (9 - rankOf(move.to))));
  return text;
}

Move parseUciMove(const std::string& text) {
  if (text.size() < 4) return {};
  const int fromFile = std::tolower(static_cast<unsigned char>(text[0])) - 'a';
  const int fromRank = 9 - (text[1] - '0');
  const int toFile = std::tolower(static_cast<unsigned char>(text[2])) - 'a';
  const int toRank = 9 - (text[3] - '0');
  if (!inside(fromFile, fromRank) || !inside(toFile, toRank)) return {};
  return {indexOf(fromFile, fromRank), indexOf(toFile, toRank), 0, 0};
}

void addMove(const Board& board, std::vector<Move>& moves, int from, int to, int piece, bool capturesOnly) {
  const int captured = board.cells[to];
  if (captured != 0 && sideOf(captured) == sideOf(piece)) return;
  if (capturesOnly && captured == 0) return;
  moves.push_back({from, to, piece, captured});
}

void addKingMoves(const Board& board, std::vector<Move>& moves, int from, int piece, bool capturesOnly) {
  static constexpr int dirs[4][2] = {{0, -1}, {1, 0}, {0, 1}, {-1, 0}};
  const int file = fileOf(from);
  const int rank = rankOf(from);
  for (const auto& dir : dirs) {
    const int tf = file + dir[0];
    const int tr = rank + dir[1];
    if (palaceContains(sideOf(piece), tf, tr)) {
      addMove(board, moves, from, indexOf(tf, tr), piece, capturesOnly);
    }
  }
}

void addAdvisorMoves(const Board& board, std::vector<Move>& moves, int from, int piece, bool capturesOnly) {
  static constexpr int dirs[4][2] = {{1, 1}, {1, -1}, {-1, 1}, {-1, -1}};
  const int file = fileOf(from);
  const int rank = rankOf(from);
  for (const auto& dir : dirs) {
    const int tf = file + dir[0];
    const int tr = rank + dir[1];
    if (palaceContains(sideOf(piece), tf, tr)) {
      addMove(board, moves, from, indexOf(tf, tr), piece, capturesOnly);
    }
  }
}

void addElephantMoves(const Board& board, std::vector<Move>& moves, int from, int piece, bool capturesOnly) {
  static constexpr int dirs[4][2] = {{1, 1}, {1, -1}, {-1, 1}, {-1, -1}};
  const int file = fileOf(from);
  const int rank = rankOf(from);
  for (const auto& dir : dirs) {
    const int tf = file + dir[0] * 2;
    const int tr = rank + dir[1] * 2;
    const int eye = indexOf(file + dir[0], rank + dir[1]);
    if (!inside(tf, tr)) continue;
    if (!ownRiverSide(sideOf(piece), tr)) continue;
    if (board.cells[eye] != 0) continue;
    addMove(board, moves, from, indexOf(tf, tr), piece, capturesOnly);
  }
}

void addHorseMoves(const Board& board, std::vector<Move>& moves, int from, int piece, bool capturesOnly) {
  static constexpr int deltas[8][2] = {{1, 2}, {2, 1}, {2, -1}, {1, -2}, {-1, -2}, {-2, -1}, {-2, 1}, {-1, 2}};
  const int file = fileOf(from);
  const int rank = rankOf(from);
  for (const auto& delta : deltas) {
    const int tf = file + delta[0];
    const int tr = rank + delta[1];
    if (!inside(tf, tr)) continue;
    const int legFile = std::abs(delta[0]) == 2 ? file + (delta[0] > 0 ? 1 : -1) : file;
    const int legRank = std::abs(delta[1]) == 2 ? rank + (delta[1] > 0 ? 1 : -1) : rank;
    if (board.cells[indexOf(legFile, legRank)] != 0) continue;
    addMove(board, moves, from, indexOf(tf, tr), piece, capturesOnly);
  }
}

void addSlidingMoves(const Board& board, std::vector<Move>& moves, int from, int piece, bool cannon, bool capturesOnly) {
  static constexpr int dirs[4][2] = {{0, -1}, {1, 0}, {0, 1}, {-1, 0}};
  const int file = fileOf(from);
  const int rank = rankOf(from);
  for (const auto& dir : dirs) {
    int tf = file + dir[0];
    int tr = rank + dir[1];
    bool screen = false;
    while (inside(tf, tr)) {
      const int to = indexOf(tf, tr);
      const int occupant = board.cells[to];
      if (!cannon) {
        if (occupant == 0) {
          if (!capturesOnly) addMove(board, moves, from, to, piece, capturesOnly);
        } else {
          addMove(board, moves, from, to, piece, capturesOnly);
          break;
        }
      } else if (!screen) {
        if (occupant == 0) {
          if (!capturesOnly) addMove(board, moves, from, to, piece, capturesOnly);
        } else {
          screen = true;
        }
      } else if (occupant != 0) {
        addMove(board, moves, from, to, piece, capturesOnly);
        break;
      }
      tf += dir[0];
      tr += dir[1];
    }
  }
}

void addPawnMoves(const Board& board, std::vector<Move>& moves, int from, int piece, bool capturesOnly) {
  const int file = fileOf(from);
  const int rank = rankOf(from);
  const int side = sideOf(piece);
  std::vector<std::pair<int, int>> dirs = {{0, forwardDelta(side)}};
  if (crossedRiver(side, rank)) {
    dirs.push_back({-1, 0});
    dirs.push_back({1, 0});
  }
  for (const auto& dir : dirs) {
    const int tf = file + dir.first;
    const int tr = rank + dir.second;
    if (!inside(tf, tr)) continue;
    addMove(board, moves, from, indexOf(tf, tr), piece, capturesOnly);
  }
}

std::vector<Move> generatePseudoMoves(const Board& board, int side, bool capturesOnly = false) {
  std::vector<Move> moves;
  moves.reserve(96);
  for (int square = 0; square < kSquares; square += 1) {
    const int piece = board.cells[square];
    if (piece == 0 || sideOf(piece) != side) continue;
    switch (typeOf(piece)) {
      case King: addKingMoves(board, moves, square, piece, capturesOnly); break;
      case Advisor: addAdvisorMoves(board, moves, square, piece, capturesOnly); break;
      case Elephant: addElephantMoves(board, moves, square, piece, capturesOnly); break;
      case Horse: addHorseMoves(board, moves, square, piece, capturesOnly); break;
      case Rook: addSlidingMoves(board, moves, square, piece, false, capturesOnly); break;
      case Cannon: addSlidingMoves(board, moves, square, piece, true, capturesOnly); break;
      case Pawn: addPawnMoves(board, moves, square, piece, capturesOnly); break;
      default: break;
    }
  }
  return moves;
}

int findKing(const Board& board, int side) {
  for (int square = 0; square < kSquares; square += 1) {
    if (board.cells[square] == side * King) return square;
  }
  return -1;
}

bool generalsFace(const Board& board) {
  const int redKing = findKing(board, kRed);
  const int blackKing = findKing(board, kBlack);
  if (redKing < 0 || blackKing < 0) return false;
  if (fileOf(redKing) != fileOf(blackKing)) return false;
  const int file = fileOf(redKing);
  const int start = std::min(rankOf(redKing), rankOf(blackKing)) + 1;
  const int end = std::max(rankOf(redKing), rankOf(blackKing));
  for (int rank = start; rank < end; rank += 1) {
    if (board.cells[indexOf(file, rank)] != 0) return false;
  }
  return true;
}

void makeMove(Board& board, Move& move) {
  move.piece = board.cells[move.from];
  move.captured = board.cells[move.to];
  board.key ^= sideHash();
  board.key ^= pieceHash(move.from, move.piece);
  if (move.captured != 0) board.key ^= pieceHash(move.to, move.captured);
  board.key ^= pieceHash(move.to, move.piece);
  board.cells[move.to] = move.piece;
  board.cells[move.from] = 0;
  board.side = -board.side;
}

void undoMove(Board& board, const Move& move) {
  board.side = -board.side;
  board.key ^= sideHash();
  board.key ^= pieceHash(move.to, move.piece);
  if (move.captured != 0) board.key ^= pieceHash(move.to, move.captured);
  board.key ^= pieceHash(move.from, move.piece);
  board.cells[move.from] = move.piece;
  board.cells[move.to] = move.captured;
}

bool isInCheck(const Board& board, int side) {
  const int king = findKing(board, side);
  if (king < 0) return true;
  if (generalsFace(board)) return true;
  const auto replies = generatePseudoMoves(board, -side, true);
  return std::any_of(replies.begin(), replies.end(), [king](const Move& move) {
    return move.to == king;
  });
}

std::vector<Move> generateLegalMoves(Board& board, int side, bool capturesOnly = false) {
  std::vector<Move> legal;
  auto moves = generatePseudoMoves(board, side, capturesOnly);
  legal.reserve(moves.size());
  for (Move move : moves) {
    makeMove(board, move);
    const bool illegal = isInCheck(board, side);
    undoMove(board, move);
    if (!illegal) legal.push_back(move);
  }
  return legal;
}

bool sameMove(const Move& left, const Move& right) {
  return left.from == right.from && left.to == right.to;
}

bool validMove(const Move& move) {
  return move.from >= 0 && move.to >= 0;
}

bool isCapture(const Move& move) {
  return move.captured != 0;
}

bool isQuiet(const Move& move) {
  return move.captured == 0;
}

bool isKillerMove(const SearchState& state, int ply, const Move& move) {
  if (ply < 0 || ply >= kMaxPly || !isQuiet(move)) return false;
  return sameMove(state.killers[ply][0], move) || sameMove(state.killers[ply][1], move);
}

void addHistoryScore(std::array<std::array<int, kSquares>, kSquares>& table, const Move& move, int bonus) {
  int& value = table[move.from][move.to];
  value += bonus - value * std::abs(bonus) / kHistoryMax;
  value = std::clamp(value, -kHistoryMax, kHistoryMax);
}

void rememberKiller(SearchState& state, int ply, const Move& move) {
  if (ply < 0 || ply >= kMaxPly || !isQuiet(move)) return;
  if (sameMove(state.killers[ply][0], move)) return;
  state.killers[ply][1] = state.killers[ply][0];
  state.killers[ply][0] = move;
}

void rememberBetaCutoff(SearchState& state, int ply, int depth, const Move& bestMove, const std::vector<Move>& quiets, const std::vector<Move>& captures) {
  const int bonus = std::clamp(depth * depth * 32, 32, 4096);
  if (isQuiet(bestMove)) {
    rememberKiller(state, ply, bestMove);
    addHistoryScore(state.quietHistory, bestMove, bonus);
    for (const Move& move : quiets) {
      if (!sameMove(move, bestMove)) addHistoryScore(state.quietHistory, move, -bonus / 2);
    }
  } else if (isCapture(bestMove)) {
    addHistoryScore(state.captureHistory, bestMove, bonus);
  }
  for (const Move& move : captures) {
    if (!sameMove(move, bestMove)) addHistoryScore(state.captureHistory, move, -bonus / 2);
  }
  state.historyUpdates += 1;
}

int squareAdvanceBonus(int side, int rank) {
  return side == kRed ? (9 - rank) * 5 : rank * 5;
}

int horseMobilityBonus(const Board& board, int square, int piece) {
  static constexpr int deltas[8][2] = {{1, 2}, {2, 1}, {2, -1}, {1, -2}, {-1, -2}, {-2, -1}, {-2, 1}, {-1, 2}};
  const int file = fileOf(square);
  const int rank = rankOf(square);
  int bonus = 0;
  for (const auto& delta : deltas) {
    const int tf = file + delta[0];
    const int tr = rank + delta[1];
    if (!inside(tf, tr)) continue;
    const int legFile = std::abs(delta[0]) == 2 ? file + (delta[0] > 0 ? 1 : -1) : file;
    const int legRank = std::abs(delta[1]) == 2 ? rank + (delta[1] > 0 ? 1 : -1) : rank;
    if (board.cells[indexOf(legFile, legRank)] != 0) continue;
    const int target = board.cells[indexOf(tf, tr)];
    if (target != 0 && sideOf(target) == sideOf(piece)) continue;
    bonus += 9;
    if (target != 0) bonus += std::min(60, pieceValue(target) / 16);
  }
  return bonus;
}

int rookActivityBonus(const Board& board, int square, int piece) {
  static constexpr int dirs[4][2] = {{0, -1}, {1, 0}, {0, 1}, {-1, 0}};
  const int file = fileOf(square);
  const int rank = rankOf(square);
  int bonus = 0;
  for (const auto& dir : dirs) {
    int tf = file + dir[0];
    int tr = rank + dir[1];
    while (inside(tf, tr)) {
      const int target = board.cells[indexOf(tf, tr)];
      if (target == 0) {
        bonus += 4;
      } else {
        if (sideOf(target) != sideOf(piece)) bonus += std::min(90, pieceValue(target) / 14);
        break;
      }
      tf += dir[0];
      tr += dir[1];
    }
  }
  return bonus;
}

int cannonActivityBonus(const Board& board, int square, int piece) {
  static constexpr int dirs[4][2] = {{0, -1}, {1, 0}, {0, 1}, {-1, 0}};
  const int file = fileOf(square);
  const int rank = rankOf(square);
  int bonus = 0;
  for (const auto& dir : dirs) {
    int tf = file + dir[0];
    int tr = rank + dir[1];
    bool screen = false;
    while (inside(tf, tr)) {
      const int target = board.cells[indexOf(tf, tr)];
      if (!screen) {
        if (target == 0) {
          bonus += 2;
        } else {
          screen = true;
        }
      } else if (target != 0) {
        if (sideOf(target) != sideOf(piece)) {
          bonus += typeOf(target) == King ? 160 : std::min(100, pieceValue(target) / 10);
        }
        break;
      }
      tf += dir[0];
      tr += dir[1];
    }
  }
  return bonus;
}

int evaluateRed(const Board& board) {
  const int redKing = findKing(board, kRed);
  const int blackKing = findKing(board, kBlack);
  if (redKing < 0) return -kMate;
  if (blackKing < 0) return kMate;

  int score = 0;
  int redAdvisors = 0;
  int redElephants = 0;
  int blackAdvisors = 0;
  int blackElephants = 0;

  for (int square = 0; square < kSquares; square += 1) {
    const int piece = board.cells[square];
    if (piece == 0) continue;
    const int side = sideOf(piece);
    const int sign = side == kRed ? 1 : -1;
    const int type = typeOf(piece);
    const int file = fileOf(square);
    const int rank = rankOf(square);
    int value = pieceValue(type);

    if (type == Pawn) {
      value += squareAdvanceBonus(side, rank);
      if (crossedRiver(side, rank)) value += 55;
      value += (4 - std::abs(file - 4)) * 4;
      if (palaceContains(-side, file, rank)) value += 35;
    } else if (type == Horse) {
      value += (4 - std::abs(file - 4)) * 8;
      if (crossedRiver(side, rank)) value += 25;
      value += horseMobilityBonus(board, square, piece);
    } else if (type == Rook) {
      value += crossedRiver(side, rank) ? 25 : 0;
      value += (4 - std::abs(file - 4)) * 3;
      value += rookActivityBonus(board, square, piece);
    } else if (type == Cannon) {
      value += (4 - std::abs(file - 4)) * 5;
      if (crossedRiver(side, rank)) value += 15;
      value += cannonActivityBonus(board, square, piece);
    } else if (type == Advisor) {
      if (side == kRed) redAdvisors += 1;
      else blackAdvisors += 1;
    } else if (type == Elephant) {
      if (side == kRed) redElephants += 1;
      else blackElephants += 1;
    }

    score += sign * value;
  }

  if (redAdvisors >= 2) score += 25;
  if (redElephants >= 2) score += 25;
  if (blackAdvisors >= 2) score -= 25;
  if (blackElephants >= 2) score -= 25;
  return score;
}

int moveOrderingScore(const Move& move, const SearchState& state, int ply, const Move& hashMove = {}) {
  if (validMove(hashMove) && sameMove(move, hashMove)) return 10000000;
  int score = 0;
  if (move.captured != 0) {
    score += 100000 + pieceValue(move.captured) * 16 - pieceValue(move.piece);
    score += state.captureHistory[move.from][move.to];
  } else {
    if (isKillerMove(state, ply, move)) score += 90000;
    score += state.quietHistory[move.from][move.to];
  }
  const int toFile = fileOf(move.to);
  score += (4 - std::abs(toFile - 4)) * 4;
  if (typeOf(move.piece) == Pawn && crossedRiver(sideOf(move.piece), rankOf(move.to))) score += 50;
  return score;
}

void orderMoves(std::vector<Move>& moves, const SearchState& state, int ply, const Move& hashMove = {}) {
  std::stable_sort(moves.begin(), moves.end(), [&state, ply, hashMove](const Move& left, const Move& right) {
    return moveOrderingScore(left, state, ply, hashMove) > moveOrderingScore(right, state, ply, hashMove);
  });
}

bool timeExpired(SearchState& state) {
  if (!state.hasDeadline) return false;
  if ((state.nodes & 2047) != 0) return false;
  if (std::chrono::steady_clock::now() >= state.deadline) {
    state.stopped = true;
    return true;
  }
  return false;
}

int quiescence(Board& board, int alpha, int beta, int ply, int qDepth, SearchState& state);

int negamax(Board& board, int depth, int alpha, int beta, int ply, SearchState& state, std::vector<Move>& pv) {
  if (state.stopped || timeExpired(state)) return evaluateRed(board) * board.side;
  state.nodes += 1;

  const bool inCheck = isInCheck(board, board.side);
  if (depth <= 0) return quiescence(board, alpha, beta, ply, inCheck ? 2 : 4, state);

  const int alphaOriginal = alpha;
  const int betaOriginal = beta;
  Move hashMove;
  if (state.tt) {
    state.ttProbes += 1;
    if (const TtEntry* entry = state.tt->probe(board.key)) {
      state.ttHits += 1;
      hashMove = entry->bestMove;
      if (entry->depth >= depth) {
        if (entry->flag == kTtExact) {
          if (validMove(entry->bestMove)) pv = {entry->bestMove};
          return entry->score;
        }
        if (entry->flag == kTtLower) {
          if (entry->score >= beta) {
            state.ttCutoffs += 1;
            if (validMove(entry->bestMove)) pv = {entry->bestMove};
            return entry->score;
          }
          alpha = std::max(alpha, entry->score);
        } else if (entry->flag == kTtUpper) {
          if (entry->score <= alpha) {
            state.ttCutoffs += 1;
            if (validMove(entry->bestMove)) pv = {entry->bestMove};
            return entry->score;
          }
          beta = std::min(beta, entry->score);
        }
        if (alpha >= beta) {
          state.ttCutoffs += 1;
          if (validMove(entry->bestMove)) pv = {entry->bestMove};
          return entry->score;
        }
      }
    }
  }

  auto moves = generateLegalMoves(board, board.side);
  if (moves.empty()) return -kMate + ply;
  orderMoves(moves, state, ply, hashMove);

  int bestScore = -kInf;
  Move bestMove;
  std::vector<Move> bestLine;
  std::vector<Move> searchedQuiets;
  std::vector<Move> searchedCaptures;
  int moveIndex = 0;

  for (Move move : moves) {
    const bool killerCandidate = isKillerMove(state, ply, move);
    makeMove(board, move);
    std::vector<Move> childPv;
    int score;
    if (moveIndex == 0) {
      score = -negamax(board, depth - 1, -beta, -alpha, ply + 1, state, childPv);
    } else {
      score = -negamax(board, depth - 1, -alpha - 1, -alpha, ply + 1, state, childPv);
      if (score > alpha && score < beta && !state.stopped) {
        childPv.clear();
        score = -negamax(board, depth - 1, -beta, -alpha, ply + 1, state, childPv);
      }
    }
    undoMove(board, move);
    if (state.stopped) break;
    moveIndex += 1;
    if (killerCandidate) state.killerHits += 1;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
      bestLine = childPv;
    }
    if (score > alpha) {
      alpha = score;
      pv.clear();
      pv.push_back(move);
      pv.insert(pv.end(), childPv.begin(), childPv.end());
    }
    if (alpha >= beta) {
      rememberBetaCutoff(state, ply, depth, move, searchedQuiets, searchedCaptures);
      break;
    }
    if (isQuiet(move)) searchedQuiets.push_back(move);
    else if (isCapture(move)) searchedCaptures.push_back(move);
  }

  if (!state.stopped && state.tt && validMove(bestMove)) {
    const int flag = bestScore <= alphaOriginal ? kTtUpper : bestScore >= betaOriginal ? kTtLower : kTtExact;
    state.tt->store(board.key, depth, bestScore, flag, bestMove);
  }

  if (pv.empty() && bestMove.from >= 0) {
    pv.push_back(bestMove);
    pv.insert(pv.end(), bestLine.begin(), bestLine.end());
  }
  return bestScore;
}

int quiescence(Board& board, int alpha, int beta, int ply, int qDepth, SearchState& state) {
  if (state.stopped || timeExpired(state)) return evaluateRed(board) * board.side;
  state.nodes += 1;

  const bool inCheck = isInCheck(board, board.side);
  const int standPat = evaluateRed(board) * board.side;
  if (!inCheck) {
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
  }
  if (qDepth <= 0) return alpha;

  auto moves = generateLegalMoves(board, board.side, !inCheck);
  if (moves.empty()) return inCheck ? -kMate + ply : alpha;
  orderMoves(moves, state, ply);

  for (Move move : moves) {
    if (!inCheck && move.captured != 0 && standPat + pieceValue(move.captured) + 120 <= alpha) continue;
    makeMove(board, move);
    const int score = -quiescence(board, -beta, -alpha, ply + 1, qDepth - 1, state);
    undoMove(board, move);
    if (state.stopped) break;
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

std::vector<Move> filterRootMoves(const std::vector<Move>& legal, const std::vector<Move>& requested) {
  if (requested.empty()) return legal;
  std::vector<Move> filtered;
  for (const Move& legalMove : legal) {
    if (std::any_of(requested.begin(), requested.end(), [&legalMove](const Move& requestedMove) {
      return sameMove(legalMove, requestedMove);
    })) {
      filtered.push_back(legalMove);
    }
  }
  return filtered;
}

std::vector<RootLine> searchRoot(Board root, int maxDepth, int moveTimeMs, int multiPv, const std::vector<Move>& searchMoves, TranspositionTable& tt, SearchState& state) {
  state.started = std::chrono::steady_clock::now();
  state.hasDeadline = moveTimeMs > 0;
  state.deadline = state.started + std::chrono::milliseconds(std::max(1, moveTimeMs));
  state.tt = &tt;
  tt.newSearch();

  auto rootMoves = filterRootMoves(generateLegalMoves(root, root.side), searchMoves);
  orderMoves(rootMoves, state, 0);
  std::vector<RootLine> bestLines;
  for (const Move& move : rootMoves) bestLines.push_back({move, evaluateRed(root) * root.side, {move}});
  if (rootMoves.empty()) return bestLines;

  for (int depth = 1; depth <= maxDepth; depth += 1) {
    std::vector<RootLine> depthLines;
    depthLines.reserve(rootMoves.size());
    for (Move move : rootMoves) {
      Board board = root;
      makeMove(board, move);
      std::vector<Move> childPv;
      const int score = -negamax(board, depth - 1, -kInf, kInf, 1, state, childPv);
      if (state.stopped) break;
      std::vector<Move> pv;
      pv.push_back(move);
      pv.insert(pv.end(), childPv.begin(), childPv.end());
      depthLines.push_back({move, score, pv});
    }
    if (state.stopped || depthLines.empty()) break;
    std::stable_sort(depthLines.begin(), depthLines.end(), [](const RootLine& left, const RootLine& right) {
      return left.score > right.score;
    });
    bestLines = depthLines;
    rootMoves.clear();
    for (const RootLine& line : depthLines) rootMoves.push_back(line.move);
    state.completedDepth = depth;
  }

  const int limit = std::max(1, std::min<int>(multiPv, bestLines.size()));
  bestLines.resize(limit);
  state.ttHashfull = tt.hashfull();
  return bestLines;
}

std::string formatPv(const std::vector<Move>& pv) {
  std::string text;
  for (const Move& move : pv) {
    if (!text.empty()) text += " ";
    text += moveToUci(move);
  }
  return text;
}

int elapsedMs(const SearchState& state) {
  const auto elapsed = std::chrono::steady_clock::now() - state.started;
  return static_cast<int>(std::chrono::duration_cast<std::chrono::milliseconds>(elapsed).count());
}

void applyMoveIfLegal(Board& board, const Move& requested) {
  auto legal = generateLegalMoves(board, board.side);
  for (Move move : legal) {
    if (!sameMove(move, requested)) continue;
    makeMove(board, move);
    return;
  }
}

void handlePosition(Board& board, const std::string& line) {
  const auto tokens = split(line);
  if (tokens.size() >= 2 && tokens[1] == "startpos") {
    parseFen(board, initialFen());
    auto movesIt = std::find(tokens.begin(), tokens.end(), "moves");
    if (movesIt != tokens.end()) {
      for (++movesIt; movesIt != tokens.end(); ++movesIt) applyMoveIfLegal(board, parseUciMove(*movesIt));
    }
    return;
  }

  auto fenIt = std::find(tokens.begin(), tokens.end(), "fen");
  if (fenIt == tokens.end()) return;
  auto movesIt = std::find(tokens.begin(), tokens.end(), "moves");
  std::string fen;
  for (auto it = fenIt + 1; it != tokens.end() && it != movesIt; ++it) {
    if (!fen.empty()) fen += " ";
    fen += *it;
  }
  parseFen(board, fen);
  if (movesIt != tokens.end()) {
    for (++movesIt; movesIt != tokens.end(); ++movesIt) applyMoveIfLegal(board, parseUciMove(*movesIt));
  }
}

struct GoOptions {
  int depth = 4;
  int moveTimeMs = 1000;
  std::vector<Move> searchMoves;
};

GoOptions parseGo(const std::string& line) {
  GoOptions options;
  const auto tokens = split(line);
  for (std::size_t i = 1; i < tokens.size(); i += 1) {
    const std::string token = lower(tokens[i]);
    if (token == "depth" && i + 1 < tokens.size()) {
      options.depth = std::max(1, std::stoi(tokens[++i]));
    } else if (token == "movetime" && i + 1 < tokens.size()) {
      options.moveTimeMs = std::max(1, std::stoi(tokens[++i]));
    } else if (token == "wtime" || token == "btime") {
      if (i + 1 < tokens.size()) {
        const int clock = std::max(1, std::stoi(tokens[++i]));
        options.moveTimeMs = std::min(options.moveTimeMs, std::max(50, clock / 30));
      }
    } else if (token == "searchmoves") {
      for (std::size_t j = i + 1; j < tokens.size(); j += 1) {
        options.searchMoves.push_back(parseUciMove(tokens[j]));
      }
      break;
    }
  }
  return options;
}

void writeSearchResult(const std::vector<RootLine>& lines, const SearchState& state) {
  const int time = std::max(1, elapsedMs(state));
  const int nps = static_cast<int>(std::max<int64_t>(1, state.nodes * 1000 / time));
  const int depth = std::max(1, state.completedDepth);

  if (lines.empty()) {
    std::cout << "info depth " << depth << " score mate -1 nodes " << state.nodes << " time " << time << " nps " << nps
              << " hashfull " << state.ttHashfull
              << " string tt " << state.ttHits << "/" << state.ttProbes << " cutoffs " << state.ttCutoffs
              << " killers " << state.killerHits << " history " << state.historyUpdates
              << " pv\n";
    std::cout << "bestmove 0000" << std::endl;
    return;
  }

  for (std::size_t index = 0; index < lines.size(); index += 1) {
    const RootLine& line = lines[index];
    std::cout << "info multipv " << (index + 1)
              << " depth " << depth
              << " score cp " << line.score
              << " nodes " << state.nodes
              << " time " << time
              << " nps " << nps
              << " hashfull " << state.ttHashfull
              << " string tt " << state.ttHits << "/" << state.ttProbes << " cutoffs " << state.ttCutoffs
              << " killers " << state.killerHits << " history " << state.historyUpdates
              << " pv " << formatPv(line.pv)
              << std::endl;
  }
  std::cout << "bestmove " << moveToUci(lines.front().move) << std::endl;
}

int parseSpinOption(const std::string& line, const std::string& optionName, int fallback) {
  const auto tokens = split(line);
  int nameIndex = -1;
  int valueIndex = -1;
  for (std::size_t i = 0; i < tokens.size(); i += 1) {
    const std::string token = lower(tokens[i]);
    if (token == "name") nameIndex = static_cast<int>(i);
    if (token == "value") valueIndex = static_cast<int>(i);
  }
  if (nameIndex < 0 || valueIndex < 0 || valueIndex + 1 >= static_cast<int>(tokens.size())) return fallback;
  std::string name;
  for (int i = nameIndex + 1; i < valueIndex; i += 1) {
    if (!name.empty()) name += " ";
    name += lower(tokens[i]);
  }
  if (name != optionName) return fallback;
  return std::max(1, std::stoi(tokens[valueIndex + 1]));
}

}  // namespace

int main() {
  Board board;
  parseFen(board, initialFen());
  int multiPv = 1;
  int hashMb = 32;
  TranspositionTable tt(hashMb);

  std::string line;
  while (std::getline(std::cin, line)) {
    const std::string command = split(line).empty() ? "" : lower(split(line).front());
    if (command == "uci") {
      std::cout << "id name Xiangqi Native C++" << std::endl;
      std::cout << "id author juncoflockleader/codex" << std::endl;
      std::cout << "option name MultiPV type spin default 1 min 1 max 8" << std::endl;
      std::cout << "option name Hash type spin default 32 min 1 max 1024" << std::endl;
      std::cout << "uciok" << std::endl;
    } else if (command == "isready") {
      std::cout << "readyok" << std::endl;
    } else if (command == "ucinewgame") {
      parseFen(board, initialFen());
      tt.clear();
    } else if (command == "setoption") {
      multiPv = parseSpinOption(line, "multipv", multiPv);
      const int requestedHash = parseSpinOption(line, "hash", hashMb);
      if (requestedHash != hashMb) {
        hashMb = requestedHash;
        tt.resize(hashMb);
      }
    } else if (command == "position") {
      handlePosition(board, line);
    } else if (command == "go") {
      const GoOptions options = parseGo(line);
      SearchState state;
      auto lines = searchRoot(board, options.depth, options.moveTimeMs, multiPv, options.searchMoves, tt, state);
      writeSearchResult(lines, state);
    } else if (command == "quit") {
      break;
    } else if (command == "stop") {
      std::cout << "bestmove 0000" << std::endl;
    }
  }

  return 0;
}
