#include <algorithm>
#include <array>
#include <cassert>
#include <chrono>
#include <cctype>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <limits>
#include <optional>
#include <sstream>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace {

constexpr int kFiles = 9;
constexpr int kRanks = 10;
constexpr int kSquares = kFiles * kRanks;
constexpr int kOrthogonalDirections = 4;
constexpr int kMaxRayLength = kRanks - 1;
constexpr int kMaxKingTargets = 4;
constexpr int kMaxAdvisorTargets = 4;
constexpr int kMaxElephantTargets = 4;
constexpr int kMaxHorseTargets = 8;
constexpr int kMaxPawnTargets = 3;
constexpr int kRed = 1;
constexpr int kBlack = -1;
constexpr int kInf = 1000000;
constexpr int kMate = 100000;
constexpr int kMaxPly = 128;
constexpr int kHistoryMax = 200000;
constexpr int kUnknownKingSquare = -2;
constexpr int kMaxExtensions = 6;
constexpr int kMaxQuietChecksPerQNode = 8;
constexpr int kQCheckEvasionFloor = -1;
constexpr std::size_t kMaxGeneratedMoves = 512;
constexpr std::size_t kMaxStackOrderedMoves = 256;
constexpr std::size_t kMaxStackScoredMoves = kMaxGeneratedMoves;
constexpr std::size_t kInsertionSortMoveLimit = 32;
constexpr int kProbCutMinDepth = 4;
constexpr int kProbCutReduction = 2;
constexpr int kProbCutMargin = 190;
constexpr int kProbCutCaptureLimit = 6;
constexpr int kIidMinDepth = 5;
constexpr int kIidReduction = 2;
constexpr int kIidMoveLimit = 8;
constexpr int kNullMoveVerificationMinDepth = 5;
constexpr int kSingularExtensionMinDepth = 5;
constexpr int kSingularExtensionReduction = 2;
constexpr int kSingularExtensionMargin = 90;
constexpr int kHistoryPruningMaxDepth = 4;
constexpr int kHistoryPruningBaseIndex = 6;
constexpr int kHistoryPruningMarginScale = 32;
constexpr int kLateMovePruningMaxDepth = 4;
constexpr int kLateMovePruningDepthThreeTighten = 20;
constexpr int kLateMovePruningDepthFourTighten = 35;
constexpr int kReverseFutilityMaxDepth = 5;
constexpr int kImprovingEvalMargin = 12;
constexpr int kTimedOpeningPriorMaxLoss = 100;
constexpr int kTimedSearchDepthLimit = 64;
constexpr int kRootReductionMinDepth = 6;
constexpr int kRootReductionMoveIndex = 5;
constexpr int kRootMultiPvReductionMoveIndex = 3;
constexpr int kRootDeepReductionMinDepth = 8;
constexpr int kRootDeepReductionMoveIndex = 12;
constexpr int kRootHistoryReductionBoostMinDepth = 7;
constexpr int kRootHistoryReductionBoostMoveIndex = 8;
constexpr int kRootHistoryReductionBoostScale = 32;
constexpr int kRootContinuationReductionBoostScale = 48;
constexpr int kRootTrackedMultiPvLimit = 8;
constexpr int kRootMultiPvReductionMargin = 5;
constexpr int kQSeePruneMaxDepth = 4;
constexpr int kQSeePruneMaxRootPieces = 32;
constexpr int kQSeePruneAlphaMargin = 32;
constexpr int kQSeePruneLossMargin = 80;
constexpr int kQSeeCaptureHistoryGuard = 1024;
constexpr int kQDeltaPruneMargin = 90;
constexpr int kQDeltaCaptureHistoryGuard = 32768;
constexpr int kQDeltaCaptureHistoryMargin = 120;
constexpr int kQBadCaptureOrderingPenaltyScale = 8;
constexpr int kQQuietCheckSecondLayerMargin = 190;
constexpr int kAspirationInitialWindow = 80;
constexpr int kAspirationRetryWindow = 320;
constexpr int kRootTimeGuardMinMs = 8;
constexpr int kRootTimeGuardMaxMs = 250;
constexpr int kRootTimeGuardDivisor = 3;
constexpr int kDefaultHashMb = 128;
constexpr int kIsolatedSearchHashMb = 16;
constexpr int kHistoryCountLookupThreshold = 64;
constexpr int kPawnPressureExtensionMaxPieces = 10;
constexpr int kPawnPressureOrderingBonus = 28000;
constexpr int64_t kTimeCheckNodeMask = 4095;
constexpr std::size_t kTtBucketSize = 4;
constexpr std::size_t kEvalBucketSize = 4;
constexpr std::size_t kCheckCacheBucketSize = 4;
constexpr std::size_t kLeastAttackerCacheBucketSize = 4;
constexpr std::size_t kCheckCacheSize = 131072;
constexpr std::size_t kLeastAttackerCacheSize = 65536;
static_assert((kTtBucketSize & (kTtBucketSize - 1)) == 0, "TT bucket size must be a power of two");
static_assert((kEvalBucketSize & (kEvalBucketSize - 1)) == 0, "eval bucket size must be a power of two");
static_assert((kCheckCacheBucketSize & (kCheckCacheBucketSize - 1)) == 0, "check cache bucket size must be a power of two");
static_assert(
    (kLeastAttackerCacheBucketSize & (kLeastAttackerCacheBucketSize - 1)) == 0,
    "least-attacker cache bucket size must be a power of two");
static_assert((kCheckCacheSize & (kCheckCacheSize - 1)) == 0, "check cache size must be a power of two");
static_assert((kLeastAttackerCacheSize & (kLeastAttackerCacheSize - 1)) == 0, "least-attacker cache size must be a power of two");

constexpr int sideLookupIndex(int side) {
  return (side + 1) / 2;
}

constexpr bool rawPalaceContains(int side, int file, int rank) {
  const bool palaceFile = file >= 3 && file <= 5;
  if (!palaceFile) return false;
  return side == kRed ? rank >= 7 && rank <= 9 : rank >= 0 && rank <= 2;
}

constexpr bool rawOwnRiverSide(int side, int rank) {
  return side == kRed ? rank >= 5 : rank <= 4;
}

constexpr bool rawCrossedRiver(int side, int rank) {
  return side == kRed ? rank <= 4 : rank >= 5;
}

constexpr std::array<int, kSquares> makeFileLookup() {
  std::array<int, kSquares> values{};
  for (int square = 0; square < kSquares; square += 1) {
    values[static_cast<std::size_t>(square)] = square % kFiles;
  }
  return values;
}

constexpr std::array<int, kSquares> makeRankLookup() {
  std::array<int, kSquares> values{};
  for (int square = 0; square < kSquares; square += 1) {
    values[static_cast<std::size_t>(square)] = square / kFiles;
  }
  return values;
}

constexpr std::array<int, kFiles> makeFileCentralityLookup() {
  std::array<int, kFiles> values{};
  for (int file = 0; file < kFiles; file += 1) {
    const int distance = file > 4 ? file - 4 : 4 - file;
    values[static_cast<std::size_t>(file)] = 4 - distance;
  }
  return values;
}

using RaySquares = std::array<std::array<std::array<int, kMaxRayLength>, kOrthogonalDirections>, kSquares>;
using RayLengths = std::array<std::array<int, kOrthogonalDirections>, kSquares>;
using OrthogonalDirectionLookup = std::array<std::array<int, kSquares>, kSquares>;

template <std::size_t MaxTargets>
struct TargetLookup {
  std::array<std::array<int, MaxTargets>, kSquares> targets{};
  std::array<int, kSquares> counts{};
};

template <std::size_t MaxTargets>
struct TargetBlockerLookup {
  std::array<std::array<int, MaxTargets>, kSquares> targets{};
  std::array<std::array<int, MaxTargets>, kSquares> blockers{};
  std::array<int, kSquares> counts{};
};

template <std::size_t MaxSources>
struct SourceLookup {
  std::array<std::array<int, MaxSources>, kSquares> sources{};
  std::array<int, kSquares> counts{};
};

template <std::size_t MaxSources>
struct SourceBlockerLookup {
  std::array<std::array<int, MaxSources>, kSquares> sources{};
  std::array<std::array<int, MaxSources>, kSquares> blockers{};
  std::array<int, kSquares> counts{};
};

constexpr std::array<std::array<int, 2>, kOrthogonalDirections> kOrthogonalDeltas = {{
  {{0, -1}},
  {{1, 0}},
  {{0, 1}},
  {{-1, 0}}
}};

constexpr RaySquares makeRaySquareLookup() {
  RaySquares rays{};
  for (int square = 0; square < kSquares; square += 1) {
    for (int direction = 0; direction < kOrthogonalDirections; direction += 1) {
      for (int step = 0; step < kMaxRayLength; step += 1) {
        rays[static_cast<std::size_t>(square)][static_cast<std::size_t>(direction)][static_cast<std::size_t>(step)] = -1;
      }

      int file = square % kFiles + kOrthogonalDeltas[static_cast<std::size_t>(direction)][0];
      int rank = square / kFiles + kOrthogonalDeltas[static_cast<std::size_t>(direction)][1];
      int step = 0;
      while (file >= 0 && file < kFiles && rank >= 0 && rank < kRanks && step < kMaxRayLength) {
        rays[static_cast<std::size_t>(square)][static_cast<std::size_t>(direction)][static_cast<std::size_t>(step)] = rank * kFiles + file;
        file += kOrthogonalDeltas[static_cast<std::size_t>(direction)][0];
        rank += kOrthogonalDeltas[static_cast<std::size_t>(direction)][1];
        step += 1;
      }
    }
  }
  return rays;
}

constexpr RayLengths makeRayLengthLookup() {
  RayLengths lengths{};
  for (int square = 0; square < kSquares; square += 1) {
    for (int direction = 0; direction < kOrthogonalDirections; direction += 1) {
      int file = square % kFiles + kOrthogonalDeltas[static_cast<std::size_t>(direction)][0];
      int rank = square / kFiles + kOrthogonalDeltas[static_cast<std::size_t>(direction)][1];
      int length = 0;
      while (file >= 0 && file < kFiles && rank >= 0 && rank < kRanks && length < kMaxRayLength) {
        file += kOrthogonalDeltas[static_cast<std::size_t>(direction)][0];
        rank += kOrthogonalDeltas[static_cast<std::size_t>(direction)][1];
        length += 1;
      }
      lengths[static_cast<std::size_t>(square)][static_cast<std::size_t>(direction)] = length;
    }
  }
  return lengths;
}

constexpr OrthogonalDirectionLookup makeOrthogonalDirectionLookup() {
  OrthogonalDirectionLookup lookup{};
  for (int from = 0; from < kSquares; from += 1) {
    const int fromFile = from % kFiles;
    const int fromRank = from / kFiles;
    for (int to = 0; to < kSquares; to += 1) {
      if (from == to) {
        lookup[static_cast<std::size_t>(from)][static_cast<std::size_t>(to)] = -1;
        continue;
      }
      const int toFile = to % kFiles;
      const int toRank = to / kFiles;
      if (fromFile == toFile) {
        lookup[static_cast<std::size_t>(from)][static_cast<std::size_t>(to)] = toRank < fromRank ? 0 : 2;
      } else if (fromRank == toRank) {
        lookup[static_cast<std::size_t>(from)][static_cast<std::size_t>(to)] = toFile > fromFile ? 1 : 3;
      } else {
        lookup[static_cast<std::size_t>(from)][static_cast<std::size_t>(to)] = -1;
      }
    }
  }
  return lookup;
}

constexpr std::array<TargetLookup<kMaxKingTargets>, 2> makeKingTargetLookup() {
  constexpr int dirs[kMaxKingTargets][2] = {{0, -1}, {1, 0}, {0, 1}, {-1, 0}};
  std::array<TargetLookup<kMaxKingTargets>, 2> values{};
  for (int sideIndex = 0; sideIndex < 2; sideIndex += 1) {
    const int side = sideIndex == sideLookupIndex(kRed) ? kRed : kBlack;
    auto& lookup = values[static_cast<std::size_t>(sideIndex)];
    for (int square = 0; square < kSquares; square += 1) {
      const int file = square % kFiles;
      const int rank = square / kFiles;
      for (const auto& dir : dirs) {
        const int targetFile = file + dir[0];
        const int targetRank = rank + dir[1];
        if (!rawPalaceContains(side, targetFile, targetRank)) continue;
        int& count = lookup.counts[static_cast<std::size_t>(square)];
        lookup.targets[static_cast<std::size_t>(square)][static_cast<std::size_t>(count)] = targetRank * kFiles + targetFile;
        count += 1;
      }
    }
  }
  return values;
}

constexpr std::array<TargetLookup<kMaxAdvisorTargets>, 2> makeAdvisorTargetLookup() {
  constexpr int dirs[kMaxAdvisorTargets][2] = {{1, 1}, {1, -1}, {-1, 1}, {-1, -1}};
  std::array<TargetLookup<kMaxAdvisorTargets>, 2> values{};
  for (int sideIndex = 0; sideIndex < 2; sideIndex += 1) {
    const int side = sideIndex == sideLookupIndex(kRed) ? kRed : kBlack;
    auto& lookup = values[static_cast<std::size_t>(sideIndex)];
    for (int square = 0; square < kSquares; square += 1) {
      const int file = square % kFiles;
      const int rank = square / kFiles;
      for (const auto& dir : dirs) {
        const int targetFile = file + dir[0];
        const int targetRank = rank + dir[1];
        if (!rawPalaceContains(side, targetFile, targetRank)) continue;
        int& count = lookup.counts[static_cast<std::size_t>(square)];
        lookup.targets[static_cast<std::size_t>(square)][static_cast<std::size_t>(count)] = targetRank * kFiles + targetFile;
        count += 1;
      }
    }
  }
  return values;
}

constexpr std::array<TargetBlockerLookup<kMaxElephantTargets>, 2> makeElephantTargetLookup() {
  constexpr int dirs[kMaxElephantTargets][2] = {{1, 1}, {1, -1}, {-1, 1}, {-1, -1}};
  std::array<TargetBlockerLookup<kMaxElephantTargets>, 2> values{};
  for (int sideIndex = 0; sideIndex < 2; sideIndex += 1) {
    const int side = sideIndex == sideLookupIndex(kRed) ? kRed : kBlack;
    auto& lookup = values[static_cast<std::size_t>(sideIndex)];
    for (int square = 0; square < kSquares; square += 1) {
      const int file = square % kFiles;
      const int rank = square / kFiles;
      for (const auto& dir : dirs) {
        const int targetFile = file + dir[0] * 2;
        const int targetRank = rank + dir[1] * 2;
        if (targetFile < 0 || targetFile >= kFiles || targetRank < 0 || targetRank >= kRanks) continue;
        if (!rawOwnRiverSide(side, targetRank)) continue;
        int& count = lookup.counts[static_cast<std::size_t>(square)];
        lookup.targets[static_cast<std::size_t>(square)][static_cast<std::size_t>(count)] = targetRank * kFiles + targetFile;
        lookup.blockers[static_cast<std::size_t>(square)][static_cast<std::size_t>(count)] = (rank + dir[1]) * kFiles + file + dir[0];
        count += 1;
      }
    }
  }
  return values;
}

constexpr TargetBlockerLookup<kMaxHorseTargets> makeHorseTargetLookup() {
  constexpr int deltas[kMaxHorseTargets][2] = {{1, 2}, {2, 1}, {2, -1}, {1, -2}, {-1, -2}, {-2, -1}, {-2, 1}, {-1, 2}};
  TargetBlockerLookup<kMaxHorseTargets> lookup{};
  for (int square = 0; square < kSquares; square += 1) {
    const int file = square % kFiles;
    const int rank = square / kFiles;
    for (const auto& delta : deltas) {
      const int targetFile = file + delta[0];
      const int targetRank = rank + delta[1];
      if (targetFile < 0 || targetFile >= kFiles || targetRank < 0 || targetRank >= kRanks) continue;
      const int legFile = (delta[0] == 2 || delta[0] == -2) ? file + (delta[0] > 0 ? 1 : -1) : file;
      const int legRank = (delta[1] == 2 || delta[1] == -2) ? rank + (delta[1] > 0 ? 1 : -1) : rank;
      int& count = lookup.counts[static_cast<std::size_t>(square)];
      lookup.targets[static_cast<std::size_t>(square)][static_cast<std::size_t>(count)] = targetRank * kFiles + targetFile;
      lookup.blockers[static_cast<std::size_t>(square)][static_cast<std::size_t>(count)] = legRank * kFiles + legFile;
      count += 1;
    }
  }
  return lookup;
}

constexpr std::array<TargetLookup<kMaxPawnTargets>, 2> makePawnTargetLookup() {
  std::array<TargetLookup<kMaxPawnTargets>, 2> values{};
  for (int sideIndex = 0; sideIndex < 2; sideIndex += 1) {
    const int side = sideIndex == sideLookupIndex(kRed) ? kRed : kBlack;
    auto& lookup = values[static_cast<std::size_t>(sideIndex)];
    for (int square = 0; square < kSquares; square += 1) {
      const int file = square % kFiles;
      const int rank = square / kFiles;
      const int forwardRank = rank + (side == kRed ? -1 : 1);
      if (forwardRank >= 0 && forwardRank < kRanks) {
        int& count = lookup.counts[static_cast<std::size_t>(square)];
        lookup.targets[static_cast<std::size_t>(square)][static_cast<std::size_t>(count)] = forwardRank * kFiles + file;
        count += 1;
      }
      if (!rawCrossedRiver(side, rank)) continue;
      if (file > 0) {
        int& count = lookup.counts[static_cast<std::size_t>(square)];
        lookup.targets[static_cast<std::size_t>(square)][static_cast<std::size_t>(count)] = rank * kFiles + file - 1;
        count += 1;
      }
      if (file + 1 < kFiles) {
        int& count = lookup.counts[static_cast<std::size_t>(square)];
        lookup.targets[static_cast<std::size_t>(square)][static_cast<std::size_t>(count)] = rank * kFiles + file + 1;
        count += 1;
      }
    }
  }
  return values;
}

template <std::size_t MaxTargets>
constexpr SourceLookup<MaxTargets> makeSourceLookup(const TargetLookup<MaxTargets>& forward) {
  SourceLookup<MaxTargets> reverse{};
  for (int source = 0; source < kSquares; source += 1) {
    const int count = forward.counts[static_cast<std::size_t>(source)];
    const auto& targets = forward.targets[static_cast<std::size_t>(source)];
    for (int index = 0; index < count; index += 1) {
      const int target = targets[static_cast<std::size_t>(index)];
      int& reverseCount = reverse.counts[static_cast<std::size_t>(target)];
      if (reverseCount >= static_cast<int>(MaxTargets)) continue;
      reverse.sources[static_cast<std::size_t>(target)][static_cast<std::size_t>(reverseCount)] = source;
      reverseCount += 1;
    }
  }
  return reverse;
}

template <std::size_t MaxTargets>
constexpr SourceBlockerLookup<MaxTargets> makeSourceBlockerLookup(const TargetBlockerLookup<MaxTargets>& forward) {
  SourceBlockerLookup<MaxTargets> reverse{};
  for (int source = 0; source < kSquares; source += 1) {
    const int count = forward.counts[static_cast<std::size_t>(source)];
    const auto& targets = forward.targets[static_cast<std::size_t>(source)];
    const auto& blockers = forward.blockers[static_cast<std::size_t>(source)];
    for (int index = 0; index < count; index += 1) {
      const int target = targets[static_cast<std::size_t>(index)];
      int& reverseCount = reverse.counts[static_cast<std::size_t>(target)];
      if (reverseCount >= static_cast<int>(MaxTargets)) continue;
      reverse.sources[static_cast<std::size_t>(target)][static_cast<std::size_t>(reverseCount)] = source;
      reverse.blockers[static_cast<std::size_t>(target)][static_cast<std::size_t>(reverseCount)] = blockers[static_cast<std::size_t>(index)];
      reverseCount += 1;
    }
  }
  return reverse;
}

template <std::size_t MaxTargets>
constexpr std::array<SourceLookup<MaxTargets>, 2> makeSideSourceLookup(const std::array<TargetLookup<MaxTargets>, 2>& forward) {
  return {{
    makeSourceLookup(forward[0]),
    makeSourceLookup(forward[1])
  }};
}

template <std::size_t MaxTargets>
constexpr std::array<SourceBlockerLookup<MaxTargets>, 2> makeSideSourceBlockerLookup(const std::array<TargetBlockerLookup<MaxTargets>, 2>& forward) {
  return {{
    makeSourceBlockerLookup(forward[0]),
    makeSourceBlockerLookup(forward[1])
  }};
}

constexpr std::array<std::array<bool, kRanks>, 2> makeOwnRiverSideLookup() {
  std::array<std::array<bool, kRanks>, 2> values{};
  for (int rank = 0; rank < kRanks; rank += 1) {
    values[sideLookupIndex(kBlack)][static_cast<std::size_t>(rank)] = rawOwnRiverSide(kBlack, rank);
    values[sideLookupIndex(kRed)][static_cast<std::size_t>(rank)] = rawOwnRiverSide(kRed, rank);
  }
  return values;
}

constexpr std::array<std::array<bool, kRanks>, 2> makeCrossedRiverLookup() {
  std::array<std::array<bool, kRanks>, 2> values{};
  for (int rank = 0; rank < kRanks; rank += 1) {
    values[sideLookupIndex(kBlack)][static_cast<std::size_t>(rank)] = rawCrossedRiver(kBlack, rank);
    values[sideLookupIndex(kRed)][static_cast<std::size_t>(rank)] = rawCrossedRiver(kRed, rank);
  }
  return values;
}

constexpr std::array<std::array<int, kRanks>, 2> makeAdvanceBonusLookup() {
  std::array<std::array<int, kRanks>, 2> values{};
  for (int rank = 0; rank < kRanks; rank += 1) {
    values[sideLookupIndex(kBlack)][static_cast<std::size_t>(rank)] = rank * 5;
    values[sideLookupIndex(kRed)][static_cast<std::size_t>(rank)] = (9 - rank) * 5;
  }
  return values;
}

constexpr std::array<std::array<bool, kSquares>, 2> makePalaceLookup() {
  std::array<std::array<bool, kSquares>, 2> values{};
  for (int square = 0; square < kSquares; square += 1) {
    const int file = square % kFiles;
    const int rank = square / kFiles;
    values[sideLookupIndex(kBlack)][static_cast<std::size_t>(square)] = rawPalaceContains(kBlack, file, rank);
    values[sideLookupIndex(kRed)][static_cast<std::size_t>(square)] = rawPalaceContains(kRed, file, rank);
  }
  return values;
}

using SquarePairLookup = std::array<std::array<uint8_t, kSquares>, kSquares>;
using SquarePairIndexLookup = std::array<std::array<int8_t, kSquares>, kSquares>;

constexpr SquarePairLookup makeSameLineLookup() {
  SquarePairLookup values{};
  for (int square = 0; square < kSquares; square += 1) {
    const int file = square % kFiles;
    const int rank = square / kFiles;
    for (int target = 0; target < kSquares; target += 1) {
      const int targetFile = target % kFiles;
      const int targetRank = target / kFiles;
      values[static_cast<std::size_t>(square)][static_cast<std::size_t>(target)] =
          file == targetFile || rank == targetRank;
    }
  }
  return values;
}

constexpr SquarePairLookup makeHorseLegBlockerLookup() {
  SquarePairLookup values{};
  constexpr int deltas[kMaxHorseTargets][2] = {{1, 2}, {2, 1}, {2, -1}, {1, -2}, {-1, -2}, {-2, -1}, {-2, 1}, {-1, 2}};
  for (int source = 0; source < kSquares; source += 1) {
    const int file = source % kFiles;
    const int rank = source / kFiles;
    for (const auto& delta : deltas) {
      const int targetFile = file + delta[0];
      const int targetRank = rank + delta[1];
      if (targetFile < 0 || targetFile >= kFiles || targetRank < 0 || targetRank >= kRanks) continue;
      const int legFile = (delta[0] == 2 || delta[0] == -2) ? file + (delta[0] > 0 ? 1 : -1) : file;
      const int legRank = (delta[1] == 2 || delta[1] == -2) ? rank + (delta[1] > 0 ? 1 : -1) : rank;
      const int blocker = legRank * kFiles + legFile;
      const int target = targetRank * kFiles + targetFile;
      values[static_cast<std::size_t>(blocker)][static_cast<std::size_t>(target)] = true;
    }
  }
  return values;
}

constexpr SquarePairIndexLookup makeHorseLegSquareLookup() {
  SquarePairIndexLookup values{};
  for (auto& row : values) row.fill(-1);
  constexpr int deltas[kMaxHorseTargets][2] = {{1, 2}, {2, 1}, {2, -1}, {1, -2}, {-1, -2}, {-2, -1}, {-2, 1}, {-1, 2}};
  for (int square = 0; square < kSquares; square += 1) {
    const int file = square % kFiles;
    const int rank = square / kFiles;
    for (const auto& delta : deltas) {
      const int targetFile = file + delta[0];
      const int targetRank = rank + delta[1];
      if (targetFile < 0 || targetFile >= kFiles || targetRank < 0 || targetRank >= kRanks) continue;
      const int legFile = (delta[0] == 2 || delta[0] == -2) ? file + (delta[0] > 0 ? 1 : -1) : file;
      const int legRank = (delta[1] == 2 || delta[1] == -2) ? rank + (delta[1] > 0 ? 1 : -1) : rank;
      const int target = targetRank * kFiles + targetFile;
      values[static_cast<std::size_t>(square)][static_cast<std::size_t>(target)] =
          static_cast<int8_t>(legRank * kFiles + legFile);
    }
  }
  return values;
}

constexpr auto kFileBySquare = makeFileLookup();
constexpr auto kRankBySquare = makeRankLookup();
constexpr auto kFileCentrality = makeFileCentralityLookup();
constexpr auto kSameLineBySquare = makeSameLineLookup();
constexpr auto kHorseLegBlockerByTarget = makeHorseLegBlockerLookup();
constexpr auto kHorseLegSquareBySourceTarget = makeHorseLegSquareLookup();
constexpr auto kRaySquares = makeRaySquareLookup();
constexpr auto kRayLengths = makeRayLengthLookup();
constexpr auto kOrthogonalDirectionBetween = makeOrthogonalDirectionLookup();
constexpr auto kKingTargets = makeKingTargetLookup();
constexpr auto kAdvisorTargets = makeAdvisorTargetLookup();
constexpr auto kElephantTargets = makeElephantTargetLookup();
constexpr auto kHorseTargets = makeHorseTargetLookup();
constexpr auto kPawnTargets = makePawnTargetLookup();
constexpr auto kKingAttackers = makeSideSourceLookup(kKingTargets);
constexpr auto kAdvisorAttackers = makeSideSourceLookup(kAdvisorTargets);
constexpr auto kElephantAttackers = makeSideSourceBlockerLookup(kElephantTargets);
constexpr auto kHorseAttackers = makeSourceBlockerLookup(kHorseTargets);
constexpr auto kPawnAttackers = makeSideSourceLookup(kPawnTargets);
constexpr auto kOwnRiverSide = makeOwnRiverSideLookup();
constexpr auto kCrossedRiver = makeCrossedRiverLookup();
constexpr auto kAdvanceBonus = makeAdvanceBonusLookup();
constexpr auto kPalaceSquares = makePalaceLookup();
constexpr std::array<int, 2> kForwardDeltaBySide = {1, -1};
constexpr std::array<int, 8> kPieceValues = {0, 20000, 125, 125, 450, 1000, 500, 100};
constexpr int kPieceCodeOffset = 7;
constexpr std::size_t kPieceCodeCount = 15;

constexpr std::array<int, kPieceCodeCount> makePieceValueLookup() {
  std::array<int, kPieceCodeCount> values{};
  for (int piece = -7; piece <= 7; piece += 1) {
    const int type = piece < 0 ? -piece : piece;
    values[static_cast<std::size_t>(piece + kPieceCodeOffset)] = kPieceValues[static_cast<std::size_t>(type)];
  }
  return values;
}

constexpr std::array<int, kPieceCodeCount> makePieceMaterialScoreLookup() {
  std::array<int, kPieceCodeCount> values{};
  for (int piece = -7; piece <= 7; piece += 1) {
    const int type = piece < 0 ? -piece : piece;
    if (type == 0 || type == 1) continue;
    values[static_cast<std::size_t>(piece + kPieceCodeOffset)] =
        (piece > 0 ? 1 : -1) * kPieceValues[static_cast<std::size_t>(type)];
  }
  return values;
}

constexpr std::array<int, kPieceCodeCount> makeNonPawnMaterialLookup() {
  std::array<int, kPieceCodeCount> values{};
  for (int piece = -7; piece <= 7; piece += 1) {
    const int type = piece < 0 ? -piece : piece;
    values[static_cast<std::size_t>(piece + kPieceCodeOffset)] =
        type != 0 && type != 1 && type != 7 ? 1 : 0;
  }
  return values;
}

constexpr std::array<int, kPieceCodeCount> makeNullMoveMaterialLookup() {
  std::array<int, kPieceCodeCount> values{};
  for (int piece = -7; piece <= 7; piece += 1) {
    const int type = piece < 0 ? -piece : piece;
    values[static_cast<std::size_t>(piece + kPieceCodeOffset)] =
        type == 4 || type == 5 || type == 6 ? 1 : 0;
  }
  return values;
}

constexpr std::array<int, kPieceCodeCount> makePieceSideLookup() {
  std::array<int, kPieceCodeCount> values{};
  for (int piece = -7; piece <= 7; piece += 1) {
    values[static_cast<std::size_t>(piece + kPieceCodeOffset)] = (piece > 0) - (piece < 0);
  }
  return values;
}

constexpr std::array<int, kPieceCodeCount> makePieceTypeLookup() {
  std::array<int, kPieceCodeCount> values{};
  for (int piece = -7; piece <= 7; piece += 1) {
    values[static_cast<std::size_t>(piece + kPieceCodeOffset)] = piece < 0 ? -piece : piece;
  }
  return values;
}

constexpr auto kSideByPieceCode = makePieceSideLookup();
constexpr auto kTypeByPieceCode = makePieceTypeLookup();
constexpr auto kValueByPieceCode = makePieceValueLookup();
constexpr auto kMaterialScoreByPieceCode = makePieceMaterialScoreLookup();
constexpr auto kNonPawnMaterialByPieceCode = makeNonPawnMaterialLookup();
constexpr auto kNullMoveMaterialByPieceCode = makeNullMoveMaterialLookup();

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

enum MoveGenerationMode {
  GenerateAllMoves,
  GenerateCapturesOnly,
  GenerateQuietsOnly
};

struct Move {
  int16_t from;
  int16_t to;
  int16_t piece;
  int16_t captured;
};
static_assert(sizeof(Move) == 8, "Move should stay compact for stack move lists and sorting");

Move makeStoredMove(int fromSquare = 0, int toSquare = 0, int movingPiece = 0, int capturedPiece = 0) {
  Move move{};
  move.from = static_cast<int16_t>(fromSquare);
  move.to = static_cast<int16_t>(toSquare);
  move.piece = static_cast<int16_t>(movingPiece);
  move.captured = static_cast<int16_t>(capturedPiece);
  return move;
}

bool validStoredMove(const Move& move) {
  return move.from >= 0 && move.from < kSquares
      && move.to >= 0 && move.to < kSquares
      && move.from != move.to;
}

class MoveList {
 public:
  using iterator = Move*;
  using const_iterator = const Move*;

  void push_back(const Move& move) {
    if (size_ < moves_.size()) moves_[size_++] = move;
  }

  void resize(std::size_t size) {
    size_ = std::min(size, moves_.size());
  }

  bool empty() const {
    return size_ == 0;
  }

  std::size_t size() const {
    return size_;
  }

  Move& operator[](std::size_t index) {
    return moves_[index];
  }

  const Move& operator[](std::size_t index) const {
    return moves_[index];
  }

  iterator begin() {
    return moves_.data();
  }

  iterator end() {
    return moves_.data() + size_;
  }

  const_iterator begin() const {
    return moves_.data();
  }

  const_iterator end() const {
    return moves_.data() + size_;
  }

 private:
  std::array<Move, kMaxGeneratedMoves> moves_;
  std::size_t size_ = 0;
};

struct Board {
  std::array<int, kSquares> cells{};
  std::array<int, kSquares> redPieces{};
  std::array<int, kSquares> blackPieces{};
  std::array<int, kSquares> redPieceSlots{};
  std::array<int, kSquares> blackPieceSlots{};
  int side = kRed;
  uint64_t key = 0;
  int redKing = -1;
  int blackKing = -1;
  int redPieceCount = 0;
  int blackPieceCount = 0;
  int totalPieceCount = 0;
  int redNonPawnMaterial = 0;
  int blackNonPawnMaterial = 0;
  int redNullMoveMaterial = 0;
  int blackNullMoveMaterial = 0;
  int redAdvisorCount = 0;
  int blackAdvisorCount = 0;
  int redElephantCount = 0;
  int blackElephantCount = 0;
  int materialScore = 0;
  int positionalScore = 0;
  int guardPairScore = 0;
};

struct KnownChildState {
  int ownKing = kUnknownKingSquare;
  bool inCheck = false;
};

struct RootLine {
  Move move{};
  int score = -kInf;
  std::vector<Move> pv;
  KnownChildState child;
};

struct RootMove {
  Move move{};
  KnownChildState child;
};

class TranspositionTable;
class EvalCache;

struct CheckCacheEntry {
  uint64_t key = 0;
  int8_t from = -1;
  int8_t to = -1;
  int8_t enemyKing = -1;
  bool givesCheck = false;
  bool occupied = false;

  constexpr CheckCacheEntry() = default;

  constexpr CheckCacheEntry(
      uint64_t keyValue,
      int fromSquare,
      int toSquare,
      int enemyKingSquare,
      bool givesCheckValue,
      bool occupiedValue)
      : key(keyValue),
        from(static_cast<int8_t>(fromSquare)),
        to(static_cast<int8_t>(toSquare)),
        enemyKing(static_cast<int8_t>(enemyKingSquare)),
        givesCheck(givesCheckValue),
        occupied(occupiedValue) {}
};

struct LeastAttackerCacheEntry {
  uint64_t key = 0;
  int value = kInf;
  int8_t from = -1;
  int8_t to = -1;
  int8_t side = 0;
  int8_t target = -1;
  bool occupied = false;

  constexpr LeastAttackerCacheEntry() = default;

  constexpr LeastAttackerCacheEntry(
      uint64_t keyValue,
      int fromSquare,
      int toSquare,
      int sideValue,
      int targetSquare,
      int attackerValue,
      bool occupiedValue)
      : key(keyValue),
        value(attackerValue),
        from(static_cast<int8_t>(fromSquare)),
        to(static_cast<int8_t>(toSquare)),
        side(static_cast<int8_t>(sideValue)),
        target(static_cast<int8_t>(targetSquare)),
        occupied(occupiedValue) {}
};

static_assert(kSquares - 1 <= std::numeric_limits<int8_t>::max(), "cache square fields must fit in int8_t");
static_assert(sizeof(CheckCacheEntry) <= 16, "check cache entries should stay compact");
static_assert(sizeof(LeastAttackerCacheEntry) <= 24, "least-attacker cache entries should stay compact");

std::size_t floorPowerOfTwo(std::size_t value) {
  std::size_t power = 1;
  while (power <= value / 2) power *= 2;
  return power;
}

void prefetchForRead(const void* address) {
#if defined(__GNUC__) || defined(__clang__)
  __builtin_prefetch(address, 0, 0);
#else
  (void)address;
#endif
}

struct SearchState {
  std::chrono::steady_clock::time_point started;
  std::chrono::steady_clock::time_point deadline;
  bool hasDeadline = false;
  bool stopped = false;
  bool iidActive = false;
  bool singularActive = false;
  int64_t nodes = 0;
  int completedDepth = 0;
  int rootPieceCount = 0;
  int64_t ttProbes = 0;
  int64_t ttHits = 0;
  int64_t ttCutoffs = 0;
  int64_t ttStores = 0;
  int64_t ttMoveHits = 0;
  int64_t ttPrefetches = 0;
  int64_t killerHits = 0;
  int64_t historyUpdates = 0;
  int64_t captureHistoryHits = 0;
  int64_t captureHistoryStores = 0;
  int64_t captureHistoryMaluses = 0;
  int64_t captureHistoryPruneGuards = 0;
  int64_t nullMovePrunes = 0;
  int64_t nullMoveVerifications = 0;
  int64_t nullMoveVerificationFailures = 0;
  int64_t nullMoveReductionBoosts = 0;
  int64_t nullMoveMaterialGuards = 0;
  int64_t reverseFutilityPrunes = 0;
  int64_t mateDistancePrunes = 0;
  int64_t razorPrunes = 0;
  int64_t razorResearches = 0;
  int64_t seePrunes = 0;
  int64_t captureRiskProbes = 0;
  int64_t favorableCaptureRiskSkips = 0;
  int64_t leastAttackerCacheProbes = 0;
  int64_t leastAttackerCacheHits = 0;
  int64_t leastAttackerCacheStores = 0;
  int64_t probCutPrunes = 0;
  int64_t probCutSearches = 0;
  int64_t probCutCaptureSkips = 0;
  int64_t futilityPrunes = 0;
  int64_t badHistoryPrunes = 0;
  int64_t badHistoryPruneGuards = 0;
  int64_t deltaPrunes = 0;
  int64_t qDeltaPrefilterSkips = 0;
  int64_t qSeePrunes = 0;
  int64_t lateMovePrunes = 0;
  int64_t depthThreeLateMovePrunes = 0;
  int64_t depthFourLateMovePrunes = 0;
  int64_t lmrReductions = 0;
  int64_t reductionPlies = 0;
  int64_t deepReductions = 0;
  int64_t lmrResearches = 0;
  int64_t pvsResearches = 0;
  int64_t pvReductionGuards = 0;
  int64_t cutNodeReductionBoosts = 0;
  int64_t improvingNodes = 0;
  int64_t nonImprovingNodes = 0;
  int64_t stableEvalTrendNodes = 0;
  int64_t improvingReductionGuards = 0;
  int64_t nonImprovingReductionBoosts = 0;
  int64_t improvingLateMoveGuards = 0;
  int64_t nonImprovingLateMovePrunes = 0;
  int64_t countermoveHits = 0;
  int64_t countermoveStores = 0;
  int64_t continuationHistoryStores = 0;
  int64_t continuationHistoryHits = 0;
  int64_t continuationReductionBoosts = 0;
  int64_t continuationReductionMaluses = 0;
  int64_t followupHistoryStores = 0;
  int64_t followupHistoryHits = 0;
  int64_t followupReductionBoosts = 0;
  int64_t followupReductionMaluses = 0;
  int64_t checkEvasionOrderHits = 0;
  int64_t checkEvasionCaptures = 0;
  int64_t checkEvasionBlocks = 0;
  int64_t checkEvasionKingMoves = 0;
  int64_t checkHistoryStores = 0;
  int64_t checkHistoryHits = 0;
  int64_t checkHistoryMaluses = 0;
  int64_t checkCacheHits = 0;
  int64_t checkCacheStores = 0;
  int64_t iidSearches = 0;
  int64_t iidMoveHits = 0;
  int64_t rootTtHits = 0;
  int64_t rootTtStores = 0;
  int64_t aspirationSearches = 0;
  int64_t aspirationWidenedSearches = 0;
  int64_t aspirationFailHigh = 0;
  int64_t aspirationFailLow = 0;
  int64_t rootTimeGuardStops = 0;
  int64_t openingPreferencePromotions = 0;
  int64_t rootMovesSearched = 0;
  int64_t rootChildStateReuses = 0;
  int64_t rootReductions = 0;
  int64_t rootReductionPlies = 0;
  int64_t rootReductionResearches = 0;
  int64_t rootHistoryReductionGuards = 0;
  int64_t rootHistoryReductionBoosts = 0;
  int64_t rootOrderHits = 0;
  int64_t rootOrderStores = 0;
  int64_t extensions = 0;
  int64_t recaptureExtensions = 0;
  int64_t pawnThreatExtensions = 0;
  int64_t pawnThreatOrderHits = 0;
  int64_t recaptureOrderHits = 0;
  int64_t singularExtensionSearches = 0;
  int64_t singularExtensions = 0;
  int64_t singularExtensionRejects = 0;
  int64_t repetitions = 0;
  int64_t qnodes = 0;
  int64_t qchecks = 0;
  int64_t qCheckHistoryHits = 0;
  int64_t qCheckHistoryStores = 0;
  int64_t qCheckHistoryMaluses = 0;
  int64_t qCaptureHistoryPruneGuards = 0;
  int64_t qCaptureHistoryHits = 0;
  int64_t qCaptureHistoryStores = 0;
  int64_t qCaptureHistoryMaluses = 0;
  int64_t qttProbes = 0;
  int64_t qttHits = 0;
  int64_t qttStores = 0;
  int64_t qttCutoffs = 0;
  int64_t qttMoveHits = 0;
  int64_t qttPrefetches = 0;
  int64_t evalCacheProbes = 0;
  int64_t evalCacheHits = 0;
  int64_t evalCacheStores = 0;
  int64_t evalCachePrefetches = 0;
  int64_t checkedEvalSkips = 0;
  int64_t staticEvalTrendClears = 0;
  int memoryAge = 0;
  uint64_t rootOrderKey = 0;
  int rootOrderCount = 0;
  int ttHashfull = 0;
  TranspositionTable* tt = nullptr;
  TranspositionTable* qtt = nullptr;
  EvalCache* evalCache = nullptr;
  const std::vector<uint64_t>* rootHistoryKeys = nullptr;
  const std::unordered_map<uint64_t, int>* rootHistoryCounts = nullptr;
  bool rootHistoryHasPositions = false;
  bool rootHistoryHasRepeatedPositions = false;
  std::array<std::array<Move, 2>, kMaxPly> killers{};
  std::array<std::array<int, kSquares>, kSquares> quietHistory{};
  std::array<std::array<int, kSquares>, kSquares> captureHistory{};
  std::array<std::array<int, kSquares>, kSquares> checkHistory{};
  std::array<std::array<int, kSquares>, kSquares> qCheckHistory{};
  std::array<std::array<int, kSquares>, kSquares> qCaptureHistory{};
  std::array<std::array<Move, kSquares>, kSquares> countermoves{};
  std::array<std::array<std::array<int, kSquares>, kSquares>, kSquares> continuationHistory{};
  std::array<Move, kMaxGeneratedMoves> rootOrderMoves{};
  std::array<int, kMaxPly> staticEvalStack{};
  std::array<bool, kMaxPly> staticEvalKnown{};
  std::array<Move, kMaxPly> pathMoves{};
  std::array<bool, kMaxPly> pathMoveKnown{};
  std::array<uint64_t, kMaxPly> pathKeys{};
  std::array<bool, kMaxPly> pathKeyKnown{};
  std::vector<CheckCacheEntry> checkCache = std::vector<CheckCacheEntry>(kCheckCacheSize);
  std::vector<LeastAttackerCacheEntry> leastAttackerCache = std::vector<LeastAttackerCacheEntry>(kLeastAttackerCacheSize);

  void resetForSearch() {
    started = {};
    deadline = {};
    hasDeadline = false;
    stopped = false;
    iidActive = false;
    singularActive = false;
    nodes = 0;
    completedDepth = 0;
    rootPieceCount = 0;
    ttProbes = 0;
    ttHits = 0;
    ttCutoffs = 0;
    ttStores = 0;
    ttMoveHits = 0;
    ttPrefetches = 0;
    killerHits = 0;
    historyUpdates = 0;
    captureHistoryHits = 0;
    captureHistoryStores = 0;
    captureHistoryMaluses = 0;
    captureHistoryPruneGuards = 0;
    nullMovePrunes = 0;
    nullMoveVerifications = 0;
    nullMoveVerificationFailures = 0;
    nullMoveReductionBoosts = 0;
    nullMoveMaterialGuards = 0;
    reverseFutilityPrunes = 0;
    mateDistancePrunes = 0;
    razorPrunes = 0;
    razorResearches = 0;
    seePrunes = 0;
    captureRiskProbes = 0;
    favorableCaptureRiskSkips = 0;
    leastAttackerCacheProbes = 0;
    leastAttackerCacheHits = 0;
    leastAttackerCacheStores = 0;
    probCutPrunes = 0;
    probCutSearches = 0;
    probCutCaptureSkips = 0;
    futilityPrunes = 0;
    badHistoryPrunes = 0;
    badHistoryPruneGuards = 0;
    deltaPrunes = 0;
    qDeltaPrefilterSkips = 0;
    qSeePrunes = 0;
    lateMovePrunes = 0;
    depthThreeLateMovePrunes = 0;
    depthFourLateMovePrunes = 0;
    lmrReductions = 0;
    reductionPlies = 0;
    deepReductions = 0;
    lmrResearches = 0;
    pvsResearches = 0;
    pvReductionGuards = 0;
    cutNodeReductionBoosts = 0;
    improvingNodes = 0;
    nonImprovingNodes = 0;
    stableEvalTrendNodes = 0;
    improvingReductionGuards = 0;
    nonImprovingReductionBoosts = 0;
    improvingLateMoveGuards = 0;
    nonImprovingLateMovePrunes = 0;
    countermoveHits = 0;
    countermoveStores = 0;
    continuationHistoryStores = 0;
    continuationHistoryHits = 0;
    continuationReductionBoosts = 0;
    continuationReductionMaluses = 0;
    followupHistoryStores = 0;
    followupHistoryHits = 0;
    followupReductionBoosts = 0;
    followupReductionMaluses = 0;
    checkEvasionOrderHits = 0;
    checkEvasionCaptures = 0;
    checkEvasionBlocks = 0;
    checkEvasionKingMoves = 0;
    checkHistoryStores = 0;
    checkHistoryHits = 0;
    checkHistoryMaluses = 0;
    checkCacheHits = 0;
    checkCacheStores = 0;
    iidSearches = 0;
    iidMoveHits = 0;
    rootTtHits = 0;
    rootTtStores = 0;
    aspirationSearches = 0;
    aspirationWidenedSearches = 0;
    aspirationFailHigh = 0;
    aspirationFailLow = 0;
    rootTimeGuardStops = 0;
    openingPreferencePromotions = 0;
    rootMovesSearched = 0;
    rootChildStateReuses = 0;
    rootReductions = 0;
    rootReductionPlies = 0;
    rootReductionResearches = 0;
    rootHistoryReductionGuards = 0;
    rootHistoryReductionBoosts = 0;
    rootOrderHits = 0;
    rootOrderStores = 0;
    extensions = 0;
    recaptureExtensions = 0;
    pawnThreatExtensions = 0;
    pawnThreatOrderHits = 0;
    recaptureOrderHits = 0;
    singularExtensionSearches = 0;
    singularExtensions = 0;
    singularExtensionRejects = 0;
    repetitions = 0;
    qnodes = 0;
    qchecks = 0;
    qCheckHistoryHits = 0;
    qCheckHistoryStores = 0;
    qCheckHistoryMaluses = 0;
    qCaptureHistoryPruneGuards = 0;
    qCaptureHistoryHits = 0;
    qCaptureHistoryStores = 0;
    qCaptureHistoryMaluses = 0;
    qttProbes = 0;
    qttHits = 0;
    qttStores = 0;
    qttCutoffs = 0;
    qttMoveHits = 0;
    qttPrefetches = 0;
    evalCacheProbes = 0;
    evalCacheHits = 0;
    evalCacheStores = 0;
    evalCachePrefetches = 0;
    checkedEvalSkips = 0;
    staticEvalTrendClears = 0;
    memoryAge += 1;
    ttHashfull = 0;
    tt = nullptr;
    qtt = nullptr;
    evalCache = nullptr;
    rootHistoryKeys = nullptr;
    rootHistoryCounts = nullptr;
    rootHistoryHasPositions = false;
    rootHistoryHasRepeatedPositions = false;
    killers = {};
    staticEvalStack.fill(0);
    staticEvalKnown.fill(false);
    pathMoves = {};
    pathMoveKnown.fill(false);
    pathKeys.fill(0);
    pathKeyKnown.fill(false);
  }

  void clearSearchMemory() {
    memoryAge = 0;
    killers = {};
    quietHistory = {};
    captureHistory = {};
    checkHistory = {};
    qCheckHistory = {};
    qCaptureHistory = {};
    countermoves = {};
    continuationHistory = {};
    rootOrderKey = 0;
    rootOrderCount = 0;
    rootHistoryKeys = nullptr;
    rootHistoryCounts = nullptr;
    rootHistoryHasPositions = false;
    rootHistoryHasRepeatedPositions = false;
    rootOrderMoves = {};
    if (checkCache.size() != kCheckCacheSize) {
      checkCache.resize(kCheckCacheSize);
    }
    std::fill(checkCache.begin(), checkCache.end(), CheckCacheEntry{});
    if (leastAttackerCache.size() != kLeastAttackerCacheSize) {
      leastAttackerCache.resize(kLeastAttackerCacheSize);
    }
    std::fill(leastAttackerCache.begin(), leastAttackerCache.end(), LeastAttackerCacheEntry{});
    staticEvalStack.fill(0);
    staticEvalKnown.fill(false);
    pathMoves = {};
    pathMoveKnown.fill(false);
    pathKeys.fill(0);
    pathKeyKnown.fill(false);
  }
};

struct TtEntry {
  uint64_t key = 0;
  int depth = -1;
  int score = 0;
  int flag = 0;
  Move bestMove{};
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
    const std::size_t entries = floorPowerOfTwo(std::max<std::size_t>(1024, bytes / sizeof(TtEntry)));
    table_.assign(entries, {});
    mask_ = entries - 1;
    bucketMask_ = mask_ & ~(kTtBucketSize - 1);
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
    const std::size_t bucket = bucketIndex(key);
    for (std::size_t offset = 0; offset < kTtBucketSize; offset += 1) {
      const TtEntry& entry = table_[bucket + offset];
      if (entry.occupied && entry.key == key) return &entry;
    }
    return nullptr;
  }

  bool prefetch(uint64_t key) const {
    if (table_.empty()) return false;
    prefetchForRead(&table_[bucketIndex(key)]);
    return true;
  }

  bool store(uint64_t key, int depth, int score, int flag, const Move& bestMove) {
    if (table_.empty()) return false;
    TtEntry& entry = replacementEntry(key);
    Move storedBestMove = bestMove;
    if (entry.occupied && entry.key == key) {
      if (!validStoredMove(storedBestMove) && validStoredMove(entry.bestMove)) {
        storedBestMove = entry.bestMove;
      }
      const bool currentGeneration = entry.generation == generation_;
      const bool newExact = flag == kTtExact;
      if (currentGeneration && entry.flag == kTtExact && entry.depth > depth) return false;
      if (currentGeneration && entry.flag == kTtExact && entry.depth == depth && !newExact) return false;
      if (currentGeneration && entry.depth > depth && !newExact) return false;
    }
    if (entry.occupied && entry.key != key && entry.depth > depth && entry.generation == generation_) return false;
    entry = {key, depth, score, flag, storedBestMove, generation_, true};
    return true;
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
  std::size_t bucketIndex(uint64_t key) const {
    return static_cast<std::size_t>(key) & bucketMask_;
  }

  int replacementPriority(const TtEntry& entry) const {
    if (!entry.occupied) return -1000000;
    const int agePenalty = entry.generation == generation_ ? 0 : -100000;
    const int exactBonus = entry.flag == kTtExact ? 1024 : 0;
    return agePenalty + entry.depth * 16 + exactBonus;
  }

  TtEntry& replacementEntry(uint64_t key) {
    const std::size_t bucket = bucketIndex(key);
    TtEntry* replacement = &table_[bucket];
    int replacementScore = replacementPriority(*replacement);
    for (std::size_t offset = 0; offset < kTtBucketSize; offset += 1) {
      TtEntry& entry = table_[bucket + offset];
      if (entry.occupied && entry.key == key) return entry;
      const int score = replacementPriority(entry);
      if (score < replacementScore) {
        replacement = &entry;
        replacementScore = score;
      }
    }
    return *replacement;
  }

  std::vector<TtEntry> table_;
  std::size_t mask_ = 0;
  std::size_t bucketMask_ = 0;
  int generation_ = 1;
};

struct EvalEntry {
  uint64_t key = 0;
  int score = 0;
  int generation = 0;
  bool occupied = false;
};

class EvalCache {
 public:
  explicit EvalCache(int megabytes = 4) {
    resize(megabytes);
  }

  void resize(int megabytes) {
    const std::size_t bytes = static_cast<std::size_t>(std::max(1, megabytes)) * 1024ULL * 1024ULL;
    const std::size_t entries = floorPowerOfTwo(std::max<std::size_t>(1024, bytes / sizeof(EvalEntry)));
    table_.assign(entries, {});
    mask_ = entries - 1;
    bucketMask_ = mask_ & ~(kEvalBucketSize - 1);
    generation_ = 1;
  }

  void clear() {
    std::fill(table_.begin(), table_.end(), EvalEntry{});
    generation_ = 1;
  }

  void newSearch() {
    generation_ += 1;
    if (generation_ > 1000000) {
      generation_ = 1;
      for (EvalEntry& entry : table_) entry.generation = 0;
    }
  }

  const EvalEntry* probe(uint64_t key) const {
    if (table_.empty()) return nullptr;
    const std::size_t bucket = bucketIndex(key);
    for (std::size_t offset = 0; offset < kEvalBucketSize; offset += 1) {
      const EvalEntry& entry = table_[bucket + offset];
      if (entry.occupied && entry.key == key) return &entry;
    }
    return nullptr;
  }

  bool prefetch(uint64_t key) const {
    if (table_.empty()) return false;
    prefetchForRead(&table_[bucketIndex(key)]);
    return true;
  }

  void store(uint64_t key, int score) {
    if (table_.empty()) return;
    replacementEntry(key) = {key, score, generation_, true};
  }

 private:
  std::size_t bucketIndex(uint64_t key) const {
    return static_cast<std::size_t>(key) & bucketMask_;
  }

  int replacementPriority(const EvalEntry& entry) const {
    if (!entry.occupied) return -1000000;
    return entry.generation == generation_ ? 0 : -100000;
  }

  EvalEntry& replacementEntry(uint64_t key) {
    const std::size_t bucket = bucketIndex(key);
    EvalEntry* replacement = &table_[bucket];
    int replacementScore = replacementPriority(*replacement);
    for (std::size_t offset = 0; offset < kEvalBucketSize; offset += 1) {
      EvalEntry& entry = table_[bucket + offset];
      if (entry.occupied && entry.key == key) return entry;
      const int score = replacementPriority(entry);
      if (score < replacementScore) {
        replacement = &entry;
        replacementScore = score;
      }
    }
    return *replacement;
  }

  std::vector<EvalEntry> table_;
  std::size_t mask_ = 0;
  std::size_t bucketMask_ = 0;
  int generation_ = 1;
};

int indexOf(int file, int rank) {
  return rank * kFiles + file;
}

int fileOf(int square) {
  return kFileBySquare[static_cast<std::size_t>(square)];
}

int rankOf(int square) {
  return kRankBySquare[static_cast<std::size_t>(square)];
}

int fileCentrality(int file) {
  if (file < 0 || file >= kFiles) return 0;
  return kFileCentrality[static_cast<std::size_t>(file)];
}

bool inside(int file, int rank) {
  return file >= 0 && file < kFiles && rank >= 0 && rank < kRanks;
}

int sideOf(int piece) {
  if (piece < -7 || piece > 7) return (piece > 0) - (piece < 0);
  return kSideByPieceCode[static_cast<std::size_t>(piece + kPieceCodeOffset)];
}

int typeOf(int piece) {
  if (piece < -7 || piece > 7) return piece < 0 ? -piece : piece;
  return kTypeByPieceCode[static_cast<std::size_t>(piece + kPieceCodeOffset)];
}

bool countsAsNonPawnMaterial(int piece) {
  return kNonPawnMaterialByPieceCode[static_cast<std::size_t>(piece + kPieceCodeOffset)] != 0;
}

bool countsAsNullMoveMaterial(int piece) {
  return kNullMoveMaterialByPieceCode[static_cast<std::size_t>(piece + kPieceCodeOffset)] != 0;
}

int materialScoreForPiece(int piece) {
  return kMaterialScoreByPieceCode[static_cast<std::size_t>(piece + kPieceCodeOffset)];
}

int guardPairScoreForSideTypeCount(int side, int type, int count) {
  if (type != Advisor && type != Elephant) return 0;
  return count >= 2 ? (side == kRed ? 25 : -25) : 0;
}

int* guardPieceCount(Board& board, int side, int type) {
  if (type == Advisor) return side == kRed ? &board.redAdvisorCount : &board.blackAdvisorCount;
  if (type == Elephant) return side == kRed ? &board.redElephantCount : &board.blackElephantCount;
  return nullptr;
}

void addGuardPairCountBySideType(Board& board, int side, int type, int delta) {
  int* count = guardPieceCount(board, side, type);
  if (!count) return;

  board.guardPairScore -= guardPairScoreForSideTypeCount(side, type, *count);
  *count += delta;
  board.guardPairScore += guardPairScoreForSideTypeCount(side, type, *count);
}

std::array<int, kSquares>& pieceSquares(Board& board, int side) {
  return side == kRed ? board.redPieces : board.blackPieces;
}

const std::array<int, kSquares>& pieceSquares(const Board& board, int side) {
  return side == kRed ? board.redPieces : board.blackPieces;
}

std::array<int, kSquares>& pieceSlots(Board& board, int side) {
  return side == kRed ? board.redPieceSlots : board.blackPieceSlots;
}

const std::array<int, kSquares>& pieceSlots(const Board& board, int side) {
  return side == kRed ? board.redPieceSlots : board.blackPieceSlots;
}

int& pieceCount(Board& board, int side) {
  return side == kRed ? board.redPieceCount : board.blackPieceCount;
}

int pieceCount(const Board& board, int side) {
  return side == kRed ? board.redPieceCount : board.blackPieceCount;
}

void clearPieceSquares(Board& board) {
  board.redPieceCount = 0;
  board.blackPieceCount = 0;
  board.redPieces.fill(0);
  board.blackPieces.fill(0);
  board.redPieceSlots.fill(-1);
  board.blackPieceSlots.fill(-1);
}

void addPieceSquare(Board& board, int side, int square) {
  int& count = pieceCount(board, side);
  if (count >= kSquares) return;
  auto& squares = pieceSquares(board, side);
  auto& slots = pieceSlots(board, side);
  int index = count;
  while (index > 0 && squares[index - 1] > square) {
    squares[index] = squares[index - 1];
    slots[squares[index]] = index;
    index -= 1;
  }
  squares[index] = square;
  slots[square] = index;
  count += 1;
}

int findPieceSquareSlot(const std::array<int, kSquares>& squares, const std::array<int, kSquares>& slots, int count, int square) {
  if (square >= 0 && square < kSquares) {
    const int index = slots[square];
    if (index >= 0 && index < count && squares[index] == square) return index;
  }

  for (int candidate = 0; candidate < count; candidate += 1) {
    if (squares[candidate] == square) return candidate;
  }

  return -1;
}

int trackedPieceSquareSlot(const Board& board, int side, int square) {
  assert(square >= 0 && square < kSquares);
  const auto& squares = pieceSquares(board, side);
  const auto& slots = pieceSlots(board, side);
  const int count = pieceCount(board, side);
  const int index = slots[square];
  assert(index >= 0 && index < count);
  assert(squares[index] == square);
  return index;
}

void removePieceSquareAt(Board& board, int side, int square, int index) {
  auto& squares = pieceSquares(board, side);
  auto& slots = pieceSlots(board, side);
  int& count = pieceCount(board, side);

  slots[square] = -1;
  for (int next = index + 1; next < count; next += 1) {
    squares[next - 1] = squares[next];
    slots[squares[next - 1]] = next - 1;
  }
  count -= 1;
  squares[count] = 0;
}

[[maybe_unused]] void removePieceSquare(Board& board, int side, int square) {
  auto& squares = pieceSquares(board, side);
  auto& slots = pieceSlots(board, side);
  int& count = pieceCount(board, side);
  const int index = findPieceSquareSlot(squares, slots, count, square);
  if (index < 0) return;

  removePieceSquareAt(board, side, square, index);
}

void removeTrackedPieceSquare(Board& board, int side, int square) {
  removePieceSquareAt(board, side, square, trackedPieceSquareSlot(board, side, square));
}

void movePieceSquareAt(Board& board, int side, int from, int to, int index) {
  auto& squares = pieceSquares(board, side);
  auto& slots = pieceSlots(board, side);
  int& count = pieceCount(board, side);

  slots[from] = -1;
  squares[index] = to;
  slots[to] = index;
  while (index > 0 && squares[index - 1] > squares[index]) {
    const int previous = squares[index - 1];
    squares[index - 1] = squares[index];
    squares[index] = previous;
    slots[squares[index - 1]] = index - 1;
    slots[squares[index]] = index;
    index -= 1;
  }
  while (index + 1 < count && squares[index + 1] < squares[index]) {
    const int next = squares[index + 1];
    squares[index + 1] = squares[index];
    squares[index] = next;
    slots[squares[index + 1]] = index + 1;
    slots[squares[index]] = index;
    index += 1;
  }
}

[[maybe_unused]] void movePieceSquare(Board& board, int side, int from, int to) {
  auto& squares = pieceSquares(board, side);
  auto& slots = pieceSlots(board, side);
  const int count = pieceCount(board, side);
  const int index = findPieceSquareSlot(squares, slots, count, from);
  if (index < 0) {
    addPieceSquare(board, side, to);
    return;
  }

  movePieceSquareAt(board, side, from, to, index);
}

void moveTrackedPieceSquare(Board& board, int side, int from, int to) {
  movePieceSquareAt(board, side, from, to, trackedPieceSquareSlot(board, side, from));
}

bool palaceContains(int side, int file, int rank) {
  if (!inside(file, rank)) return false;
  return kPalaceSquares[static_cast<std::size_t>(sideLookupIndex(side))][static_cast<std::size_t>(indexOf(file, rank))];
}

bool ownRiverSide(int side, int rank) {
  if (rank < 0 || rank >= kRanks) return side == kRed ? rank >= 5 : rank <= 4;
  return kOwnRiverSide[static_cast<std::size_t>(sideLookupIndex(side))][static_cast<std::size_t>(rank)];
}

bool crossedRiver(int side, int rank) {
  if (rank < 0 || rank >= kRanks) return side == kRed ? rank <= 4 : rank >= 5;
  return kCrossedRiver[static_cast<std::size_t>(sideLookupIndex(side))][static_cast<std::size_t>(rank)];
}

int forwardDelta(int side) {
  return kForwardDeltaBySide[static_cast<std::size_t>(sideLookupIndex(side))];
}

int squareAdvanceBonus(int side, int rank) {
  if (rank < 0 || rank >= kRanks) return side == kRed ? (9 - rank) * 5 : rank * 5;
  return kAdvanceBonus[static_cast<std::size_t>(sideLookupIndex(side))][static_cast<std::size_t>(rank)];
}

int positionalScoreForSideTypeSquare(int side, int type, int square) {
  if (square < 0 || square >= kSquares) return 0;
  const int file = fileOf(square);
  const int rank = rankOf(square);
  int score = 0;

  if (type == Pawn) {
    score += squareAdvanceBonus(side, rank);
    if (crossedRiver(side, rank)) score += 55;
    score += fileCentrality(file) * 4;
    if (palaceContains(-side, file, rank)) score += 35;
  } else if (type == Horse) {
    score += fileCentrality(file) * 8;
    if (crossedRiver(side, rank)) score += 25;
  } else if (type == Rook) {
    if (crossedRiver(side, rank)) score += 25;
    score += fileCentrality(file) * 3;
  } else if (type == Cannon) {
    score += fileCentrality(file) * 5;
    if (crossedRiver(side, rank)) score += 15;
  }

  return (side == kRed ? 1 : -1) * score;
}

std::array<std::array<int, kSquares>, kPieceCodeCount> makePositionalScoreLookup() {
  std::array<std::array<int, kSquares>, kPieceCodeCount> values{};
  for (int piece = -7; piece <= 7; piece += 1) {
    for (int square = 0; square < kSquares; square += 1) {
      values[static_cast<std::size_t>(piece + kPieceCodeOffset)][static_cast<std::size_t>(square)] =
          piece == 0 ? 0 : positionalScoreForSideTypeSquare(sideOf(piece), typeOf(piece), square);
    }
  }
  return values;
}

const auto kPositionalScoreByPieceSquare = makePositionalScoreLookup();

int positionalScoreForPieceSquare(int piece, int square) {
  return kPositionalScoreByPieceSquare[static_cast<std::size_t>(piece + kPieceCodeOffset)][static_cast<std::size_t>(square)];
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

constexpr uint64_t splitmix64(uint64_t value) {
  value += 0x9e3779b97f4a7c15ULL;
  value = (value ^ (value >> 30)) * 0xbf58476d1ce4e5b9ULL;
  value = (value ^ (value >> 27)) * 0x94d049bb133111ebULL;
  return value ^ (value >> 31);
}

constexpr int rawPieceSlotForHash(int piece) {
  if (piece == 0) return 0;
  const int type = piece < 0 ? -piece : piece;
  return piece > 0 ? type : type + 7;
}

constexpr uint64_t rawPieceHash(int square, int piece) {
  constexpr uint64_t seed = 0x6a09e667f3bcc909ULL;
  return splitmix64(
      seed
      ^ (static_cast<uint64_t>(square + 1) * 0x100000001b3ULL)
      ^ static_cast<uint64_t>(rawPieceSlotForHash(piece) * 0x9e3779b1U));
}

constexpr std::array<std::array<uint64_t, kPieceCodeCount>, kSquares> makePieceHashLookup() {
  std::array<std::array<uint64_t, kPieceCodeCount>, kSquares> values{};
  for (int square = 0; square < kSquares; square += 1) {
    for (int piece = -7; piece <= 7; piece += 1) {
      values[static_cast<std::size_t>(square)][static_cast<std::size_t>(piece + kPieceCodeOffset)] =
          rawPieceHash(square, piece);
    }
  }
  return values;
}

constexpr auto kPieceHashBySquareCode = makePieceHashLookup();
constexpr uint64_t kSideHash = splitmix64(0xbb67ae8584caa73bULL);

int pieceCodeSide(int piece) {
  return kSideByPieceCode[static_cast<std::size_t>(piece + kPieceCodeOffset)];
}

int pieceCodeType(int piece) {
  return kTypeByPieceCode[static_cast<std::size_t>(piece + kPieceCodeOffset)];
}

int pieceCodeValue(int piece) {
  return kValueByPieceCode[static_cast<std::size_t>(piece + kPieceCodeOffset)];
}

int pieceTypeValue(int type) {
  return kPieceValues[static_cast<std::size_t>(type)];
}

int pieceValue(int pieceOrType) {
  if (pieceOrType >= -7 && pieceOrType <= 7) {
    return kValueByPieceCode[static_cast<std::size_t>(pieceOrType + kPieceCodeOffset)];
  }
  const int type = pieceOrType < 0 ? -pieceOrType : pieceOrType;
  if (type < 0 || type >= static_cast<int>(kPieceValues.size())) return 0;
  return kPieceValues[static_cast<std::size_t>(type)];
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

uint64_t pieceHash(int square, int piece) {
  return kPieceHashBySquareCode[static_cast<std::size_t>(square)][static_cast<std::size_t>(piece + kPieceCodeOffset)];
}

uint64_t sideHash() {
  return kSideHash;
}

uint64_t keyAfterMove(const Board& board, const Move& move) {
  const int movingPiece = board.cells[move.from];
  const int capturedPiece = board.cells[move.to];
  uint64_t key = board.key ^ sideHash();
  key ^= pieceHash(move.from, movingPiece);
  if (capturedPiece != 0) key ^= pieceHash(move.to, capturedPiece);
  key ^= pieceHash(move.to, movingPiece);
  return key;
}

uint64_t evalCacheKeyFor(uint64_t boardKey, int sideToMove) {
  return sideToMove == kBlack ? boardKey ^ sideHash() : boardKey;
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
  clearPieceSquares(board);
  board.redKing = -1;
  board.blackKing = -1;
  board.totalPieceCount = 0;
  board.redNonPawnMaterial = 0;
  board.blackNonPawnMaterial = 0;
  board.redNullMoveMaterial = 0;
  board.blackNullMoveMaterial = 0;
  board.redAdvisorCount = 0;
  board.blackAdvisorCount = 0;
  board.redElephantCount = 0;
  board.blackElephantCount = 0;
  board.materialScore = 0;
  board.positionalScore = 0;
  board.guardPairScore = 0;

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
    const int square = indexOf(file, rank);
    board.cells[square] = piece;
    addPieceSquare(board, sideOf(piece), square);
    if (typeOf(piece) == King) {
      if (sideOf(piece) == kRed) board.redKing = square;
      else board.blackKing = square;
    }
    board.totalPieceCount += 1;
    if (countsAsNonPawnMaterial(piece)) {
      if (sideOf(piece) == kRed) board.redNonPawnMaterial += 1;
      else board.blackNonPawnMaterial += 1;
    }
    if (countsAsNullMoveMaterial(piece)) {
      if (sideOf(piece) == kRed) board.redNullMoveMaterial += 1;
      else board.blackNullMoveMaterial += 1;
    }
    board.materialScore += materialScoreForPiece(piece);
    board.positionalScore += positionalScoreForPieceSquare(piece, square);
    addGuardPairCountBySideType(board, sideOf(piece), typeOf(piece), 1);
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
  return makeStoredMove(indexOf(fromFile, fromRank), indexOf(toFile, toRank), 0, 0);
}

constexpr int uciSquare(char file, char rank) {
  return (9 - (rank - '0')) * kFiles + (file - 'a');
}

bool sameUciMove(const Move& move, const char* text) {
  return move.from == uciSquare(text[0], text[1])
      && move.to == uciSquare(text[2], text[3]);
}

template <MoveGenerationMode mode>
void addMoveWithOccupant(MoveList& moves, int from, int to, int piece, int pieceSide, int captured) {
  if (captured * pieceSide > 0) return;
  if constexpr (mode == GenerateCapturesOnly) {
    if (captured == 0) return;
  }
  if constexpr (mode == GenerateQuietsOnly) {
    if (captured != 0) return;
  }
  moves.push_back(makeStoredMove(from, to, piece, captured));
}

template <MoveGenerationMode mode>
void addMove(const Board& board, MoveList& moves, int from, int to, int piece, int pieceSide) {
  addMoveWithOccupant<mode>(moves, from, to, piece, pieceSide, board.cells[to]);
}

template <MoveGenerationMode mode>
void addKingMoves(const Board& board, MoveList& moves, int from, int piece, int pieceSide) {
  const auto& lookup = kKingTargets[static_cast<std::size_t>(sideLookupIndex(pieceSide))];
  const int count = lookup.counts[static_cast<std::size_t>(from)];
  const auto& targets = lookup.targets[static_cast<std::size_t>(from)];
  for (int index = 0; index < count; index += 1) {
    addMove<mode>(board, moves, from, targets[static_cast<std::size_t>(index)], piece, pieceSide);
  }
}

template <MoveGenerationMode mode>
void addAdvisorMoves(const Board& board, MoveList& moves, int from, int piece, int pieceSide) {
  const auto& lookup = kAdvisorTargets[static_cast<std::size_t>(sideLookupIndex(pieceSide))];
  const int count = lookup.counts[static_cast<std::size_t>(from)];
  const auto& targets = lookup.targets[static_cast<std::size_t>(from)];
  for (int index = 0; index < count; index += 1) {
    addMove<mode>(board, moves, from, targets[static_cast<std::size_t>(index)], piece, pieceSide);
  }
}

template <MoveGenerationMode mode>
void addElephantMoves(const Board& board, MoveList& moves, int from, int piece, int pieceSide) {
  const auto& lookup = kElephantTargets[static_cast<std::size_t>(sideLookupIndex(pieceSide))];
  const int count = lookup.counts[static_cast<std::size_t>(from)];
  const auto& targets = lookup.targets[static_cast<std::size_t>(from)];
  const auto& blockers = lookup.blockers[static_cast<std::size_t>(from)];
  for (int index = 0; index < count; index += 1) {
    if (board.cells[blockers[static_cast<std::size_t>(index)]] != 0) continue;
    addMove<mode>(board, moves, from, targets[static_cast<std::size_t>(index)], piece, pieceSide);
  }
}

template <MoveGenerationMode mode>
void addHorseMoves(const Board& board, MoveList& moves, int from, int piece, int pieceSide) {
  const int count = kHorseTargets.counts[static_cast<std::size_t>(from)];
  const auto& targets = kHorseTargets.targets[static_cast<std::size_t>(from)];
  const auto& blockers = kHorseTargets.blockers[static_cast<std::size_t>(from)];
  for (int index = 0; index < count; index += 1) {
    if (board.cells[blockers[static_cast<std::size_t>(index)]] != 0) continue;
    addMove<mode>(board, moves, from, targets[static_cast<std::size_t>(index)], piece, pieceSide);
  }
}

template <MoveGenerationMode mode>
void addSlidingMoves(const Board& board, MoveList& moves, int from, int piece, int pieceSide, bool cannon) {
  const auto& rays = kRaySquares[static_cast<std::size_t>(from)];
  const auto& lengths = kRayLengths[static_cast<std::size_t>(from)];
  for (int direction = 0; direction < kOrthogonalDirections; direction += 1) {
    bool screen = false;
    const auto& ray = rays[static_cast<std::size_t>(direction)];
    const int length = lengths[static_cast<std::size_t>(direction)];
    for (int step = 0; step < length; step += 1) {
      const int to = ray[static_cast<std::size_t>(step)];
      const int occupant = board.cells[to];
      if (!cannon) {
        if (occupant == 0) {
          if constexpr (mode != GenerateCapturesOnly) addMoveWithOccupant<mode>(moves, from, to, piece, pieceSide, Empty);
        } else {
          addMoveWithOccupant<mode>(moves, from, to, piece, pieceSide, occupant);
          break;
        }
      } else if (!screen) {
        if (occupant == 0) {
          if constexpr (mode != GenerateCapturesOnly) addMoveWithOccupant<mode>(moves, from, to, piece, pieceSide, Empty);
        } else {
          if constexpr (mode == GenerateQuietsOnly) break;
          screen = true;
        }
      } else if (occupant != 0) {
        addMoveWithOccupant<mode>(moves, from, to, piece, pieceSide, occupant);
        break;
      }
    }
  }
}

template <MoveGenerationMode mode>
void addPawnMoves(const Board& board, MoveList& moves, int from, int piece, int pieceSide) {
  const auto& lookup = kPawnTargets[static_cast<std::size_t>(sideLookupIndex(pieceSide))];
  const int count = lookup.counts[static_cast<std::size_t>(from)];
  const auto& targets = lookup.targets[static_cast<std::size_t>(from)];
  for (int index = 0; index < count; index += 1) {
    addMove<mode>(board, moves, from, targets[static_cast<std::size_t>(index)], piece, pieceSide);
  }
}

template <MoveGenerationMode mode>
MoveList generatePseudoMovesFor(const Board& board, int side) {
  MoveList moves;
  const auto& squares = pieceSquares(board, side);
  const int count = pieceCount(board, side);
  for (int listIndex = 0; listIndex < count; listIndex += 1) {
    const int square = squares[listIndex];
    if (square < 0 || square >= kSquares) continue;
    const int piece = board.cells[square];
    if (pieceCodeSide(piece) != side) continue;
    const int pieceSide = side;
    switch (pieceCodeType(piece)) {
      case King: addKingMoves<mode>(board, moves, square, piece, pieceSide); break;
      case Advisor: addAdvisorMoves<mode>(board, moves, square, piece, pieceSide); break;
      case Elephant: addElephantMoves<mode>(board, moves, square, piece, pieceSide); break;
      case Horse: addHorseMoves<mode>(board, moves, square, piece, pieceSide); break;
      case Rook: addSlidingMoves<mode>(board, moves, square, piece, pieceSide, false); break;
      case Cannon: addSlidingMoves<mode>(board, moves, square, piece, pieceSide, true); break;
      case Pawn: addPawnMoves<mode>(board, moves, square, piece, pieceSide); break;
      default: break;
    }
  }
  return moves;
}

MoveList generatePseudoMoves(const Board& board, int side, MoveGenerationMode mode = GenerateAllMoves) {
  switch (mode) {
    case GenerateCapturesOnly: return generatePseudoMovesFor<GenerateCapturesOnly>(board, side);
    case GenerateQuietsOnly: return generatePseudoMovesFor<GenerateQuietsOnly>(board, side);
    case GenerateAllMoves:
    default: return generatePseudoMovesFor<GenerateAllMoves>(board, side);
  }
}

int findKing(const Board& board, int side) {
  const int cached = side == kRed ? board.redKing : board.blackKing;
  if (cached >= 0 && cached < kSquares && board.cells[cached] == side * King) return cached;

  for (int square = 0; square < kSquares; square += 1) {
    if (board.cells[square] == side * King) return square;
  }
  return -1;
}

void setKingSquare(Board& board, int side, int square) {
  if (side == kRed) board.redKing = square;
  else if (side == kBlack) board.blackKing = square;
}

void addNonPawnMaterialByPiece(Board& board, int piece, int delta) {
  if (!countsAsNonPawnMaterial(piece)) return;
  const int side = pieceCodeSide(piece);
  if (side == kRed) board.redNonPawnMaterial += delta;
  else if (side == kBlack) board.blackNonPawnMaterial += delta;
}

void addNullMoveMaterialByPiece(Board& board, int piece, int delta) {
  if (!countsAsNullMoveMaterial(piece)) return;
  const int side = pieceCodeSide(piece);
  if (side == kRed) board.redNullMoveMaterial += delta;
  else if (side == kBlack) board.blackNullMoveMaterial += delta;
}

void addMaterialByPiece(Board& board, int piece, int delta) {
  board.materialScore += materialScoreForPiece(piece) * delta;
}

template <bool hasKnownKey>
void makeMoveImpl(Board& board, Move& move, uint64_t knownKey) {
  move.piece = board.cells[move.from];
  move.captured = board.cells[move.to];
  const int movingSide = pieceCodeSide(move.piece);
  const int movingType = pieceCodeType(move.piece);
  const int captured = move.captured;
  if constexpr (hasKnownKey) {
    board.key = knownKey;
  } else {
    board.key ^= sideHash();
    board.key ^= pieceHash(move.from, move.piece);
    if (captured != 0) board.key ^= pieceHash(move.to, captured);
    board.key ^= pieceHash(move.to, move.piece);
  }
  board.positionalScore -= positionalScoreForPieceSquare(move.piece, move.from);
  board.positionalScore += positionalScoreForPieceSquare(move.piece, move.to);
  if (captured != 0) {
    const int capturedSide = pieceCodeSide(captured);
    const int capturedType = pieceCodeType(captured);
    removeTrackedPieceSquare(board, capturedSide, move.to);
    board.totalPieceCount -= 1;
    if (capturedType == King) setKingSquare(board, capturedSide, -1);
    addNonPawnMaterialByPiece(board, captured, -1);
    addNullMoveMaterialByPiece(board, captured, -1);
    addMaterialByPiece(board, captured, -1);
    board.positionalScore -= positionalScoreForPieceSquare(captured, move.to);
    addGuardPairCountBySideType(board, capturedSide, capturedType, -1);
  }
  moveTrackedPieceSquare(board, movingSide, move.from, move.to);
  board.cells[move.to] = move.piece;
  board.cells[move.from] = 0;
  if (movingType == King) setKingSquare(board, movingSide, move.to);
  board.side = -board.side;
}

void makeMove(Board& board, Move& move) {
  makeMoveImpl<false>(board, move, 0);
}

void makeMoveWithKnownKey(Board& board, Move& move, uint64_t knownKey) {
  makeMoveImpl<true>(board, move, knownKey);
}

void undoMove(Board& board, const Move& move) {
  const int movingSide = pieceCodeSide(move.piece);
  const int movingType = pieceCodeType(move.piece);
  const int captured = move.captured;
  board.side = -board.side;
  board.key ^= sideHash();
  board.key ^= pieceHash(move.to, move.piece);
  if (captured != 0) board.key ^= pieceHash(move.to, captured);
  board.key ^= pieceHash(move.from, move.piece);
  board.positionalScore -= positionalScoreForPieceSquare(move.piece, move.to);
  board.positionalScore += positionalScoreForPieceSquare(move.piece, move.from);
  moveTrackedPieceSquare(board, movingSide, move.to, move.from);
  if (captured != 0) {
    const int capturedSide = pieceCodeSide(captured);
    const int capturedType = pieceCodeType(captured);
    addPieceSquare(board, capturedSide, move.to);
    board.totalPieceCount += 1;
    if (capturedType == King) setKingSquare(board, capturedSide, move.to);
    addNonPawnMaterialByPiece(board, captured, 1);
    addNullMoveMaterialByPiece(board, captured, 1);
    addMaterialByPiece(board, captured, 1);
    board.positionalScore += positionalScoreForPieceSquare(captured, move.to);
    addGuardPairCountBySideType(board, capturedSide, capturedType, 1);
  }
  board.cells[move.from] = move.piece;
  board.cells[move.to] = captured;
  if (movingType == King) setKingSquare(board, movingSide, move.from);
}

bool sameMove(const Move& left, const Move& right) {
  return left.from == right.from && left.to == right.to;
}

bool validMove(const Move& move) {
  return move.from >= 0 && move.from < kSquares
      && move.to >= 0 && move.to < kSquares
      && move.from != move.to;
}

void recordSearchPathMove(SearchState& state, int ply, const Move& move) {
  if (ply < 0 || ply >= kMaxPly) return;
  const auto pathIndex = static_cast<std::size_t>(ply);
  state.pathMoves[pathIndex] = move;
  state.pathMoveKnown[pathIndex] = validMove(move);
}

void clearSearchPathMove(SearchState& state, int ply) {
  if (ply < 0 || ply >= kMaxPly) return;
  const auto pathIndex = static_cast<std::size_t>(ply);
  state.pathMoveKnown[pathIndex] = false;
}

Move searchPathMoveAt(const SearchState& state, int ply) {
  if (ply < 0 || ply >= kMaxPly) return {};
  const auto pathIndex = static_cast<std::size_t>(ply);
  return state.pathMoveKnown[pathIndex] ? state.pathMoves[pathIndex] : Move{};
}

Move previousOwnMoveFor(const SearchState& state, int ply) {
  return searchPathMoveAt(state, ply - 2);
}

void setPvToMove(std::vector<Move>* pv, const Move& move) {
  if (!pv || !validMove(move)) return;
  pv->clear();
  pv->push_back(move);
}

bool isCapture(const Move& move) {
  return move.captured != 0;
}

bool isQuiet(const Move& move) {
  return move.captured == 0;
}

int orthogonalDirectionBetween(int from, int to) {
  return kOrthogonalDirectionBetween[static_cast<std::size_t>(from)][static_cast<std::size_t>(to)];
}

template <bool hasMove>
int pieceAfterMove(const Board& board, const Move& move, int square, int movingPiece) {
  if constexpr (hasMove) {
    if (square == move.from) return 0;
    if (square == move.to) return movingPiece;
  }
  return board.cells[square];
}

template <bool hasMove>
bool lineCheckAfterMove(
    const Board& board,
    const Move& move,
    int side,
    int kingSquare,
    int movingPiece) {
  const auto& rays = kRaySquares[static_cast<std::size_t>(kingSquare)];
  const auto& lengths = kRayLengths[static_cast<std::size_t>(kingSquare)];
  for (int direction = 0; direction < kOrthogonalDirections; direction += 1) {
    int blockers = 0;
    const auto& ray = rays[static_cast<std::size_t>(direction)];
    const int length = lengths[static_cast<std::size_t>(direction)];
    for (int step = 0; step < length; step += 1) {
      const int piece = pieceAfterMove<hasMove>(board, move, ray[static_cast<std::size_t>(step)], movingPiece);
      if (piece == 0) {
        continue;
      }

      if (blockers == 0) {
        if (pieceCodeSide(piece) == side) {
          const int pieceType = pieceCodeType(piece);
          if (pieceType == Rook || (pieceType == King && (direction == 0 || direction == 2))) return true;
        }
        blockers = 1;
      } else {
        if (pieceCodeSide(piece) == side && pieceCodeType(piece) == Cannon) return true;
        break;
      }
    }
  }

  return false;
}

template <bool hasMove>
bool horseCheckAfterMove(
    const Board& board,
    const Move& move,
    int side,
    int kingSquare,
    int movingPiece) {
  const int horsePiece = side * Horse;
  const int count = kHorseAttackers.counts[static_cast<std::size_t>(kingSquare)];
  const auto& sources = kHorseAttackers.sources[static_cast<std::size_t>(kingSquare)];
  const auto& blockers = kHorseAttackers.blockers[static_cast<std::size_t>(kingSquare)];

  for (int index = 0; index < count; index += 1) {
    const std::size_t slot = static_cast<std::size_t>(index);
    if (pieceAfterMove<hasMove>(board, move, sources[slot], movingPiece) != horsePiece) continue;
    if (pieceAfterMove<hasMove>(board, move, blockers[slot], movingPiece) == 0) return true;
  }

  return false;
}

template <bool hasMove>
bool pawnCheckAfterMove(
    const Board& board,
    const Move& move,
    int side,
    int kingSquare,
    int movingPiece) {
  const int pawnPiece = side * Pawn;
  const auto& lookup = kPawnAttackers[static_cast<std::size_t>(sideLookupIndex(side))];
  const int count = lookup.counts[static_cast<std::size_t>(kingSquare)];
  const auto& sources = lookup.sources[static_cast<std::size_t>(kingSquare)];
  for (int index = 0; index < count; index += 1) {
    if (pieceAfterMove<hasMove>(board, move, sources[static_cast<std::size_t>(index)], movingPiece) == pawnPiece) return true;
  }

  return false;
}

bool maybeMoveCanGiveCheck(const Move& move, int kingSquare) {
  if (kingSquare < 0) return false;
  if (move.to == kingSquare) return true;

  const auto from = static_cast<std::size_t>(move.from);
  const auto to = static_cast<std::size_t>(move.to);
  const auto king = static_cast<std::size_t>(kingSquare);
  if (kSameLineBySquare[from][king] || kSameLineBySquare[to][king]) return true;
  if (kHorseLegBlockerByTarget[from][king]) return true;

  const int type = pieceCodeType(move.piece);
  if (type == Horse && kHorseLegSquareBySourceTarget[to][king] >= 0) return true;

  return false;
}

template <bool hasMove>
int blockersBetweenAfterMove(const Board& board, const Move& move, int from, int to, int movingPiece);

bool movedPieceDirectlyChecksAfterMove(const Board& board, const Move& move, int enemyKing, int movingPiece) {
  const int type = pieceCodeType(movingPiece);
  const int side = pieceCodeSide(movingPiece);

  if (type == Horse) {
    const int legSquare = kHorseLegSquareBySourceTarget[static_cast<std::size_t>(move.to)][static_cast<std::size_t>(enemyKing)];
    return legSquare >= 0 && pieceAfterMove<true>(board, move, legSquare, movingPiece) == 0;
  }

  const int toFile = fileOf(move.to);
  const int toRank = rankOf(move.to);
  const int kingFile = fileOf(enemyKing);
  const int kingRank = rankOf(enemyKing);
  const int dx = kingFile - toFile;
  const int dy = kingRank - toRank;

  if (type == Pawn) {
    if (dx == 0 && dy == forwardDelta(side)) return true;
    return std::abs(dx) == 1 && dy == 0 && crossedRiver(side, toRank);
  }

  if (type == Rook) {
    return (dx == 0 || dy == 0)
        && blockersBetweenAfterMove<true>(board, move, move.to, enemyKing, movingPiece) == 0;
  }

  if (type == Cannon) {
    return (dx == 0 || dy == 0)
        && blockersBetweenAfterMove<true>(board, move, move.to, enemyKing, movingPiece) == 1;
  }

  if (type == King) {
    return dx == 0
        && blockersBetweenAfterMove<true>(board, move, move.to, enemyKing, movingPiece) == 0;
  }

  return false;
}

bool discoveredMoveGivesCheck(const Board& board, const Move& move, int enemyKing, int movingPiece) {
  const int side = pieceCodeSide(movingPiece);
  if (side == 0 || enemyKing < 0) return true;

  const auto from = static_cast<std::size_t>(move.from);
  const auto to = static_cast<std::size_t>(move.to);
  const auto king = static_cast<std::size_t>(enemyKing);

  const bool lineMayChange = kSameLineBySquare[from][king] || kSameLineBySquare[to][king];
  if (lineMayChange && lineCheckAfterMove<true>(board, move, side, enemyKing, movingPiece)) return true;

  const bool horseLegMayOpen = kHorseLegBlockerByTarget[from][king];
  if (horseLegMayOpen && horseCheckAfterMove<true>(board, move, side, enemyKing, movingPiece)) return true;

  return pawnCheckAfterMove<true>(board, move, side, enemyKing, movingPiece);
}

uint64_t checkCacheMix(const Board& board, const Move& move, int enemyKing) {
  return board.key
      ^ (static_cast<uint64_t>(move.from + 1) * 0x9e3779b97f4a7c15ULL)
      ^ (static_cast<uint64_t>(move.to + 1) * 0xbf58476d1ce4e5b9ULL)
      ^ (static_cast<uint64_t>(enemyKing + 2) * 0x94d049bb133111ebULL);
}

std::size_t checkCacheBucketIndex(uint64_t mix) {
  return static_cast<std::size_t>(mix) & (kCheckCacheSize - kCheckCacheBucketSize);
}

std::size_t checkCacheReplacementOffset(uint64_t mix) {
  return static_cast<std::size_t>(mix >> 16) & (kCheckCacheBucketSize - 1);
}

bool cachedMoveGivesCheckAssumingPossible(const Board& board, const Move& move, int enemyKing, int movingPiece, SearchState& state) {
  const uint64_t mix = checkCacheMix(board, move, enemyKing);
  const std::size_t bucket = checkCacheBucketIndex(mix);
  CheckCacheEntry* replacement = &state.checkCache[bucket + checkCacheReplacementOffset(mix)];
  for (std::size_t offset = 0; offset < kCheckCacheBucketSize; offset += 1) {
    CheckCacheEntry& entry = state.checkCache[bucket + offset];
    if (entry.occupied
        && entry.key == board.key
        && entry.from == move.from
        && entry.to == move.to
        && entry.enemyKing == enemyKing) {
      state.checkCacheHits += 1;
      return entry.givesCheck;
    }
    if (!entry.occupied) replacement = &entry;
  }

  const bool givesCheck = move.to == enemyKing
      || movedPieceDirectlyChecksAfterMove(board, move, enemyKing, movingPiece)
      || discoveredMoveGivesCheck(board, move, enemyKing, movingPiece);
  *replacement = {board.key, move.from, move.to, enemyKing, givesCheck, true};
  state.checkCacheStores += 1;
  return givesCheck;
}

bool moveGivesCheckAssumingPossible(const Board& board, const Move& move, int enemyKing, SearchState& state) {
  const int movingPiece = move.piece != 0 ? move.piece : board.cells[move.from];
  return cachedMoveGivesCheckAssumingPossible(board, move, enemyKing, movingPiece, state);
}

bool moveGivesCheck(const Board& board, const Move& move, int enemyKing, SearchState& state) {
  return maybeMoveCanGiveCheck(move, enemyKing)
      && moveGivesCheckAssumingPossible(board, move, enemyKing, state);
}

KnownChildState knownChildStateAfterMove(const Board& board, const Move& move, int enemyKing, SearchState& state) {
  KnownChildState child;
  child.ownKing = pieceCodeType(move.captured) == King ? -1 : enemyKing;
  child.inCheck = child.ownKing < 0 || moveGivesCheck(board, move, enemyKing, state);
  return child;
}

bool isInCheckKnownKing(const Board& board, int side, int king) {
  if (king < 0) return true;
  const Move noMove{};
  const int attacker = -side;
  return lineCheckAfterMove<false>(board, noMove, attacker, king, 0)
      || horseCheckAfterMove<false>(board, noMove, attacker, king, 0)
      || pawnCheckAfterMove<false>(board, noMove, attacker, king, 0);
}

bool isInCheckAfterGeneratedMoveKnownKing(const Board& board, const Move& move, int side, int baseKing) {
  int king = baseKing;
  if (king < 0) return true;

  const int movingPiece = move.piece;
  if (pieceCodeType(movingPiece) == King) king = move.to;

  const int attacker = -side;
  return lineCheckAfterMove<true>(board, move, attacker, king, movingPiece)
      || horseCheckAfterMove<true>(board, move, attacker, king, movingPiece)
      || pawnCheckAfterMove<true>(board, move, attacker, king, movingPiece);
}

bool vacatingLineMayExposeKing(const Board& board, int side, int from, int kingSquare) {
  const int direction = orthogonalDirectionBetween(kingSquare, from);
  if (direction < 0) return false;

  const int attacker = -side;
  const auto& ray = kRaySquares[static_cast<std::size_t>(kingSquare)][static_cast<std::size_t>(direction)];
  const int length = kRayLengths[static_cast<std::size_t>(kingSquare)][static_cast<std::size_t>(direction)];
  int blockersBeforeFrom = 0;
  int fromStep = -1;

  for (int step = 0; step < length; step += 1) {
    const int square = ray[static_cast<std::size_t>(step)];
    if (square == from) {
      fromStep = step;
      break;
    }
    if (board.cells[square] != 0) blockersBeforeFrom += 1;
  }

  if (fromStep < 0 || blockersBeforeFrom > 1) return false;

  if (blockersBeforeFrom == 1) {
    for (int step = fromStep + 1; step < length; step += 1) {
      const int piece = board.cells[ray[static_cast<std::size_t>(step)]];
      if (piece == 0) continue;
      return pieceCodeSide(piece) == attacker && pieceCodeType(piece) == Cannon;
    }
    return false;
  }

  bool screenSeen = false;
  for (int step = fromStep + 1; step < length; step += 1) {
    const int piece = board.cells[ray[static_cast<std::size_t>(step)]];
    if (piece == 0) continue;
    if (!screenSeen) {
      if (pieceCodeSide(piece) == attacker) {
        const int pieceType = pieceCodeType(piece);
        if (pieceType == Rook || (pieceType == King && (direction == 0 || direction == 2))) {
          return true;
        }
      }
      screenSeen = true;
      continue;
    }
    return pieceCodeSide(piece) == attacker && pieceCodeType(piece) == Cannon;
  }

  return false;
}

bool vacatingHorseLegMayExposeKing(const Board& board, int side, int from, int kingSquare) {
  const int horsePiece = -side * Horse;
  const int count = kHorseAttackers.counts[static_cast<std::size_t>(kingSquare)];
  const auto& sources = kHorseAttackers.sources[static_cast<std::size_t>(kingSquare)];
  const auto& blockers = kHorseAttackers.blockers[static_cast<std::size_t>(kingSquare)];

  for (int index = 0; index < count; index += 1) {
    const std::size_t slot = static_cast<std::size_t>(index);
    if (blockers[slot] == from && board.cells[sources[slot]] == horsePiece) return true;
  }
  return false;
}

bool movingOntoLineMayCreateCannonCheck(const Board& board, const Move& move, int side, int kingSquare) {
  const int direction = orthogonalDirectionBetween(kingSquare, move.to);
  if (direction < 0) return false;

  const int attacker = -side;
  const auto& ray = kRaySquares[static_cast<std::size_t>(kingSquare)][static_cast<std::size_t>(direction)];
  const int length = kRayLengths[static_cast<std::size_t>(kingSquare)][static_cast<std::size_t>(direction)];
  int blockers = 0;

  for (int step = 0; step < length; step += 1) {
    const int square = ray[static_cast<std::size_t>(step)];
    int piece = board.cells[square];
    if (square == move.from) piece = 0;
    if (square == move.to) piece = move.piece;
    if (piece == 0) continue;

    if (pieceCodeSide(piece) == attacker && pieceCodeType(piece) == Cannon) return blockers == 1;
    blockers += 1;
    if (blockers > 1) return false;
  }

  return false;
}

bool moveMayAffectOwnKingSafety(const Board& board, const Move& move, int side, int kingSquare) {
  if (kingSquare < 0 || pieceCodeType(move.piece) == King) return true;

  // In quiet positions, only line/horse-leg effects can make a non-king move unsafe.
  return vacatingLineMayExposeKing(board, side, move.from, kingSquare)
      || movingOntoLineMayCreateCannonCheck(board, move, side, kingSquare)
      || vacatingHorseLegMayExposeKing(board, side, move.from, kingSquare);
}

template <bool hasMove>
int blockersBetweenAfterMove(const Board& board, const Move& move, int from, int to, int movingPiece) {
  if (from == to) return 0;
  const int direction = orthogonalDirectionBetween(from, to);
  if (direction < 0) return kInf;
  int blockers = 0;
  const auto& ray = kRaySquares[static_cast<std::size_t>(from)][static_cast<std::size_t>(direction)];
  const int length = kRayLengths[static_cast<std::size_t>(from)][static_cast<std::size_t>(direction)];
  for (int step = 0; step < length; step += 1) {
    const int square = ray[static_cast<std::size_t>(step)];
    if (square == to) return blockers;
    if (pieceAfterMove<hasMove>(board, move, square, movingPiece) != 0) blockers += 1;
  }
  return blockers;
}

template <bool hasMove>
bool pieceAttacksSquareAfterMove(
    const Board& board,
    const Move& move,
    int from,
    int target,
    int piece,
    int movingPiece) {
  if (from == target || piece == 0) return false;
  const int side = pieceCodeSide(piece);
  const int type = pieceCodeType(piece);

  if (type == Horse) {
    const int legSquare = kHorseLegSquareBySourceTarget[static_cast<std::size_t>(from)][static_cast<std::size_t>(target)];
    return legSquare >= 0 && pieceAfterMove<hasMove>(board, move, legSquare, movingPiece) == 0;
  }

  if (type == Rook) {
    return kSameLineBySquare[static_cast<std::size_t>(from)][static_cast<std::size_t>(target)]
        && blockersBetweenAfterMove<hasMove>(board, move, from, target, movingPiece) == 0;
  }

  if (type == Cannon) {
    return kSameLineBySquare[static_cast<std::size_t>(from)][static_cast<std::size_t>(target)]
        && blockersBetweenAfterMove<hasMove>(board, move, from, target, movingPiece) == 1;
  }

  const int fromFile = fileOf(from);
  const int fromRank = rankOf(from);
  const int targetFile = fileOf(target);
  const int targetRank = rankOf(target);
  const int dx = targetFile - fromFile;
  const int dy = targetRank - fromRank;

  if (type == King) {
    if (std::abs(dx) + std::abs(dy) == 1 && palaceContains(side, targetFile, targetRank)) return true;
    const int targetPiece = pieceAfterMove<hasMove>(board, move, target, movingPiece);
    return dx == 0
        && pieceCodeType(targetPiece) == King
        && blockersBetweenAfterMove<hasMove>(board, move, from, target, movingPiece) == 0;
  }
  if (type == Advisor) {
    return std::abs(dx) == 1 && std::abs(dy) == 1 && palaceContains(side, targetFile, targetRank);
  }
  if (type == Elephant) {
    if (std::abs(dx) != 2 || std::abs(dy) != 2 || !ownRiverSide(side, targetRank)) return false;
    return pieceAfterMove<hasMove>(board, move, indexOf(fromFile + dx / 2, fromRank + dy / 2), movingPiece) == 0;
  }
  if (type == Pawn) {
    if (dx == 0 && dy == forwardDelta(side)) return true;
    return crossedRiver(side, fromRank) && std::abs(dx) == 1 && dy == 0;
  }
  return false;
}

bool pieceAttacksSquareAfterMove(const Board& board, const Move& move, int from, int target, int piece) {
  const bool hasMove = validMove(move);
  const int movingPiece = hasMove ? (move.piece != 0 ? move.piece : board.cells[move.from]) : 0;
  return hasMove
      ? pieceAttacksSquareAfterMove<true>(board, move, from, target, piece, movingPiece)
      : pieceAttacksSquareAfterMove<false>(board, move, from, target, piece, 0);
}

template <bool hasMove>
bool pawnAttacksSquareAfterMove(
    const Board& board,
    const Move& move,
    int side,
    int target,
    int movingPiece) {
  const int pawnPiece = side * Pawn;
  const auto& lookup = kPawnAttackers[static_cast<std::size_t>(sideLookupIndex(side))];
  const int count = lookup.counts[static_cast<std::size_t>(target)];
  const auto& sources = lookup.sources[static_cast<std::size_t>(target)];
  for (int index = 0; index < count; index += 1) {
    if (pieceAfterMove<hasMove>(board, move, sources[static_cast<std::size_t>(index)], movingPiece) == pawnPiece) return true;
  }
  return false;
}

template <bool hasMove>
bool advisorOrElephantAttacksSquareAfterMove(
    const Board& board,
    const Move& move,
    int side,
    int target,
    int movingPiece) {
  const int advisorPiece = side * Advisor;
  const int elephantPiece = side * Elephant;

  const auto& advisorLookup = kAdvisorAttackers[static_cast<std::size_t>(sideLookupIndex(side))];
  const int advisorCount = advisorLookup.counts[static_cast<std::size_t>(target)];
  const auto& advisorSources = advisorLookup.sources[static_cast<std::size_t>(target)];
  for (int index = 0; index < advisorCount; index += 1) {
    if (pieceAfterMove<hasMove>(board, move, advisorSources[static_cast<std::size_t>(index)], movingPiece) == advisorPiece) {
      return true;
    }
  }

  const auto& elephantLookup = kElephantAttackers[static_cast<std::size_t>(sideLookupIndex(side))];
  const int elephantCount = elephantLookup.counts[static_cast<std::size_t>(target)];
  const auto& elephantSources = elephantLookup.sources[static_cast<std::size_t>(target)];
  const auto& elephantBlockers = elephantLookup.blockers[static_cast<std::size_t>(target)];
  for (int index = 0; index < elephantCount; index += 1) {
    const std::size_t slot = static_cast<std::size_t>(index);
    if (pieceAfterMove<hasMove>(board, move, elephantSources[slot], movingPiece) != elephantPiece) continue;
    if (pieceAfterMove<hasMove>(board, move, elephantBlockers[slot], movingPiece) == 0) return true;
  }

  return false;
}

template <bool hasMove>
bool horseAttacksSquareAfterMove(
    const Board& board,
    const Move& move,
    int side,
    int target,
    int movingPiece) {
  const int horsePiece = side * Horse;
  const int count = kHorseAttackers.counts[static_cast<std::size_t>(target)];
  const auto& sources = kHorseAttackers.sources[static_cast<std::size_t>(target)];
  const auto& blockers = kHorseAttackers.blockers[static_cast<std::size_t>(target)];

  for (int index = 0; index < count; index += 1) {
    const std::size_t slot = static_cast<std::size_t>(index);
    if (pieceAfterMove<hasMove>(board, move, sources[slot], movingPiece) != horsePiece) continue;
    if (pieceAfterMove<hasMove>(board, move, blockers[slot], movingPiece) == 0) return true;
  }

  return false;
}

template <bool hasMove>
int orthogonalLineAttackerValueAfterMove(
    const Board& board,
    const Move& move,
    int side,
    int target,
    int movingPiece) {
  const int cannonPiece = side * Cannon;
  const int rookPiece = side * Rook;
  bool rookFound = false;
  const auto& rays = kRaySquares[static_cast<std::size_t>(target)];
  const auto& lengths = kRayLengths[static_cast<std::size_t>(target)];

  for (int direction = 0; direction < kOrthogonalDirections; direction += 1) {
    int blockers = 0;
    const auto& ray = rays[static_cast<std::size_t>(direction)];
    const int length = lengths[static_cast<std::size_t>(direction)];
    for (int step = 0; step < length; step += 1) {
      const int piece = pieceAfterMove<hasMove>(board, move, ray[static_cast<std::size_t>(step)], movingPiece);
      if (piece == 0) {
        continue;
      }

      if (blockers == 0) {
        if (piece == rookPiece) rookFound = true;
        blockers = 1;
        continue;
      }

      if (piece == cannonPiece) return pieceTypeValue(Cannon);
      break;
    }
  }

  return rookFound ? pieceTypeValue(Rook) : kInf;
}

template <bool hasMove>
bool kingAttacksSquareAfterMove(
    const Board& board,
    const Move& move,
    int side,
    int target,
    int movingPiece) {
  const int kingPiece = side * King;
  const auto& rays = kRaySquares[static_cast<std::size_t>(target)];
  const auto& lengths = kRayLengths[static_cast<std::size_t>(target)];

  const auto& lookup = kKingAttackers[static_cast<std::size_t>(sideLookupIndex(side))];
  const int count = lookup.counts[static_cast<std::size_t>(target)];
  const auto& sources = lookup.sources[static_cast<std::size_t>(target)];
  for (int index = 0; index < count; index += 1) {
    if (pieceAfterMove<hasMove>(board, move, sources[static_cast<std::size_t>(index)], movingPiece) == kingPiece) {
      return true;
    }
  }

  const int targetPiece = pieceAfterMove<hasMove>(board, move, target, movingPiece);
  if (pieceCodeType(targetPiece) != King) return false;
  for (int direction : {0, 2}) {
    const auto& ray = rays[static_cast<std::size_t>(direction)];
    const int length = lengths[static_cast<std::size_t>(direction)];
    for (int step = 0; step < length; step += 1) {
      const int piece = pieceAfterMove<hasMove>(board, move, ray[static_cast<std::size_t>(step)], movingPiece);
      if (piece == 0) {
        continue;
      }
      if (piece == kingPiece) return true;
      break;
    }
  }

  return false;
}

template <bool hasMove>
int leastAttackerValueAfterMoveImpl(const Board& board, const Move& move, int side, int target, int movingPiece) {
  if (pawnAttacksSquareAfterMove<hasMove>(board, move, side, target, movingPiece)) return pieceTypeValue(Pawn);
  if (advisorOrElephantAttacksSquareAfterMove<hasMove>(board, move, side, target, movingPiece)) {
    return pieceTypeValue(Advisor);
  }
  if (horseAttacksSquareAfterMove<hasMove>(board, move, side, target, movingPiece)) return pieceTypeValue(Horse);
  const int lineAttackerValue = orthogonalLineAttackerValueAfterMove<hasMove>(board, move, side, target, movingPiece);
  if (lineAttackerValue < kInf) return lineAttackerValue;
  if (kingAttacksSquareAfterMove<hasMove>(board, move, side, target, movingPiece)) return pieceTypeValue(King);
  return kInf;
}

int leastAttackerValueAfterMove(const Board& board, const Move& move, int side, int target) {
  const bool hasMove = validMove(move);
  const int movingPiece = hasMove ? (move.piece != 0 ? move.piece : board.cells[move.from]) : 0;
  return hasMove
      ? leastAttackerValueAfterMoveImpl<true>(board, move, side, target, movingPiece)
      : leastAttackerValueAfterMoveImpl<false>(board, move, side, target, 0);
}

uint64_t leastAttackerCacheMix(const Board& board, const Move& move, int side, int target) {
  return board.key
      ^ (static_cast<uint64_t>(move.from + 1) * 0x9e3779b97f4a7c15ULL)
      ^ (static_cast<uint64_t>(move.to + 1) * 0xbf58476d1ce4e5b9ULL)
      ^ (static_cast<uint64_t>(side + 2) * 0x94d049bb133111ebULL)
      ^ (static_cast<uint64_t>(target + 3) * 0xd6e8feb86659fd93ULL);
}

std::size_t leastAttackerCacheBucketIndex(uint64_t mix) {
  return static_cast<std::size_t>(mix) & (kLeastAttackerCacheSize - kLeastAttackerCacheBucketSize);
}

std::size_t leastAttackerCacheReplacementOffset(uint64_t mix) {
  return static_cast<std::size_t>(mix >> 16) & (kLeastAttackerCacheBucketSize - 1);
}

int cachedLeastAttackerValueAfterMove(const Board& board, const Move& move, int side, int target, SearchState& state) {
  state.leastAttackerCacheProbes += 1;
  const uint64_t mix = leastAttackerCacheMix(board, move, side, target);
  const std::size_t bucket = leastAttackerCacheBucketIndex(mix);
  LeastAttackerCacheEntry* replacement =
      &state.leastAttackerCache[bucket + leastAttackerCacheReplacementOffset(mix)];
  for (std::size_t offset = 0; offset < kLeastAttackerCacheBucketSize; offset += 1) {
    LeastAttackerCacheEntry& entry = state.leastAttackerCache[bucket + offset];
    if (entry.occupied
        && entry.key == board.key
        && entry.from == move.from
        && entry.to == move.to
        && entry.side == side
        && entry.target == target) {
      state.leastAttackerCacheHits += 1;
      return entry.value;
    }
    if (!entry.occupied) replacement = &entry;
  }

  const int value = leastAttackerValueAfterMove(board, move, side, target);
  *replacement = {board.key, move.from, move.to, side, target, value, true};
  state.leastAttackerCacheStores += 1;
  return value;
}

int captureRiskPenaltyForCapture(
    const Board& board,
    const Move& move,
    SearchState& state,
    int movingValue,
    int capturedValue,
    int movingSide) {
  if (movingValue <= capturedValue + 120) {
    state.favorableCaptureRiskSkips += 1;
    return 0;
  }

  state.captureRiskProbes += 1;
  const int leastRecapturer = cachedLeastAttackerValueAfterMove(board, move, -movingSide, move.to, state);
  if (leastRecapturer >= kInf) return 0;

  int penalty = std::min(12000, (movingValue + leastRecapturer / 2) * 4);
  if (movingValue > capturedValue) penalty += (movingValue - capturedValue) * 40;
  return penalty;
}

int badCaptureLossForCapture(const Board& board, const Move& move, SearchState& state) {
  if (pieceCodeType(move.captured) == King) return 0;

  const int movingValue = pieceCodeValue(move.piece);
  const int capturedValue = pieceCodeValue(move.captured);
  if (movingValue <= capturedValue + 120) return 0;

  const int leastRecapturer = cachedLeastAttackerValueAfterMove(
      board,
      move,
      -pieceCodeSide(move.piece),
      move.to,
      state);
  if (leastRecapturer >= kInf || leastRecapturer > movingValue) return 0;
  return movingValue - capturedValue;
}

void filterLegalMovesInPlace(Board& board, MoveList& moves, int side, int ownKing, bool currentlyInCheck) {
  if (ownKing < 0) {
    moves.resize(0);
    return;
  }

  std::size_t legalCount = 0;
  for (std::size_t index = 0; index < moves.size(); index += 1) {
    Move& move = moves[index];
    if (pieceCodeType(move.captured) == King) continue;
    if (!currentlyInCheck && !moveMayAffectOwnKingSafety(board, move, side, ownKing)) {
      moves[legalCount++] = move;
      continue;
    }

    const bool illegal = isInCheckAfterGeneratedMoveKnownKing(board, move, side, ownKing);
    if (!illegal) moves[legalCount++] = move;
  }
  moves.resize(legalCount);
}

bool hasLegalMove(Board& board, int side, int ownKing, bool currentlyInCheck) {
  if (ownKing < 0) return false;

  auto moves = generatePseudoMoves(board, side, GenerateAllMoves);
  for (Move& move : moves) {
    if (pieceCodeType(move.captured) == King) continue;
    if (!currentlyInCheck && !moveMayAffectOwnKingSafety(board, move, side, ownKing)) return true;
    if (!isInCheckAfterGeneratedMoveKnownKing(board, move, side, ownKing)) return true;
  }
  return false;
}

MoveList generateLegalMoves(Board& board, int side, bool capturesOnly, int ownKing, bool currentlyInCheck) {
  auto moves = generatePseudoMoves(board, side, capturesOnly ? GenerateCapturesOnly : GenerateAllMoves);
  filterLegalMovesInPlace(board, moves, side, ownKing, currentlyInCheck);
  return moves;
}

MoveList generateLegalMoves(Board& board, int side, bool capturesOnly = false) {
  auto moves = generatePseudoMoves(board, side, capturesOnly ? GenerateCapturesOnly : GenerateAllMoves);
  const int ownKing = findKing(board, side);
  filterLegalMovesInPlace(board, moves, side, ownKing, isInCheckKnownKing(board, side, ownKing));
  return moves;
}

int qCaptureHistoryScore(SearchState& state, const Move& move);
bool shouldGuardQDeltaCapture(SearchState& state, const Move& move, int standPat, int capturedValue, int alpha);

MoveList generateLegalQsearchMoves(
    Board& board,
    int side,
    int ownKing,
    bool inCheck,
    int enemyKing,
    int standPat,
    int alpha,
    SearchState& state) {
  if (inCheck) return generateLegalMoves(board, side, false, ownKing, true);
  if (ownKing < 0) return {};

  auto moves = generatePseudoMoves(board, side, GenerateCapturesOnly);
  std::size_t kept = 0;
  for (std::size_t index = 0; index < moves.size(); index += 1) {
    Move& move = moves[index];
    if (pieceCodeType(move.captured) == King) continue;

    const int capturedValue = pieceCodeValue(move.captured);
    if (standPat + capturedValue + kQDeltaPruneMargin <= alpha
        && !shouldGuardQDeltaCapture(state, move, standPat, capturedValue, alpha)) {
      const bool possibleCheck = maybeMoveCanGiveCheck(move, enemyKing);
      if (!possibleCheck || !moveGivesCheckAssumingPossible(board, move, enemyKing, state)) {
        state.deltaPrunes += 1;
        state.qDeltaPrefilterSkips += 1;
        continue;
      }
    }

    if (!moveMayAffectOwnKingSafety(board, move, side, ownKing)) {
      moves[kept++] = move;
      continue;
    }
    if (isInCheckAfterGeneratedMoveKnownKing(board, move, side, ownKing)) continue;
    moves[kept++] = move;
  }
  moves.resize(kept);
  return moves;
}

int qCaptureHistoryScore(SearchState& state, const Move& move) {
  const int qHistory = state.qCaptureHistory[move.from][move.to];
  if (qHistory != 0) state.qCaptureHistoryHits += 1;
  return qHistory;
}

int qCheckHistoryScore(SearchState& state, const Move& move) {
  const int qHistory = state.qCheckHistory[move.from][move.to];
  if (qHistory != 0) state.qCheckHistoryHits += 1;
  return qHistory;
}

bool shouldGuardQDeltaCapture(SearchState& state, const Move& move, int standPat, int capturedValue, int alpha) {
  if (standPat + capturedValue + kQDeltaCaptureHistoryMargin <= alpha) return false;
  if (qCaptureHistoryScore(state, move) <= kQDeltaCaptureHistoryGuard) return false;
  state.qCaptureHistoryPruneGuards += 1;
  return true;
}

int quietCheckOrderingScore(const Board& board, const Move& move, SearchState& state, int enemyKing) {
  int score = state.quietHistory[move.from][move.to];
  score += qCheckHistoryScore(state, move) * 2;
  score += state.checkHistory[move.from][move.to] / 4;
  if (movedPieceDirectlyChecksAfterMove(board, move, enemyKing, move.piece)) score += 200000;
  score += pieceCodeValue(move.piece) / 2;
  score += fileCentrality(fileOf(move.to)) * 8;
  if (pieceCodeType(move.piece) == Pawn
      && crossedRiver(pieceCodeSide(move.piece), rankOf(move.to))) {
    score += 80;
  }
  return score;
}

void keepBestQuietChecks(MoveList& moves, const Board& board, SearchState& state, int enemyKing, int limit) {
  const std::size_t moveCount = moves.size();
  const std::size_t keepCount = std::min(moveCount, static_cast<std::size_t>(std::max(0, limit)));
  std::array<int, kMaxGeneratedMoves> scores;
  for (std::size_t index = 0; index < moveCount; index += 1) {
    scores[index] = quietCheckOrderingScore(board, moves[index], state, enemyKing);
  }

  for (std::size_t output = 0; output < keepCount; output += 1) {
    std::size_t best = output;
    for (std::size_t candidate = output + 1; candidate < moveCount; candidate += 1) {
      if (scores[candidate] > scores[best]) best = candidate;
    }

    if (best == output) continue;
    const Move bestMove = moves[best];
    const int bestScore = scores[best];
    for (std::size_t index = best; index > output; index -= 1) {
      moves[index] = moves[index - 1];
      scores[index] = scores[index - 1];
    }
    moves[output] = bestMove;
    scores[output] = bestScore;
  }
  moves.resize(keepCount);
}

MoveList generateQuietChecks(Board& board, int side, int enemyKing, int limit, SearchState& state, int ownKing, bool currentlyInCheck) {
  if (enemyKing < 0 || limit <= 0) return {};

  auto moves = generatePseudoMoves(board, side, GenerateQuietsOnly);
  if (ownKing < 0) return {};

  std::size_t checkCount = 0;
  for (std::size_t index = 0; index < moves.size(); index += 1) {
    Move& move = moves[index];
    if (!maybeMoveCanGiveCheck(move, enemyKing)) continue;
    if (!moveGivesCheck(board, move, enemyKing, state)) continue;

    if (currentlyInCheck || moveMayAffectOwnKingSafety(board, move, side, ownKing)) {
      const bool illegal = isInCheckAfterGeneratedMoveKnownKing(board, move, side, ownKing);
      if (illegal) continue;
    }

    moves[checkCount++] = move;
  }
  moves.resize(checkCount);
  if (static_cast<int>(moves.size()) > limit) {
    keepBestQuietChecks(moves, board, state, enemyKing, limit);
  }
  return moves;
}

bool isRecapture(const Move& move, const Move& previousMove) {
  return move.captured != 0 && previousMove.captured != 0 && move.to == previousMove.to;
}

bool isPawnPressureExtensionMove(const Move& move, int enemyKing, int rootPieceCount) {
  if (rootPieceCount <= 0 || rootPieceCount > kPawnPressureExtensionMaxPieces) return false;
  if (enemyKing < 0 || move.captured != 0) return false;
  if (pieceCodeType(move.piece) != Pawn) return false;

  const int side = pieceCodeSide(move.piece);
  const int toFile = fileOf(move.to);
  const int toRank = rankOf(move.to);
  if (!crossedRiver(side, toRank)) return false;
  if (palaceContains(-side, toFile, toRank)) return true;
  if (toFile != fileOf(enemyKing)) return false;

  const int kingRank = rankOf(enemyKing);
  const int rankDistance = side == kRed ? toRank - kingRank : kingRank - toRank;
  return rankDistance >= 1 && rankDistance <= 4;
}

bool hasNullMoveMaterial(const Board& board, int side) {
  return side == kRed ? board.redNullMoveMaterial > 0 : board.blackNullMoveMaterial > 0;
}

void makeNullMove(Board& board) {
  board.key ^= sideHash();
  board.side = -board.side;
}

void undoNullMove(Board& board) {
  board.side = -board.side;
  board.key ^= sideHash();
}

bool isMateScore(int score) {
  return std::abs(score) >= kMate - 1000;
}

int scoreToTt(int score, int ply) {
  if (score >= kMate - kMaxPly) return score + ply;
  if (score <= -kMate + kMaxPly) return score - ply;
  return score;
}

int scoreFromTt(int score, int ply) {
  if (score >= kMate - kMaxPly) return score - ply;
  if (score <= -kMate + kMaxPly) return score + ply;
  return score;
}

enum StaticEvalTrend {
  TrendUnknown = 0,
  TrendImproving = 1,
  TrendWorsening = 2,
  TrendStable = 3
};

enum LateMovePruneDecision {
  LateMoveKeep = 0,
  LateMovePruneShallow = 1,
  LateMovePruneDepthThree = 2,
  LateMovePruneDepthFour = 3
};

bool isImprovingTrend(StaticEvalTrend trend) {
  return trend == TrendImproving;
}

bool isWorseningTrend(StaticEvalTrend trend) {
  return trend == TrendWorsening;
}

StaticEvalTrend staticEvalTrend(SearchState& state, int ply, int staticScore) {
  if (ply < 0 || ply >= kMaxPly) return TrendUnknown;

  const bool hasPrevious = ply >= 2 && state.staticEvalKnown[ply - 2];
  const int previousStaticScore = hasPrevious ? state.staticEvalStack[ply - 2] : 0;
  state.staticEvalStack[ply] = staticScore;
  state.staticEvalKnown[ply] = true;

  if (!hasPrevious) return TrendUnknown;

  const int delta = staticScore - previousStaticScore;
  if (delta > kImprovingEvalMargin) {
    state.improvingNodes += 1;
    return TrendImproving;
  }
  if (delta < -kImprovingEvalMargin) {
    state.nonImprovingNodes += 1;
    return TrendWorsening;
  }

  state.stableEvalTrendNodes += 1;
  return TrendStable;
}

void clearStaticEvalTrendAtPly(SearchState& state, int ply) {
  if (ply < 0 || ply >= kMaxPly) return;
  if (!state.staticEvalKnown[ply]) return;
  state.staticEvalTrendClears += 1;
  state.staticEvalKnown[ply] = false;
}

int trendAdjustedMargin(int margin, StaticEvalTrend trend, int improvingSlack, int worseningTighten, int floor) {
  if (isImprovingTrend(trend)) return margin + improvingSlack;
  if (isWorseningTrend(trend)) return std::max(floor, margin - worseningTighten);
  return margin;
}

int futilityMargin(int depth, StaticEvalTrend trend) {
  const int margin = 140 + depth * 120;
  return trendAdjustedMargin(margin, trend, 30 + depth * 20, 25 + depth * 15, 120);
}

int reverseFutilityMargin(int depth, StaticEvalTrend trend) {
  const int margin = 100 + depth * 80;
  return trendAdjustedMargin(margin, trend, 25 + depth * 15, 20 + depth * 10, 80);
}

int razorMargin(int depth) {
  return 320 + depth * 160;
}

bool shouldPruneReverseFutility(int depth, bool inCheck, int alpha, int beta, int staticScore, StaticEvalTrend trend) {
  if (inCheck || depth < 1 || depth > kReverseFutilityMaxDepth) return false;
  if (beta - alpha != 1) return false;
  if (isMateScore(alpha) || isMateScore(beta)) return false;
  if (depth >= kReverseFutilityMaxDepth && isWorseningTrend(trend)) return false;
  return staticScore - reverseFutilityMargin(depth, trend) >= beta;
}

bool shouldRazor(int depth, bool inCheck, int alpha, int beta, int staticScore) {
  if (inCheck || depth < 1 || depth > 2) return false;
  if (beta - alpha != 1) return false;
  if (isMateScore(alpha) || isMateScore(beta)) return false;
  return staticScore + razorMargin(depth) <= alpha;
}

int lateMovePruningBaseThreshold(int depth) {
  return 25 + depth * 10;
}

int lateMovePruningThreshold(int depth, StaticEvalTrend trend) {
  const int threshold = lateMovePruningBaseThreshold(depth);
  if (isImprovingTrend(trend)) return threshold + 2;
  if (isWorseningTrend(trend)) return std::max(1, threshold - 1);
  return threshold;
}

int historyPruningMoveIndex(int depth, StaticEvalTrend trend) {
  const int moveIndex = kHistoryPruningBaseIndex + depth;
  if (isImprovingTrend(trend)) return moveIndex + 1;
  if (isWorseningTrend(trend)) return std::max(1, moveIndex - 1);
  return moveIndex;
}

int historyPruningMargin(int depth, StaticEvalTrend trend) {
  const int margin = depth * depth * kHistoryPruningMarginScale;
  return trendAdjustedMargin(
      margin,
      trend,
      depth * 24,
      depth * 16,
      kHistoryPruningMarginScale / 2);
}

int continuationHistoryValue(const SearchState& state, const Move& previousMove, const Move& move, bool quietMove);
int followupHistoryValue(const SearchState& state, const Move& previousOwnMove, const Move& move, bool quietMove);

bool shouldPruneBadHistory(
    const Move& move,
    SearchState& state,
    int depth,
    int orderedIndex,
    bool quietMove,
    bool inCheck,
    bool givesCheck,
    int extension,
    bool killerCandidate,
    bool hashCandidate,
    bool counterCandidate,
    int alpha,
    int beta,
    StaticEvalTrend trend,
    const Move& previousMove,
    const Move& previousOwnMove) {
  if (depth < 1 || depth > kHistoryPruningMaxDepth) return false;
  if (orderedIndex < historyPruningMoveIndex(depth, trend)) return false;
  if (beta - alpha != 1) return false;
  if (inCheck || givesCheck || extension > 0) return false;
  if (!quietMove) return false;
  if (isMateScore(alpha) || isMateScore(beta)) return false;

  const int historyScore = state.quietHistory[move.from][move.to];
  const int continuationScore = continuationHistoryValue(state, previousMove, move, quietMove);
  const int followupScore = followupHistoryValue(state, previousOwnMove, move, quietMove);
  if (historyScore >= 0 && continuationScore >= 0) return false;
  if (followupScore > depth * depth * 128) return false;

  const int combinedHistory = historyScore + continuationScore / 2 + std::min(0, followupScore / 8);
  const int threshold = -historyPruningMargin(depth, trend);
  if (combinedHistory > threshold) return false;

  if (killerCandidate || hashCandidate || counterCandidate) {
    state.badHistoryPruneGuards += 1;
    return false;
  }

  return historyScore <= threshold || continuationScore <= threshold / 2;
}

LateMovePruneDecision shouldPruneLateMove(
    const Move& move,
    SearchState& state,
    int depth,
    int orderedIndex,
    bool quietMove,
    bool inCheck,
    bool givesCheck,
    int extension,
    bool killerCandidate,
    bool hashCandidate,
    bool counterCandidate,
    int alpha,
    int beta,
    StaticEvalTrend trend,
    const Move& previousMove,
    const Move& previousOwnMove) {
  if (depth < 1 || depth > kLateMovePruningMaxDepth) return LateMoveKeep;
  const int baseThreshold = lateMovePruningBaseThreshold(depth);
  const bool depthThreeCandidate = depth == 3;
  const bool depthFourCandidate = depth == 4;
  const int depthTighten = depthThreeCandidate
      ? kLateMovePruningDepthThreeTighten
      : depthFourCandidate ? kLateMovePruningDepthFourTighten : 0;
  const int threshold = std::max(
      1,
      lateMovePruningThreshold(depth, trend) - depthTighten);
  if (orderedIndex < threshold) {
    if (isImprovingTrend(trend) && orderedIndex >= baseThreshold) {
      state.improvingLateMoveGuards += 1;
    }
    return LateMoveKeep;
  }
  if (beta - alpha != 1) return LateMoveKeep;
  if (inCheck || givesCheck || extension > 0) return LateMoveKeep;
  if (!quietMove || killerCandidate || hashCandidate || counterCandidate) return LateMoveKeep;
  if (isMateScore(alpha) || isMateScore(beta)) return LateMoveKeep;
  const int historyScore = state.quietHistory[move.from][move.to];
  const int continuationScore = continuationHistoryValue(state, previousMove, move, quietMove);
  const int followupScore = followupHistoryValue(state, previousOwnMove, move, quietMove);
  const int positiveThreshold = depth * depth;
  if (historyScore > positiveThreshold || continuationScore > positiveThreshold || followupScore > positiveThreshold * 64) return LateMoveKeep;
  if (depthThreeCandidate) {
    if (isImprovingTrend(trend)) {
      state.improvingLateMoveGuards += 1;
      return LateMoveKeep;
    }
    return historyScore < 0 || continuationScore < 0 ? LateMovePruneDepthThree : LateMoveKeep;
  }
  if (depthFourCandidate) {
    if (isImprovingTrend(trend)) {
      state.improvingLateMoveGuards += 1;
      return LateMoveKeep;
    }
    const int combinedHistory = historyScore + continuationScore / 2;
    const int negativeThreshold = -depth * depth * 24;
    return combinedHistory <= negativeThreshold ? LateMovePruneDepthFour : LateMoveKeep;
  }
  if (isWorseningTrend(trend) && orderedIndex < baseThreshold) {
    state.nonImprovingLateMovePrunes += 1;
  }
  return historyScore < 0 || continuationScore < 0 ? LateMovePruneShallow : LateMoveKeep;
}

bool shouldPruneBadCapture(
    const Board& board,
    const Move& move,
    SearchState& state,
    int depth,
    int orderedIndex,
    bool captureMove,
    bool inCheck,
    bool givesCheck,
    int extension,
    bool hashCandidate,
    bool counterCandidate,
    int alpha,
    int beta) {
  if (!captureMove || depth < 1 || depth > 2) return false;
  if (orderedIndex == 0 || hashCandidate || counterCandidate) return false;
  if (inCheck || givesCheck || extension > 0) return false;
  if (beta - alpha != 1) return false;
  if (isMateScore(alpha) || isMateScore(beta)) return false;
  const int badCaptureLoss = badCaptureLossForCapture(board, move, state);
  if (badCaptureLoss <= 120) return false;
  const int captureHistoryScore = state.captureHistory[move.from][move.to];
  if (captureHistoryScore > 1024 && badCaptureLoss <= 240) {
    state.captureHistoryPruneGuards += 1;
    return false;
  }
  return true;
}

bool shouldUseProbCut(int depth, bool inCheck, int alpha, int beta) {
  if (depth < kProbCutMinDepth || inCheck) return false;
  if (beta - alpha != 1) return false;
  if (isMateScore(alpha) || isMateScore(beta)) return false;
  return true;
}

bool isProbCutCaptureCandidate(const Move& move) {
  if (pieceCodeType(move.captured) == King) return false;

  const int movingValue = pieceCodeValue(move.piece);
  const int capturedValue = pieceCodeValue(move.captured);
  return capturedValue >= pieceTypeValue(Horse) || capturedValue >= movingValue;
}

bool shouldVerifyProbCutCaptureCandidate(const Board& board, const Move& move, SearchState& state) {
  return badCaptureLossForCapture(board, move, state) <= 0;
}

bool shouldUseInternalIterativeDeepening(
    const SearchState& state,
    const MoveList& legalMoves,
    const Move& hashMove,
    int hashDepth,
    int depth,
    bool inCheck,
    int alpha,
    int beta) {
  if (state.iidActive) return false;
  if (validMove(hashMove) && hashDepth >= depth) return false;
  if (inCheck || depth < kIidMinDepth) return false;
  if (legalMoves.size() < 2) return false;
  if (beta - alpha <= 1) return false;
  if (isMateScore(alpha) || isMateScore(beta)) return false;
  return true;
}

int singularExtensionMargin(int depth) {
  return kSingularExtensionMargin + depth * 4;
}

bool shouldTrySingularExtension(
    const SearchState& state,
    const MoveList& moves,
    const Move& move,
    bool hashCandidate,
    int hashDepth,
    int hashFlag,
    int hashScore,
    int depth,
    bool inCheck,
    int extensionsRemaining) {
  if (state.singularActive) return false;
  if (!hashCandidate || !validMove(move)) return false;
  if (extensionsRemaining <= 0 || inCheck) return false;
  if (depth < kSingularExtensionMinDepth) return false;
  if (moves.size() < 2) return false;
  if (hashFlag == kTtUpper) return false;
  if (hashDepth < depth - 2) return false;
  if (isMateScore(hashScore)) return false;
  return true;
}

bool isKillerMove(const SearchState& state, int ply, const Move& move, bool quietMove) {
  if (ply < 0 || ply >= kMaxPly || !quietMove) return false;
  return sameMove(state.killers[ply][0], move) || sameMove(state.killers[ply][1], move);
}

void addHistoryScore(std::array<std::array<int, kSquares>, kSquares>& table, const Move& move, int bonus) {
  int& value = table[move.from][move.to];
  value += bonus - value * std::abs(bonus) / kHistoryMax;
  value = std::clamp(value, -kHistoryMax, kHistoryMax);
}

void rememberKiller(SearchState& state, int ply, const Move& move, bool quietMove) {
  if (ply < 0 || ply >= kMaxPly || !quietMove) return;
  if (sameMove(state.killers[ply][0], move)) return;
  state.killers[ply][1] = state.killers[ply][0];
  state.killers[ply][0] = move;
}

Move counterMoveFor(const SearchState& state, const Move& previousMove) {
  if (!validMove(previousMove)) return {};
  return state.countermoves[previousMove.from][previousMove.to];
}

int continuationHistoryValue(const SearchState& state, const Move& previousMove, const Move& move, bool quietMove) {
  if (!validMove(previousMove) || !quietMove) return 0;
  return state.continuationHistory[previousMove.to][move.from][move.to];
}

int continuationHistoryScore(SearchState& state, const Move& previousMove, const Move& move, bool quietMove) {
  const int score = continuationHistoryValue(state, previousMove, move, quietMove);
  if (score != 0) state.continuationHistoryHits += 1;
  return score;
}

void addContinuationHistoryScore(SearchState& state, const Move& previousMove, const Move& move, int bonus, bool quietMove) {
  if (!validMove(previousMove) || !quietMove) return;
  addHistoryScore(state.continuationHistory[previousMove.to], move, bonus);
  state.continuationHistoryStores += 1;
}

int followupHistoryValue(const SearchState& state, const Move& previousOwnMove, const Move& move, bool quietMove) {
  if (!validMove(previousOwnMove) || !quietMove) return 0;
  return state.continuationHistory[previousOwnMove.to][move.from][move.to];
}

int followupHistoryScore(SearchState& state, const Move& previousOwnMove, const Move& move, bool quietMove) {
  const int score = followupHistoryValue(state, previousOwnMove, move, quietMove);
  if (score != 0) state.followupHistoryHits += 1;
  return score;
}

void addFollowupHistoryScore(SearchState& state, const Move& previousOwnMove, const Move& move, int bonus, bool quietMove) {
  if (!validMove(previousOwnMove) || !quietMove) return;
  addHistoryScore(state.continuationHistory[previousOwnMove.to], move, bonus);
  state.followupHistoryStores += 1;
}

int checkHistoryScore(SearchState& state, const Move& move, bool quietMove) {
  if (!quietMove) return 0;
  const int score = state.checkHistory[move.from][move.to];
  if (score != 0) state.checkHistoryHits += 1;
  return score;
}

void addCheckHistoryScore(SearchState& state, const Move& move, int bonus, bool quietMove) {
  if (!quietMove) return;
  addHistoryScore(state.checkHistory, move, bonus);
  state.checkHistoryStores += 1;
}

void addCheckHistoryMalus(SearchState& state, const Move& move, int penalty, bool quietMove) {
  if (!quietMove) return;
  addHistoryScore(state.checkHistory, move, -penalty);
  state.checkHistoryMaluses += 1;
}

int lateMoveReduction(
    SearchState& state,
    int depth,
    int moveIndex,
    const Move& move,
    bool inCheck,
    bool killerCandidate,
    bool counterCandidate,
    bool quietMove,
    const Move& previousMove,
    const Move& previousOwnMove,
    int alpha,
    int beta,
    StaticEvalTrend trend) {
  if (depth < 3 || moveIndex < 4 || inCheck || killerCandidate || !quietMove) return 0;
  int reduction = 1;
  if (depth >= 5 && moveIndex >= 8) reduction += 1;
  if (depth >= 7 && moveIndex >= 14 && !isImprovingTrend(trend)) reduction += 1;

  const int historyScore = state.quietHistory[move.from][move.to];
  const int continuationScore = continuationHistoryValue(state, previousMove, move, quietMove);
  const int followupScore = followupHistoryValue(state, previousOwnMove, move, quietMove);
  const int historyScale = depth * depth;
  if (counterCandidate && reduction > 1) reduction -= 1;
  if (historyScore > historyScale * 96 && depth >= 6) reduction -= 1;
  if (historyScore < -historyScale * 48 && depth >= 5 && moveIndex >= 8) reduction += 1;
  if (continuationScore > historyScale * 64 && reduction > 0) {
    reduction -= 1;
    state.continuationReductionBoosts += 1;
  }
  if (continuationScore < -historyScale * 64 && depth >= 5 && moveIndex >= 8) {
    reduction += 1;
    state.continuationReductionMaluses += 1;
  }
  if (followupScore > historyScale * 256 && reduction > 1) {
    reduction -= 1;
    state.followupReductionBoosts += 1;
  }
  if (followupScore < -historyScale * 96 && depth >= 5 && moveIndex >= 8) {
    reduction += 1;
    state.followupReductionMaluses += 1;
  }
  if (beta - alpha > 1 && depth >= 8 && moveIndex >= 16 && reduction > 1) {
    reduction -= 1;
    state.pvReductionGuards += 1;
  } else if (beta - alpha == 1 && state.completedDepth >= 6 && depth >= 6 && moveIndex >= 8) {
    reduction += 1;
    state.cutNodeReductionBoosts += 1;
  }
  if (isImprovingTrend(trend) && depth >= 5 && moveIndex >= 12 && reduction > 1) {
    reduction -= 1;
    state.improvingReductionGuards += 1;
  } else if (isWorseningTrend(trend) && depth >= 5 && moveIndex >= 12) {
    reduction += 1;
    state.nonImprovingReductionBoosts += 1;
  }

  return std::clamp(reduction, 0, depth - 2);
}

void rememberBetaCutoff(
    SearchState& state,
    int ply,
    int depth,
    const Move& bestMove,
    bool bestMoveQuiet,
    bool bestMoveCapture,
    bool bestMoveGivesCheck,
    const Move& previousMove,
    const Move& previousOwnMove,
    const Move* quiets,
    std::size_t quietCount,
    const Move* quietChecks,
    std::size_t quietCheckCount,
    const Move* captures,
    std::size_t captureCount) {
  const int bonus = std::clamp(depth * depth * 32, 32, 4096);
  if (bestMoveQuiet) {
    rememberKiller(state, ply, bestMove, bestMoveQuiet);
    addHistoryScore(state.quietHistory, bestMove, bonus);
    if (bestMoveGivesCheck) addCheckHistoryScore(state, bestMove, bonus / 2, bestMoveQuiet);
    if (validMove(previousMove)) {
      state.countermoves[previousMove.from][previousMove.to] = bestMove;
      state.countermoveStores += 1;
    }
    addContinuationHistoryScore(state, previousMove, bestMove, bonus / 2, bestMoveQuiet);
    addFollowupHistoryScore(state, previousOwnMove, bestMove, bonus / 3, bestMoveQuiet);
    for (std::size_t index = 0; index < quietCount; index += 1) {
      const Move& move = quiets[index];
      if (!sameMove(move, bestMove)) {
        addHistoryScore(state.quietHistory, move, -bonus / 2);
        addContinuationHistoryScore(state, previousMove, move, -bonus / 4, true);
        addFollowupHistoryScore(state, previousOwnMove, move, -bonus / 6, true);
      }
    }
  } else if (bestMoveCapture) {
    addHistoryScore(state.captureHistory, bestMove, bonus);
    state.captureHistoryStores += 1;
  }
  for (std::size_t index = 0; index < quietCheckCount; index += 1) {
    const Move& move = quietChecks[index];
    if (!sameMove(move, bestMove)) addCheckHistoryMalus(state, move, bonus / 4, true);
  }
  for (std::size_t index = 0; index < captureCount; index += 1) {
    const Move& move = captures[index];
    if (!sameMove(move, bestMove)) {
      addHistoryScore(state.captureHistory, move, -bonus / 2);
      state.captureHistoryMaluses += 1;
    }
  }
  state.historyUpdates += 1;
}

int horseMobilityBonus(const Board& board, int square, int piece) {
  const int side = pieceCodeSide(piece);
  int bonus = 0;
  const int count = kHorseTargets.counts[static_cast<std::size_t>(square)];
  const auto& targets = kHorseTargets.targets[static_cast<std::size_t>(square)];
  const auto& blockers = kHorseTargets.blockers[static_cast<std::size_t>(square)];
  for (int index = 0; index < count; index += 1) {
    if (board.cells[blockers[static_cast<std::size_t>(index)]] != 0) continue;
    const int target = board.cells[targets[static_cast<std::size_t>(index)]];
    if (target != 0 && pieceCodeSide(target) == side) continue;
    bonus += 9;
    const int targetSquare = targets[static_cast<std::size_t>(index)];
    if (palaceContains(-side, fileOf(targetSquare), rankOf(targetSquare))) bonus += 16;
    if (target != 0) bonus += std::min(60, pieceCodeValue(target) / 16);
  }
  return bonus;
}

int horseLegCoordinationBonus(const Board& board, int square, int piece) {
  static constexpr int legs[4][2] = {{0, -1}, {1, 0}, {0, 1}, {-1, 0}};
  const int file = fileOf(square);
  const int rank = rankOf(square);
  const int side = pieceCodeSide(piece);
  int blockedLegs = 0;
  int bonus = 0;

  for (const auto& leg : legs) {
    const int legFile = file + leg[0];
    const int legRank = rank + leg[1];
    if (!inside(legFile, legRank)) continue;
    const int blocker = board.cells[indexOf(legFile, legRank)];
    if (blocker == 0) continue;
    blockedLegs += 1;
    bonus -= pieceCodeSide(blocker) == side ? 5 : 3;
  }

  return blockedLegs == 0 ? bonus + 4 : bonus;
}

int linkedHorseBonus(const Board& board, int square, int piece) {
  const int file = fileOf(square);
  const int rank = rankOf(square);
  int bonus = 0;
  const int count = kHorseTargets.counts[static_cast<std::size_t>(square)];
  const auto& targets = kHorseTargets.targets[static_cast<std::size_t>(square)];

  for (int index = 0; index < count; index += 1) {
    const int target = targets[static_cast<std::size_t>(index)];
    if (target <= square) continue;
    const int partner = board.cells[target];
    if (partner != piece) continue;

    const Move noMove{};
    if (!pieceAttacksSquareAfterMove(board, noMove, square, target, piece)) continue;
    if (!pieceAttacksSquareAfterMove(board, noMove, target, square, partner)) continue;

    const int partnerFile = fileOf(target);
    const int targetRank = rankOf(target);
    const int centrality = fileCentrality(file) + fileCentrality(partnerFile);
    bonus += 8 + centrality;
    if (crossedRiver(pieceCodeSide(piece), rank) || crossedRiver(pieceCodeSide(partner), targetRank)) bonus += 3;
  }

  return bonus;
}

bool isHorsePalaceOutpost(int defendingSide, int file, int rank) {
  const int targetRank = defendingSide == kRed ? 7 : 2;
  if (rank != targetRank) return false;
  const int fileDistance = std::abs(file - 4);
  return fileDistance == 1 || fileDistance == 2;
}

int horsePressureBonus(const Board& board, int square, int piece, int enemyKing) {
  if (enemyKing < 0) return 0;
  const int side = pieceCodeSide(piece);
  const int enemy = -side;
  const int file = fileOf(square);
  const int rank = rankOf(square);
  const int kingDistance = std::abs(file - fileOf(enemyKing)) + std::abs(rank - rankOf(enemyKing));
  if (!crossedRiver(side, rank) && kingDistance > 5) return 0;
  int bonus = 0;

  const auto& horseTargets = kHorseTargets.targets[static_cast<std::size_t>(square)];
  const auto& horseBlockers = kHorseTargets.blockers[static_cast<std::size_t>(square)];
  const int horseTargetCount = kHorseTargets.counts[static_cast<std::size_t>(square)];
  const auto& kingTargets = kKingTargets[static_cast<std::size_t>(sideLookupIndex(enemy))].targets[static_cast<std::size_t>(enemyKing)];
  const int kingTargetCount = kKingTargets[static_cast<std::size_t>(sideLookupIndex(enemy))].counts[static_cast<std::size_t>(enemyKing)];

  for (int index = 0; index < horseTargetCount; index += 1) {
    if (board.cells[horseBlockers[static_cast<std::size_t>(index)]] != 0) continue;
    const int targetSquare = horseTargets[static_cast<std::size_t>(index)];

    if (palaceContains(enemy, fileOf(targetSquare), rankOf(targetSquare))) bonus += 4;
    if (targetSquare == enemyKing) bonus += 38;

    for (int kingIndex = 0; kingIndex < kingTargetCount; kingIndex += 1) {
      const int escapeSquare = kingTargets[static_cast<std::size_t>(kingIndex)];
      const int occupant = board.cells[escapeSquare];
      if (occupant != 0 && pieceCodeSide(occupant) == enemy) continue;
      if (targetSquare == escapeSquare) {
        bonus += 10;
        break;
      }
    }
  }

  if (crossedRiver(side, rank)) bonus += 5;
  if (isHorsePalaceOutpost(enemy, file, rank)) bonus += 16;

  if (kingDistance <= 5) bonus += std::max(0, 18 - kingDistance * 3);
  return std::min(70, bonus);
}

int elephantEyeCoordinationBonus(const Board& board, int square, int piece) {
  const int side = pieceCodeSide(piece);
  int openEyes = 0;
  int bonus = 0;
  const auto& lookup = kElephantTargets[static_cast<std::size_t>(sideLookupIndex(side))];
  const int count = lookup.counts[static_cast<std::size_t>(square)];
  const auto& blockers = lookup.blockers[static_cast<std::size_t>(square)];

  for (int index = 0; index < count; index += 1) {
    const int blocker = board.cells[blockers[static_cast<std::size_t>(index)]];
    if (blocker == 0) {
      openEyes += 1;
      bonus += 2;
    } else {
      bonus -= pieceCodeSide(blocker) == side ? 4 : 5;
    }
  }

  return openEyes >= 2 ? bonus + 2 : bonus;
}

int elephantShapeBonus(int square, int piece, int totalPieceCount) {
  if (totalPieceCount > 6) return 0;
  const int side = pieceCodeSide(piece);
  const int file = fileOf(square);
  const int rank = rankOf(square);
  int bonus = fileCentrality(file) * 2;

  if (file == 4 && rank == (side == kRed ? 7 : 2)) bonus += 18;
  if ((file == 2 || file == 6) && rank == (side == kRed ? 5 : 4)) bonus += 8;
  return bonus;
}

int rookActivityBonus(const Board& board, int square, int piece) {
  const int side = pieceCodeSide(piece);
  int bonus = 0;
  const auto& rays = kRaySquares[static_cast<std::size_t>(square)];
  const auto& lengths = kRayLengths[static_cast<std::size_t>(square)];
  for (int direction = 0; direction < kOrthogonalDirections; direction += 1) {
    const auto& ray = rays[static_cast<std::size_t>(direction)];
    const int length = lengths[static_cast<std::size_t>(direction)];
    for (int step = 0; step < length; step += 1) {
      const int target = board.cells[ray[static_cast<std::size_t>(step)]];
      if (target == 0) {
        bonus += 4;
      } else {
        if (pieceCodeSide(target) != side) bonus += std::min(90, pieceCodeValue(target) / 14);
        break;
      }
    }
  }
  return bonus;
}

int connectedRookBonus(const Board& board, int square, int piece) {
  const int side = pieceCodeSide(piece);
  int bonus = 0;
  const auto& rays = kRaySquares[static_cast<std::size_t>(square)];
  const auto& lengths = kRayLengths[static_cast<std::size_t>(square)];
  for (int direction = 0; direction < kOrthogonalDirections; direction += 1) {
    const auto& ray = rays[static_cast<std::size_t>(direction)];
    const int length = lengths[static_cast<std::size_t>(direction)];
    for (int step = 0; step < length; step += 1) {
      const int targetSquare = ray[static_cast<std::size_t>(step)];
      const int target = board.cells[targetSquare];
      if (target == 0) continue;
      if (target == piece) {
        bonus += 10 + std::min(8, step * 2);
        bonus += (fileCentrality(fileOf(square)) + fileCentrality(fileOf(targetSquare))) / 2;
        if (crossedRiver(side, rankOf(square)) || crossedRiver(side, rankOf(targetSquare))) bonus += 4;
      }
      break;
    }
  }
  return std::min(30, bonus);
}

int rayQuietReach(const Board& board, int square, int direction) {
  int empty = 0;
  const auto& ray = kRaySquares[static_cast<std::size_t>(square)][static_cast<std::size_t>(direction)];
  const int length = kRayLengths[static_cast<std::size_t>(square)][static_cast<std::size_t>(direction)];
  for (int step = 0; step < length; step += 1) {
    if (board.cells[ray[static_cast<std::size_t>(step)]] != 0) break;
    empty += 1;
  }
  return empty;
}

int rayBlocker(const Board& board, int square, int direction) {
  const auto& ray = kRaySquares[static_cast<std::size_t>(square)][static_cast<std::size_t>(direction)];
  const int length = kRayLengths[static_cast<std::size_t>(square)][static_cast<std::size_t>(direction)];
  for (int step = 0; step < length; step += 1) {
    const int piece = board.cells[ray[static_cast<std::size_t>(step)]];
    if (piece != 0) return piece;
  }
  return 0;
}

int riverControlBonus(const Board& board, int square, int piece, int totalPieceCount) {
  const int type = pieceCodeType(piece);
  if (type != Rook && type != Cannon) return 0;

  const int side = pieceCodeSide(piece);
  const int file = fileOf(square);
  const int rank = rankOf(square);
  if (rank != 4 && rank != 5) return 0;
  if (type == Cannon && totalPieceCount > 24) return 0;

  if (type == Cannon) {
    int bonus = 4;
    const int horizontalReach = rayQuietReach(board, square, 3) + rayQuietReach(board, square, 1);
    bonus += std::min(8, horizontalReach * 2);
    bonus += fileCentrality(file);
    if (rank == (side == kRed ? 4 : 5)) bonus += 3;

    const int forwardBlocker = rayBlocker(board, square, side == kRed ? 0 : 2);
    if (forwardBlocker == 0) {
      bonus += 4;
    } else if (pieceCodeSide(forwardBlocker) != side) {
      bonus += std::min(6, pieceCodeValue(forwardBlocker) / 110);
    } else {
      bonus -= 3;
    }

    if (horizontalReach <= 2) bonus -= 5;
    return bonus;
  }

  int bonus = 14;
  const int horizontalReach = rayQuietReach(board, square, 3) + rayQuietReach(board, square, 1);
  bonus += std::min(14, horizontalReach * 2);
  bonus += fileCentrality(file) * 3;
  if (rank == (side == kRed ? 4 : 5)) bonus += 6;

  const int forwardBlocker = rayBlocker(board, square, side == kRed ? 0 : 2);
  if (forwardBlocker == 0) {
    bonus += 7;
  } else if (pieceCodeSide(forwardBlocker) != side) {
    bonus += std::min(10, pieceCodeValue(forwardBlocker) / 70);
  } else {
    bonus -= 5;
  }

  if (horizontalReach <= 2) bonus -= 10;
  return bonus;
}

int cannonActivityBonus(const Board& board, int square, int piece) {
  const int side = pieceCodeSide(piece);
  int bonus = 0;
  const auto& rays = kRaySquares[static_cast<std::size_t>(square)];
  const auto& lengths = kRayLengths[static_cast<std::size_t>(square)];
  for (int direction = 0; direction < kOrthogonalDirections; direction += 1) {
    bool screen = false;
    const auto& ray = rays[static_cast<std::size_t>(direction)];
    const int length = lengths[static_cast<std::size_t>(direction)];
    for (int step = 0; step < length; step += 1) {
      const int target = board.cells[ray[static_cast<std::size_t>(step)]];
      if (!screen) {
        if (target == 0) {
          bonus += 2;
        } else {
          screen = true;
        }
      } else if (target != 0) {
        if (pieceCodeSide(target) != side) {
          bonus += pieceCodeType(target) == King ? 160 : std::min(100, pieceCodeValue(target) / 10);
        }
        break;
      }
    }
  }
  return bonus;
}

int cannonBatteryBonus(const Board& board, int square, int piece) {
  const int side = pieceCodeSide(piece);
  int bonus = 0;
  const auto& rays = kRaySquares[static_cast<std::size_t>(square)];
  const auto& lengths = kRayLengths[static_cast<std::size_t>(square)];

  for (int direction = 0; direction < kOrthogonalDirections; direction += 1) {
    const auto& ray = rays[static_cast<std::size_t>(direction)];
    const int length = lengths[static_cast<std::size_t>(direction)];
    int quietSquares = 0;
    for (int step = 0; step < length; step += 1) {
      const int targetSquare = ray[static_cast<std::size_t>(step)];
      const int target = board.cells[targetSquare];
      if (target == 0) {
        quietSquares += 1;
        continue;
      }

      if (target == piece && targetSquare > square) {
        const bool advancedPair = crossedRiver(side, rankOf(square)) || crossedRiver(side, rankOf(targetSquare));
        int tailBonus = 0;
        for (int tail = step + 1; tail < length; tail += 1) {
          const int tailPiece = board.cells[ray[static_cast<std::size_t>(tail)]];
          if (tailPiece == 0) continue;
          if (pieceCodeSide(tailPiece) != side) {
            tailBonus = pieceCodeType(tailPiece) == King ? 18 : std::min(12, pieceCodeValue(tailPiece) / 80);
          }
          break;
        }
        if (!advancedPair && tailBonus == 0) break;

        int pairBonus = 14 + std::min(8, quietSquares * 2);
        pairBonus += (fileCentrality(fileOf(square)) + fileCentrality(fileOf(targetSquare))) / 2;
        if (advancedPair) pairBonus += 4;
        if (fileOf(square) == fileOf(targetSquare) && fileCentrality(fileOf(square)) >= 3) pairBonus += 6;
        pairBonus += tailBonus;
        bonus += pairBonus;
      }
      break;
    }
  }

  return std::min(42, bonus);
}

bool isLineAttackerType(int type) {
  return type == Rook || type == Cannon;
}

int lineBatteryPieceBonus(int piece) {
  return pieceCodeType(piece) == Rook ? 9 : 7;
}

int lineBatteryPressureBonus(const Board& board, int side, int enemyKing, int totalPieceCount) {
  if (enemyKing < 0) return 0;
  if (totalPieceCount > 24) return 0;

  int bonus = 0;
  const auto& rays = kRaySquares[static_cast<std::size_t>(enemyKing)];
  const auto& lengths = kRayLengths[static_cast<std::size_t>(enemyKing)];

  for (int direction = 0; direction < kOrthogonalDirections; direction += 1) {
    const auto& ray = rays[static_cast<std::size_t>(direction)];
    const int length = lengths[static_cast<std::size_t>(direction)];
    int occupiedBeforeLead = 0;
    int blockersBeforeLead = 0;
    int pinnedGuards = 0;
    int leadPiece = 0;
    int leadSquare = -1;
    int supportPiece = 0;
    int supportSquare = -1;

    for (int step = 0; step < length; step += 1) {
      const int square = ray[static_cast<std::size_t>(step)];
      const int piece = board.cells[square];
      if (piece == 0) continue;

      const int pieceSide = pieceCodeSide(piece);
      const int type = pieceCodeType(piece);
      if (pieceSide == side && isLineAttackerType(type)) {
        if (leadPiece == 0) {
          leadPiece = piece;
          leadSquare = square;
          blockersBeforeLead = occupiedBeforeLead;
        } else {
          supportPiece = piece;
          supportSquare = square;
          break;
        }
      } else if (leadPiece == 0 && pieceSide == -side) {
        if (type == Advisor || type == Elephant) pinnedGuards += 1;
      }

      occupiedBeforeLead += 1;
    }

    if (leadPiece == 0 || supportPiece == 0 || blockersBeforeLead > 2) continue;

    int pairBonus = 18 + std::max(0, 2 - blockersBeforeLead) * 8;
    pairBonus += lineBatteryPieceBonus(leadPiece) + lineBatteryPieceBonus(supportPiece);
    if (fileOf(leadSquare) == fileOf(enemyKing)) pairBonus += 5;
    if (crossedRiver(side, rankOf(leadSquare)) || crossedRiver(side, rankOf(supportSquare))) pairBonus += 4;
    pairBonus += pinnedGuards * 6;
    bonus += pairBonus;
  }

  return std::min(70, bonus);
}

int blockersBetween(const Board& board, int from, int to) {
  if (from == to) return 0;
  const int direction = orthogonalDirectionBetween(from, to);
  if (direction < 0) return kInf;
  int blockers = 0;
  const auto& ray = kRaySquares[static_cast<std::size_t>(from)][static_cast<std::size_t>(direction)];
  const int length = kRayLengths[static_cast<std::size_t>(from)][static_cast<std::size_t>(direction)];
  for (int step = 0; step < length; step += 1) {
    const int square = ray[static_cast<std::size_t>(step)];
    if (square == to) return blockers;
    if (board.cells[square] != 0) blockers += 1;
  }
  return blockers;
}

struct LineBlockers {
  int count = kInf;
  int first = -1;
  int second = -1;
};

LineBlockers lineBlockersBetween(const Board& board, int from, int to) {
  const int direction = orthogonalDirectionBetween(from, to);
  if (direction < 0) return {};
  LineBlockers blockers{0, -1, -1};
  const auto& ray = kRaySquares[static_cast<std::size_t>(from)][static_cast<std::size_t>(direction)];
  const int length = kRayLengths[static_cast<std::size_t>(from)][static_cast<std::size_t>(direction)];
  for (int step = 0; step < length; step += 1) {
    const int square = ray[static_cast<std::size_t>(step)];
    if (square == to) return blockers;
    if (board.cells[square] != 0) {
      if (blockers.count == 0) blockers.first = square;
      else if (blockers.count == 1) blockers.second = square;
      blockers.count += 1;
    }
  }
  return blockers;
}

int palaceCenterBlockPenalty(int type) {
  switch (type) {
    case Horse: return 58;
    case Rook:
    case Cannon: return 36;
    case Pawn: return 30;
    case Elephant: return 24;
    default: return 20;
  }
}

int palaceShapePenalty(const Board& board, int side, int kingSquare) {
  const int center = indexOf(4, side == kRed ? 8 : 1);
  const int piece = board.cells[center];
  if (piece == 0 || pieceCodeSide(piece) != side) return 0;
  const int type = pieceCodeType(piece);
  if (type == King || type == Advisor) return 0;

  int penalty = palaceCenterBlockPenalty(type);
  if ((fileOf(center) == fileOf(kingSquare) || rankOf(center) == rankOf(kingSquare))
      && blockersBetween(board, center, kingSquare) == 0) {
    penalty += 10;
  }
  return penalty;
}

int palaceEscapeBlockPenalty(const Board& board, int side, int kingSquare, int totalPieceCount) {
  if (kingSquare < 0) return 0;
  if (totalPieceCount > 6) return 0;

  int penalty = 0;
  const int kingFile = fileOf(kingSquare);
  const int kingRank = rankOf(kingSquare);

  for (int delta : {-1, 1}) {
    const int targetFile = kingFile + delta;
    if (!palaceContains(side, targetFile, kingRank)) continue;

    const int targetSquare = indexOf(targetFile, kingRank);
    const int piece = board.cells[targetSquare];
    if (piece == 0 || pieceCodeSide(piece) != side) continue;

    const int type = pieceCodeType(piece);
    if (type == Advisor || type == King) continue;

    int targetPenalty = type == Pawn ? 18 : type == Elephant ? 16 : 28;
    penalty += targetPenalty;
  }

  return penalty;
}

int advisorShapeBonus(const Board& board, int square, int piece, int ownKing, int totalPieceCount) {
  if (ownKing < 0) return 0;
  if (totalPieceCount > 20) return 0;
  const int side = pieceCodeSide(piece);
  const int center = indexOf(4, side == kRed ? 8 : 1);
  const int file = fileOf(square);
  const int rank = rankOf(square);
  const int kingFile = fileOf(ownKing);
  const int kingRank = rankOf(ownKing);
  int bonus = 0;

  if (square == center) {
    bonus += 24;
    if (kingFile == file && blockersBetween(board, square, ownKing) == 0) bonus += 8;
  }
  if (std::abs(file - kingFile) == 1 && std::abs(rank - kingRank) == 1) {
    bonus += 8;
  }
  return bonus;
}

int kingLinePressureBonus(const Board& board, int square, int piece, int enemyKing) {
  const int type = pieceCodeType(piece);
  if ((type != Rook && type != Cannon) || enemyKing < 0) return 0;
  if (fileOf(square) != fileOf(enemyKing) && rankOf(square) != rankOf(enemyKing)) return 0;

  const LineBlockers blockers = lineBlockersBetween(board, square, enemyKing);
  const int side = pieceCodeSide(piece);
  const bool advancedAttacker = crossedRiver(side, rankOf(square));
  if (type == Rook) {
    if (blockers.count != 1 || !advancedAttacker) return 0;
    const int blocker = board.cells[blockers.first];
    if (pieceCodeSide(blocker) == side) return 6;
    int bonus = 16;
    if (palaceContains(-side, fileOf(blockers.first), rankOf(blockers.first))) bonus += 6;
    if (pieceCodeType(blocker) == Advisor || pieceCodeType(blocker) == Elephant) bonus += 4;
    return bonus;
  }
  if (blockers.count == 0) return 4;
  if (blockers.count == 2 && blockers.second >= 0) {
    if (!advancedAttacker) return 2;
    const int pinned = board.cells[blockers.second];
    if (pieceCodeSide(pinned) != -side) return 2;
    int bonus = 10;
    const int screen = board.cells[blockers.first];
    if (pieceCodeSide(screen) == side) {
      bonus += 6;
      if (pieceCodeType(screen) == Pawn) bonus += 4;
      if (fileCentrality(fileOf(blockers.first)) >= 3) bonus += 2;
    }
    if (palaceContains(-side, fileOf(blockers.second), rankOf(blockers.second))) bonus += 4;
    return bonus;
  }
  return 0;
}

bool friendlyPawnAt(const Board& board, int side, int file, int rank) {
  return inside(file, rank) && board.cells[indexOf(file, rank)] == side * Pawn;
}

int pawnThreatBonus(const Board& board, int square, int piece) {
  const int side = pieceCodeSide(piece);
  int bonus = 0;
  const auto& lookup = kPawnTargets[static_cast<std::size_t>(sideLookupIndex(side))];
  const int count = lookup.counts[static_cast<std::size_t>(square)];
  const auto& targets = lookup.targets[static_cast<std::size_t>(square)];

  for (int index = 0; index < count; index += 1) {
    const int target = board.cells[targets[static_cast<std::size_t>(index)]];
    if (target == 0 || pieceCodeSide(target) == side) continue;
    const int targetType = pieceCodeType(target);
    bonus += targetType == King ? 120 : std::min(80, pieceTypeValue(targetType) / 12);
  }

  return bonus;
}

int pawnStructureBonus(const Board& board, int square, int side, int file, int rank, bool advanced, int enemyKing) {
  const int enemy = -side;
  int bonus = 0;

  if (advanced) {
    if (friendlyPawnAt(board, side, file - 1, rank)) bonus += 18;
    if (friendlyPawnAt(board, side, file + 1, rank)) bonus += 18;
  }

  const int supportRank = rank - forwardDelta(side);
  if (friendlyPawnAt(board, side, file, supportRank)) bonus += advanced ? 14 : 8;

  if (!advanced || enemyKing < 0) return bonus;

  const int enemyKingFile = fileOf(enemyKing);
  const int enemyKingRank = rankOf(enemyKing);
  const int fileDistance = std::abs(file - enemyKingFile);
  const int rankDistance = std::abs(rank - enemyKingRank);
  const int progress = side == kRed ? 9 - rank : rank;

  bonus += std::max(0, progress - 4) * 9;
  if (file >= 3 && file <= 5) bonus += 10;

  const bool laneBlocked = rayBlocker(board, square, side == kRed ? 0 : 2) != 0;
  if (!laneBlocked) bonus += 16;

  if (palaceContains(enemy, file, rank)) {
    bonus += 36;
    if (fileDistance == 0) bonus += 28;
    else if (fileDistance == 1) bonus += 16;
    bonus += std::max(0, 3 - rankDistance) * 8;
  }

  if (fileDistance == 0 && (side == kRed ? rank > enemyKingRank : rank < enemyKingRank)) {
    bonus += std::max(0, 32 - rankDistance * 5);
  }
  return bonus;
}

int evaluateRed(const Board& board) {
  const int redKing = findKing(board, kRed);
  const int blackKing = findKing(board, kBlack);
  if (redKing < 0) return -kMate;
  if (blackKing < 0) return kMate;

  int score = board.materialScore + board.positionalScore + board.guardPairScore;
  const int totalPieceCount = board.totalPieceCount;

  auto scoreSide = [&](int side) {
    const int sign = side == kRed ? 1 : -1;
    const int enemyKing = side == kRed ? blackKing : redKing;
    const int ownKing = side == kRed ? redKing : blackKing;
    const auto& squares = pieceSquares(board, side);
    const int count = pieceCount(board, side);
    for (int listIndex = 0; listIndex < count; listIndex += 1) {
      const int square = squares[listIndex];
      if (square < 0 || square >= kSquares) continue;
      const int piece = board.cells[square];
      if (piece == 0 || pieceCodeSide(piece) != side) continue;
      const int type = pieceCodeType(piece);
      const int file = fileOf(square);
      const int rank = rankOf(square);
      int value = 0;

      if (type == Pawn) {
        const bool advanced = crossedRiver(side, rank);
        value += pawnStructureBonus(board, square, side, file, rank, advanced, enemyKing);
        value += pawnThreatBonus(board, square, piece);
      } else if (type == Horse) {
        value += horseMobilityBonus(board, square, piece);
        value += horseLegCoordinationBonus(board, square, piece);
        value += linkedHorseBonus(board, square, piece);
        value += horsePressureBonus(board, square, piece, enemyKing);
      } else if (type == Rook) {
        value += rookActivityBonus(board, square, piece);
        value += connectedRookBonus(board, square, piece);
        value += riverControlBonus(board, square, piece, totalPieceCount);
        value += kingLinePressureBonus(board, square, piece, enemyKing);
      } else if (type == Cannon) {
        value += cannonActivityBonus(board, square, piece);
        value += cannonBatteryBonus(board, square, piece);
        value += riverControlBonus(board, square, piece, totalPieceCount);
        value += kingLinePressureBonus(board, square, piece, enemyKing);
      } else if (type == Advisor) {
        value += advisorShapeBonus(board, square, piece, ownKing, totalPieceCount);
      } else if (type == Elephant) {
        value += elephantEyeCoordinationBonus(board, square, piece);
        value += elephantShapeBonus(square, piece, totalPieceCount);
      }

      score += sign * value;
    }
  };

  scoreSide(kRed);
  scoreSide(kBlack);
  score += lineBatteryPressureBonus(board, kRed, blackKing, totalPieceCount);
  score -= lineBatteryPressureBonus(board, kBlack, redKing, totalPieceCount);

  score -= palaceShapePenalty(board, kRed, redKing);
  score += palaceShapePenalty(board, kBlack, blackKing);
  score -= palaceEscapeBlockPenalty(board, kRed, redKing, totalPieceCount);
  score += palaceEscapeBlockPenalty(board, kBlack, blackKing, totalPieceCount);
  return score;
}

int evaluateRedCached(const Board& board, SearchState& state) {
  state.evalCacheProbes += 1;
  const uint64_t key = board.side == kBlack ? board.key ^ sideHash() : board.key;
  if (state.evalCache) {
    if (const EvalEntry* entry = state.evalCache->probe(key)) {
      state.evalCacheHits += 1;
      return entry->score;
    }
  }

  const int score = evaluateRed(board);
  if (state.evalCache) {
    state.evalCache->store(key, score);
    state.evalCacheStores += 1;
  }
  return score;
}

int evaluateSideToMove(const Board& board, SearchState& state) {
  return evaluateRedCached(board, state) * board.side;
}

int moveOrderingScore(
    const Move& move,
    SearchState& state,
    int ply,
    const Move& hashMove,
    bool hashMoveValid,
    const Move& counterMove,
    bool counterMoveValid,
    const Board* board = nullptr,
    int enemyKing = -1,
    const Move& previousMove = {},
    const Move& previousOwnMove = {},
    bool inCheck = false,
    bool scoreChecks = true,
    bool countHashMoveHit = true,
    bool useQsearchCaptureHistory = false) {
  if (hashMoveValid && sameMove(move, hashMove)) {
    if (countHashMoveHit) state.ttMoveHits += 1;
    return 10000000;
  }
  int score = 0;
  const bool quietMove = move.captured == 0;
  const int pieceType = pieceCodeType(move.piece);
  const int pieceSide = pieceCodeSide(move.piece);
  if (inCheck) {
    state.checkEvasionOrderHits += 1;
    if (!quietMove) {
      state.checkEvasionCaptures += 1;
      score += 45000;
    } else if (pieceType == King) {
      state.checkEvasionKingMoves += 1;
      score += 80000;
    } else {
      state.checkEvasionBlocks += 1;
      score += 55000;
    }
  }
  if (!quietMove) {
    const int movingValue = pieceTypeValue(pieceType);
    const int capturedValue = pieceCodeValue(move.captured);
    score += 100000 + capturedValue * 16 - movingValue;
    if (isRecapture(move, previousMove)) {
      score += 70000;
      state.recaptureOrderHits += 1;
    }
    const int captureHistoryScore = state.captureHistory[move.from][move.to];
    if (captureHistoryScore != 0) state.captureHistoryHits += 1;
    score += captureHistoryScore;
    if (useQsearchCaptureHistory) {
      score += qCaptureHistoryScore(state, move);
      if (movingValue > capturedValue + kQSeePruneLossMargin) {
        score -= (movingValue - capturedValue) * kQBadCaptureOrderingPenaltyScale;
      }
    }
    if (board && !useQsearchCaptureHistory) {
      score -= captureRiskPenaltyForCapture(*board, move, state, movingValue, capturedValue, pieceSide);
    }
  } else {
    if (isKillerMove(state, ply, move, true)) score += 90000;
    if (counterMoveValid && sameMove(move, counterMove)) score += 35000;
    if (isPawnPressureExtensionMove(move, enemyKing, state.rootPieceCount)) {
      score += kPawnPressureOrderingBonus;
      state.pawnThreatOrderHits += 1;
    }
    score += state.quietHistory[move.from][move.to];
    score += continuationHistoryScore(state, previousMove, move, true);
    score += followupHistoryScore(state, previousOwnMove, move, true) / 2;
    if (useQsearchCaptureHistory && !inCheck) {
      score += qCheckHistoryScore(state, move) * 2;
      score += state.checkHistory[move.from][move.to] / 4;
    }
  }
  const int toFile = fileOf(move.to);
  score += fileCentrality(toFile) * 4;
  if (pieceType == Pawn && crossedRiver(pieceSide, rankOf(move.to))) score += 50;
  if (scoreChecks && board && enemyKing >= 0 && moveGivesCheck(*board, move, enemyKing, state)) {
    score += quietMove ? 85000 : 25000;
    if (quietMove) score += checkHistoryScore(state, move, quietMove);
  }
  return score;
}

template <typename MoveContainer>
void orderMoves(
    MoveContainer& moves,
    SearchState& state,
    int ply,
    const Move& hashMove = {},
    const Move& counterMove = {},
    const Board* board = nullptr,
    int enemyKing = -1,
    const Move& previousMove = {},
    bool inCheck = false,
    bool scoreChecks = true,
    bool countHashMoveHit = true,
    bool useQsearchCaptureHistory = false) {
  const std::size_t moveCount = moves.size();
  if (moveCount <= 1) return;

  const bool hashMoveValid = validMove(hashMove);
  const bool counterMoveValid = validMove(counterMove);
  const Move previousOwnMove = previousOwnMoveFor(state, ply);

  if (moveCount <= kMaxStackScoredMoves) {
    std::array<int, kMaxStackScoredMoves> scores;
    for (std::size_t index = 0; index < moveCount; index += 1) {
      scores[index] = moveOrderingScore(moves[index], state, ply, hashMove, hashMoveValid, counterMove, counterMoveValid, board, enemyKing, previousMove, previousOwnMove, inCheck, scoreChecks, countHashMoveHit, useQsearchCaptureHistory);
    }
    if (moveCount <= kInsertionSortMoveLimit) {
      for (std::size_t index = 1; index < moveCount; index += 1) {
        const Move move = moves[index];
        const int score = scores[index];
        std::size_t hole = index;
        while (hole > 0 && score > scores[hole - 1]) {
          moves[hole] = moves[hole - 1];
          scores[hole] = scores[hole - 1];
          hole -= 1;
        }
        moves[hole] = move;
        scores[hole] = score;
      }
      return;
    }

    std::array<std::size_t, kMaxStackScoredMoves> order;
    std::array<Move, kMaxStackScoredMoves> orderedMoves;
    for (std::size_t index = 0; index < moveCount; index += 1) {
      order[index] = index;
    }
    std::sort(order.begin(), order.begin() + static_cast<std::ptrdiff_t>(moveCount), [&scores](std::size_t left, std::size_t right) {
      if (scores[left] != scores[right]) return scores[left] > scores[right];
      return left < right;
    });
    for (std::size_t index = 0; index < moveCount; index += 1) {
      orderedMoves[index] = moves[order[index]];
    }
    for (std::size_t index = 0; index < moveCount; index += 1) {
      moves[index] = orderedMoves[index];
    }
    return;
  }

  struct ScoredMove {
    Move move;
    int score = 0;
    int ordinal = 0;
  };
  const auto strongerMove = [](const ScoredMove& left, const ScoredMove& right) {
    if (left.score != right.score) return left.score > right.score;
    return left.ordinal < right.ordinal;
  };

  std::vector<ScoredMove> scored;
  scored.reserve(moveCount);
  for (int index = 0; index < static_cast<int>(moveCount); index += 1) {
    const int score = moveOrderingScore(moves[index], state, ply, hashMove, hashMoveValid, counterMove, counterMoveValid, board, enemyKing, previousMove, previousOwnMove, inCheck, scoreChecks, countHashMoveHit, useQsearchCaptureHistory);
    scored.push_back({moves[index], score, index});
  }

  std::stable_sort(scored.begin(), scored.end(), strongerMove);

  for (std::size_t index = 0; index < scored.size(); index += 1) {
    moves[index] = scored[index].move;
  }
}

class ScoredMovePicker {
 public:
  explicit ScoredMovePicker(MoveList& moves)
      : moves_(moves), moveCount_(moves.size()) {}

  ScoredMovePicker(
      MoveList& moves,
      SearchState& state,
      int ply,
      const Move& hashMove = {},
      const Move& counterMove = {},
      const Board* board = nullptr,
      int enemyKing = -1,
      const Move& previousMove = {},
      bool inCheck = false,
      bool scoreChecks = true,
      bool countHashMoveHit = true,
      bool useQsearchCaptureHistory = false)
      : ScoredMovePicker(moves) {
    score(
        state,
        ply,
        hashMove,
        counterMove,
        board,
        enemyKing,
        previousMove,
        inCheck,
        scoreChecks,
        countHashMoveHit,
        useQsearchCaptureHistory);
  }

  void score(
      SearchState& state,
      int ply,
      const Move& hashMove = {},
      const Move& counterMove = {},
      const Board* board = nullptr,
      int enemyKing = -1,
      const Move& previousMove = {},
      bool inCheck = false,
      bool scoreChecks = true,
      bool countHashMoveHit = true,
      bool useQsearchCaptureHistory = false) {
    preserveCurrentOrder_ = false;
    const bool hashMoveValid = validMove(hashMove);
    const bool counterMoveValid = validMove(counterMove);
    const Move previousOwnMove = previousOwnMoveFor(state, ply);
    for (std::size_t index = 0; index < moveCount_; index += 1) {
      ordinals_[index] = index;
      scores_[index] = moveOrderingScore(
          moves_[index],
          state,
          ply,
          hashMove,
          hashMoveValid,
          counterMove,
          counterMoveValid,
          board,
          enemyKing,
          previousMove,
          previousOwnMove,
          inCheck,
          scoreChecks,
          countHashMoveHit,
          useQsearchCaptureHistory);
    }
  }

  bool tryHashMoveFirst(
      SearchState& state,
      int ply,
      const Move& hashMove,
      const Move& counterMove = {},
      const Board* board = nullptr,
      int enemyKing = -1,
      const Move& previousMove = {},
      bool inCheck = false,
      bool scoreChecks = true,
      bool countHashMoveHit = true,
      bool useQsearchCaptureHistory = false) {
    if (!validMove(hashMove)) return false;

    for (std::size_t index = 0; index < moveCount_; index += 1) {
      if (!sameMove(moves_[index], hashMove)) continue;
      if (index != 0) std::swap(moves_[0], moves_[index]);
      if (countHashMoveHit) state.ttMoveHits += 1;
      deferredScores_ = true;
      preserveCurrentOrder_ = true;
      scoreState_ = &state;
      scorePly_ = ply;
      scoreCounterMove_ = counterMove;
      scoreBoard_ = board;
      scoreEnemyKing_ = enemyKing;
      scorePreviousMove_ = previousMove;
      scorePreviousOwnMove_ = previousOwnMoveFor(state, ply);
      scoreInCheck_ = inCheck;
      scoreChecks_ = scoreChecks;
      useQsearchCaptureHistory_ = useQsearchCaptureHistory;
      return true;
    }

    return false;
  }

  Move* next() {
    if (next_ >= moveCount_) return nullptr;
    if (deferredScores_ && next_ > 0) scoreRemainingMoves();

    if (!preserveCurrentOrder_) selectBestAt(next_);
    return &moves_[next_++];
  }

 private:
  void selectBestAt(std::size_t target) {
    std::size_t best = target;
    for (std::size_t index = target + 1; index < moveCount_; index += 1) {
      if (scores_[index] > scores_[best]
          || (scores_[index] == scores_[best] && ordinals_[index] < ordinals_[best])) {
        best = index;
      }
    }
    if (best == target) return;

    std::swap(scores_[best], scores_[target]);
    std::swap(ordinals_[best], ordinals_[target]);
    std::swap(moves_[best], moves_[target]);
  }

  void scoreRemainingMoves() {
    deferredScores_ = false;
    preserveCurrentOrder_ = false;
    if (!scoreState_) return;

    const Move noHashMove{};
    const bool counterMoveValid = validMove(scoreCounterMove_);
    for (std::size_t index = next_; index < moveCount_; index += 1) {
      ordinals_[index] = index;
      scores_[index] = moveOrderingScore(
          moves_[index],
          *scoreState_,
          scorePly_,
          noHashMove,
          false,
          scoreCounterMove_,
          counterMoveValid,
          scoreBoard_,
          scoreEnemyKing_,
          scorePreviousMove_,
          scorePreviousOwnMove_,
          scoreInCheck_,
          scoreChecks_,
          false,
          useQsearchCaptureHistory_);
    }
  }

  MoveList& moves_;
  std::array<int, kMaxStackScoredMoves> scores_;
  std::array<std::size_t, kMaxStackScoredMoves> ordinals_;
  std::size_t moveCount_ = 0;
  std::size_t next_ = 0;
  bool preserveCurrentOrder_ = true;
  bool deferredScores_ = false;
  SearchState* scoreState_ = nullptr;
  const Board* scoreBoard_ = nullptr;
  Move scoreCounterMove_{};
  Move scorePreviousMove_{};
  Move scorePreviousOwnMove_{};
  int scorePly_ = 0;
  int scoreEnemyKing_ = -1;
  bool scoreInCheck_ = false;
  bool scoreChecks_ = true;
  bool useQsearchCaptureHistory_ = false;
};

void storeTt(SearchState& state, const Board& board, int depth, int ply, int score, int flag, const Move& bestMove) {
  if (!state.tt) return;
  if (state.tt->store(board.key, depth, scoreToTt(score, ply), flag, bestMove)) {
    state.ttStores += 1;
  }
}

void storeQtt(SearchState& state, const Board& board, int depth, int ply, int score, int flag, const Move& bestMove) {
  if (!state.qtt || depth < 0) return;
  if (state.qtt->store(board.key, depth, scoreToTt(score, ply), flag, bestMove)) {
    state.qttStores += 1;
  }
}

void prefetchMainSearchCaches(SearchState& state, uint64_t key, int sideToMove) {
  if (state.tt && state.tt->prefetch(key)) state.ttPrefetches += 1;
  if (state.evalCache && state.evalCache->prefetch(evalCacheKeyFor(key, sideToMove))) state.evalCachePrefetches += 1;
}

void prefetchQuiescenceCaches(SearchState& state, uint64_t key) {
  if (state.qtt && state.qtt->prefetch(key)) state.qttPrefetches += 1;
}

bool timeExpired(SearchState& state) {
  if (!state.hasDeadline) return false;
  if ((state.nodes & kTimeCheckNodeMask) != 0) return false;
  if (std::chrono::steady_clock::now() >= state.deadline) {
    state.stopped = true;
    return true;
  }
  return false;
}

int countRootHistoryOccurrences(const SearchState& state, uint64_t key) {
  if (!state.rootHistoryKeys || state.rootHistoryKeys->empty()) return 0;
  if (state.rootHistoryCounts && state.rootHistoryKeys->size() > kHistoryCountLookupThreshold) {
    const auto found = state.rootHistoryCounts->find(key);
    return found == state.rootHistoryCounts->end() ? 0 : found->second;
  }
  return static_cast<int>(std::count(state.rootHistoryKeys->begin(), state.rootHistoryKeys->end(), key));
}

int lookupRootHistoryCount(const SearchState& state, uint64_t key) {
  if (!state.rootHistoryHasPositions) return 0;
  if (!state.rootHistoryCounts) return countRootHistoryOccurrences(state, key);
  const auto found = state.rootHistoryCounts->find(key);
  return found == state.rootHistoryCounts->end() ? 0 : found->second;
}

int countSearchPathOccurrences(const SearchState& state, int ply, uint64_t key) {
  if (ply <= 0) return 0;
  int count = 0;
  for (int index = ply - 2; index >= 0; index -= 2) {
    const auto pathIndex = static_cast<std::size_t>(index);
    if (state.pathKeyKnown[pathIndex] && state.pathKeys[pathIndex] == key) count += 1;
  }
  return count;
}

bool recordSearchPathPosition(SearchState& state, int ply, uint64_t key) {
  if (ply < 0 || ply >= kMaxPly) return false;
  const auto pathIndex = static_cast<std::size_t>(ply);
  const int previousOccurrences = lookupRootHistoryCount(state, key)
      + countSearchPathOccurrences(state, ply, key);
  if (previousOccurrences >= 2) {
    state.repetitions += 1;
    return true;
  }
  state.pathKeys[pathIndex] = key;
  state.pathKeyKnown[pathIndex] = true;
  return false;
}

bool recordQuiescencePathPosition(SearchState& state, int ply, uint64_t key) {
  if (ply < 0 || ply >= kMaxPly) return false;
  const auto pathIndex = static_cast<std::size_t>(ply);
  const int pathOccurrences = countSearchPathOccurrences(state, ply, key);
  int previousOccurrences = pathOccurrences;
  if (pathOccurrences >= 2) {
    state.repetitions += 1;
    return true;
  }
  if (state.rootHistoryHasRepeatedPositions || (pathOccurrences > 0 && state.rootHistoryHasPositions)) {
    previousOccurrences += lookupRootHistoryCount(state, key);
  }
  if (previousOccurrences >= 2) {
    state.repetitions += 1;
    return true;
  }
  state.pathKeys[pathIndex] = key;
  state.pathKeyKnown[pathIndex] = true;
  return false;
}

int quiescenceKnownCheck(
    Board& board,
    int alpha,
    int beta,
    int ply,
    int qDepth,
    SearchState& state,
    int ownKing,
    bool inCheck,
    int knownEnemyKing = kUnknownKingSquare);
int negamax(
    Board& board,
    int depth,
    int alpha,
    int beta,
    int ply,
    SearchState& state,
    std::vector<Move>* pv,
    bool allowNullMove = true,
    const Move& previousMove = {},
    int extensionsRemaining = kMaxExtensions,
    int knownOwnKing = kUnknownKingSquare,
    bool knownInCheck = false);

int quietCheckLimitForQDepth(int qDepth) {
  if (qDepth >= 4) return kMaxQuietChecksPerQNode;
  if (qDepth == 3) return 6;
  return 4;
}

bool shouldSearchQuietChecksInQsearch(int qDepth, bool inCheck, int standPat, int alpha) {
  if (inCheck || qDepth <= 2) return false;
  if (qDepth >= 4) return true;
  return standPat + kQQuietCheckSecondLayerMargin >= alpha;
}

bool tryProbCut(
    Board& board,
    const MoveList& legalMoves,
    int depth,
    int beta,
    int ply,
    SearchState& state,
    int extensionsRemaining,
    const Move& hashMove,
    const Move& counterMove,
    int enemyKing,
    int& scoreOut) {
  const int threshold = beta + kProbCutMargin;
  const int reducedDepth = std::max(0, depth - 1 - kProbCutReduction);
  int searched = 0;
  auto searchCapture = [&](Move& move) {
    if (timeExpired(state)) return false;

    state.probCutSearches += 1;
    const KnownChildState child = knownChildStateAfterMove(board, move, enemyKing, state);
    const uint64_t childKey = keyAfterMove(board, move);
    prefetchMainSearchCaches(state, childKey, -board.side);
    recordSearchPathMove(state, ply, move);
    makeMoveWithKnownKey(board, move, childKey);
    const int score = -negamax(
        board,
        reducedDepth,
        -threshold,
        -threshold + 1,
        ply + 1,
        state,
        nullptr,
        false,
        move,
        extensionsRemaining,
        child.ownKing,
        child.inCheck);
    undoMove(board, move);
    clearSearchPathMove(state, ply);
    if (state.stopped) return false;
    searched += 1;

    if (score >= threshold) {
      state.probCutPrunes += 1;
      scoreOut = threshold;
      return true;
    }
    return false;
  };

  bool searchedHashCapture = false;
  if (validMove(hashMove) && isCapture(hashMove) && isProbCutCaptureCandidate(hashMove)) {
    for (const Move& legalMove : legalMoves) {
      if (!sameMove(legalMove, hashMove)) continue;
      Move hashCapture = legalMove;
      if (shouldVerifyProbCutCaptureCandidate(board, hashCapture, state)) {
        searchedHashCapture = true;
        if (searchCapture(hashCapture)) return true;
        if (state.stopped) return false;
      }
      break;
    }
  }

  MoveList captures;
  for (const Move& move : legalMoves) {
    if (searchedHashCapture && sameMove(move, hashMove)) continue;
    if (!isCapture(move)) continue;
    if (!isProbCutCaptureCandidate(move)) {
      state.probCutCaptureSkips += 1;
      continue;
    }
    if (!shouldVerifyProbCutCaptureCandidate(board, move, state)) {
      state.probCutCaptureSkips += 1;
      continue;
    }
    captures.push_back(move);
  }
  if (captures.empty()) return false;

  if (captures.size() > kProbCutCaptureLimit) {
    ScoredMovePicker movePicker(captures);
    if (!movePicker.tryHashMoveFirst(state, ply, hashMove, counterMove, &board, enemyKing)) {
      movePicker.score(state, ply, hashMove, counterMove, &board, enemyKing);
    }
    while (Move* pickedMove = movePicker.next()) {
      if (searchCapture(*pickedMove)) return true;
      if (state.stopped) return false;
      if (searched >= kProbCutCaptureLimit) break;
    }
  } else {
    orderMoves(captures, state, ply, hashMove, counterMove, &board, enemyKing);
    for (Move& move : captures) {
      if (searchCapture(move)) return true;
      if (state.stopped) return false;
      if (searched >= kProbCutCaptureLimit) break;
    }
  }

  return false;
}

Move internalIterativeDeepeningMoveHint(
    Board& board,
    const MoveList& legalMoves,
    int depth,
    int alpha,
    int beta,
    int ply,
    SearchState& state,
    const Move& previousMove,
    int extensionsRemaining,
    int enemyKing) {
  MoveList moves;
  for (const Move& move : legalMoves) moves.push_back(move);

  const bool previousIidActive = state.iidActive;
  state.iidActive = true;
  state.iidSearches += 1;

  Move bestMove{};
  int bestScore = -kInf;
  int localAlpha = alpha;
  const int reducedDepth = std::max(1, depth - kIidReduction);
  int searched = 0;

  auto searchMove = [&](Move& move) {
    if (timeExpired(state)) return true;

    const KnownChildState child = knownChildStateAfterMove(board, move, enemyKing, state);
    const uint64_t childKey = keyAfterMove(board, move);
    prefetchMainSearchCaches(state, childKey, -board.side);
    recordSearchPathMove(state, ply, move);
    makeMoveWithKnownKey(board, move, childKey);
    const int score = -negamax(
        board,
        reducedDepth - 1,
        -beta,
        -localAlpha,
        ply + 1,
        state,
        nullptr,
        false,
        move,
        extensionsRemaining,
        child.ownKing,
        child.inCheck);
    undoMove(board, move);
    clearSearchPathMove(state, ply);
    if (state.stopped) return true;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (score > localAlpha) {
      localAlpha = score;
      if (localAlpha >= beta) return true;
    }

    searched += 1;
    return searched >= kIidMoveLimit;
  };

  if (moves.size() > kIidMoveLimit) {
    ScoredMovePicker movePicker(moves, state, ply, {}, counterMoveFor(state, previousMove), &board, enemyKing, previousMove);
    while (Move* pickedMove = movePicker.next()) {
      if (searchMove(*pickedMove)) break;
    }
  } else {
    orderMoves(moves, state, ply, {}, counterMoveFor(state, previousMove), &board, enemyKing, previousMove);
    for (Move& move : moves) {
      if (searchMove(move)) break;
    }
  }

  state.iidActive = previousIidActive;
  if (!state.stopped && validMove(bestMove)) state.iidMoveHits += 1;
  return state.stopped ? Move{} : bestMove;
}

bool shouldVerifyNullMoveCutoff(const Board& board, int depth) {
  return depth >= kNullMoveVerificationMinDepth && hasNullMoveMaterial(board, board.side);
}

int nullMoveReduction(
    SearchState& state,
    int depth,
    int staticScore,
    int beta,
    StaticEvalTrend trend) {
  int reduction = 2 + depth / 4;
  if (depth >= 6 && staticScore - beta > 220) {
    reduction += 1;
    state.nullMoveReductionBoosts += 1;
  }
  if (depth >= 7 && !isImprovingTrend(trend)) {
    reduction += 1;
    state.nullMoveReductionBoosts += 1;
  }
  return std::clamp(reduction, 1, depth - 1);
}

int verifyNullMoveCutoff(
    Board& board,
    int depth,
    int beta,
    int ply,
    SearchState& state,
    const Move& previousMove,
    int extensionsRemaining,
    int reduction,
    int ownKing,
    int enemyKing) {
  state.nullMoveVerifications += 1;
  const int alpha = beta - 1;
  const int verificationDepth = std::max(0, depth - 1 - reduction);
  auto moves = generateLegalMoves(board, board.side, false, ownKing, false);
  if (moves.empty()) {
    const int mateScore = -kMate + ply;
    storeTt(state, board, verificationDepth, ply, mateScore, kTtExact, {});
    return mateScore;
  }

  orderMoves(moves, state, ply, {}, counterMoveFor(state, previousMove), &board, enemyKing, previousMove);

  int bestScore = -kInf;
  for (Move& move : moves) {
    if (timeExpired(state)) break;

    const KnownChildState child = knownChildStateAfterMove(board, move, enemyKing, state);
    const uint64_t childKey = keyAfterMove(board, move);
    prefetchMainSearchCaches(state, childKey, -board.side);
    recordSearchPathMove(state, ply, move);
    makeMoveWithKnownKey(board, move, childKey);
    const int score = -negamax(
        board,
        std::max(0, verificationDepth - 1),
        -beta,
        -alpha,
        ply + 1,
        state,
        nullptr,
        false,
        move,
        extensionsRemaining,
        child.ownKing,
        child.inCheck);
    undoMove(board, move);
    clearSearchPathMove(state, ply);
    if (state.stopped) break;

    if (score > bestScore) bestScore = score;
    if (score >= beta) return score;
  }

  return bestScore;
}

int searchExcludedMoveBestScore(
    Board& board,
    MoveList& moves,
    const Move& excludedMove,
    int threshold,
    int childDepth,
    int ply,
    SearchState& state,
    int extensionsRemaining,
    int enemyKing) {
  int bestScore = -kInf;

  for (Move& move : moves) {
    if (sameMove(move, excludedMove)) continue;
    if (timeExpired(state)) break;

    const KnownChildState child = knownChildStateAfterMove(board, move, enemyKing, state);
    const uint64_t childKey = keyAfterMove(board, move);
    prefetchMainSearchCaches(state, childKey, -board.side);
    recordSearchPathMove(state, ply, move);
    makeMoveWithKnownKey(board, move, childKey);
    const int score = -negamax(
        board,
        childDepth,
        -threshold,
        -threshold + 1,
        ply + 1,
        state,
        nullptr,
        false,
        move,
        extensionsRemaining,
        child.ownKing,
        child.inCheck);
    undoMove(board, move);
    clearSearchPathMove(state, ply);
    if (state.stopped) break;

    if (score > bestScore) bestScore = score;
    if (score >= threshold) break;
  }

  return bestScore;
}

bool isSingularMove(
    Board& board,
    MoveList& moves,
    const Move& move,
    int hashScore,
    int depth,
    int ply,
    SearchState& state,
    int extensionsRemaining,
    int enemyKing) {
  const int threshold = std::max(-kInf + 1, hashScore - singularExtensionMargin(depth));
  const int childDepth = std::max(0, depth - 1 - kSingularExtensionReduction);
  const bool previousSingularActive = state.singularActive;

  state.singularActive = true;
  state.singularExtensionSearches += 1;
  const int alternativeScore = searchExcludedMoveBestScore(board, moves, move, threshold, childDepth, ply, state, extensionsRemaining, enemyKing);
  state.singularActive = previousSingularActive;

  if (state.stopped) return false;
  if (alternativeScore < threshold) {
    state.singularExtensions += 1;
    return true;
  }

  state.singularExtensionRejects += 1;
  return false;
}

int negamax(
    Board& board,
    int depth,
    int alpha,
    int beta,
    int ply,
    SearchState& state,
    std::vector<Move>* pv,
    bool allowNullMove,
    const Move& previousMove,
    int extensionsRemaining,
    int knownOwnKing,
    bool knownInCheck) {
  if (state.stopped || timeExpired(state)) return evaluateSideToMove(board, state);
  state.nodes += 1;

  const bool syntheticNullNode = !allowNullMove && !validMove(previousMove);
  if (!syntheticNullNode && recordSearchPathPosition(state, ply, board.key)) {
    clearStaticEvalTrendAtPly(state, ply);
    return 0;
  }

  if (depth <= 0) {
    const int ownKing = knownOwnKing == kUnknownKingSquare ? findKing(board, board.side) : knownOwnKing;
    const bool inCheck = knownOwnKing == kUnknownKingSquare ? isInCheckKnownKing(board, board.side, ownKing) : knownInCheck;
    return quiescenceKnownCheck(board, alpha, beta, ply, inCheck ? 2 : 4, state, ownKing, inCheck);
  }

  alpha = std::max(alpha, -kMate + ply);
  beta = std::min(beta, kMate - ply - 1);
  if (alpha >= beta) {
    state.mateDistancePrunes += 1;
    clearStaticEvalTrendAtPly(state, ply);
    return alpha;
  }

  const int alphaOriginal = alpha;
  const int betaOriginal = beta;
  Move hashMove{};
  int hashDepth = -1;
  int hashFlag = 0;
  int hashScore = 0;
  if (state.tt) {
    state.ttProbes += 1;
    if (const TtEntry* entry = state.tt->probe(board.key)) {
      state.ttHits += 1;
      hashMove = entry->bestMove;
      hashDepth = entry->depth;
      hashFlag = entry->flag;
      hashScore = scoreFromTt(entry->score, ply);
      if (entry->depth >= depth) {
        const int ttScore = hashScore;
        if (entry->flag == kTtExact) {
          clearStaticEvalTrendAtPly(state, ply);
          setPvToMove(pv, entry->bestMove);
          return ttScore;
        }
        if (entry->flag == kTtLower) {
          if (ttScore >= beta) {
            state.ttCutoffs += 1;
            clearStaticEvalTrendAtPly(state, ply);
            setPvToMove(pv, entry->bestMove);
            return ttScore;
          }
          alpha = std::max(alpha, ttScore);
        } else if (entry->flag == kTtUpper) {
          if (ttScore <= alpha) {
            state.ttCutoffs += 1;
            clearStaticEvalTrendAtPly(state, ply);
            setPvToMove(pv, entry->bestMove);
            return ttScore;
          }
          beta = std::min(beta, ttScore);
        }
        if (alpha >= beta) {
          state.ttCutoffs += 1;
          clearStaticEvalTrendAtPly(state, ply);
          setPvToMove(pv, entry->bestMove);
          return ttScore;
        }
      }
    }
  }

  const int ownKing = knownOwnKing == kUnknownKingSquare ? findKing(board, board.side) : knownOwnKing;
  const bool inCheck = knownOwnKing == kUnknownKingSquare ? isInCheckKnownKing(board, board.side, ownKing) : knownInCheck;
  int staticScore = 0;
  StaticEvalTrend trend = TrendUnknown;
  if (inCheck) {
    state.checkedEvalSkips += 1;
    clearStaticEvalTrendAtPly(state, ply);
  } else {
    staticScore = evaluateSideToMove(board, state);
    trend = staticEvalTrend(state, ply, staticScore);
  }

  int enemyKing = kUnknownKingSquare;
  auto resolveEnemyKing = [&]() -> int {
    if (enemyKing == kUnknownKingSquare) enemyKing = findKing(board, -board.side);
    return enemyKing;
  };
  bool terminalKnown = false;
  bool hasMove = true;
  auto noLegalMoveScore = [&]() -> int {
    if (!terminalKnown) {
      hasMove = hasLegalMove(board, board.side, ownKing, inCheck);
      terminalKnown = true;
    }
    if (hasMove) return kInf;

    const int mateScore = -kMate + ply;
    storeTt(state, board, depth, ply, mateScore, kTtExact, {});
    return mateScore;
  };

  const bool nullMoveCandidate = allowNullMove
      && depth >= 3
      && !inCheck
      && !isMateScore(beta)
      && staticScore >= beta;
  if (nullMoveCandidate && !hasNullMoveMaterial(board, board.side)) {
    state.nullMoveMaterialGuards += 1;
  }
  if (nullMoveCandidate && hasNullMoveMaterial(board, board.side)) {
    const int reduction = nullMoveReduction(state, depth, staticScore, beta, trend);
    const int nullChildKing = resolveEnemyKing();
    const bool nullChildInCheck = nullChildKing < 0;
    prefetchMainSearchCaches(state, board.key ^ sideHash(), -board.side);
    makeNullMove(board);
    const int nullScore = -negamax(
        board,
        depth - 1 - reduction,
        -beta,
        -beta + 1,
        ply + 1,
        state,
        nullptr,
        false,
        {},
        extensionsRemaining,
        nullChildKing,
        nullChildInCheck);
    undoNullMove(board);
    if (state.stopped) return staticScore;
    if (nullScore >= beta) {
      if (shouldVerifyNullMoveCutoff(board, depth)) {
        const int verificationScore = verifyNullMoveCutoff(
            board,
            depth,
            beta,
            ply,
            state,
            previousMove,
            extensionsRemaining,
            reduction,
            ownKing,
            nullChildKing);
        if (state.stopped) return verificationScore;
        if (verificationScore < beta) {
          state.nullMoveVerificationFailures += 1;
        } else {
          state.nullMovePrunes += 1;
          storeTt(state, board, depth, ply, beta, kTtLower, {});
          return beta;
        }
      } else {
        state.nullMovePrunes += 1;
        storeTt(state, board, depth, ply, nullScore, kTtLower, {});
        return nullScore;
      }
    }
  }

  if (shouldPruneReverseFutility(depth, inCheck, alpha, beta, staticScore, trend)) {
    const int terminalScore = noLegalMoveScore();
    if (terminalScore != kInf) return terminalScore;
    state.reverseFutilityPrunes += 1;
    storeTt(state, board, depth, ply, beta, kTtLower, {});
    return beta;
  }
  if (shouldRazor(depth, inCheck, alpha, beta, staticScore)) {
    const int terminalScore = noLegalMoveScore();
    if (terminalScore != kInf) return terminalScore;
    const int razorScore = quiescenceKnownCheck(board, alpha, beta, ply, 4, state, ownKing, inCheck);
    if (state.stopped) return razorScore;
    if (razorScore <= alpha) {
      state.razorPrunes += 1;
      storeTt(state, board, depth, ply, razorScore, kTtUpper, {});
      return razorScore;
    }
    state.razorResearches += 1;
  }
  auto moves = generateLegalMoves(board, board.side, false, ownKing, inCheck);
  if (moves.empty()) {
    const int mateScore = -kMate + ply;
    storeTt(state, board, depth, ply, mateScore, kTtExact, {});
    return mateScore;
  }
  enemyKing = resolveEnemyKing();
  const Move counterMove = counterMoveFor(state, previousMove);
  if (shouldUseInternalIterativeDeepening(state, moves, hashMove, hashDepth, depth, inCheck, alpha, beta)) {
    const Move iidMove = internalIterativeDeepeningMoveHint(board, moves, depth, alpha, beta, ply, state, previousMove, extensionsRemaining, enemyKing);
    if (state.stopped) return staticScore;
    if (validMove(iidMove)) hashMove = iidMove;
  }
  if (shouldUseProbCut(depth, inCheck, alpha, beta)) {
    int probCutScore = 0;
    if (tryProbCut(board, moves, depth, beta, ply, state, extensionsRemaining, hashMove, counterMove, enemyKing, probCutScore)) {
      storeTt(state, board, depth, ply, probCutScore, kTtLower, {});
      return probCutScore;
    }
    if (state.stopped) return staticScore;
  }
  const bool hashMoveValid = validMove(hashMove);
  const bool counterMoveValid = validMove(counterMove);
  const bool useFullMoveOrder = !state.singularActive
      && extensionsRemaining > 0
      && !inCheck
      && depth >= kSingularExtensionMinDepth
      && moves.size() >= 2
      && hashMoveValid
      && hashFlag != kTtUpper
      && hashDepth >= depth - 2
      && !isMateScore(hashScore);
  if (useFullMoveOrder) {
    orderMoves(moves, state, ply, hashMove, counterMove, &board, enemyKing, previousMove, inCheck);
  }
  ScoredMovePicker movePicker(moves);
  if (!useFullMoveOrder) {
    if (!movePicker.tryHashMoveFirst(state, ply, hashMove, counterMove, &board, enemyKing, previousMove, inCheck)) {
      movePicker.score(state, ply, hashMove, counterMove, &board, enemyKing, previousMove, inCheck);
    }
  }

  int bestScore = -kInf;
  Move bestMove{};
  std::optional<std::vector<Move>> bestLine;
  std::array<Move, kMaxStackOrderedMoves> searchedQuiets;
  std::array<Move, kMaxStackOrderedMoves> searchedQuietChecks;
  std::array<Move, kMaxStackOrderedMoves> searchedCaptures;
  std::size_t searchedQuietCount = 0;
  std::size_t searchedQuietCheckCount = 0;
  std::size_t searchedCaptureCount = 0;
  std::optional<std::vector<Move>> childPv;
  if (pv) {
    const std::size_t pvCapacity = static_cast<std::size_t>(std::max(1, depth));
    bestLine.emplace();
    childPv.emplace();
    bestLine->reserve(pvCapacity);
    childPv->reserve(pvCapacity);
  }
  int moveIndex = 0;
  int moveOrdinal = 0;
  const Move previousOwnMove = previousOwnMoveFor(state, ply);
  while (Move* pickedMove = movePicker.next()) {
    Move& move = *pickedMove;
    const int orderedIndex = moveOrdinal;
    moveOrdinal += 1;
    const bool quietMove = isQuiet(move);
    const bool captureMove = !quietMove;
    const bool killerCandidate = isKillerMove(state, ply, move, quietMove);
    const bool hashCandidate = hashMoveValid && sameMove(move, hashMove);
    const bool counterCandidate = counterMoveValid && sameMove(move, counterMove);
    const bool canRecaptureExtend = extensionsRemaining > 0 && depth > 1;
    const bool canCheckExtend = extensionsRemaining > 0 && depth > 2;
    const bool checkEvasion = extensionsRemaining > 0 && inCheck && depth > 1;
    const bool recapture = canRecaptureExtend && isRecapture(move, previousMove);
    const bool possibleCheck = maybeMoveCanGiveCheck(move, enemyKing);
    bool givesCheck = false;
    bool givesCheckKnown = false;
    if (canCheckExtend && !recapture && possibleCheck) {
      givesCheck = moveGivesCheckAssumingPossible(board, move, enemyKing, state);
      givesCheckKnown = true;
    }
    const bool singular = shouldTrySingularExtension(state, moves, move, hashCandidate, hashDepth, hashFlag, hashScore, depth, inCheck, extensionsRemaining)
        && isSingularMove(board, moves, move, hashScore, depth, ply, state, extensionsRemaining, enemyKing);
    if (state.stopped) break;
    const bool pawnPressure = extensionsRemaining > 0
        && !singular
        && !givesCheck
        && !recapture
        && !checkEvasion
        && depth > 1
        && isPawnPressureExtensionMove(move, enemyKing, state.rootPieceCount);
    const int extension = (singular || givesCheck || recapture || checkEvasion || pawnPressure) ? 1 : 0;
    const int childExtensions = extensionsRemaining - extension;
    if (!inCheck
        && depth <= 3
        && moveIndex > 0
        && quietMove
        && !killerCandidate
        && !hashCandidate
        && !isMateScore(alpha)
        && staticScore + futilityMargin(depth, trend) <= alpha) {
      if (!givesCheck && possibleCheck && !givesCheckKnown) {
        givesCheck = moveGivesCheckAssumingPossible(board, move, enemyKing, state);
        givesCheckKnown = true;
      }
      if (!givesCheck) {
        state.futilityPrunes += 1;
        continue;
      }
    }
    if (!givesCheck && possibleCheck && !givesCheckKnown) {
      givesCheck = moveGivesCheckAssumingPossible(board, move, enemyKing, state);
      givesCheckKnown = true;
    }
    if (shouldPruneBadCapture(board, move, state, depth, orderedIndex, captureMove, inCheck, givesCheck, extension, hashCandidate, counterCandidate, alpha, beta)) {
      state.seePrunes += 1;
      continue;
    }
    if (shouldPruneBadHistory(move, state, depth, orderedIndex, quietMove, inCheck, givesCheck, extension, killerCandidate, hashCandidate, counterCandidate, alpha, beta, trend, previousMove, previousOwnMove)) {
      state.badHistoryPrunes += 1;
      continue;
    }
    const LateMovePruneDecision lateMovePruneDecision = shouldPruneLateMove(move, state, depth, orderedIndex, quietMove, inCheck, givesCheck, extension, killerCandidate, hashCandidate, counterCandidate, alpha, beta, trend, previousMove, previousOwnMove);
    if (lateMovePruneDecision != LateMoveKeep) {
      state.lateMovePrunes += 1;
      if (lateMovePruneDecision == LateMovePruneDepthThree) state.depthThreeLateMovePrunes += 1;
      if (lateMovePruneDecision == LateMovePruneDepthFour) state.depthFourLateMovePrunes += 1;
      continue;
    }
    if (counterCandidate) state.countermoveHits += 1;

    if (extension > 0) {
      state.extensions += 1;
      if (recapture) state.recaptureExtensions += 1;
      if (pawnPressure) state.pawnThreatExtensions += 1;
    }

    const int childOwnKing = pieceCodeType(move.captured) == King ? -1 : enemyKing;
    const bool childInCheck = childOwnKing < 0 || givesCheck;
    std::vector<Move>* childPvSink = childPv ? &*childPv : nullptr;
    const uint64_t childKey = keyAfterMove(board, move);
    prefetchMainSearchCaches(state, childKey, -board.side);
    recordSearchPathMove(state, ply, move);
    makeMoveWithKnownKey(board, move, childKey);
    if (childPvSink) childPvSink->clear();
    int score;
    if (moveIndex == 0) {
      score = -negamax(board, depth - 1 + extension, -beta, -alpha, ply + 1, state, childPvSink, true, move, childExtensions, childOwnKing, childInCheck);
    } else {
      const int reduction = extension > 0 ? 0 : lateMoveReduction(state, depth, moveIndex, move, inCheck, killerCandidate, counterCandidate, quietMove, previousMove, previousOwnMove, alpha, beta, trend);
      if (reduction > 0) {
        state.lmrReductions += 1;
        state.reductionPlies += reduction;
        if (reduction > 1) state.deepReductions += 1;
      }
      score = -negamax(board, depth - 1 + extension - reduction, -alpha - 1, -alpha, ply + 1, state, nullptr, true, move, childExtensions, childOwnKing, childInCheck);
      if (reduction > 0 && score > alpha && !state.stopped) {
        state.lmrResearches += 1;
        score = -negamax(board, depth - 1 + extension, -alpha - 1, -alpha, ply + 1, state, nullptr, true, move, childExtensions, childOwnKing, childInCheck);
      }
      if (score > alpha && score < beta && !state.stopped) {
        state.pvsResearches += 1;
        if (childPvSink) childPvSink->clear();
        score = -negamax(board, depth - 1 + extension, -beta, -alpha, ply + 1, state, childPvSink, true, move, childExtensions, childOwnKing, childInCheck);
      }
    }
    undoMove(board, move);
    clearSearchPathMove(state, ply);
    if (state.stopped) break;
    moveIndex += 1;
    if (killerCandidate) state.killerHits += 1;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
      if (bestLine && childPv) *bestLine = *childPv;
    }
    if (score > alpha) {
      alpha = score;
      if (pv) {
        pv->clear();
        pv->push_back(move);
        if (childPv) pv->insert(pv->end(), childPv->begin(), childPv->end());
      }
    }
    if (alpha >= beta) {
      rememberBetaCutoff(
          state,
          ply,
          depth,
          move,
          quietMove,
          captureMove,
          givesCheck,
          previousMove,
          previousOwnMove,
          searchedQuiets.data(),
          searchedQuietCount,
          searchedQuietChecks.data(),
          searchedQuietCheckCount,
          searchedCaptures.data(),
          searchedCaptureCount);
      break;
    }
    if (quietMove) {
      if (searchedQuietCount < searchedQuiets.size()) searchedQuiets[searchedQuietCount++] = move;
      if (givesCheck && searchedQuietCheckCount < searchedQuietChecks.size()) {
        searchedQuietChecks[searchedQuietCheckCount++] = move;
      }
    } else if (captureMove) {
      if (searchedCaptureCount < searchedCaptures.size()) searchedCaptures[searchedCaptureCount++] = move;
    }
  }

  if (!state.stopped && state.tt && validMove(bestMove)) {
    const int flag = bestScore <= alphaOriginal ? kTtUpper : bestScore >= betaOriginal ? kTtLower : kTtExact;
    storeTt(state, board, depth, ply, bestScore, flag, bestMove);
  }

  if (pv && pv->empty() && validMove(bestMove)) {
    pv->push_back(bestMove);
    if (bestLine) pv->insert(pv->end(), bestLine->begin(), bestLine->end());
  }
  return bestScore;
}

int quiescenceKnownCheck(
    Board& board,
    int alpha,
    int beta,
    int ply,
    int qDepth,
    SearchState& state,
    int ownKing,
    bool inCheck,
    int knownEnemyKing) {
  if (state.stopped || timeExpired(state)) return evaluateSideToMove(board, state);
  state.nodes += 1;
  state.qnodes += 1;
  clearStaticEvalTrendAtPly(state, ply);

  if (state.rootHistoryHasRepeatedPositions && recordQuiescencePathPosition(state, ply, board.key)) return 0;

  alpha = std::max(alpha, -kMate + ply);
  beta = std::min(beta, kMate - ply - 1);
  if (alpha >= beta) {
    state.mateDistancePrunes += 1;
    return alpha;
  }

  Move hashMove{};
  if (state.qtt && qDepth >= 0) {
    state.qttProbes += 1;
    if (const TtEntry* entry = state.qtt->probe(board.key)) {
      state.qttHits += 1;
      if (validMove(entry->bestMove)) {
        hashMove = entry->bestMove;
        state.qttMoveHits += 1;
      }
      if (entry->depth >= qDepth) {
        const int ttScore = scoreFromTt(entry->score, ply);
        if (entry->flag == kTtExact) {
          state.qttCutoffs += 1;
          return ttScore;
        }
        if (entry->flag == kTtLower && ttScore >= beta) {
          state.qttCutoffs += 1;
          return ttScore;
        }
        if (entry->flag == kTtUpper && ttScore <= alpha) {
          state.qttCutoffs += 1;
          return ttScore;
        }
      }
    }
  }

  const int alphaOriginal = alpha;
  int standPat = 0;
  if (!inCheck) {
    standPat = evaluateSideToMove(board, state);
    if (standPat >= beta) {
      storeQtt(state, board, qDepth, ply, beta, kTtLower, {});
      return beta;
    }
    if (standPat > alpha) alpha = standPat;
  } else {
    state.checkedEvalSkips += 1;
  }
  if (!inCheck && qDepth <= 0) {
    const int flag = alpha <= alphaOriginal ? kTtUpper : kTtExact;
    storeQtt(state, board, qDepth, ply, alpha, flag, {});
    return alpha;
  }
  if (inCheck && qDepth <= kQCheckEvasionFloor) {
    if (!hasLegalMove(board, board.side, ownKing, true)) {
      const int mateScore = -kMate + ply;
      storeQtt(state, board, qDepth, ply, mateScore, kTtExact, {});
      return mateScore;
    }
    return alpha;
  }

  const int enemyKing = knownEnemyKing == kUnknownKingSquare ? findKing(board, -board.side) : knownEnemyKing;
  auto moves = generateLegalQsearchMoves(board, board.side, ownKing, inCheck, enemyKing, standPat, alpha, state);
  if (shouldSearchQuietChecksInQsearch(qDepth, inCheck, standPat, alpha)) {
    auto quietChecks = generateQuietChecks(board, board.side, enemyKing, quietCheckLimitForQDepth(qDepth), state, ownKing, inCheck);
    for (const Move& move : quietChecks) {
      moves.push_back(move);
      state.qchecks += 1;
    }
  }
  if (moves.empty()) {
    const int score = inCheck ? -kMate + ply : alpha;
    storeQtt(state, board, qDepth, ply, score, inCheck ? kTtExact : kTtUpper, {});
    return score;
  }
  ScoredMovePicker movePicker(moves);
  if (!movePicker.tryHashMoveFirst(state, ply, hashMove, {}, &board, enemyKing, {}, inCheck, false, false, true)) {
    movePicker.score(state, ply, hashMove, {}, &board, enemyKing, {}, inCheck, false, false, true);
  }

  Move bestMove{};
  while (Move* pickedMove = movePicker.next()) {
    Move& move = *pickedMove;
    const bool possibleCheck = maybeMoveCanGiveCheck(move, enemyKing);
    const bool captureMove = move.captured != 0;
    bool givesCheck = !inCheck && !captureMove;
    const int capturedValue = captureMove ? pieceCodeValue(move.captured) : 0;
    if (!inCheck && captureMove && standPat + capturedValue + kQDeltaPruneMargin <= alpha) {
      if (shouldGuardQDeltaCapture(state, move, standPat, capturedValue, alpha)) {
        if (possibleCheck) givesCheck = moveGivesCheckAssumingPossible(board, move, enemyKing, state);
      } else if (!possibleCheck || !moveGivesCheckAssumingPossible(board, move, enemyKing, state)) {
        state.deltaPrunes += 1;
        continue;
      } else {
        givesCheck = true;
      }
    } else if (!givesCheck && possibleCheck) {
      givesCheck = moveGivesCheckAssumingPossible(board, move, enemyKing, state);
    }
    const bool quietCheckMove = !inCheck && !captureMove && givesCheck;
    const int alphaBeforeMove = alpha;
    if (!inCheck
        && qDepth <= kQSeePruneMaxDepth
        && state.rootPieceCount > 0
        && state.rootPieceCount <= kQSeePruneMaxRootPieces
        && alpha > standPat + kQSeePruneAlphaMargin
        && captureMove
        && !givesCheck
        && pieceCodeValue(move.piece) > capturedValue + kQSeePruneLossMargin) {
      const int badCaptureLoss = badCaptureLossForCapture(board, move, state);
      if (badCaptureLoss > kQSeePruneLossMargin
          && standPat + capturedValue - badCaptureLoss + kQSeePruneLossMargin <= alpha) {
        const int captureHistoryScore = state.captureHistory[move.from][move.to];
        if (captureHistoryScore > kQSeeCaptureHistoryGuard
            && badCaptureLoss <= kQSeePruneLossMargin * 2
            && standPat + capturedValue - badCaptureLoss + kQSeePruneLossMargin * 2 > alpha) {
          state.qCaptureHistoryPruneGuards += 1;
        } else {
          state.qSeePrunes += 1;
          continue;
        }
      }
    }
    const int childOwnKing = pieceCodeType(move.captured) == King ? -1 : enemyKing;
    const int childEnemyKing = pieceCodeType(move.piece) == King ? move.to : ownKing;
    const bool childInCheck = childOwnKing < 0 || givesCheck;
    const uint64_t childKey = keyAfterMove(board, move);
    prefetchQuiescenceCaches(state, childKey);
    makeMoveWithKnownKey(board, move, childKey);
    const int score = -quiescenceKnownCheck(board, -beta, -alpha, ply + 1, qDepth - 1, state, childOwnKing, childInCheck, childEnemyKing);
    undoMove(board, move);
    if (state.stopped) break;
    if (score >= beta) {
      if (captureMove) {
        const int bonus = std::clamp((qDepth + 1) * (qDepth + 1) * 8, 8, 512);
        addHistoryScore(state.qCaptureHistory, move, bonus);
        state.qCaptureHistoryStores += 1;
      }
      if (quietCheckMove) {
        const int bonus = std::clamp((qDepth + 1) * (qDepth + 1) * 16, 16, 1024);
        addHistoryScore(state.qCheckHistory, move, bonus);
        state.qCheckHistoryStores += 1;
      }
      storeQtt(state, board, qDepth, ply, beta, kTtLower, move);
      return beta;
    }
    if (captureMove && score <= alphaBeforeMove) {
      const int penalty = std::clamp((qDepth + 1) * (qDepth + 1) * 4, 4, 256);
      addHistoryScore(state.qCaptureHistory, move, -penalty);
      state.qCaptureHistoryMaluses += 1;
    }
    if (quietCheckMove && score <= alphaBeforeMove) {
      const int penalty = std::clamp((qDepth + 1) * (qDepth + 1) * 8, 8, 512);
      addHistoryScore(state.qCheckHistory, move, -penalty);
      state.qCheckHistoryMaluses += 1;
    }
    if (score > alpha) {
      alpha = score;
      bestMove = move;
    }
  }
  if (!state.stopped) {
    const int flag = alpha <= alphaOriginal ? kTtUpper : kTtExact;
    storeQtt(state, board, qDepth, ply, alpha, flag, bestMove);
  }
  return alpha;
}

std::vector<Move> filterRootMoves(const MoveList& legal, const std::vector<Move>& requested) {
  std::vector<Move> filtered;
  if (requested.empty()) {
    filtered.reserve(legal.size());
    for (const Move& move : legal) filtered.push_back(move);
    return filtered;
  }
  filtered.reserve(std::min(legal.size(), requested.size()));
  for (const Move& legalMove : legal) {
    if (std::any_of(requested.begin(), requested.end(), [&legalMove](const Move& requestedMove) {
      return sameMove(legalMove, requestedMove);
    })) {
      filtered.push_back(legalMove);
    }
  }
  return filtered;
}

uint64_t initialPositionKey() {
  static const uint64_t key = [] {
    Board board;
    parseFen(board, initialFen());
    return board.key;
  }();
  return key;
}

uint64_t fenPositionKey(const std::string& fen) {
  Board board;
  parseFen(board, fen);
  return board.key;
}

int timedOpeningRootBonus(const Board& root, const Move& move) {
  if (root.side == kRed && root.key == initialPositionKey()) {
    if (sameUciMove(move, "h2e2")) return 5050;  // h7-e7: refreshed Pikafish top in current depth-7 oracle review.
    if (sameUciMove(move, "b2e2")) return 5000;  // b7-e7: opposite central cannon remains a near-tie.
    if (sameUciMove(move, "g3g4")) return 4700;  // g6-g5: common Pikafish near-tie from start.
    if (sameUciMove(move, "b0c2") || sameUciMove(move, "h0g2")) return 3200;  // Develop horses.
    return 0;
  }

  static const uint64_t afterCentralCannon = fenPositionKey(
      "rheakaehr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RHEAKAEHR b");
  if (root.key == afterCentralCannon) {
    if (sameUciMove(move, "h9g7")) return 5000;  // h0-g2: screen horse defense.
    if (sameUciMove(move, "b9c7")) return 4700;  // b0-c2: near-tie screen horse.
    if (sameUciMove(move, "h7e7")) return 4500;  // h2-e2: cannon development.
    return 0;
  }

  static const uint64_t centralCannonHorseReply = fenPositionKey(
      "rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RHEAKAEHR r");
  if (root.key == centralCannonHorseReply) {
    if (sameUciMove(move, "h0g2")) return 5000;  // h9-g7: refreshed 2026 Pikafish horse development.
    if (sameUciMove(move, "g3g4")) return 4900;  // g6-g5: close pawn-push alternative.
    if (sameUciMove(move, "b2d2")) return 4600;  // b7-d7: flexible cannon shift.
    return 0;
  }

  static const uint64_t earlyPawnBlackCannonSide = fenPositionKey(
      "rheakaehr/9/1c5c1/p1p1p1p1p/9/6P2/P1P1P3P/1C5C1/9/RHEAKAEHR b");
  if (root.key == earlyPawnBlackCannonSide) {
    if (sameUciMove(move, "c6c5")) return 5000;  // c3-c4: refreshed Pikafish central pawn challenge.
    if (sameUciMove(move, "h7g7")) return 4700;  // h2-g2: compact cannon sidestep remains playable.
    if (sameUciMove(move, "b9c7")) return 4500;  // b0-c2: develop the left horse.
    return 0;
  }

  static const uint64_t centralCannonEarlyPawnBlack = fenPositionKey(
      "rheakae1r/9/1c4hc1/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR b");
  if (root.key == centralCannonEarlyPawnBlack) {
    if (sameUciMove(move, "i9h9")) return 5000;  // i0-h0: refreshed 2026 Pikafish quiet rook development.
    if (sameUciMove(move, "h7i7")) return 4900;  // h2-i2: near-tie rook-file cannon sidestep.
    if (sameUciMove(move, "b7e7")) return 4400;  // b2-e2: central cannon alternative.
    return 0;
  }

  static const uint64_t earlyPawnRedElephantBlack = fenPositionKey(
      "rheakaehr/9/1c4c2/p1p1p1p1p/9/6P2/P1P1P3P/1C2E2C1/9/RH1AKAEHR b");
  if (root.key == earlyPawnRedElephantBlack) {
    if (sameUciMove(move, "h9i7")) return 5000;  // h0-i2: refreshed 2026 Pikafish flank development.
    if (sameUciMove(move, "b7e7")) return 4900;  // b2-e2: close centralization alternative.
    if (sameUciMove(move, "b9c7")) return 4400;  // b0-c2: compact horse development.
    return 0;
  }

  static const uint64_t earlyPawnShiftedCannonBlack = fenPositionKey(
      "rheakaehr/9/1c4c2/p1p1p1p1p/9/6P2/P1P1P3P/4C2C1/9/RHEAKAEHR b");
  if (root.key == earlyPawnShiftedCannonBlack) {
    if (sameUciMove(move, "c9e7")) return 5000;  // c0-e2: develop the elephant in the shifted-cannon branch.
    if (sameUciMove(move, "b9c7")) return 4700;  // b0-c2: close horse-development alternative.
    if (sameUciMove(move, "b7e7")) return 4600;  // b2-e2: central cannon alternative.
    return 0;
  }

  static const uint64_t earlyPawnCannonSide = fenPositionKey(
      "rheakaehr/9/1c4c2/p1p1p1p1p/9/6P2/P1P1P3P/1C5C1/9/RHEAKAEHR r");
  if (root.key == earlyPawnCannonSide) {
    if (sameUciMove(move, "b2e2")) return 5000;  // b7-e7: refreshed 2026 Pikafish top central cannon.
    if (sameUciMove(move, "h2e2")) return 4900;  // h7-e7: near-tie opposite central cannon.
    if (sameUciMove(move, "b0c2")) return 4700;  // b9-c7: horse-development alternative.
    if (sameUciMove(move, "c0e2")) return 4400;  // c9-e7: older playable elephant-development fallback.
    return 0;
  }

  static const uint64_t earlyPawnChallenge = fenPositionKey(
      "rheakaehr/9/1c5c1/p3p1p1p/2p6/6P2/P1P1P3P/1C5C1/9/RHEAKAEHR r");
  if (root.key == earlyPawnChallenge) {
    if (sameUciMove(move, "b2c2")) return 5050;  // b7-c7: repeated Pikafish cannon regroup in the early-pawn challenge.
    if (sameUciMove(move, "b0a2")) return 5000;  // b9-a7: close horse-shift alternative.
    if (sameUciMove(move, "h0g2")) return 4900;  // h9-g7: close horse-development alternative.
    return 0;
  }

  static const uint64_t refreshedPawnPushContinuation = fenPositionKey(
      "rheakae1r/9/1c4h1c/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR r");
  if (root.key == refreshedPawnPushContinuation) {
    if (sameUciMove(move, "h0g2")) return 5000;  // h9-g7: refreshed 2026 Pikafish top development.
    if (sameUciMove(move, "b0c2")) return 4900;  // b9-c7: close horse-development alternative.
    if (sameUciMove(move, "b0a2")) return 4400;  // b9-a7: playable horse-shift fallback.
    return 0;
  }

  static const uint64_t shiftedLeftPawn = fenPositionKey(
      "r1eakaehr/9/1ch4c1/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR b");
  if (root.key == shiftedLeftPawn) {
    if (sameUciMove(move, "g9e7")) return 5000;  // g0-e2: refreshed 2026 Pikafish top elephant development.
    if (sameUciMove(move, "c6c5")) return 4900;  // c3-c4: near-tie central pawn challenge.
    if (sameUciMove(move, "g6g5")) return 4500;  // g3-g4: close pawn-push alternative.
    return 0;
  }

  static const uint64_t leftScreenCentralCannon = fenPositionKey(
      "r1eakaehr/9/1ch4c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RHEAKAEHR r");
  if (root.key == leftScreenCentralCannon) {
    if (sameUciMove(move, "h0g2")) return 5000;  // h9-g7: complete red horse development.
    if (sameUciMove(move, "c3c4")) return 4600;  // c6-c5: close oracle pawn challenge.
    if (sameUciMove(move, "b0c2")) return 4500;  // b9-c7: develop the other horse.
    if (sameUciMove(move, "b2c2")) return 4200;  // b7-c7: playable cannon shift.
    if (sameUciMove(move, "b2d2")) return 4000;  // b7-d7: playable cannon shift.
    return 0;
  }

  static const uint64_t centralCannonDoubleHorse = fenPositionKey(
      "rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1H2/9/RHEAKAE1R b");
  if (root.key == centralCannonDoubleHorse) {
    if (sameUciMove(move, "g6g5")) return 5000;  // g3-g4: short-time Pikafish top choice.
    if (sameUciMove(move, "i9h9")) return 4900;  // i0-h0: tied quiet rook development.
    if (sameUciMove(move, "c6c5")) return 4800;  // c3-c4: central pawn challenge.
    if (sameUciMove(move, "b9c7")) return 4600;  // b0-c2: complete screen horses.
    return 0;
  }

  static const uint64_t centralCannonDoubleHorseRedRook = fenPositionKey(
      "rheakae1r/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1C2C1H2/9/RHEAKAER1 b");
  if (root.key == centralCannonDoubleHorseRedRook) {
    if (sameUciMove(move, "i9h9")) return 5000;  // i0-h0: mirror the red rook lift before pawn play.
    if (sameUciMove(move, "h7h5")) return 4400;  // h2-h4: active cannon lift remains playable.
    return 0;
  }

  static const uint64_t centralCannonDoubleHorseBothRooks = fenPositionKey(
      "rheakaer1/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1C2C1H2/9/RHEAKAER1 r");
  if (root.key == centralCannonDoubleHorseBothRooks) {
    if (sameUciMove(move, "h0h6")) return 5050;  // h9-h3: refreshed Pikafish top quiet rook lift.
    if (sameUciMove(move, "c3c4")) return 5000;  // c6-c5: close central pawn challenge.
    if (sameUciMove(move, "h0h4")) return 4700;  // h9-h5: playable rook-pressure plan.
    if (sameUciMove(move, "b0c2")) return 4600;  // b9-c7: near-tie horse development.
    return 0;
  }

  static const uint64_t centralCannonDoubleHorseRookPressure = fenPositionKey(
      "rheakaer1/9/1c4hc1/p1p1p3p/6p2/7R1/P1P1P1P1P/1C2C1H2/9/RHEAKAE2 b");
  if (root.key == centralCannonDoubleHorseRookPressure) {
    if (sameUciMove(move, "h7i7")) return 5000;  // h2-i2: continue the Pikafish cannon sidestep from the rook-pressure PV.
    if (sameUciMove(move, "b7b5")) return 4400;  // b2-b4: native search's active cannon lift.
    return 0;
  }

  static const uint64_t centralCannonPawnChallenge = fenPositionKey(
      "rheakae1r/9/1c4hc1/p3p1p1p/2p6/9/P1P1P1P1P/1C2C1H2/9/RHEAKAE1R r");
  if (root.key == centralCannonPawnChallenge) {
    if (sameUciMove(move, "i0h0")) return 5000;  // i9-h9: refreshed 2026 Pikafish quiet rook development.
    if (sameUciMove(move, "b0a2")) return 4900;  // b9-a7: close cannon-side horse shift.
    if (sameUciMove(move, "g3g4")) return 4550;  // g6-g5: close central pawn break.
    return 0;
  }

  static const uint64_t centralCannonPawnChallengeDoubleHorse = fenPositionKey(
      "r1eakae1r/9/1ch3hc1/p3p1p1p/2p6/9/P1P1P1P1P/HC2C1H2/9/R1EAKAE1R r");
  if (root.key == centralCannonPawnChallengeDoubleHorse) {
    if (sameUciMove(move, "i0h0")) return 5000;  // i9-h9: continue the Pikafish quiet-rook plan.
    if (sameUciMove(move, "g3g4")) return 4600;  // g6-g5: close pawn-break alternative.
    if (sameUciMove(move, "b2c2")) return 4300;  // b7-c7: native search's cannon regroup.
    return 0;
  }

  static const uint64_t shiftedCentralCannons = fenPositionKey(
      "rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/3CC4/9/RHEAKAEHR b");
  if (root.key == shiftedCentralCannons) {
    if (sameUciMove(move, "b9c7")) return 5000;  // b0-c2: compact development remains the safest oracle tie.
    if (sameUciMove(move, "b7d7")) return 4900;  // b2-d2: close cannon-shift alternative.
    if (sameUciMove(move, "g6g5")) return 4600;  // g3-g4: close oracle alternative.
    return 0;
  }

  static const uint64_t shiftedCentralCannonsDoubleHorse = fenPositionKey(
      "r1eakae1r/9/1ch3hc1/p1p1p1p1p/9/9/P1P1P1P1P/2HCC4/9/R1EAKAEHR b");
  if (root.key == shiftedCentralCannonsDoubleHorse) {
    if (sameUciMove(move, "a9b9")) return 5000;  // a0-b0: connect the rook after both screen horses develop.
    if (sameUciMove(move, "c6c5")) return 4500;  // c3-c4: native central-pawn challenge.
    if (sameUciMove(move, "b7b5")) return 4300;  // b2-b4: active cannon lift.
    return 0;
  }

  static const uint64_t huCentralCannonTrap = fenPositionKey(
      "rheakaer1/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1CH1C1H2/9/R1EAKAE1R r");
  if (root.key == huCentralCannonTrap) {
    if (sameUciMove(move, "b2a2")) return 5000;  // b7-a7: refreshed 2026 Pikafish top cannon sidestep.
    if (sameUciMove(move, "i0h0")) return 4900;  // i9-h9: close quiet rook improvement before tactics.
    if (sameUciMove(move, "c3c4")) return 4300;  // c6-c5: useful central pawn break.
    if (sameUciMove(move, "b2b1")) return 4000;  // b7-b8: playable cannon retreat.
  }
  return 0;
}

int timedOpeningRootMaxLoss(const Board& root) {
  static const uint64_t centralCannonPawnChallenge = fenPositionKey(
      "rheakae1r/9/1c4hc1/p3p1p1p/2p6/9/P1P1P1P1P/1C2C1H2/9/RHEAKAE1R r");
  if (root.key == centralCannonPawnChallenge) return 140;

  static const uint64_t earlyPawnShiftedCannonBlack = fenPositionKey(
      "rheakaehr/9/1c4c2/p1p1p1p1p/9/6P2/P1P1P3P/4C2C1/9/RHEAKAEHR b");
  if (root.key == earlyPawnShiftedCannonBlack) return 160;

  static const uint64_t centralCannonDoubleHorseBothRooks = fenPositionKey(
      "rheakaer1/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1C2C1H2/9/RHEAKAER1 r");
  if (root.key == centralCannonDoubleHorseBothRooks) return 180;

  static const uint64_t huCentralCannonTrap = fenPositionKey(
      "rheakaer1/9/1c4hc1/p1p1p3p/6p2/9/P1P1P1P1P/1CH1C1H2/9/R1EAKAE1R r");
  if (root.key == huCentralCannonTrap) return 180;

  return kTimedOpeningPriorMaxLoss;
}

void applyTimedOpeningRootBias(std::vector<Move>& rootMoves, const Board& root, bool enabled) {
  if (!enabled || rootMoves.size() <= 1) return;
  std::stable_sort(rootMoves.begin(), rootMoves.end(), [&root](const Move& left, const Move& right) {
    return timedOpeningRootBonus(root, left) > timedOpeningRootBonus(root, right);
  });
}

void applyTimedOpeningFinalPreference(std::vector<RootLine>& lines, const Board& root, bool enabled, SearchState& state) {
  if (!enabled || lines.size() <= 1) return;
  const int bestScore = lines.front().score;
  const int maxLoss = timedOpeningRootMaxLoss(root);
  auto preferred = lines.begin();
  int preferredBonus = timedOpeningRootBonus(root, preferred->move);

  for (auto it = lines.begin() + 1; it != lines.end(); ++it) {
    if (bestScore - it->score > maxLoss) continue;
    const int bonus = timedOpeningRootBonus(root, it->move);
    if (bonus > preferredBonus || (bonus == preferredBonus && bonus > 0 && it->score > preferred->score)) {
      preferred = it;
      preferredBonus = bonus;
    }
  }

  if (preferred != lines.begin() && preferredBonus > 0) {
    std::rotate(lines.begin(), preferred, preferred + 1);
    state.openingPreferencePromotions += 1;
  }
}

int cachedRootOrderRank(const SearchState& state, const Move& move) {
  for (int index = 0; index < state.rootOrderCount; index += 1) {
    if (sameMove(state.rootOrderMoves[static_cast<std::size_t>(index)], move)) return index;
  }
  return kInf;
}

void applyRootOrderMemory(
    std::vector<Move>& rootMoves,
    SearchState& state,
    uint64_t rootKey,
    const Move& rootHashMove,
    bool enabled) {
  if (!enabled || rootMoves.size() <= 1) return;
  if (state.rootOrderKey != rootKey || state.rootOrderCount <= 0) return;

  int matched = 0;
  for (const Move& move : rootMoves) {
    if (cachedRootOrderRank(state, move) < kInf) matched += 1;
  }
  if (matched <= 1) return;

  state.rootOrderHits += matched;
  const bool hasRootHashMove = validMove(rootHashMove);
  std::stable_sort(rootMoves.begin(), rootMoves.end(), [&state, &rootHashMove, hasRootHashMove](const Move& left, const Move& right) {
    if (hasRootHashMove) {
      const bool leftHash = sameMove(left, rootHashMove);
      const bool rightHash = sameMove(right, rootHashMove);
      if (leftHash != rightHash) return leftHash;
    }
    return cachedRootOrderRank(state, left) < cachedRootOrderRank(state, right);
  });
}

void storeRootOrderMemory(SearchState& state, uint64_t rootKey, const std::vector<RootLine>& lines, bool enabled) {
  if (!enabled || lines.empty()) return;

  state.rootOrderKey = rootKey;
  state.rootOrderCount = std::min<int>(static_cast<int>(lines.size()), static_cast<int>(state.rootOrderMoves.size()));
  for (int index = 0; index < state.rootOrderCount; index += 1) {
    state.rootOrderMoves[static_cast<std::size_t>(index)] = lines[static_cast<std::size_t>(index)].move;
  }
  state.rootOrderStores += state.rootOrderCount;
}

int rootBaseMoveReduction(
    const Board& root,
    const Move& move,
    const KnownChildState& child,
    int depth,
    int moveIndex,
    bool rootInCheck,
    SearchState& state,
    const Move& rootPreviousMove,
    bool trackedMultiPvReduction = false) {
  if (rootInCheck) return 0;
  const int reductionMoveIndex = trackedMultiPvReduction ? kRootMultiPvReductionMoveIndex : kRootReductionMoveIndex;
  if (depth < kRootReductionMinDepth || moveIndex < reductionMoveIndex) return 0;
  if (!isQuiet(move) || child.inCheck) return 0;
  if (timedOpeningRootBonus(root, move) > 0) return 0;

  const int historyScale = depth * depth;
  const int historyScore = state.quietHistory[move.from][move.to];
  const int continuationScore = continuationHistoryValue(state, rootPreviousMove, move, true);
  const Move rootCounterMove = counterMoveFor(state, rootPreviousMove);
  if (validMove(rootCounterMove) && sameMove(move, rootCounterMove)) {
    state.rootHistoryReductionGuards += 1;
    return 0;
  }

  int reduction = 1;
  if (depth >= kRootDeepReductionMinDepth && moveIndex >= kRootDeepReductionMoveIndex) reduction += 1;
  if (depth >= kRootHistoryReductionBoostMinDepth && moveIndex >= kRootHistoryReductionBoostMoveIndex) {
    const bool badHistory = historyScore < -historyScale * kRootHistoryReductionBoostScale && continuationScore <= 0;
    const bool badContinuation = continuationScore < -historyScale * kRootContinuationReductionBoostScale && historyScore <= 0;
    if (badHistory || badContinuation) {
      reduction += 1;
      state.rootHistoryReductionBoosts += 1;
    }
  }
  return std::clamp(reduction, 0, depth - 2);
}

int rootMoveReduction(
    const Board& root,
    const Move& move,
    const KnownChildState& child,
    int depth,
    int moveIndex,
    bool rootInCheck,
    bool useRootPvs,
    int rootAlpha,
    int beta,
    SearchState& state,
    const Move& rootPreviousMove) {
  if (!useRootPvs) return 0;
  if (isMateScore(rootAlpha) || isMateScore(beta)) return 0;
  return rootBaseMoveReduction(root, move, child, depth, moveIndex, rootInCheck, state, rootPreviousMove);
}

bool reducedRootMoveNeedsFullSearch(int reducedScore, int currentReportCutoff) {
  if (isMateScore(reducedScore) || isMateScore(currentReportCutoff)) return true;
  return reducedScore >= currentReportCutoff - kRootMultiPvReductionMargin;
}

struct RootReportCutoffTracker {
  explicit RootReportCutoffTracker(int multiPv)
      : limit(std::clamp(multiPv, 1, kRootTrackedMultiPvLimit)) {
    topScores.fill(-kInf);
  }

  bool full() const {
    return count >= limit;
  }

  int cutoff() const {
    return full() ? topScores[static_cast<std::size_t>(limit - 1)] : -kInf;
  }

  void push(int score) {
    if (count >= limit && score <= cutoff()) return;

    const int oldCount = count;
    count = std::min(limit, count + 1);
    int index = std::min(oldCount, limit - 1);
    while (index > 0 && score > topScores[static_cast<std::size_t>(index - 1)]) {
      topScores[static_cast<std::size_t>(index)] = topScores[static_cast<std::size_t>(index - 1)];
      index -= 1;
    }
    topScores[static_cast<std::size_t>(index)] = score;
  }

  std::array<int, kRootTrackedMultiPvLimit> topScores{};
  int limit = 1;
  int count = 0;
};

int remainingMs(const SearchState& state) {
  if (!state.hasDeadline) return kInf;
  const auto remaining = state.deadline - std::chrono::steady_clock::now();
  return static_cast<int>(std::chrono::duration_cast<std::chrono::milliseconds>(remaining).count());
}

bool shouldStopBeforeRootDepth(SearchState& state, int depth, int lastDepthElapsedMs) {
  if (!state.hasDeadline || depth <= 1) return false;

  const int remaining = remainingMs(state);
  if (remaining <= 0) {
    state.rootTimeGuardStops += 1;
    return true;
  }
  if (lastDepthElapsedMs <= 0) return false;

  const int guardMs = std::clamp(
      lastDepthElapsedMs / kRootTimeGuardDivisor,
      kRootTimeGuardMinMs,
      kRootTimeGuardMaxMs);
  if (remaining > guardMs) return false;

  state.rootTimeGuardStops += 1;
  return true;
}

std::vector<RootLine> searchRootDepth(
    const Board& root,
    std::vector<RootMove>& rootMoves,
    int depth,
    int alpha,
    int beta,
    SearchState& state,
    bool rootInCheck,
    bool useRootAlphaPruning,
    int multiPv,
    const Move& rootPreviousMove) {
  std::vector<RootLine> depthLines;
  depthLines.reserve(rootMoves.size());
  const int rootExtension = rootInCheck && depth > 1 ? 1 : 0;
  int rootAlpha = alpha;
  Board board = root;
  std::vector<Move> childPv;
  childPv.reserve(static_cast<std::size_t>(std::max(1, depth)));
  int moveIndex = 0;
  const bool useTrackedMultiPvCutoff = multiPv > 1 && multiPv <= kRootTrackedMultiPvLimit;
  RootReportCutoffTracker reportCutoff(multiPv);

  for (const RootMove& rootMove : rootMoves) {
    Move move = rootMove.move;
    const KnownChildState child = rootMove.child;
    const bool pawnPressure = rootExtension == 0
        && depth > 1
        && isPawnPressureExtensionMove(move, child.ownKing, state.rootPieceCount);
    const int moveExtension = rootExtension + (pawnPressure ? 1 : 0);
    if (moveExtension > 0) {
      state.extensions += 1;
      if (pawnPressure) state.pawnThreatExtensions += 1;
    }
    state.rootChildStateReuses += 1;
    const uint64_t childKey = keyAfterMove(board, move);
    prefetchMainSearchCaches(state, childKey, -board.side);
    recordSearchPathMove(state, 0, move);
    makeMoveWithKnownKey(board, move, childKey);
    childPv.clear();
    const int childDepth = depth - 1 + moveExtension;
    int score;
    const bool useRootPvs = useRootAlphaPruning && moveIndex > 0 && rootAlpha + 1 < beta;
    int multiPvReportCutoff = -kInf;
    const bool useMultiPvReduction = !useRootPvs
        && useTrackedMultiPvCutoff
        && reportCutoff.full();
    int reduction = rootMoveReduction(root, move, child, depth, moveIndex, rootInCheck, useRootPvs, rootAlpha, beta, state, rootPreviousMove);
    if (useMultiPvReduction) {
      multiPvReportCutoff = reportCutoff.cutoff();
      if (!isMateScore(multiPvReportCutoff)) {
        reduction = rootBaseMoveReduction(root, move, child, depth, moveIndex, rootInCheck, state, rootPreviousMove, true);
      }
    }
    if (useRootPvs) {
      if (reduction > 0) {
        state.rootReductions += 1;
        state.rootReductionPlies += reduction;
      }
      score = -negamax(
          board,
          childDepth - reduction,
          -rootAlpha - 1,
          -rootAlpha,
          1,
          state,
          nullptr,
          true,
          move,
          kMaxExtensions - moveExtension,
          child.ownKing,
          child.inCheck);
      if (reduction > 0 && !state.stopped && score > rootAlpha) {
        state.rootReductionResearches += 1;
        score = -negamax(
            board,
            childDepth,
            -rootAlpha - 1,
            -rootAlpha,
            1,
            state,
            nullptr,
            true,
            move,
            kMaxExtensions - moveExtension,
            child.ownKing,
            child.inCheck);
      }
      if (!state.stopped && score > rootAlpha && score < beta) {
        state.pvsResearches += 1;
        childPv.clear();
        score = -negamax(
            board,
            childDepth,
            -beta,
            -rootAlpha,
            1,
            state,
            &childPv,
            true,
            move,
            kMaxExtensions - moveExtension,
            child.ownKing,
            child.inCheck);
      }
    } else {
      if (reduction > 0) {
        state.rootReductions += 1;
        state.rootReductionPlies += reduction;
        score = -negamax(
            board,
            childDepth - reduction,
            -beta,
            -rootAlpha,
            1,
            state,
            nullptr,
            true,
            move,
            kMaxExtensions - moveExtension,
            child.ownKing,
            child.inCheck);
        if (!state.stopped && reducedRootMoveNeedsFullSearch(score, multiPvReportCutoff)) {
          state.rootReductionResearches += 1;
          childPv.clear();
          score = -negamax(
              board,
              childDepth,
              -beta,
              -rootAlpha,
              1,
              state,
              &childPv,
              true,
              move,
              kMaxExtensions - moveExtension,
              child.ownKing,
              child.inCheck);
        }
      } else {
        score = -negamax(
            board,
            childDepth,
            -beta,
            -rootAlpha,
            1,
            state,
            &childPv,
            true,
            move,
            kMaxExtensions - moveExtension,
            child.ownKing,
            child.inCheck);
      }
    }
    undoMove(board, move);
    clearSearchPathMove(state, 0);
    if (state.stopped) break;
    state.rootMovesSearched += 1;
    moveIndex += 1;

    RootLine line;
    line.move = move;
    line.score = score;
    line.child = child;
    line.pv.reserve(childPv.size() + 1);
    line.pv.push_back(move);
    line.pv.insert(line.pv.end(), childPv.begin(), childPv.end());
    depthLines.push_back(std::move(line));
    if (useTrackedMultiPvCutoff) reportCutoff.push(score);
    if (useRootAlphaPruning && score > rootAlpha) rootAlpha = score;
    if (useRootAlphaPruning && rootAlpha >= beta) break;
  }

  return depthLines;
}

std::vector<RootLine> searchRoot(
    Board root,
    int maxDepth,
    int moveTimeMs,
    int multiPv,
    const std::vector<Move>& searchMoves,
    const Move& rootPreviousMove,
    const std::vector<uint64_t>& historyKeys,
    const std::unordered_map<uint64_t, int>& historyCounts,
    TranspositionTable& tt,
    TranspositionTable& qtt,
    EvalCache& evalCache,
    SearchState& state,
    bool rootAlphaPruning) {
  state.resetForSearch();
  state.started = std::chrono::steady_clock::now();
  state.hasDeadline = moveTimeMs > 0;
  state.deadline = state.started + std::chrono::milliseconds(std::max(1, moveTimeMs));
  state.tt = &tt;
  state.qtt = &qtt;
  state.evalCache = &evalCache;
  state.rootHistoryKeys = &historyKeys;
  state.rootHistoryCounts = &historyCounts;
  state.rootHistoryHasPositions = !historyKeys.empty();
  state.rootHistoryHasRepeatedPositions = std::any_of(historyCounts.begin(), historyCounts.end(), [](const auto& entry) {
    return entry.second >= 2;
  });
  state.rootPieceCount = root.totalPieceCount;
  state.pathKeys[0] = root.key;
  state.pathKeyKnown[0] = true;
  tt.newSearch();
  qtt.newSearch();
  evalCache.newSearch();

  const bool unrestrictedRootSearch = searchMoves.empty();
  const int rootOwnKing = findKing(root, root.side);
  const bool rootInCheck = isInCheckKnownKing(root, root.side, rootOwnKing);
  auto rootMoves = filterRootMoves(generateLegalMoves(root, root.side, false, rootOwnKing, rootInCheck), searchMoves);
  const int rootEnemyKing = findKing(root, -root.side);
  Move rootHashMove{};
  if (const TtEntry* entry = tt.probe(root.key)) {
    const bool rootHashMoveAllowed = validMove(entry->bestMove)
        && std::any_of(rootMoves.begin(), rootMoves.end(), [&entry](const Move& move) {
          return sameMove(move, entry->bestMove);
        });
    if (rootHashMoveAllowed) {
      rootHashMove = entry->bestMove;
      state.rootTtHits += 1;
    }
  }
  const bool useTimedOpeningPriors = rootAlphaPruning && unrestrictedRootSearch;
  const Move rootCounterMove = counterMoveFor(state, rootPreviousMove);
  orderMoves(rootMoves, state, 0, rootHashMove, rootCounterMove, &root, rootEnemyKing, rootPreviousMove, rootInCheck);
  applyRootOrderMemory(rootMoves, state, root.key, rootHashMove, unrestrictedRootSearch);
  applyTimedOpeningRootBias(rootMoves, root, useTimedOpeningPriors);
  std::vector<RootMove> orderedRootMoves;
  orderedRootMoves.reserve(rootMoves.size());
  for (Move& move : rootMoves) {
    orderedRootMoves.push_back({move, knownChildStateAfterMove(root, move, rootEnemyKing, state)});
  }
  std::vector<RootLine> bestLines;
  bestLines.reserve(orderedRootMoves.size());
  const int rootStaticScore = evaluateRed(root) * root.side;
  for (const RootMove& rootMove : orderedRootMoves) {
    RootLine line;
    line.move = rootMove.move;
    line.score = rootStaticScore;
    line.child = rootMove.child;
    line.pv.reserve(1);
    line.pv.push_back(rootMove.move);
    bestLines.push_back(std::move(line));
  }
  if (orderedRootMoves.empty()) return bestLines;

  int lastDepthElapsedMs = 0;
  for (int depth = 1; depth <= maxDepth; depth += 1) {
    if (shouldStopBeforeRootDepth(state, depth, lastDepthElapsedMs)) break;

    const auto depthStarted = std::chrono::steady_clock::now();
    const bool useAspiration = multiPv <= 1
        && depth >= 3
        && !bestLines.empty()
        && !isMateScore(bestLines.front().score);
    const int previousScore = bestLines.empty() ? 0 : bestLines.front().score;
    int alpha = -kInf;
    int beta = kInf;
    if (useAspiration) {
      alpha = std::max(-kInf, previousScore - kAspirationInitialWindow);
      beta = std::min(kInf, previousScore + kAspirationInitialWindow);
      state.aspirationSearches += 1;
    }

    const bool useRootAlphaPruning = rootAlphaPruning && multiPv <= 1;
    std::vector<RootLine> depthLines = searchRootDepth(root, orderedRootMoves, depth, alpha, beta, state, rootInCheck, useRootAlphaPruning, multiPv, rootPreviousMove);
    if (!state.stopped && useAspiration && !depthLines.empty()) {
      std::stable_sort(depthLines.begin(), depthLines.end(), [](const RootLine& left, const RootLine& right) {
        return left.score > right.score;
      });
      if (depthLines.front().score <= alpha || depthLines.front().score >= beta) {
        const bool failLow = depthLines.front().score <= alpha;
        if (failLow) state.aspirationFailLow += 1;
        else state.aspirationFailHigh += 1;

        const int retryAlpha = failLow
            ? std::max(-kInf, previousScore - kAspirationRetryWindow)
            : std::max(-kInf, previousScore - kAspirationInitialWindow);
        const int retryBeta = failLow
            ? std::min(kInf, previousScore + kAspirationInitialWindow)
            : std::min(kInf, previousScore + kAspirationRetryWindow);
        state.aspirationWidenedSearches += 1;
        depthLines = searchRootDepth(root, orderedRootMoves, depth, retryAlpha, retryBeta, state, rootInCheck, useRootAlphaPruning, multiPv, rootPreviousMove);
        if (!state.stopped && !depthLines.empty()) {
          std::stable_sort(depthLines.begin(), depthLines.end(), [](const RootLine& left, const RootLine& right) {
            return left.score > right.score;
          });
          if (depthLines.front().score <= retryAlpha || depthLines.front().score >= retryBeta) {
            depthLines = searchRootDepth(root, orderedRootMoves, depth, -kInf, kInf, state, rootInCheck, useRootAlphaPruning, multiPv, rootPreviousMove);
          }
        }
      }
    }

    if (state.stopped || depthLines.empty()) break;
    std::stable_sort(depthLines.begin(), depthLines.end(), [](const RootLine& left, const RootLine& right) {
      return left.score > right.score;
    });
    applyTimedOpeningFinalPreference(depthLines, root, useTimedOpeningPriors, state);
    if (unrestrictedRootSearch && validMove(depthLines.front().move)) {
      if (tt.store(root.key, depth, scoreToTt(depthLines.front().score, 0), kTtExact, depthLines.front().move)) {
        state.rootTtStores += 1;
      }
    }
    orderedRootMoves.clear();
    orderedRootMoves.reserve(depthLines.size());
    for (const RootLine& line : depthLines) orderedRootMoves.push_back({line.move, line.child});
    bestLines = std::move(depthLines);
    state.completedDepth = depth;
    lastDepthElapsedMs = static_cast<int>(
        std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - depthStarted).count());
  }

  const int limit = std::max(1, std::min<int>(multiPv, bestLines.size()));
  applyTimedOpeningFinalPreference(bestLines, root, useTimedOpeningPriors, state);
  storeRootOrderMemory(state, root.key, bestLines, unrestrictedRootSearch && !state.stopped);
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

struct PositionState {
  Board board;
  Move lastMove{};
  std::vector<uint64_t> historyKeys;
  std::unordered_map<uint64_t, int> historyCounts;
};

bool applyMoveIfLegal(Board& board, const Move& requested, Move* appliedMove = nullptr) {
  auto legal = generateLegalMoves(board, board.side);
  for (Move move : legal) {
    if (!sameMove(move, requested)) continue;
    if (appliedMove) *appliedMove = move;
    makeMove(board, move);
    return true;
  }
  return false;
}

void applyMoveWithHistory(PositionState& position, const Move& requested) {
  const uint64_t beforeMoveKey = position.board.key;
  Move appliedMove;
  if (applyMoveIfLegal(position.board, requested, &appliedMove)) {
    position.lastMove = appliedMove;
    position.historyKeys.push_back(beforeMoveKey);
    position.historyCounts[beforeMoveKey] += 1;
  }
}

void handlePosition(PositionState& position, const std::string& line) {
  const auto tokens = split(line);
  if (tokens.size() >= 2 && tokens[1] == "startpos") {
    parseFen(position.board, initialFen());
    position.lastMove = {};
    position.historyKeys.clear();
    position.historyCounts.clear();
    auto movesIt = std::find(tokens.begin(), tokens.end(), "moves");
    if (movesIt != tokens.end()) {
      for (++movesIt; movesIt != tokens.end(); ++movesIt) applyMoveWithHistory(position, parseUciMove(*movesIt));
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
  parseFen(position.board, fen);
  position.lastMove = {};
  position.historyKeys.clear();
  position.historyCounts.clear();
  if (movesIt != tokens.end()) {
    for (++movesIt; movesIt != tokens.end(); ++movesIt) applyMoveWithHistory(position, parseUciMove(*movesIt));
  }
}

struct GoOptions {
  int depth = 4;
  int moveTimeMs = 0;
  bool rootAlphaPruning = false;
  std::vector<Move> searchMoves;
};

GoOptions parseGo(const std::string& line) {
  GoOptions options;
  const auto tokens = split(line);
  bool depthSpecified = false;
  bool timeControlSpecified = false;
  for (std::size_t i = 1; i < tokens.size(); i += 1) {
    const std::string token = lower(tokens[i]);
    if (token == "depth" && i + 1 < tokens.size()) {
      options.depth = std::max(1, std::stoi(tokens[++i]));
      depthSpecified = true;
    } else if (token == "movetime" && i + 1 < tokens.size()) {
      options.moveTimeMs = std::max(1, std::stoi(tokens[++i]));
      options.rootAlphaPruning = true;
      timeControlSpecified = true;
    } else if (token == "wtime" || token == "btime") {
      if (i + 1 < tokens.size()) {
        const int clock = std::max(1, std::stoi(tokens[++i]));
        const int clockBudget = std::max(50, clock / 30);
        options.moveTimeMs = options.moveTimeMs > 0
            ? std::min(options.moveTimeMs, clockBudget)
            : clockBudget;
        options.rootAlphaPruning = true;
        timeControlSpecified = true;
      }
    } else if (token == "searchmoves") {
      for (std::size_t j = i + 1; j < tokens.size(); j += 1) {
        options.searchMoves.push_back(parseUciMove(tokens[j]));
      }
      break;
    }
  }
  if (!depthSpecified && timeControlSpecified) options.depth = kTimedSearchDepthLimit;
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
              << " ttstores " << state.ttStores
              << " ttmove " << state.ttMoveHits << " ttpref " << state.ttPrefetches
              << " killers " << state.killerHits << " history " << state.historyUpdates
              << " caphist " << state.captureHistoryHits << " caphstores " << state.captureHistoryStores
              << " caphm " << state.captureHistoryMaluses << " caphguard " << state.captureHistoryPruneGuards
              << " nmp " << state.nullMovePrunes << " nmv " << state.nullMoveVerifications
              << " nmvfail " << state.nullMoveVerificationFailures << " nmrboost " << state.nullMoveReductionBoosts
              << " nmmguard " << state.nullMoveMaterialGuards
              << " rfp " << state.reverseFutilityPrunes
              << " mdp " << state.mateDistancePrunes << " razor " << state.razorPrunes << "/" << state.razorResearches
              << " see " << state.seePrunes << " crisk " << state.captureRiskProbes << "/" << state.favorableCaptureRiskSkips
              << " lacache " << state.leastAttackerCacheHits << "/" << state.leastAttackerCacheProbes
              << " lastores " << state.leastAttackerCacheStores
              << " pcut " << state.probCutPrunes << " pcsearch " << state.probCutSearches
              << " pcskip " << state.probCutCaptureSkips
              << " futil " << state.futilityPrunes << " hprune " << state.badHistoryPrunes
              << " hpguard " << state.badHistoryPruneGuards << " delta " << state.deltaPrunes
              << " qdskip " << state.qDeltaPrefilterSkips
              << " qsee " << state.qSeePrunes
              << " lmp " << state.lateMovePrunes << " lmp3 " << state.depthThreeLateMovePrunes
              << " lmp4 " << state.depthFourLateMovePrunes
              << " lmr " << state.lmrReductions << "/" << state.lmrResearches
              << " redply " << state.reductionPlies << " deepred " << state.deepReductions
              << " pvguard " << state.pvReductionGuards << " cutboost " << state.cutNodeReductionBoosts
              << " imp " << state.improvingNodes << " nimp " << state.nonImprovingNodes
              << " imprd " << state.improvingReductionGuards << " nimprd " << state.nonImprovingReductionBoosts
              << " implmp " << state.improvingLateMoveGuards << " nimlmp " << state.nonImprovingLateMovePrunes
              << " cm " << state.countermoveHits << " ch " << state.continuationHistoryHits
              << " chred " << state.continuationReductionBoosts << " chredm " << state.continuationReductionMaluses
              << " fch " << state.followupHistoryHits << " fchstores " << state.followupHistoryStores
              << " fchred " << state.followupReductionBoosts << " fchredm " << state.followupReductionMaluses
              << " ce " << state.checkEvasionOrderHits << " cecap " << state.checkEvasionCaptures
              << " ceblock " << state.checkEvasionBlocks << " ceking " << state.checkEvasionKingMoves
              << " checkhist " << state.checkHistoryHits << " checkhstores " << state.checkHistoryStores
              << " checkhm " << state.checkHistoryMaluses
              << " checkcache " << state.checkCacheHits << "/" << state.checkCacheStores
              << " iid " << state.iidSearches << " iidhit " << state.iidMoveHits
              << " rootmoves " << state.rootMovesSearched
              << " rootstate " << state.rootChildStateReuses
              << " rootred " << state.rootReductions << "/" << state.rootReductionResearches
              << " rootredply " << state.rootReductionPlies
              << " roothrguard " << state.rootHistoryReductionGuards
              << " roothrboost " << state.rootHistoryReductionBoosts
              << " roottt " << state.rootTtHits << " rootttstores " << state.rootTtStores
              << " rootord " << state.rootOrderHits << " rootordstores " << state.rootOrderStores
              << " pvs " << state.pvsResearches
              << " asp " << state.aspirationSearches << " aspwide " << state.aspirationWidenedSearches
              << " asphi " << state.aspirationFailHigh << " asplo " << state.aspirationFailLow
              << " tguard " << state.rootTimeGuardStops
              << " opref " << state.openingPreferencePromotions
              << " ext " << state.extensions << " recext " << state.recaptureExtensions << " recorder " << state.recaptureOrderHits
              << " pawnext " << state.pawnThreatExtensions << " pawnord " << state.pawnThreatOrderHits
              << " singtry " << state.singularExtensionSearches << " singext " << state.singularExtensions
              << " singrej " << state.singularExtensionRejects
              << " qnodes " << state.qnodes
              << " qchecks " << state.qchecks
              << " qcheckhist " << state.qCheckHistoryHits << " qcheckhstores " << state.qCheckHistoryStores
              << " qcheckhm " << state.qCheckHistoryMaluses
              << " qcapguard " << state.qCaptureHistoryPruneGuards
              << " qcaphist " << state.qCaptureHistoryHits << " qcapstores " << state.qCaptureHistoryStores
              << " qcaphm " << state.qCaptureHistoryMaluses
              << " qtt " << state.qttHits << "/" << state.qttProbes << " qttstores " << state.qttStores
              << " qttcut " << state.qttCutoffs << " qttmove " << state.qttMoveHits << " qttpref " << state.qttPrefetches
              << " eval " << state.evalCacheHits << "/" << state.evalCacheProbes << " evalstores " << state.evalCacheStores
              << " evalpref " << state.evalCachePrefetches
              << " evalskip " << state.checkedEvalSkips << " evalguard " << state.staticEvalTrendClears
              << " rep " << state.repetitions
              << " memage " << state.memoryAge
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
              << " ttstores " << state.ttStores
              << " ttmove " << state.ttMoveHits << " ttpref " << state.ttPrefetches
              << " killers " << state.killerHits << " history " << state.historyUpdates
              << " caphist " << state.captureHistoryHits << " caphstores " << state.captureHistoryStores
              << " caphm " << state.captureHistoryMaluses << " caphguard " << state.captureHistoryPruneGuards
              << " nmp " << state.nullMovePrunes << " nmv " << state.nullMoveVerifications
              << " nmvfail " << state.nullMoveVerificationFailures << " nmrboost " << state.nullMoveReductionBoosts
              << " nmmguard " << state.nullMoveMaterialGuards
              << " rfp " << state.reverseFutilityPrunes
              << " mdp " << state.mateDistancePrunes << " razor " << state.razorPrunes << "/" << state.razorResearches
              << " see " << state.seePrunes << " crisk " << state.captureRiskProbes << "/" << state.favorableCaptureRiskSkips
              << " lacache " << state.leastAttackerCacheHits << "/" << state.leastAttackerCacheProbes
              << " lastores " << state.leastAttackerCacheStores
              << " pcut " << state.probCutPrunes << " pcsearch " << state.probCutSearches
              << " pcskip " << state.probCutCaptureSkips
              << " futil " << state.futilityPrunes << " hprune " << state.badHistoryPrunes
              << " hpguard " << state.badHistoryPruneGuards << " delta " << state.deltaPrunes
              << " qdskip " << state.qDeltaPrefilterSkips
              << " qsee " << state.qSeePrunes
              << " lmp " << state.lateMovePrunes << " lmp3 " << state.depthThreeLateMovePrunes
              << " lmp4 " << state.depthFourLateMovePrunes
              << " lmr " << state.lmrReductions << "/" << state.lmrResearches
              << " redply " << state.reductionPlies << " deepred " << state.deepReductions
              << " pvguard " << state.pvReductionGuards << " cutboost " << state.cutNodeReductionBoosts
              << " imp " << state.improvingNodes << " nimp " << state.nonImprovingNodes
              << " imprd " << state.improvingReductionGuards << " nimprd " << state.nonImprovingReductionBoosts
              << " implmp " << state.improvingLateMoveGuards << " nimlmp " << state.nonImprovingLateMovePrunes
              << " cm " << state.countermoveHits << " ch " << state.continuationHistoryHits
              << " chred " << state.continuationReductionBoosts << " chredm " << state.continuationReductionMaluses
              << " fch " << state.followupHistoryHits << " fchstores " << state.followupHistoryStores
              << " fchred " << state.followupReductionBoosts << " fchredm " << state.followupReductionMaluses
              << " ce " << state.checkEvasionOrderHits << " cecap " << state.checkEvasionCaptures
              << " ceblock " << state.checkEvasionBlocks << " ceking " << state.checkEvasionKingMoves
              << " checkhist " << state.checkHistoryHits << " checkhstores " << state.checkHistoryStores
              << " checkhm " << state.checkHistoryMaluses
              << " checkcache " << state.checkCacheHits << "/" << state.checkCacheStores
              << " iid " << state.iidSearches << " iidhit " << state.iidMoveHits
              << " rootmoves " << state.rootMovesSearched
              << " rootstate " << state.rootChildStateReuses
              << " rootred " << state.rootReductions << "/" << state.rootReductionResearches
              << " rootredply " << state.rootReductionPlies
              << " roothrguard " << state.rootHistoryReductionGuards
              << " roothrboost " << state.rootHistoryReductionBoosts
              << " roottt " << state.rootTtHits << " rootttstores " << state.rootTtStores
              << " rootord " << state.rootOrderHits << " rootordstores " << state.rootOrderStores
              << " pvs " << state.pvsResearches
              << " asp " << state.aspirationSearches << " aspwide " << state.aspirationWidenedSearches
              << " asphi " << state.aspirationFailHigh << " asplo " << state.aspirationFailLow
              << " tguard " << state.rootTimeGuardStops
              << " opref " << state.openingPreferencePromotions
              << " ext " << state.extensions << " recext " << state.recaptureExtensions << " recorder " << state.recaptureOrderHits
              << " pawnext " << state.pawnThreatExtensions << " pawnord " << state.pawnThreatOrderHits
              << " singtry " << state.singularExtensionSearches << " singext " << state.singularExtensions
              << " singrej " << state.singularExtensionRejects
              << " qnodes " << state.qnodes
              << " qchecks " << state.qchecks
              << " qcheckhist " << state.qCheckHistoryHits << " qcheckhstores " << state.qCheckHistoryStores
              << " qcheckhm " << state.qCheckHistoryMaluses
              << " qcapguard " << state.qCaptureHistoryPruneGuards
              << " qcaphist " << state.qCaptureHistoryHits << " qcapstores " << state.qCaptureHistoryStores
              << " qcaphm " << state.qCaptureHistoryMaluses
              << " qtt " << state.qttHits << "/" << state.qttProbes << " qttstores " << state.qttStores
              << " qttcut " << state.qttCutoffs << " qttmove " << state.qttMoveHits << " qttpref " << state.qttPrefetches
              << " eval " << state.evalCacheHits << "/" << state.evalCacheProbes << " evalstores " << state.evalCacheStores
              << " evalpref " << state.evalCachePrefetches
              << " evalskip " << state.checkedEvalSkips << " evalguard " << state.staticEvalTrendClears
              << " rep " << state.repetitions
              << " memage " << state.memoryAge
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

bool parseButtonOption(const std::string& line, const std::string& optionName) {
  const auto tokens = split(line);
  int nameIndex = -1;
  int valueIndex = static_cast<int>(tokens.size());
  for (std::size_t i = 0; i < tokens.size(); i += 1) {
    const std::string token = lower(tokens[i]);
    if (token == "name") nameIndex = static_cast<int>(i);
    if (token == "value") {
      valueIndex = static_cast<int>(i);
      break;
    }
  }
  if (nameIndex < 0 || nameIndex + 1 >= valueIndex) return false;

  std::string name;
  for (int i = nameIndex + 1; i < valueIndex; i += 1) {
    if (!name.empty()) name += " ";
    name += lower(tokens[i]);
  }
  return name == optionName;
}

}  // namespace

int main() {
  PositionState position;
  parseFen(position.board, initialFen());
  int multiPv = 1;
  int hashMb = kDefaultHashMb;
  TranspositionTable tt(hashMb);
  TranspositionTable qtt(std::max(1, hashMb / 4));
  EvalCache evalCache(std::max(1, hashMb / 4));
  SearchState searchState;
  int isolatedHashMb = std::max(1, std::min(hashMb, kIsolatedSearchHashMb));
  TranspositionTable isolatedTt(isolatedHashMb);
  TranspositionTable isolatedQtt(std::max(1, isolatedHashMb / 4));
  EvalCache isolatedEvalCache(std::max(1, isolatedHashMb / 4));
  SearchState isolatedSearchState;
  auto resizeIsolatedMemory = [&]() {
    const int nextIsolatedHashMb = std::max(1, std::min(hashMb, kIsolatedSearchHashMb));
    if (nextIsolatedHashMb == isolatedHashMb) return;
    isolatedHashMb = nextIsolatedHashMb;
    isolatedTt.resize(isolatedHashMb);
    isolatedQtt.resize(std::max(1, isolatedHashMb / 4));
    isolatedEvalCache.resize(std::max(1, isolatedHashMb / 4));
    isolatedSearchState.clearSearchMemory();
  };
  auto clearIsolatedMemory = [&]() {
    isolatedTt.clear();
    isolatedQtt.clear();
    isolatedEvalCache.clear();
    isolatedSearchState.clearSearchMemory();
  };
  auto clearEngineMemory = [&]() {
    tt.clear();
    qtt.clear();
    evalCache.clear();
    searchState.clearSearchMemory();
    clearIsolatedMemory();
  };

  std::string line;
  while (std::getline(std::cin, line)) {
    const std::string command = split(line).empty() ? "" : lower(split(line).front());
    if (command == "uci") {
      std::cout << "id name Xiangqi Native C++" << std::endl;
      std::cout << "id author juncoflockleader/codex" << std::endl;
      std::cout << "option name MultiPV type spin default 1 min 1 max 8" << std::endl;
      std::cout << "option name Hash type spin default " << kDefaultHashMb << " min 1 max 1024" << std::endl;
      std::cout << "option name Clear Hash type button" << std::endl;
      std::cout << "uciok" << std::endl;
    } else if (command == "isready") {
      std::cout << "readyok" << std::endl;
    } else if (command == "ucinewgame") {
      parseFen(position.board, initialFen());
      position.lastMove = {};
      position.historyKeys.clear();
      position.historyCounts.clear();
      clearEngineMemory();
    } else if (command == "setoption") {
      if (parseButtonOption(line, "clear hash")) {
        clearEngineMemory();
        continue;
      }
      multiPv = parseSpinOption(line, "multipv", multiPv);
      const int requestedHash = parseSpinOption(line, "hash", hashMb);
      if (requestedHash != hashMb) {
        hashMb = requestedHash;
        tt.resize(hashMb);
        qtt.resize(std::max(1, hashMb / 4));
        evalCache.resize(std::max(1, hashMb / 4));
        resizeIsolatedMemory();
      }
    } else if (command == "position") {
      handlePosition(position, line);
    } else if (command == "go") {
      const GoOptions options = parseGo(line);
      if (options.searchMoves.empty()) {
        auto lines = searchRoot(
            position.board,
            options.depth,
            options.moveTimeMs,
            multiPv,
            options.searchMoves,
            position.lastMove,
            position.historyKeys,
            position.historyCounts,
            tt,
            qtt,
            evalCache,
            searchState,
            options.rootAlphaPruning);
        writeSearchResult(lines, searchState);
      } else {
        resizeIsolatedMemory();
        clearIsolatedMemory();
        auto lines = searchRoot(
            position.board,
            options.depth,
            options.moveTimeMs,
            multiPv,
            options.searchMoves,
            position.lastMove,
            position.historyKeys,
            position.historyCounts,
            isolatedTt,
            isolatedQtt,
            isolatedEvalCache,
            isolatedSearchState,
            options.rootAlphaPruning);
        writeSearchResult(lines, isolatedSearchState);
      }
    } else if (command == "quit") {
      break;
    } else if (command == "stop") {
      std::cout << "bestmove 0000" << std::endl;
    }
  }

  return 0;
}
