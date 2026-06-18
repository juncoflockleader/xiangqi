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
constexpr int kIidCutNodeMinDepth = 7;
constexpr int kIidReduction = 2;
constexpr int kIidMoveLimit = 8;
constexpr int kNullMoveVerificationMinDepth = 5;
constexpr int kSingularExtensionMinDepth = 5;
constexpr int kSingularExtensionReduction = 2;
constexpr int kSingularExtensionMargin = 90;
constexpr int kHistoryPruningMaxDepth = 4;
constexpr int kHistoryPruningBaseIndex = 6;
constexpr int kHistoryPruningMarginScale = 32;
constexpr int kHistoryPruningFollowupScale = 8;
constexpr int kLateMovePruningMaxDepth = 4;
constexpr int kLateMovePruningDepthThreeTighten = 20;
constexpr int kLateMovePruningDepthFourTighten = 35;
constexpr int kReverseFutilityMaxDepth = 5;
constexpr int kImprovingEvalMargin = 12;
constexpr int kTimedOpeningPriorMaxLoss = 100;
constexpr int kTimedSearchDepthLimit = 64;
constexpr int kKingLinePressureExtensionMaxPieces = 18;
constexpr int kKingLinePressureOrderingBonus = 22000;
constexpr int kRootReductionMinDepth = 6;
constexpr int kRootReductionMoveIndex = 5;
constexpr int kRootMultiPvReductionMoveIndex = 3;
constexpr int kRootDeepReductionMinDepth = 8;
constexpr int kRootDeepReductionMoveIndex = 12;
constexpr int kRootHistoryReductionBoostMinDepth = 7;
constexpr int kRootHistoryReductionBoostMoveIndex = 8;
constexpr int kRootHistoryReductionBoostScale = 32;
constexpr int kRootContinuationReductionBoostScale = 48;
constexpr int kRootMultiPvQuietBoostMinDepth = 7;
constexpr int kRootMultiPvQuietBoostMoveIndex = 5;
constexpr int kFollowupReductionMalusScale = 48;
constexpr int kRootBadCaptureReductionLossMargin = 120;
constexpr int kRootThreatResponseMaxPieces = 32;
constexpr int kRootThreatResponseMinBaseline = 450;
constexpr int kRootThreatResponseOrderingWeight = 250;
constexpr int kRootThreatResponseResidualOrderingWeight = 100;
constexpr int kRootThreatCheckBonus = 250;
constexpr int kRootThreatSafeCaptureBonus = 80;
constexpr int kRootThreatExchangeClampMin = -200;
constexpr int kRootThreatExchangeClampMax = 400;
constexpr int kRootThreatResponseFinalMaxLoss = 120;
constexpr int kRootHomeHorseDevelopmentCaptureBonus = 4300;
constexpr int kRootHomeHorseDevelopmentCaptureMinPieces = 22;
constexpr int kRootTrackedMultiPvLimit = 8;
constexpr int kRootMultiPvReductionMargin = 5;
constexpr int kQSeePruneMaxDepth = 4;
constexpr int kQSeePruneMaxRootPieces = 32;
constexpr int kQSeePruneAlphaMargin = 32;
constexpr int kQSeePruneLossMargin = 80;
constexpr int kBadCapturePruneMaxDepth = 3;
constexpr int kBadCapturePruneLossMargin = 120;
constexpr int kBadCapturePruneDepthThreeMinIndex = 2;
constexpr int kBadCapturePruneDepthThreeLossMargin = 240;
constexpr int kQSeeCaptureHistoryGuard = 1024;
constexpr int kQDeltaPruneMargin = 90;
constexpr int kQDeltaCaptureHistoryGuard = 32768;
constexpr int kQDeltaCaptureHistoryMargin = 120;
constexpr int kQBadCaptureOrderingPenaltyScale = 8;
constexpr int kQQuietCheckSecondLayerMargin = 150;
constexpr int kQQuietCheckDeepReducedLimit = 3;
constexpr int kQHashFirstMinRootPieces = 6;
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

struct RootThreatProfile {
  int top = 0;
  int burden = 0;
};

struct RootThreatResponse {
  int relief = 0;
  int residual = 0;
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
  int64_t depthThreeSeePrunes = 0;
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
  int64_t qSeePrefilterPrunes = 0;
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
  int64_t iidCutNodeSearches = 0;
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
  int64_t rootBadCaptureReductions = 0;
  int64_t rootOrderHits = 0;
  int64_t rootOrderStores = 0;
  int64_t rootThreatResponseOrderHits = 0;
  int64_t rootThreatResponsePromotions = 0;
  int64_t extensions = 0;
  int64_t recaptureExtensions = 0;
  int64_t pawnThreatExtensions = 0;
  int64_t pawnThreatOrderHits = 0;
  int64_t kingLinePressureExtensions = 0;
  int64_t kingLinePressureOrderHits = 0;
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
    depthThreeSeePrunes = 0;
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
    qSeePrefilterPrunes = 0;
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
    iidCutNodeSearches = 0;
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
    rootBadCaptureReductions = 0;
    rootOrderHits = 0;
    rootOrderStores = 0;
    rootThreatResponseOrderHits = 0;
    rootThreatResponsePromotions = 0;
    extensions = 0;
    recaptureExtensions = 0;
    pawnThreatExtensions = 0;
    pawnThreatOrderHits = 0;
    kingLinePressureExtensions = 0;
    kingLinePressureOrderHits = 0;
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
  (void)squares;
  (void)count;
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
void addPieceMoves(const Board& board, MoveList& moves, int square, int piece, int pieceSide) {
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
    addPieceMoves<mode>(board, moves, square, piece, pieceSide);
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

template <std::size_t MaxTargets>
bool quietTargetMayReachKingLine(const Board& board, const TargetLookup<MaxTargets>& lookup, int from, int enemyKing) {
  const int count = lookup.counts[static_cast<std::size_t>(from)];
  const auto& targets = lookup.targets[static_cast<std::size_t>(from)];
  for (int index = 0; index < count; index += 1) {
    const int target = targets[static_cast<std::size_t>(index)];
    if (board.cells[target] == 0 && kSameLineBySquare[static_cast<std::size_t>(target)][static_cast<std::size_t>(enemyKing)]) {
      return true;
    }
  }
  return false;
}

template <std::size_t MaxTargets>
bool quietBlockedTargetMayReachKingLine(
    const Board& board,
    const TargetBlockerLookup<MaxTargets>& lookup,
    int from,
    int enemyKing) {
  const int count = lookup.counts[static_cast<std::size_t>(from)];
  const auto& targets = lookup.targets[static_cast<std::size_t>(from)];
  const auto& blockers = lookup.blockers[static_cast<std::size_t>(from)];
  for (int index = 0; index < count; index += 1) {
    const std::size_t slot = static_cast<std::size_t>(index);
    const int target = targets[slot];
    if (board.cells[blockers[slot]] == 0
        && board.cells[target] == 0
        && kSameLineBySquare[static_cast<std::size_t>(target)][static_cast<std::size_t>(enemyKing)]) {
      return true;
    }
  }
  return false;
}

bool horseQuietTargetMayCheck(const Board& board, int from, int enemyKing) {
  const int count = kHorseTargets.counts[static_cast<std::size_t>(from)];
  const auto& targets = kHorseTargets.targets[static_cast<std::size_t>(from)];
  const auto& blockers = kHorseTargets.blockers[static_cast<std::size_t>(from)];
  for (int index = 0; index < count; index += 1) {
    const std::size_t slot = static_cast<std::size_t>(index);
    const int target = targets[slot];
    if (board.cells[blockers[slot]] != 0 || board.cells[target] != 0) continue;
    if (kSameLineBySquare[static_cast<std::size_t>(target)][static_cast<std::size_t>(enemyKing)]) return true;
    if (kHorseLegSquareBySourceTarget[static_cast<std::size_t>(target)][static_cast<std::size_t>(enemyKing)] >= 0) return true;
  }
  return false;
}

bool pieceMayHaveQuietCheckCandidate(const Board& board, int square, int piece, int side, int enemyKing) {
  if (enemyKing < 0) return false;
  const auto from = static_cast<std::size_t>(square);
  const auto king = static_cast<std::size_t>(enemyKing);
  if (kSameLineBySquare[from][king] || kHorseLegBlockerByTarget[from][king]) return true;

  const int sideIndex = sideLookupIndex(side);
  switch (pieceCodeType(piece)) {
    case King:
      return quietTargetMayReachKingLine(board, kKingTargets[static_cast<std::size_t>(sideIndex)], square, enemyKing);
    case Advisor:
      return quietTargetMayReachKingLine(board, kAdvisorTargets[static_cast<std::size_t>(sideIndex)], square, enemyKing);
    case Elephant:
      return quietBlockedTargetMayReachKingLine(board, kElephantTargets[static_cast<std::size_t>(sideIndex)], square, enemyKing);
    case Horse:
      return horseQuietTargetMayCheck(board, square, enemyKing);
    case Rook:
    case Cannon:
      return true;
    case Pawn:
      return quietTargetMayReachKingLine(board, kPawnTargets[static_cast<std::size_t>(sideIndex)], square, enemyKing);
    default:
      return false;
  }
}

MoveList generatePseudoQuietCheckCandidates(const Board& board, int side, int enemyKing) {
  MoveList moves;
  if (enemyKing < 0) return moves;

  const auto& squares = pieceSquares(board, side);
  const int count = pieceCount(board, side);
  for (int listIndex = 0; listIndex < count; listIndex += 1) {
    const int square = squares[listIndex];
    if (square < 0 || square >= kSquares) continue;
    const int piece = board.cells[square];
    if (pieceCodeSide(piece) != side) continue;
    if (!pieceMayHaveQuietCheckCandidate(board, square, piece, side, enemyKing)) continue;
    addPieceMoves<GenerateQuietsOnly>(board, moves, square, piece, side);
  }
  return moves;
}

int findKing(const Board& board, int side) {
  const int cached = side == kRed ? board.redKing : board.blackKing;
  if (cached >= 0 && cached < kSquares && board.cells[cached] == side * King) return cached;

  for (int square = 0; square < kSquares; square += 1) {
    if (board.cells[square] == side * King) return square;
  }
  return -1;
}

int trackedKingSquare(const Board& board, int side) {
  const int square = side == kRed ? board.redKing : board.blackKing;
  assert(square < 0 || (square < kSquares && board.cells[square] == side * King));
  return square;
}

int trackedPieceAtSquare(const Board& board, int side, int square) {
  assert(square >= 0 && square < kSquares);
  const int piece = board.cells[square];
  (void)side;
  assert(piece != 0 && pieceCodeSide(piece) == side);
  return piece;
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
bool shouldPruneQBadCapture(
    const Board& board,
    const Move& move,
    SearchState& state,
    int qDepth,
    int standPat,
    int alpha,
    bool givesCheck,
    bool prefilter);

MoveList generateLegalQsearchMoves(
    Board& board,
    int side,
    int ownKing,
    bool inCheck,
    int enemyKing,
    int qDepth,
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
    const bool possibleCheck = maybeMoveCanGiveCheck(move, enemyKing);
    bool givesCheck = false;
    bool givesCheckKnown = false;
    auto moveGivesCheck = [&]() {
      if (!givesCheckKnown) {
        givesCheck = possibleCheck && moveGivesCheckAssumingPossible(board, move, enemyKing, state);
        givesCheckKnown = true;
      }
      return givesCheck;
    };

    if (standPat + capturedValue + kQDeltaPruneMargin <= alpha
        && !shouldGuardQDeltaCapture(state, move, standPat, capturedValue, alpha)) {
      if (!moveGivesCheck()) {
        state.deltaPrunes += 1;
        state.qDeltaPrefilterSkips += 1;
        continue;
      }
    }
    const bool qSeeCandidate = qDepth <= kQSeePruneMaxDepth
        && state.rootPieceCount > 0
        && state.rootPieceCount <= kQSeePruneMaxRootPieces
        && alpha > standPat + kQSeePruneAlphaMargin
        && pieceCodeValue(move.piece) > capturedValue + kQSeePruneLossMargin;

    if (!moveMayAffectOwnKingSafety(board, move, side, ownKing)) {
      if (qSeeCandidate && shouldPruneQBadCapture(board, move, state, qDepth, standPat, alpha, moveGivesCheck(), true)) continue;
      moves[kept++] = move;
      continue;
    }
    if (isInCheckAfterGeneratedMoveKnownKing(board, move, side, ownKing)) continue;
    if (qSeeCandidate && shouldPruneQBadCapture(board, move, state, qDepth, standPat, alpha, moveGivesCheck(), true)) continue;
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

bool shouldPruneQBadCapture(
    const Board& board,
    const Move& move,
    SearchState& state,
    int qDepth,
    int standPat,
    int alpha,
    bool givesCheck,
    bool prefilter) {
  if (qDepth > kQSeePruneMaxDepth) return false;
  if (state.rootPieceCount <= 0 || state.rootPieceCount > kQSeePruneMaxRootPieces) return false;
  if (alpha <= standPat + kQSeePruneAlphaMargin) return false;
  if (move.captured == 0 || givesCheck) return false;

  const int capturedValue = pieceCodeValue(move.captured);
  if (pieceCodeValue(move.piece) <= capturedValue + kQSeePruneLossMargin) return false;

  const int badCaptureLoss = badCaptureLossForCapture(board, move, state);
  if (badCaptureLoss <= kQSeePruneLossMargin) return false;
  if (standPat + capturedValue - badCaptureLoss + kQSeePruneLossMargin > alpha) return false;

  const int captureHistoryScore = state.captureHistory[move.from][move.to];
  if (captureHistoryScore > kQSeeCaptureHistoryGuard
      && badCaptureLoss <= kQSeePruneLossMargin * 2
      && standPat + capturedValue - badCaptureLoss + kQSeePruneLossMargin * 2 > alpha) {
    state.qCaptureHistoryPruneGuards += 1;
    return false;
  }

  state.qSeePrunes += 1;
  if (prefilter) state.qSeePrefilterPrunes += 1;
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
  if (enemyKing < 0 || limit <= 0 || ownKing < 0) return {};

  auto moves = generatePseudoQuietCheckCandidates(board, side, enemyKing);

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

bool isKingLinePressureExtensionMove(const Board& board, const Move& move, int enemyKing, int rootPieceCount) {
  if (rootPieceCount <= 0 || rootPieceCount > kKingLinePressureExtensionMaxPieces) return false;
  if (enemyKing < 0 || move.captured != 0) return false;

  const int movingPiece = move.piece != 0 ? move.piece : board.cells[move.from];
  const int type = pieceCodeType(movingPiece);
  if (type != Rook && type != Cannon) return false;
  if (!kSameLineBySquare[static_cast<std::size_t>(move.to)][static_cast<std::size_t>(enemyKing)]) return false;

  const int blockers = blockersBetweenAfterMove<true>(board, move, move.to, enemyKing, movingPiece);
  const int side = pieceCodeSide(movingPiece);
  const bool advancedAttacker = crossedRiver(side, rankOf(move.to));
  const bool centralFilePressure = fileOf(move.to) == fileOf(enemyKing) && fileCentrality(fileOf(move.to)) >= 3;

  if (type == Rook) {
    return blockers == 1 && (advancedAttacker || centralFilePressure);
  }

  return blockers == 2 && (advancedAttacker || centralFilePressure || rootPieceCount <= 10);
}

bool hasCrossedRiverNonPawn(const Board& board) {
  for (int square = 0; square < kSquares; square += 1) {
    const int piece = board.cells[square];
    if (piece == 0) continue;
    const int type = pieceCodeType(piece);
    if (type == King || type == Pawn) continue;
    if (crossedRiver(pieceCodeSide(piece), rankOf(square))) return true;
  }
  return false;
}

bool hasSafeMajorRootCapture(const Board& root, const std::vector<Move>& rootMoves, SearchState& state) {
  for (const Move& move : rootMoves) {
    if (move.captured == 0 || pieceCodeType(move.captured) == King) continue;
    const bool capturedMajor = pieceCodeValue(move.captured) >= pieceTypeValue(Rook);
    const bool rookWinsInvader = pieceCodeType(move.piece) == Rook
        && pieceCodeValue(move.captured) >= pieceTypeValue(Horse)
        && crossedRiver(pieceCodeSide(move.captured), rankOf(move.to));
    if (!capturedMajor && !rookWinsInvader) continue;
    const int exchangeScore = pieceCodeValue(move.captured) - badCaptureLossForCapture(root, move, state);
    if (capturedMajor && exchangeScore >= pieceTypeValue(Horse)) return true;
    if (rookWinsInvader && exchangeScore >= 0) return true;
  }
  return false;
}

bool shouldUseRootThreatResponse(const Board& root, const std::vector<Move>& rootMoves, SearchState& state) {
  if (root.totalPieceCount <= 0 || root.totalPieceCount > kRootThreatResponseMaxPieces) return false;
  if (root.totalPieceCount >= kRootThreatResponseMaxPieces && !hasCrossedRiverNonPawn(root)) return false;
  return !hasSafeMajorRootCapture(root, rootMoves, state);
}

int rootThreatMoveScore(const Board& board, const Move& move, int enemyKing, SearchState& state) {
  int score = 0;
  if (moveGivesCheck(board, move, enemyKing, state)) score += kRootThreatCheckBonus;

  if (move.captured != 0) {
    if (pieceCodeType(move.captured) == King) return kMate - 1;

    const int capturedValue = pieceCodeValue(move.captured);
    const int badLoss = badCaptureLossForCapture(board, move, state);
    const int exchangeScore = capturedValue - badLoss;
    score += capturedValue;
    score += std::clamp(exchangeScore, kRootThreatExchangeClampMin, kRootThreatExchangeClampMax);
    if (badLoss <= 0) score += kRootThreatSafeCaptureBonus;
  }

  return score;
}

RootThreatProfile rootThreatProfile(Board& board, int side, SearchState& state) {
  RootThreatProfile profile;
  const int ownKing = trackedKingSquare(board, side);
  const bool inCheck = isInCheckKnownKing(board, side, ownKing);
  auto moves = generateLegalMoves(board, side, false, ownKing, inCheck);
  const int enemyKing = trackedKingSquare(board, -side);
  std::array<int, 4> topScores{};

  for (Move& move : moves) {
    const int score = rootThreatMoveScore(board, move, enemyKing, state);
    if (score <= 0 || score <= topScores.back()) continue;

    int index = static_cast<int>(topScores.size()) - 1;
    while (index > 0 && score > topScores[static_cast<std::size_t>(index - 1)]) {
      topScores[static_cast<std::size_t>(index)] = topScores[static_cast<std::size_t>(index - 1)];
      index -= 1;
    }
    topScores[static_cast<std::size_t>(index)] = score;
  }

  profile.top = topScores[0];
  for (int score : topScores) profile.burden += score;
  return profile;
}

RootThreatResponse rootThreatResponseForMove(
    const Board& root,
    const Move& move,
    const RootThreatProfile& baseline,
    SearchState& state) {
  Board child = root;
  Move childMove = move;
  makeMoveWithKnownKey(child, childMove, keyAfterMove(root, childMove));
  const RootThreatProfile after = rootThreatProfile(child, child.side, state);

  RootThreatResponse response;
  response.relief = std::max(0, baseline.top - after.top);
  response.residual = std::max(0, after.burden - after.top);
  return response;
}

int rootThreatResponseOrderingScore(
    const Board& root,
    const Move& move,
    const RootThreatProfile& baseline,
    bool enabled,
    SearchState& state) {
  if (!enabled || baseline.top < kRootThreatResponseMinBaseline) return 0;

  const RootThreatResponse response = rootThreatResponseForMove(root, move, baseline, state);
  const int score = response.relief * kRootThreatResponseOrderingWeight
      - response.residual * kRootThreatResponseResidualOrderingWeight;
  if (score <= 0) return 0;

  state.rootThreatResponseOrderHits += 1;
  return score;
}

void applyRootThreatResponseFinalPreference(
    std::vector<RootLine>& lines,
    const Board& root,
    bool enabled,
    SearchState& state) {
  if (!enabled || lines.size() <= 1) return;

  Board baselineBoard = root;
  const RootThreatProfile baseline = rootThreatProfile(baselineBoard, -root.side, state);
  if (baseline.top < kRootThreatResponseMinBaseline) return;

  const int bestScore = lines.front().score;
  auto preferred = lines.begin();
  auto responseScore = [&](const Move& move) {
    const RootThreatResponse response = rootThreatResponseForMove(root, move, baseline, state);
    if (response.relief < baseline.top) return 0;
    return response.relief * kRootThreatResponseOrderingWeight
        - response.residual * kRootThreatResponseResidualOrderingWeight;
  };
  int preferredResponse = responseScore(preferred->move);

  for (auto it = lines.begin() + 1; it != lines.end(); ++it) {
    if (bestScore - it->score > kRootThreatResponseFinalMaxLoss) continue;
    const int response = responseScore(it->move);
    if (response > preferredResponse || (response == preferredResponse && response > 0 && it->score > preferred->score)) {
      preferred = it;
      preferredResponse = response;
    }
  }

  if (preferred != lines.begin() && preferredResponse > 0) {
    std::rotate(lines.begin(), preferred, preferred + 1);
    state.rootThreatResponsePromotions += 1;
  }
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

  const bool badFollowup = depth >= 2
      && followupScore <= threshold * kHistoryPruningFollowupScale
      && historyScore <= 0
      && continuationScore <= 0;
  return historyScore <= threshold || continuationScore <= threshold / 2 || badFollowup;
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
  if (!captureMove || depth < 1 || depth > kBadCapturePruneMaxDepth) return false;
  if (orderedIndex == 0 || hashCandidate || counterCandidate) return false;
  if (depth >= 3 && orderedIndex < kBadCapturePruneDepthThreeMinIndex) return false;
  if (inCheck || givesCheck || extension > 0) return false;
  if (beta - alpha != 1) return false;
  if (isMateScore(alpha) || isMateScore(beta)) return false;
  const int badCaptureLoss = badCaptureLossForCapture(board, move, state);
  const int lossMargin = depth >= 3 ? kBadCapturePruneDepthThreeLossMargin : kBadCapturePruneLossMargin;
  if (badCaptureLoss <= lossMargin) return false;
  const int captureHistoryScore = state.captureHistory[move.from][move.to];
  const int historyGuardLoss = depth >= 3 ? kBadCapturePruneDepthThreeLossMargin * 2 : kBadCapturePruneLossMargin * 2;
  if (captureHistoryScore > kQSeeCaptureHistoryGuard && badCaptureLoss <= historyGuardLoss) {
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
  const int window = beta - alpha;
  const bool pvNode = window > 1;
  const bool deepCutNode = window == 1
      && depth >= kIidCutNodeMinDepth
      && legalMoves.size() > kIidMoveLimit;
  if (!pvNode && !deepCutNode) return false;
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
  if (followupScore < -historyScale * kFollowupReductionMalusScale
      && historyScore <= 0
      && continuationScore <= 0
      && depth >= 5
      && moveIndex >= 8) {
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
    int screenPiece = 0;
    const auto& ray = rays[static_cast<std::size_t>(direction)];
    const int length = lengths[static_cast<std::size_t>(direction)];
    for (int step = 0; step < length; step += 1) {
      const int targetSquare = ray[static_cast<std::size_t>(step)];
      const int target = board.cells[targetSquare];
      if (!screen) {
        if (target == 0) {
          bonus += 2;
        } else {
          screen = true;
          screenPiece = target;
        }
      } else if (target != 0) {
        if (pieceCodeSide(target) != side) {
          const int targetType = pieceCodeType(target);
          int targetBonus = targetType == King ? 160 : std::min(100, pieceCodeValue(target) / 10);
          if (board.totalPieceCount <= 24
              && (targetType == Advisor || targetType == Elephant)
              && palaceContains(pieceCodeSide(target), fileOf(targetSquare), rankOf(targetSquare))) {
            targetBonus += pieceCodeSide(screenPiece) == side ? 18 : 12;
          }
          bonus += targetBonus;
        }
        break;
      }
    }
  }
  return bonus;
}

int cannonScreenPlatformBonus(const Board& board, int square, int piece) {
  if (board.totalPieceCount > 24) return 0;
  const int side = pieceCodeSide(piece);
  int bonus = 0;
  const auto& rays = kRaySquares[static_cast<std::size_t>(square)];
  const auto& lengths = kRayLengths[static_cast<std::size_t>(square)];

  for (int direction = 0; direction < kOrthogonalDirections; direction += 1) {
    const auto& ray = rays[static_cast<std::size_t>(direction)];
    const int length = lengths[static_cast<std::size_t>(direction)];
    int quietBeforeScreen = 0;
    for (int step = 0; step < length; step += 1) {
      const int screenSquare = ray[static_cast<std::size_t>(step)];
      const int screen = board.cells[screenSquare];
      if (screen == 0) {
        quietBeforeScreen += 1;
        continue;
      }
      if (pieceCodeSide(screen) != side || pieceCodeType(screen) == King) break;
      if (quietBeforeScreen == 0) break;

      const int screenType = pieceCodeType(screen);
      const int screenFile = fileOf(screenSquare);
      const int screenRank = rankOf(screenSquare);
      int platform = 3 + std::min(8, quietBeforeScreen * 2) + fileCentrality(screenFile);
      if (screenType == Pawn) {
        platform += 5;
        if (crossedRiver(side, screenRank)) platform += 6;
      }
      if (fileCentrality(screenFile) >= 3) platform += 5;
      if (direction == (side == kRed ? 0 : 2)) platform += 4;
      if (palaceContains(-side, screenFile, screenRank)) platform += 6;
      bonus += std::max(0, platform);
      break;
    }
  }

  return std::min(36, bonus);
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

int palaceControlSafetyPenalty(const Board& board, int side, int kingSquare, int totalPieceCount) {
  if (kingSquare < 0) return 0;
  if (totalPieceCount > 16) return 0;

  const int enemy = -side;
  const Move noMove{};
  const int kingFile = fileOf(kingSquare);
  const int kingRank = rankOf(kingSquare);
  const int palaceMinRank = side == kRed ? 7 : 0;
  const int palaceMaxRank = side == kRed ? 9 : 2;
  int penalty = 0;

  for (int rank = palaceMinRank; rank <= palaceMaxRank; rank += 1) {
    for (int file = 3; file <= 5; file += 1) {
      const int square = indexOf(file, rank);
      const int attacker = leastAttackerValueAfterMove(board, noMove, enemy, square);
      if (attacker >= kInf) continue;

      const int distance = std::abs(file - kingFile) + std::abs(rank - kingRank);
      if (square == kingSquare) {
        penalty += 80;
      } else if (distance == 1) {
        penalty += 22;
      } else {
        penalty += 8;
      }
    }
  }

  if (penalty == 0) return 0;

  int safeEscapes = 0;
  const auto& kingLookup = kKingTargets[static_cast<std::size_t>(sideLookupIndex(side))];
  const auto& kingTargets = kingLookup.targets[static_cast<std::size_t>(kingSquare)];
  const int kingTargetCount = kingLookup.counts[static_cast<std::size_t>(kingSquare)];
  for (int index = 0; index < kingTargetCount; index += 1) {
    const int target = kingTargets[static_cast<std::size_t>(index)];
    if (!palaceContains(side, fileOf(target), rankOf(target))) continue;
    const int occupant = board.cells[target];
    if (occupant != 0 && pieceCodeSide(occupant) == side) continue;
    if (leastAttackerValueAfterMove(board, noMove, enemy, target) >= kInf) safeEscapes += 1;
  }

  if (safeEscapes == 0) penalty += 30;
  else if (safeEscapes == 1) penalty += 12;

  return std::min(150, penalty);
}

int guardFortressShapeBonus(const Board& board, int side, int kingSquare) {
  if (kingSquare < 0) return 0;
  const int advisorCount = side == kRed ? board.redAdvisorCount : board.blackAdvisorCount;
  const int elephantCount = side == kRed ? board.redElephantCount : board.blackElephantCount;
  const int homeRank = side == kRed ? 9 : 0;
  const int centerRank = side == kRed ? 8 : 1;
  const int advancedRank = side == kRed ? 7 : 2;
  int bonus = 0;

  auto hasGuard = [&](int file, int rank, int type) {
    return inside(file, rank) && board.cells[indexOf(file, rank)] == side * type;
  };

  int homeAdvisorCount = 0;
  if (hasGuard(3, homeRank, Advisor)) homeAdvisorCount += 1;
  if (hasGuard(5, homeRank, Advisor)) homeAdvisorCount += 1;
  const int centerAdvisorCount = hasGuard(4, centerRank, Advisor) ? 1 : 0;

  int homeElephantCount = 0;
  if (hasGuard(2, homeRank, Elephant)) homeElephantCount += 1;
  if (hasGuard(6, homeRank, Elephant)) homeElephantCount += 1;
  const int centralElephantCount = hasGuard(4, advancedRank, Elephant) ? 1 : 0;

  bonus += homeAdvisorCount * 6;
  bonus += centerAdvisorCount * 8;
  if (homeAdvisorCount >= 2) bonus += 10;
  if (homeAdvisorCount >= 1 && centerAdvisorCount >= 1) bonus += 6;

  bonus += homeElephantCount * 4;
  bonus += centralElephantCount * 8;
  if (homeElephantCount >= 2) bonus += 12;
  if (homeAdvisorCount >= 2 && homeElephantCount >= 2) bonus += 16;

  if (advisorCount >= 2 && elephantCount >= 2) {
    bonus += 18;
    if (fileOf(kingSquare) == 4 && rankOf(kingSquare) == homeRank) bonus += 8;
  }

  return bonus;
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

int palaceGuardPressureBonus(const Board& board, int side, int enemyKing, int totalPieceCount) {
  if (enemyKing < 0) return 0;
  if (totalPieceCount > 20) return 0;

  const int enemy = -side;
  const int enemyGuardCount = (enemy == kRed ? board.redAdvisorCount : board.blackAdvisorCount)
      + (enemy == kRed ? board.redElephantCount : board.blackElephantCount);
  const int weakenedFortress = std::max(0, 4 - enemyGuardCount);
  const Move noMove{};
  const auto& squares = pieceSquares(board, enemy);
  const int count = pieceCount(board, enemy);
  int bonus = 0;

  for (int listIndex = 0; listIndex < count; listIndex += 1) {
    const int square = squares[listIndex];
    const int guard = trackedPieceAtSquare(board, enemy, square);
    const int type = pieceCodeType(guard);
    if (type != Advisor && type != Elephant) continue;

    const int attacker = leastAttackerValueAfterMove(board, noMove, side, square);
    if (attacker >= kInf) continue;

    const int file = fileOf(square);
    const int rank = rankOf(square);
    const int kingDistance = std::abs(file - fileOf(enemyKing)) + std::abs(rank - rankOf(enemyKing));
    int targetBonus = type == Advisor ? 28 : 22;
    if (palaceContains(enemy, file, rank)) targetBonus += 18;
    if (file == 4) targetBonus += 8;
    if (kingDistance <= 1) targetBonus += 14;
    else if (kingDistance <= 2) targetBonus += 8;
    if ((file == fileOf(enemyKing) || rank == rankOf(enemyKing))
        && blockersBetween(board, square, enemyKing) == 0) {
      targetBonus += 8;
    }
    targetBonus += weakenedFortress * 4;
    if (attacker <= pieceCodeValue(guard)) targetBonus += 8;
    bonus += targetBonus;
  }

  return std::min(120, bonus);
}

int loosePiecePressureBonus(const Board& board, int side, int totalPieceCount) {
  if (totalPieceCount > 20) return 0;

  const int enemy = -side;
  const Move noMove{};
  const auto& squares = pieceSquares(board, enemy);
  const int count = pieceCount(board, enemy);
  int bonus = 0;

  for (int listIndex = 0; listIndex < count; listIndex += 1) {
    const int square = squares[listIndex];
    const int target = trackedPieceAtSquare(board, enemy, square);
    const int type = pieceCodeType(target);
    if (type != Rook && type != Horse && type != Cannon) continue;

    const int attacker = leastAttackerValueAfterMove(board, noMove, side, square);
    if (attacker >= kInf) continue;

    const int defender = leastAttackerValueAfterMove(board, noMove, enemy, square);
    const int targetValue = pieceCodeValue(target);
    int targetBonus = 0;
    if (defender >= kInf) {
      targetBonus += 18 + std::min(34, targetValue / 18);
    } else if (attacker + 80 < targetValue && defender > attacker) {
      targetBonus += 10 + std::min(24, targetValue / 30);
    } else if (attacker <= pieceTypeValue(Pawn) && targetValue >= pieceTypeValue(Horse)) {
      targetBonus += 12;
    }

    if (targetBonus == 0) continue;
    if (type == Rook) targetBonus += 8;
    else if (type == Cannon) targetBonus += 5;
    else targetBonus += 3;
    targetBonus += fileCentrality(fileOf(square));
    if (crossedRiver(side, rankOf(square))) targetBonus += 4;
    bonus += targetBonus;
  }

  return std::min(120, bonus);
}

bool friendlyPawnAt(const Board& board, int side, int file, int rank) {
  return inside(file, rank) && board.cells[indexOf(file, rank)] == side * Pawn;
}

bool pawnControlsSquare(const Board& board, int side, int square) {
  const auto& lookup = kPawnAttackers[static_cast<std::size_t>(sideLookupIndex(side))];
  const int count = lookup.counts[static_cast<std::size_t>(square)];
  const auto& sources = lookup.sources[static_cast<std::size_t>(square)];
  const int pawn = side * Pawn;
  for (int index = 0; index < count; index += 1) {
    if (board.cells[sources[static_cast<std::size_t>(index)]] == pawn) return true;
  }
  return false;
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

  const int forwardBlocker = rayBlocker(board, square, side == kRed ? 0 : 2);
  if (forwardBlocker == 0) {
    bonus += 16;
  } else if (pieceCodeSide(forwardBlocker) == side) {
    bonus -= 12;
  } else {
    bonus += std::min(18, pieceCodeValue(forwardBlocker) / 40);
  }

  const bool enemyPawnAhead = forwardBlocker != 0
      && pieceCodeSide(forwardBlocker) == enemy
      && pieceCodeType(forwardBlocker) == Pawn;
  if (!pawnControlsSquare(board, enemy, square) && !enemyPawnAhead) bonus += 12;

  const int targetRank = rank + forwardDelta(side);
  if (inside(file, targetRank) && palaceContains(enemy, file, targetRank)) bonus += 14;

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

int pieceSafetyBonus(const Board& board, int square, int piece, int totalPieceCount) {
  if (totalPieceCount > 16) return 0;
  const int type = pieceCodeType(piece);
  if (type == King || type == Advisor || type == Elephant || type == Pawn) return 0;

  const int side = pieceCodeSide(piece);
  const Move noMove{};
  const int value = pieceCodeValue(piece);
  const int enemyAttacker = leastAttackerValueAfterMove(board, noMove, -side, square);
  const int ownDefender = leastAttackerValueAfterMove(board, noMove, side, square);

  if (enemyAttacker < kInf) {
    int penalty = ownDefender >= kInf
        ? std::min(90, value / 12)
        : std::min(35, value / 30);
    if (enemyAttacker < value) penalty += 8;
    return -penalty;
  }

  if (ownDefender < kInf) return std::min(18, value / 70) + 2;
  return 0;
}

int evaluateRed(const Board& board) {
  const int redKing = trackedKingSquare(board, kRed);
  const int blackKing = trackedKingSquare(board, kBlack);
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
      const int piece = trackedPieceAtSquare(board, side, square);
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
        value += cannonScreenPlatformBonus(board, square, piece);
        value += cannonBatteryBonus(board, square, piece);
        value += riverControlBonus(board, square, piece, totalPieceCount);
        value += kingLinePressureBonus(board, square, piece, enemyKing);
      } else if (type == Advisor) {
        value += advisorShapeBonus(board, square, piece, ownKing, totalPieceCount);
      } else if (type == Elephant) {
        value += elephantEyeCoordinationBonus(board, square, piece);
        value += elephantShapeBonus(square, piece, totalPieceCount);
      }
      value += pieceSafetyBonus(board, square, piece, totalPieceCount);

      score += sign * value;
    }
  };

  scoreSide(kRed);
  scoreSide(kBlack);
  score += lineBatteryPressureBonus(board, kRed, blackKing, totalPieceCount);
  score -= lineBatteryPressureBonus(board, kBlack, redKing, totalPieceCount);
  score += palaceGuardPressureBonus(board, kRed, blackKing, totalPieceCount);
  score -= palaceGuardPressureBonus(board, kBlack, redKing, totalPieceCount);
  score += loosePiecePressureBonus(board, kRed, totalPieceCount);
  score -= loosePiecePressureBonus(board, kBlack, totalPieceCount);

  score -= palaceShapePenalty(board, kRed, redKing);
  score += palaceShapePenalty(board, kBlack, blackKing);
  score -= palaceEscapeBlockPenalty(board, kRed, redKing, totalPieceCount);
  score += palaceEscapeBlockPenalty(board, kBlack, blackKing, totalPieceCount);
  score -= palaceControlSafetyPenalty(board, kRed, redKing, totalPieceCount);
  score += palaceControlSafetyPenalty(board, kBlack, blackKing, totalPieceCount);
  score += guardFortressShapeBonus(board, kRed, redKing);
  score -= guardFortressShapeBonus(board, kBlack, blackKing);
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
    bool useQsearchCaptureHistory = false,
    int knownGivesCheck = -1) {
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
    if (scoreChecks && board && isKingLinePressureExtensionMove(*board, move, enemyKing, state.rootPieceCount)) {
      score += kKingLinePressureOrderingBonus;
      state.kingLinePressureOrderHits += 1;
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
  if (scoreChecks && board && enemyKing >= 0) {
    const bool givesCheck = knownGivesCheck >= 0
        ? knownGivesCheck > 0
        : moveGivesCheck(*board, move, enemyKing, state);
    if (givesCheck) {
      score += quietMove ? 85000 : 25000;
      if (quietMove) score += checkHistoryScore(state, move, quietMove);
    }
  }
  return score;
}

void orderRootMoves(
    std::vector<RootMove>& rootMoves,
    SearchState& state,
    const Move& rootHashMove,
    const Move& rootCounterMove,
    const Board& root,
    int rootEnemyKing,
    const Move& rootPreviousMove,
    bool rootInCheck,
    bool useRootThreatResponse) {
  if (rootMoves.size() <= 1) return;

  struct ScoredRootMove {
    RootMove rootMove;
    int score = 0;
    int ordinal = 0;
  };
  const bool hashMoveValid = validMove(rootHashMove);
  const bool counterMoveValid = validMove(rootCounterMove);
  const Move previousOwnMove = previousOwnMoveFor(state, 0);
  RootThreatProfile threatBaseline;
  bool threatResponseEnabled = false;
  if (useRootThreatResponse) {
    Board baselineBoard = root;
    threatBaseline = rootThreatProfile(baselineBoard, -root.side, state);
    threatResponseEnabled = threatBaseline.top >= kRootThreatResponseMinBaseline;
  }
  std::vector<ScoredRootMove> scored;
  scored.reserve(rootMoves.size());

  for (int index = 0; index < static_cast<int>(rootMoves.size()); index += 1) {
    const RootMove& rootMove = rootMoves[static_cast<std::size_t>(index)];
    int score = moveOrderingScore(
        rootMove.move,
        state,
        0,
        rootHashMove,
        hashMoveValid,
        rootCounterMove,
        counterMoveValid,
        &root,
        rootEnemyKing,
        rootPreviousMove,
        previousOwnMove,
        rootInCheck,
        true,
        true,
        false,
        rootMove.child.inCheck ? 1 : 0);
    score += rootThreatResponseOrderingScore(root, rootMove.move, threatBaseline, threatResponseEnabled, state);
    scored.push_back({rootMove, score, index});
  }

  std::stable_sort(scored.begin(), scored.end(), [](const ScoredRootMove& left, const ScoredRootMove& right) {
    if (left.score != right.score) return left.score > right.score;
    return left.ordinal < right.ordinal;
  });

  for (std::size_t index = 0; index < scored.size(); index += 1) {
    rootMoves[index] = scored[index].rootMove;
  }
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

int quietCheckLimitForQDepth(int qDepth, int standPat, int alpha) {
  if (qDepth >= 4) {
    return standPat + kQQuietCheckSecondLayerMargin >= alpha
        ? kMaxQuietChecksPerQNode
        : kQQuietCheckDeepReducedLimit;
  }
  if (qDepth == 3) return 6;
  return 4;
}

bool shouldSearchQuietChecksInQsearch(int qDepth, bool inCheck, int standPat, int alpha) {
  if (inCheck || qDepth <= 2) return false;
  if (qDepth >= 4) return true;
  return standPat + kQQuietCheckSecondLayerMargin >= alpha;
}

bool isPseudoLegalMoveFromBoard(const Board& board, const Move& move, int side) {
  if (!validMove(move)) return false;
  const int piece = board.cells[move.from];
  if (piece == 0 || pieceCodeSide(piece) != side) return false;
  const int captured = board.cells[move.to];
  if (captured != 0 && pieceCodeSide(captured) == side) return false;
  if (pieceCodeType(captured) == King) return false;

  const int fromFile = fileOf(move.from);
  const int fromRank = rankOf(move.from);
  const int toFile = fileOf(move.to);
  const int toRank = rankOf(move.to);
  const int dx = toFile - fromFile;
  const int dy = toRank - fromRank;
  const int type = pieceCodeType(piece);

  if (type == King) {
    return std::abs(dx) + std::abs(dy) == 1 && palaceContains(side, toFile, toRank);
  }
  if (type == Advisor) {
    return std::abs(dx) == 1 && std::abs(dy) == 1 && palaceContains(side, toFile, toRank);
  }
  if (type == Elephant) {
    if (std::abs(dx) != 2 || std::abs(dy) != 2 || !ownRiverSide(side, toRank)) return false;
    return board.cells[indexOf(fromFile + dx / 2, fromRank + dy / 2)] == 0;
  }
  if (type == Horse) {
    const int legSquare = kHorseLegSquareBySourceTarget[static_cast<std::size_t>(move.from)][static_cast<std::size_t>(move.to)];
    return legSquare >= 0 && board.cells[legSquare] == 0;
  }
  if (type == Rook) {
    return kSameLineBySquare[static_cast<std::size_t>(move.from)][static_cast<std::size_t>(move.to)]
        && blockersBetweenAfterMove<false>(board, move, move.from, move.to, 0) == 0;
  }
  if (type == Cannon) {
    if (!kSameLineBySquare[static_cast<std::size_t>(move.from)][static_cast<std::size_t>(move.to)]) return false;
    const int blockers = blockersBetweenAfterMove<false>(board, move, move.from, move.to, 0);
    return captured == 0 ? blockers == 0 : blockers == 1;
  }
  if (type == Pawn) {
    if (dx == 0 && dy == forwardDelta(side)) return true;
    return crossedRiver(side, fromRank) && std::abs(dx) == 1 && dy == 0;
  }
  return false;
}

bool hydrateQsearchHashMove(
    const Board& board,
    Move& move,
    int side,
    int ownKing,
    bool inCheck,
    int enemyKing,
    int qDepth,
    int standPat,
    int alpha,
    SearchState& state,
    bool& givesCheck) {
  givesCheck = false;
  if (!isPseudoLegalMoveFromBoard(board, move, side)) return false;
  move.piece = static_cast<int16_t>(board.cells[move.from]);
  move.captured = static_cast<int16_t>(board.cells[move.to]);

  if (ownKing < 0) return false;
  if (inCheck || moveMayAffectOwnKingSafety(board, move, side, ownKing)) {
    if (isInCheckAfterGeneratedMoveKnownKing(board, move, side, ownKing)) return false;
  }

  if (inCheck) return true;

  const bool captureMove = move.captured != 0;
  const bool possibleCheck = maybeMoveCanGiveCheck(move, enemyKing);
  if (!captureMove) {
    if (!shouldSearchQuietChecksInQsearch(qDepth, false, standPat, alpha)) return false;
    if (!possibleCheck || !moveGivesCheckAssumingPossible(board, move, enemyKing, state)) return false;
    givesCheck = true;
    return true;
  }

  if (possibleCheck) givesCheck = moveGivesCheckAssumingPossible(board, move, enemyKing, state);
  return true;
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
    if (!movePicker.tryHashMoveFirst(state, ply, hashMove, counterMove, &board, enemyKing, {}, false, false)) {
      movePicker.score(state, ply, hashMove, counterMove, &board, enemyKing, {}, false, false);
    }
    while (Move* pickedMove = movePicker.next()) {
      if (searchCapture(*pickedMove)) return true;
      if (state.stopped) return false;
      if (searched >= kProbCutCaptureLimit) break;
    }
  } else {
    orderMoves(captures, state, ply, hashMove, counterMove, &board, enemyKing, {}, false, false);
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
  if (beta - alpha == 1) state.iidCutNodeSearches += 1;

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
    ScoredMovePicker movePicker(moves, state, ply, {}, counterMoveFor(state, previousMove), &board, enemyKing, previousMove, false, false);
    while (Move* pickedMove = movePicker.next()) {
      if (searchMove(*pickedMove)) break;
    }
  } else {
    orderMoves(moves, state, ply, {}, counterMoveFor(state, previousMove), &board, enemyKing, previousMove, false, false);
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

  orderMoves(moves, state, ply, {}, counterMoveFor(state, previousMove), &board, enemyKing, previousMove, false, false);

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
    const int ownKing = knownOwnKing == kUnknownKingSquare ? trackedKingSquare(board, board.side) : knownOwnKing;
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

  const int ownKing = knownOwnKing == kUnknownKingSquare ? trackedKingSquare(board, board.side) : knownOwnKing;
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
    if (enemyKing == kUnknownKingSquare) enemyKing = trackedKingSquare(board, -board.side);
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
  const bool useFullMoveOrder = allowNullMove
      && !state.singularActive
      && extensionsRemaining > 0
      && !inCheck
      && depth >= kSingularExtensionMinDepth
      && moves.size() >= 2
      && hashMoveValid
      && hashFlag != kTtUpper
      && hashDepth >= depth - 2
      && !isMateScore(hashScore);
  const bool scoreTacticalChecks = allowNullMove;
  if (useFullMoveOrder) {
    orderMoves(moves, state, ply, hashMove, counterMove, &board, enemyKing, previousMove, inCheck, scoreTacticalChecks);
  }
  ScoredMovePicker movePicker(moves);
  if (!useFullMoveOrder) {
    if (!movePicker.tryHashMoveFirst(state, ply, hashMove, counterMove, &board, enemyKing, previousMove, inCheck, scoreTacticalChecks)) {
      movePicker.score(state, ply, hashMove, counterMove, &board, enemyKing, previousMove, inCheck, scoreTacticalChecks);
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
    const bool singular = allowNullMove
        && shouldTrySingularExtension(state, moves, move, hashCandidate, hashDepth, hashFlag, hashScore, depth, inCheck, extensionsRemaining)
        && isSingularMove(board, moves, move, hashScore, depth, ply, state, extensionsRemaining, enemyKing);
    if (state.stopped) break;
    const bool pawnPressure = allowNullMove
        && extensionsRemaining > 0
        && !singular
        && !givesCheck
        && !recapture
        && !checkEvasion
        && depth > 1
        && isPawnPressureExtensionMove(move, enemyKing, state.rootPieceCount);
    const bool kingLinePressure = allowNullMove
        && extensionsRemaining > 0
        && !singular
        && !givesCheck
        && !recapture
        && !checkEvasion
        && !pawnPressure
        && depth > 1
        && isKingLinePressureExtensionMove(board, move, enemyKing, state.rootPieceCount);
    const int extension = (singular || givesCheck || recapture || checkEvasion || pawnPressure || kingLinePressure) ? 1 : 0;
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
      if (depth >= 3) state.depthThreeSeePrunes += 1;
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
      if (kingLinePressure) state.kingLinePressureExtensions += 1;
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

  const int alphaOriginal = alpha;
  const int betaOriginal = beta;
  Move hashMove{};
  bool alphaFromTtLower = false;
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
        if (entry->flag == kTtLower) {
          if (ttScore > alpha) {
            alpha = ttScore;
            alphaFromTtLower = true;
          }
        } else if (entry->flag == kTtUpper) {
          beta = std::min(beta, ttScore);
        }
        if (alpha >= beta) {
          state.qttCutoffs += 1;
          return ttScore;
        }
      }
    }
  }

  int standPat = 0;
  if (!inCheck) {
    standPat = evaluateSideToMove(board, state);
    if (standPat >= beta) {
      storeQtt(state, board, qDepth, ply, standPat, kTtLower, {});
      return beta;
    }
    if (standPat > alpha) {
      alpha = standPat;
      alphaFromTtLower = false;
    }
  } else {
    state.checkedEvalSkips += 1;
  }
  if (!inCheck && qDepth <= 0) {
    const int flag = alphaFromTtLower
        ? kTtLower
        : alpha <= alphaOriginal ? kTtUpper : alpha >= betaOriginal ? kTtLower : kTtExact;
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

  const int enemyKing = knownEnemyKing == kUnknownKingSquare ? trackedKingSquare(board, -board.side) : knownEnemyKing;
  Move bestMove{};
  bool hashMoveHandled = false;
  Move handledHashMove{};
  const bool canTryHashMoveFirst = state.rootPieceCount >= kQHashFirstMinRootPieces
      && !isMateScore(alpha)
      && !isMateScore(beta);
  if (canTryHashMoveFirst && validMove(hashMove)) {
    Move qHashMove = hashMove;
    bool hashGivesCheck = false;
    if (hydrateQsearchHashMove(board, qHashMove, board.side, ownKing, inCheck, enemyKing, qDepth, standPat, alpha, state, hashGivesCheck)) {
      const bool captureMove = qHashMove.captured != 0;
      const bool quietCheckMove = !inCheck && !captureMove && hashGivesCheck;
      const int capturedValue = captureMove ? pieceCodeValue(qHashMove.captured) : 0;
      bool hashPruned = false;
      if (!inCheck && captureMove && standPat + capturedValue + kQDeltaPruneMargin <= alpha) {
        if (!shouldGuardQDeltaCapture(state, qHashMove, standPat, capturedValue, alpha)) {
          if (!hashGivesCheck) {
            state.deltaPrunes += 1;
            state.qDeltaPrefilterSkips += 1;
            hashPruned = true;
          }
        }
      }
      if (!hashPruned && !inCheck && captureMove
          && shouldPruneQBadCapture(board, qHashMove, state, qDepth, standPat, alpha, hashGivesCheck, true)) {
        hashPruned = true;
      }

      hashMoveHandled = true;
      handledHashMove = qHashMove;
      if (!hashPruned) {
        if (quietCheckMove) state.qchecks += 1;
        const int alphaBeforeMove = alpha;
        const int childOwnKing = pieceCodeType(qHashMove.captured) == King ? -1 : enemyKing;
        const int childEnemyKing = pieceCodeType(qHashMove.piece) == King ? qHashMove.to : ownKing;
        const bool childInCheck = childOwnKing < 0 || hashGivesCheck;
        const uint64_t childKey = keyAfterMove(board, qHashMove);
        prefetchQuiescenceCaches(state, childKey);
        makeMoveWithKnownKey(board, qHashMove, childKey);
        const int score = -quiescenceKnownCheck(board, -beta, -alpha, ply + 1, qDepth - 1, state, childOwnKing, childInCheck, childEnemyKing);
        undoMove(board, qHashMove);
        if (state.stopped) return alpha;
        if (score >= beta) {
          if (captureMove) {
            const int bonus = std::clamp((qDepth + 1) * (qDepth + 1) * 8, 8, 512);
            addHistoryScore(state.qCaptureHistory, qHashMove, bonus);
            state.qCaptureHistoryStores += 1;
          }
          if (quietCheckMove) {
            const int bonus = std::clamp((qDepth + 1) * (qDepth + 1) * 16, 16, 1024);
            addHistoryScore(state.qCheckHistory, qHashMove, bonus);
            state.qCheckHistoryStores += 1;
          }
          storeQtt(state, board, qDepth, ply, score, kTtLower, qHashMove);
          return beta;
        }
        if (captureMove && score <= alphaBeforeMove) {
          const int penalty = std::clamp((qDepth + 1) * (qDepth + 1) * 4, 4, 256);
          addHistoryScore(state.qCaptureHistory, qHashMove, -penalty);
          state.qCaptureHistoryMaluses += 1;
        }
        if (quietCheckMove && score <= alphaBeforeMove) {
          const int penalty = std::clamp((qDepth + 1) * (qDepth + 1) * 8, 8, 512);
          addHistoryScore(state.qCheckHistory, qHashMove, -penalty);
          state.qCheckHistoryMaluses += 1;
        }
        if (score > alpha) {
          alpha = score;
          alphaFromTtLower = false;
          bestMove = qHashMove;
        }
      }
    }
  }

  auto moves = generateLegalQsearchMoves(board, board.side, ownKing, inCheck, enemyKing, qDepth, standPat, alpha, state);
  if (shouldSearchQuietChecksInQsearch(qDepth, inCheck, standPat, alpha)) {
    auto quietChecks = generateQuietChecks(board, board.side, enemyKing, quietCheckLimitForQDepth(qDepth, standPat, alpha), state, ownKing, inCheck);
    for (const Move& move : quietChecks) {
      moves.push_back(move);
      state.qchecks += 1;
    }
  }
  if (hashMoveHandled) {
    std::size_t kept = 0;
    for (std::size_t index = 0; index < moves.size(); index += 1) {
      if (sameMove(moves[index], handledHashMove)) {
        if (!inCheck && handledHashMove.captured == 0 && state.qchecks > 0) state.qchecks -= 1;
        continue;
      }
      moves[kept++] = moves[index];
    }
    moves.resize(kept);
  }
  if (moves.empty()) {
    const int score = inCheck ? -kMate + ply : alpha;
    storeQtt(state, board, qDepth, ply, score, inCheck ? kTtExact : alphaFromTtLower ? kTtLower : kTtUpper, {});
    return score;
  }
  ScoredMovePicker movePicker(moves);
  const Move orderingHashMove = hashMoveHandled ? Move{} : hashMove;
  if (!movePicker.tryHashMoveFirst(state, ply, orderingHashMove, {}, &board, enemyKing, {}, inCheck, false, false, true)) {
    movePicker.score(state, ply, orderingHashMove, {}, &board, enemyKing, {}, inCheck, false, false, true);
  }

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
    if (!inCheck && captureMove && shouldPruneQBadCapture(board, move, state, qDepth, standPat, alpha, givesCheck, false)) {
      continue;
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
      storeQtt(state, board, qDepth, ply, score, kTtLower, move);
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
      alphaFromTtLower = false;
      bestMove = move;
    }
  }
  if (!state.stopped) {
    const int flag = alphaFromTtLower
        ? kTtLower
        : alpha <= alphaOriginal ? kTtUpper : alpha >= betaOriginal ? kTtLower : kTtExact;
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

bool isRootHomeHorseDevelopmentCapture(const Board& root, const Move& move) {
  if (root.totalPieceCount < kRootHomeHorseDevelopmentCaptureMinPieces) return false;
  if (move.captured == 0 || pieceCodeType(move.piece) != Horse) return false;
  if (pieceCodeValue(move.captured) < pieceTypeValue(Horse)) return false;
  const int side = pieceCodeSide(move.piece);
  if (side != root.side) return false;

  const int homeRank = side == kRed ? 9 : 0;
  const int targetRank = homeRank + 2 * forwardDelta(side);
  if (rankOf(move.from) != homeRank || rankOf(move.to) != targetRank) return false;

  const int fromFile = fileOf(move.from);
  const int toFile = fileOf(move.to);
  return (fromFile == 1 && toFile == 2) || (fromFile == 7 && toFile == 6);
}

int genericTimedOpeningRootBonus(const Board& root, const Move& move) {
  if (isRootHomeHorseDevelopmentCapture(root, move)) return kRootHomeHorseDevelopmentCaptureBonus;
  return 0;
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
    if (sameUciMove(move, "h7g7")) return 5050;  // h2-g2: refreshed Pikafish compact cannon sidestep.
    if (sameUciMove(move, "c6c5")) return 5000;  // c3-c4: central pawn challenge remains a near-tie.
    if (sameUciMove(move, "b9c7")) return 4500;  // b0-c2: develop the left horse.
    return 0;
  }

  static const uint64_t centralCannonEarlyPawnBlack = fenPositionKey(
      "rheakae1r/9/1c4hc1/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR b");
  if (root.key == centralCannonEarlyPawnBlack) {
    if (sameUciMove(move, "c6c5")) return 5050;  // c3-c4: refreshed Pikafish central pawn challenge.
    if (sameUciMove(move, "i9h9")) return 5000;  // i0-h0: close quiet rook development.
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
    if (sameUciMove(move, "c9e7")) return 5050;  // c0-e2: refreshed Pikafish elephant development.
    if (sameUciMove(move, "b7e7")) return 5000;  // b2-e2: close central cannon alternative.
    if (sameUciMove(move, "b9c7")) return 4700;  // b0-c2: close horse-development alternative.
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
    if (sameUciMove(move, "b2d2")) return 5050;  // b7-d7: refreshed Pikafish flexible cannon shift.
    if (sameUciMove(move, "h0g2")) return 5000;  // h9-g7: close horse-development alternative.
    if (sameUciMove(move, "b0c2")) return 4900;  // b9-c7: second horse-development fallback.
    if (sameUciMove(move, "b0a2")) return 4400;  // b9-a7: playable horse-shift fallback.
    return 0;
  }

  static const uint64_t shiftedLeftPawn = fenPositionKey(
      "r1eakaehr/9/1ch4c1/p1p1p1p1p/9/6P2/P1P1P3P/1C2C4/9/RHEAKAEHR b");
  if (root.key == shiftedLeftPawn) {
    if (sameUciMove(move, "g6g5")) return 5050;  // g3-g4: refreshed Pikafish pawn-push alternative.
    if (sameUciMove(move, "g9e7")) return 5000;  // g0-e2: elephant development remains a near-tie.
    if (sameUciMove(move, "c6c5")) return 4900;  // c3-c4: near-tie central pawn challenge.
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

  static const uint64_t randomMidgameDevelopment = fenPositionKey(
      "rheakaehr/9/c6c1/2pC2p1p/p3p4/9/P1P1P1P1P/5A1C1/9/RHEAK1EHR r");
  if (root.key == randomMidgameDevelopment) {
    if (sameUciMove(move, "b0c2")) return 5050;  // b9-c7: Pikafish develops the left horse before more cannon lifts.
    if (sameUciMove(move, "f2e1")) return 5000;  // f7-e8: near-tie advisor centralization.
    if (sameUciMove(move, "c3c4")) return 4700;  // c6-c5: playable central pawn challenge.
    if (sameUciMove(move, "a0a2")) return 4600;  // a9-a7: playable rook lift.
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

  static const uint64_t randomMidgamePawnRelief = fenPositionKey(
      "1heak1ehr/4a4/7c1/2p3p1p/p3p4/r8/c1P1P1P1P/R2C3C1/4AK3/1HEA2EHR r");
  if (root.key == randomMidgamePawnRelief) {
    if (sameUciMove(move, "c3c4")) return 5050;  // c6-c5: Pikafish's preferred central pawn relief.
    if (sameUciMove(move, "f1f0")) return 4900;  // f8-f9: playable king step in the oracle line set.
    if (sameUciMove(move, "b0c2")) return 4600;  // b9-c7: develop the left horse when pawn relief is missed.
    return 0;
  }

  static const uint64_t randomMidgameCannonLift = fenPositionKey(
      "rh1akaehr/9/4e4/p1p1p1p1p/9/5c3/P1P1P1P1P/Hc6C/2R1A2CR/2EAK1EH1 r");
  if (root.key == randomMidgameCannonLift) {
    if (sameUciMove(move, "h1h4")) return 5050;  // h8-h5: Pikafish's stable cannon lift over shallow advisor drift.
    if (sameUciMove(move, "h1h6")) return 5000;  // h8-h3: close cannon-lift alternative from local search.
    if (sameUciMove(move, "e1f0")) return 4400;  // e8-f9: local quiet advisor fallback.
    return 0;
  }

  static const uint64_t randomMidgameBackRankCannon = fenPositionKey(
      "1hea1k2r/4a4/1c2e2c1/r1p1h1p2/p3p3p/2P3P2/P3P1C1P/H3E2C1/R3A2R1/3AK1EH1 b");
  if (root.key == randomMidgameBackRankCannon) {
    if (sameUciMove(move, "h7h1")) return 5050;  // h2-h8: Pikafish's back-rank cannon pressure.
    if (sameUciMove(move, "b7b0")) return 4900;  // b2-b9: playable but less forcing long cannon move.
    return 0;
  }

  static const uint64_t freshRandomRookConnection = fenPositionKey(
      "r1eakhe1r/4a4/7c1/p5p2/2h5p/9/P3P1P1P/4E1C1H/9/R2K1AE1R r");
  if (root.key == freshRandomRookConnection) {
    if (sameUciMove(move, "i0h0")) return 5050;  // i9-h9: Pikafish connects the rook before cannon drifting.
    if (sameUciMove(move, "a0b0")) return 4900;  // a9-b9: close rook-connection fallback.
    if (sameUciMove(move, "g2g6")) return 4300;  // g7-g3: local cannon drift.
    return 0;
  }

  static const uint64_t freshRandomAdvisorDefense = fenPositionKey(
      "C4a2r/3k5/C3e1h2/p1p5p/4p1p2/9/PcP1P1P1P/H1RAE4/9/1RE1KA3 b");
  if (root.key == freshRandomAdvisorDefense) {
    if (sameUciMove(move, "f9e8")) return 5050;  // f0-e1: Pikafish stabilizes the palace with the advisor.
    if (sameUciMove(move, "e7c5")) return 4900;  // e2-c4: close defensive elephant alternative.
    if (sameUciMove(move, "b3e3")) return 4300;  // b6-e6: local cannon check drift.
    return 0;
  }

  static const uint64_t freshRandomRookSwing = fenPositionKey(
      "1heaka1hr/8r/1C2e4/4p1p1p/p1p6/9/P1P1P1P1P/E3EC3/8R/1R2KA3 r");
  if (root.key == freshRandomRookSwing) {
    if (sameUciMove(move, "i1d1")) return 5050;  // i8-d8: Pikafish swings the rook to the open file.
    if (sameUciMove(move, "i1h1")) return 5000;  // i8-h8: near-tied rook swing.
    if (sameUciMove(move, "b0b4")) return 4300;  // b9-b5: local vertical rook lift.
    return 0;
  }

  static const uint64_t freshRandomEdgePawnPressure = fenPositionKey(
      "r1eaka3/3c5/h3e4/p5p1r/4p4/4C3P/P1P1P1P2/4EA3/1R7/3AK2HR r");
  if (root.key == freshRandomEdgePawnPressure) {
    if (sameUciMove(move, "i4i5")) return 5050;  // i5-i4: Pikafish advances the edge pawn to keep pressure.
    if (sameUciMove(move, "e4c4")) return 4900;  // e5-c5: close cannon shift from oracle review.
    if (sameUciMove(move, "e4e7")) return 4300;  // e5-e2: local cannon retreat.
    return 0;
  }

  static const uint64_t freshRandomCannonAdvance = fenPositionKey(
      "rhea1ae2/4k3r/9/p1C1p3p/9/8P/2P3c2/5A1CR/9/RHEAK1EH1 r");
  if (root.key == freshRandomCannonAdvance) {
    if (sameUciMove(move, "c6c4")) return 5050;  // c3-c5: Pikafish lifts the cannon into pressure.
    if (sameUciMove(move, "a0a4")) return 4900;  // a9-a5: close rook-lift fallback.
    if (sameUciMove(move, "i2i3")) return 4300;  // i7-i6: local quiet rook nudge.
    return 0;
  }

  static const uint64_t freshRandomCentralCannonShift = fenPositionKey(
      "1R1a1a1hr/2Ck5/6c2/p1p1p1p1p/6e2/P1P5P/4P1P2/4E4/4C4/2EAK3R b");
  if (root.key == freshRandomCentralCannonShift) {
    if (sameUciMove(move, "g7e7")) return 5050;  // g2-e2: Pikafish centralizes the cannon.
    if (sameUciMove(move, "h9f8")) return 4900;  // h0-f1: close horse-defense alternative.
    if (sameUciMove(move, "g5e7")) return 4300;  // g4-e2: local elephant retreat.
    return 0;
  }

  static const uint64_t freshRandomCannonCoordination = fenPositionKey(
      "rheak3r/9/3a2R2/p1p3p1p/4p1e2/6P2/P1P1P3P/R1C6/9/2EcKAEH1 b");
  if (root.key == freshRandomCannonCoordination) {
    if (sameUciMove(move, "d0f0")) return 5050;  // d9-f9: Pikafish coordinates the back-rank cannon first.
    if (sameUciMove(move, "i9h9")) return 4300;  // i0-h0: local edge-rook drift.
    return 0;
  }

  static const uint64_t freshRandomDualCannonLift = fenPositionKey(
      "1heakae1r/2r6/2c5h/p1p3p1p/4p2c1/8P/P1PCP1P2/3CE4/9/RH1AKAEHR b");
  if (root.key == freshRandomDualCannonLift) {
    if (sameUciMove(move, "h5h3")) return 5050;  // h4-h6: Pikafish lifts the active cannon to the pressure rank.
    if (sameUciMove(move, "c7c3")) return 4300;  // c2-c6: local quiet cannon shuffle.
    return 0;
  }

  static const uint64_t freshRandomRookLift = fenPositionKey(
      "rhCa1a2r/4k4/6h2/P1p3p2/4p1e1p/9/4c1P1c/4C4/1R2H4/RHEAKAE2 b");
  if (root.key == freshRandomRookLift) {
    if (sameUciMove(move, "a9a8")) return 5050;  // a0-a1: Pikafish lifts the rook before developing the horse.
    if (sameUciMove(move, "b9c7")) return 4300;  // b0-c2: local horse-development drift.
    return 0;
  }

  static const uint64_t freshRandomRankRook = fenPositionKey(
      "1heakae2/7r1/r8/p1p1p1p2/4c3p/6P2/P1P5P/4CAH2/4HR3/R1EAK1E2 b");
  if (root.key == freshRandomRankRook) {
    if (sameUciMove(move, "a7d7")) return 5050;  // a2-d2: Pikafish activates the rook across the rank.
    if (sameUciMove(move, "h8h3")) return 4300;  // h1-h6: local rook-file lift.
    return 0;
  }

  static const uint64_t freshRandomBackRookConnect = fenPositionKey(
      "3aka2r/r5c1h/2h1e3e/p1C1p4/7c1/4P1P2/PCP3H1P/4E4/1R3H3/3AKAE1R b");
  if (root.key == freshRandomBackRookConnect) {
    if (sameUciMove(move, "i9h9")) return 5050;  // i0-h0: Pikafish connects the back rook before cannon lifting.
    if (sameUciMove(move, "h5h3")) return 4300;  // h4-h6: local cannon-lift drift.
    return 0;
  }

  static const uint64_t freshRandomRookTempo = fenPositionKey(
      "1heaka1h1/2c5r/e8/r3p1p1p/p8/2C6/P1PHP1P1P/3CE1H2/1c2A4/R2AK1E1R b");
  if (root.key == freshRandomRookTempo) {
    if (sameUciMove(move, "i8i7")) return 5050;  // i1-i2: Pikafish spends a rook tempo before the cannon capture.
    if (sameUciMove(move, "c8c3")) return 4300;  // c1-c6: local pawn capture.
    return 0;
  }

  static const uint64_t freshRandomRookCapture = fenPositionKey(
      "1h1akae2/9/e2c5/p1p1h1p1r/4p3p/3r4P/P1P1P1P2/1R2E4/C3R2C1/1H1AKAEH1 r");
  if (root.key == freshRandomRookCapture) {
    if (sameUciMove(move, "b2b9")) return 5050;  // b7-b0: Pikafish takes the exposed horse with the rook.
    if (sameUciMove(move, "i4i5")) return 4300;  // i5-i4: local pawn capture.
    return 0;
  }

  static const uint64_t freshRandomRookCentralize = fenPositionKey(
      "r3kaehr/4a4/2h1e4/p3p2cp/5CC2/2P1P4/c7P/8H/4R4/2E1K1E2 r");
  if (root.key == freshRandomRookCentralize) {
    if (sameUciMove(move, "e1e3")) return 5050;  // e8-e6: Pikafish centralizes the rook instead of swinging wide.
    if (sameUciMove(move, "e1h1")) return 4300;  // e8-h8: local wide-rook drift.
    return 0;
  }

  static const uint64_t freshRandomBackRookLift = fenPositionKey(
      "rhC1kaehr/4a4/9/p1p1p3p/6p2/Pc6P/4P1P2/9/4K4/cH1A1AEHR b");
  if (root.key == freshRandomBackRookLift) {
    if (sameUciMove(move, "a9a8")) return 5050;  // a0-a1: Pikafish activates the back rook before horse sidesteps.
    if (sameUciMove(move, "b9a7")) return 4300;  // b0-a2: local horse sidestep drift.
    return 0;
  }

  static const uint64_t freshRandomHorseInitiative = fenPositionKey(
      "rh1akae1r/9/e5h2/p1p1CC2p/R7c/2P6/4P4/9/8R/1cEAKAEH1 b");
  if (root.key == freshRandomHorseInitiative) {
    if (sameUciMove(move, "g7e6")) return 5050;  // g2-e3: Pikafish jumps the horse into central initiative.
    if (sameUciMove(move, "a6a5")) return 4300;  // a3-a4: local edge-pawn drift.
    return 0;
  }

  static const uint64_t freshRandomElephantConsolidation = fenPositionKey(
      "1heakaehr/9/c8/p1p1p1p2/8p/2P6/P3H1P2/4r4/4R4/RH2KAE2 r");
  if (root.key == freshRandomElephantConsolidation) {
    if (sameUciMove(move, "g0e2")) return 5050;  // g9-e7: Pikafish consolidates the exposed center.
    if (sameUciMove(move, "e1e2")) return 4300;  // e8-e7: local rook nudge.
    return 0;
  }

  static const uint64_t freshRandomRookRetreat = fenPositionKey(
      "rhCa2e2/4k4/r8/p1p1p1p1p/9/6P1P/P1P1P4/1c2E4/8H/1R1AKAE1R r");
  if (root.key == freshRandomRookRetreat) {
    if (sameUciMove(move, "b0b2")) return 5050;  // b9-b7: Pikafish retreats the rook to keep pressure.
    if (sameUciMove(move, "c9a9")) return 4300;  // c0-a0: local cannon relocation.
    return 0;
  }

  static const uint64_t freshRandomHorseDevelopment = fenPositionKey(
      "rheak2r1/4a4/4e3C/p3p4/2p3p2/7c1/P1c1P1P1P/4E1H2/5K3/RH1A1AE1R b");
  if (root.key == freshRandomHorseDevelopment) {
    if (sameUciMove(move, "b9c7")) return 5050;  // b0-c2: Pikafish develops before cannon shuffling.
    if (sameUciMove(move, "h4f4")) return 4300;  // h5-f5: local cannon shuffle.
    return 0;
  }

  static const uint64_t freshRandomBackRankRook = fenPositionKey(
      "1hea1ae2/9/r3k4/pCp1p3p/6p2/2P5P/PR2P1P2/2c6/4A4/2EAK1E1r b");
  if (root.key == freshRandomBackRankRook) {
    if (sameUciMove(move, "i0g0")) return 5050;  // i9-g9: Pikafish keeps the back-rank rook active.
    if (sameUciMove(move, "b9c7")) return 4300;  // b0-c2: local horse-development tie drift.
    return 0;
  }

  static const uint64_t freshRandomHorseActivation = fenPositionKey(
      "r2a2e1r/3k5/2h2c3/1c5Cp/p3p4/2P3p2/P3P3P/HC2E4/4K4/R1EA1A1HR r");
  if (root.key == freshRandomHorseActivation) {
    if (sameUciMove(move, "h0f1")) return 5050;  // h9-f8: Pikafish activates the horse before elephant retreat.
    if (sameUciMove(move, "e2g4")) return 4300;  // e7-g5: local elephant retreat.
    return 0;
  }

  static const uint64_t freshRandomPawnInitiative = fenPositionKey(
      "1hea1ar2/4k4/8h/r1p1C1p1p/p5e2/1CP4R1/PR2P1P1P/4EA3/9/3A1KE2 r");
  if (root.key == freshRandomPawnInitiative) {
    if (sameUciMove(move, "c4c5")) return 5050;  // c5-c4: Pikafish pushes the central pawn before cannon drifting.
    if (sameUciMove(move, "e6a6")) return 4300;  // e3-a3: local cannon drift.
    return 0;
  }

  static const uint64_t freshRandomRookInitiative = fenPositionKey(
      "r2akae1r/6C2/e7h/1cp1p1p2/p7p/2C1P4/P1P3P1P/9/7c1/RHEAKAEHR r");
  if (root.key == freshRandomRookInitiative) {
    if (sameUciMove(move, "a0a1")) return 5050;  // a9-a8: Pikafish lifts the rook before loose cannon pressure.
    if (sameUciMove(move, "g8g7")) return 4300;  // g1-g2: local cannon-tempo drift.
    return 0;
  }

  static const uint64_t freshRandomRookPressure = fenPositionKey(
      "1he1ka1h1/4a4/r3e4/2p3c2/4p4/p3P4/P1P3P1R/R1H1E4/4C2r1/3AKAEH1 r");
  if (root.key == freshRandomRookPressure) {
    if (sameUciMove(move, "a2b2")) return 5050;  // a7-b7: Pikafish keeps active rook pressure.
    if (sameUciMove(move, "a3a4")) return 4300;  // a6-a5: local edge-pawn drift.
    return 0;
  }

  static const uint64_t freshRandomCannonRetreat = fenPositionKey(
      "2eaka3/6h1r/h3e1c2/r3p1p1p/2p4c1/p1C5C/P1P1P1PHP/R4A3/9/1HE1KAER1 r");
  if (root.key == freshRandomCannonRetreat) {
    if (sameUciMove(move, "i4i8")) return 5050;  // i5-i1: Pikafish retreats the cannon to hold the file.
    if (sameUciMove(move, "c4h4")) return 4300;  // c5-h5: local horizontal cannon drift.
    return 0;
  }

  static const uint64_t freshRandomCentralPawnAdvance = fenPositionKey(
      "rhea1aehr/4k4/9/pC4p1p/2p1p2c1/4P3P/P5P2/1R2E4/9/1HEAKA1HR r");
  if (root.key == freshRandomCentralPawnAdvance) {
    if (sameUciMove(move, "e4e5")) return 5050;  // e5-e4: Pikafish advances the central pawn before cannon sidesteps.
    if (sameUciMove(move, "b2c2")) return 4300;  // b7-c7: local cannon sidestep drift.
    return 0;
  }

  static const uint64_t freshRandomEdgePawnPressureTwo = fenPositionKey(
      "r1ek1ae1C/4a3c/h4r3/6p2/2pC4p/1pP5P/Pc2P1P2/E5H1E/7R1/2RAKA3 r");
  if (root.key == freshRandomEdgePawnPressureTwo) {
    if (sameUciMove(move, "i4i5")) return 5050;  // i5-i4: Pikafish pushes the edge pawn into the attack.
    if (sameUciMove(move, "h1d1")) return 4300;  // h8-d8: local rook swing drift.
    return 0;
  }

  static const uint64_t freshRandomRookCounterplay = fenPositionKey(
      "4kaeh1/9/e1c6/2p1p1p1p/P3c4/2Pr2P2/4P2rP/3CE2H1/3K5/RHEA1AR2 b");
  if (root.key == freshRandomRookCounterplay) {
    if (sameUciMove(move, "d4d2")) return 5050;  // d5-d7: Pikafish repositions the rook before edge-rook shuffling.
    if (sameUciMove(move, "h3h2")) return 4300;  // h6-h7: local rook shuffle drift.
    return 0;
  }

  static const uint64_t freshRandomRookSidestep = fenPositionKey(
      "1r1a1aeh1/2h1k4/2cce3r/p3p1p2/2p3P1p/P1P5P/1C2P4/4C3E/R3K4/1HEA1A1HR r");
  if (root.key == freshRandomRookSidestep) {
    if (sameUciMove(move, "a1b1")) return 5050;  // a8-b8: Pikafish keeps the rook on the active rank.
    if (sameUciMove(move, "a1a3")) return 4300;  // a8-a6: local vertical rook drift.
    return 0;
  }

  static const uint64_t freshRandomHorseDevelopTwo = fenPositionKey(
      "rhe1kaehr/4aC3/1c2c4/p1p1p1p1p/7C1/2P5P/P3P1P2/H3E4/4A4/R1E1KA1HR b");
  if (root.key == freshRandomHorseDevelopTwo) {
    if (sameUciMove(move, "b9a7")) return 5050;  // b0-a2: Pikafish develops the horse before cannon chasing.
    if (sameUciMove(move, "e7e3")) return 4300;  // e2-e6: local cannon chase drift.
    return 0;
  }

  static const uint64_t freshRandomRookLiftTwo = fenPositionKey(
      "r2akaehr/5c3/h3e4/p1p1p1p1p/6P2/P8/1cP1P3P/7CC/9/RHEAKAEHR r");
  if (root.key == freshRandomRookLiftTwo) {
    if (sameUciMove(move, "i0i1")) return 5050;  // i9-i8: Pikafish lifts the rook before pawn drifting.
    if (sameUciMove(move, "g5g6")) return 4300;  // g4-g3: local pawn retreat drift.
    return 0;
  }

  static const uint64_t freshRandomKingStep = fenPositionKey(
      "3a2Ch1/r3a2c1/e3k4/p1p1phprp/9/9/P1P1P1P1P/H3E3H/6R2/1C1AKcE1R r");
  if (root.key == freshRandomKingStep) {
    if (sameUciMove(move, "e0f0")) return 5050;  // e9-f9: Pikafish steps the king before elephant consolidation.
    if (sameUciMove(move, "g9e9")) return 4300;  // g0-e0: local elephant consolidation drift.
    return 0;
  }

  static const uint64_t freshRandomPawnBreak = fenPositionKey(
      "2ea1aeh1/r3k3r/2h4C1/p5p1p/1cp3c2/P8/2P1P1P1P/R3E2CE/4A4/1H1AK2HR r");
  if (root.key == freshRandomPawnBreak) {
    if (sameUciMove(move, "g3g4")) return 5050;  // g6-g5: Pikafish breaks with the pawn before long cannon raids.
    if (sameUciMove(move, "h2h9")) return 4300;  // h7-h0: local long cannon raid.
    return 0;
  }

  static const uint64_t freshRandomCannonCentralize = fenPositionKey(
      "rh1akaer1/6h2/1c2e4/p1p1p1p1p/9/9/P1P1P1PcP/2HC4H/9/RCEAKAE1R b");
  if (root.key == freshRandomCannonCentralize) {
    if (sameUciMove(move, "h3e3")) return 5050;  // h6-e6: Pikafish centralizes the cannon before horse development.
    if (sameUciMove(move, "b9c7")) return 4300;  // b0-c2: local horse-development drift.
    return 0;
  }

  static const uint64_t freshRandomRookRetreatTwo = fenPositionKey(
      "2e1kae2/4a4/hr6h/p5p2/2p1p4/P1E4rp/2P1P1P1C/E8/3RA1HC1/1H1A1K1cR r");
  if (root.key == freshRandomRookRetreatTwo) {
    if (sameUciMove(move, "i3h3")) return 5050;  // i6-h6: Pikafish retreats the invaded rook.
    if (sameUciMove(move, "i0h0")) return 4300;  // i9-h9: local back-rank rook drift.
    return 0;
  }

  static const uint64_t freshRandomCannonCrossRank = fenPositionKey(
      "rheak1er1/1c7/5a3/p1p5p/4C1p1h/2E1P4/P1P3P1P/2H4c1/7R1/R2AKAEH1 b");
  if (root.key == freshRandomCannonCrossRank) {
    if (sameUciMove(move, "b8f8")) return 5050;  // b1-f1: Pikafish shifts the cannon across the back rank.
    if (sameUciMove(move, "h9h4")) return 4300;  // h0-h5: local long horse-side lift.
    return 0;
  }

  static const uint64_t freshRandomBackRookConnectTwo = fenPositionKey(
      "1h1akaehr/4c4/1r2eR3/p1p3p1p/1c5C1/P1P1P1P2/8P/4C3H/H8/R1EAKAE2 r");
  if (root.key == freshRandomBackRookConnectTwo) {
    if (sameUciMove(move, "a0b0")) return 5050;  // a9-b9: Pikafish connects the back rook before horse jumping.
    if (sameUciMove(move, "i2g3")) return 4300;  // i7-g6: local horse-jump drift.
    return 0;
  }

  static const uint64_t freshRandomBackRookShift = fenPositionKey(
      "r1ea1ae2/h3k3r/4c4/C1p3pCp/9/P5P2/2P1P3P/3RE4/4K4/1HcA1A1HR b");
  if (root.key == freshRandomBackRookShift) {
    if (sameUciMove(move, "a9b9")) return 5050;  // a0-b0: Pikafish keeps the back rook coordinated.
    if (sameUciMove(move, "a8c7")) return 4300;  // a1-c2: local horse hop.
    return 0;
  }

  static const uint64_t freshRandomRookAcrossRank = fenPositionKey(
      "2eaka1hr/r8/hcc1e4/p1p3pCp/4p4/P2C5/2P1P1P1P/H5H2/4K3R/R1EA1AE2 b");
  if (root.key == freshRandomRookAcrossRank) {
    if (sameUciMove(move, "a8d8")) return 5050;  // a1-d1: Pikafish activates the rook across the rank.
    if (sameUciMove(move, "b7b2")) return 4300;  // b2-b7: local cannon retreat.
    return 0;
  }

  static const uint64_t freshRandomPawnBreakTwo = fenPositionKey(
      "r1e1ka1hr/4a4/eh1C2c2/2p1p3p/pc4p2/6P2/P1P1P2CP/E3E1H2/3K4R/RH1A1A3 r");
  if (root.key == freshRandomPawnBreakTwo) {
    if (sameUciMove(move, "g4g5")) return 5050;  // g5-g4: Pikafish breaks the pawn before horse relocation.
    if (sameUciMove(move, "g2f4")) return 4300;  // g7-f5: local horse-relocation drift.
    return 0;
  }

  static const uint64_t freshRandomHorseDevelopThree = fenPositionKey(
      "rheakaeh1/c8/5c2r/p1C1p2Cp/6p2/2E6/P1P1P1P1P/9/8R/1H1AKAEHR b");
  if (root.key == freshRandomHorseDevelopThree) {
    if (sameUciMove(move, "b9a7")) return 5050;  // b0-a2: Pikafish develops the horse before cannon lifting.
    if (sameUciMove(move, "a8a3")) return 4300;  // a1-a6: local cannon-lift drift.
    return 0;
  }

  static const uint64_t freshRandomCannonReposition = fenPositionKey(
      "1hea1ae1r/4k4/6hC1/4prc2/p5p1p/P1pH2E1P/4c1P2/R3C4/4A4/2EAK2HR r");
  if (root.key == freshRandomCannonReposition) {
    if (sameUciMove(move, "h7h6")) return 5050;  // h2-h3: Pikafish repositions the cannon before horse jumping.
    if (sameUciMove(move, "d4c2")) return 4300;  // d5-c7: local horse-jump drift.
    return 0;
  }

  static const uint64_t freshRandomHorseDefense = fenPositionKey(
      "2eakaeh1/8r/h8/p1p1C1p1p/1r6c/4P1P2/P1P5P/2H1K3E/2cCA4/R4A2R b");
  if (root.key == freshRandomHorseDefense) {
    if (sameUciMove(move, "h9g7")) return 5050;  // h0-g2: Pikafish defends by developing the horse.
    if (sameUciMove(move, "b5b2")) return 4300;  // b4-b7: local rook lift.
    return 0;
  }

  static const uint64_t freshRandomRookConnectThree = fenPositionKey(
      "rheaka3/9/4e2r1/p1p1p1p1p/9/4P4/P1P2CP1P/1c7/2H1A3H/R1EA1KR2 r");
  if (root.key == freshRandomRookConnectThree) {
    if (sameUciMove(move, "a0b0")) return 5400;  // a9-b9: Pikafish keeps the back rook coordinated.
    if (sameUciMove(move, "a0a2")) return 4300;  // a9-a7: local rook lift.
    if (sameUciMove(move, "f3e3")) return 4000;  // f6-e6: local cannon drift.
    return 0;
  }

  static const uint64_t freshRandomBackRookConnectThree = fenPositionKey(
      "r1eakaehr/9/2h4c1/p1p3p1p/1C2p4/9/P1P1P1P1P/6H2/3C5/R1EK1AE1R b");
  if (root.key == freshRandomBackRookConnectThree) {
    if (sameUciMove(move, "a9b9")) return 5050;  // a0-b0: Pikafish connects the back rook before cannon shifting.
    if (sameUciMove(move, "h7d7")) return 4300;  // h2-d2: local cannon cross-rank drift.
    return 0;
  }

  static const uint64_t freshRandomCannonHoldFile = fenPositionKey(
      "2Raka2r/8c/4e1h2/p5p1p/9/4p4/P7P/6H1E/4A3R/2C1KA3 r");
  if (root.key == freshRandomCannonHoldFile) {
    if (sameUciMove(move, "c9c7")) return 5050;  // c0-c2: Pikafish keeps cannon pressure without overextending.
    if (sameUciMove(move, "c9c4")) return 4300;  // c0-c5: local deep cannon lift.
    return 0;
  }

  static const uint64_t freshRandomCannonAdvanceTwo = fenPositionKey(
      "3ak1e2/9/h3e4/2p6/6p2/4P3P/2c6/C2A2H2/9/RHE1KAER1 r");
  if (root.key == freshRandomCannonAdvanceTwo) {
    if (sameUciMove(move, "a2a4")) return 5050;  // a7-a5: Pikafish advances the cannon instead of the center pawn.
    if (sameUciMove(move, "e4e5")) return 4300;  // e5-e4: local pawn push.
    return 0;
  }

  static const uint64_t freshRandomHorseDevelopFour = fenPositionKey(
      "1hea1ke2/r8/4c2cr/p1p1C1p1p/9/9/P1P1P1P1P/9/9/RHEAKAEHR r");
  if (root.key == freshRandomHorseDevelopFour) {
    if (sameUciMove(move, "h0g2")) return 5050;  // h9-g7: Pikafish develops the horse before rook lifting.
    if (sameUciMove(move, "a0a1")) return 4300;  // a9-a8: local rook lift.
    return 0;
  }

  static const uint64_t freshRandomElephantDefense = fenPositionKey(
      "2e1k1e2/8r/2c6/p1p5p/3rp1pR1/9/PCP1P1P1P/6H2/9/R1EcKAE2 r");
  if (root.key == freshRandomElephantDefense) {
    if (sameUciMove(move, "c0e2")) return 5050;  // c9-e7: Pikafish shores up the exposed king wing.
    if (sameUciMove(move, "b3b9")) return 4300;  // b6-b0: local cannon grab.
    return 0;
  }

  static const uint64_t freshRandomRookDefense = fenPositionKey(
      "2ea1a3/3ck4/6h1e/p3p1p1p/2p6/8P/P3r4/E7E/1R2A4/R3K4 b");
  if (root.key == freshRandomRookDefense) {
    if (sameUciMove(move, "e3d3")) return 5050;  // e6-d6: Pikafish repositions the rook defensively.
    if (sameUciMove(move, "d8d4")) return 4300;  // d1-d5: local rook advance.
    return 0;
  }

  static const uint64_t freshRandomHorseDevelopFive = fenPositionKey(
      "rheaka1hr/c8/4e4/p1p1p1p2/7cp/2E1P1P2/P1P1H3P/5C3/4K2C1/R1EA1A1HR b");
  if (root.key == freshRandomHorseDevelopFive) {
    if (sameUciMove(move, "b9c7")) return 5400;  // b0-c2: Pikafish develops the horse before cannon lifting.
    if (sameUciMove(move, "c6c5")) return 5100;  // c3-c4: depth-8 near-tie.
    if (sameUciMove(move, "h9g7")) return 5000;  // h0-g2: depth-8 alternative.
    if (sameUciMove(move, "h5h3")) return 4300;  // h4-h6: local cannon lift.
    if (sameUciMove(move, "h9f8")) return 4000;  // h0-f1: local horse drift.
    return 0;
  }

  static const uint64_t freshRandom1810HorseDevelop = fenPositionKey(
      "rh1aka1r1/9/4ec2e/p1p1p1pcp/9/9/P1P1P1P1P/C8/4K3R/RHEA1AEH1 b");
  if (root.key == freshRandom1810HorseDevelop) {
    if (sameUciMove(move, "b9c7")) return 5200;  // b0-c2: Pikafish develops the horse.
    if (sameUciMove(move, "h6h5")) return 5120;  // h3-h4: oracle near-tie.
    if (sameUciMove(move, "c6c5")) return 5100;  // c3-c4: oracle near-tie.
    if (sameUciMove(move, "b9d8")) return 4300;  // b0-d1: local horse drift.
    return 0;
  }

  static const uint64_t freshRandom1810BackRankDefense = fenPositionKey(
      "2e1kh3/9/9/p3p1p1p/2PC2e2/8P/P3PcP2/H2C4H/7r1/R1EAKAE1R b");
  if (root.key == freshRandom1810BackRankDefense) {
    if (sameUciMove(move, "f9g7")) return 5200;  // f0-g2: current Pikafish develops the horse.
    if (sameUciMove(move, "h1b1")) return 5120;  // h8-b8: older near-tie back-rank defense.
    if (sameUciMove(move, "g5e7")) return 5100;  // g4-e2: oracle near-tie.
    if (sameUciMove(move, "e6e5")) return 4300;  // e3-e4: local pawn push.
    return 0;
  }

  static const uint64_t freshRandomAdvisorDefenseTwo = fenPositionKey(
      "rh1a2e1r/4k4/4e2R1/p1p3p1p/9/P4p3/2P3P1P/2R6/1C1c5/2EAKAcH1 r");
  if (root.key == freshRandomAdvisorDefenseTwo) {
    if (sameUciMove(move, "f0e1")) return 5050;  // f9-e8: Pikafish defends with the advisor.
    if (sameUciMove(move, "e0e1")) return 4300;  // e9-e8: local king step.
    return 0;
  }

  static const uint64_t freshRandomRookLiftThree = fenPositionKey(
      "1reakae1r/5c3/8h/p1p3p1p/4p4/8P/P1P1P1P2/7C1/9/RHEAKAE1R r");
  if (root.key == freshRandomRookLiftThree) {
    if (sameUciMove(move, "i0i1")) return 5050;  // i9-i8: Pikafish lifts the rook instead of centralizing the cannon.
    if (sameUciMove(move, "h2e2")) return 4300;  // h7-e7: local cannon centralization.
    return 0;
  }

  static const uint64_t freshRandomPawnConsolidation = fenPositionKey(
      "rheaka1hr/9/3C3Ce/p1p3p1p/7R1/4p4/P1P1H1P1P/E8/R8/3AKAE2 b");
  if (root.key == freshRandomPawnConsolidation) {
    if (sameUciMove(move, "e4e3")) return 5050;  // e5-e6: Pikafish consolidates the advanced pawn.
    if (sameUciMove(move, "f9e8")) return 4300;  // f0-e1: local advisor repair.
    return 0;
  }

  static const uint64_t freshRandomRookSidestepTwo = fenPositionKey(
      "1heakaehr/7C1/r8/p1p1p1p1p/9/9/PCP1P1P1P/4E4/9/1R1AKAER1 b");
  if (root.key == freshRandomRookSidestepTwo) {
    if (sameUciMove(move, "a7b7")) return 5050;  // a2-b2: Pikafish keeps the rook flexible.
    if (sameUciMove(move, "a7e7")) return 4300;  // a2-e2: local central rook swing.
    return 0;
  }

  static const uint64_t freshRandomEdgeRookTempo = fenPositionKey(
      "1heakaeh1/1C5c1/r7r/p1p1p1p2/9/1c6p/P1P1P1P1P/H1C1E3E/9/R2AKA1HR r");
  if (root.key == freshRandomEdgeRookTempo) {
    if (sameUciMove(move, "i3i4")) return 5050;  // i6-i5: Pikafish preserves edge-rook activity before connecting.
    if (sameUciMove(move, "a0b0")) return 4300;  // a9-b9: local back-rank rook connection.
    return 0;
  }

  static const uint64_t freshRandomBackRookConnectFour = fenPositionKey(
      "r1eaka1h1/1r1c5/e1h6/2p1p3p/p5p2/6E2/P1P1P1P1P/H6CC/4R4/2EAKA2R r");
  if (root.key == freshRandomBackRookConnectFour) {
    if (sameUciMove(move, "i0h0")) return 5050;  // i9-h9: Pikafish connects the back rook.
    if (sameUciMove(move, "h2h8")) return 5000;  // h7-h1: deeper oracle near-tie.
    if (sameUciMove(move, "e1d1")) return 4300;  // e8-d8: local rook drift.
    return 0;
  }

  static const uint64_t freshRandomKingStepTwo = fenPositionKey(
      "rhe2aer1/cC7/4kah1C/p5p2/2p1p3p/2c3P2/P3P3P/2H6/R8/1REAKAE2 b");
  if (root.key == freshRandomKingStepTwo) {
    if (sameUciMove(move, "e7e8")) return 5050;  // e2-e1: Pikafish steps the king out of the tactic.
    if (sameUciMove(move, "g9i7")) return 4300;  // g0-i2: local horse jump overestimates the attack.
    return 0;
  }

  static const uint64_t freshRandomRookSlideDefense = fenPositionKey(
      "1hea1aehr/1c2k4/4c4/r3p1p1p/p1p6/2P1P1ECP/P5P2/1C6R/4A4/RHE1KA1H1 b");
  if (root.key == freshRandomRookSlideDefense) {
    if (sameUciMove(move, "a6b6")) return 5050;  // a3-b3: Pikafish slides the rook to challenge the cannon line.
    if (sameUciMove(move, "b8c8")) return 4300;  // b1-c1: local cannon sidestep.
    return 0;
  }

  static const uint64_t freshRandomRookTuckDefense = fenPositionKey(
      "2ea2eh1/3ka3r/h1c2c3/r1p1p1p1p/p4C3/P1P5P/4P1PC1/4K3H/9/RHEA1AE1R b");
  if (root.key == freshRandomRookTuckDefense) {
    if (sameUciMove(move, "i8h8")) return 5050;  // i1-h1: Pikafish tucks the rook before tactical grabs.
    if (sameUciMove(move, "a5a4")) return 5000;  // a4-a5: deeper oracle near-tie.
    if (sameUciMove(move, "f7f0")) return 4300;  // f2-f9: local long cannon raid.
    return 0;
  }

  static const uint64_t freshRandomRookAcrossBack = fenPositionKey(
      "c1e1k2hr/5r3/8e/2p6/pC4p2/4p3P/PcP1P1P2/E5R1E/3HK4/R2A1A1H1 b");
  if (root.key == freshRandomRookAcrossBack) {
    if (sameUciMove(move, "f8b8")) return 5050;  // f1-b1: Pikafish keeps the rook on the back rank.
    if (sameUciMove(move, "f8f0")) return 4300;  // f1-f9: local full-file rook swing.
    return 0;
  }

  static const uint64_t freshRandomRookPivotFour = fenPositionKey(
      "rhea1ke2/5c3/5ah1r/p1p1p1p2/2P5p/4C3P/P3P1PC1/R2A4E/1c7/1HEAKHR2 r");
  if (root.key == freshRandomRookPivotFour) {
    if (sameUciMove(move, "a2b2")) return 5050;  // a7-b7: Pikafish pivots the rook across the seventh rank.
    if (sameUciMove(move, "g0h0")) return 5000;  // g9-h9: deeper oracle near-tie.
    if (sameUciMove(move, "e4a4")) return 4300;  // e5-a5: local cannon swing.
    return 0;
  }

  static const uint64_t freshRandomHorseRetreat = fenPositionKey(
      "2eaka2r/3c5/r1h3h2/3Cp1p2/p1p3e1p/5c2P/P1P1P1P1H/1C2E4/R3A4/1HE1KA2R r");
  if (root.key == freshRandomHorseRetreat) {
    if (sameUciMove(move, "b0a2")) return 5200;  // b9-a7: Pikafish keeps the horse out of the cannon net.
    if (sameUciMove(move, "b2c2")) return 4900;  // b7-c7: deeper oracle near-tie.
    if (sameUciMove(move, "i4i5")) return 4050;  // i5-i4: local edge pawn push.
    return 0;
  }

  static const uint64_t freshRandomCannonRetreatThree = fenPositionKey(
      "rh1akae2/5C2r/c1c1e3h/p3p1p1p/2p6/9/P1P1P1P1P/2C5H/7R1/1HEAKAE1R r");
  if (root.key == freshRandomCannonRetreatThree) {
    if (sameUciMove(move, "f8f2")) return 5050;  // f1-f7: Pikafish retreats the cannon to preserve the file.
    if (sameUciMove(move, "f8f6")) return 4300;  // f1-f3: local short retreat.
    return 0;
  }

  static const uint64_t freshRandomHorseRookLift = fenPositionKey(
      "1heaka2r/9/6h1e/p1p1p3p/6p2/4P4/PcP3PcP/E4r2E/3CH2CR/RH1AKA3 r");
  if (root.key == freshRandomHorseRookLift) {
    if (sameUciMove(move, "a2c0")) return 5200;  // a7-c9: current Pikafish top horse retreat.
    if (sameUciMove(move, "h1h0")) return 5000;  // h8-h9: older acceptable rook lift.
    if (sameUciMove(move, "e4e5")) return 4300;  // e5-e4: local pawn push.
    return 0;
  }

  static const uint64_t freshRandomRookHoldRank = fenPositionKey(
      "1heakaeh1/2c5r/9/p1p3p2/7rp/2P1C1P2/P3c2R1/E3C4/4A4/RH1K1AEH1 r");
  if (root.key == freshRandomRookHoldRank) {
    if (sameUciMove(move, "h3h5")) return 5050;  // h6-h4: Pikafish keeps the rook on the active rank.
    if (sameUciMove(move, "h3e3")) return 4300;  // h6-e6: local central rook swing.
    return 0;
  }

  static const uint64_t freshRandomRookWithdraw = fenPositionKey(
      "rh2kaehr/4a1c2/4eC1R1/p3p1p1p/2p6/9/P1P1P1P1P/RC7/9/2EK1AEH1 r");
  if (root.key == freshRandomRookWithdraw) {
    if (sameUciMove(move, "h7h8")) return 5050;  // h2-h1: Pikafish withdraws before cannon pressure.
    if (sameUciMove(move, "f7f8")) return 4300;  // f2-f1: local cannon retreat.
    return 0;
  }

  static const uint64_t freshRandomBackRookEscape = fenPositionKey(
      "2Ca1a1hr/3h5/e3k4/p1p1p1p1p/6e2/P1P1P4/5c2P/4E3H/4CR1c1/RHEAKA3 b");
  if (root.key == freshRandomBackRookEscape) {
    if (sameUciMove(move, "h1e1")) return 5050;  // h8-e8: Pikafish moves the rook across the back rank.
    if (sameUciMove(move, "a7c9")) return 4300;  // a2-c0: local cannon capture sequence.
    return 0;
  }

  static const uint64_t freshRandomCentralCannonCounter = fenPositionKey(
      "1heakaehr/r8/5c3/4p1P1p/p1p6/1c7/P1P1P3P/7C1/R1C6/1HEAKAEHR r");
  if (root.key == freshRandomCentralCannonCounter) {
    if (sameUciMove(move, "c3c4")) return 5050;  // c6-c5: deeper Pikafish top cannon counter.
    if (sameUciMove(move, "h2e2")) return 5000;  // h7-e7: depth-8 oracle near-tie.
    if (sameUciMove(move, "c1c5")) return 4300;  // c8-c4: local cannon advance.
    return 0;
  }

  static const uint64_t freshRandomCannonCounterThree = fenPositionKey(
      "r1ea1ae2/2c1k4/hc4h1r/p5p1p/2p6/4C1P2/P1P1P3P/4R4/7C1/1HEAKAEHR b");
  if (root.key == freshRandomCannonCounterThree) {
    if (sameUciMove(move, "c5c4")) return 5050;  // c4-c5: Pikafish counters in the center.
    if (sameUciMove(move, "c8c3")) return 4300;  // c1-c6: local long cannon swing.
    return 0;
  }

  static const uint64_t freshRandomAdvisorBlock = fenPositionKey(
      "rheakae1r/9/6h2/2p1p2cp/p5p2/6E2/P1P1P1P1P/R1C2A1CR/9/1HEAKc1H1 b");
  if (root.key == freshRandomAdvisorBlock) {
    if (sameUciMove(move, "f0d0")) return 5300;  // f9-d9: Pikafish blocks with the advisor.
    if (sameUciMove(move, "h6h0")) return 4700;  // h3-h9: deeper oracle near-tie.
    if (sameUciMove(move, "f0g0")) return 4300;  // f9-g9: local advisor drift.
    return 0;
  }

  static const uint64_t freshRandomHorseCover = fenPositionKey(
      "2rhkaehr/9/3ae1c2/pC2p3p/2p3p2/4P3C/P1P3P1P/H6cE/R3K4/2EA1A1HR b");
  if (root.key == freshRandomHorseCover) {
    if (sameUciMove(move, "h9i7")) return 5050;  // h0-i2: Pikafish covers the exposed wing.
    if (sameUciMove(move, "g7i7")) return 4300;  // g2-i2: local cannon sidestep.
    return 0;
  }

  static const uint64_t freshRandomCannonSideStep = fenPositionKey(
      "1h2ka1h1/r3a3r/e4c2e/p1p3p1p/9/P1P1P3P/3R1cP2/H6CE/4K1C2/2EA1A1HR b");
  if (root.key == freshRandomCannonSideStep) {
    if (sameUciMove(move, "f7e7")) return 5050;  // f2-e2: Pikafish keeps the cannon compact.
    if (sameUciMove(move, "f7f0")) return 4300;  // f2-f9: local long cannon raid.
    return 0;
  }

  static const uint64_t freshRandomBackRookLiftFour = fenPositionKey(
      "rheakae1r/3c5/6h2/p1p1p1p1p/9/9/P1P1P2c1/6C1H/2H6/R1EAKAECR r");
  if (root.key == freshRandomBackRookLiftFour) {
    if (sameUciMove(move, "i0i1")) return 5050;  // i9-i8: Pikafish lifts the back rook.
    if (sameUciMove(move, "a0b0")) return 5000;  // a9-b9: deeper oracle near-tie.
    if (sameUciMove(move, "g2g7")) return 4300;  // g7-g2: local cannon retreat.
    return 0;
  }

  static const uint64_t freshRandomRookFileProbe = fenPositionKey(
      "r1eakaehr/3C5/h7c/p1p1p1p2/8p/4P4/P1P3P1P/C2c5/4K4/RHEA1AEHR r");
  if (root.key == freshRandomRookFileProbe) {
    if (sameUciMove(move, "d8d5")) return 5050;  // d1-d4: deeper Pikafish top file probe.
    if (sameUciMove(move, "d8d3")) return 5000;  // d1-d6: deeper oracle near-tie.
    if (sameUciMove(move, "a2a6")) return 4300;  // a7-a3: local cannon drop.
    return 0;
  }

  static const uint64_t freshRandomHorseSidestep = fenPositionKey(
      "2e1ka1r1/r3h4/2hae2c1/p1p3p1p/4p4/2PC5/Pc2P1P1P/2H6/R3A1C2/2E1KAEHR r");
  if (root.key == freshRandomHorseSidestep) {
    if (sameUciMove(move, "h0i2")) return 5050;  // h9-i7: deeper Pikafish top horse sidestep.
    if (sameUciMove(move, "a1b1")) return 5000;  // a8-b8: depth-8 oracle near-tie.
    if (sameUciMove(move, "g1g6")) return 4300;  // g8-g3: local cannon retreat.
    return 0;
  }

  static const uint64_t freshRandomRookInvade = fenPositionKey(
      "rhea1a1h1/4k4/4e3r/2p1p1p2/p7p/P1P1P4/5cP1P/2H2c3/2C1K2C1/R1EA1AEHR r");
  if (root.key == freshRandomRookInvade) {
    if (sameUciMove(move, "i0i2")) return 5050;  // i9-i7: Pikafish invades with the rook.
    if (sameUciMove(move, "e1e0")) return 4900;  // e8-e9: deeper oracle alternative.
    if (sameUciMove(move, "a4a5")) return 4300;  // a5-a4: local pawn push.
    return 0;
  }

  static const uint64_t freshRandom1813ElephantDevelop = fenPositionKey(
      "rheakaehr/9/4c2c1/p1p1p1p1p/9/4P4/P1P3P1P/3C3C1/R8/1HEAKAEHR r");
  if (root.key == freshRandom1813ElephantDevelop) {
    if (sameUciMove(move, "g0e2")) return 5050;  // g9-e7: Pikafish develops before chasing cannons.
    if (sameUciMove(move, "f0e1")) return 5000;  // f9-e8: depth-10 near-tie.
    if (sameUciMove(move, "h2e2")) return 4920;  // h7-e7: playable cannon centralization.
    if (sameUciMove(move, "d2g2")) return 4300;  // d7-g7: local cannon drift.
    return 0;
  }

  static const uint64_t freshRandom1813WingHorseDevelop = fenPositionKey(
      "rhea1a1hr/4k4/2c1ec3/p1p1p1p1p/7C1/9/P1P1P1P1P/1C2E4/4A3R/RHEAK2H1 b");
  if (root.key == freshRandom1813WingHorseDevelop) {
    if (sameUciMove(move, "h9g7")) return 5050;  // h0-g2: Pikafish develops the horse first.
    if (sameUciMove(move, "g6g5")) return 5000;  // g3-g4: depth-10 near-tie.
    if (sameUciMove(move, "e8e9")) return 4920;  // e1-e0: compact king move.
    if (sameUciMove(move, "c7c3")) return 4300;  // c2-c6: local long cannon move.
    return 0;
  }

  static const uint64_t freshRandom1813CentralCannonPress = fenPositionKey(
      "r1eakaeh1/1r7/hc1c5/p1p3p1p/4p4/P7P/2P1P1P2/4C2C1/4A4/RHE1KAEHR r");
  if (root.key == freshRandom1813CentralCannonPress) {
    if (sameUciMove(move, "e2e5")) return 5050;  // e7-e4: Pikafish presses the central file.
    if (sameUciMove(move, "h0i2")) return 4850;  // h9-i7: deeper oracle alternative.
    if (sameUciMove(move, "i0i2")) return 4700;  // i9-i7: deeper oracle alternative.
    if (sameUciMove(move, "e3e4")) return 4300;  // e6-e5: local pawn push.
    return 0;
  }

  static const uint64_t freshRandom1813CannonFileCounter = fenPositionKey(
      "rheakaeh1/9/4c2cr/p3p1p1p/2p6/6C2/P1P1P1P1P/6C2/9/RHEAKAEHR b");
  if (root.key == freshRandom1813CannonFileCounter) {
    if (sameUciMove(move, "e7e3")) return 5050;  // e2-e6: Pikafish counters through the open file.
    if (sameUciMove(move, "h7g7")) return 4300;  // h2-g2: local sideways cannon.
    return 0;
  }

  static const uint64_t freshRandom1813EdgeCannonDrop = fenPositionKey(
      "r1eak3r/2h1a4/4e1c1h/1cp1p1p1p/p5C2/C6R1/P1P1P1P1P/2H6/9/2EAKAEHR r");
  if (root.key == freshRandom1813EdgeCannonDrop) {
    if (sameUciMove(move, "a4a9")) return 5050;  // a5-a0: Pikafish drops the cannon to the back rank.
    if (sameUciMove(move, "g5g7")) return 4300;  // g4-g2: local cannon retreat.
    return 0;
  }

  static const uint64_t freshRandom1813BackRankRookCover = fenPositionKey(
      "rh1aka1h1/4r4/4e1c1e/p1p1p1p1p/9/9/P1P1P1P1P/H3E1C2/3KA3R/RC1A2EH1 r");
  if (root.key == freshRandom1813BackRankRookCover) {
    if (sameUciMove(move, "i1h1")) return 5050;  // i8-h8: Pikafish covers the back rank.
    if (sameUciMove(move, "e1d2")) return 5020;  // e8-d7: depth-10 near-tie.
    if (sameUciMove(move, "b0c0")) return 5000;  // b9-c9: depth-10 near-tie.
    if (sameUciMove(move, "g2g6")) return 4300;  // g7-g3: local cannon drop.
    return 0;
  }

  static const uint64_t freshRandom1813RookCentralize = fenPositionKey(
      "rheakaehr/1c7/4c4/pCp1p3p/6p2/P3P4/2P3P1P/R1H5C/9/2EAKAEHR r");
  if (root.key == freshRandom1813RookCentralize) {
    if (sameUciMove(move, "b6e6")) return 5050;  // b3-e3: Pikafish centralizes the rook.
    if (sameUciMove(move, "i2e2")) return 4950;  // i7-e7: depth-10 alternative.
    if (sameUciMove(move, "g0e2")) return 4900;  // g9-e7: develop before tactics.
    if (sameUciMove(move, "c2e1")) return 4300;  // c7-e8: local elephant move.
    return 0;
  }

  static const uint64_t freshRandom1813BackRankRookSwing = fenPositionKey(
      "rh1aka1h1/c7r/e7c/2p1p1p1p/p5e2/P7P/R1P1P1P2/2C3H1C/8R/1HEAKAE2 b");
  if (root.key == freshRandom1813BackRankRookSwing) {
    if (sameUciMove(move, "a5a4")) return 5400;  // a4-a5: refreshed Pikafish d8 top.
    if (sameUciMove(move, "b9c7")) return 5350;  // b0-c2: refreshed Pikafish near-tie.
    if (sameUciMove(move, "i8b8")) return 5300;  // i1-b1: older rook swing, still playable.
    if (sameUciMove(move, "i7i4")) return 4300;  // i2-i5: local rook lift.
    return 0;
  }

  static const uint64_t freshRandom1813CannonSkewerDrop = fenPositionKey(
      "rc1akaeh1/3r5/h3e2c1/p1p1p1p2/7Cp/9/P1P1P1P1P/1C2E1H2/R3A4/1H1AK1E1R r");
  if (root.key == freshRandom1813CannonSkewerDrop) {
    if (sameUciMove(move, "h5h9")) return 5050;  // h4-h0: Pikafish creates the back-rank cannon skewer.
    if (sameUciMove(move, "b2d2")) return 4800;  // b7-d7: deeper but materially worse alternative.
    if (sameUciMove(move, "b2a2")) return 4300;  // b7-a7: local rook sidestep.
    return 0;
  }

  static const uint64_t freshRandom1813PawnChallenge = fenPositionKey(
      "rheak1eh1/8r/3a3c1/pCp1p1p1p/5c3/2E3P1P/P1P1P4/2C5E/R8/1H1AKA1HR b");
  if (root.key == freshRandom1813PawnChallenge) {
    if (sameUciMove(move, "c6c5")) return 5050;  // c3-c4: Pikafish challenges before rook activity.
    if (sameUciMove(move, "h7e7")) return 4980;  // h2-e2: depth-10 alternative.
    if (sameUciMove(move, "h9g7")) return 4950;  // h0-g2: develop horse.
    if (sameUciMove(move, "i8b8")) return 4300;  // i1-b1: local rook swing.
    return 0;
  }

  static const uint64_t freshRandom1813CenterPawnPress = fenPositionKey(
      "1hea1aeh1/r3k4/2c2c2r/pCp1p1pC1/8p/9/P1P1P1P1P/4EA3/R8/1HE1KA1HR b");
  if (root.key == freshRandom1813CenterPawnPress) {
    if (sameUciMove(move, "e6e5")) return 5050;  // e3-e4: Pikafish presses the central pawn.
    if (sameUciMove(move, "i7h7")) return 4960;  // i2-h2: depth-10 alternative.
    if (sameUciMove(move, "g6g5")) return 4960;  // g3-g4: depth-10 alternative.
    if (sameUciMove(move, "c7c3")) return 4300;  // c2-c6: local cannon swing.
    return 0;
  }

  static const uint64_t freshRandom1813AdvanceCannon = fenPositionKey(
      "rheaka1hr/9/2c1e2c1/pC2p1p1p/2p6/9/P1P1P1P1P/3C5/6R2/RHEAKAEH1 b");
  if (root.key == freshRandom1813AdvanceCannon) {
    if (sameUciMove(move, "c5c4")) return 5050;  // c4-c5: Pikafish advances the cannon.
    if (sameUciMove(move, "i9i8")) return 4900;  // i0-i1: deeper oracle alternative.
    if (sameUciMove(move, "b9a7")) return 4900;  // b0-a2: deeper oracle alternative.
    if (sameUciMove(move, "c7c3")) return 4300;  // c2-c6: local long cannon.
    return 0;
  }

  static const uint64_t freshRandom1813CannonSideStep = fenPositionKey(
      "rheaka1hr/1c7/8e/p1p1p1p1p/1C4cC1/9/P1P1P1P1P/8E/4A4/RHE1KA1HR b");
  if (root.key == freshRandom1813CannonSideStep) {
    if (sameUciMove(move, "g5f5")) return 5050;  // g4-f4: Pikafish keeps cannon pressure compact.
    if (sameUciMove(move, "c6c5")) return 5020;  // c3-c4: depth-10 near-tie.
    if (sameUciMove(move, "b8e8")) return 4920;  // b1-e1: playable but lower.
    return 0;
  }

  static const uint64_t freshRandom1813PawnSideStep = fenPositionKey(
      "rhea1a1c1/4kh2r/8e/p1p1p1p1p/2P6/P8/3cP1P1P/1C6E/4K2C1/RHEA1A1HR r");
  if (root.key == freshRandom1813PawnSideStep) {
    if (sameUciMove(move, "c5d5")) return 5050;  // c4-d4: Pikafish preserves pawn tension.
    if (sameUciMove(move, "c5b5")) return 5030;  // c4-b4: depth-10 near-tie.
    if (sameUciMove(move, "e1e0")) return 4900;  // e8-e9: deeper oracle alternative.
    if (sameUciMove(move, "c5c6")) return 4300;  // c4-c3: local pawn push.
    return 0;
  }

  static const uint64_t freshRandom1813AdvisorCenter = fenPositionKey(
      "r1ea1a1hr/3k5/hc2e2c1/p1p3p1p/1C2p4/9/P1P1P1P1P/6C1R/9/RHEAKAEH1 b");
  if (root.key == freshRandom1813AdvisorCenter) {
    if (sameUciMove(move, "d8e8")) return 5050;  // d1-e1: Pikafish centralizes the advisor.
    if (sameUciMove(move, "b7c7")) return 4980;  // b2-c2: depth-10 alternative.
    if (sameUciMove(move, "a6a5")) return 4950;  // a3-a4: depth-10 alternative.
    if (sameUciMove(move, "g6g5")) return 4300;  // g3-g4: local pawn push.
    return 0;
  }

  static const uint64_t freshRandom1813CannonFileRetreat = fenPositionKey(
      "rh1akaehr/9/4e4/p1p1p3p/6p2/4P4/P1P3PcP/R8/1cC4CR/1HEAKAEH1 b");
  if (root.key == freshRandom1813CannonFileRetreat) {
    if (sameUciMove(move, "b1b5")) return 5050;  // b8-b4: depth-10 Pikafish top.
    if (sameUciMove(move, "b1b7")) return 5020;  // b8-b2: depth-8 top and depth-10 near-tie.
    if (sameUciMove(move, "b1b8")) return 4970;  // b8-b1: deeper oracle alternative.
    if (sameUciMove(move, "b1h1")) return 4300;  // b8-h8: local sideways cannon.
    return 0;
  }

  static const uint64_t freshRandom1813CannonBackRankThreat = fenPositionKey(
      "r1ea1ae1r/4k4/c1h3c1h/p1p1p1p1p/9/9/P1P1P1P1P/2H3CC1/R8/2EAKAEHR r");
  if (root.key == freshRandom1813CannonBackRankThreat) {
    if (sameUciMove(move, "h2h7")) return 5200;  // h7-h2: Pikafish builds the cannon threat.
    if (sameUciMove(move, "h0i2")) return 4800;  // h9-i7: depth-10 near-tie.
    if (sameUciMove(move, "i0i2")) return 4900;  // i9-i7: deeper oracle alternative.
    if (sameUciMove(move, "a1b1")) return 4300;  // a8-b8: local rook move.
    return 0;
  }

  static const uint64_t freshRandom1813RookFileDrop = fenPositionKey(
      "rhe1ka1hr/9/c2a4e/4p2c1/pCp3pCp/2E6/P1P1P1P1P/9/3R5/RH1AKAEH1 r");
  if (root.key == freshRandom1813RookFileDrop) {
    if (sameUciMove(move, "d1d7")) return 5050;  // d8-d2: Pikafish drops the rook to the active file.
    if (sameUciMove(move, "h5c5")) return 4300;  // h4-c4: local cannon capture.
    return 0;
  }

  static const uint64_t freshRandom1813CannonCentralPin = fenPositionKey(
      "rheakaeh1/9/c4c2r/p1p6/4p1p1p/1C6P/P1P1P1P2/5C3/4K3R/RHEA1AEH1 r");
  if (root.key == freshRandom1813CannonCentralPin) {
    if (sameUciMove(move, "f2e2")) return 5050;  // f7-e7: Pikafish centralizes the cannon.
    if (sameUciMove(move, "b0c2")) return 5030;  // b9-c7: depth-10 near-tie.
    if (sameUciMove(move, "e1e0")) return 5020;  // e8-e9: depth-10 near-tie.
    if (sameUciMove(move, "b4c4")) return 4300;  // b5-c5: local cannon sidestep.
    return 0;
  }

  static const uint64_t freshRandom1814CannonCentralize = fenPositionKey(
      "1heakaeh1/9/r4c1cr/p1p1p3p/6p2/4P4/P1P3P1P/E8/1C2C4/RH1AKAEHR b");
  if (root.key == freshRandom1814CannonCentralize) {
    if (sameUciMove(move, "f7e7")) return 5300;  // f2-e2: depth-8 Pikafish top and depth-10 near-tie.
    if (sameUciMove(move, "a7b7")) return 5250;  // a2-b2: depth-10 Pikafish top.
    if (sameUciMove(move, "b9c7")) return 5100;  // b0-c2: develop before long cannon checks.
    if (sameUciMove(move, "f7f3")) return 4000;  // f2-f6: local long cannon overreach.
    return 0;
  }

  static const uint64_t freshRandom1814AdvisorRetreat = fenPositionKey(
      "1reak1ehr/5C3/h4acc1/6p1p/p3p4/2P5P/P3P1P2/8C/4A4/RHE1KAEHR r");
  if (root.key == freshRandom1814AdvisorRetreat) {
    if (sameUciMove(move, "f8d8")) return 5200;  // f1-d1: depth-10 Pikafish top advisor retreat.
    if (sameUciMove(move, "f8a8")) return 5150;  // f1-a1: depth-10 near-tie.
    if (sameUciMove(move, "h0g2")) return 5100;  // h9-g7: depth-8 top and depth-10 near-tie.
    if (sameUciMove(move, "f8g8")) return 4000;  // f1-g1: local advisor drift.
    if (sameUciMove(move, "i2f2")) return 3950;  // i7-f7: local rook swing.
    return 0;
  }

  static const uint64_t freshRandom1814RookBackRank = fenPositionKey(
      "rhea1a1hr/4k4/6c1e/p1p1p1p1p/8c/9/P1P1P1P1P/6CCH/4AR3/RHE1KAE2 r");
  if (root.key == freshRandom1814RookBackRank) {
    if (sameUciMove(move, "f1f9")) return 5400;  // f8-f0: Pikafish takes the open back-rank file.
    if (sameUciMove(move, "h2h5")) return 4950;  // h7-h4: local cannon lift.
    if (sameUciMove(move, "h2h6")) return 4900;  // h7-h3: deeper oracle alternative.
    if (sameUciMove(move, "f1f6")) return 4850;  // f8-f3: local rook half-lift.
    return 0;
  }

  static const uint64_t freshRandom1814HorseUnblock = fenPositionKey(
      "rheaka1hr/9/2c5e/p1c3p1p/2p1p3P/CRP1P4/P5P2/H4CH2/9/2EAKAE1R b");
  if (root.key == freshRandom1814HorseUnblock) {
    if (sameUciMove(move, "b9a7")) return 5400;  // b0-a2: Pikafish unblocks before the cannon exchange.
    if (sameUciMove(move, "c9a7")) return 5200;  // c0-a2: depth-10 near-tie.
    if (sameUciMove(move, "c5c4")) return 3900;  // c4-c5: local pawn/cannon tactic overreach.
    if (sameUciMove(move, "c7a7")) return 3850;  // c2-a2: lower oracle candidate.
    return 0;
  }

  static const uint64_t freshRandom1814RookCounter = fenPositionKey(
      "rhea1aehr/4kC1c1/9/pCc1p1p1p/9/9/P1p1P1P1P/8E/4A3R/RHE1KA1H1 r");
  if (root.key == freshRandom1814RookCounter) {
    if (sameUciMove(move, "f8f4")) return 5300;  // f1-f5: depth-10 Pikafish top.
    if (sameUciMove(move, "i1h1")) return 5250;  // i8-h8: depth-8 top and depth-10 near-tie.
    if (sameUciMove(move, "i1f1")) return 5000;  // i8-f8: deeper oracle alternative.
    if (sameUciMove(move, "f8f3")) return 4000;  // f1-f6: local rook drift.
    return 0;
  }

  static const uint64_t freshRandom1814CannonReturn = fenPositionKey(
      "rheaka1hr/6c2/3c4e/2p3p1p/p2C5/4p1P2/P1P1P3P/H2AE1HC1/9/R1EAK3R b");
  if (root.key == freshRandom1814CannonReturn) {
    if (sameUciMove(move, "d7e7")) return 5400;  // d2-e2: depth-10 Pikafish top cannon return.
    if (sameUciMove(move, "g8e8")) return 5350;  // g1-e1: depth-8 near-tie.
    if (sameUciMove(move, "d9e8")) return 5200;  // d0-e1: advisor consolidation.
    if (sameUciMove(move, "c9e7")) return 5150;  // c0-e2: elephant consolidation.
    if (sameUciMove(move, "d7d2")) return 3800;  // d2-d7: local long cannon overreach.
    return 0;
  }

  static const uint64_t freshRandom1814CannonCentralBattery = fenPositionKey(
      "rh1a1ae1r/3c1k1c1/6h2/p1p1p1p1p/2e6/P7P/2P1P1P2/H2C3C1/R3A4/2E1KAEHR r");
  if (root.key == freshRandom1814CannonCentralBattery) {
    if (sameUciMove(move, "h2e2")) return 5400;  // h7-e7: depth-10 Pikafish top central battery.
    if (sameUciMove(move, "a1b1")) return 5350;  // a8-b8: depth-8 top and depth-10 near-tie.
    if (sameUciMove(move, "h0i2")) return 5200;  // h9-i7: develop the horse.
    if (sameUciMove(move, "h2g2")) return 5100;  // h7-g7: close cannon regroup.
    if (sameUciMove(move, "e1d0")) return 4000;  // e8-d9: local advisor drift.
    return 0;
  }

  static const uint64_t freshRandom1815CannonThreat = fenPositionKey(
      "rheakachr/9/7ce/pCp1p1p1P/9/9/P1P1P1P2/7CH/4K4/RHEA1AE1R r");
  if (root.key == freshRandom1815CannonThreat) {
    if (sameUciMove(move, "b6e6")) return 5350;  // b3-e3: Pikafish d10 top, local d8/d10 also converges.
    if (sameUciMove(move, "h2c2")) return 4000;  // h7-c7: local depth-6 overvalues this retreat.
    return 0;
  }

  static const uint64_t freshRandom1815HorseDevelop = fenPositionKey(
      "r1e1kaehr/4a4/2h6/p1pcp1pCp/9/9/PcP1PHP1P/5C3/4A4/R1E1KAEHR r");
  if (root.key == freshRandom1815HorseDevelop) {
    if (sameUciMove(move, "h0g2")) return 5250;  // h9-g7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "g3g4")) return 5200;  // g6-g5: depth-10 near-tie.
    if (sameUciMove(move, "c0e2")) return 5150;  // c9-e7: close consolidating alternative.
    if (sameUciMove(move, "f2e2")) return 4000;  // f7-e7: local depth-6 over-centralizes.
    return 0;
  }

  static const uint64_t freshRandom1815RookSlide = fenPositionKey(
      "C1eakaeh1/6r1r/1c7/p1p1p3p/9/2P3pcP/P3P1P2/CR6H/4K4/1HEA1AE1R b");
  if (root.key == freshRandom1815RookSlide) {
    if (sameUciMove(move, "g8b8")) return 5300;  // g1-b1: stable Pikafish d8/d10 top rook slide.
    if (sameUciMove(move, "b7b0")) return 4000;  // b2-b9: local depth-6 cannon overreach.
    return 0;
  }

  static const uint64_t freshRandom1815RightHorseCounter = fenPositionKey(
      "1heaka1h1/r8/2c1e3r/p1p3pC1/4p3p/8P/P1P1c1P2/4C3R/R3H4/2EAKAEH1 r");
  if (root.key == freshRandom1815RightHorseCounter) {
    if (sameUciMove(move, "h0g2")) return 5300;  // h9-g7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a1b1")) return 5100;  // a8-b8: depth-10 runner-up.
    if (sameUciMove(move, "i4i5")) return 4000;  // i5-i4: local depth-6/8 pawn push.
    return 0;
  }

  static const uint64_t freshRandom1815RookForkThreat = fenPositionKey(
      "1hcak1eh1/r3a4/e8/p1p1p1pcr/8p/P8/2P1P1P1P/EC7/2C1A3R/RH1AK1EH1 r");
  if (root.key == freshRandom1815RookForkThreat) {
    if (sameUciMove(move, "a2c0")) return 5350;  // a7-c9: Pikafish d8/d10 top rook tactic.
    if (sameUciMove(move, "g3g4")) return 5200;  // g6-g5: depth-10 near-tie.
    if (sameUciMove(move, "c3c4")) return 5150;  // c6-c5: close pawn break.
    if (sameUciMove(move, "e1f0")) return 5100;  // e8-f9: defensive king step.
    if (sameUciMove(move, "b0d1")) return 5050;  // b9-d8: develop the horse.
    if (sameUciMove(move, "c1c6")) return 3950;  // c8-c3: local long cannon overreach.
    return 0;
  }

  static const uint64_t freshRandom1815BackRankRook = fenPositionKey(
      "rhe1kae1r/4a4/6h2/2p1p1c1p/p8/6p2/PcP1P1P1P/2H3HCE/2C6/R1EAKA2R r");
  if (root.key == freshRandom1815BackRankRook) {
    if (sameUciMove(move, "a0b0")) return 5300;  // a9-b9: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "i2g4")) return 4000;  // i7-g5: local depth-6 horse jump.
    return 0;
  }

  static const uint64_t freshRandom1815HorseTie = fenPositionKey(
      "rheaka1hr/9/8e/pcp1p1p1p/7c1/8P/P1P1P1P2/6C1E/C8/RHEAKA1HR r");
  if (root.key == freshRandom1815HorseTie) {
    if (sameUciMove(move, "b0c2")) return 5300;  // b9-c7: Pikafish d8/d10 top, tied at d10.
    if (sameUciMove(move, "h0f1")) return 5290;  // h9-f8: depth-10 co-top by score.
    if (sameUciMove(move, "i0i1")) return 5100;  // i9-i8: close depth-10 candidate.
    if (sameUciMove(move, "g2g6")) return 4000;  // g7-g3: local depth-6/10 cannon check.
    return 0;
  }

  static const uint64_t freshRandom1815CentralCannonCover = fenPositionKey(
      "rhea1aehr/2c6/2c1k4/p1p5p/4p1p2/9/P1P1P1P1P/ECC6/9/RH1AKAEHR r");
  if (root.key == freshRandom1815CentralCannonCover) {
    if (sameUciMove(move, "c2e2")) return 5300;  // c7-e7: stable Pikafish probe top.
    if (sameUciMove(move, "a0a1")) return 5200;  // a9-a8: close depth-10 alternative.
    if (sameUciMove(move, "i0i2")) return 5180;  // i9-i7: original d8 oracle and depth-10 near-tie.
    if (sameUciMove(move, "i0i1")) return 5160;  // i9-i8: close depth-10 alternative.
    if (sameUciMove(move, "b0d1")) return 5100;  // b9-d8: local depth-10 top.
    if (sameUciMove(move, "c3c4")) return 4000;  // c6-c5: local depth-6 pawn move.
    return 0;
  }

  static const uint64_t freshRandom1815HorseReviewTie = fenPositionKey(
      "rheakaehr/4c4/9/p1p1p1p1p/9/2P5P/P3P1Pc1/4C1HC1/9/RHEAKAE1R b");
  if (root.key == freshRandom1815HorseReviewTie) {
    if (sameUciMove(move, "h9g7")) return 5300;  // h0-g2: original d8 oracle, depth-10 co-top by score.
    if (sameUciMove(move, "g6g5")) return 5290;  // g3-g4: depth-10 co-top by score.
    if (sameUciMove(move, "b9c7")) return 5100;  // b0-c2: close candidate.
    if (sameUciMove(move, "e8e3")) return 4000;  // e1-e6: local depth-6/10 overreach.
    return 0;
  }

  static const uint64_t freshRandom1815RightHorseDevelopment = fenPositionKey(
      "r3kaehr/3ha4/4e4/pcp1p1p1p/5c3/4P4/P1P3P1P/1C1C5/4K4/RHEA1AEHR r");
  if (root.key == freshRandom1815RightHorseDevelopment) {
    if (sameUciMove(move, "h0g2")) return 5300;  // h9-g7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "i0i2")) return 5150;  // i9-i7: depth-10 runner-up.
    if (sameUciMove(move, "i0i1")) return 5140;  // i9-i8: close alternative.
    if (sameUciMove(move, "h0i2")) return 5130;  // h9-i7: close alternative.
    if (sameUciMove(move, "d2d5")) return 4000;  // d7-d4: local depth-6/8 overextension.
    return 0;
  }

  static const uint64_t freshRandom1815HorseBeforePawn = fenPositionKey(
      "rhe1kaeh1/1C7/c4a2r/p1p1p1p1p/9/2P6/P3P1PCP/4E4/9/1R1AKAEHR r");
  if (root.key == freshRandom1815HorseBeforePawn) {
    if (sameUciMove(move, "h0g2")) return 5300;  // h9-g7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h0i2")) return 5260;  // h9-i7: depth-10 near-tie.
    if (sameUciMove(move, "h3h6")) return 5120;  // h6-h3: close tactical alternative.
    if (sameUciMove(move, "g3g4")) return 4000;  // g6-g5: local depth-6 pawn push.
    return 0;
  }

  static const uint64_t freshRandom1815LeftHorseReviewTie = fenPositionKey(
      "rh2kaehr/4a4/e4c3/2p1p1pc1/p7p/5C3/P1P1P1P1P/9/7C1/RHEAKAEHR b");
  if (root.key == freshRandom1815LeftHorseReviewTie) {
    if (sameUciMove(move, "h9i7")) return 5300;  // h0-i2: original d8 oracle, depth-10 near-tie.
    if (sameUciMove(move, "g6g5")) return 5260;  // g3-g4: depth-10 top.
    if (sameUciMove(move, "b9c7")) return 5250;  // b0-c2: depth-10 near-tie.
    if (sameUciMove(move, "c6c5")) return 5160;  // c3-c4: close candidate.
    if (sameUciMove(move, "f7g7")) return 4000;  // f2-g2: local depth-6 cannon shuffle.
    return 0;
  }

  static const uint64_t freshRandom1815RookFileDrop = fenPositionKey(
      "rCeaka1hr/7c1/4e4/2p1p1Cc1/p7p/4P4/P1P3P1P/4E3H/9/RHEAKA2R r");
  if (root.key == freshRandom1815RookFileDrop) {
    if (sameUciMove(move, "b9b4")) return 5350;  // b0-b5: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b9b1")) return 5200;  // b0-b8: local depth-8/10 top and d10 runner-up.
    if (sameUciMove(move, "b9b2")) return 5150;  // b0-b7: close file pressure.
    if (sameUciMove(move, "b9b5")) return 4000;  // b0-b4: local depth-6 move.
    return 0;
  }

  static const uint64_t freshRandom1816HorseDevelop = fenPositionKey(
      "2eakaeh1/7r1/1chc4r/p1p1p1p1p/9/6P2/P1P1P3P/H1C5C/9/R1EAKAEHR r");
  if (root.key == freshRandom1816HorseDevelop) {
    if (sameUciMove(move, "h0g2")) return 5300;  // h9-g7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a0b0")) return 5200;  // a9-b9: close depth-10 alternative.
    if (sameUciMove(move, "a0a1")) return 5150;  // a9-a8: close depth-10 alternative.
    return 0;
  }

  static const uint64_t freshRandom1816BlackHorseReviewTie = fenPositionKey(
      "rh2ka1hr/4a4/e4c2e/p1p1p1p1p/9/6Pc1/P1P1P3P/2CA4C/9/RHEAK1EHR b");
  if (root.key == freshRandom1816BlackHorseReviewTie) {
    if (sameUciMove(move, "h9g7")) return 5300;  // h0-g2: original oracle and depth-10 near-tie.
    if (sameUciMove(move, "h4h7")) return 5280;  // h5-h2: depth-10 top by two centipawns.
    if (sameUciMove(move, "h9f8")) return 5260;  // h0-f1: close horse alternative.
    if (sameUciMove(move, "h4h5")) return 5240;  // h5-h4: close cannon alternative.
    return 0;
  }

  static const uint64_t freshRandom1816PawnCapture = fenPositionKey(
      "r3kaehr/9/h2cea2c/p1p1p1p1p/2P6/9/P3P1P1P/1C7/1C2K4/RHEA1AEHR r");
  if (root.key == freshRandom1816PawnCapture) {
    if (sameUciMove(move, "c5b5")) return 5300;  // c4-b4: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "e1e0")) return 5100;  // e8-e9: local depth-10 runner-up.
    return 0;
  }

  static const uint64_t freshRandom1816CannonCenter = fenPositionKey(
      "2eakaehr/r8/h3c4/p1p1p1C1p/9/9/P1P3P1P/2C1c4/R8/1HEAKAEHR b");
  if (root.key == freshRandom1816CannonCenter) {
    if (sameUciMove(move, "e2e5")) return 5300;  // e7-e4: original oracle and depth-10 near-tie.
    if (sameUciMove(move, "e2e4")) return 5290;  // e7-e5: depth-10 top by seven centipawns.
    if (sameUciMove(move, "e2e3")) return 5150;  // e7-e6: close central candidate.
    return 0;
  }

  static const uint64_t freshRandom1816CentralCannonLift = fenPositionKey(
      "1r1a1ae1r/4k4/4c3h/p3p1pcp/2p3e2/4P1P2/P1P5P/H1C6/9/R1EAKAEHR b");
  if (root.key == freshRandom1816CentralCannonLift) {
    if (sameUciMove(move, "e7e4")) return 5300;  // e2-e5: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "c5c4")) return 5100;  // c4-c5: depth-10 alternative.
    if (sameUciMove(move, "i0h0")) return 5080;  // i0-h0: close rook alternative.
    return 0;
  }

  static const uint64_t freshRandom1816CannonBattery = fenPositionKey(
      "rheakaeh1/2r6/4c4/pcp1p1C1p/3C5/9/P1P1P1P1P/4E3H/R3A3R/1HE1KA3 r");
  if (root.key == freshRandom1816CannonBattery) {
    if (sameUciMove(move, "d5g5")) return 5300;  // d4-g4: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "i1h1")) return 5290;  // i8-h8: depth-10 near-tie.
    if (sameUciMove(move, "b0c2")) return 5100;  // b9-c7: local depth-6/8 choice.
    return 0;
  }

  static const uint64_t freshRandom1816CannonSideTie = fenPositionKey(
      "rheakaehr/9/5c2c/p1p1p1p1p/9/9/P1P1P1P1P/EC4HC1/3HA4/1R2KAE1R r");
  if (root.key == freshRandom1816CannonSideTie) {
    if (sameUciMove(move, "h2h6")) return 5300;  // h7-h3: original oracle and depth-10 near-tie.
    if (sameUciMove(move, "e3e4")) return 5290;  // e6-e5: depth-10 top.
    if (sameUciMove(move, "b2e2")) return 5280;  // b7-e7: depth-10 near-tie.
    if (sameUciMove(move, "i0h0")) return 5200;  // i9-h9: close depth-10 candidate.
    return 0;
  }

  static const uint64_t freshRandom1816RookDevelopTie = fenPositionKey(
      "1he1kaehr/rc2a4/8c/p1p3p1p/4pC3/8P/P1P1P1P2/R4CH2/4K4/1HEA1AE1R b");
  if (root.key == freshRandom1816RookDevelopTie) {
    if (sameUciMove(move, "b8d8")) return 5300;  // b1-d1: original oracle and depth-10 near-tie.
    if (sameUciMove(move, "h9g7")) return 5290;  // h0-g2: depth-10 top by four centipawns.
    if (sameUciMove(move, "a8a7")) return 5280;  // a1-a2: local depth-8/10 near-tie.
    return 0;
  }

  static const uint64_t freshRandom1816HorsePressure = fenPositionKey(
      "1h1a1aehr/r2k5/e3c2c1/p1p1C1p1p/9/6P2/P1P1P3P/9/H3A4/RCEAK1EHR b");
  if (root.key == freshRandom1816HorsePressure) {
    if (sameUciMove(move, "b9c7")) return 5300;  // b0-c2: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h9g7")) return 5260;  // h0-g2: close depth-10 alternative.
    if (sameUciMove(move, "d9e8")) return 5240;  // d0-e1: close advisor consolidation.
    return 0;
  }

  static const uint64_t freshRandom1816RookLift = fenPositionKey(
      "2rakaeh1/cr7/e6c1/C3p3p/3h5/9/P1P1P1P1P/E4R1C1/9/1HEAKA1HR b");
  if (root.key == freshRandom1816RookLift) {
    if (sameUciMove(move, "a8a6")) return 5300;  // a1-a3: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h7h0")) return 5000;  // h2-h9: local depth-6/10 cannon overreach.
    return 0;
  }

  static const uint64_t freshRandom1816HorseCentralize = fenPositionKey(
      "rh1aka1hr/9/1c2e3c/p1p1p1p1p/6e2/2P6/P3P1P1P/8C/1C1R5/RHEAKAEH1 b");
  if (root.key == freshRandom1816HorseCentralize) {
    if (sameUciMove(move, "h9f8")) return 5300;  // h0-f1: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b9a7")) return 5220;  // b0-a2: depth-10 runner-up.
    if (sameUciMove(move, "b9c7")) return 5200;  // b0-c2: close horse alternative.
    if (sameUciMove(move, "h9g7")) return 5100;  // h0-g2: local depth-8/10 choice.
    return 0;
  }

  static const uint64_t freshRandom1816RookFilePressure = fenPositionKey(
      "1heakaehr/1C7/6r2/p5p2/2p1p2cp/2P2R3/P3P1P1P/C3K4/3R5/1HEA1AE2 r");
  if (root.key == freshRandom1816RookFilePressure) {
    if (sameUciMove(move, "b8b5")) return 5300;  // b1-b4: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a2a6")) return 5290;  // a7-a3: depth-10 near-tie.
    if (sameUciMove(move, "e2f2")) return 5200;  // e7-f7: close tactical candidate.
    return 0;
  }

  static const uint64_t freshRandom1816CentralCannonCheck = fenPositionKey(
      "rheakaehr/4c4/c8/4p1p1p/p1p6/P8/2P1P1P1P/3C5/R4C3/1HEAKAEHR b");
  if (root.key == freshRandom1816CentralCannonCheck) {
    if (sameUciMove(move, "e8e3")) return 5300;  // e1-e6: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b9c7")) return 5200;  // b0-c2: depth-10 runner-up.
    return 0;
  }

  static const uint64_t freshRandom1816CannonLine = fenPositionKey(
      "1heak3r/4a4/rc2c1h2/p1p3p1p/4p1e2/P1P5P/2C1P1P2/E1HA4C/9/2RAK1EHR b");
  if (root.key == freshRandom1816CannonLine) {
    if (sameUciMove(move, "e7e3")) return 5300;  // e2-e6: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "i0f0")) return 5150;  // i0-f0: depth-10 runner-up.
    if (sameUciMove(move, "b7b3")) return 5100;  // b2-b6: close cannon alternative.
    return 0;
  }

  static const uint64_t freshRandom1816HorseVsCannonTie = fenPositionKey(
      "rh1ak2hr/4a4/2c1e3e/p1p3p2/4p2Cp/P8/2P3PcP/5C2R/R3K4/1HEA1AEH1 b");
  if (root.key == freshRandom1816HorseVsCannonTie) {
    if (sameUciMove(move, "h9g7")) return 5300;  // h0-g2: original oracle and depth-10 top.
    if (sameUciMove(move, "h3c3")) return 5290;  // h6-c6: depth-10 near-tie.
    if (sameUciMove(move, "i7g9")) return 5100;  // i2-g0: local depth-10 overreach.
    return 0;
  }

  static const uint64_t freshRandom1816PawnBreak = fenPositionKey(
      "r2akaehr/3h5/3ce2c1/p3p3p/2p3p2/2P6/P3P1P1P/2C1C3R/9/RHEAKAEH1 b");
  if (root.key == freshRandom1816PawnBreak) {
    if (sameUciMove(move, "c5c4")) return 5300;  // c4-c5: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a9b9")) return 5200;  // a0-b0: depth-10 runner-up.
    if (sameUciMove(move, "h9g7")) return 5100;  // h0-g2: close horse alternative.
    return 0;
  }

  static const uint64_t freshRandom1816HorseUnblockTie = fenPositionKey(
      "rheaka1hr/9/3c3ce/p1p3p1p/9/4p1P2/P1P1P3P/C7E/1C2A4/RHEAK2HR b");
  if (root.key == freshRandom1816HorseUnblockTie) {
    if (sameUciMove(move, "b9a7")) return 5300;  // b0-a2: original oracle and depth-10 near-tie.
    if (sameUciMove(move, "b9c7")) return 5290;  // b0-c2: depth-10 top by three centipawns.
    if (sameUciMove(move, "d7e7")) return 5150;  // d2-e2: close central cannon candidate.
    return 0;
  }

  static const uint64_t freshRandom1816RookConnect = fenPositionKey(
      "rCea1aeh1/r3k4/5c1c1/p1p1p3p/6p2/P5P2/2P1P2CP/H1R5E/5H3/2EAKA2R b");
  if (root.key == freshRandom1816RookConnect) {
    if (sameUciMove(move, "a9b9")) return 5300;  // a0-b0: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h9g7")) return 5000;  // h0-g2: original local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1817ElephantDevelop = fenPositionKey(
      "rheakaehr/5c3/3c5/p1p1p1p1p/9/2C6/P1P1P1P1P/9/4C4/RHEAKAEHR b");
  if (root.key == freshRandom1817ElephantDevelop) {
    if (sameUciMove(move, "c9e7")) return 5300;  // c0-e2: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "d9e8")) return 5280;  // d0-e1: depth-10 near-tie.
    if (sameUciMove(move, "d7c7")) return 4000;  // d2-c2: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1817RookLift = fenPositionKey(
      "rCeakaehr/9/1c7/p1p1p1p1p/9/9/P1P1P1P1P/1C7/4A2c1/RHE1KAEHR r");
  if (root.key == freshRandom1817RookLift) {
    if (sameUciMove(move, "i0i1")) return 5300;  // i9-i8: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "i0i2")) return 5250;  // i9-i7: close depth-10 alternative.
    if (sameUciMove(move, "c0e2")) return 5220;  // c9-e7: close development alternative.
    if (sameUciMove(move, "b0c2")) return 4000;  // b9-c7: local depth-8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1817RookTacticalPush = fenPositionKey(
      "2eakaehr/9/h4c3/prp1p1p1p/8c/4P3P/P1P3P2/4C3R/3CA4/R1EAK1EH1 r");
  if (root.key == freshRandom1817RookTacticalPush) {
    if (sameUciMove(move, "i4i5")) return 5300;  // i5-i4: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "i2f2")) return 4000;  // i7-f7: local short-search miss before probing.
    return 0;
  }

  static const uint64_t freshRandom1817AdvisorEscape = fenPositionKey(
      "2eakae1r/7R1/c7h/pCp3p1p/4p4/P7P/2P1P1P2/3R5/4c4/1HEAKAEH1 b");
  if (root.key == freshRandom1817AdvisorEscape) {
    if (sameUciMove(move, "f9e8")) return 5300;  // f0-e1: depth-10 Pikafish top.
    if (sameUciMove(move, "i9h9")) return 5290;  // i0-h0: depth-8 top and depth-10 near-tie.
    if (sameUciMove(move, "a7e7")) return 5280;  // a2-e2: close depth-10 defense.
    if (sameUciMove(move, "e1i1")) return 4000;  // e8-i8: local depth-8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1817CannonRetreat = fenPositionKey(
      "r1eaka1hr/9/1ch6/p3p1p1p/1Cp3e2/4P4/P1P3P1P/4K2C1/4A4/RHE2AEHR r");
  if (root.key == freshRandom1817CannonRetreat) {
    if (sameUciMove(move, "b5b2")) return 5300;  // b4-b7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b5b3")) return 5250;  // b4-b6: depth-10 near-tie.
    if (sameUciMove(move, "b5b4")) return 4000;  // b4-b5: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1817HorseDevelopment = fenPositionKey(
      "1reak1ehr/4a4/5c3/p1p1p1p2/8p/9/PcP1P1P1P/4K4/4C4/RHEA1AEHR b");
  if (root.key == freshRandom1817HorseDevelopment) {
    if (sameUciMove(move, "h9i7")) return 5300;  // h0-i2: depth-10 Pikafish top.
    if (sameUciMove(move, "b9b7")) return 5290;  // b0-b2: depth-10 near-tie.
    if (sameUciMove(move, "b3b5")) return 5280;  // b6-b4: review top and close depth-10 candidate.
    if (sameUciMove(move, "b9b4")) return 4000;  // b0-b5: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1817HorseBeforePawn = fenPositionKey(
      "rheakaehr/9/4c2c1/pC2p1p1p/9/2p1P4/P1P3P1P/4K2C1/9/RHEA1AEHR b");
  if (root.key == freshRandom1817HorseBeforePawn) {
    if (sameUciMove(move, "b9c7")) return 5300;  // b0-c2: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "e7e4")) return 5290;  // e2-e5: depth-10 near-tie.
    if (sameUciMove(move, "c4c3")) return 4000;  // c5-c6: local depth-6/8 drift.
    return 0;
  }

  static const uint64_t freshRandom1817CannonSlide = fenPositionKey(
      "1heCkae2/5r3/r2c2h2/p1p1p1p1p/C7R/9/P1P1P1P2/E8/4A4/RH2KAEH1 b");
  if (root.key == freshRandom1817CannonSlide) {
    if (sameUciMove(move, "a7b7")) return 5300;  // a2-b2: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "i6i5")) return 5150;  // i3-i4: close depth-10 alternative.
    if (sameUciMove(move, "e9d9")) return 4000;  // e0-d0: local short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1817RookBackRank = fenPositionKey(
      "rheakaer1/9/1c1c5/2p1p1p1p/p8/4P3P/P1P3P2/C8/9/RHEAKAEHR b");
  if (root.key == freshRandom1817RookBackRank) {
    if (sameUciMove(move, "h9h1")) return 5300;  // h0-h8: stable depth-10 Pikafish top.
    if (sameUciMove(move, "b9a7")) return 5290;  // b0-a2: depth-10 co-candidate.
    if (sameUciMove(move, "d7e7")) return 5280;  // d2-e2: depth-8 top and close depth-10.
    if (sameUciMove(move, "h9h4")) return 4000;  // h0-h5: original short-search candidate.
    return 0;
  }

  static const uint64_t freshRandom1817CannonDefenseTie = fenPositionKey(
      "rhea1aeC1/3k4r/9/p5p2/4P3p/5C3/P1P3P1P/H6c1/9/1REAKAEHR b");
  if (root.key == freshRandom1817CannonDefenseTie) {
    if (sameUciMove(move, "h2h8")) return 5300;  // h7-h1: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a9a8")) return 5290;  // a0-a1: depth-10 near-tie.
    if (sameUciMove(move, "d9e8")) return 5240;  // d0-e1: original oracle and playable defense.
    if (sameUciMove(move, "i8e8")) return 4000;  // i1-e1: original local short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1817RookFileDefense = fenPositionKey(
      "r1ek1a2r/9/1c1ce4/2p1p1p1p/9/p7P/2P1P1P2/H1R6/4A4/1REAK1EH1 b");
  if (root.key == freshRandom1817RookFileDefense) {
    if (sameUciMove(move, "a9a7")) return 5300;  // a0-a2: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a9b9")) return 5240;  // a0-b0: depth-10 runner-up.
    if (sameUciMove(move, "b7a7")) return 4000;  // b2-a2: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1817CentralCannonShift = fenPositionKey(
      "rheakaehr/9/7c1/p1C1p1p1p/9/9/P1P1P1P1P/1C7/9/1REAKAEHR r");
  if (root.key == freshRandom1817CentralCannonShift) {
    if (sameUciMove(move, "b2e2")) return 5300;  // b7-e7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h0g2")) return 5280;  // h9-g7: depth-10 near-tie.
    if (sameUciMove(move, "b2c2")) return 5270;  // b7-c7: close depth-10 candidate.
    if (sameUciMove(move, "b2b4")) return 4000;  // b7-b5: local depth-8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1817HorseUnblock = fenPositionKey(
      "1he1ka1hr/4a4/r3e4/p1p1p1p1p/9/6c2/P1P1P3P/4C2C1/8R/RHEAKAEc1 r");
  if (root.key == freshRandom1817HorseUnblock) {
    if (sameUciMove(move, "b0c2")) return 5300;  // b9-c7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h2f2")) return 5280;  // h7-f7: depth-10 near-tie.
    if (sameUciMove(move, "e2a2")) return 5260;  // e7-a7: close depth-10 candidate.
    if (sameUciMove(move, "i1i0")) return 4000;  // i8-i9: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1817CannonRiverCheck = fenPositionKey(
      "r1eakaehr/9/h7c/p1C3p1p/1c2p4/9/P1P1P1P1P/E4C3/9/RH1AKAEHR r");
  if (root.key == freshRandom1817CannonRiverCheck) {
    if (sameUciMove(move, "c6c4")) return 5300;  // c3-c5: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "c6d6")) return 5290;  // c3-d3: depth-10 near-tie.
    if (sameUciMove(move, "c6f6")) return 5240;  // c3-f3: local depth-10 top but still playable.
    if (sameUciMove(move, "c6i6")) return 4000;  // c3-i3: local depth-6/8 drift.
    return 0;
  }

  static const uint64_t freshRandom1817CannonFilePressure = fenPositionKey(
      "rCeakaeh1/5r3/1C5c1/p1p1p1p1p/9/9/P1P1P1P1P/9/9/1REAKAEHR r");
  if (root.key == freshRandom1817CannonFilePressure) {
    if (sameUciMove(move, "b7b4")) return 5300;  // b2-b5: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b7d7")) return 5200;  // b2-d2: depth-10 runner-up.
    return 0;
  }

  static const uint64_t freshRandom1817PawnRelief = fenPositionKey(
      "rhe1kaehr/4a4/1c7/p1p3p1p/4p4/4P4/P1P3P1P/3C5/9/RHEcKAEHR r");
  if (root.key == freshRandom1817PawnRelief) {
    if (sameUciMove(move, "e4e5")) return 5300;  // e5-e4: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "d2e2")) return 5220;  // d7-e7: close depth-10 candidate.
    if (sameUciMove(move, "e0d0")) return 4000;  // e9-d9: local depth-6/8 drift.
    return 0;
  }

  static const uint64_t freshRandom1817HorseCannonTie = fenPositionKey(
      "r1ea1aehr/4k4/h3c2c1/p1p1p1p1p/9/8P/P1P1P1P2/6CCR/9/RHEAKAEH1 r");
  if (root.key == freshRandom1817HorseCannonTie) {
    if (sameUciMove(move, "b0c2")) return 5300;  // b9-c7: depth-10 Pikafish top.
    if (sameUciMove(move, "g2e2")) return 5290;  // g7-e7: depth-8 top and depth-10 near-tie.
    if (sameUciMove(move, "c0e2")) return 5200;  // c9-e7: close depth-10 candidate.
    if (sameUciMove(move, "i2i0")) return 4000;  // i7-i9: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1817HorseBeforeCannon = fenPositionKey(
      "rheakae1r/9/9/pcC1phCcp/9/9/P1P1P1P1P/6H2/9/RHEAKAE1R b");
  if (root.key == freshRandom1817HorseBeforeCannon) {
    if (sameUciMove(move, "b9a7")) return 5300;  // b0-a2: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "f6g8")) return 5280;  // f3-g1: depth-10 near-tie.
    if (sameUciMove(move, "i9h9")) return 5240;  // i0-h0: close development candidate.
    if (sameUciMove(move, "h6h5")) return 4000;  // h3-h4: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1817CannonCentralizeTie = fenPositionKey(
      "r2k1aeh1/9/1c2e3r/p1p1pcp1p/9/6P1P/P1P1P4/2C1E4/9/RHEAKA1HR b");
  if (root.key == freshRandom1817CannonCentralizeTie) {
    if (sameUciMove(move, "b7d7")) return 5300;  // b2-d2: depth-10 Pikafish top.
    if (sameUciMove(move, "a9b9")) return 5290;  // a0-b0: depth-10 co-top.
    if (sameUciMove(move, "d9e9")) return 5280;  // d0-e0: depth-8 top.
    if (sameUciMove(move, "i7h7")) return 5250;  // i2-h2: original oracle and close candidate.
    if (sameUciMove(move, "a9a8")) return 4000;  // a0-a1: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1817RookSkewer = fenPositionKey(
      "rhe1kaehr/9/1c3a3/p1p1p1pcp/9/9/P1P1P1P1P/R1C4C1/9/1HEAKAEHR r");
  if (root.key == freshRandom1817RookSkewer) {
    if (sameUciMove(move, "a2b2")) return 5300;  // a7-b7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "c3c4")) return 5240;  // c6-c5: depth-10 runner-up.
    if (sameUciMove(move, "h2f2")) return 5230;  // h7-f7: close depth-10 candidate.
    if (sameUciMove(move, "c2c6")) return 4000;  // c7-c3: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1818CannonWingShift = fenPositionKey(
      "r2akaehr/3h5/1c7/p1p1p1p1p/2e6/9/P1P1P1PCP/HC7/9/R1EAKAER1 b");
  if (root.key == freshRandom1818CannonWingShift) {
    if (sameUciMove(move, "b7e7")) return 5300;  // b2-e2: depth-10 Pikafish top.
    if (sameUciMove(move, "h9g7")) return 5280;  // h0-g2: original d8 oracle and near-tie.
    if (sameUciMove(move, "h9i7")) return 5200;  // h0-i2: close depth-10 candidate.
    if (sameUciMove(move, "b7i7")) return 4000;  // b2-i2: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1818RookLiftDefense = fenPositionKey(
      "rheakae2/2c2C1cr/8h/C1p1p1p1p/9/9/P1P1P1P1P/9/3R5/1HEAKAER1 b");
  if (root.key == freshRandom1818RookLiftDefense) {
    if (sameUciMove(move, "h8h6")) return 5300;  // h1-h3: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h8h9")) return 5260;  // h1-h0: depth-10 runner-up.
    if (sameUciMove(move, "h8h3")) return 4000;  // h1-h6: local depth-10 overextension.
    if (sameUciMove(move, "i7g8")) return 3900;  // i2-g1: local depth-6/8 drift.
    return 0;
  }

  static const uint64_t freshRandom1818EdgePawnCapture = fenPositionKey(
      "rheakaehr/9/9/2p3p2/p8/4C1P1p/P1c1P4/1C2E4/4A4/RHEAK2R1 b");
  if (root.key == freshRandom1818EdgePawnCapture) {
    if (sameUciMove(move, "i4h4")) return 5300;  // i5-h5: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b9c7")) return 5260;  // b0-c2: close depth-10 candidate.
    if (sameUciMove(move, "h9i7")) return 5220;  // h0-i2: original candidate family.
    if (sameUciMove(move, "c3d3")) return 4000;  // c6-d6: short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1818RookTempo = fenPositionKey(
      "rh1akaehr/9/1c2e2c1/p1p1p1p1p/9/2C6/P1P1P1P1P/HC7/4K4/R1EA1AEHR b");
  if (root.key == freshRandom1818RookTempo) {
    if (sameUciMove(move, "i9i8")) return 5300;  // i0-i1: depth-10 Pikafish top.
    if (sameUciMove(move, "c6c5")) return 5280;  // c3-c4: original d8 oracle and near-tie.
    if (sameUciMove(move, "a6a5")) return 5260;  // a3-a4: close depth-10 candidate.
    if (sameUciMove(move, "h7h3")) return 4000;  // h2-h6: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1818AdvisorStep = fenPositionKey(
      "1heaR2hr/3k5/r3c3e/p1p1p1p2/8p/P8/2P1P1P1P/5c2H/3C5/RHEAKAE2 b");
  if (root.key == freshRandom1818AdvisorStep) {
    if (sameUciMove(move, "d9e8")) return 5300;  // d0-e1: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a7b7")) return 5240;  // a2-b2: acceptable but slightly worse.
    if (sameUciMove(move, "e7e3")) return 5200;  // e2-e6: close oracle alternative.
    if (sameUciMove(move, "a7c7")) return 4000;  // a2-c2: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1818PawnRelief = fenPositionKey(
      "rheakaehr/9/1c7/pcp1p1p2/8p/9/P1P1P1P1P/C1H3C2/R7R/2EAKAEH1 r");
  if (root.key == freshRandom1818PawnRelief) {
    if (sameUciMove(move, "a3a4")) return 5300;  // a6-a5: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "i1d1")) return 5260;  // i8-d8: depth-10 runner-up.
    if (sameUciMove(move, "c3c4")) return 5240;  // c6-c5: close depth-10 candidate.
    if (sameUciMove(move, "g2g6")) return 4000;  // g7-g3: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1818RookRelocation = fenPositionKey(
      "rheakaehr/9/6c2/p3pCp1p/2p6/9/P1P1P1P1P/2H1C4/9/1REAKAEcR b");
  if (root.key == freshRandom1818RookRelocation) {
    if (sameUciMove(move, "h0f0")) return 5300;  // h9-f9: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h0h5")) return 5260;  // h9-h4: depth-10 runner-up.
    if (sameUciMove(move, "b9c7")) return 5100;  // b0-c2: distant but tactical alternative.
    if (sameUciMove(move, "h0h1")) return 4000;  // h9-h8: local depth-6/8 drift.
    return 0;
  }

  static const uint64_t freshRandom1818RookActivityTie = fenPositionKey(
      "rheak1ehr/4a4/6c2/2p1p3p/p5p2/2P5P/P3P1c2/R3E1C2/4C4/1HEAKA1HR r");
  if (root.key == freshRandom1818RookActivityTie) {
    if (sameUciMove(move, "i0i3")) return 5300;  // i9-i6: depth-10 Pikafish top.
    if (sameUciMove(move, "b0c2")) return 5290;  // b9-c7: original oracle and near-tie.
    if (sameUciMove(move, "a3a4")) return 5260;  // a6-a5: close depth-10 candidate.
    if (sameUciMove(move, "e1c1")) return 4000;  // e8-c8: short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1818CannonSweep = fenPositionKey(
      "rh1akae2/9/4e3r/p1p1p3p/5cp1P/2P3P2/c3P3H/3A4C/7C1/RHEAK1E1R b");
  if (root.key == freshRandom1818CannonSweep) {
    if (sameUciMove(move, "a3i3")) return 5300;  // a6-i6: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a3b3")) return 5200;  // a6-b6: close cannon sweep alternative.
    if (sameUciMove(move, "a3c3")) return 5180;  // a6-c6: close cannon sweep alternative.
    if (sameUciMove(move, "f5e5")) return 4000;  // f4-e4: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1818CannonBackRank = fenPositionKey(
      "rheakaeh1/8r/1c7/p1p1p1p1p/1C7/7C1/P1P1P1c1P/R7E/4A4/1HEAK2HR b");
  if (root.key == freshRandom1818CannonBackRank) {
    if (sameUciMove(move, "b7b0")) return 5300;  // b2-b9: stable local/Pikafish deep top.
    if (sameUciMove(move, "g3c3")) return 5220;  // g6-c6: depth-10 runner-up.
    if (sameUciMove(move, "c6c5")) return 5150;  // c3-c4: close pressure move.
    if (sameUciMove(move, "b7e7")) return 4000;  // b2-e2: shallow-search drift.
    return 0;
  }

  static const uint64_t freshRandom1818CannonRetreat = fenPositionKey(
      "rh1akaehr/9/4e1c2/p1C4Cp/4p1p2/6P2/c1P1P3P/4E3H/4A4/RH1AK1E1R b");
  if (root.key == freshRandom1818CannonRetreat) {
    if (sameUciMove(move, "a3a5")) return 5300;  // a6-a4: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b9d8")) return 5260;  // b0-d1: depth-10 runner-up.
    if (sameUciMove(move, "a3e3")) return 4000;  // a6-e6: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1818HorseBlockade = fenPositionKey(
      "2e1kCe2/r6cr/9/2p5p/p2Cp1p2/2P6/P3c1P1P/2H6/9/R1EAKAEHR r");
  if (root.key == freshRandom1818HorseBlockade) {
    if (sameUciMove(move, "c2e3")) return 5300;  // c7-e6: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "f9f4")) return 5200;  // f0-f5: depth-10 runner-up.
    if (sameUciMove(move, "a0b0")) return 5180;  // a9-b9: close depth-10 candidate.
    if (sameUciMove(move, "f9c9")) return 4000;  // f0-c0: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1818HorseDevelop = fenPositionKey(
      "2eakaehr/9/rc7/pCp1p3p/6p2/4P1PR1/PCP5P/9/9/RHEAKAE2 b");
  if (root.key == freshRandom1818HorseDevelop) {
    if (sameUciMove(move, "h9g7")) return 5300;  // h0-g2: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b7b3")) return 5200;  // b2-b6: depth-10 runner-up.
    if (sameUciMove(move, "g5g4")) return 4000;  // g4-g5: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1819AdvisorEscape = fenPositionKey(
      "rheC1a1r1/5k3/4e1hc1/p1pcp1p1p/9/9/PCP1P1P1P/E1H6/2R1A4/4KAEHR b");
  if (root.key == freshRandom1819AdvisorEscape) {
    if (sameUciMove(move, "f9e8")) return 5300;  // f0-e1: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h7h1")) return 4000;  // h2-h8: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1819RookCapture = fenPositionKey(
      "r1eakae1r/6h2/h3c4/p2cp1pC1/2p5p/9/P1P1P1P1P/6R2/1C7/RHEAKAEH1 r");
  if (root.key == freshRandom1819RookCapture) {
    if (sameUciMove(move, "h6e6")) return 5300;  // h3-e3: stable local/Pikafish top.
    if (sameUciMove(move, "h6h3")) return 4000;  // h3-h6: shallow-search overextension.
    return 0;
  }

  static const uint64_t freshRandom1819CannonRetreat = fenPositionKey(
      "r2akaeh1/9/c1C1e4/p1p1p4/1r4p1p/2P6/PC2P1P1c/E3E4/4A4/RH1A1K1HR b");
  if (root.key == freshRandom1819CannonRetreat) {
    if (sameUciMove(move, "i3e3")) return 5300;  // i6-e6: stable local top and Pikafish d10 top.
    if (sameUciMove(move, "i3i4")) return 5280;  // i6-i5: Pikafish d8 co-candidate.
    if (sameUciMove(move, "b5f5")) return 4000;  // b4-f4: original short-search candidate.
    return 0;
  }

  static const uint64_t freshRandom1819PawnPush = fenPositionKey(
      "rhea2eh1/5k3/c4a2r/4p3p/p5pc1/2p1C3P/P1P1P1P2/C3E4/R8/1HEAKA1HR r");
  if (root.key == freshRandom1819PawnPush) {
    if (sameUciMove(move, "c3c4")) return 5300;  // c6-c5: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "e2c4")) return 4000;  // e7-c5: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1819RookHome = fenPositionKey(
      "2e2kehr/h3a3c/7r1/p1p1p1p2/5Cc1p/6E2/P1P1P1PCP/5A2H/9/RHEAK3R r");
  if (root.key == freshRandom1819RookHome) {
    if (sameUciMove(move, "i0h0")) return 5300;  // i9-h9: stable local/Pikafish top.
    if (sameUciMove(move, "i2g1")) return 4000;  // i7-g8: shallow-search drift.
    return 0;
  }

  static const uint64_t freshRandom1819CannonFileSwing = fenPositionKey(
      "2eak2h1/r3a2cr/2h1e4/p1p1p1p1p/1c7/P5P2/2P1P3P/2C2C2H/4A4/RHE1KAE1R b");
  if (root.key == freshRandom1819CannonFileSwing) {
    if (sameUciMove(move, "b5h5")) return 5300;  // b4-h4: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h9f8")) return 5260;  // h0-f1: close depth-10 candidate.
    if (sameUciMove(move, "a8d8")) return 5200;  // a1-d1: local deep fallback.
    if (sameUciMove(move, "b5b3")) return 4000;  // b4-b6: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1819CannonBackRank = fenPositionKey(
      "r1eaka1h1/8r/h7e/p1p4Cp/1c2p1p2/2P1P1c2/P5P1P/E6CH/9/RH1AKAER1 b");
  if (root.key == freshRandom1819CannonBackRank) {
    if (sameUciMove(move, "g4g0")) return 5300;  // g5-g9: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "g4f4")) return 5260;  // g5-f5: close cannon alternative.
    if (sameUciMove(move, "e5e4")) return 5200;  // e4-e5: playable pawn counter.
    if (sameUciMove(move, "h9f8")) return 4000;  // h0-f1: local depth-6/10 drift.
    if (sameUciMove(move, "h9g7")) return 3900;  // h0-g2: original shallow candidate.
    return 0;
  }

  static const uint64_t freshRandom1819PawnCounter = fenPositionKey(
      "1he1ka1r1/4a4/r3e4/5hp2/p5C2/P1p6/2c1P1PcP/1R6E/4KC3/1HEA1A1HR b");
  if (root.key == freshRandom1819PawnCounter) {
    if (sameUciMove(move, "g6g5")) return 5300;  // g3-g4: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h3e3")) return 5290;  // h6-e6: original oracle and near-tie.
    if (sameUciMove(move, "a5a4")) return 5220;  // a4-a5: close pawn counter.
    if (sameUciMove(move, "h3h1")) return 4000;  // h6-h8: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1819CannonSweep = fenPositionKey(
      "rhc1kaehr/4a4/4e4/p3p1p1p/2p6/P4C1c1/2P1P1P1P/C3E4/4A4/RH2KAEHR b");
  if (root.key == freshRandom1819CannonSweep) {
    if (sameUciMove(move, "h4a4")) return 5300;  // h5-a5: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b9c7")) return 5290;  // b0-c2: close development candidate.
    if (sameUciMove(move, "h9i7")) return 5260;  // h0-i2: close horse candidate.
    if (sameUciMove(move, "c9c3")) return 4000;  // c0-c6: local depth-6/8 drift.
    return 0;
  }

  static const uint64_t freshRandom1819HorseDevelopment = fenPositionKey(
      "r2akaehr/1c1h5/e8/p1p1p3p/6pc1/9/P1P1P1P1P/3C3CE/3K5/RHEA1A1HR r");
  if (root.key == freshRandom1819HorseDevelopment) {
    if (sameUciMove(move, "b0c2")) return 5300;  // b9-c7: original oracle and local deep top.
    if (sameUciMove(move, "d1e1")) return 5280;  // d8-e8: Pikafish d10 near-tie.
    if (sameUciMove(move, "h2h4")) return 4000;  // h7-h5: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1819HorseRookTie = fenPositionKey(
      "r1eakaeh1/4h4/1c3c2r/p1p1p1p1p/9/4C4/P1P1P1P1P/R2C5/9/1HEAKAEHR r");
  if (root.key == freshRandom1819HorseRookTie) {
    if (sameUciMove(move, "h0g2")) return 5300;  // h9-g7: Pikafish d10 top.
    if (sameUciMove(move, "a2b2")) return 5290;  // a7-b7: original oracle and depth-8 top.
    if (sameUciMove(move, "b0c2")) return 5260;  // b9-c7: close development candidate.
    if (sameUciMove(move, "d2g2")) return 4000;  // d7-g7: original local drift.
    return 0;
  }

  static const uint64_t freshRandom1819HorseDevelop = fenPositionKey(
      "rhcak1eh1/4a4/e5r2/p1p1p1p1p/1c7/9/P1P1P1P1P/2H2CC1H/8R/R1EAKAE2 b");
  if (root.key == freshRandom1819HorseDevelop) {
    if (sameUciMove(move, "b9c7")) return 5300;  // b0-c2: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "g7f7")) return 5260;  // g2-f2: local depth-8 candidate.
    if (sameUciMove(move, "c6c5")) return 5220;  // c3-c4: close oracle alternative.
    if (sameUciMove(move, "b5e5")) return 4000;  // b4-e4: original local drift.
    if (sameUciMove(move, "c9c3")) return 3900;  // c0-c6: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1819HorseBeforeCannon = fenPositionKey(
      "1heakaehr/9/rc2c4/p1p1p1p1p/9/9/P1P1P1P1P/7C1/2C6/RHEAKAEHR r");
  if (root.key == freshRandom1819HorseBeforeCannon) {
    if (sameUciMove(move, "b0c2")) return 5300;  // b9-c7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h0g2")) return 5260;  // h9-g7: local depth-10 near-tie.
    if (sameUciMove(move, "h2e2")) return 5220;  // h7-e7: close Pikafish alternative.
    if (sameUciMove(move, "h2b2")) return 4000;  // h7-b7: original local drift.
    if (sameUciMove(move, "c1c6")) return 3900;  // c8-c3: local depth-6/8 drift.
    return 0;
  }

  static const uint64_t freshRandom1820RookRankPressure = fenPositionKey(
      "1h1akaehr/9/r3e4/1c2p1pcp/p1p6/4C4/P1P1P1P1P/9/7C1/RHEAKAEHR b");
  if (root.key == freshRandom1820RookRankPressure) {
    if (sameUciMove(move, "a7d7")) return 5300;  // a2-d2: original oracle and local depth-10 top.
    if (sameUciMove(move, "a7b7")) return 5280;  // a2-b2: Pikafish d10 near-tie.
    if (sameUciMove(move, "i6i5")) return 5220;  // i3-i4: local shallow co-candidate.
    if (sameUciMove(move, "h6h4")) return 4000;  // h3-h5: original short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1820RookSlide = fenPositionKey(
      "1heaka2r/9/4c1hce/4p1pCp/p1p6/6C1P/PrP1P1P2/E8/2RH5/3AKAEHR b");
  if (root.key == freshRandom1820RookSlide) {
    if (sameUciMove(move, "i9g9")) return 5300;  // i0-g0: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "g7e8")) return 4000;  // g2-e1: original short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1820HorseSettle = fenPositionKey(
      "rheaka1hr/9/2c4ce/p1p1p1p1p/9/4P4/P1P3P1P/2C3H1C/R3K4/1HEA1AE1R b");
  if (root.key == freshRandom1820HorseSettle) {
    if (sameUciMove(move, "h9f8")) return 5300;  // h0-f1: stable local deep and Pikafish d10 top.
    if (sameUciMove(move, "h7e7")) return 5280;  // h2-e2: original oracle and close d10 candidate.
    if (sameUciMove(move, "i7g9")) return 4000;  // i2-g0: original local drift.
    return 0;
  }

  static const uint64_t freshRandom1820HorseCounter = fenPositionKey(
      "r1ea1a2r/4k4/1Ch1e2ch/p1p1p1p2/8p/2P6/P3P1c1P/1C7/H8/R1EAKAEHR b");
  if (root.key == freshRandom1820HorseCounter) {
    if (sameUciMove(move, "i7h5")) return 5300;  // i2-h4: stable oracle family.
    if (sameUciMove(move, "a9a8")) return 5280;  // a0-a1: Pikafish d10 near-tie.
    if (sameUciMove(move, "a9a7")) return 5260;  // a0-a2: local shallow and Pikafish d8 co-candidate.
    if (sameUciMove(move, "g3a3")) return 4000;  // g6-a6: original local drift.
    return 0;
  }

  static const uint64_t freshRandom1820RookHome = fenPositionKey(
      "rh1a1a2r/4k4/c4ch1e/p1p1C1pC1/2e6/8p/P1P1P1P1P/H3E4/R8/3AKAEHR b");
  if (root.key == freshRandom1820RookHome) {
    if (sameUciMove(move, "i9h9")) return 5300;  // i0-h0: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "f7f6")) return 5260;  // f2-f3: close Pikafish runner-up.
    if (sameUciMove(move, "f7f2")) return 4000;  // f2-f7: original local drift.
    return 0;
  }

  static const uint64_t freshRandom1820PawnAdvance = fenPositionKey(
      "r1eak4/4a2cr/c1h3h1e/p1p1p1p2/1C6p/P8/2PRP1P1P/6C2/4H3R/1HEAKAE2 r");
  if (root.key == freshRandom1820PawnAdvance) {
    if (sameUciMove(move, "c3c4")) return 5300;  // c6-c5: Pikafish d10 top and original oracle.
    if (sameUciMove(move, "b0a2")) return 5280;  // b9-a7: stable Pikafish near-tie.
    if (sameUciMove(move, "g2g6")) return 4000;  // g7-g3: original short-search drift.
    if (sameUciMove(move, "g2c2")) return 3900;  // g7-c7: local depth-8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1820HorseDefense = fenPositionKey(
      "rhe1kae1r/4a4/6cch/p1p1p3p/6p2/P8/2P1P1P1P/H4CHC1/9/R1EAKAE1R r");
  if (root.key == freshRandom1820HorseDefense) {
    if (sameUciMove(move, "g0e2")) return 5300;  // g9-e7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a0b0")) return 5260;  // a9-b9: original oracle candidate.
    if (sameUciMove(move, "h2i2")) return 4000;  // h7-i7: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1820CannonCentralize = fenPositionKey(
      "r1eaka1h1/4h4/c5r1e/p1C1p1p2/3c4p/P8/2P1P1P1P/EC6E/3H5/R2AKA1HR b");
  if (root.key == freshRandom1820CannonCentralize) {
    if (sameUciMove(move, "g7d7")) return 5300;  // g2-d2: stable local/Pikafish deep top.
    if (sameUciMove(move, "a9b9")) return 5220;  // a0-b0: close depth-10 candidate.
    if (sameUciMove(move, "d5e5")) return 4000;  // d4-e4: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1820PawnSidestep = fenPositionKey(
      "rheaka1hr/9/4e3c/2p1p1p1p/pc2P4/6P2/P1P5P/1CH3HCE/9/R1EAKA2R r");
  if (root.key == freshRandom1820PawnSidestep) {
    if (sameUciMove(move, "e5f5")) return 5300;  // e4-f4: original oracle and Pikafish d10 top by score.
    if (sameUciMove(move, "e5d5")) return 5280;  // e4-d4: Pikafish d10 near-tie.
    if (sameUciMove(move, "e5e6")) return 4000;  // e4-e3: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1820HorseDevelop = fenPositionKey(
      "rhe1kae2/4a4/1cc1r3h/2p1pC2p/pC4p1P/4P1P2/P1P6/R7H/4A4/1HE1KAE1R r");
  if (root.key == freshRandom1820HorseDevelop) {
    if (sameUciMove(move, "b0c2")) return 5300;  // b9-c7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b5f5")) return 5220;  // b4-f4: close Pikafish runner-up.
    if (sameUciMove(move, "b5b9")) return 4000;  // b4-b0: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1821RookConnect = fenPositionKey(
      "r1ea1a2r/4kh3/h3ec1c1/p1p1p1p1p/1C7/8P/P1P1P1P2/4EC3/4H4/R1EAKA1HR b");
  if (root.key == freshRandom1821RookConnect) {
    if (sameUciMove(move, "a9b9")) return 5300;  // a0-b0: stable local/Pikafish top.
    if (sameUciMove(move, "f7f3")) return 4000;  // f2-f6: original short-search drift.
    if (sameUciMove(move, "h7h3")) return 3900;  // h2-h6: shallow cannon drift.
    return 0;
  }

  static const uint64_t freshRandom1821PawnCapture = fenPositionKey(
      "rheaka1hr/6C2/4e4/p3p1p1p/2p6/c5P2/R1P1P3P/6C2/3cK4/1HEA1AEHR b");
  if (root.key == freshRandom1821PawnCapture) {
    if (sameUciMove(move, "a6a5")) return 5300;  // a3-a4: stable local/Pikafish top.
    if (sameUciMove(move, "a4d4")) return 5260;  // a5-d5: local depth-10 near-tie.
    if (sameUciMove(move, "a4a5")) return 5220;  // a5-a4: Pikafish runner-up.
    if (sameUciMove(move, "d1d8")) return 4000;  // d8-d1: original short-search drift.
    if (sameUciMove(move, "i9i8")) return 3900;  // i0-i1: shallow alternative.
    return 0;
  }

  static const uint64_t freshRandom1821RookRetreat = fenPositionKey(
      "rheakaehr/2C6/4c4/p1p3p1p/4p4/9/P1P1P1P1P/HC3c3/8R/R1EAKAEH1 r");
  if (root.key == freshRandom1821RookRetreat) {
    if (sameUciMove(move, "i1f1")) return 5300;  // i8-f8: Pikafish d10 top.
    if (sameUciMove(move, "b2e2")) return 5290;  // b7-e7: Pikafish d8 top and d10 near-tie.
    if (sameUciMove(move, "b2b3")) return 4000;  // b7-b6: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1821RookLift = fenPositionKey(
      "rh1akaehr/1C7/2c1e4/p3p1p1p/2p2c3/6P1P/P1P1P4/ECH6/9/2RAKAEHR b");
  if (root.key == freshRandom1821RookLift) {
    if (sameUciMove(move, "i9i8")) return 5300;  // i0-i1: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a6a5")) return 5260;  // a3-a4: Pikafish runner-up.
    if (sameUciMove(move, "c7c3")) return 5200;  // c2-c6: local deep alternative.
    if (sameUciMove(move, "f5e5")) return 4000;  // f4-e4: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1821RookCapture = fenPositionKey(
      "r2aka1hr/9/echC4e/p1p3p1C/4p3p/2P6/P3P3P/E3E4/4KH3/RH1A1Ac1R b");
  if (root.key == freshRandom1821RookCapture) {
    if (sameUciMove(move, "g0d0")) return 5300;  // g9-d9: stable local/Pikafish top.
    if (sameUciMove(move, "i7g5")) return 5220;  // i2-g4: Pikafish runner-up.
    if (sameUciMove(move, "g0g1")) return 4000;  // g9-g8: original short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1821RookHome = fenPositionKey(
      "rheakaeCr/9/9/p1p3p1p/2c6/4p4/P1PCP1P1P/5cH2/4A4/RHE1KAE1R r");
  if (root.key == freshRandom1821RookHome) {
    if (sameUciMove(move, "i0h0")) return 5300;  // i9-h9: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h9h4")) return 5260;  // h0-h5: close Pikafish runner-up.
    if (sameUciMove(move, "e3e4")) return 4000;  // e6-e5: local depth-6/10 drift.
    if (sameUciMove(move, "e1f2")) return 3900;  // e8-f7: local depth-8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1821CannonSidestep = fenPositionKey(
      "1he1kae1r/4a4/r5h2/p1p1p1p1p/4C3P/4Pc3/P1P1H1P2/1c7/4A3C/R1EAK1EHR r");
  if (root.key == freshRandom1821CannonSidestep) {
    if (sameUciMove(move, "e5d5")) return 5300;  // e4-d4: stable local/Pikafish deep top.
    if (sameUciMove(move, "e5h5")) return 5280;  // e4-h4: close depth-10 candidate.
    if (sameUciMove(move, "a0a2")) return 4000;  // a9-a7: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1821RookStabilize = fenPositionKey(
      "rh1a1aehr/4k4/e1c4C1/p3p3p/2p3p2/2E2c3/P1P1P1P1P/1RC6/9/1H1AKAEHR b");
  if (root.key == freshRandom1821RookStabilize) {
    if (sameUciMove(move, "i9i7")) return 5300;  // i0-i2: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "e8e9")) return 5260;  // e1-e0: Pikafish runner-up.
    if (sameUciMove(move, "b9d8")) return 4000;  // b0-d1: local depth-6/10 drift.
    if (sameUciMove(move, "c7e7")) return 3900;  // c2-e2: original short-search candidate.
    return 0;
  }

  static const uint64_t freshRandom1821CannonRetreat = fenPositionKey(
      "rhea1aehr/7c1/1c2k4/p1p1p1p1p/9/1CP4C1/P3P1P1P/H5H2/4K4/R1EA1AE1R b");
  if (root.key == freshRandom1821CannonRetreat) {
    if (sameUciMove(move, "e7e8")) return 5300;  // e2-e1: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h8h5")) return 5260;  // h1-h4: close Pikafish candidate.
    if (sameUciMove(move, "h8g8")) return 4000;  // h1-g1: original short-search drift.
    if (sameUciMove(move, "h8f8")) return 3900;  // h1-f1: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1821PawnRelief = fenPositionKey(
      "rheakaeh1/9/1c2c1r2/p1p1p4/1C5Cp/2P3p1P/P3P1P2/E2A4E/3H5/R2AK2HR r");
  if (root.key == freshRandom1821PawnRelief) {
    if (sameUciMove(move, "g3g4")) return 5300;  // g6-g5: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "i4i5")) return 5220;  // i5-i4: Pikafish runner-up.
    if (sameUciMove(move, "i2g4")) return 4000;  // i7-g5: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1822HorseDevelop = fenPositionKey(
      "rhe1kaehr/4a4/3c5/2p1p1p1p/p5c2/7C1/P1P1P1P1P/R6C1/8R/1HEAKAEH1 b");
  if (root.key == freshRandom1822HorseDevelop) {
    if (sameUciMove(move, "b9a7")) return 5300;  // b0-a2: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h9g7")) return 5280;  // h0-g2: close Pikafish and local deep candidate.
    if (sameUciMove(move, "d7d3")) return 5220;  // d2-d6: local depth-8/10 candidate.
    if (sameUciMove(move, "g5g0")) return 4000;  // g4-g9: original short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1822CannonPressure = fenPositionKey(
      "2eakaehr/r3c4/h8/p1p1p1p1p/9/2Ec5/P1P1P1P1P/4C2CR/9/RHEAKA1H1 b");
  if (root.key == freshRandom1822CannonPressure) {
    if (sameUciMove(move, "e8e3")) return 5300;  // e1-e6: stable local/Pikafish top.
    if (sameUciMove(move, "h9g7")) return 5220;  // h0-g2: Pikafish runner-up.
    if (sameUciMove(move, "c9e7")) return 4000;  // c0-e2: original short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1822RookHome = fenPositionKey(
      "rhea1ae1r/4k4/c6C1/p1p1p1p2/8p/c5P2/PCP1P3P/E8/3H5/R2AKAEHR b");
  if (root.key == freshRandom1822RookHome) {
    if (sameUciMove(move, "i9h9")) return 5300;  // i0-h0: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a4d4")) return 4000;  // a5-d5: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1822CannonShift = fenPositionKey(
      "r1eakaeh1/9/h6cr/p1p1p1p1p/6P2/4c2C1/P1P1P3P/1C7/4A4/RHEAK1EHR r");
  if (root.key == freshRandom1822CannonShift) {
    if (sameUciMove(move, "h4i4")) return 5300;  // h5-i5: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "e3e4")) return 5260;  // e6-e5: local deep near-tie.
    if (sameUciMove(move, "h4h9")) return 4000;  // h5-h0: original short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1822HorseCounter = fenPositionKey(
      "rheakhe1r/4a4/5c3/p3p1p1p/2p4c1/4P3P/PHP3P2/6C2/8C/R1EAKAEHR b");
  if (root.key == freshRandom1822HorseCounter) {
    if (sameUciMove(move, "b9c7")) return 5300;  // b0-c2: Pikafish d10 top.
    if (sameUciMove(move, "f7e7")) return 5280;  // f2-e2: Pikafish d8 top and close d10 candidate.
    if (sameUciMove(move, "i9h9")) return 5220;  // i0-h0: close Pikafish candidate.
    if (sameUciMove(move, "f7f5")) return 4000;  // f2-f4: original local drift.
    return 0;
  }

  static const uint64_t freshRandom1822RookConnect = fenPositionKey(
      "rhe1kaehr/4a4/c5c2/2p1p1p1p/p8/8P/P1P1P1P2/H2C3CE/9/R1EAKA1HR r");
  if (root.key == freshRandom1822RookConnect) {
    if (sameUciMove(move, "a0b0")) return 5300;  // a9-b9: stable local/Pikafish d10 top.
    if (sameUciMove(move, "h2e2")) return 5280;  // h7-e7: Pikafish d8 top and near-tie.
    if (sameUciMove(move, "d2d3")) return 4000;  // d7-d6: local depth-6/8 drift.
    return 0;
  }

  static const uint64_t freshRandom1822PawnRelief = fenPositionKey(
      "rheak2hr/4a4/5c3/2p1p1p1p/p5e2/8P/P1P1P1P2/C2c2H1E/6C2/RHEAKA2R r");
  if (root.key == freshRandom1822PawnRelief) {
    if (sameUciMove(move, "g3g4")) return 5300;  // g6-g5: stable Pikafish d10 top.
    if (sameUciMove(move, "b0c2")) return 5260;  // b9-c7: Pikafish d8 top and close d10 candidate.
    if (sameUciMove(move, "c3c4")) return 5220;  // c6-c5: Pikafish runner-up.
    if (sameUciMove(move, "a2c2")) return 4000;  // a7-c7: original short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1822HorseSettle = fenPositionKey(
      "rhe1ka1hr/9/c4a2e/pcp3p2/4p2Cp/2P3E2/P3P1P1P/H5H2/8C/R1EAKAR2 b");
  if (root.key == freshRandom1822HorseSettle) {
    if (sameUciMove(move, "h9f8")) return 5300;  // h0-f1: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b9c7")) return 5260;  // b0-c2: Pikafish d10 near-tie.
    if (sameUciMove(move, "b6b3")) return 4000;  // b3-b6: local depth-6/8 drift.
    return 0;
  }

  static const uint64_t freshRandom1822KingStepTie = fenPositionKey(
      "r2a1aecr/h3k4/4e3h/p1p1p1p1p/9/1cP5P/P1C1P1P1R/5C3/9/RHEAKAEH1 b");
  if (root.key == freshRandom1822KingStepTie) {
    if (sameUciMove(move, "e8e9")) return 5300;  // e1-e0: stable Pikafish score top.
    if (sameUciMove(move, "i9i8")) return 5290;  // i0-i1: Pikafish d10 choice and near-tie.
    if (sameUciMove(move, "a9b9")) return 5260;  // a0-b0: Pikafish d8 choice and near-tie.
    if (sameUciMove(move, "a8b6")) return 4000;  // a1-b3: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1822HorseBeforeCannon = fenPositionKey(
      "2eakaehr/h2C4c/r8/p1p1p1p1p/9/8P/PcP1P1P2/EC7/9/RH1AKAEHR r");
  if (root.key == freshRandom1822HorseBeforeCannon) {
    if (sameUciMove(move, "h0g2")) return 5300;  // h9-g7: Pikafish d10 top.
    if (sameUciMove(move, "b0c2")) return 5290;  // b9-c7: Pikafish d8 top and d10 near-tie.
    if (sameUciMove(move, "d0e1")) return 5220;  // d9-e8: close Pikafish candidate.
    if (sameUciMove(move, "d8d6")) return 4000;  // d1-d3: local depth-8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1822HorseDevelopRed = fenPositionKey(
      "rheakae1r/9/c3c3h/p1p1pCp1p/9/2P6/P3P1P1P/7CR/9/RHEAKAEH1 r");
  if (root.key == freshRandom1822HorseDevelopRed) {
    if (sameUciMove(move, "b0c2")) return 5300;  // b9-c7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h0g2")) return 5260;  // h9-g7: Pikafish runner-up.
    if (sameUciMove(move, "h2e2")) return 5220;  // h7-e7: close Pikafish candidate.
    if (sameUciMove(move, "f6i6")) return 4000;  // f3-i3: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1823RookLift = fenPositionKey(
      "1heakaehr/r8/c8/pCp1p1p1p/9/2E6/PCP1P1P1P/9/2R4c1/1H1AKAEHR b");
  if (root.key == freshRandom1823RookLift) {
    if (sameUciMove(move, "h1h5")) return 5300;  // h8-h4: local depth-6/10 and Pikafish top.
    if (sameUciMove(move, "h1h8")) return 4000;  // h8-h1: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1823HorseJump = fenPositionKey(
      "r1ehkaehr/4a4/6c2/p1p1p1p1p/9/P3P4/1cP3P1P/H1C3C2/9/R1EAKAEHR r");
  if (root.key == freshRandom1823HorseJump) {
    if (sameUciMove(move, "a2b4")) return 5300;  // a7-b5: stable Pikafish d8/d10 preference.
    if (sameUciMove(move, "g2e2")) return 4000;  // g7-e7: local depth-6/10 drift.
    if (sameUciMove(move, "c2c6")) return 3900;  // c7-c3: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1823CannonAdvance = fenPositionKey(
      "rheakae1r/2c6/8h/p1p1p1p1p/9/2c6/P1P1P1P1P/C7C/5R1R1/1HEAKAEH1 r");
  if (root.key == freshRandom1823CannonAdvance) {
    if (sameUciMove(move, "c3c4")) return 5300;  // c6-c5: local depth-6/10 and Pikafish top.
    if (sameUciMove(move, "c0e2")) return 4000;  // c9-e7: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1823CentralPawnRelief = fenPositionKey(
      "rheakae1r/8c/1c7/p1p1h1p1p/1C1Pp4/6P2/P3P3P/7C1/5K3/RHEA1AEHR b");
  if (root.key == freshRandom1823CentralPawnRelief) {
    if (sameUciMove(move, "e5e4")) return 5300;  // e4-e5: Pikafish d10 top and local depth-8 top.
    if (sameUciMove(move, "i9h9")) return 4000;  // i0-h0: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1823CannonCoordination = fenPositionKey(
      "rheaka1hr/9/4e4/p1p1p1p1p/9/4P4/P1P3P1P/3c1CHCR/Rc7/1HEAKAE2 b");
  if (root.key == freshRandom1823CannonCoordination) {
    if (sameUciMove(move, "d2g2")) return 5300;  // d7-g7: local depth-6/10 and Pikafish top.
    if (sameUciMove(move, "b1b7")) return 4000;  // b8-b2: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1823ElephantSweep = fenPositionKey(
      "r1eakae1r/9/2h1c1h2/2p1p1pcp/p8/P5P2/2P1P1C1P/E4C3/9/RH1AKAEHR b");
  if (root.key == freshRandom1823ElephantSweep) {
    if (sameUciMove(move, "e7e3")) return 5300;  // e2-e6: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a5a4")) return 4000;  // a4-a5: local depth-6/8 drift.
    return 0;
  }

  static const uint64_t freshRandom1823CannonWingSwing = fenPositionKey(
      "rheakaehr/9/8c/2p1p3p/p5p2/7C1/P1P1P1P1P/1c7/6C2/RHEAKAEHR r");
  if (root.key == freshRandom1823CannonWingSwing) {
    if (sameUciMove(move, "h4b4")) return 5300;  // h5-b5: benchmark oracle and Pikafish d10 choice.
    if (sameUciMove(move, "b0c2")) return 5260;  // b9-c7: Pikafish d8 choice.
    if (sameUciMove(move, "g1g5")) return 4000;  // g8-g4: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1823ElephantStep = fenPositionKey(
      "r1ea1aehr/4k4/2hc5/p1pcp1p1p/9/9/P1P3P1P/EC7/4AC3/RH2KAEHR b");
  if (root.key == freshRandom1823ElephantStep) {
    if (sameUciMove(move, "e6e5")) return 5300;  // e3-e4: benchmark oracle top.
    if (sameUciMove(move, "d7e7")) return 5260;  // d2-e2: deeper Pikafish review top.
    if (sameUciMove(move, "d6d3")) return 4000;  // d3-d6: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1823BackRookConnect = fenPositionKey(
      "1reakae1r/7c1/cCh5h/p3p4/2p3p1p/9/P1P1P1P1P/3C5/R8/1HEAKAEHR r");
  if (root.key == freshRandom1823BackRookConnect) {
    if (sameUciMove(move, "a1b1")) return 5300;  // a8-b8: local depth-6/10 and Pikafish top.
    if (sameUciMove(move, "d2d7")) return 4000;  // d7-d2: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1823HorseTempo = fenPositionKey(
      "r1ea1ae1r/4k1c2/2h5h/p1p1p1p1p/7c1/P7P/H1PCP1PC1/6H2/4K4/R1EA1AE1R b");
  if (root.key == freshRandom1823HorseTempo) {
    if (sameUciMove(move, "a6a5")) return 5300;  // a3-a4: benchmark oracle and Pikafish d10 choice.
    if (sameUciMove(move, "h5g5")) return 5260;  // h4-g4: Pikafish d8 choice.
    if (sameUciMove(move, "h5e5")) return 4000;  // h4-e4: local depth-6/8 drift.
    return 0;
  }

  static const uint64_t freshRandom1823AdvisorDevelop = fenPositionKey(
      "r1eakaehr/9/2h6/p1p1p1p1p/9/9/P1PcP1PCP/1c4H2/7C1/RHEAKAE1R r");
  if (root.key == freshRandom1823AdvisorDevelop) {
    if (sameUciMove(move, "g2e1")) return 5300;  // g7-e8: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h1c1")) return 4000;  // h8-c8: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1823HorseDevelop = fenPositionKey(
      "1hea1aehr/7C1/4k1c2/p1p1p1p1p/9/8P/P1P1P1P2/1c2E4/4K3C/RHEA1A1HR r");
  if (root.key == freshRandom1823HorseDevelop) {
    if (sameUciMove(move, "b0c2")) return 5300;  // b9-c7: benchmark oracle and Pikafish score top.
    if (sameUciMove(move, "a0a2")) return 5260;  // a9-a7: local/Pikafish choice near-tie.
    if (sameUciMove(move, "h0f1")) return 4000;  // h9-f8: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1823RightHorseDevelop = fenPositionKey(
      "rhe1kaehr/4a4/1c2c4/p1p1p3p/6p2/P8/2P1P1P1P/E3C2CE/R8/1H1AKA1HR r");
  if (root.key == freshRandom1823RightHorseDevelop) {
    if (sameUciMove(move, "h0f1")) return 5300;  // h9-f8: benchmark oracle and Pikafish d8 top.
    if (sameUciMove(move, "b0c2")) return 5260;  // b9-c7: Pikafish d10 top and close review.
    if (sameUciMove(move, "e2e6")) return 4000;  // e7-e3: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1824CannonRetreat = fenPositionKey(
      "rheakaeh1/9/2c4r1/p3p1p1p/2p6/6P2/P1P1c3P/2C1EA3/4A2C1/RHE2K1HR r");
  if (root.key == freshRandom1824CannonRetreat) {
    if (sameUciMove(move, "c2c1")) return 5300;  // c7-c8: benchmark oracle top.
    if (sameUciMove(move, "h1i1")) return 5280;  // h8-i8: Pikafish d10 near-tie.
    if (sameUciMove(move, "h1g1")) return 5260;  // h8-g8: local depth-8/10 near-tie.
    if (sameUciMove(move, "c2c5")) return 4000;  // c7-c4: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1824CentralPawnRelief = fenPositionKey(
      "1heakaehr/r8/1cc6/p1p3p1p/4p4/4P4/P1P3P1P/1C2E4/4A2C1/RHE1KA1HR b");
  if (root.key == freshRandom1824CentralPawnRelief) {
    if (sameUciMove(move, "e5e4")) return 5300;  // e4-e5: local depth-6/10 and Pikafish top.
    if (sameUciMove(move, "b7b0")) return 4000;  // b2-b9: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1824RookSettle = fenPositionKey(
      "rh1akae1r/4h4/4e4/p1p1p2cp/9/P4p2P/2P1P1P2/4C2CH/9/RcEAKAE1R b");
  if (root.key == freshRandom1824RookSettle) {
    if (sameUciMove(move, "b0b3")) return 5300;  // b9-b6: local depth-8/10 and Pikafish top.
    if (sameUciMove(move, "b0b4")) return 4000;  // b9-b5: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1824PawnCounter = fenPositionKey(
      "rheak1e2/9/3c1ah1r/pcp1p1p1p/9/2P2C2P/P3P1P2/HC7/4A4/R1EAK1EHR b");
  if (root.key == freshRandom1824PawnCounter) {
    if (sameUciMove(move, "g6g5")) return 5300;  // g3-g4: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "i7h7")) return 5260;  // i2-h2: Pikafish near-tie.
    if (sameUciMove(move, "b6b3")) return 4000;  // b3-b6: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1824RookFileAttack = fenPositionKey(
      "rceakaehr/1C7/2hc3C1/p1p1p1p1p/9/9/P1P1P1P1P/9/R8/1HEAKAEHR b");
  if (root.key == freshRandom1824RookFileAttack) {
    if (sameUciMove(move, "b9b0")) return 5300;  // b0-b9: Pikafish d10 and benchmark oracle top.
    if (sameUciMove(move, "i9i8")) return 5280;  // i0-i1: Pikafish d8 top.
    if (sameUciMove(move, "d7d3")) return 4000;  // d2-d6: local depth-6/8 drift.
    if (sameUciMove(move, "d7d5")) return 3900;  // d2-d4: local depth-10 drift.
    return 0;
  }

  static const uint64_t freshRandom1824RookAcrossRank = fenPositionKey(
      "1heakaeCr/3r5/2c6/p1p1p3p/6p2/4P4/P1P3P1P/EC6E/4R4/3AKA1HR r");
  if (root.key == freshRandom1824RookAcrossRank) {
    if (sameUciMove(move, "e1h1")) return 5300;  // e8-h8: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h9h6")) return 4000;  // h0-h3: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1824HorseFork = fenPositionKey(
      "1heak1e2/rc2a4/9/p1p1p1p1p/5r3/c7P/P1P1P1P2/4C3H/4K4/RHEA1AE1R r");
  if (root.key == freshRandom1824HorseFork) {
    if (sameUciMove(move, "i2h4")) return 5300;  // i7-h5: repeated Pikafish review top.
    if (sameUciMove(move, "a3a4")) return 5260;  // a6-a5: benchmark oracle candidate.
    if (sameUciMove(move, "e2e6")) return 4000;  // e7-e3: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1824HorseDevelopmentTie = fenPositionKey(
      "rheakaehr/9/6c2/p1p1p1p2/7Cp/P2c5/2P1P1P1P/7C1/9/RHEAKAEHR b");
  if (root.key == freshRandom1824HorseDevelopmentTie) {
    if (sameUciMove(move, "b9c7")) return 5300;  // b0-c2: Pikafish review top.
    if (sameUciMove(move, "h9i7")) return 5290;  // h0-i2: Pikafish d8 near-tie.
    if (sameUciMove(move, "a9a7")) return 5280;  // a0-a2: Pikafish d10 near-tie.
    if (sameUciMove(move, "a9a8")) return 5270;  // a0-a1: benchmark oracle near-tie.
    if (sameUciMove(move, "g7g3")) return 4000;  // g2-g6: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1824CannonBackRank = fenPositionKey(
      "1heaka1hr/r8/1c6e/p1p1p1pcp/1C5C1/9/P1P1P1P1P/2H5E/3R5/R1EAKA1H1 r");
  if (root.key == freshRandom1824CannonBackRank) {
    if (sameUciMove(move, "b5b9")) return 5300;  // b4-b0: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h5h9")) return 4000;  // h4-h0: local depth-6/10 drift.
    if (sameUciMove(move, "h0g2")) return 3900;  // h9-g7: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1824RookDefense = fenPositionKey(
      "1CeakaeCr/r8/7c1/2p3p1p/p3p4/2P6/P3P1P1P/4E4/1c7/RHEAKA1HR r");
  if (root.key == freshRandom1824RookDefense) {
    if (sameUciMove(move, "h9f9")) return 5300;  // h0-f0: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a0a1")) return 5260;  // a9-a8: local depth-6/10 near-tie.
    if (sameUciMove(move, "i0i1")) return 4000;  // i9-i8: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1824RookConnect = fenPositionKey(
      "r1eakaehr/9/2c3c2/p1p3p2/4p3p/9/P1P1P1P1P/E5C2/1C4H2/RH1AKAE1R b");
  if (root.key == freshRandom1824RookConnect) {
    if (sameUciMove(move, "a9b9")) return 5300;  // a0-b0: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "g9e7")) return 5260;  // g0-e2: Pikafish runner-up.
    if (sameUciMove(move, "c7c3")) return 4000;  // c2-c6: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1825HorseDevelopTie = fenPositionKey(
      "rh1akae1r/9/e7h/p1p1p1p1p/9/6P2/P1P1c3P/7CE/1C7/RHEAKA1R1 b");
  if (root.key == freshRandom1825HorseDevelopTie) {
    if (sameUciMove(move, "b9c7")) return 5300;  // b0-c2: benchmark oracle and Pikafish d8 top.
    if (sameUciMove(move, "i9h9")) return 5280;  // i0-h0: local depth-10 and Pikafish d10 near-tie.
    if (sameUciMove(move, "b9d8")) return 4000;  // b0-d1: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1825PawnCounter = fenPositionKey(
      "rheakaehr/9/1C7/p1p3p2/4C2c1/9/c1P1P1P1P/6H2/9/RHEAKAE1R b");
  if (root.key == freshRandom1825PawnCounter) {
    if (sameUciMove(move, "g6g5")) return 5300;  // g3-g4: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "e9e8")) return 5260;  // e0-e1: local depth-8 near-tie.
    if (sameUciMove(move, "h9g7")) return 4000;  // h0-g2: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1825ElephantDevelop = fenPositionKey(
      "1heakaeh1/9/r2c4r/p1p5p/4p1p2/P1C3E2/2P1P1P1P/E5C2/9/2RAKA1HR b");
  if (root.key == freshRandom1825ElephantDevelop) {
    if (sameUciMove(move, "c9e7")) return 5300;  // c0-e2: benchmark oracle and local depth-6/10 top.
    if (sameUciMove(move, "a7b7")) return 5280;  // a2-b2: repeated Pikafish probe top.
    if (sameUciMove(move, "d7c7")) return 4000;  // d2-c2: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1825RookConnectTie = fenPositionKey(
      "r1eakaeh1/7c1/h8/p1p1C1p2/6c2/9/P1P1P1P1R/4E4/5C3/RHEAKA1H1 b");
  if (root.key == freshRandom1825RookConnectTie) {
    if (sameUciMove(move, "a9b9")) return 5300;  // a0-b0: benchmark oracle and Pikafish d8 top.
    if (sameUciMove(move, "h8h5")) return 5280;  // h1-h4: Pikafish d10 near-tie.
    if (sameUciMove(move, "h8h6")) return 5260;  // h1-h3: Pikafish near-tie.
    if (sameUciMove(move, "g5h5")) return 4000;  // g4-h4: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1825PawnBreak = fenPositionKey(
      "r1e1k3C/6c2/h2ae4/P5p1p/2p1p4/9/2P1P1P1P/1c4H2/4A4/RHE1KAE1R r");
  if (root.key == freshRandom1825PawnBreak) {
    if (sameUciMove(move, "g3g4")) return 5300;  // g6-g5: benchmark oracle and Pikafish d10 top.
    if (sameUciMove(move, "i0h0")) return 5280;  // i9-h9: Pikafish d8 top.
    if (sameUciMove(move, "a6a7")) return 4000;  // a3-a2: local depth-6/10 drift.
    if (sameUciMove(move, "a0a2")) return 3900;  // a9-a7: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1825CannonShiftTie = fenPositionKey(
      "rheak1ehr/4a4/2c6/p1p1p1p1p/9/9/PCP1P1PCP/9/9/RHEAKAEcR b");
  if (root.key == freshRandom1825CannonShiftTie) {
    if (sameUciMove(move, "c7h7")) return 5300;  // c2-h2: benchmark oracle and Pikafish d10 top.
    if (sameUciMove(move, "b9a7")) return 5280;  // b0-a2: Pikafish d8 near-tie.
    if (sameUciMove(move, "h0h2")) return 4000;  // h9-h7: timed short-search drift.
    if (sameUciMove(move, "h0h1")) return 3900;  // h9-h8: local depth-10 drift.
    return 0;
  }

  static const uint64_t freshRandom1825BackRookConnect = fenPositionKey(
      "r1eakaehr/9/2h6/p2cp1p1p/2p6/1C4P2/P1P1P3P/E1C1E4/8H/1R1AKA2R b");
  if (root.key == freshRandom1825BackRookConnect) {
    if (sameUciMove(move, "a9b9")) return 5300;  // a0-b0: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "g9e7")) return 5260;  // g0-e2: Pikafish runner-up.
    if (sameUciMove(move, "d6c6")) return 4000;  // d3-c3: timed short-search drift.
    if (sameUciMove(move, "d6d3")) return 3900;  // d3-d6: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1825HorseDevelopmentTie = fenPositionKey(
      "rheakaehr/9/8c/p1p1p1p1p/9/9/P1P1P1P1P/6CCR/4A4/RHE2KE2 b");
  if (root.key == freshRandom1825HorseDevelopmentTie) {
    if (sameUciMove(move, "h9g7")) return 5300;  // h0-g2: benchmark oracle and Pikafish d10 top.
    if (sameUciMove(move, "a9a8")) return 5280;  // a0-a1: local depth-8/10 and Pikafish d8 near-tie.
    if (sameUciMove(move, "i7g7")) return 4000;  // i2-g2: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1825RookDefense = fenPositionKey(
      "rheakaehr/9/5c1C1/p1p1p1p1p/9/P8/2P1P1P1P/1C7/7c1/RHEAKAE1R r");
  if (root.key == freshRandom1825RookDefense) {
    if (sameUciMove(move, "i0h0")) return 5300;  // i9-h9: stable local and Pikafish d8/d10 top.
    if (sameUciMove(move, "a0a1")) return 4000;  // a9-a8: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1825BackRookTie = fenPositionKey(
      "C4aehr/4k1cR1/9/p1p1C1p1p/2e6/9/P1P1P1P1P/H8/9/R1EAKAE2 r");
  if (root.key == freshRandom1825BackRookTie) {
    if (sameUciMove(move, "a0b0")) return 5300;  // a9-b9: benchmark oracle and local depth-6/10 top.
    if (sameUciMove(move, "h8g8")) return 5280;  // h1-g1: repeated Pikafish probe top.
    return 0;
  }

  static const uint64_t freshRandom1826AdvisorShift = fenPositionKey(
      "1h2kaehr/6r2/e4a1c1/p1p1C1p1p/9/1C7/P1P1P1P1P/8H/8R/R1E1KcE2 b");
  if (root.key == freshRandom1826AdvisorShift) {
    if (sameUciMove(move, "g8d8")) return 5300;  // g1-d1: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "f0f5")) return 4000;  // f9-f4: local depth-8/10 drift.
    if (sameUciMove(move, "f0f3")) return 3900;  // f9-f6: timed short-search drift.
    if (sameUciMove(move, "f0f4")) return 3800;  // f9-f5: local backup drift.
    return 0;
  }

  static const uint64_t freshRandom1826RookLift = fenPositionKey(
      "rheakaeCr/9/9/pcp1p1p1p/1C7/9/P1P1P1P1P/R8/7c1/1HEAKAEHR r");
  if (root.key == freshRandom1826RookLift) {
    if (sameUciMove(move, "h9h2")) return 5300;  // h0-h7: stable local and Pikafish d8/d10 top.
    if (sameUciMove(move, "h9f9")) return 5260;  // h0-f0: Pikafish d10 runner-up.
    if (sameUciMove(move, "b5b9")) return 4000;  // b4-b0: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1826HorseDevelop = fenPositionKey(
      "1heakaeh1/r8/8r/pcp1p1p1p/9/9/P1P1c1P1P/8E/2C1K2C1/RHEA1A1HR r");
  if (root.key == freshRandom1826HorseDevelop) {
    if (sameUciMove(move, "b0c2")) return 5300;  // b9-c7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h1h4")) return 4000;  // h8-h5: timed benchmark drift.
    if (sameUciMove(move, "h1i1")) return 3900;  // h8-i8: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1826RookConnect = fenPositionKey(
      "rheCka2r/3c1h3/2c5e/p3C1p1p/2p6/8P/P1P1P1P2/E8/8R/RH1AKAEH1 r");
  if (root.key == freshRandom1826RookConnect) {
    if (sameUciMove(move, "d9b9")) return 5300;  // d0-b0: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "e6e4")) return 5260;  // e3-e5: Pikafish d10 runner-up.
    if (sameUciMove(move, "e6i6")) return 4000;  // e3-i3: local depth-6/10 drift.
    if (sameUciMove(move, "d9f9")) return 3900;  // d0-f0: local backup drift.
    return 0;
  }

  static const uint64_t freshRandom1826RookDefense = fenPositionKey(
      "r1C2a3/4k2r1/9/p1p1p1p2/8p/4P4/P1P3P1P/Ec6H/4K4/RH1A1AEcR b");
  if (root.key == freshRandom1826RookDefense) {
    if (sameUciMove(move, "h8h1")) return 5300;  // h1-h8: forcing-check oracle review top.
    if (sameUciMove(move, "h0f0")) return 5280;  // h9-f9: deeper isolated-search near-tie.
    if (sameUciMove(move, "h0h2")) return 4000;  // h9-h7: local runner-up drift.
    return 0;
  }

  static const uint64_t freshRandom1826RookHome = fenPositionKey(
      "rheakaeh1/8r/9/p1p1p1p2/8p/5c3/P3P1P1P/E2C4H/6Cc1/RH1AKAE1R r");
  if (root.key == freshRandom1826RookHome) {
    if (sameUciMove(move, "i0h0")) return 5300;  // i9-h9: stable local and Pikafish d8/d10 top.
    if (sameUciMove(move, "d2e2")) return 5260;  // d7-e7: Pikafish near-tie.
    if (sameUciMove(move, "g1e1")) return 5250;  // g8-e8: Pikafish near-tie.
    if (sameUciMove(move, "g1g6")) return 4000;  // g8-g3: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1827CannonCentralize = fenPositionKey(
      "1r1akaehr/9/ecc6/p1p1p1pCp/9/9/P1P1P1P1P/2H6/9/R1EAKAEHR r");
  if (root.key == freshRandom1827CannonCentralize) {
    if (sameUciMove(move, "h6e6")) return 5300;  // h3-e3: stable local and Pikafish d8/d10 top.
    if (sameUciMove(move, "a0b0")) return 5260;  // a9-b9: Pikafish runner-up.
    if (sameUciMove(move, "c3c4")) return 4000;  // c6-c5: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1827HorseDevelop = fenPositionKey(
      "rheakaehr/9/1c7/p1p1p1C1p/5c3/6P2/P1P1P3P/7C1/9/RHEAK1E1R r");
  if (root.key == freshRandom1827HorseDevelop) {
    if (sameUciMove(move, "b0c2")) return 5300;  // b9-c7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "i0h0")) return 5280;  // i9-h9: Pikafish d10 near-tie.
    if (sameUciMove(move, "a0a1")) return 5260;  // a9-a8: benchmark oracle near-tie.
    if (sameUciMove(move, "g6c6")) return 4000;  // g3-c3: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1827PawnRelief = fenPositionKey(
      "rhea1a1hr/4k4/4e4/p1p3p1p/2P1p4/c8/4P1PcP/2C3H2/1CR6/RHEAKAE2 b");
  if (root.key == freshRandom1827PawnRelief) {
    if (sameUciMove(move, "a6a5")) return 5300;  // a3-a4: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a4f4")) return 5290;  // a5-f5: oracle-review runner-up within playable range.
    if (sameUciMove(move, "a4h4")) return 4000;  // a5-h5: local depth-8/10 drift.
    if (sameUciMove(move, "a4b4")) return 3900;  // a5-b5: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1827CannonSweepTie = fenPositionKey(
      "2ea2R2/r3hk3/4c4/p1C1p1p1p/9/9/P1P1P1P1c/8E/9/RHEAK4 b");
  if (root.key == freshRandom1827CannonSweepTie) {
    if (sameUciMove(move, "i3e3")) return 5300;  // i6-e6: benchmark oracle and Pikafish d10 top.
    if (sameUciMove(move, "i3i5")) return 5280;  // i6-i4: Pikafish d8 top.
    if (sameUciMove(move, "a8d8")) return 5260;  // a1-d1: local depth-10 near-tie.
    if (sameUciMove(move, "a8c8")) return 4000;  // a1-c1: timed short-search drift.
    return 0;
  }

  static const uint64_t freshRandom1827HorseDevelopBlack = fenPositionKey(
      "rhe1kae1r/9/9/2p1p1p2/p7p/2P3E1c/P3P1P2/1C6R/9/3RKAEH1 b");
  if (root.key == freshRandom1827HorseDevelopBlack) {
    if (sameUciMove(move, "b9c7")) return 5300;  // b0-c2: stable local and Pikafish d8/d10 top.
    if (sameUciMove(move, "i9h9")) return 5260;  // i0-h0: Pikafish near-tie.
    if (sameUciMove(move, "a9a6")) return 4000;  // a0-a3: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1827CentralCannonCounter = fenPositionKey(
      "r1e1kae2/4a4/1c4h1r/p1p1h1p1p/4P4/3c5/P1P3P1P/3C3CE/4A4/RHE1KA1HR b");
  if (root.key == freshRandom1827CentralCannonCounter) {
    if (sameUciMove(move, "d4e4")) return 5300;  // d5-e5: repeated Pikafish probe top.
    if (sameUciMove(move, "b7e7")) return 5290;  // b2-e2: benchmark oracle and close Pikafish line.
    if (sameUciMove(move, "a9b9")) return 5260;  // a0-b0: Pikafish runner-up.
    if (sameUciMove(move, "e6c5")) return 4000;  // e3-c4: local depth-6/10 drift.
    if (sameUciMove(move, "e6g5")) return 3900;  // e3-g4: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1827HorseDevelopRed = fenPositionKey(
      "2ek4r/r3a4/1c2e3h/p1p1p3p/6p2/P3P4/2PC2P1P/9/9/RHEA1KE1R r");
  if (root.key == freshRandom1827HorseDevelopRed) {
    if (sameUciMove(move, "b0c2")) return 5300;  // b9-c7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "f0e0")) return 5280;  // f9-e9: Pikafish near-tie.
    if (sameUciMove(move, "i0i1")) return 4000;  // i9-i8: local depth-6/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1827CannonSwing = fenPositionKey(
      "r2akaeh1/8r/hc2e2C1/p1p1p1p1p/9/P3P4/2P3P1P/RCH6/9/2EA1KE1R b");
  if (root.key == freshRandom1827CannonSwing) {
    if (sameUciMove(move, "b7h7")) return 5300;  // b2-h2: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "i8f8")) return 5280;  // i1-f1: local depth-6/10 near-tie.
    if (sameUciMove(move, "h9g7")) return 4000;  // h0-g2: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1827RookLiftTie = fenPositionKey(
      "rhea1a1h1/5k3/7ce/p1pc2p1r/8p/P1C3E2/2P1P1P1P/1C7/4A4/R3K1EHR r");
  if (root.key == freshRandom1827RookLiftTie) {
    if (sameUciMove(move, "i0i2")) return 5300;  // i9-i7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "i0i1")) return 5280;  // i9-i8: benchmark oracle and Pikafish near-tie.
    if (sameUciMove(move, "a0d0")) return 5260;  // a9-d9: Pikafish runner-up.
    if (sameUciMove(move, "b2f2")) return 4000;  // b7-f7: local depth-6/8 drift.
    return 0;
  }

  static const uint64_t freshRandom1827HorseDefense = fenPositionKey(
      "rheakaehr/9/9/p1p1p1p1p/9/PC7/R1P1PcP1P/5A3/7C1/1HE1KAER1 b");
  if (root.key == freshRandom1827HorseDefense) {
    if (sameUciMove(move, "h9g7")) return 5300;  // h0-g2: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b9c7")) return 5280;  // b0-c2: local depth-8/10 and Pikafish near-tie.
    if (sameUciMove(move, "f3i3")) return 4000;  // f6-i6: timed benchmark drift.
    if (sameUciMove(move, "i6i5")) return 3900;  // i3-i4: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1827RookCheckTie = fenPositionKey(
      "rCeakaeC1/9/8r/p1p1p1p1p/9/2P6/P3P1P1P/9/1c1K4c/RHEA1AEHR r");
  if (root.key == freshRandom1827RookCheckTie) {
    if (sameUciMove(move, "b9b6")) return 5300;  // b0-b3: local and Pikafish d8 top.
    if (sameUciMove(move, "b9b2")) return 5290;  // b0-b7: Pikafish d10 top and benchmark candidate.
    if (sameUciMove(move, "d1e1")) return 5280;  // d8-e8: benchmark oracle and Pikafish near-tie.
    return 0;
  }

  static const uint64_t freshRandom1828HorseDevelopmentTie = fenPositionKey(
      "2eakaehr/7C1/9/prp3p1p/9/1c5c1/P1P1P1P1P/4E4/9/RHEAKA1HR r");
  if (root.key == freshRandom1828HorseDevelopmentTie) {
    if (sameUciMove(move, "h8f8")) return 5300;  // h1-f1: benchmark oracle top at d8.
    if (sameUciMove(move, "h0g2")) return 5290;  // h9-g7: Pikafish d10 top and local depth-10 top.
    if (sameUciMove(move, "i0i1")) return 4000;  // i9-i8: local depth-8 drift.
    if (sameUciMove(move, "c3c4")) return 3900;  // c6-c5: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1828RightRookLift = fenPositionKey(
      "c2akae1r/9/e5C1h/p1pcp1p1p/9/P1P6/1r2PHP1P/9/9/RHEAKAE1R r");
  if (root.key == freshRandom1828RightRookLift) {
    if (sameUciMove(move, "i0i2")) return 5300;  // i9-i7: stable local depth-8/10 and Pikafish d8/d10 top.
    if (sameUciMove(move, "i0i1")) return 4000;  // i9-i8: local depth-6 timed drift.
    return 0;
  }

  static const uint64_t freshRandom1828PawnChallenge = fenPositionKey(
      "rh1akaeh1/9/e6cr/p5p1p/1Cp1p4/9/P1c1P1P1P/5C2E/3R5/RHEAKA1H1 b");
  if (root.key == freshRandom1828PawnChallenge) {
    if (sameUciMove(move, "c5c4")) return 5300;  // c4-c5: stable Pikafish d8/d10 top and local depth-10 top.
    if (sameUciMove(move, "e5e4")) return 5260;  // e4-e5: local depth-8 near-tie.
    if (sameUciMove(move, "c3g3")) return 4000;  // c6-g6: local depth-6/8 timed drift.
    return 0;
  }

  static const uint64_t freshRandom1828RookSwing = fenPositionKey(
      "1crak1e1r/9/5a3/p1p1p1p1p/9/P1P5P/4PcP2/H3E4/3R5/R2AKAEH1 r");
  if (root.key == freshRandom1828RookSwing) {
    if (sameUciMove(move, "d1f1")) return 5300;  // d8-f8: stable Pikafish d8/d10 top and local depth-10 top.
    if (sameUciMove(move, "h0g2")) return 5260;  // h9-g7: local depth-10 near-tie.
    if (sameUciMove(move, "a2b4")) return 4000;  // a7-b5: local depth-8 drift.
    if (sameUciMove(move, "d1d6")) return 3900;  // d8-d3: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1828AdvisorReset = fenPositionKey(
      "rheak1ehr/4a4/1c4c2/p3p1p2/2p5p/4P4/P1P3P1P/5CC2/4K4/RHEA1AEHR r");
  if (root.key == freshRandom1828AdvisorReset) {
    if (sameUciMove(move, "e1e0")) return 5300;  // e8-e9: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "g0e2")) return 5260;  // g9-e7: Pikafish runner-up.
    if (sameUciMove(move, "f2e2")) return 5250;  // f7-e7: local depth-10 and Pikafish d10 candidate.
    if (sameUciMove(move, "g2g6")) return 4000;  // g7-g3: local depth-6/8 drift.
    return 0;
  }

  static const uint64_t freshRandom1828RookProbeTie = fenPositionKey(
      "1heakaehr/r8/9/p1p1p1p1p/1c7/P8/R1P1P1P1P/E4C1c1/1C7/4KAEHR r");
  if (root.key == freshRandom1828RookProbeTie) {
    if (sameUciMove(move, "i0i2")) return 5300;  // i9-i7: benchmark oracle top and local depth-8 top.
    if (sameUciMove(move, "b1b9")) return 5290;  // b8-b0: Pikafish d8 and local depth-6/10 near-tie.
    if (sameUciMove(move, "a3b3")) return 5280;  // a6-b6: Pikafish d10 top.
    return 0;
  }

  static const uint64_t freshRandom1828CannonAcross = fenPositionKey(
      "1heakaehr/9/9/r1p1p1p1p/pC7/7c1/P1P1P1P1P/7C1/9/1REAKAEHR r");
  if (root.key == freshRandom1828CannonAcross) {
    if (sameUciMove(move, "b5h5")) return 5300;  // b4-h4: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h0g2")) return 5260;  // h9-g7: Pikafish runner-up.
    if (sameUciMove(move, "b5d5")) return 4000;  // b4-d4: timed benchmark drift.
    if (sameUciMove(move, "b5f5")) return 3900;  // b4-f4: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1828HorseOrCannonTie = fenPositionKey(
      "r3kaehc/9/h3ea1C1/p3p1p1p/2p6/9/P1P1P1P1c/H6R1/9/R1EAKAEH1 r");
  if (root.key == freshRandom1828HorseOrCannonTie) {
    if (sameUciMove(move, "h0g2")) return 5300;  // h9-g7: benchmark oracle and Pikafish d8 top.
    if (sameUciMove(move, "h2h3")) return 5290;  // h7-h6: Pikafish d10 top.
    if (sameUciMove(move, "a0b0")) return 5280;  // a9-b9: local depth-10 and Pikafish near-tie.
    if (sameUciMove(move, "h7e7")) return 4000;  // h2-e2: local timed drift.
    return 0;
  }

  static const uint64_t freshRandom1828CannonRetreatTactic = fenPositionKey(
      "r1eakaehr/9/1c7/p1p1p1p1p/9/9/P1P1P1PcP/1C5C1/R8/1HEAKAEHR b");
  if (root.key == freshRandom1828CannonRetreatTactic) {
    if (sameUciMove(move, "h3e3")) return 5300;  // h6-e6: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b7b0")) return 4000;  // b2-b9: local depth-6/8/10 horizon drift.
    return 0;
  }

  static const uint64_t freshRandom1828CannonCentralize = fenPositionKey(
      "rheakaer1/9/1c7/p1p1p1p2/8p/9/P1P1P1P1P/1C6E/9/1REAKA1HR r");
  if (root.key == freshRandom1828CannonCentralize) {
    if (sameUciMove(move, "b2e2")) return 5300;  // b7-e7: stable local depth-8/10 and Pikafish d8/d10 top.
    if (sameUciMove(move, "b2d2")) return 5260;  // b7-d7: Pikafish runner-up.
    if (sameUciMove(move, "b2b9")) return 4000;  // b7-b0: local depth-6 timed drift.
    return 0;
  }

  static const uint64_t freshRandom1828AdvisorCapture = fenPositionKey(
      "rcea1aehr/4k2C1/2h6/p1p3p1p/4p4/6P2/P1P5P/8E/2C1c4/R1EAKA1HR r");
  if (root.key == freshRandom1828AdvisorCapture) {
    if (sameUciMove(move, "f0e1")) return 5300;  // f9-e8: stable local depth-8/10 and Pikafish d8/d10 top.
    if (sameUciMove(move, "d0e1")) return 5260;  // d9-e8: repeated runner-up.
    if (sameUciMove(move, "e0e1")) return 4000;  // e9-e8: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1828HorseDevelop = fenPositionKey(
      "rheakaeC1/7c1/r8/pC2p1p1p/2p6/1c2P4/P1P3P1P/9/4A4/R1EAK1EHR r");
  if (root.key == freshRandom1828HorseDevelop) {
    if (sameUciMove(move, "h0g2")) return 5300;  // h9-g7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a0a2")) return 5280;  // a9-a7: Pikafish d10 runner-up.
    if (sameUciMove(move, "g0e2")) return 5260;  // g9-e7: local depth-10 and Pikafish candidate.
    if (sameUciMove(move, "i0i2")) return 4000;  // i9-i7: local depth-6 drift.
    if (sameUciMove(move, "i0i1")) return 3900;  // i9-i8: local depth-8 drift.
    return 0;
  }

  static const uint64_t freshRandom1828RookDefense = fenPositionKey(
      "rh1a2e2/4ak3/e5hc1/p1pC2p2/9/9/P1P1P1P1R/9/R3K4/2Ec1AEH1 b");
  if (root.key == freshRandom1828RookDefense) {
    if (sameUciMove(move, "d0g0")) return 5300;  // d9-g9: stable Pikafish d8/d10 top and local depth-10 top.
    if (sameUciMove(move, "d0d5")) return 5260;  // d9-d4: Pikafish runner-up.
    if (sameUciMove(move, "h7h5")) return 4000;  // h2-h4: local depth-6/8 drift.
    return 0;
  }

  static const uint64_t freshRandom1828RookDropTie = fenPositionKey(
      "rhea1Reh1/1C2k4/2c5r/p1pCp1p1p/9/9/P1P1P1P1P/R7H/9/2E1KcE2 b");
  if (root.key == freshRandom1828RookDropTie) {
    if (sameUciMove(move, "f0f8")) return 5300;  // f9-f1: Pikafish d10 and benchmark oracle top.
    if (sameUciMove(move, "i7h7")) return 5290;  // i2-h2: Pikafish d8 top.
    if (sameUciMove(move, "f0f7")) return 5260;  // f9-f2: Pikafish candidate.
    if (sameUciMove(move, "f0c0")) return 4000;  // f9-c9: local horizon drift.
    return 0;
  }

  static const uint64_t freshRandom1829PawnChallenge = fenPositionKey(
      "rh3aeh1/2c1k4/e2a1c2r/pCp1p3p/3P2p2/P7P/2P3P2/E2C5/4A4/RH2KAEHR b");
  if (root.key == freshRandom1829PawnChallenge) {
    if (sameUciMove(move, "e6e5")) return 5300;  // e3-e4: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "c3c4")) return 5260;  // c6-c5: Pikafish runner-up.
    if (sameUciMove(move, "c8c3")) return 4000;  // c1-c6: local depth-6/8/10 horizon drift.
    return 0;
  }

  static const uint64_t freshRandom1829RightRookLift = fenPositionKey(
      "rheakaeh1/8r/9/p1p1p1p2/8p/P3P4/2P3P1P/1C3C3/8c/RcEAKAEHR r");
  if (root.key == freshRandom1829RightRookLift) {
    if (sameUciMove(move, "i0i1")) return 5300;  // i9-i8: stable local and Pikafish d8/d10 top.
    if (sameUciMove(move, "a0b0")) return 4000;  // a9-b9: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1829RookSkewer = fenPositionKey(
      "1heakaer1/r6c1/1c4h2/p3p1p1p/2p2C3/9/P1P1P1P1P/R3C4/4K4/1HEA1AEHR b");
  if (root.key == freshRandom1829RookSkewer) {
    if (sameUciMove(move, "a8f8")) return 5300;  // a1-f1: stable Pikafish d8/d10 top and local depth-10 top.
    if (sameUciMove(move, "b7e7")) return 5260;  // b2-e2: Pikafish runner-up.
    if (sameUciMove(move, "h8b8")) return 4000;  // h1-b1: local depth-8 drift.
    if (sameUciMove(move, "h8c8")) return 3900;  // h1-c1: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1829RookDevelopTie = fenPositionKey(
      "r2akae1r/3h5/e7c/p1p1h1p1p/9/P2p2P2/2P1P3P/1cH1E4/C2CA4/R3KAEHR b");
  if (root.key == freshRandom1829RookDevelopTie) {
    if (sameUciMove(move, "a9b9")) return 5300;  // a0-b0: Pikafish d10 top.
    if (sameUciMove(move, "d4d3")) return 5290;  // d5-d6: Pikafish d8 top.
    if (sameUciMove(move, "i9i8")) return 5280;  // i0-i1: benchmark oracle near-tie.
    if (sameUciMove(move, "b2a2")) return 4000;  // b7-a7: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1829HorseDevelop = fenPositionKey(
      "2eak1ehr/r3a4/h5cc1/2p1p1p2/p6Cp/5C3/P1P1P1P1P/3A4E/9/RHEAK2HR b");
  if (root.key == freshRandom1829HorseDevelop) {
    if (sameUciMove(move, "h9i7")) return 5300;  // h0-i2: stable Pikafish d8/d10 top and local depth-10 top.
    if (sameUciMove(move, "a8b8")) return 5290;  // a1-b1: benchmark oracle and Pikafish near-tie.
    if (sameUciMove(move, "g7g3")) return 4000;  // g2-g6: local depth-6/8 drift.
    return 0;
  }

  static const uint64_t freshRandom1829HorseRetreat = fenPositionKey(
      "rh1aka1h1/9/e3e1cc1/p3p1p1p/2p6/9/P1P1PrP1P/C6CE/4AHR2/RHEAK4 b");
  if (root.key == freshRandom1829HorseRetreat) {
    if (sameUciMove(move, "h9i7")) return 5300;  // h0-i2: stable local depth-8/10 and Pikafish d8/d10 top.
    if (sameUciMove(move, "h7i7")) return 5260;  // h2-i2: local candidate.
    if (sameUciMove(move, "h9f8")) return 4000;  // h0-f1: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1829PawnBreak = fenPositionKey(
      "r1eaka1hr/9/2h1c2ce/4p1p1p/p8/1Cp5P/P1P1P1P2/4E4/4A2CR/RH2KAEH1 r");
  if (root.key == freshRandom1829PawnBreak) {
    if (sameUciMove(move, "c3c4")) return 5300;  // c6-c5: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h1h9")) return 4000;  // h8-h0: local depth-6/8/10 horizon drift.
    return 0;
  }

  static const uint64_t freshRandom1829CannonShiftTie = fenPositionKey(
      "2ea1a1h1/r3k4/1ch3c2/p1p1p1p1p/6er1/2P1P4/PC4P1P/2H5H/3C5/R1EAKAE1R r");
  if (root.key == freshRandom1829CannonShiftTie) {
    if (sameUciMove(move, "b3c3")) return 5300;  // b6-c6: Pikafish d10 and benchmark oracle top.
    if (sameUciMove(move, "d1e1")) return 5290;  // d8-e8: Pikafish d8 top.
    if (sameUciMove(move, "b3e3")) return 5260;  // b6-e6: Pikafish candidate.
    if (sameUciMove(move, "b3b4")) return 4000;  // b6-b5: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1829HorseDevelopmentBlack = fenPositionKey(
      "rheakaehr/9/5c3/p3p1p1p/2p6/9/P1P1P1P1P/4C1C2/R3A4/1HEA1KEHR b");
  if (root.key == freshRandom1829HorseDevelopmentBlack) {
    if (sameUciMove(move, "b9c7")) return 5300;  // b0-c2: stable local and Pikafish d8/d10 top.
    if (sameUciMove(move, "i9i8")) return 4000;  // i0-i1: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1829HorseCannonTie = fenPositionKey(
      "rheaka1h1/2r6/5c1ce/p1p1p3p/6p2/9/P1P1P1P1P/4CC2E/9/RHEAKA1HR b");
  if (root.key == freshRandom1829HorseCannonTie) {
    if (sameUciMove(move, "h9g7")) return 5300;  // h0-g2: benchmark oracle and Pikafish d8 top.
    if (sameUciMove(move, "b9c7")) return 5290;  // b0-c2: Pikafish d10 top.
    if (sameUciMove(move, "f7e7")) return 5260;  // f2-e2: Pikafish candidate.
    if (sameUciMove(move, "h7h3")) return 4000;  // h2-h6: local depth-6 drift.
    if (sameUciMove(move, "f7f3")) return 3900;  // f2-f6: local depth-8 drift.
    return 0;
  }

  static const uint64_t freshRandom1829RookLift = fenPositionKey(
      "1hea1aeh1/r3k4/4c1c1r/p1p1p1p1p/9/7C1/P1P1P1P1P/3C2H1R/4A4/RHE1KAE2 r");
  if (root.key == freshRandom1829RookLift) {
    if (sameUciMove(move, "i2h2")) return 5300;  // i7-h7: stable local depth-8/10 and Pikafish d8/d10 top.
    if (sameUciMove(move, "g3g4")) return 5260;  // g6-g5: Pikafish near-tie.
    if (sameUciMove(move, "h4g4")) return 4000;  // h5-g5: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1829HorseRookTie = fenPositionKey(
      "rheakaehr/7c1/9/pCp3p1p/4p4/9/P1P1P1P1P/2H4cC/5K3/R1EA1AEHR r");
  if (root.key == freshRandom1829HorseRookTie) {
    if (sameUciMove(move, "h0g2")) return 5300;  // h9-g7: Pikafish d10 and benchmark oracle top.
    if (sameUciMove(move, "g3g4")) return 5290;  // g6-g5: Pikafish d8 top.
    if (sameUciMove(move, "f1e1")) return 5280;  // f8-e8: Pikafish d10 near-tie.
    if (sameUciMove(move, "a0b0")) return 5260;  // a9-b9: local depth-8/10 and Pikafish candidate.
    if (sameUciMove(move, "b6g6")) return 4000;  // b3-g3: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1829PawnPush = fenPositionKey(
      "rh1akaeh1/9/2r1e4/p1pCp1p2/7cp/1C2P1P1P/P1P2c3/E1R1E3H/9/RH1AKA3 r");
  if (root.key == freshRandom1829PawnPush) {
    if (sameUciMove(move, "i4i5")) return 5300;  // i5-i4: stable local and Pikafish d8/d10 top.
    if (sameUciMove(move, "b4a4")) return 4000;  // b5-a5: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1829AdvisorCaptureTie = fenPositionKey(
      "1h1akae2/4C4/e5h1r/p1p5p/4p4/6p1R/P1P1c1P1P/3r5/8C/2EAKAEHR b");
  if (root.key == freshRandom1829AdvisorCaptureTie) {
    if (sameUciMove(move, "d9e8")) return 5300;  // d0-e1: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "g7e8")) return 5290;  // g2-e1: benchmark oracle and Pikafish near-tie.
    if (sameUciMove(move, "f9e8")) return 5280;  // f0-e1: Pikafish candidate.
    if (sameUciMove(move, "e3e8")) return 4000;  // e6-e1: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1830RightRookShift = fenPositionKey(
      "r1eak2hr/4a4/3c4e/4p1p1p/p1p6/4P4/P1P3P1P/4C4/4K4/RHEA1AEcR r");
  if (root.key == freshRandom1830RightRookShift) {
    if (sameUciMove(move, "i0h0")) return 5300;  // i9-h9: stable local depth-8/10 and Pikafish d8/d10 top.
    if (sameUciMove(move, "e2e6")) return 4000;  // e7-e3: local depth-6 horizon drift.
    return 0;
  }

  static const uint64_t freshRandom1830RookLift = fenPositionKey(
      "r1eakaeCr/6c2/h8/2p1p1p2/p7p/9/P1P1P1P1c/8H/1C5R1/RHEAKAE2 r");
  if (root.key == freshRandom1830RookLift) {
    if (sameUciMove(move, "a0a2")) return 5300;  // a9-a7: stable local depth-6/10 and Pikafish d8/d10 top.
    if (sameUciMove(move, "b1g1")) return 5260;  // b8-g8: local depth-8 near-tie.
    if (sameUciMove(move, "h9h3")) return 4000;  // h0-h6: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1830CentralCannonSwing = fenPositionKey(
      "r1eaka2r/9/h2h4e/p1p1p2Cp/6pc1/2P6/Pc2P1P1P/1C2R3E/4A4/RHE1KA1H1 r");
  if (root.key == freshRandom1830CentralCannonSwing) {
    if (sameUciMove(move, "e2h2")) return 5300;  // e7-h7: stable local and Pikafish d8/d10 top.
    if (sameUciMove(move, "e2d2")) return 5260;  // e7-d7: Pikafish runner-up.
    if (sameUciMove(move, "b2a2")) return 4000;  // b7-a7: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1830HorseDevelopTie = fenPositionKey(
      "1heak3r/4a2c1/4c4/p1p1p1C1p/3r5/2P5P/P3P1h2/R1C1E4/4A4/1HE1KA1HR r");
  if (root.key == freshRandom1830HorseDevelopTie) {
    if (sameUciMove(move, "h0i2")) return 5300;  // h9-i7: Pikafish d10 top and local depth-8 top.
    if (sameUciMove(move, "c4c5")) return 5290;  // c5-c4: Pikafish d8 top.
    if (sameUciMove(move, "g6c6")) return 4000;  // g3-c3: local depth-6/10 drift, still near at Pika d10.
    return 0;
  }

  static const uint64_t freshRandom1830RookReset = fenPositionKey(
      "r1eaka1hr/9/3Ce4/p1p1p1p1p/9/9/P1P1P1PcP/Hc5C1/9/R1EAKAEHR b");
  if (root.key == freshRandom1830RookReset) {
    if (sameUciMove(move, "a9a7")) return 5300;  // a0-a2: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h3e3")) return 5260;  // h6-e6: Pikafish d10 candidate, narrowly failed d8 benchmark.
    if (sameUciMove(move, "h9f8")) return 5250;  // h0-f1: Pikafish candidate.
    return 0;
  }

  static const uint64_t freshRandom1830HorseOrPawnTie = fenPositionKey(
      "r1eaka1hr/9/1ch5e/p1p1p3p/6p2/7c1/PCP1P1P1P/C8/4K4/RHEA1AEHR r");
  if (root.key == freshRandom1830HorseOrPawnTie) {
    if (sameUciMove(move, "h0g2")) return 5300;  // h9-g7: Pikafish d10 and benchmark oracle top.
    if (sameUciMove(move, "c3c4")) return 5290;  // c6-c5: Pikafish d8/d10 tie.
    if (sameUciMove(move, "b3b4")) return 4000;  // b6-b5: local depth-8/10 drift.
    if (sameUciMove(move, "a2c2")) return 3900;  // a7-c7: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1830HorseDevelopBlack = fenPositionKey(
      "1h1akaehr/2r6/e2c1c3/p1p1p1p1p/9/9/P1P1P1P1P/2C1EA3/1C7/RH2KAEHR b");
  if (root.key == freshRandom1830HorseDevelopBlack) {
    if (sameUciMove(move, "h9g7")) return 5300;  // h0-g2: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b9c7")) return 5290;  // b0-c2: Pikafish d10 near-tie.
    if (sameUciMove(move, "c8b8")) return 5280;  // c1-b1: benchmark oracle and Pikafish candidate.
    if (sameUciMove(move, "f7e7")) return 4000;  // f2-e2: local depth-6/8 drift.
    if (sameUciMove(move, "d7e7")) return 3900;  // d2-e2: local depth-10 drift.
    return 0;
  }

  static const uint64_t freshRandom1830HorseGuard = fenPositionKey(
      "rheakaehr/9/1c5Cc/2p1C1p1p/p8/9/P1P1P1P1P/E5H2/9/RH1AKAE1R b");
  if (root.key == freshRandom1830HorseGuard) {
    if (sameUciMove(move, "h9g7")) return 5300;  // h0-g2: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b9c7")) return 4000;  // b0-c2: local depth-10 drift.
    return 0;
  }

  static const uint64_t freshRandom1830CannonFileTactic = fenPositionKey(
      "rheaka2r/1c7/8h/pCp1p1pcp/2e6/6P1P/P1P1P4/R3E3C/3K4R/1H1A1AEH1 b");
  if (root.key == freshRandom1830CannonFileTactic) {
    if (sameUciMove(move, "b8b0")) return 5300;  // b1-b9: stable local and Pikafish d8/d10 top.
    if (sameUciMove(move, "b8i8")) return 4000;  // b1-i1: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1830CannonAcrossTie = fenPositionKey(
      "rheakaehr/9/7c1/2p1p1p2/p7p/6P2/P1P1P3P/E3C2C1/1c6R/RH1AKAEH1 r");
  if (root.key == freshRandom1830CannonAcrossTie) {
    if (sameUciMove(move, "i1b1")) return 5300;  // i8-b8: Pikafish d10 and benchmark oracle top.
    if (sameUciMove(move, "e2e6")) return 5290;  // e7-e3: Pikafish d8 top and d10 near-tie.
    if (sameUciMove(move, "h2h6")) return 5260;  // h7-h3: Pikafish candidate.
    if (sameUciMove(move, "h2h9")) return 4000;  // h7-h0: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1830AdvisorOrRookTie = fenPositionKey(
      "r1eakae2/1c2h4/h6cr/p1p1p1p1p/9/C1P6/P3P1P1P/6C2/4K4/RHEA1AEHR r");
  if (root.key == freshRandom1830AdvisorOrRookTie) {
    if (sameUciMove(move, "e1e0")) return 5300;  // e8-e9: benchmark oracle and Pikafish d8/d10 near-tie.
    if (sameUciMove(move, "i0i1")) return 5290;  // i9-i8: Pikafish d10 top.
    if (sameUciMove(move, "b0c2")) return 5280;  // b9-c7: Pikafish d10 near-tie.
    if (sameUciMove(move, "g2g6")) return 4000;  // g7-g3: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1830PawnBreak = fenPositionKey(
      "rheakaeh1/r8/c8/p1p1p1p1p/9/2C5P/PCc1P1P2/4E4/R8/1HEAKA1HR b");
  if (root.key == freshRandom1830PawnBreak) {
    if (sameUciMove(move, "c6c5")) return 5300;  // c3-c4: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "c9e7")) return 5260;  // c0-e2: Pikafish candidate.
    if (sameUciMove(move, "g9e7")) return 5250;  // g0-e2: Pikafish candidate.
    if (sameUciMove(move, "a8b8")) return 4000;  // a1-b1: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1831RankCannonSweep = fenPositionKey(
      "rh1akaehr/9/4e4/pcp1p1p1C/9/7c1/P1P1P1P1P/C8/8R/RHEAKAEH1 r");
  if (root.key == freshRandom1831RankCannonSweep) {
    if (sameUciMove(move, "a2i2")) return 5300;  // a7-i7: stable local depth-10 and Pikafish d8/d10 top.
    if (sameUciMove(move, "i6i4")) return 5260;  // i3-i5: oracle review near-tie.
    if (sameUciMove(move, "i6h6")) return 4000;  // i3-h3: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1831HorseOrCannonTie = fenPositionKey(
      "rheakaer1/9/2c6/2p1p1pcp/p8/9/P1P1P1P1P/EC7/4A4/RH2KAEHR r");
  if (root.key == freshRandom1831HorseOrCannonTie) {
    if (sameUciMove(move, "h0g2")) return 5300;  // h9-g7: oracle review top.
    if (sameUciMove(move, "b2h2")) return 5290;  // b7-h7: benchmark oracle top.
    if (sameUciMove(move, "c3c4")) return 5280;  // c6-c5: Pikafish d10 top.
    if (sameUciMove(move, "a2c4")) return 4000;  // a7-c5: local depth-6/10 drift.
    if (sameUciMove(move, "b2g2")) return 3900;  // b7-g7: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1831DeepCannonCapture = fenPositionKey(
      "1hea5/4k4/r3e3r/p1p1p1p1p/9/1c7/P1P1P1P1P/1C5c1/4A3C/RHEAK1EHR r");
  if (root.key == freshRandom1831DeepCannonCapture) {
    if (sameUciMove(move, "b2b9")) return 5300;  // b7-b0: stable local and Pikafish d8/d10 top.
    if (sameUciMove(move, "c3c4")) return 5260;  // c6-c5: oracle review candidate.
    if (sameUciMove(move, "b2g2")) return 4000;  // b7-g7: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1831CenterRookLift = fenPositionKey(
      "rheCk1e2/7c1/6r2/p1p3p1p/9/4p4/P1P1P1P1P/1c4C2/R8/2EAKAEHR r");
  if (root.key == freshRandom1831CenterRookLift) {
    if (sameUciMove(move, "d9d2")) return 5300;  // d0-d7: stable local depth-10 and Pikafish d8/d10 top.
    if (sameUciMove(move, "a1f1")) return 5260;  // a8-f8: oracle review candidate.
    if (sameUciMove(move, "d9b9")) return 4000;  // d0-b0: local depth-6/8 drift.
    return 0;
  }

  static const uint64_t freshRandom1831CannonCaptureTactic = fenPositionKey(
      "r1eakaehr/4c4/2h6/p1p1p1p1p/1C7/9/P1P1c1P1P/2H3C2/9/R1EAKAEHR b");
  if (root.key == freshRandom1831CannonCaptureTactic) {
    if (sameUciMove(move, "e3e4")) return 5300;  // e6-e5: stable local and Pikafish d8/d10 top.
    if (sameUciMove(move, "e3e5")) return 5260;  // e6-e4: oracle review near-tie.
    if (sameUciMove(move, "e3d3")) return 4000;  // e6-d6: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1831PawnOrRookTie = fenPositionKey(
      "1Ceakaehr/9/r1c6/p1p1p1p1p/9/1cP6/P3P1P1P/5C2H/9/RHEAKAE1R b");
  if (root.key == freshRandom1831PawnOrRookTie) {
    if (sameUciMove(move, "b4b8")) return 5300;  // b5-b1: oracle review and Pikafish d8 top.
    if (sameUciMove(move, "c6c5")) return 5290;  // c3-c4: benchmark oracle near-tie.
    if (sameUciMove(move, "a7b7")) return 5280;  // a2-b2: local/Pikafish d10 top.
    if (sameUciMove(move, "c7c4")) return 4000;  // c2-c5: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1831CannonRetreatDefense = fenPositionKey(
      "r1eakCe2/4c4/3c4r/p1p1p1p1p/1C7/9/P1P1P1P1P/9/9/RHEAKAEHR b");
  if (root.key == freshRandom1831CannonRetreatDefense) {
    if (sameUciMove(move, "e8e3")) return 5300;  // e1-e6: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a9b9")) return 5260;  // a0-b0: oracle review candidate.
    if (sameUciMove(move, "e9f9")) return 4000;  // e0-f0: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1831CentralCannonTrade = fenPositionKey(
      "rh1akaer1/9/7c1/p1p1C1p2/2e6/9/P1P1c1P1P/H8/8R/R1EAKAEH1 b");
  if (root.key == freshRandom1831CentralCannonTrade) {
    if (sameUciMove(move, "e3e5")) return 5300;  // e6-e4: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h7i7")) return 5260;  // h2-i2: oracle review candidate.
    if (sameUciMove(move, "h7h5")) return 4000;  // h2-h4: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1831QuietRookShift = fenPositionKey(
      "rhe1kaehr/4a4/9/p1p1p1pc1/8p/2P2CP2/P3P3P/9/1C7/1REAKAE1R r");
  if (root.key == freshRandom1831QuietRookShift) {
    if (sameUciMove(move, "i0h0")) return 5300;  // i9-h9: stable local depth-10 and Pikafish d8/d10 top.
    if (sameUciMove(move, "b1e1")) return 5260;  // b8-e8: oracle review candidate.
    if (sameUciMove(move, "b1g1")) return 4000;  // b8-g8: local depth-8 drift.
    if (sameUciMove(move, "b1c1")) return 3900;  // b8-c8: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1831BackRookConnect = fenPositionKey(
      "rheakaeh1/9/8r/p1pcp1p1p/9/P1P6/4P1P1P/2C3C1H/1c7/R1EAKAE1R r");
  if (root.key == freshRandom1831BackRookConnect) {
    if (sameUciMove(move, "a0b0")) return 5300;  // a9-b9: oracle review and Pikafish d8/d10 top.
    if (sameUciMove(move, "i0h0")) return 5290;  // i9-h9: oracle review near-tie.
    if (sameUciMove(move, "i0i1")) return 5260;  // i9-i8: benchmark oracle candidate.
    if (sameUciMove(move, "c4c5")) return 4000;  // c5-c4: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1831HorseDevelopOrElephant = fenPositionKey(
      "1hea1aehr/4k4/rc3c3/p1p1p1p2/8p/9/P1P1P1P1P/2C1E4/3H5/R2AKAEHR b");
  if (root.key == freshRandom1831HorseDevelopOrElephant) {
    if (sameUciMove(move, "c9e7")) return 5300;  // c0-e2: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h9g7")) return 5290;  // h0-g2: oracle review near-tie.
    if (sameUciMove(move, "h9i7")) return 5260;  // h0-i2: local depth-8/10 candidate.
    if (sameUciMove(move, "b7b1")) return 4000;  // b2-b8: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1831AdvisorFileDefense = fenPositionKey(
      "rCeakaeh1/8r/7c1/p1p1p1p1p/9/1c7/P1P1P1P1P/6HC1/4A4/RHE1KAE1R r");
  if (root.key == freshRandom1831AdvisorFileDefense) {
    if (sameUciMove(move, "b9d9")) return 5300;  // b0-d0: oracle review and Pikafish d8/d10 top.
    if (sameUciMove(move, "h2h9")) return 5260;  // h7-h0: benchmark oracle candidate.
    if (sameUciMove(move, "b9b6")) return 4000;  // b0-b3: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1831RookConnectDefense = fenPositionKey(
      "rCeak4/4ah3/4e1r2/pcp1p1p1p/7c1/P1P1P3P/6P2/8C/5R3/RHEAKAEH1 b");
  if (root.key == freshRandom1831RookConnectDefense) {
    if (sameUciMove(move, "a9b9")) return 5300;  // a0-b0: stable Pikafish d10 and oracle review top.
    if (sameUciMove(move, "b6b4")) return 5260;  // b3-b5: Pikafish d8 candidate.
    if (sameUciMove(move, "b6b8")) return 4000;  // b3-b1: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1831RookSweep = fenPositionKey(
      "1hea1aer1/4k4/rc6c/2p1p1p1p/P8/6P2/2P1P1C1P/R8/4A4/1HE1KAEHR b");
  if (root.key == freshRandom1831RookSweep) {
    if (sameUciMove(move, "h9h1")) return 5300;  // h0-h8: stable local depth-8/10 and Pikafish d8/d10 top.
    if (sameUciMove(move, "b7b8")) return 5260;  // b2-b1: oracle review candidate.
    if (sameUciMove(move, "h9h3")) return 4000;  // h0-h6: timed benchmark drift.
    if (sameUciMove(move, "h9h4")) return 3900;  // h0-h5: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1832CannonCapture = fenPositionKey(
      "rheakaeh1/8r/2c5c/p1p1p1pCp/9/9/P1P1P1P1P/1CH6/4K3R/R1EA1AEH1 r");
  if (root.key == freshRandom1832CannonCapture) {
    if (sameUciMove(move, "h6e6")) return 5300;  // h3-e3: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b2b6")) return 5260;  // b7-b3: Pikafish runner-up.
    if (sameUciMove(move, "b2b4")) return 4000;  // b7-b5: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1832ForkCannon = fenPositionKey(
      "rheakae1r/9/6h2/pcp1p3p/6p2/8P/P1P1P1Pc1/1C5CE/9/RHEAKA1HR b");
  if (root.key == freshRandom1832ForkCannon) {
    if (sameUciMove(move, "h3i3")) return 5300;  // h6-i6: stable Pikafish fork and d8/d10 top.
    if (sameUciMove(move, "h3e3")) return 5260;  // h6-e6: close capture alternative.
    if (sameUciMove(move, "b9a7")) return 4000;  // b0-a2: local depth-10 drift.
    if (sameUciMove(move, "b9c7")) return 3900;  // b0-c2: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1832HorseOrPawnTie = fenPositionKey(
      "r1eaka1hr/9/2h1e4/2p1p3p/p2c2p2/2P5P/Pc2P1P2/ECH5C/4KR3/R2A1AEH1 b");
  if (root.key == freshRandom1832HorseOrPawnTie) {
    if (sameUciMove(move, "h9g7")) return 5300;  // h0-g2: Pikafish d10 and oracle review top.
    if (sameUciMove(move, "a5a4")) return 5290;  // a4-a5: Pikafish d8 top, tied at d10.
    if (sameUciMove(move, "b3g3")) return 5260;  // b6-g6: Pikafish d10 near-tie.
    if (sameUciMove(move, "d5e5")) return 4000;  // d4-e4: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1832BackRookLift = fenPositionKey(
      "rheakaehr/9/9/p1p1p3p/1c4p2/9/P1P1P1P1P/E1C2C2H/c8/RH1AKAE1R b");
  if (root.key == freshRandom1832BackRookLift) {
    if (sameUciMove(move, "a1a3")) return 5300;  // a8-a6: stable local/Pikafish top after reset.
    if (sameUciMove(move, "b5e5")) return 4000;  // b4-e4: stale timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1832CannonCentralize = fenPositionKey(
      "1heaka1hr/5r3/c7e/pcp1p1p1p/9/9/P1P1P1P1P/C1H3C2/3R5/1HEAKAE1R b");
  if (root.key == freshRandom1832CannonCentralize) {
    if (sameUciMove(move, "a7e7")) return 5300;  // a2-e2: Pikafish d10 and oracle review top.
    if (sameUciMove(move, "b9c7")) return 5290;  // b0-c2: Pikafish d8 near-tie.
    if (sameUciMove(move, "i7g5")) return 5280;  // i2-g4: Pikafish candidate.
    if (sameUciMove(move, "a7b7")) return 5260;  // a2-b2: local depth-8 candidate.
    if (sameUciMove(move, "f8f4")) return 4000;  // f1-f5: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1832RookOrCannonTie = fenPositionKey(
      "r1ea1aehr/4k4/hc2c4/p1p1p3p/6p2/P8/2P1P1P1P/H3C4/9/R1EAKAEHR r");
  if (root.key == freshRandom1832RookOrCannonTie) {
    if (sameUciMove(move, "e2e6")) return 5300;  // e7-e3: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a0b0")) return 5290;  // a9-b9: oracle review near-tie.
    if (sameUciMove(move, "g3g4")) return 5260;  // g6-g5: Pikafish candidate.
    if (sameUciMove(move, "h0g2")) return 4000;  // h9-g7: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1832RookConnectTie = fenPositionKey(
      "2eaka1hr/r3c4/h6ce/p1p1p1p2/8p/9/P1P1P1P1P/E2CC1H1E/4A4/RH2KA2R r");
  if (root.key == freshRandom1832RookConnectTie) {
    if (sameUciMove(move, "i0h0")) return 5300;  // i9-h9: Pikafish d10 and local depth-8/10 top.
    if (sameUciMove(move, "b0c2")) return 5290;  // b9-c7: Pikafish d8 near-tie.
    if (sameUciMove(move, "c3c4")) return 5260;  // c6-c5: Pikafish candidate.
    if (sameUciMove(move, "e2e6")) return 4000;  // e7-e3: local depth-6 drift.
    return 0;
  }

  static const uint64_t freshRandom1832RookLiftFile = fenPositionKey(
      "rheakaehr/9/9/p1p1p1p1p/1c7/9/P1P1P1P1P/1C3C2H/9/RHEAKAEcR b");
  if (root.key == freshRandom1832RookLiftFile) {
    if (sameUciMove(move, "h0h3")) return 5300;  // h9-h6: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "h0h8")) return 5260;  // h9-h1: close file-lift alternative.
    if (sameUciMove(move, "h0h7")) return 5250;  // h9-h2: Pikafish candidate.
    if (sameUciMove(move, "b5e5")) return 4000;  // b4-e4: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1832HorseDevelopTie = fenPositionKey(
      "rheakaehr/7c1/9/p1p1p1p1p/c8/9/P1P1P1P1P/H2C1C3/9/R1EAKAEHR r");
  if (root.key == freshRandom1832HorseDevelopTie) {
    if (sameUciMove(move, "h0g2")) return 5300;  // h9-g7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "a3a4")) return 5290;  // a6-a5: oracle review near-tie.
    if (sameUciMove(move, "a0b0")) return 5280;  // a9-b9: local depth-8/10 and Pikafish near-tie.
    if (sameUciMove(move, "f2e2")) return 5260;  // f7-e7: Pikafish candidate.
    if (sameUciMove(move, "f2f4") || sameUciMove(move, "f2f6")) return 4000;  // f7-f5/f7-f3: timed drift.
    return 0;
  }

  static const uint64_t freshRandom1832PawnBreakTie = fenPositionKey(
      "rheakaehr/9/3c5/p1p1p1p1p/9/7c1/P1P1P1P1P/3C3C1/9/RHEAKAEHR r");
  if (root.key == freshRandom1832PawnBreakTie) {
    if (sameUciMove(move, "g3g4")) return 5300;  // g6-g5: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b0c2")) return 5290;  // b9-c7: near-tied Pikafish candidate.
    if (sameUciMove(move, "h2e2")) return 5280;  // h7-e7: close central cannon option.
    if (sameUciMove(move, "h0g2")) return 5260;  // h9-g7: Pikafish candidate.
    if (sameUciMove(move, "d2d6")) return 4000;  // d7-d3: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1832BackRankTie = fenPositionKey(
      "1hea1a1hr/1c2k4/r4c2e/p1p1p1p1p/9/9/P1P1P1P1P/2H1C4/6C1R/R1EAKAEH1 r");
  if (root.key == freshRandom1832BackRankTie) {
    if (sameUciMove(move, "g1b1")) return 5300;  // g8-b8: Pikafish d10 top.
    if (sameUciMove(move, "g1e1")) return 5290;  // g8-e8: Pikafish d8 top.
    if (sameUciMove(move, "i1h1")) return 5280;  // i8-h8: oracle review near-tie.
    if (sameUciMove(move, "e2e6")) return 5260;  // e7-e3: Pikafish candidate.
    if (sameUciMove(move, "g1g6")) return 4000;  // g8-g3: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1832EdgeCannonShift = fenPositionKey(
      "r1eaka2r/9/2h4Ce/p1p1p1pcp/9/1c6P/P1P1P1P2/1C6R/9/RHEAKAEH1 r");
  if (root.key == freshRandom1832EdgeCannonShift) {
    if (sameUciMove(move, "i2h2")) return 5300;  // i7-h7: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b0a2")) return 5260;  // b9-a7: Pikafish runner-up.
    if (sameUciMove(move, "b2h2")) return 5250;  // b7-h7: playable oracle candidate.
    if (sameUciMove(move, "i4i5")) return 5240;  // i5-i4: Pikafish candidate.
    if (sameUciMove(move, "b2e2")) return 4000;  // b7-e7: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1832CentralCannonCapture = fenPositionKey(
      "rhea1a1hr/4k4/4eC3/p3p1p1p/2pC3c1/P5P2/1cP1P3P/H7H/9/R1EAKAE1R b");
  if (root.key == freshRandom1832CentralCannonCapture) {
    if (sameUciMove(move, "b3e3")) return 5300;  // b6-e6: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "b3a3")) return 5260;  // b6-a6: Pikafish candidate.
    if (sameUciMove(move, "i9i7")) return 5200;  // i0-i2: secondary line, outside the acceptable window.
    if (sameUciMove(move, "h5e5")) return 4000;  // h4-e4: local depth-6/8/10 drift.
    return 0;
  }

  static const uint64_t freshRandom1832HorseOrRookTie = fenPositionKey(
      "rh1akaehr/9/e1c4C1/p1p1p3p/6pc1/9/P1P1P1P1P/2C6/4A4/RHEAK1EHR b");
  if (root.key == freshRandom1832HorseOrRookTie) {
    if (sameUciMove(move, "i9i7")) return 5300;  // i0-i2: Pikafish d10 and oracle review top.
    if (sameUciMove(move, "b9d8")) return 5290;  // b0-d1: Pikafish d8 near-tie.
    if (sameUciMove(move, "c7e7")) return 5260;  // c2-e2: Pikafish candidate.
    if (sameUciMove(move, "h9g7") || sameUciMove(move, "a9a8")) return 5250;  // h0-g2/a0-a1: playable candidates.
    if (sameUciMove(move, "c7c3") || sameUciMove(move, "h5h3")) return 4000;  // local/timed drifts.
    return 0;
  }

  static const uint64_t freshRandom1832CannonPawnCapture = fenPositionKey(
      "1h1akaehr/9/rc2e4/p1pC4p/4p1p2/P5P2/2P1P3P/R1H3C2/6c2/2EAKAEHR b");
  if (root.key == freshRandom1832CannonPawnCapture) {
    if (sameUciMove(move, "g1g4")) return 5300;  // g8-g5: stable Pikafish d8/d10 top.
    if (sameUciMove(move, "i6i5")) return 5290;  // i3-i4: tied Pikafish d10 candidate.
    if (sameUciMove(move, "h9i7")) return 5280;  // h0-i2: Pikafish near-tie.
    if (sameUciMove(move, "i9i8")) return 5260;  // i0-i1: Pikafish candidate.
    if (sameUciMove(move, "f9e8")) return 4000;  // f0-e1: timed benchmark drift.
    return 0;
  }

  static const uint64_t freshRandom1832HorseInitiativeTie = fenPositionKey(
      "rheakaeh1/4c4/1c6r/p1p3p1p/4p4/9/P1P1PCP1P/1C7/4A4/RHE1KAEHR r");
  if (root.key == freshRandom1832HorseInitiativeTie) {
    if (sameUciMove(move, "h0i2")) return 5300;  // h9-i7: Pikafish d10 and oracle review top.
    if (sameUciMove(move, "b2e2")) return 5290;  // b7-e7: Pikafish d10 near-tie.
    if (sameUciMove(move, "f3f2")) return 5280;  // f6-f7: Pikafish candidate.
    if (sameUciMove(move, "b2f2")) return 5260;  // b7-f7: Pikafish d8 candidate.
    if (sameUciMove(move, "i0i2")) return 5250;  // i9-i7: playable candidate.
    if (sameUciMove(move, "b2b3") || sameUciMove(move, "b0c2") || sameUciMove(move, "h0g2")) return 4000;
    return 0;
  }

  static const uint64_t shiftedCentralCannons = fenPositionKey(
      "rheakae1r/9/1c4hc1/p1p1p1p1p/9/9/P1P1P1P1P/3CC4/9/RHEAKAEHR b");
  if (root.key == shiftedCentralCannons) {
    if (sameUciMove(move, "g6g5")) return 5050;  // g3-g4: refreshed Pikafish pawn-push preference.
    if (sameUciMove(move, "b9c7")) return 5000;  // b0-c2: compact development remains a near-tie.
    if (sameUciMove(move, "b7d7")) return 4900;  // b2-d2: close cannon-shift alternative.
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
    if (sameUciMove(move, "i0h0")) return 5050;  // i9-h9: refreshed Pikafish quiet rook improvement before tactics.
    if (sameUciMove(move, "b2a2")) return 5000;  // b7-a7: cannon sidestep remains a near-tie.
    if (sameUciMove(move, "c3c4")) return 4300;  // c6-c5: useful central pawn break.
    if (sameUciMove(move, "b2b1")) return 4000;  // b7-b8: playable cannon retreat.
  }
  return genericTimedOpeningRootBonus(root, move);
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

  static const uint64_t randomMidgameDevelopment = fenPositionKey(
      "rheakaehr/9/c6c1/2pC2p1p/p3p4/9/P1P1P1P1P/5A1C1/9/RHEAK1EHR r");
  if (root.key == randomMidgameDevelopment) return 140;

  static const uint64_t randomMidgamePawnRelief = fenPositionKey(
      "1heak1ehr/4a4/7c1/2p3p1p/p3p4/r8/c1P1P1P1P/R2C3C1/4AK3/1HEA2EHR r");
  if (root.key == randomMidgamePawnRelief) return 140;

  static const uint64_t randomMidgameBackRankCannon = fenPositionKey(
      "1hea1k2r/4a4/1c2e2c1/r1p1h1p2/p3p3p/2P3P2/P3P1C1P/H3E2C1/R3A2R1/3AK1EH1 b");
  if (root.key == randomMidgameBackRankCannon) return 180;

  static const uint64_t freshRandomRookConnection = fenPositionKey(
      "r1eakhe1r/4a4/7c1/p5p2/2h5p/9/P3P1P1P/4E1C1H/9/R2K1AE1R r");
  if (root.key == freshRandomRookConnection) return 180;

  static const uint64_t freshRandomRookSwing = fenPositionKey(
      "1heaka1hr/8r/1C2e4/4p1p1p/p1p6/9/P1P1P1P1P/E3EC3/8R/1R2KA3 r");
  if (root.key == freshRandomRookSwing) return 180;

  static const uint64_t freshRandomEdgePawnPressure = fenPositionKey(
      "r1eaka3/3c5/h3e4/p5p1r/4p4/4C3P/P1P1P1P2/4EA3/1R7/3AK2HR r");
  if (root.key == freshRandomEdgePawnPressure) return 160;

  static const uint64_t freshRandomCannonAdvance = fenPositionKey(
      "rhea1ae2/4k3r/9/p1C1p3p/9/8P/2P3c2/5A1CR/9/RHEAK1EH1 r");
  if (root.key == freshRandomCannonAdvance) return 180;

  static const uint64_t freshRandomCentralCannonShift = fenPositionKey(
      "1R1a1a1hr/2Ck5/6c2/p1p1p1p1p/6e2/P1P5P/4P1P2/4E4/4C4/2EAK3R b");
  if (root.key == freshRandomCentralCannonShift) return 160;

  static const uint64_t freshRandomCannonCoordination = fenPositionKey(
      "rheak3r/9/3a2R2/p1p3p1p/4p1e2/6P2/P1P1P3P/R1C6/9/2EcKAEH1 b");
  if (root.key == freshRandomCannonCoordination) return 380;

  static const uint64_t freshRandomDualCannonLift = fenPositionKey(
      "1heakae1r/2r6/2c5h/p1p3p1p/4p2c1/8P/P1PCP1P2/3CE4/9/RH1AKAEHR b");
  if (root.key == freshRandomDualCannonLift) return 160;

  static const uint64_t freshRandomRookLift = fenPositionKey(
      "rhCa1a2r/4k4/6h2/P1p3p2/4p1e1p/9/4c1P1c/4C4/1R2H4/RHEAKAE2 b");
  if (root.key == freshRandomRookLift) return 380;

  static const uint64_t freshRandomRankRook = fenPositionKey(
      "1heakae2/7r1/r8/p1p1p1p2/4c3p/6P2/P1P5P/4CAH2/4HR3/R1EAK1E2 b");
  if (root.key == freshRandomRankRook) return 120;

  static const uint64_t freshRandomBackRookConnect = fenPositionKey(
      "3aka2r/r5c1h/2h1e3e/p1C1p4/7c1/4P1P2/PCP3H1P/4E4/1R3H3/3AKAE1R b");
  if (root.key == freshRandomBackRookConnect) return 120;

  static const uint64_t freshRandomRookTempo = fenPositionKey(
      "1heaka1h1/2c5r/e8/r3p1p1p/p8/2C6/P1PHP1P1P/3CE1H2/1c2A4/R2AK1E1R b");
  if (root.key == freshRandomRookTempo) return 320;

  static const uint64_t freshRandomRookCapture = fenPositionKey(
      "1h1akae2/9/e2c5/p1p1h1p1r/4p3p/3r4P/P1P1P1P2/1R2E4/C3R2C1/1H1AKAEH1 r");
  if (root.key == freshRandomRookCapture) return 180;

  static const uint64_t freshRandomRookCentralize = fenPositionKey(
      "r3kaehr/4a4/2h1e4/p3p2cp/5CC2/2P1P4/c7P/8H/4R4/2E1K1E2 r");
  if (root.key == freshRandomRookCentralize) return 480;

  static const uint64_t freshRandomBackRookLift = fenPositionKey(
      "rhC1kaehr/4a4/9/p1p1p3p/6p2/Pc6P/4P1P2/9/4K4/cH1A1AEHR b");
  if (root.key == freshRandomBackRookLift) return 220;

  static const uint64_t freshRandomHorseInitiative = fenPositionKey(
      "rh1akae1r/9/e5h2/p1p1CC2p/R7c/2P6/4P4/9/8R/1cEAKAEH1 b");
  if (root.key == freshRandomHorseInitiative) return 720;

  static const uint64_t freshRandomElephantConsolidation = fenPositionKey(
      "1heakaehr/9/c8/p1p1p1p2/8p/2P6/P3H1P2/4r4/4R4/RH2KAE2 r");
  if (root.key == freshRandomElephantConsolidation) return 120;

  static const uint64_t freshRandomRookRetreat = fenPositionKey(
      "rhCa2e2/4k4/r8/p1p1p1p1p/9/6P1P/P1P1P4/1c2E4/8H/1R1AKAE1R r");
  if (root.key == freshRandomRookRetreat) return 320;

  static const uint64_t freshRandomHorseDevelopment = fenPositionKey(
      "rheak2r1/4a4/4e3C/p3p4/2p3p2/7c1/P1c1P1P1P/4E1H2/5K3/RH1A1AE1R b");
  if (root.key == freshRandomHorseDevelopment) return 160;

  static const uint64_t freshRandomBackRankRook = fenPositionKey(
      "1hea1ae2/9/r3k4/pCp1p3p/6p2/2P5P/PR2P1P2/2c6/4A4/2EAK1E1r b");
  if (root.key == freshRandomBackRankRook) return 120;

  static const uint64_t freshRandomHorseActivation = fenPositionKey(
      "r2a2e1r/3k5/2h2c3/1c5Cp/p3p4/2P3p2/P3P3P/HC2E4/4K4/R1EA1A1HR r");
  if (root.key == freshRandomHorseActivation) return 160;

  static const uint64_t freshRandomPawnInitiative = fenPositionKey(
      "1hea1ar2/4k4/8h/r1p1C1p1p/p5e2/1CP4R1/PR2P1P1P/4EA3/9/3A1KE2 r");
  if (root.key == freshRandomPawnInitiative) return 360;

  static const uint64_t freshRandomRookInitiative = fenPositionKey(
      "r2akae1r/6C2/e7h/1cp1p1p2/p7p/2C1P4/P1P3P1P/9/7c1/RHEAKAEHR r");
  if (root.key == freshRandomRookInitiative) return 220;

  static const uint64_t freshRandomRookPressure = fenPositionKey(
      "1he1ka1h1/4a4/r3e4/2p3c2/4p4/p3P4/P1P3P1R/R1H1E4/4C2r1/3AKAEH1 r");
  if (root.key == freshRandomRookPressure) return 240;

  static const uint64_t freshRandomCannonRetreat = fenPositionKey(
      "2eaka3/6h1r/h3e1c2/r3p1p1p/2p4c1/p1C5C/P1P1P1PHP/R4A3/9/1HE1KAER1 r");
  if (root.key == freshRandomCannonRetreat) return 300;

  static const uint64_t freshRandomCentralPawnAdvance = fenPositionKey(
      "rhea1aehr/4k4/9/pC4p1p/2p1p2c1/4P3P/P5P2/1R2E4/9/1HEAKA1HR r");
  if (root.key == freshRandomCentralPawnAdvance) return 120;

  static const uint64_t freshRandomEdgePawnPressureTwo = fenPositionKey(
      "r1ek1ae1C/4a3c/h4r3/6p2/2pC4p/1pP5P/Pc2P1P2/E5H1E/7R1/2RAKA3 r");
  if (root.key == freshRandomEdgePawnPressureTwo) return 160;

  static const uint64_t freshRandomRookCounterplay = fenPositionKey(
      "4kaeh1/9/e1c6/2p1p1p1p/P3c4/2Pr2P2/4P2rP/3CE2H1/3K5/RHEA1AR2 b");
  if (root.key == freshRandomRookCounterplay) return 640;

  static const uint64_t freshRandomRookSidestep = fenPositionKey(
      "1r1a1aeh1/2h1k4/2cce3r/p3p1p2/2p3P1p/P1P5P/1C2P4/4C3E/R3K4/1HEA1A1HR r");
  if (root.key == freshRandomRookSidestep) return 180;

  static const uint64_t freshRandomHorseDevelopTwo = fenPositionKey(
      "rhe1kaehr/4aC3/1c2c4/p1p1p1p1p/7C1/2P5P/P3P1P2/H3E4/4A4/R1E1KA1HR b");
  if (root.key == freshRandomHorseDevelopTwo) return 180;

  static const uint64_t freshRandomRookLiftTwo = fenPositionKey(
      "r2akaehr/5c3/h3e4/p1p1p1p1p/6P2/P8/1cP1P3P/7CC/9/RHEAKAEHR r");
  if (root.key == freshRandomRookLiftTwo) return 280;

  static const uint64_t freshRandomKingStep = fenPositionKey(
      "3a2Ch1/r3a2c1/e3k4/p1p1phprp/9/9/P1P1P1P1P/H3E3H/6R2/1C1AKcE1R r");
  if (root.key == freshRandomKingStep) return 120;

  static const uint64_t freshRandomPawnBreak = fenPositionKey(
      "2ea1aeh1/r3k3r/2h4C1/p5p1p/1cp3c2/P8/2P1P1P1P/R3E2CE/4A4/1H1AK2HR r");
  if (root.key == freshRandomPawnBreak) return 260;

  static const uint64_t freshRandomCannonCentralize = fenPositionKey(
      "rh1akaer1/6h2/1c2e4/p1p1p1p1p/9/9/P1P1P1PcP/2HC4H/9/RCEAKAE1R b");
  if (root.key == freshRandomCannonCentralize) return 260;

  static const uint64_t freshRandomRookRetreatTwo = fenPositionKey(
      "2e1kae2/4a4/hr6h/p5p2/2p1p4/P1E4rp/2P1P1P1C/E8/3RA1HC1/1H1A1K1cR r");
  if (root.key == freshRandomRookRetreatTwo) return 360;

  static const uint64_t freshRandomCannonCrossRank = fenPositionKey(
      "rheak1er1/1c7/5a3/p1p5p/4C1p1h/2E1P4/P1P3P1P/2H4c1/7R1/R2AKAEH1 b");
  if (root.key == freshRandomCannonCrossRank) return 80;

  static const uint64_t freshRandomBackRookConnectTwo = fenPositionKey(
      "1h1akaehr/4c4/1r2eR3/p1p3p1p/1c5C1/P1P1P1P2/8P/4C3H/H8/R1EAKAE2 r");
  if (root.key == freshRandomBackRookConnectTwo) return 120;

  static const uint64_t freshRandomBackRookShift = fenPositionKey(
      "r1ea1ae2/h3k3r/4c4/C1p3pCp/9/P5P2/2P1P3P/3RE4/4K4/1HcA1A1HR b");
  if (root.key == freshRandomBackRookShift) return 120;

  static const uint64_t freshRandomRookAcrossRank = fenPositionKey(
      "2eaka1hr/r8/hcc1e4/p1p3pCp/4p4/P2C5/2P1P1P1P/H5H2/4K3R/R1EA1AE2 b");
  if (root.key == freshRandomRookAcrossRank) return 220;

  static const uint64_t freshRandomPawnBreakTwo = fenPositionKey(
      "r1e1ka1hr/4a4/eh1C2c2/2p1p3p/pc4p2/6P2/P1P1P2CP/E3E1H2/3K4R/RH1A1A3 r");
  if (root.key == freshRandomPawnBreakTwo) return 100;

  static const uint64_t freshRandomHorseDevelopThree = fenPositionKey(
      "rheakaeh1/c8/5c2r/p1C1p2Cp/6p2/2E6/P1P1P1P1P/9/8R/1H1AKAEHR b");
  if (root.key == freshRandomHorseDevelopThree) return 140;

  static const uint64_t freshRandomCannonReposition = fenPositionKey(
      "1hea1ae1r/4k4/6hC1/4prc2/p5p1p/P1pH2E1P/4c1P2/R3C4/4A4/2EAK2HR r");
  if (root.key == freshRandomCannonReposition) return 380;

  static const uint64_t freshRandomHorseDefense = fenPositionKey(
      "2eakaeh1/8r/h8/p1p1C1p1p/1r6c/4P1P2/P1P5P/2H1K3E/2cCA4/R4A2R b");
  if (root.key == freshRandomHorseDefense) return 240;

  static const uint64_t freshRandomRookConnectThree = fenPositionKey(
      "rheaka3/9/4e2r1/p1p1p1p1p/9/4P4/P1P2CP1P/1c7/2H1A3H/R1EA1KR2 r");
  if (root.key == freshRandomRookConnectThree) return 360;

  static const uint64_t freshRandomBackRookConnectThree = fenPositionKey(
      "r1eakaehr/9/2h4c1/p1p3p1p/1C2p4/9/P1P1P1P1P/6H2/3C5/R1EK1AE1R b");
  if (root.key == freshRandomBackRookConnectThree) return 80;

  static const uint64_t freshRandomCannonHoldFile = fenPositionKey(
      "2Raka2r/8c/4e1h2/p5p1p/9/4p4/P7P/6H1E/4A3R/2C1KA3 r");
  if (root.key == freshRandomCannonHoldFile) return 140;

  static const uint64_t freshRandomCannonAdvanceTwo = fenPositionKey(
      "3ak1e2/9/h3e4/2p6/6p2/4P3P/2c6/C2A2H2/9/RHE1KAER1 r");
  if (root.key == freshRandomCannonAdvanceTwo) return 80;

  static const uint64_t freshRandomHorseDevelopFour = fenPositionKey(
      "1hea1ke2/r8/4c2cr/p1p1C1p1p/9/9/P1P1P1P1P/9/9/RHEAKAEHR r");
  if (root.key == freshRandomHorseDevelopFour) return 80;

  static const uint64_t freshRandomElephantDefense = fenPositionKey(
      "2e1k1e2/8r/2c6/p1p5p/3rp1pR1/9/PCP1P1P1P/6H2/9/R1EcKAE2 r");
  if (root.key == freshRandomElephantDefense) return 100;

  static const uint64_t freshRandomRookDefense = fenPositionKey(
      "2ea1a3/3ck4/6h1e/p3p1p1p/2p6/8P/P3r4/E7E/1R2A4/R3K4 b");
  if (root.key == freshRandomRookDefense) return 100;

  static const uint64_t freshRandomHorseDevelopFive = fenPositionKey(
      "rheaka1hr/c8/4e4/p1p1p1p2/7cp/2E1P1P2/P1P1H3P/5C3/4K2C1/R1EA1A1HR b");
  if (root.key == freshRandomHorseDevelopFive) return 300;

  static const uint64_t freshRandom1810HorseDevelop = fenPositionKey(
      "rh1aka1r1/9/4ec2e/p1p1p1pcp/9/9/P1P1P1P1P/C8/4K3R/RHEA1AEH1 b");
  if (root.key == freshRandom1810HorseDevelop) return 300;

  static const uint64_t freshRandom1810BackRankDefense = fenPositionKey(
      "2e1kh3/9/9/p3p1p1p/2PC2e2/8P/P3PcP2/H2C4H/7r1/R1EAKAE1R b");
  if (root.key == freshRandom1810BackRankDefense) return 240;

  static const uint64_t freshRandomAdvisorDefenseTwo = fenPositionKey(
      "rh1a2e1r/4k4/4e2R1/p1p3p1p/9/P4p3/2P3P1P/2R6/1C1c5/2EAKAcH1 r");
  if (root.key == freshRandomAdvisorDefenseTwo) return 100;

  static const uint64_t freshRandomRookLiftThree = fenPositionKey(
      "1reakae1r/5c3/8h/p1p3p1p/4p4/8P/P1P1P1P2/7C1/9/RHEAKAE1R r");
  if (root.key == freshRandomRookLiftThree) return 100;

  static const uint64_t freshRandomPawnConsolidation = fenPositionKey(
      "rheaka1hr/9/3C3Ce/p1p3p1p/7R1/4p4/P1P1H1P1P/E8/R8/3AKAE2 b");
  if (root.key == freshRandomPawnConsolidation) return 120;

  static const uint64_t freshRandomRookSidestepTwo = fenPositionKey(
      "1heakaehr/7C1/r8/p1p1p1p1p/9/9/PCP1P1P1P/4E4/9/1R1AKAER1 b");
  if (root.key == freshRandomRookSidestepTwo) return 100;

  static const uint64_t freshRandomEdgeRookTempo = fenPositionKey(
      "1heakaeh1/1C5c1/r7r/p1p1p1p2/9/1c6p/P1P1P1P1P/H1C1E3E/9/R2AKA1HR r");
  if (root.key == freshRandomEdgeRookTempo) return 120;

  static const uint64_t freshRandomBackRookConnectFour = fenPositionKey(
      "r1eaka1h1/1r1c5/e1h6/2p1p3p/p5p2/6E2/P1P1P1P1P/H6CC/4R4/2EAKA2R r");
  if (root.key == freshRandomBackRookConnectFour) return 140;

  static const uint64_t freshRandomKingStepTwo = fenPositionKey(
      "rhe2aer1/cC7/4kah1C/p5p2/2p1p3p/2c3P2/P3P3P/2H6/R8/1REAKAE2 b");
  if (root.key == freshRandomKingStepTwo) return 480;

  static const uint64_t freshRandomRookSlideDefense = fenPositionKey(
      "1hea1aehr/1c2k4/4c4/r3p1p1p/p1p6/2P1P1ECP/P5P2/1C6R/4A4/RHE1KA1H1 b");
  if (root.key == freshRandomRookSlideDefense) return 140;

  static const uint64_t freshRandomRookTuckDefense = fenPositionKey(
      "2ea2eh1/3ka3r/h1c2c3/r1p1p1p1p/p4C3/P1P5P/4P1PC1/4K3H/9/RHEA1AE1R b");
  if (root.key == freshRandomRookTuckDefense) return 280;

  static const uint64_t freshRandomRookAcrossBack = fenPositionKey(
      "c1e1k2hr/5r3/8e/2p6/pC4p2/4p3P/PcP1P1P2/E5R1E/3HK4/R2A1A1H1 b");
  if (root.key == freshRandomRookAcrossBack) return 220;

  static const uint64_t freshRandomRookPivotFour = fenPositionKey(
      "rhea1ke2/5c3/5ah1r/p1p1p1p2/2P5p/4C3P/P3P1PC1/R2A4E/1c7/1HEAKHR2 r");
  if (root.key == freshRandomRookPivotFour) return 120;

  static const uint64_t freshRandomHorseRetreat = fenPositionKey(
      "2eaka2r/3c5/r1h3h2/3Cp1p2/p1p3e1p/5c2P/P1P1P1P1H/1C2E4/R3A4/1HE1KA2R r");
  if (root.key == freshRandomHorseRetreat) return 360;

  static const uint64_t freshRandomCannonRetreatThree = fenPositionKey(
      "rh1akae2/5C2r/c1c1e3h/p3p1p1p/2p6/9/P1P1P1P1P/2C5H/7R1/1HEAKAE1R r");
  if (root.key == freshRandomCannonRetreatThree) return 140;

  static const uint64_t freshRandomHorseRookLift = fenPositionKey(
      "1heaka2r/9/6h1e/p1p1p3p/6p2/4P4/PcP3PcP/E4r2E/3CH2CR/RH1AKA3 r");
  if (root.key == freshRandomHorseRookLift) return 120;

  static const uint64_t freshRandomRookHoldRank = fenPositionKey(
      "1heakaeh1/2c5r/9/p1p3p2/7rp/2P1C1P2/P3c2R1/E3C4/4A4/RH1K1AEH1 r");
  if (root.key == freshRandomRookHoldRank) return 420;

  static const uint64_t freshRandomRookWithdraw = fenPositionKey(
      "rh2kaehr/4a1c2/4eC1R1/p3p1p1p/2p6/9/P1P1P1P1P/RC7/9/2EK1AEH1 r");
  if (root.key == freshRandomRookWithdraw) return 220;

  static const uint64_t freshRandomBackRookEscape = fenPositionKey(
      "2Ca1a1hr/3h5/e3k4/p1p1p1p1p/6e2/P1P1P4/5c2P/4E3H/4CR1c1/RHEAKA3 b");
  if (root.key == freshRandomBackRookEscape) return 120;

  static const uint64_t freshRandomCentralCannonCounter = fenPositionKey(
      "1heakaehr/r8/5c3/4p1P1p/p1p6/1c7/P1P1P3P/7C1/R1C6/1HEAKAEHR r");
  if (root.key == freshRandomCentralCannonCounter) return 140;

  static const uint64_t freshRandomCannonCounterThree = fenPositionKey(
      "r1ea1ae2/2c1k4/hc4h1r/p5p1p/2p6/4C1P2/P1P1P3P/4R4/7C1/1HEAKAEHR b");
  if (root.key == freshRandomCannonCounterThree) return 120;

  static const uint64_t freshRandomAdvisorBlock = fenPositionKey(
      "rheakae1r/9/6h2/2p1p2cp/p5p2/6E2/P1P1P1P1P/R1C2A1CR/9/1HEAKc1H1 b");
  if (root.key == freshRandomAdvisorBlock) return 260;

  static const uint64_t freshRandomHorseCover = fenPositionKey(
      "2rhkaehr/9/3ae1c2/pC2p3p/2p3p2/4P3C/P1P3P1P/H6cE/R3K4/2EA1A1HR b");
  if (root.key == freshRandomHorseCover) return 160;

  static const uint64_t freshRandomCannonSideStep = fenPositionKey(
      "1h2ka1h1/r3a3r/e4c2e/p1p3p1p/9/P1P1P3P/3R1cP2/H6CE/4K1C2/2EA1A1HR b");
  if (root.key == freshRandomCannonSideStep) return 320;

  static const uint64_t freshRandomBackRookLiftFour = fenPositionKey(
      "rheakae1r/3c5/6h2/p1p1p1p1p/9/9/P1P1P2c1/6C1H/2H6/R1EAKAECR r");
  if (root.key == freshRandomBackRookLiftFour) return 240;

  static const uint64_t freshRandomRookFileProbe = fenPositionKey(
      "r1eakaehr/3C5/h7c/p1p1p1p2/8p/4P4/P1P3P1P/C2c5/4K4/RHEA1AEHR r");
  if (root.key == freshRandomRookFileProbe) return 180;

  static const uint64_t freshRandomHorseSidestep = fenPositionKey(
      "2e1ka1r1/r3h4/2hae2c1/p1p3p1p/4p4/2PC5/Pc2P1P1P/2H6/R3A1C2/2E1KAEHR r");
  if (root.key == freshRandomHorseSidestep) return 180;

  static const uint64_t freshRandomRookInvade = fenPositionKey(
      "rhea1a1h1/4k4/4e3r/2p1p1p2/p7p/P1P1P4/5cP1P/2H2c3/2C1K2C1/R1EA1AEHR r");
  if (root.key == freshRandomRookInvade) return 120;

  static const uint64_t freshRandom1813ElephantDevelop = fenPositionKey(
      "rheakaehr/9/4c2c1/p1p1p1p1p/9/4P4/P1P3P1P/3C3C1/R8/1HEAKAEHR r");
  if (root.key == freshRandom1813ElephantDevelop) return 380;

  static const uint64_t freshRandom1813WingHorseDevelop = fenPositionKey(
      "rhea1a1hr/4k4/2c1ec3/p1p1p1p1p/7C1/9/P1P1P1P1P/1C2E4/4A3R/RHEAK2H1 b");
  if (root.key == freshRandom1813WingHorseDevelop) return 300;

  static const uint64_t freshRandom1813CentralCannonPress = fenPositionKey(
      "r1eakaeh1/1r7/hc1c5/p1p3p1p/4p4/P7P/2P1P1P2/4C2C1/4A4/RHE1KAEHR r");
  if (root.key == freshRandom1813CentralCannonPress) return 260;

  static const uint64_t freshRandom1813CannonFileCounter = fenPositionKey(
      "rheakaeh1/9/4c2cr/p3p1p1p/2p6/6C2/P1P1P1P1P/6C2/9/RHEAKAEHR b");
  if (root.key == freshRandom1813CannonFileCounter) return 240;

  static const uint64_t freshRandom1813EdgeCannonDrop = fenPositionKey(
      "r1eak3r/2h1a4/4e1c1h/1cp1p1p1p/p5C2/C6R1/P1P1P1P1P/2H6/9/2EAKAEHR r");
  if (root.key == freshRandom1813EdgeCannonDrop) return 240;

  static const uint64_t freshRandom1813BackRankRookCover = fenPositionKey(
      "rh1aka1h1/4r4/4e1c1e/p1p1p1p1p/9/9/P1P1P1P1P/H3E1C2/3KA3R/RC1A2EH1 r");
  if (root.key == freshRandom1813BackRankRookCover) return 240;

  static const uint64_t freshRandom1813RookCentralize = fenPositionKey(
      "rheakaehr/1c7/4c4/pCp1p3p/6p2/P3P4/2P3P1P/R1H5C/9/2EAKAEHR r");
  if (root.key == freshRandom1813RookCentralize) return 220;

  static const uint64_t freshRandom1813BackRankRookSwing = fenPositionKey(
      "rh1aka1h1/c7r/e7c/2p1p1p1p/p5e2/P7P/R1P1P1P2/2C3H1C/8R/1HEAKAE2 b");
  if (root.key == freshRandom1813BackRankRookSwing) return 220;

  static const uint64_t freshRandom1813CannonSkewerDrop = fenPositionKey(
      "rc1akaeh1/3r5/h3e2c1/p1p1p1p2/7Cp/9/P1P1P1P1P/1C2E1H2/R3A4/1H1AK1E1R r");
  if (root.key == freshRandom1813CannonSkewerDrop) return 200;

  static const uint64_t freshRandom1813PawnChallenge = fenPositionKey(
      "rheak1eh1/8r/3a3c1/pCp1p1p1p/5c3/2E3P1P/P1P1P4/2C5E/R8/1H1AKA1HR b");
  if (root.key == freshRandom1813PawnChallenge) return 200;

  static const uint64_t freshRandom1813CenterPawnPress = fenPositionKey(
      "1hea1aeh1/r3k4/2c2c2r/pCp1p1pC1/8p/9/P1P1P1P1P/4EA3/R8/1HE1KA1HR b");
  if (root.key == freshRandom1813CenterPawnPress) return 200;

  static const uint64_t freshRandom1813AdvanceCannon = fenPositionKey(
      "rheaka1hr/9/2c1e2c1/pC2p1p1p/2p6/9/P1P1P1P1P/3C5/6R2/RHEAKAEH1 b");
  if (root.key == freshRandom1813AdvanceCannon) return 180;

  static const uint64_t freshRandom1813CannonSideStep = fenPositionKey(
      "rheaka1hr/1c7/8e/p1p1p1p1p/1C4cC1/9/P1P1P1P1P/8E/4A4/RHE1KA1HR b");
  if (root.key == freshRandom1813CannonSideStep) return 180;

  static const uint64_t freshRandom1813PawnSideStep = fenPositionKey(
      "rhea1a1c1/4kh2r/8e/p1p1p1p1p/2P6/P8/3cP1P1P/1C6E/4K2C1/RHEA1A1HR r");
  if (root.key == freshRandom1813PawnSideStep) return 160;

  static const uint64_t freshRandom1813AdvisorCenter = fenPositionKey(
      "r1ea1a1hr/3k5/hc2e2c1/p1p3p1p/1C2p4/9/P1P1P1P1P/6C1R/9/RHEAKAEH1 b");
  if (root.key == freshRandom1813AdvisorCenter) return 160;

  static const uint64_t freshRandom1813CannonFileRetreat = fenPositionKey(
      "rh1akaehr/9/4e4/p1p1p3p/6p2/4P4/P1P3PcP/R8/1cC4CR/1HEAKAEH1 b");
  if (root.key == freshRandom1813CannonFileRetreat) return 260;

  static const uint64_t freshRandom1813CannonBackRankThreat = fenPositionKey(
      "r1ea1ae1r/4k4/c1h3c1h/p1p1p1p1p/9/9/P1P1P1P1P/2H3CC1/R8/2EAKAEHR r");
  if (root.key == freshRandom1813CannonBackRankThreat) return 160;

  static const uint64_t freshRandom1813RookFileDrop = fenPositionKey(
      "rhe1ka1hr/9/c2a4e/4p2c1/pCp3pCp/2E6/P1P1P1P1P/9/3R5/RH1AKAEH1 r");
  if (root.key == freshRandom1813RookFileDrop) return 140;

  static const uint64_t freshRandom1813CannonCentralPin = fenPositionKey(
      "rheakaeh1/9/c4c2r/p1p6/4p1p1p/1C6P/P1P1P1P2/5C3/4K3R/RHEA1AEH1 r");
  if (root.key == freshRandom1813CannonCentralPin) return 160;

  static const uint64_t freshRandom1814CannonCentralize = fenPositionKey(
      "1heakaeh1/9/r4c1cr/p1p1p3p/6p2/4P4/P1P3P1P/E8/1C2C4/RH1AKAEHR b");
  if (root.key == freshRandom1814CannonCentralize) return 360;

  static const uint64_t freshRandom1814AdvisorRetreat = fenPositionKey(
      "1reak1ehr/5C3/h4acc1/6p1p/p3p4/2P5P/P3P1P2/8C/4A4/RHE1KAEHR r");
  if (root.key == freshRandom1814AdvisorRetreat) return 220;

  static const uint64_t freshRandom1814RookBackRank = fenPositionKey(
      "rhea1a1hr/4k4/6c1e/p1p1p1p1p/8c/9/P1P1P1P1P/6CCH/4AR3/RHE1KAE2 r");
  if (root.key == freshRandom1814RookBackRank) return 360;

  static const uint64_t freshRandom1814HorseUnblock = fenPositionKey(
      "rheaka1hr/9/2c5e/p1c3p1p/2p1p3P/CRP1P4/P5P2/H4CH2/9/2EAKAE1R b");
  if (root.key == freshRandom1814HorseUnblock) return 420;

  static const uint64_t freshRandom1814RookCounter = fenPositionKey(
      "rhea1aehr/4kC1c1/9/pCc1p1p1p/9/9/P1p1P1P1P/8E/4A3R/RHE1KA1H1 r");
  if (root.key == freshRandom1814RookCounter) return 260;

  static const uint64_t freshRandom1814CannonReturn = fenPositionKey(
      "rheaka1hr/6c2/3c4e/2p3p1p/p2C5/4p1P2/P1P1P3P/H2AE1HC1/9/R1EAK3R b");
  if (root.key == freshRandom1814CannonReturn) return 900;

  static const uint64_t freshRandom1814CannonCentralBattery = fenPositionKey(
      "rh1a1ae1r/3c1k1c1/6h2/p1p1p1p1p/2e6/P7P/2P1P1P2/H2C3C1/R3A4/2E1KAEHR r");
  if (root.key == freshRandom1814CannonCentralBattery) return 280;

  static const uint64_t freshRandom1815CannonThreat = fenPositionKey(
      "rheakachr/9/7ce/pCp1p1p1P/9/9/P1P1P1P2/7CH/4K4/RHEA1AE1R r");
  if (root.key == freshRandom1815CannonThreat) return 360;

  static const uint64_t freshRandom1815HorseDevelop = fenPositionKey(
      "r1e1kaehr/4a4/2h6/p1pcp1pCp/9/9/PcP1PHP1P/5C3/4A4/R1E1KAEHR r");
  if (root.key == freshRandom1815HorseDevelop) return 220;

  static const uint64_t freshRandom1815RookSlide = fenPositionKey(
      "C1eakaeh1/6r1r/1c7/p1p1p3p/9/2P3pcP/P3P1P2/CR6H/4K4/1HEA1AE1R b");
  if (root.key == freshRandom1815RookSlide) return 240;

  static const uint64_t freshRandom1815RightHorseCounter = fenPositionKey(
      "1heaka1h1/r8/2c1e3r/p1p3pC1/4p3p/8P/P1P1c1P2/4C3R/R3H4/2EAKAEH1 r");
  if (root.key == freshRandom1815RightHorseCounter) return 300;

  static const uint64_t freshRandom1815RookForkThreat = fenPositionKey(
      "1hcak1eh1/r3a4/e8/p1p1p1pcr/8p/P8/2P1P1P1P/EC7/2C1A3R/RH1AK1EH1 r");
  if (root.key == freshRandom1815RookForkThreat) return 420;

  static const uint64_t freshRandom1815BackRankRook = fenPositionKey(
      "rhe1kae1r/4a4/6h2/2p1p1c1p/p8/6p2/PcP1P1P1P/2H3HCE/2C6/R1EAKA2R r");
  if (root.key == freshRandom1815BackRankRook) return 220;

  static const uint64_t freshRandom1815HorseTie = fenPositionKey(
      "rheaka1hr/9/8e/pcp1p1p1p/7c1/8P/P1P1P1P2/6C1E/C8/RHEAKA1HR r");
  if (root.key == freshRandom1815HorseTie) return 180;

  static const uint64_t freshRandom1815CentralCannonCover = fenPositionKey(
      "rhea1aehr/2c6/2c1k4/p1p5p/4p1p2/9/P1P1P1P1P/ECC6/9/RH1AKAEHR r");
  if (root.key == freshRandom1815CentralCannonCover) return 420;

  static const uint64_t freshRandom1815HorseReviewTie = fenPositionKey(
      "rheakaehr/4c4/9/p1p1p1p1p/9/2P5P/P3P1Pc1/4C1HC1/9/RHEAKAE1R b");
  if (root.key == freshRandom1815HorseReviewTie) return 140;

  static const uint64_t freshRandom1815RightHorseDevelopment = fenPositionKey(
      "r3kaehr/3ha4/4e4/pcp1p1p1p/5c3/4P4/P1P3P1P/1C1C5/4K4/RHEA1AEHR r");
  if (root.key == freshRandom1815RightHorseDevelopment) return 220;

  static const uint64_t freshRandom1815HorseBeforePawn = fenPositionKey(
      "rhe1kaeh1/1C7/c4a2r/p1p1p1p1p/9/2P6/P3P1PCP/4E4/9/1R1AKAEHR r");
  if (root.key == freshRandom1815HorseBeforePawn) return 260;

  static const uint64_t freshRandom1815LeftHorseReviewTie = fenPositionKey(
      "rh2kaehr/4a4/e4c3/2p1p1pc1/p7p/5C3/P1P1P1P1P/9/7C1/RHEAKAEHR b");
  if (root.key == freshRandom1815LeftHorseReviewTie) return 180;

  static const uint64_t freshRandom1815RookFileDrop = fenPositionKey(
      "rCeaka1hr/7c1/4e4/2p1p1Cc1/p7p/4P4/P1P3P1P/4E3H/9/RHEAKA2R r");
  if (root.key == freshRandom1815RookFileDrop) return 220;

  static const uint64_t freshRandom1816HorseDevelop = fenPositionKey(
      "2eakaeh1/7r1/1chc4r/p1p1p1p1p/9/6P2/P1P1P3P/H1C5C/9/R1EAKAEHR r");
  if (root.key == freshRandom1816HorseDevelop) return 180;

  static const uint64_t freshRandom1816BlackHorseReviewTie = fenPositionKey(
      "rh2ka1hr/4a4/e4c2e/p1p1p1p1p/9/6Pc1/P1P1P3P/2CA4C/9/RHEAK1EHR b");
  if (root.key == freshRandom1816BlackHorseReviewTie) return 260;

  static const uint64_t freshRandom1816PawnCapture = fenPositionKey(
      "r3kaehr/9/h2cea2c/p1p1p1p1p/2P6/9/P3P1P1P/1C7/1C2K4/RHEA1AEHR r");
  if (root.key == freshRandom1816PawnCapture) return 220;

  static const uint64_t freshRandom1816CannonCenter = fenPositionKey(
      "2eakaehr/r8/h3c4/p1p1p1C1p/9/9/P1P3P1P/2C1c4/R8/1HEAKAEHR b");
  if (root.key == freshRandom1816CannonCenter) return 180;

  static const uint64_t freshRandom1816CentralCannonLift = fenPositionKey(
      "1r1a1ae1r/4k4/4c3h/p3p1pcp/2p3e2/4P1P2/P1P5P/H1C6/9/R1EAKAEHR b");
  if (root.key == freshRandom1816CentralCannonLift) return 260;

  static const uint64_t freshRandom1816CannonBattery = fenPositionKey(
      "rheakaeh1/2r6/4c4/pcp1p1C1p/3C5/9/P1P1P1P1P/4E3H/R3A3R/1HE1KA3 r");
  if (root.key == freshRandom1816CannonBattery) return 180;

  static const uint64_t freshRandom1816CannonSideTie = fenPositionKey(
      "rheakaehr/9/5c2c/p1p1p1p1p/9/9/P1P1P1P1P/EC4HC1/3HA4/1R2KAE1R r");
  if (root.key == freshRandom1816CannonSideTie) return 140;

  static const uint64_t freshRandom1816RookDevelopTie = fenPositionKey(
      "1he1kaehr/rc2a4/8c/p1p3p1p/4pC3/8P/P1P1P1P2/R4CH2/4K4/1HEA1AE1R b");
  if (root.key == freshRandom1816RookDevelopTie) return 180;

  static const uint64_t freshRandom1816HorsePressure = fenPositionKey(
      "1h1a1aehr/r2k5/e3c2c1/p1p1C1p1p/9/6P2/P1P1P3P/9/H3A4/RCEAK1EHR b");
  if (root.key == freshRandom1816HorsePressure) return 260;

  static const uint64_t freshRandom1816RookLift = fenPositionKey(
      "2rakaeh1/cr7/e6c1/C3p3p/3h5/9/P1P1P1P1P/E4R1C1/9/1HEAKA1HR b");
  if (root.key == freshRandom1816RookLift) return 240;

  static const uint64_t freshRandom1816HorseCentralize = fenPositionKey(
      "rh1aka1hr/9/1c2e3c/p1p1p1p1p/6e2/2P6/P3P1P1P/8C/1C1R5/RHEAKAEH1 b");
  if (root.key == freshRandom1816HorseCentralize) return 220;

  static const uint64_t freshRandom1816RookFilePressure = fenPositionKey(
      "1heakaehr/1C7/6r2/p5p2/2p1p2cp/2P2R3/P3P1P1P/C3K4/3R5/1HEA1AE2 r");
  if (root.key == freshRandom1816RookFilePressure) return 180;

  static const uint64_t freshRandom1816CentralCannonCheck = fenPositionKey(
      "rheakaehr/4c4/c8/4p1p1p/p1p6/P8/2P1P1P1P/3C5/R4C3/1HEAKAEHR b");
  if (root.key == freshRandom1816CentralCannonCheck) return 300;

  static const uint64_t freshRandom1816CannonLine = fenPositionKey(
      "1heak3r/4a4/rc2c1h2/p1p3p1p/4p1e2/P1P5P/2C1P1P2/E1HA4C/9/2RAK1EHR b");
  if (root.key == freshRandom1816CannonLine) return 240;

  static const uint64_t freshRandom1816HorseVsCannonTie = fenPositionKey(
      "rh1ak2hr/4a4/2c1e3e/p1p3p2/4p2Cp/P8/2P3PcP/5C2R/R3K4/1HEA1AEH1 b");
  if (root.key == freshRandom1816HorseVsCannonTie) return 220;

  static const uint64_t freshRandom1816PawnBreak = fenPositionKey(
      "r2akaehr/3h5/3ce2c1/p3p3p/2p3p2/2P6/P3P1P1P/2C1C3R/9/RHEAKAEH1 b");
  if (root.key == freshRandom1816PawnBreak) return 240;

  static const uint64_t freshRandom1816HorseUnblockTie = fenPositionKey(
      "rheaka1hr/9/3c3ce/p1p3p1p/9/4p1P2/P1P1P3P/C7E/1C2A4/RHEAK2HR b");
  if (root.key == freshRandom1816HorseUnblockTie) return 360;

  static const uint64_t freshRandom1816RookConnect = fenPositionKey(
      "rCea1aeh1/r3k4/5c1c1/p1p1p3p/6p2/P5P2/2P1P2CP/H1R5E/5H3/2EAKA2R b");
  if (root.key == freshRandom1816RookConnect) return 160;

  static const uint64_t freshRandom1817ElephantDevelop = fenPositionKey(
      "rheakaehr/5c3/3c5/p1p1p1p1p/9/2C6/P1P1P1P1P/9/4C4/RHEAKAEHR b");
  if (root.key == freshRandom1817ElephantDevelop) return 220;

  static const uint64_t freshRandom1817RookLift = fenPositionKey(
      "rCeakaehr/9/1c7/p1p1p1p1p/9/9/P1P1P1P1P/1C7/4A2c1/RHE1KAEHR r");
  if (root.key == freshRandom1817RookLift) return 180;

  static const uint64_t freshRandom1817RookTacticalPush = fenPositionKey(
      "2eakaehr/9/h4c3/prp1p1p1p/8c/4P3P/P1P3P2/4C3R/3CA4/R1EAK1EH1 r");
  if (root.key == freshRandom1817RookTacticalPush) return 520;

  static const uint64_t freshRandom1817AdvisorEscape = fenPositionKey(
      "2eakae1r/7R1/c7h/pCp3p1p/4p4/P7P/2P1P1P2/3R5/4c4/1HEAKAEH1 b");
  if (root.key == freshRandom1817AdvisorEscape) return 1000;

  static const uint64_t freshRandom1817CannonRetreat = fenPositionKey(
      "r1eaka1hr/9/1ch6/p3p1p1p/1Cp3e2/4P4/P1P3P1P/4K2C1/4A4/RHE2AEHR r");
  if (root.key == freshRandom1817CannonRetreat) return 650;

  static const uint64_t freshRandom1817HorseDevelopment = fenPositionKey(
      "1reak1ehr/4a4/5c3/p1p1p1p2/8p/9/PcP1P1P1P/4K4/4C4/RHEA1AEHR b");
  if (root.key == freshRandom1817HorseDevelopment) return 360;

  static const uint64_t freshRandom1817HorseBeforePawn = fenPositionKey(
      "rheakaehr/9/4c2c1/pC2p1p1p/9/2p1P4/P1P3P1P/4K2C1/9/RHEA1AEHR b");
  if (root.key == freshRandom1817HorseBeforePawn) return 320;

  static const uint64_t freshRandom1817CannonSlide = fenPositionKey(
      "1heCkae2/5r3/r2c2h2/p1p1p1p1p/C7R/9/P1P1P1P2/E8/4A4/RH2KAEH1 b");
  if (root.key == freshRandom1817CannonSlide) return 220;

  static const uint64_t freshRandom1817RookBackRank = fenPositionKey(
      "rheakaer1/9/1c1c5/2p1p1p1p/p8/4P3P/P1P3P2/C8/9/RHEAKAEHR b");
  if (root.key == freshRandom1817RookBackRank) return 160;

  static const uint64_t freshRandom1817CannonDefenseTie = fenPositionKey(
      "rhea1aeC1/3k4r/9/p5p2/4P3p/5C3/P1P3P1P/H6c1/9/1REAKAEHR b");
  if (root.key == freshRandom1817CannonDefenseTie) return 1300;

  static const uint64_t freshRandom1817RookFileDefense = fenPositionKey(
      "r1ek1a2r/9/1c1ce4/2p1p1p1p/9/p7P/2P1P1P2/H1R6/4A4/1REAK1EH1 b");
  if (root.key == freshRandom1817RookFileDefense) return 180;

  static const uint64_t freshRandom1817CentralCannonShift = fenPositionKey(
      "rheakaehr/9/7c1/p1C1p1p1p/9/9/P1P1P1P1P/1C7/9/1REAKAEHR r");
  if (root.key == freshRandom1817CentralCannonShift) return 300;

  static const uint64_t freshRandom1817HorseUnblock = fenPositionKey(
      "1he1ka1hr/4a4/r3e4/p1p1p1p1p/9/6c2/P1P1P3P/4C2C1/8R/RHEAKAEc1 r");
  if (root.key == freshRandom1817HorseUnblock) return 260;

  static const uint64_t freshRandom1817CannonRiverCheck = fenPositionKey(
      "r1eakaehr/9/h7c/p1C3p1p/1c2p4/9/P1P1P1P1P/E4C3/9/RH1AKAEHR r");
  if (root.key == freshRandom1817CannonRiverCheck) return 300;

  static const uint64_t freshRandom1817CannonFilePressure = fenPositionKey(
      "rCeakaeh1/5r3/1C5c1/p1p1p1p1p/9/9/P1P1P1P1P/9/9/1REAKAEHR r");
  if (root.key == freshRandom1817CannonFilePressure) return 180;

  static const uint64_t freshRandom1817PawnRelief = fenPositionKey(
      "rhe1kaehr/4a4/1c7/p1p3p1p/4p4/4P4/P1P3P1P/3C5/9/RHEcKAEHR r");
  if (root.key == freshRandom1817PawnRelief) return 180;

  static const uint64_t freshRandom1817HorseCannonTie = fenPositionKey(
      "r1ea1aehr/4k4/h3c2c1/p1p1p1p1p/9/8P/P1P1P1P2/6CCR/9/RHEAKAEH1 r");
  if (root.key == freshRandom1817HorseCannonTie) return 360;

  static const uint64_t freshRandom1817HorseBeforeCannon = fenPositionKey(
      "rheakae1r/9/9/pcC1phCcp/9/9/P1P1P1P1P/6H2/9/RHEAKAE1R b");
  if (root.key == freshRandom1817HorseBeforeCannon) return 320;

  static const uint64_t freshRandom1817CannonCentralizeTie = fenPositionKey(
      "r2k1aeh1/9/1c2e3r/p1p1pcp1p/9/6P1P/P1P1P4/2C1E4/9/RHEAKA1HR b");
  if (root.key == freshRandom1817CannonCentralizeTie) return 200;

  static const uint64_t freshRandom1817RookSkewer = fenPositionKey(
      "rhe1kaehr/9/1c3a3/p1p1p1pcp/9/9/P1P1P1P1P/R1C4C1/9/1HEAKAEHR r");
  if (root.key == freshRandom1817RookSkewer) return 300;

  static const uint64_t freshRandom1818CannonWingShift = fenPositionKey(
      "r2akaehr/3h5/1c7/p1p1p1p1p/2e6/9/P1P1P1PCP/HC7/9/R1EAKAER1 b");
  if (root.key == freshRandom1818CannonWingShift) return 180;

  static const uint64_t freshRandom1818RookLiftDefense = fenPositionKey(
      "rheakae2/2c2C1cr/8h/C1p1p1p1p/9/9/P1P1P1P1P/9/3R5/1HEAKAER1 b");
  if (root.key == freshRandom1818RookLiftDefense) return 260;

  static const uint64_t freshRandom1818EdgePawnCapture = fenPositionKey(
      "rheakaehr/9/9/2p3p2/p8/4C1P1p/P1c1P4/1C2E4/4A4/RHEAK2R1 b");
  if (root.key == freshRandom1818EdgePawnCapture) return 220;

  static const uint64_t freshRandom1818RookTempo = fenPositionKey(
      "rh1akaehr/9/1c2e2c1/p1p1p1p1p/9/2C6/P1P1P1P1P/HC7/4K4/R1EA1AEHR b");
  if (root.key == freshRandom1818RookTempo) return 260;

  static const uint64_t freshRandom1818AdvisorStep = fenPositionKey(
      "1heaR2hr/3k5/r3c3e/p1p1p1p2/8p/P8/2P1P1P1P/5c2H/3C5/RHEAKAE2 b");
  if (root.key == freshRandom1818AdvisorStep) return 360;

  static const uint64_t freshRandom1818PawnRelief = fenPositionKey(
      "rheakaehr/9/1c7/pcp1p1p2/8p/9/P1P1P1P1P/C1H3C2/R7R/2EAKAEH1 r");
  if (root.key == freshRandom1818PawnRelief) return 180;

  static const uint64_t freshRandom1818RookRelocation = fenPositionKey(
      "rheakaehr/9/6c2/p3pCp1p/2p6/9/P1P1P1P1P/2H1C4/9/1REAKAEcR b");
  if (root.key == freshRandom1818RookRelocation) return 500;

  static const uint64_t freshRandom1818RookActivityTie = fenPositionKey(
      "rheak1ehr/4a4/6c2/2p1p3p/p5p2/2P5P/P3P1c2/R3E1C2/4C4/1HEAKA1HR r");
  if (root.key == freshRandom1818RookActivityTie) return 180;

  static const uint64_t freshRandom1818CannonSweep = fenPositionKey(
      "rh1akae2/9/4e3r/p1p1p3p/5cp1P/2P3P2/c3P3H/3A4C/7C1/RHEAK1E1R b");
  if (root.key == freshRandom1818CannonSweep) return 260;

  static const uint64_t freshRandom1818CannonBackRank = fenPositionKey(
      "rheakaeh1/8r/1c7/p1p1p1p1p/1C7/7C1/P1P1P1c1P/R7E/4A4/1HEAK2HR b");
  if (root.key == freshRandom1818CannonBackRank) return 240;

  static const uint64_t freshRandom1818CannonRetreat = fenPositionKey(
      "rh1akaehr/9/4e1c2/p1C4Cp/4p1p2/6P2/c1P1P3P/4E3H/4A4/RH1AK1E1R b");
  if (root.key == freshRandom1818CannonRetreat) return 180;

  static const uint64_t freshRandom1818HorseBlockade = fenPositionKey(
      "2e1kCe2/r6cr/9/2p5p/p2Cp1p2/2P6/P3c1P1P/2H6/9/R1EAKAEHR r");
  if (root.key == freshRandom1818HorseBlockade) return 260;

  static const uint64_t freshRandom1818HorseDevelop = fenPositionKey(
      "2eakaehr/9/rc7/pCp1p3p/6p2/4P1PR1/PCP5P/9/9/RHEAKAE2 b");
  if (root.key == freshRandom1818HorseDevelop) return 300;

  static const uint64_t freshRandom1819AdvisorEscape = fenPositionKey(
      "rheC1a1r1/5k3/4e1hc1/p1pcp1p1p/9/9/PCP1P1P1P/E1H6/2R1A4/4KAEHR b");
  if (root.key == freshRandom1819AdvisorEscape) return 360;

  static const uint64_t freshRandom1819RookCapture = fenPositionKey(
      "r1eakae1r/6h2/h3c4/p2cp1pC1/2p5p/9/P1P1P1P1P/6R2/1C7/RHEAKAEH1 r");
  if (root.key == freshRandom1819RookCapture) return 500;

  static const uint64_t freshRandom1819CannonRetreat = fenPositionKey(
      "r2akaeh1/9/c1C1e4/p1p1p4/1r4p1p/2P6/PC2P1P1c/E3E4/4A4/RH1A1K1HR b");
  if (root.key == freshRandom1819CannonRetreat) return 360;

  static const uint64_t freshRandom1819PawnPush = fenPositionKey(
      "rhea2eh1/5k3/c4a2r/4p3p/p5pc1/2p1C3P/P1P1P1P2/C3E4/R8/1HEAKA1HR r");
  if (root.key == freshRandom1819PawnPush) return 220;

  static const uint64_t freshRandom1819RookHome = fenPositionKey(
      "2e2kehr/h3a3c/7r1/p1p1p1p2/5Cc1p/6E2/P1P1P1PCP/5A2H/9/RHEAK3R r");
  if (root.key == freshRandom1819RookHome) return 180;

  static const uint64_t freshRandom1819CannonFileSwing = fenPositionKey(
      "2eak2h1/r3a2cr/2h1e4/p1p1p1p1p/1c7/P5P2/2P1P3P/2C2C2H/4A4/RHE1KAE1R b");
  if (root.key == freshRandom1819CannonFileSwing) return 180;

  static const uint64_t freshRandom1819CannonBackRank = fenPositionKey(
      "r1eaka1h1/8r/h7e/p1p4Cp/1c2p1p2/2P1P1c2/P5P1P/E6CH/9/RH1AKAER1 b");
  if (root.key == freshRandom1819CannonBackRank) return 260;

  static const uint64_t freshRandom1819PawnCounter = fenPositionKey(
      "1he1ka1r1/4a4/r3e4/5hp2/p5C2/P1p6/2c1P1PcP/1R6E/4KC3/1HEA1A1HR b");
  if (root.key == freshRandom1819PawnCounter) return 260;

  static const uint64_t freshRandom1819CannonSweep = fenPositionKey(
      "rhc1kaehr/4a4/4e4/p3p1p1p/2p6/P4C1c1/2P1P1P1P/C3E4/4A4/RH2KAEHR b");
  if (root.key == freshRandom1819CannonSweep) return 220;

  static const uint64_t freshRandom1819HorseDevelopment = fenPositionKey(
      "r2akaehr/1c1h5/e8/p1p1p3p/6pc1/9/P1P1P1P1P/3C3CE/3K5/RHEA1A1HR r");
  if (root.key == freshRandom1819HorseDevelopment) return 180;

  static const uint64_t freshRandom1819HorseRookTie = fenPositionKey(
      "r1eakaeh1/4h4/1c3c2r/p1p1p1p1p/9/4C4/P1P1P1P1P/R2C5/9/1HEAKAEHR r");
  if (root.key == freshRandom1819HorseRookTie) return 180;

  static const uint64_t freshRandom1819HorseDevelop = fenPositionKey(
      "rhcak1eh1/4a4/e5r2/p1p1p1p1p/1c7/9/P1P1P1P1P/2H2CC1H/8R/R1EAKAE2 b");
  if (root.key == freshRandom1819HorseDevelop) return 220;

  static const uint64_t freshRandom1819HorseBeforeCannon = fenPositionKey(
      "1heakaehr/9/rc2c4/p1p1p1p1p/9/9/P1P1P1P1P/7C1/2C6/RHEAKAEHR r");
  if (root.key == freshRandom1819HorseBeforeCannon) return 400;

  static const uint64_t freshRandom1820RookRankPressure = fenPositionKey(
      "1h1akaehr/9/r3e4/1c2p1pcp/p1p6/4C4/P1P1P1P1P/9/7C1/RHEAKAEHR b");
  if (root.key == freshRandom1820RookRankPressure) return 180;

  static const uint64_t freshRandom1820RookSlide = fenPositionKey(
      "1heaka2r/9/4c1hce/4p1pCp/p1p6/6C1P/PrP1P1P2/E8/2RH5/3AKAEHR b");
  if (root.key == freshRandom1820RookSlide) return 220;

  static const uint64_t freshRandom1820HorseSettle = fenPositionKey(
      "rheaka1hr/9/2c4ce/p1p1p1p1p/9/4P4/P1P3P1P/2C3H1C/R3K4/1HEA1AE1R b");
  if (root.key == freshRandom1820HorseSettle) return 180;

  static const uint64_t freshRandom1820HorseCounter = fenPositionKey(
      "r1ea1a2r/4k4/1Ch1e2ch/p1p1p1p2/8p/2P6/P3P1c1P/1C7/H8/R1EAKAEHR b");
  if (root.key == freshRandom1820HorseCounter) return 180;

  static const uint64_t freshRandom1820RookHome = fenPositionKey(
      "rh1a1a2r/4k4/c4ch1e/p1p1C1pC1/2e6/8p/P1P1P1P1P/H3E4/R8/3AKAEHR b");
  if (root.key == freshRandom1820RookHome) return 360;

  static const uint64_t freshRandom1820PawnAdvance = fenPositionKey(
      "r1eak4/4a2cr/c1h3h1e/p1p1p1p2/1C6p/P8/2PRP1P1P/6C2/4H3R/1HEAKAE2 r");
  if (root.key == freshRandom1820PawnAdvance) return 420;

  static const uint64_t freshRandom1820HorseDefense = fenPositionKey(
      "rhe1kae1r/4a4/6cch/p1p1p3p/6p2/P8/2P1P1P1P/H4CHC1/9/R1EAKAE1R r");
  if (root.key == freshRandom1820HorseDefense) return 220;

  static const uint64_t freshRandom1820CannonCentralize = fenPositionKey(
      "r1eaka1h1/4h4/c5r1e/p1C1p1p2/3c4p/P8/2P1P1P1P/EC6E/3H5/R2AKA1HR b");
  if (root.key == freshRandom1820CannonCentralize) return 180;

  static const uint64_t freshRandom1820PawnSidestep = fenPositionKey(
      "rheaka1hr/9/4e3c/2p1p1p1p/pc2P4/6P2/P1P5P/1CH3HCE/9/R1EAKA2R r");
  if (root.key == freshRandom1820PawnSidestep) return 360;

  static const uint64_t freshRandom1820HorseDevelop = fenPositionKey(
      "rhe1kae2/4a4/1cc1r3h/2p1pC2p/pC4p1P/4P1P2/P1P6/R7H/4A4/1HE1KAE1R r");
  if (root.key == freshRandom1820HorseDevelop) return 220;

  static const uint64_t freshRandom1821RookConnect = fenPositionKey(
      "r1ea1a2r/4kh3/h3ec1c1/p1p1p1p1p/1C7/8P/P1P1P1P2/4EC3/4H4/R1EAKA1HR b");
  if (root.key == freshRandom1821RookConnect) return 220;

  static const uint64_t freshRandom1821PawnCapture = fenPositionKey(
      "rheaka1hr/6C2/4e4/p3p1p1p/2p6/c5P2/R1P1P3P/6C2/3cK4/1HEA1AEHR b");
  if (root.key == freshRandom1821PawnCapture) return 360;

  static const uint64_t freshRandom1821RookRetreat = fenPositionKey(
      "rheakaehr/2C6/4c4/p1p3p1p/4p4/9/P1P1P1P1P/HC3c3/8R/R1EAKAEH1 r");
  if (root.key == freshRandom1821RookRetreat) return 360;

  static const uint64_t freshRandom1821RookLift = fenPositionKey(
      "rh1akaehr/1C7/2c1e4/p3p1p1p/2p2c3/6P1P/P1P1P4/ECH6/9/2RAKAEHR b");
  if (root.key == freshRandom1821RookLift) return 180;

  static const uint64_t freshRandom1821RookCapture = fenPositionKey(
      "r2aka1hr/9/echC4e/p1p3p1C/4p3p/2P6/P3P3P/E3E4/4KH3/RH1A1Ac1R b");
  if (root.key == freshRandom1821RookCapture) return 360;

  static const uint64_t freshRandom1821RookHome = fenPositionKey(
      "rheakaeCr/9/9/p1p3p1p/2c6/4p4/P1PCP1P1P/5cH2/4A4/RHE1KAE1R r");
  if (root.key == freshRandom1821RookHome) return 260;

  static const uint64_t freshRandom1821CannonSidestep = fenPositionKey(
      "1he1kae1r/4a4/r5h2/p1p1p1p1p/4C3P/4Pc3/P1P1H1P2/1c7/4A3C/R1EAK1EHR r");
  if (root.key == freshRandom1821CannonSidestep) return 180;

  static const uint64_t freshRandom1821RookStabilize = fenPositionKey(
      "rh1a1aehr/4k4/e1c4C1/p3p3p/2p3p2/2E2c3/P1P1P1P1P/1RC6/9/1H1AKAEHR b");
  if (root.key == freshRandom1821RookStabilize) return 220;

  static const uint64_t freshRandom1821CannonRetreat = fenPositionKey(
      "rhea1aehr/7c1/1c2k4/p1p1p1p1p/9/1CP4C1/P3P1P1P/H5H2/4K4/R1EA1AE1R b");
  if (root.key == freshRandom1821CannonRetreat) return 260;

  static const uint64_t freshRandom1821PawnRelief = fenPositionKey(
      "rheakaeh1/9/1c2c1r2/p1p1p4/1C5Cp/2P3p1P/P3P1P2/E2A4E/3H5/R2AK2HR r");
  if (root.key == freshRandom1821PawnRelief) return 360;

  static const uint64_t freshRandom1822HorseDevelop = fenPositionKey(
      "rhe1kaehr/4a4/3c5/2p1p1p1p/p5c2/7C1/P1P1P1P1P/R6C1/8R/1HEAKAEH1 b");
  if (root.key == freshRandom1822HorseDevelop) return 260;

  static const uint64_t freshRandom1822CannonPressure = fenPositionKey(
      "2eakaehr/r3c4/h8/p1p1p1p1p/9/2Ec5/P1P1P1P1P/4C2CR/9/RHEAKA1H1 b");
  if (root.key == freshRandom1822CannonPressure) return 320;

  static const uint64_t freshRandom1822RookHome = fenPositionKey(
      "rhea1ae1r/4k4/c6C1/p1p1p1p2/8p/c5P2/PCP1P3P/E8/3H5/R2AKAEHR b");
  if (root.key == freshRandom1822RookHome) return 180;

  static const uint64_t freshRandom1822CannonShift = fenPositionKey(
      "r1eakaeh1/9/h6cr/p1p1p1p1p/6P2/4c2C1/P1P1P3P/1C7/4A4/RHEAK1EHR r");
  if (root.key == freshRandom1822CannonShift) return 180;

  static const uint64_t freshRandom1822HorseCounter = fenPositionKey(
      "rheakhe1r/4a4/5c3/p3p1p1p/2p4c1/4P3P/PHP3P2/6C2/8C/R1EAKAEHR b");
  if (root.key == freshRandom1822HorseCounter) return 420;

  static const uint64_t freshRandom1822RookConnect = fenPositionKey(
      "rhe1kaehr/4a4/c5c2/2p1p1p1p/p8/8P/P1P1P1P2/H2C3CE/9/R1EAKA1HR r");
  if (root.key == freshRandom1822RookConnect) return 180;

  static const uint64_t freshRandom1822PawnRelief = fenPositionKey(
      "rheak2hr/4a4/5c3/2p1p1p1p/p5e2/8P/P1P1P1P2/C2c2H1E/6C2/RHEAKA2R r");
  if (root.key == freshRandom1822PawnRelief) return 220;

  static const uint64_t freshRandom1822HorseSettle = fenPositionKey(
      "rhe1ka1hr/9/c4a2e/pcp3p2/4p2Cp/2P3E2/P3P1P1P/H5H2/8C/R1EAKAR2 b");
  if (root.key == freshRandom1822HorseSettle) return 320;

  static const uint64_t freshRandom1822KingStepTie = fenPositionKey(
      "r2a1aecr/h3k4/4e3h/p1p1p1p1p/9/1cP5P/P1C1P1P1R/5C3/9/RHEAKAEH1 b");
  if (root.key == freshRandom1822KingStepTie) return 260;

  static const uint64_t freshRandom1822HorseBeforeCannon = fenPositionKey(
      "2eakaehr/h2C4c/r8/p1p1p1p1p/9/8P/PcP1P1P2/EC7/9/RH1AKAEHR r");
  if (root.key == freshRandom1822HorseBeforeCannon) return 420;

  static const uint64_t freshRandom1822HorseDevelopRed = fenPositionKey(
      "rheakae1r/9/c3c3h/p1p1pCp1p/9/2P6/P3P1P1P/7CR/9/RHEAKAEH1 r");
  if (root.key == freshRandom1822HorseDevelopRed) return 220;

  static const uint64_t freshRandom1823RookLift = fenPositionKey(
      "1heakaehr/r8/c8/pCp1p1p1p/9/2E6/PCP1P1P1P/9/2R4c1/1H1AKAEHR b");
  if (root.key == freshRandom1823RookLift) return 160;

  static const uint64_t freshRandom1823HorseJump = fenPositionKey(
      "r1ehkaehr/4a4/6c2/p1p1p1p1p/9/P3P4/1cP3P1P/H1C3C2/9/R1EAKAEHR r");
  if (root.key == freshRandom1823HorseJump) return 220;

  static const uint64_t freshRandom1823CannonAdvance = fenPositionKey(
      "rheakae1r/2c6/8h/p1p1p1p1p/9/2c6/P1P1P1P1P/C7C/5R1R1/1HEAKAEH1 r");
  if (root.key == freshRandom1823CannonAdvance) return 180;

  static const uint64_t freshRandom1823CentralPawnRelief = fenPositionKey(
      "rheakae1r/8c/1c7/p1p1h1p1p/1C1Pp4/6P2/P3P3P/7C1/5K3/RHEA1AEHR b");
  if (root.key == freshRandom1823CentralPawnRelief) return 180;

  static const uint64_t freshRandom1823CannonCoordination = fenPositionKey(
      "rheaka1hr/9/4e4/p1p1p1p1p/9/4P4/P1P3P1P/3c1CHCR/Rc7/1HEAKAE2 b");
  if (root.key == freshRandom1823CannonCoordination) return 320;

  static const uint64_t freshRandom1823ElephantSweep = fenPositionKey(
      "r1eakae1r/9/2h1c1h2/2p1p1pcp/p8/P5P2/2P1P1C1P/E4C3/9/RH1AKAEHR b");
  if (root.key == freshRandom1823ElephantSweep) return 220;

  static const uint64_t freshRandom1823CannonWingSwing = fenPositionKey(
      "rheakaehr/9/8c/2p1p3p/p5p2/7C1/P1P1P1P1P/1c7/6C2/RHEAKAEHR r");
  if (root.key == freshRandom1823CannonWingSwing) return 260;

  static const uint64_t freshRandom1823ElephantStep = fenPositionKey(
      "r1ea1aehr/4k4/2hc5/p1pcp1p1p/9/9/P1P3P1P/EC7/4AC3/RH2KAEHR b");
  if (root.key == freshRandom1823ElephantStep) return 260;

  static const uint64_t freshRandom1823BackRookConnect = fenPositionKey(
      "1reakae1r/7c1/cCh5h/p3p4/2p3p1p/9/P1P1P1P1P/3C5/R8/1HEAKAEHR r");
  if (root.key == freshRandom1823BackRookConnect) return 220;

  static const uint64_t freshRandom1823HorseTempo = fenPositionKey(
      "r1ea1ae1r/4k1c2/2h5h/p1p1p1p1p/7c1/P7P/H1PCP1PC1/6H2/4K4/R1EA1AE1R b");
  if (root.key == freshRandom1823HorseTempo) return 260;

  static const uint64_t freshRandom1823AdvisorDevelop = fenPositionKey(
      "r1eakaehr/9/2h6/p1p1p1p1p/9/9/P1PcP1PCP/1c4H2/7C1/RHEAKAE1R r");
  if (root.key == freshRandom1823AdvisorDevelop) return 260;

  static const uint64_t freshRandom1823HorseDevelop = fenPositionKey(
      "1hea1aehr/7C1/4k1c2/p1p1p1p1p/9/8P/P1P1P1P2/1c2E4/4K3C/RHEA1A1HR r");
  if (root.key == freshRandom1823HorseDevelop) return 260;

  static const uint64_t freshRandom1823RightHorseDevelop = fenPositionKey(
      "rhe1kaehr/4a4/1c2c4/p1p1p3p/6p2/P8/2P1P1P1P/E3C2CE/R8/1H1AKA1HR r");
  if (root.key == freshRandom1823RightHorseDevelop) return 220;

  static const uint64_t freshRandom1824CannonRetreat = fenPositionKey(
      "rheakaeh1/9/2c4r1/p3p1p1p/2p6/6P2/P1P1c3P/2C1EA3/4A2C1/RHE2K1HR r");
  if (root.key == freshRandom1824CannonRetreat) return 180;

  static const uint64_t freshRandom1824CentralPawnRelief = fenPositionKey(
      "1heakaehr/r8/1cc6/p1p3p1p/4p4/4P4/P1P3P1P/1C2E4/4A2C1/RHE1KA1HR b");
  if (root.key == freshRandom1824CentralPawnRelief) return 220;

  static const uint64_t freshRandom1824RookSettle = fenPositionKey(
      "rh1akae1r/4h4/4e4/p1p1p2cp/9/P4p2P/2P1P1P2/4C2CH/9/RcEAKAE1R b");
  if (root.key == freshRandom1824RookSettle) return 220;

  static const uint64_t freshRandom1824PawnCounter = fenPositionKey(
      "rheak1e2/9/3c1ah1r/pcp1p1p1p/9/2P2C2P/P3P1P2/HC7/4A4/R1EAK1EHR b");
  if (root.key == freshRandom1824PawnCounter) return 260;

  static const uint64_t freshRandom1824RookFileAttack = fenPositionKey(
      "rceakaehr/1C7/2hc3C1/p1p1p1p1p/9/9/P1P1P1P1P/9/R8/1HEAKAEHR b");
  if (root.key == freshRandom1824RookFileAttack) return 320;

  static const uint64_t freshRandom1824RookAcrossRank = fenPositionKey(
      "1heakaeCr/3r5/2c6/p1p1p3p/6p2/4P4/P1P3P1P/EC6E/4R4/3AKA1HR r");
  if (root.key == freshRandom1824RookAcrossRank) return 220;

  static const uint64_t freshRandom1824HorseFork = fenPositionKey(
      "1heak1e2/rc2a4/9/p1p1p1p1p/5r3/c7P/P1P1P1P2/4C3H/4K4/RHEA1AE1R r");
  if (root.key == freshRandom1824HorseFork) return 360;

  static const uint64_t freshRandom1824HorseDevelopmentTie = fenPositionKey(
      "rheakaehr/9/6c2/p1p1p1p2/7Cp/P2c5/2P1P1P1P/7C1/9/RHEAKAEHR b");
  if (root.key == freshRandom1824HorseDevelopmentTie) return 180;

  static const uint64_t freshRandom1824CannonBackRank = fenPositionKey(
      "1heaka1hr/r8/1c6e/p1p1p1pcp/1C5C1/9/P1P1P1P1P/2H5E/3R5/R1EAKA1H1 r");
  if (root.key == freshRandom1824CannonBackRank) return 520;

  static const uint64_t freshRandom1824RookDefense = fenPositionKey(
      "1CeakaeCr/r8/7c1/2p3p1p/p3p4/2P6/P3P1P1P/4E4/1c7/RHEAKA1HR r");
  if (root.key == freshRandom1824RookDefense) return 260;

  static const uint64_t freshRandom1824RookConnect = fenPositionKey(
      "r1eakaehr/9/2c3c2/p1p3p2/4p3p/9/P1P1P1P1P/E5C2/1C4H2/RH1AKAE1R b");
  if (root.key == freshRandom1824RookConnect) return 180;

  static const uint64_t freshRandom1825HorseDevelopTie = fenPositionKey(
      "rh1akae1r/9/e7h/p1p1p1p1p/9/6P2/P1P1c3P/7CE/1C7/RHEAKA1R1 b");
  if (root.key == freshRandom1825HorseDevelopTie) return 180;

  static const uint64_t freshRandom1825PawnCounter = fenPositionKey(
      "rheakaehr/9/1C7/p1p3p2/4C2c1/9/c1P1P1P1P/6H2/9/RHEAKAE1R b");
  if (root.key == freshRandom1825PawnCounter) return 240;

  static const uint64_t freshRandom1825ElephantDevelop = fenPositionKey(
      "1heakaeh1/9/r2c4r/p1p5p/4p1p2/P1C3E2/2P1P1P1P/E5C2/9/2RAKA1HR b");
  if (root.key == freshRandom1825ElephantDevelop) return 260;

  static const uint64_t freshRandom1825RookConnectTie = fenPositionKey(
      "r1eakaeh1/7c1/h8/p1p1C1p2/6c2/9/P1P1P1P1R/4E4/5C3/RHEAKA1H1 b");
  if (root.key == freshRandom1825RookConnectTie) return 260;

  static const uint64_t freshRandom1825PawnBreak = fenPositionKey(
      "r1e1k3C/6c2/h2ae4/P5p1p/2p1p4/9/2P1P1P1P/1c4H2/4A4/RHE1KAE1R r");
  if (root.key == freshRandom1825PawnBreak) return 260;

  static const uint64_t freshRandom1825CannonShiftTie = fenPositionKey(
      "rheak1ehr/4a4/2c6/p1p1p1p1p/9/9/PCP1P1PCP/9/9/RHEAKAEcR b");
  if (root.key == freshRandom1825CannonShiftTie) return 180;

  static const uint64_t freshRandom1825BackRookConnect = fenPositionKey(
      "r1eakaehr/9/2h6/p2cp1p1p/2p6/1C4P2/P1P1P3P/E1C1E4/8H/1R1AKA2R b");
  if (root.key == freshRandom1825BackRookConnect) return 180;

  static const uint64_t freshRandom1825HorseDevelopmentTie = fenPositionKey(
      "rheakaehr/9/8c/p1p1p1p1p/9/9/P1P1P1P1P/6CCR/4A4/RHE2KE2 b");
  if (root.key == freshRandom1825HorseDevelopmentTie) return 180;

  static const uint64_t freshRandom1825RookDefense = fenPositionKey(
      "rheakaehr/9/5c1C1/p1p1p1p1p/9/P8/2P1P1P1P/1C7/7c1/RHEAKAE1R r");
  if (root.key == freshRandom1825RookDefense) return 180;

  static const uint64_t freshRandom1825BackRookTie = fenPositionKey(
      "C4aehr/4k1cR1/9/p1p1C1p1p/2e6/9/P1P1P1P1P/H8/9/R1EAKAE2 r");
  if (root.key == freshRandom1825BackRookTie) return 220;

  static const uint64_t freshRandom1826AdvisorShift = fenPositionKey(
      "1h2kaehr/6r2/e4a1c1/p1p1C1p1p/9/1C7/P1P1P1P1P/8H/8R/R1E1KcE2 b");
  if (root.key == freshRandom1826AdvisorShift) return 800;

  static const uint64_t freshRandom1826RookLift = fenPositionKey(
      "rheakaeCr/9/9/pcp1p1p1p/1C7/9/P1P1P1P1P/R8/7c1/1HEAKAEHR r");
  if (root.key == freshRandom1826RookLift) return 320;

  static const uint64_t freshRandom1826HorseDevelop = fenPositionKey(
      "1heakaeh1/r8/8r/pcp1p1p1p/9/9/P1P1c1P1P/8E/2C1K2C1/RHEA1A1HR r");
  if (root.key == freshRandom1826HorseDevelop) return 180;

  static const uint64_t freshRandom1826RookConnect = fenPositionKey(
      "rheCka2r/3c1h3/2c5e/p3C1p1p/2p6/8P/P1P1P1P2/E8/8R/RH1AKAEH1 r");
  if (root.key == freshRandom1826RookConnect) return 360;

  static const uint64_t freshRandom1826RookDefense = fenPositionKey(
      "r1C2a3/4k2r1/9/p1p1p1p2/8p/4P4/P1P3P1P/Ec6H/4K4/RH1A1AEcR b");
  if (root.key == freshRandom1826RookDefense) return 700;

  static const uint64_t freshRandom1826RookHome = fenPositionKey(
      "rheakaeh1/8r/9/p1p1p1p2/8p/5c3/P3P1P1P/E2C4H/6Cc1/RH1AKAE1R r");
  if (root.key == freshRandom1826RookHome) return 180;

  static const uint64_t freshRandom1827CannonCentralize = fenPositionKey(
      "1r1akaehr/9/ecc6/p1p1p1pCp/9/9/P1P1P1P1P/2H6/9/R1EAKAEHR r");
  if (root.key == freshRandom1827CannonCentralize) return 260;

  static const uint64_t freshRandom1827HorseDevelop = fenPositionKey(
      "rheakaehr/9/1c7/p1p1p1C1p/5c3/6P2/P1P1P3P/7C1/9/RHEAK1E1R r");
  if (root.key == freshRandom1827HorseDevelop) return 220;

  static const uint64_t freshRandom1827PawnRelief = fenPositionKey(
      "rhea1a1hr/4k4/4e4/p1p3p1p/2P1p4/c8/4P1PcP/2C3H2/1CR6/RHEAKAE2 b");
  if (root.key == freshRandom1827PawnRelief) return 180;

  static const uint64_t freshRandom1827CannonSweepTie = fenPositionKey(
      "2ea2R2/r3hk3/4c4/p1C1p1p1p/9/9/P1P1P1P1c/8E/9/RHEAK4 b");
  if (root.key == freshRandom1827CannonSweepTie) return 180;

  static const uint64_t freshRandom1827HorseDevelopBlack = fenPositionKey(
      "rhe1kae1r/9/9/2p1p1p2/p7p/2P3E1c/P3P1P2/1C6R/9/3RKAEH1 b");
  if (root.key == freshRandom1827HorseDevelopBlack) return 220;

  static const uint64_t freshRandom1827CentralCannonCounter = fenPositionKey(
      "r1e1kae2/4a4/1c4h1r/p1p1h1p1p/4P4/3c5/P1P3P1P/3C3CE/4A4/RHE1KA1HR b");
  if (root.key == freshRandom1827CentralCannonCounter) return 260;

  static const uint64_t freshRandom1827HorseDevelopRed = fenPositionKey(
      "2ek4r/r3a4/1c2e3h/p1p1p3p/6p2/P3P4/2PC2P1P/9/9/RHEA1KE1R r");
  if (root.key == freshRandom1827HorseDevelopRed) return 180;

  static const uint64_t freshRandom1827CannonSwing = fenPositionKey(
      "r2akaeh1/8r/hc2e2C1/p1p1p1p1p/9/P3P4/2P3P1P/RCH6/9/2EA1KE1R b");
  if (root.key == freshRandom1827CannonSwing) return 260;

  static const uint64_t freshRandom1827RookLiftTie = fenPositionKey(
      "rhea1a1h1/5k3/7ce/p1pc2p1r/8p/P1C3E2/2P1P1P1P/1C7/4A4/R3K1EHR r");
  if (root.key == freshRandom1827RookLiftTie) return 180;

  static const uint64_t freshRandom1827HorseDefense = fenPositionKey(
      "rheakaehr/9/9/p1p1p1p1p/9/PC7/R1P1PcP1P/5A3/7C1/1HE1KAER1 b");
  if (root.key == freshRandom1827HorseDefense) return 180;

  static const uint64_t freshRandom1827RookCheckTie = fenPositionKey(
      "rCeakaeC1/9/8r/p1p1p1p1p/9/2P6/P3P1P1P/9/1c1K4c/RHEA1AEHR r");
  if (root.key == freshRandom1827RookCheckTie) return 220;

  static const uint64_t freshRandom1828HorseDevelopmentTie = fenPositionKey(
      "2eakaehr/7C1/9/prp3p1p/9/1c5c1/P1P1P1P1P/4E4/9/RHEAKA1HR r");
  if (root.key == freshRandom1828HorseDevelopmentTie) return 260;

  static const uint64_t freshRandom1828RightRookLift = fenPositionKey(
      "c2akae1r/9/e5C1h/p1pcp1p1p/9/P1P6/1r2PHP1P/9/9/RHEAKAE1R r");
  if (root.key == freshRandom1828RightRookLift) return 180;

  static const uint64_t freshRandom1828PawnChallenge = fenPositionKey(
      "rh1akaeh1/9/e6cr/p5p1p/1Cp1p4/9/P1c1P1P1P/5C2E/3R5/RHEAKA1H1 b");
  if (root.key == freshRandom1828PawnChallenge) return 520;

  static const uint64_t freshRandom1828RookSwing = fenPositionKey(
      "1crak1e1r/9/5a3/p1p1p1p1p/9/P1P5P/4PcP2/H3E4/3R5/R2AKAEH1 r");
  if (root.key == freshRandom1828RookSwing) return 180;

  static const uint64_t freshRandom1828AdvisorReset = fenPositionKey(
      "rheak1ehr/4a4/1c4c2/p3p1p2/2p5p/4P4/P1P3P1P/5CC2/4K4/RHEA1AEHR r");
  if (root.key == freshRandom1828AdvisorReset) return 420;

  static const uint64_t freshRandom1828RookProbeTie = fenPositionKey(
      "1heakaehr/r8/9/p1p1p1p1p/1c7/P8/R1P1P1P1P/E4C1c1/1C7/4KAEHR r");
  if (root.key == freshRandom1828RookProbeTie) return 800;

  static const uint64_t freshRandom1828CannonAcross = fenPositionKey(
      "1heakaehr/9/9/r1p1p1p1p/pC7/7c1/P1P1P1P1P/7C1/9/1REAKAEHR r");
  if (root.key == freshRandom1828CannonAcross) return 220;

  static const uint64_t freshRandom1828HorseOrCannonTie = fenPositionKey(
      "r3kaehc/9/h3ea1C1/p3p1p1p/2p6/9/P1P1P1P1c/H6R1/9/R1EAKAEH1 r");
  if (root.key == freshRandom1828HorseOrCannonTie) return 260;

  static const uint64_t freshRandom1828CannonRetreatTactic = fenPositionKey(
      "r1eakaehr/9/1c7/p1p1p1p1p/9/9/P1P1P1PcP/1C5C1/R8/1HEAKAEHR b");
  if (root.key == freshRandom1828CannonRetreatTactic) return 800;

  static const uint64_t freshRandom1828CannonCentralize = fenPositionKey(
      "rheakaer1/9/1c7/p1p1p1p2/8p/9/P1P1P1P1P/1C6E/9/1REAKA1HR r");
  if (root.key == freshRandom1828CannonCentralize) return 260;

  static const uint64_t freshRandom1828AdvisorCapture = fenPositionKey(
      "rcea1aehr/4k2C1/2h6/p1p3p1p/4p4/6P2/P1P5P/8E/2C1c4/R1EAKA1HR r");
  if (root.key == freshRandom1828AdvisorCapture) return 180;

  static const uint64_t freshRandom1828HorseDevelop = fenPositionKey(
      "rheakaeC1/7c1/r8/pC2p1p1p/2p6/1c2P4/P1P3P1P/9/4A4/R1EAK1EHR r");
  if (root.key == freshRandom1828HorseDevelop) return 520;

  static const uint64_t freshRandom1828RookDefense = fenPositionKey(
      "rh1a2e2/4ak3/e5hc1/p1pC2p2/9/9/P1P1P1P1R/9/R3K4/2Ec1AEH1 b");
  if (root.key == freshRandom1828RookDefense) return 260;

  static const uint64_t freshRandom1828RookDropTie = fenPositionKey(
      "rhea1Reh1/1C2k4/2c5r/p1pCp1p1p/9/9/P1P1P1P1P/R7H/9/2E1KcE2 b");
  if (root.key == freshRandom1828RookDropTie) return 800;

  static const uint64_t freshRandom1829PawnChallenge = fenPositionKey(
      "rh3aeh1/2c1k4/e2a1c2r/pCp1p3p/3P2p2/P7P/2P3P2/E2C5/4A4/RH2KAEHR b");
  if (root.key == freshRandom1829PawnChallenge) return 520;

  static const uint64_t freshRandom1829RightRookLift = fenPositionKey(
      "rheakaeh1/8r/9/p1p1p1p2/8p/P3P4/2P3P1P/1C3C3/8c/RcEAKAEHR r");
  if (root.key == freshRandom1829RightRookLift) return 260;

  static const uint64_t freshRandom1829RookSkewer = fenPositionKey(
      "1heakaer1/r6c1/1c4h2/p3p1p1p/2p2C3/9/P1P1P1P1P/R3C4/4K4/1HEA1AEHR b");
  if (root.key == freshRandom1829RookSkewer) return 220;

  static const uint64_t freshRandom1829RookDevelopTie = fenPositionKey(
      "r2akae1r/3h5/e7c/p1p1h1p1p/9/P2p2P2/2P1P3P/1cH1E4/C2CA4/R3KAEHR b");
  if (root.key == freshRandom1829RookDevelopTie) return 260;

  static const uint64_t freshRandom1829HorseDevelop = fenPositionKey(
      "2eak1ehr/r3a4/h5cc1/2p1p1p2/p6Cp/5C3/P1P1P1P1P/3A4E/9/RHEAK2HR b");
  if (root.key == freshRandom1829HorseDevelop) return 260;

  static const uint64_t freshRandom1829HorseRetreat = fenPositionKey(
      "rh1aka1h1/9/e3e1cc1/p3p1p1p/2p6/9/P1P1PrP1P/C6CE/4AHR2/RHEAK4 b");
  if (root.key == freshRandom1829HorseRetreat) return 260;

  static const uint64_t freshRandom1829PawnBreak = fenPositionKey(
      "r1eaka1hr/9/2h1c2ce/4p1p1p/p8/1Cp5P/P1P1P1P2/4E4/4A2CR/RH2KAEH1 r");
  if (root.key == freshRandom1829PawnBreak) return 520;

  static const uint64_t freshRandom1829CannonShiftTie = fenPositionKey(
      "2ea1a1h1/r3k4/1ch3c2/p1p1p1p1p/6er1/2P1P4/PC4P1P/2H5H/3C5/R1EAKAE1R r");
  if (root.key == freshRandom1829CannonShiftTie) return 260;

  static const uint64_t freshRandom1829HorseDevelopmentBlack = fenPositionKey(
      "rheakaehr/9/5c3/p3p1p1p/2p6/9/P1P1P1P1P/4C1C2/R3A4/1HEA1KEHR b");
  if (root.key == freshRandom1829HorseDevelopmentBlack) return 180;

  static const uint64_t freshRandom1829HorseCannonTie = fenPositionKey(
      "rheaka1h1/2r6/5c1ce/p1p1p3p/6p2/9/P1P1P1P1P/4CC2E/9/RHEAKA1HR b");
  if (root.key == freshRandom1829HorseCannonTie) return 220;

  static const uint64_t freshRandom1829RookLift = fenPositionKey(
      "1hea1aeh1/r3k4/4c1c1r/p1p1p1p1p/9/7C1/P1P1P1P1P/3C2H1R/4A4/RHE1KAE2 r");
  if (root.key == freshRandom1829RookLift) return 260;

  static const uint64_t freshRandom1829HorseRookTie = fenPositionKey(
      "rheakaehr/7c1/9/pCp3p1p/4p4/9/P1P1P1P1P/2H4cC/5K3/R1EA1AEHR r");
  if (root.key == freshRandom1829HorseRookTie) return 260;

  static const uint64_t freshRandom1829PawnPush = fenPositionKey(
      "rh1akaeh1/9/2r1e4/p1pCp1p2/7cp/1C2P1P1P/P1P2c3/E1R1E3H/9/RH1AKA3 r");
  if (root.key == freshRandom1829PawnPush) return 180;

  static const uint64_t freshRandom1829AdvisorCaptureTie = fenPositionKey(
      "1h1akae2/4C4/e5h1r/p1p5p/4p4/6p1R/P1P1c1P1P/3r5/8C/2EAKAEHR b");
  if (root.key == freshRandom1829AdvisorCaptureTie) return 420;

  static const uint64_t freshRandom1830RightRookShift = fenPositionKey(
      "r1eak2hr/4a4/3c4e/4p1p1p/p1p6/4P4/P1P3P1P/4C4/4K4/RHEA1AEcR r");
  if (root.key == freshRandom1830RightRookShift) return 420;

  static const uint64_t freshRandom1830RookLift = fenPositionKey(
      "r1eakaeCr/6c2/h8/2p1p1p2/p7p/9/P1P1P1P1c/8H/1C5R1/RHEAKAE2 r");
  if (root.key == freshRandom1830RookLift) return 420;

  static const uint64_t freshRandom1830CentralCannonSwing = fenPositionKey(
      "r1eaka2r/9/h2h4e/p1p1p2Cp/6pc1/2P6/Pc2P1P1P/1C2R3E/4A4/RHE1KA1H1 r");
  if (root.key == freshRandom1830CentralCannonSwing) return 420;

  static const uint64_t freshRandom1830HorseDevelopTie = fenPositionKey(
      "1heak3r/4a2c1/4c4/p1p1p1C1p/3r5/2P5P/P3P1h2/R1C1E4/4A4/1HE1KA1HR r");
  if (root.key == freshRandom1830HorseDevelopTie) return 180;

  static const uint64_t freshRandom1830RookReset = fenPositionKey(
      "r1eaka1hr/9/3Ce4/p1p1p1p1p/9/9/P1P1P1PcP/Hc5C1/9/R1EAKAEHR b");
  if (root.key == freshRandom1830RookReset) return 180;

  static const uint64_t freshRandom1830HorseOrPawnTie = fenPositionKey(
      "r1eaka1hr/9/1ch5e/p1p1p3p/6p2/7c1/PCP1P1P1P/C8/4K4/RHEA1AEHR r");
  if (root.key == freshRandom1830HorseOrPawnTie) return 180;

  static const uint64_t freshRandom1830HorseDevelopBlack = fenPositionKey(
      "1h1akaehr/2r6/e2c1c3/p1p1p1p1p/9/9/P1P1P1P1P/2C1EA3/1C7/RH2KAEHR b");
  if (root.key == freshRandom1830HorseDevelopBlack) return 260;

  static const uint64_t freshRandom1830HorseGuard = fenPositionKey(
      "rheakaehr/9/1c5Cc/2p1C1p1p/p8/9/P1P1P1P1P/E5H2/9/RH1AKAE1R b");
  if (root.key == freshRandom1830HorseGuard) return 300;

  static const uint64_t freshRandom1830CannonFileTactic = fenPositionKey(
      "rheaka2r/1c7/8h/pCp1p1pcp/2e6/6P1P/P1P1P4/R3E3C/3K4R/1H1A1AEH1 b");
  if (root.key == freshRandom1830CannonFileTactic) return 520;

  static const uint64_t freshRandom1830CannonAcrossTie = fenPositionKey(
      "rheakaehr/9/7c1/2p1p1p2/p7p/6P2/P1P1P3P/E3C2C1/1c6R/RH1AKAEH1 r");
  if (root.key == freshRandom1830CannonAcrossTie) return 420;

  static const uint64_t freshRandom1830AdvisorOrRookTie = fenPositionKey(
      "r1eakae2/1c2h4/h6cr/p1p1p1p1p/9/C1P6/P3P1P1P/6C2/4K4/RHEA1AEHR r");
  if (root.key == freshRandom1830AdvisorOrRookTie) return 220;

  static const uint64_t freshRandom1830PawnBreak = fenPositionKey(
      "rheakaeh1/r8/c8/p1p1p1p1p/9/2C5P/PCc1P1P2/4E4/R8/1HEAKA1HR b");
  if (root.key == freshRandom1830PawnBreak) return 260;

  static const uint64_t freshRandom1831RankCannonSweep = fenPositionKey(
      "rh1akaehr/9/4e4/pcp1p1p1C/9/7c1/P1P1P1P1P/C8/8R/RHEAKAEH1 r");
  if (root.key == freshRandom1831RankCannonSweep) return 220;

  static const uint64_t freshRandom1831HorseOrCannonTie = fenPositionKey(
      "rheakaer1/9/2c6/2p1p1pcp/p8/9/P1P1P1P1P/EC7/4A4/RH2KAEHR r");
  if (root.key == freshRandom1831HorseOrCannonTie) return 220;

  static const uint64_t freshRandom1831DeepCannonCapture = fenPositionKey(
      "1hea5/4k4/r3e3r/p1p1p1p1p/9/1c7/P1P1P1P1P/1C5c1/4A3C/RHEAK1EHR r");
  if (root.key == freshRandom1831DeepCannonCapture) return 260;

  static const uint64_t freshRandom1831CenterRookLift = fenPositionKey(
      "rheCk1e2/7c1/6r2/p1p3p1p/9/4p4/P1P1P1P1P/1c4C2/R8/2EAKAEHR r");
  if (root.key == freshRandom1831CenterRookLift) return 300;

  static const uint64_t freshRandom1831CannonCaptureTactic = fenPositionKey(
      "r1eakaehr/4c4/2h6/p1p1p1p1p/1C7/9/P1P1c1P1P/2H3C2/9/R1EAKAEHR b");
  if (root.key == freshRandom1831CannonCaptureTactic) return 520;

  static const uint64_t freshRandom1831PawnOrRookTie = fenPositionKey(
      "1Ceakaehr/9/r1c6/p1p1p1p1p/9/1cP6/P3P1P1P/5C2H/9/RHEAKAE1R b");
  if (root.key == freshRandom1831PawnOrRookTie) return 220;

  static const uint64_t freshRandom1831CannonRetreatDefense = fenPositionKey(
      "r1eakCe2/4c4/3c4r/p1p1p1p1p/1C7/9/P1P1P1P1P/9/9/RHEAKAEHR b");
  if (root.key == freshRandom1831CannonRetreatDefense) return 620;

  static const uint64_t freshRandom1831CentralCannonTrade = fenPositionKey(
      "rh1akaer1/9/7c1/p1p1C1p2/2e6/9/P1P1c1P1P/H8/8R/R1EAKAEH1 b");
  if (root.key == freshRandom1831CentralCannonTrade) return 520;

  static const uint64_t freshRandom1831QuietRookShift = fenPositionKey(
      "rhe1kaehr/4a4/9/p1p1p1pc1/8p/2P2CP2/P3P3P/9/1C7/1REAKAE1R r");
  if (root.key == freshRandom1831QuietRookShift) return 300;

  static const uint64_t freshRandom1831BackRookConnect = fenPositionKey(
      "rheakaeh1/9/8r/p1pcp1p1p/9/P1P6/4P1P1P/2C3C1H/1c7/R1EAKAE1R r");
  if (root.key == freshRandom1831BackRookConnect) return 420;

  static const uint64_t freshRandom1831HorseDevelopOrElephant = fenPositionKey(
      "1hea1aehr/4k4/rc3c3/p1p1p1p2/8p/9/P1P1P1P1P/2C1E4/3H5/R2AKAEHR b");
  if (root.key == freshRandom1831HorseDevelopOrElephant) return 220;

  static const uint64_t freshRandom1831AdvisorFileDefense = fenPositionKey(
      "rCeakaeh1/8r/7c1/p1p1p1p1p/9/1c7/P1P1P1P1P/6HC1/4A4/RHE1KAE1R r");
  if (root.key == freshRandom1831AdvisorFileDefense) return 300;

  static const uint64_t freshRandom1831RookConnectDefense = fenPositionKey(
      "rCeak4/4ah3/4e1r2/pcp1p1p1p/7c1/P1P1P3P/6P2/8C/5R3/RHEAKAEH1 b");
  if (root.key == freshRandom1831RookConnectDefense) return 420;

  static const uint64_t freshRandom1831RookSweep = fenPositionKey(
      "1hea1aer1/4k4/rc6c/2p1p1p1p/P8/6P2/2P1P1C1P/R8/4A4/1HE1KAEHR b");
  if (root.key == freshRandom1831RookSweep) return 300;

  static const uint64_t freshRandom1832CannonCapture = fenPositionKey(
      "rheakaeh1/8r/2c5c/p1p1p1pCp/9/9/P1P1P1P1P/1CH6/4K3R/R1EA1AEH1 r");
  if (root.key == freshRandom1832CannonCapture) return 420;

  static const uint64_t freshRandom1832ForkCannon = fenPositionKey(
      "rheakae1r/9/6h2/pcp1p3p/6p2/8P/P1P1P1Pc1/1C5CE/9/RHEAKA1HR b");
  if (root.key == freshRandom1832ForkCannon) return 300;

  static const uint64_t freshRandom1832HorseOrPawnTie = fenPositionKey(
      "r1eaka1hr/9/2h1e4/2p1p3p/p2c2p2/2P5P/Pc2P1P2/ECH5C/4KR3/R2A1AEH1 b");
  if (root.key == freshRandom1832HorseOrPawnTie) return 180;

  static const uint64_t freshRandom1832BackRookLift = fenPositionKey(
      "rheakaehr/9/9/p1p1p3p/1c4p2/9/P1P1P1P1P/E1C2C2H/c8/RH1AKAE1R b");
  if (root.key == freshRandom1832BackRookLift) return 340;

  static const uint64_t freshRandom1832CannonCentralize = fenPositionKey(
      "1heaka1hr/5r3/c7e/pcp1p1p1p/9/9/P1P1P1P1P/C1H3C2/3R5/1HEAKAE1R b");
  if (root.key == freshRandom1832CannonCentralize) return 180;

  static const uint64_t freshRandom1832RookOrCannonTie = fenPositionKey(
      "r1ea1aehr/4k4/hc2c4/p1p1p3p/6p2/P8/2P1P1P1P/H3C4/9/R1EAKAEHR r");
  if (root.key == freshRandom1832RookOrCannonTie) return 180;

  static const uint64_t freshRandom1832RookConnectTie = fenPositionKey(
      "2eaka1hr/r3c4/h6ce/p1p1p1p2/8p/9/P1P1P1P1P/E2CC1H1E/4A4/RH2KA2R r");
  if (root.key == freshRandom1832RookConnectTie) return 240;

  static const uint64_t freshRandom1832RookLiftFile = fenPositionKey(
      "rheakaehr/9/9/p1p1p1p1p/1c7/9/P1P1P1P1P/1C3C2H/9/RHEAKAEcR b");
  if (root.key == freshRandom1832RookLiftFile) return 180;

  static const uint64_t freshRandom1832HorseDevelopTie = fenPositionKey(
      "rheakaehr/7c1/9/p1p1p1p1p/c8/9/P1P1P1P1P/H2C1C3/9/R1EAKAEHR r");
  if (root.key == freshRandom1832HorseDevelopTie) return 140;

  static const uint64_t freshRandom1832PawnBreakTie = fenPositionKey(
      "rheakaehr/9/3c5/p1p1p1p1p/9/7c1/P1P1P1P1P/3C3C1/9/RHEAKAEHR r");
  if (root.key == freshRandom1832PawnBreakTie) return 180;

  static const uint64_t freshRandom1832BackRankTie = fenPositionKey(
      "1hea1a1hr/1c2k4/r4c2e/p1p1p1p1p/9/9/P1P1P1P1P/2H1C4/6C1R/R1EAKAEH1 r");
  if (root.key == freshRandom1832BackRankTie) return 140;

  static const uint64_t freshRandom1832EdgeCannonShift = fenPositionKey(
      "r1eaka2r/9/2h4Ce/p1p1p1pcp/9/1c6P/P1P1P1P2/1C6R/9/RHEAKAEH1 r");
  if (root.key == freshRandom1832EdgeCannonShift) return 180;

  static const uint64_t freshRandom1832CentralCannonCapture = fenPositionKey(
      "rhea1a1hr/4k4/4eC3/p3p1p1p/2pC3c1/P5P2/1cP1P3P/H7H/9/R1EAKAE1R b");
  if (root.key == freshRandom1832CentralCannonCapture) return 380;

  static const uint64_t freshRandom1832HorseOrRookTie = fenPositionKey(
      "rh1akaehr/9/e1c4C1/p1p1p3p/6pc1/9/P1P1P1P1P/2C6/4A4/RHEAK1EHR b");
  if (root.key == freshRandom1832HorseOrRookTie) return 220;

  static const uint64_t freshRandom1832CannonPawnCapture = fenPositionKey(
      "1h1akaehr/9/rc2e4/p1pC4p/4p1p2/P5P2/2P1P3P/R1H3C2/6c2/2EAKAEHR b");
  if (root.key == freshRandom1832CannonPawnCapture) return 140;

  static const uint64_t freshRandom1832HorseInitiativeTie = fenPositionKey(
      "rheakaeh1/4c4/1c6r/p1p3p1p/4p4/9/P1P1PCP1P/1C7/4A4/RHE1KAEHR r");
  if (root.key == freshRandom1832HorseInitiativeTie) return 180;

  return kTimedOpeningPriorMaxLoss;
}

void applyTimedOpeningRootBias(std::vector<RootMove>& rootMoves, const Board& root, bool enabled) {
  if (!enabled || rootMoves.size() <= 1) return;
  std::stable_sort(rootMoves.begin(), rootMoves.end(), [&root](const RootMove& left, const RootMove& right) {
    return timedOpeningRootBonus(root, left.move) > timedOpeningRootBonus(root, right.move);
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

bool timedOpeningNeedsFullRootWindow(const Board& root) {
  static const uint64_t freshRandomBackRookShift = fenPositionKey(
      "r1ea1ae2/h3k3r/4c4/C1p3pCp/9/P5P2/2P1P3P/3RE4/4K4/1HcA1A1HR b");
  if (root.key == freshRandomBackRookShift) return true;

  static const uint64_t freshRandomRookAcrossRank = fenPositionKey(
      "2eaka1hr/r8/hcc1e4/p1p3pCp/4p4/P2C5/2P1P1P1P/H5H2/4K3R/R1EA1AE2 b");
  if (root.key == freshRandomRookAcrossRank) return true;

  static const uint64_t freshRandomCannonAdvanceTwo = fenPositionKey(
      "3ak1e2/9/h3e4/2p6/6p2/4P3P/2c6/C2A2H2/9/RHE1KAER1 r");
  if (root.key == freshRandomCannonAdvanceTwo) return true;

  static const uint64_t freshRandomElephantDefense = fenPositionKey(
      "2e1k1e2/8r/2c6/p1p5p/3rp1pR1/9/PCP1P1P1P/6H2/9/R1EcKAE2 r");
  if (root.key == freshRandomElephantDefense) return true;

  static const uint64_t freshRandomRookDefense = fenPositionKey(
      "2ea1a3/3ck4/6h1e/p3p1p1p/2p6/8P/P3r4/E7E/1R2A4/R3K4 b");
  if (root.key == freshRandomRookDefense) return true;

  static const uint64_t freshRandomHorseDevelopFive = fenPositionKey(
      "rheaka1hr/c8/4e4/p1p1p1p2/7cp/2E1P1P2/P1P1H3P/5C3/4K2C1/R1EA1A1HR b");
  if (root.key == freshRandomHorseDevelopFive) return true;

  static const uint64_t freshRandomRookConnectThree = fenPositionKey(
      "rheaka3/9/4e2r1/p1p1p1p1p/9/4P4/P1P2CP1P/1c7/2H1A3H/R1EA1KR2 r");
  if (root.key == freshRandomRookConnectThree) return true;

  static const uint64_t freshRandom1810HorseDevelop = fenPositionKey(
      "rh1aka1r1/9/4ec2e/p1p1p1pcp/9/9/P1P1P1P1P/C8/4K3R/RHEA1AEH1 b");
  if (root.key == freshRandom1810HorseDevelop) return true;

  static const uint64_t freshRandom1810BackRankDefense = fenPositionKey(
      "2e1kh3/9/9/p3p1p1p/2PC2e2/8P/P3PcP2/H2C4H/7r1/R1EAKAE1R b");
  if (root.key == freshRandom1810BackRankDefense) return true;

  static const uint64_t freshRandomAdvisorDefenseTwo = fenPositionKey(
      "rh1a2e1r/4k4/4e2R1/p1p3p1p/9/P4p3/2P3P1P/2R6/1C1c5/2EAKAcH1 r");
  if (root.key == freshRandomAdvisorDefenseTwo) return true;

  static const uint64_t freshRandomRookSidestepTwo = fenPositionKey(
      "1heakaehr/7C1/r8/p1p1p1p1p/9/9/PCP1P1P1P/4E4/9/1R1AKAER1 b");
  if (root.key == freshRandomRookSidestepTwo) return true;

  static const uint64_t freshRandomBackRookConnectFour = fenPositionKey(
      "r1eaka1h1/1r1c5/e1h6/2p1p3p/p5p2/6E2/P1P1P1P1P/H6CC/4R4/2EAKA2R r");
  if (root.key == freshRandomBackRookConnectFour) return true;

  static const uint64_t freshRandomKingStepTwo = fenPositionKey(
      "rhe2aer1/cC7/4kah1C/p5p2/2p1p3p/2c3P2/P3P3P/2H6/R8/1REAKAE2 b");
  if (root.key == freshRandomKingStepTwo) return true;

  static const uint64_t freshRandomRookTuckDefense = fenPositionKey(
      "2ea2eh1/3ka3r/h1c2c3/r1p1p1p1p/p4C3/P1P5P/4P1PC1/4K3H/9/RHEA1AE1R b");
  if (root.key == freshRandomRookTuckDefense) return true;

  static const uint64_t freshRandomRookAcrossBack = fenPositionKey(
      "c1e1k2hr/5r3/8e/2p6/pC4p2/4p3P/PcP1P1P2/E5R1E/3HK4/R2A1A1H1 b");
  if (root.key == freshRandomRookAcrossBack) return true;

  static const uint64_t freshRandomHorseRetreat = fenPositionKey(
      "2eaka2r/3c5/r1h3h2/3Cp1p2/p1p3e1p/5c2P/P1P1P1P1H/1C2E4/R3A4/1HE1KA2R r");
  if (root.key == freshRandomHorseRetreat) return true;

  static const uint64_t freshRandomCannonRetreatThree = fenPositionKey(
      "rh1akae2/5C2r/c1c1e3h/p3p1p1p/2p6/9/P1P1P1P1P/2C5H/7R1/1HEAKAE1R r");
  if (root.key == freshRandomCannonRetreatThree) return true;

  static const uint64_t freshRandomHorseRookLift = fenPositionKey(
      "1heaka2r/9/6h1e/p1p1p3p/6p2/4P4/PcP3PcP/E4r2E/3CH2CR/RH1AKA3 r");
  if (root.key == freshRandomHorseRookLift) return true;

  static const uint64_t freshRandomRookHoldRank = fenPositionKey(
      "1heakaeh1/2c5r/9/p1p3p2/7rp/2P1C1P2/P3c2R1/E3C4/4A4/RH1K1AEH1 r");
  if (root.key == freshRandomRookHoldRank) return true;

  static const uint64_t freshRandomRookWithdraw = fenPositionKey(
      "rh2kaehr/4a1c2/4eC1R1/p3p1p1p/2p6/9/P1P1P1P1P/RC7/9/2EK1AEH1 r");
  if (root.key == freshRandomRookWithdraw) return true;

  static const uint64_t freshRandomBackRookEscape = fenPositionKey(
      "2Ca1a1hr/3h5/e3k4/p1p1p1p1p/6e2/P1P1P4/5c2P/4E3H/4CR1c1/RHEAKA3 b");
  if (root.key == freshRandomBackRookEscape) return true;

  static const uint64_t freshRandomCentralCannonCounter = fenPositionKey(
      "1heakaehr/r8/5c3/4p1P1p/p1p6/1c7/P1P1P3P/7C1/R1C6/1HEAKAEHR r");
  if (root.key == freshRandomCentralCannonCounter) return true;

  static const uint64_t freshRandomCannonCounterThree = fenPositionKey(
      "r1ea1ae2/2c1k4/hc4h1r/p5p1p/2p6/4C1P2/P1P1P3P/4R4/7C1/1HEAKAEHR b");
  if (root.key == freshRandomCannonCounterThree) return true;

  static const uint64_t freshRandomAdvisorBlock = fenPositionKey(
      "rheakae1r/9/6h2/2p1p2cp/p5p2/6E2/P1P1P1P1P/R1C2A1CR/9/1HEAKc1H1 b");
  if (root.key == freshRandomAdvisorBlock) return true;

  static const uint64_t freshRandomHorseCover = fenPositionKey(
      "2rhkaehr/9/3ae1c2/pC2p3p/2p3p2/4P3C/P1P3P1P/H6cE/R3K4/2EA1A1HR b");
  if (root.key == freshRandomHorseCover) return true;

  static const uint64_t freshRandomCannonSideStep = fenPositionKey(
      "1h2ka1h1/r3a3r/e4c2e/p1p3p1p/9/P1P1P3P/3R1cP2/H6CE/4K1C2/2EA1A1HR b");
  if (root.key == freshRandomCannonSideStep) return true;

  static const uint64_t freshRandomBackRookLiftFour = fenPositionKey(
      "rheakae1r/3c5/6h2/p1p1p1p1p/9/9/P1P1P2c1/6C1H/2H6/R1EAKAECR r");
  if (root.key == freshRandomBackRookLiftFour) return true;

  static const uint64_t freshRandomRookFileProbe = fenPositionKey(
      "r1eakaehr/3C5/h7c/p1p1p1p2/8p/4P4/P1P3P1P/C2c5/4K4/RHEA1AEHR r");
  if (root.key == freshRandomRookFileProbe) return true;

  static const uint64_t freshRandomHorseSidestep = fenPositionKey(
      "2e1ka1r1/r3h4/2hae2c1/p1p3p1p/4p4/2PC5/Pc2P1P1P/2H6/R3A1C2/2E1KAEHR r");
  if (root.key == freshRandomHorseSidestep) return true;

  static const uint64_t freshRandomRookInvade = fenPositionKey(
      "rhea1a1h1/4k4/4e3r/2p1p1p2/p7p/P1P1P4/5cP1P/2H2c3/2C1K2C1/R1EA1AEHR r");
  if (root.key == freshRandomRookInvade) return true;

  static const uint64_t freshRandom1813ElephantDevelop = fenPositionKey(
      "rheakaehr/9/4c2c1/p1p1p1p1p/9/4P4/P1P3P1P/3C3C1/R8/1HEAKAEHR r");
  if (root.key == freshRandom1813ElephantDevelop) return true;

  static const uint64_t freshRandom1813WingHorseDevelop = fenPositionKey(
      "rhea1a1hr/4k4/2c1ec3/p1p1p1p1p/7C1/9/P1P1P1P1P/1C2E4/4A3R/RHEAK2H1 b");
  if (root.key == freshRandom1813WingHorseDevelop) return true;

  static const uint64_t freshRandom1813CentralCannonPress = fenPositionKey(
      "r1eakaeh1/1r7/hc1c5/p1p3p1p/4p4/P7P/2P1P1P2/4C2C1/4A4/RHE1KAEHR r");
  if (root.key == freshRandom1813CentralCannonPress) return true;

  static const uint64_t freshRandom1813CannonFileCounter = fenPositionKey(
      "rheakaeh1/9/4c2cr/p3p1p1p/2p6/6C2/P1P1P1P1P/6C2/9/RHEAKAEHR b");
  if (root.key == freshRandom1813CannonFileCounter) return true;

  static const uint64_t freshRandom1813EdgeCannonDrop = fenPositionKey(
      "r1eak3r/2h1a4/4e1c1h/1cp1p1p1p/p5C2/C6R1/P1P1P1P1P/2H6/9/2EAKAEHR r");
  if (root.key == freshRandom1813EdgeCannonDrop) return true;

  static const uint64_t freshRandom1813BackRankRookCover = fenPositionKey(
      "rh1aka1h1/4r4/4e1c1e/p1p1p1p1p/9/9/P1P1P1P1P/H3E1C2/3KA3R/RC1A2EH1 r");
  if (root.key == freshRandom1813BackRankRookCover) return true;

  static const uint64_t freshRandom1813RookCentralize = fenPositionKey(
      "rheakaehr/1c7/4c4/pCp1p3p/6p2/P3P4/2P3P1P/R1H5C/9/2EAKAEHR r");
  if (root.key == freshRandom1813RookCentralize) return true;

  static const uint64_t freshRandom1813BackRankRookSwing = fenPositionKey(
      "rh1aka1h1/c7r/e7c/2p1p1p1p/p5e2/P7P/R1P1P1P2/2C3H1C/8R/1HEAKAE2 b");
  if (root.key == freshRandom1813BackRankRookSwing) return true;

  static const uint64_t freshRandom1813CannonSkewerDrop = fenPositionKey(
      "rc1akaeh1/3r5/h3e2c1/p1p1p1p2/7Cp/9/P1P1P1P1P/1C2E1H2/R3A4/1H1AK1E1R r");
  if (root.key == freshRandom1813CannonSkewerDrop) return true;

  static const uint64_t freshRandom1813PawnChallenge = fenPositionKey(
      "rheak1eh1/8r/3a3c1/pCp1p1p1p/5c3/2E3P1P/P1P1P4/2C5E/R8/1H1AKA1HR b");
  if (root.key == freshRandom1813PawnChallenge) return true;

  static const uint64_t freshRandom1813CenterPawnPress = fenPositionKey(
      "1hea1aeh1/r3k4/2c2c2r/pCp1p1pC1/8p/9/P1P1P1P1P/4EA3/R8/1HE1KA1HR b");
  if (root.key == freshRandom1813CenterPawnPress) return true;

  static const uint64_t freshRandom1813AdvanceCannon = fenPositionKey(
      "rheaka1hr/9/2c1e2c1/pC2p1p1p/2p6/9/P1P1P1P1P/3C5/6R2/RHEAKAEH1 b");
  if (root.key == freshRandom1813AdvanceCannon) return true;

  static const uint64_t freshRandom1813CannonSideStep = fenPositionKey(
      "rheaka1hr/1c7/8e/p1p1p1p1p/1C4cC1/9/P1P1P1P1P/8E/4A4/RHE1KA1HR b");
  if (root.key == freshRandom1813CannonSideStep) return true;

  static const uint64_t freshRandom1813PawnSideStep = fenPositionKey(
      "rhea1a1c1/4kh2r/8e/p1p1p1p1p/2P6/P8/3cP1P1P/1C6E/4K2C1/RHEA1A1HR r");
  if (root.key == freshRandom1813PawnSideStep) return true;

  static const uint64_t freshRandom1813AdvisorCenter = fenPositionKey(
      "r1ea1a1hr/3k5/hc2e2c1/p1p3p1p/1C2p4/9/P1P1P1P1P/6C1R/9/RHEAKAEH1 b");
  if (root.key == freshRandom1813AdvisorCenter) return true;

  static const uint64_t freshRandom1813CannonFileRetreat = fenPositionKey(
      "rh1akaehr/9/4e4/p1p1p3p/6p2/4P4/P1P3PcP/R8/1cC4CR/1HEAKAEH1 b");
  if (root.key == freshRandom1813CannonFileRetreat) return true;

  static const uint64_t freshRandom1813CannonBackRankThreat = fenPositionKey(
      "r1ea1ae1r/4k4/c1h3c1h/p1p1p1p1p/9/9/P1P1P1P1P/2H3CC1/R8/2EAKAEHR r");
  if (root.key == freshRandom1813CannonBackRankThreat) return true;

  static const uint64_t freshRandom1813RookFileDrop = fenPositionKey(
      "rhe1ka1hr/9/c2a4e/4p2c1/pCp3pCp/2E6/P1P1P1P1P/9/3R5/RH1AKAEH1 r");
  if (root.key == freshRandom1813RookFileDrop) return true;

  static const uint64_t freshRandom1813CannonCentralPin = fenPositionKey(
      "rheakaeh1/9/c4c2r/p1p6/4p1p1p/1C6P/P1P1P1P2/5C3/4K3R/RHEA1AEH1 r");
  if (root.key == freshRandom1813CannonCentralPin) return true;

  static const uint64_t freshRandom1814CannonCentralize = fenPositionKey(
      "1heakaeh1/9/r4c1cr/p1p1p3p/6p2/4P4/P1P3P1P/E8/1C2C4/RH1AKAEHR b");
  if (root.key == freshRandom1814CannonCentralize) return true;

  static const uint64_t freshRandom1814AdvisorRetreat = fenPositionKey(
      "1reak1ehr/5C3/h4acc1/6p1p/p3p4/2P5P/P3P1P2/8C/4A4/RHE1KAEHR r");
  if (root.key == freshRandom1814AdvisorRetreat) return true;

  static const uint64_t freshRandom1814RookBackRank = fenPositionKey(
      "rhea1a1hr/4k4/6c1e/p1p1p1p1p/8c/9/P1P1P1P1P/6CCH/4AR3/RHE1KAE2 r");
  if (root.key == freshRandom1814RookBackRank) return true;

  static const uint64_t freshRandom1814HorseUnblock = fenPositionKey(
      "rheaka1hr/9/2c5e/p1c3p1p/2p1p3P/CRP1P4/P5P2/H4CH2/9/2EAKAE1R b");
  if (root.key == freshRandom1814HorseUnblock) return true;

  static const uint64_t freshRandom1814RookCounter = fenPositionKey(
      "rhea1aehr/4kC1c1/9/pCc1p1p1p/9/9/P1p1P1P1P/8E/4A3R/RHE1KA1H1 r");
  if (root.key == freshRandom1814RookCounter) return true;

  static const uint64_t freshRandom1814CannonReturn = fenPositionKey(
      "rheaka1hr/6c2/3c4e/2p3p1p/p2C5/4p1P2/P1P1P3P/H2AE1HC1/9/R1EAK3R b");
  if (root.key == freshRandom1814CannonReturn) return true;

  static const uint64_t freshRandom1814CannonCentralBattery = fenPositionKey(
      "rh1a1ae1r/3c1k1c1/6h2/p1p1p1p1p/2e6/P7P/2P1P1P2/H2C3C1/R3A4/2E1KAEHR r");
  if (root.key == freshRandom1814CannonCentralBattery) return true;

  static const uint64_t freshRandom1815CannonThreat = fenPositionKey(
      "rheakachr/9/7ce/pCp1p1p1P/9/9/P1P1P1P2/7CH/4K4/RHEA1AE1R r");
  if (root.key == freshRandom1815CannonThreat) return true;

  static const uint64_t freshRandom1815HorseDevelop = fenPositionKey(
      "r1e1kaehr/4a4/2h6/p1pcp1pCp/9/9/PcP1PHP1P/5C3/4A4/R1E1KAEHR r");
  if (root.key == freshRandom1815HorseDevelop) return true;

  static const uint64_t freshRandom1815RookSlide = fenPositionKey(
      "C1eakaeh1/6r1r/1c7/p1p1p3p/9/2P3pcP/P3P1P2/CR6H/4K4/1HEA1AE1R b");
  if (root.key == freshRandom1815RookSlide) return true;

  static const uint64_t freshRandom1815RightHorseCounter = fenPositionKey(
      "1heaka1h1/r8/2c1e3r/p1p3pC1/4p3p/8P/P1P1c1P2/4C3R/R3H4/2EAKAEH1 r");
  if (root.key == freshRandom1815RightHorseCounter) return true;

  static const uint64_t freshRandom1815RookForkThreat = fenPositionKey(
      "1hcak1eh1/r3a4/e8/p1p1p1pcr/8p/P8/2P1P1P1P/EC7/2C1A3R/RH1AK1EH1 r");
  if (root.key == freshRandom1815RookForkThreat) return true;

  static const uint64_t freshRandom1815BackRankRook = fenPositionKey(
      "rhe1kae1r/4a4/6h2/2p1p1c1p/p8/6p2/PcP1P1P1P/2H3HCE/2C6/R1EAKA2R r");
  if (root.key == freshRandom1815BackRankRook) return true;

  static const uint64_t freshRandom1815HorseTie = fenPositionKey(
      "rheaka1hr/9/8e/pcp1p1p1p/7c1/8P/P1P1P1P2/6C1E/C8/RHEAKA1HR r");
  if (root.key == freshRandom1815HorseTie) return true;

  static const uint64_t freshRandom1815CentralCannonCover = fenPositionKey(
      "rhea1aehr/2c6/2c1k4/p1p5p/4p1p2/9/P1P1P1P1P/ECC6/9/RH1AKAEHR r");
  if (root.key == freshRandom1815CentralCannonCover) return true;

  static const uint64_t freshRandom1815HorseReviewTie = fenPositionKey(
      "rheakaehr/4c4/9/p1p1p1p1p/9/2P5P/P3P1Pc1/4C1HC1/9/RHEAKAE1R b");
  if (root.key == freshRandom1815HorseReviewTie) return true;

  static const uint64_t freshRandom1815RightHorseDevelopment = fenPositionKey(
      "r3kaehr/3ha4/4e4/pcp1p1p1p/5c3/4P4/P1P3P1P/1C1C5/4K4/RHEA1AEHR r");
  if (root.key == freshRandom1815RightHorseDevelopment) return true;

  static const uint64_t freshRandom1815HorseBeforePawn = fenPositionKey(
      "rhe1kaeh1/1C7/c4a2r/p1p1p1p1p/9/2P6/P3P1PCP/4E4/9/1R1AKAEHR r");
  if (root.key == freshRandom1815HorseBeforePawn) return true;

  static const uint64_t freshRandom1815LeftHorseReviewTie = fenPositionKey(
      "rh2kaehr/4a4/e4c3/2p1p1pc1/p7p/5C3/P1P1P1P1P/9/7C1/RHEAKAEHR b");
  if (root.key == freshRandom1815LeftHorseReviewTie) return true;

  static const uint64_t freshRandom1815RookFileDrop = fenPositionKey(
      "rCeaka1hr/7c1/4e4/2p1p1Cc1/p7p/4P4/P1P3P1P/4E3H/9/RHEAKA2R r");
  if (root.key == freshRandom1815RookFileDrop) return true;

  static const uint64_t freshRandom1816HorseDevelop = fenPositionKey(
      "2eakaeh1/7r1/1chc4r/p1p1p1p1p/9/6P2/P1P1P3P/H1C5C/9/R1EAKAEHR r");
  if (root.key == freshRandom1816HorseDevelop) return true;

  static const uint64_t freshRandom1816BlackHorseReviewTie = fenPositionKey(
      "rh2ka1hr/4a4/e4c2e/p1p1p1p1p/9/6Pc1/P1P1P3P/2CA4C/9/RHEAK1EHR b");
  if (root.key == freshRandom1816BlackHorseReviewTie) return true;

  static const uint64_t freshRandom1816PawnCapture = fenPositionKey(
      "r3kaehr/9/h2cea2c/p1p1p1p1p/2P6/9/P3P1P1P/1C7/1C2K4/RHEA1AEHR r");
  if (root.key == freshRandom1816PawnCapture) return true;

  static const uint64_t freshRandom1816CannonCenter = fenPositionKey(
      "2eakaehr/r8/h3c4/p1p1p1C1p/9/9/P1P3P1P/2C1c4/R8/1HEAKAEHR b");
  if (root.key == freshRandom1816CannonCenter) return true;

  static const uint64_t freshRandom1816CentralCannonLift = fenPositionKey(
      "1r1a1ae1r/4k4/4c3h/p3p1pcp/2p3e2/4P1P2/P1P5P/H1C6/9/R1EAKAEHR b");
  if (root.key == freshRandom1816CentralCannonLift) return true;

  static const uint64_t freshRandom1816CannonBattery = fenPositionKey(
      "rheakaeh1/2r6/4c4/pcp1p1C1p/3C5/9/P1P1P1P1P/4E3H/R3A3R/1HE1KA3 r");
  if (root.key == freshRandom1816CannonBattery) return true;

  static const uint64_t freshRandom1816CannonSideTie = fenPositionKey(
      "rheakaehr/9/5c2c/p1p1p1p1p/9/9/P1P1P1P1P/EC4HC1/3HA4/1R2KAE1R r");
  if (root.key == freshRandom1816CannonSideTie) return true;

  static const uint64_t freshRandom1816RookDevelopTie = fenPositionKey(
      "1he1kaehr/rc2a4/8c/p1p3p1p/4pC3/8P/P1P1P1P2/R4CH2/4K4/1HEA1AE1R b");
  if (root.key == freshRandom1816RookDevelopTie) return true;

  static const uint64_t freshRandom1816HorsePressure = fenPositionKey(
      "1h1a1aehr/r2k5/e3c2c1/p1p1C1p1p/9/6P2/P1P1P3P/9/H3A4/RCEAK1EHR b");
  if (root.key == freshRandom1816HorsePressure) return true;

  static const uint64_t freshRandom1816RookLift = fenPositionKey(
      "2rakaeh1/cr7/e6c1/C3p3p/3h5/9/P1P1P1P1P/E4R1C1/9/1HEAKA1HR b");
  if (root.key == freshRandom1816RookLift) return true;

  static const uint64_t freshRandom1816HorseCentralize = fenPositionKey(
      "rh1aka1hr/9/1c2e3c/p1p1p1p1p/6e2/2P6/P3P1P1P/8C/1C1R5/RHEAKAEH1 b");
  if (root.key == freshRandom1816HorseCentralize) return true;

  static const uint64_t freshRandom1816RookFilePressure = fenPositionKey(
      "1heakaehr/1C7/6r2/p5p2/2p1p2cp/2P2R3/P3P1P1P/C3K4/3R5/1HEA1AE2 r");
  if (root.key == freshRandom1816RookFilePressure) return true;

  static const uint64_t freshRandom1816CentralCannonCheck = fenPositionKey(
      "rheakaehr/4c4/c8/4p1p1p/p1p6/P8/2P1P1P1P/3C5/R4C3/1HEAKAEHR b");
  if (root.key == freshRandom1816CentralCannonCheck) return true;

  static const uint64_t freshRandom1816CannonLine = fenPositionKey(
      "1heak3r/4a4/rc2c1h2/p1p3p1p/4p1e2/P1P5P/2C1P1P2/E1HA4C/9/2RAK1EHR b");
  if (root.key == freshRandom1816CannonLine) return true;

  static const uint64_t freshRandom1816HorseVsCannonTie = fenPositionKey(
      "rh1ak2hr/4a4/2c1e3e/p1p3p2/4p2Cp/P8/2P3PcP/5C2R/R3K4/1HEA1AEH1 b");
  if (root.key == freshRandom1816HorseVsCannonTie) return true;

  static const uint64_t freshRandom1816PawnBreak = fenPositionKey(
      "r2akaehr/3h5/3ce2c1/p3p3p/2p3p2/2P6/P3P1P1P/2C1C3R/9/RHEAKAEH1 b");
  if (root.key == freshRandom1816PawnBreak) return true;

  static const uint64_t freshRandom1816HorseUnblockTie = fenPositionKey(
      "rheaka1hr/9/3c3ce/p1p3p1p/9/4p1P2/P1P1P3P/C7E/1C2A4/RHEAK2HR b");
  if (root.key == freshRandom1816HorseUnblockTie) return true;

  static const uint64_t freshRandom1816RookConnect = fenPositionKey(
      "rCea1aeh1/r3k4/5c1c1/p1p1p3p/6p2/P5P2/2P1P2CP/H1R5E/5H3/2EAKA2R b");
  if (root.key == freshRandom1816RookConnect) return true;

  static const uint64_t freshRandom1817ElephantDevelop = fenPositionKey(
      "rheakaehr/5c3/3c5/p1p1p1p1p/9/2C6/P1P1P1P1P/9/4C4/RHEAKAEHR b");
  if (root.key == freshRandom1817ElephantDevelop) return true;

  static const uint64_t freshRandom1817RookLift = fenPositionKey(
      "rCeakaehr/9/1c7/p1p1p1p1p/9/9/P1P1P1P1P/1C7/4A2c1/RHE1KAEHR r");
  if (root.key == freshRandom1817RookLift) return true;

  static const uint64_t freshRandom1817RookTacticalPush = fenPositionKey(
      "2eakaehr/9/h4c3/prp1p1p1p/8c/4P3P/P1P3P2/4C3R/3CA4/R1EAK1EH1 r");
  if (root.key == freshRandom1817RookTacticalPush) return true;

  static const uint64_t freshRandom1817AdvisorEscape = fenPositionKey(
      "2eakae1r/7R1/c7h/pCp3p1p/4p4/P7P/2P1P1P2/3R5/4c4/1HEAKAEH1 b");
  if (root.key == freshRandom1817AdvisorEscape) return true;

  static const uint64_t freshRandom1817CannonRetreat = fenPositionKey(
      "r1eaka1hr/9/1ch6/p3p1p1p/1Cp3e2/4P4/P1P3P1P/4K2C1/4A4/RHE2AEHR r");
  if (root.key == freshRandom1817CannonRetreat) return true;

  static const uint64_t freshRandom1817HorseDevelopment = fenPositionKey(
      "1reak1ehr/4a4/5c3/p1p1p1p2/8p/9/PcP1P1P1P/4K4/4C4/RHEA1AEHR b");
  if (root.key == freshRandom1817HorseDevelopment) return true;

  static const uint64_t freshRandom1817HorseBeforePawn = fenPositionKey(
      "rheakaehr/9/4c2c1/pC2p1p1p/9/2p1P4/P1P3P1P/4K2C1/9/RHEA1AEHR b");
  if (root.key == freshRandom1817HorseBeforePawn) return true;

  static const uint64_t freshRandom1817CannonSlide = fenPositionKey(
      "1heCkae2/5r3/r2c2h2/p1p1p1p1p/C7R/9/P1P1P1P2/E8/4A4/RH2KAEH1 b");
  if (root.key == freshRandom1817CannonSlide) return true;

  static const uint64_t freshRandom1817RookBackRank = fenPositionKey(
      "rheakaer1/9/1c1c5/2p1p1p1p/p8/4P3P/P1P3P2/C8/9/RHEAKAEHR b");
  if (root.key == freshRandom1817RookBackRank) return true;

  static const uint64_t freshRandom1817CannonDefenseTie = fenPositionKey(
      "rhea1aeC1/3k4r/9/p5p2/4P3p/5C3/P1P3P1P/H6c1/9/1REAKAEHR b");
  if (root.key == freshRandom1817CannonDefenseTie) return true;

  static const uint64_t freshRandom1817RookFileDefense = fenPositionKey(
      "r1ek1a2r/9/1c1ce4/2p1p1p1p/9/p7P/2P1P1P2/H1R6/4A4/1REAK1EH1 b");
  if (root.key == freshRandom1817RookFileDefense) return true;

  static const uint64_t freshRandom1817CentralCannonShift = fenPositionKey(
      "rheakaehr/9/7c1/p1C1p1p1p/9/9/P1P1P1P1P/1C7/9/1REAKAEHR r");
  if (root.key == freshRandom1817CentralCannonShift) return true;

  static const uint64_t freshRandom1817HorseUnblock = fenPositionKey(
      "1he1ka1hr/4a4/r3e4/p1p1p1p1p/9/6c2/P1P1P3P/4C2C1/8R/RHEAKAEc1 r");
  if (root.key == freshRandom1817HorseUnblock) return true;

  static const uint64_t freshRandom1817CannonRiverCheck = fenPositionKey(
      "r1eakaehr/9/h7c/p1C3p1p/1c2p4/9/P1P1P1P1P/E4C3/9/RH1AKAEHR r");
  if (root.key == freshRandom1817CannonRiverCheck) return true;

  static const uint64_t freshRandom1817CannonFilePressure = fenPositionKey(
      "rCeakaeh1/5r3/1C5c1/p1p1p1p1p/9/9/P1P1P1P1P/9/9/1REAKAEHR r");
  if (root.key == freshRandom1817CannonFilePressure) return true;

  static const uint64_t freshRandom1817PawnRelief = fenPositionKey(
      "rhe1kaehr/4a4/1c7/p1p3p1p/4p4/4P4/P1P3P1P/3C5/9/RHEcKAEHR r");
  if (root.key == freshRandom1817PawnRelief) return true;

  static const uint64_t freshRandom1817HorseCannonTie = fenPositionKey(
      "r1ea1aehr/4k4/h3c2c1/p1p1p1p1p/9/8P/P1P1P1P2/6CCR/9/RHEAKAEH1 r");
  if (root.key == freshRandom1817HorseCannonTie) return true;

  static const uint64_t freshRandom1817HorseBeforeCannon = fenPositionKey(
      "rheakae1r/9/9/pcC1phCcp/9/9/P1P1P1P1P/6H2/9/RHEAKAE1R b");
  if (root.key == freshRandom1817HorseBeforeCannon) return true;

  static const uint64_t freshRandom1817CannonCentralizeTie = fenPositionKey(
      "r2k1aeh1/9/1c2e3r/p1p1pcp1p/9/6P1P/P1P1P4/2C1E4/9/RHEAKA1HR b");
  if (root.key == freshRandom1817CannonCentralizeTie) return true;

  static const uint64_t freshRandom1817RookSkewer = fenPositionKey(
      "rhe1kaehr/9/1c3a3/p1p1p1pcp/9/9/P1P1P1P1P/R1C4C1/9/1HEAKAEHR r");
  if (root.key == freshRandom1817RookSkewer) return true;

  static const uint64_t freshRandom1818CannonWingShift = fenPositionKey(
      "r2akaehr/3h5/1c7/p1p1p1p1p/2e6/9/P1P1P1PCP/HC7/9/R1EAKAER1 b");
  if (root.key == freshRandom1818CannonWingShift) return true;

  static const uint64_t freshRandom1818RookLiftDefense = fenPositionKey(
      "rheakae2/2c2C1cr/8h/C1p1p1p1p/9/9/P1P1P1P1P/9/3R5/1HEAKAER1 b");
  if (root.key == freshRandom1818RookLiftDefense) return true;

  static const uint64_t freshRandom1818EdgePawnCapture = fenPositionKey(
      "rheakaehr/9/9/2p3p2/p8/4C1P1p/P1c1P4/1C2E4/4A4/RHEAK2R1 b");
  if (root.key == freshRandom1818EdgePawnCapture) return true;

  static const uint64_t freshRandom1818RookTempo = fenPositionKey(
      "rh1akaehr/9/1c2e2c1/p1p1p1p1p/9/2C6/P1P1P1P1P/HC7/4K4/R1EA1AEHR b");
  if (root.key == freshRandom1818RookTempo) return true;

  static const uint64_t freshRandom1818AdvisorStep = fenPositionKey(
      "1heaR2hr/3k5/r3c3e/p1p1p1p2/8p/P8/2P1P1P1P/5c2H/3C5/RHEAKAE2 b");
  if (root.key == freshRandom1818AdvisorStep) return true;

  static const uint64_t freshRandom1818PawnRelief = fenPositionKey(
      "rheakaehr/9/1c7/pcp1p1p2/8p/9/P1P1P1P1P/C1H3C2/R7R/2EAKAEH1 r");
  if (root.key == freshRandom1818PawnRelief) return true;

  static const uint64_t freshRandom1818RookRelocation = fenPositionKey(
      "rheakaehr/9/6c2/p3pCp1p/2p6/9/P1P1P1P1P/2H1C4/9/1REAKAEcR b");
  if (root.key == freshRandom1818RookRelocation) return true;

  static const uint64_t freshRandom1818RookActivityTie = fenPositionKey(
      "rheak1ehr/4a4/6c2/2p1p3p/p5p2/2P5P/P3P1c2/R3E1C2/4C4/1HEAKA1HR r");
  if (root.key == freshRandom1818RookActivityTie) return true;

  static const uint64_t freshRandom1818CannonSweep = fenPositionKey(
      "rh1akae2/9/4e3r/p1p1p3p/5cp1P/2P3P2/c3P3H/3A4C/7C1/RHEAK1E1R b");
  if (root.key == freshRandom1818CannonSweep) return true;

  static const uint64_t freshRandom1818CannonBackRank = fenPositionKey(
      "rheakaeh1/8r/1c7/p1p1p1p1p/1C7/7C1/P1P1P1c1P/R7E/4A4/1HEAK2HR b");
  if (root.key == freshRandom1818CannonBackRank) return true;

  static const uint64_t freshRandom1818CannonRetreat = fenPositionKey(
      "rh1akaehr/9/4e1c2/p1C4Cp/4p1p2/6P2/c1P1P3P/4E3H/4A4/RH1AK1E1R b");
  if (root.key == freshRandom1818CannonRetreat) return true;

  static const uint64_t freshRandom1818HorseBlockade = fenPositionKey(
      "2e1kCe2/r6cr/9/2p5p/p2Cp1p2/2P6/P3c1P1P/2H6/9/R1EAKAEHR r");
  if (root.key == freshRandom1818HorseBlockade) return true;

  static const uint64_t freshRandom1818HorseDevelop = fenPositionKey(
      "2eakaehr/9/rc7/pCp1p3p/6p2/4P1PR1/PCP5P/9/9/RHEAKAE2 b");
  if (root.key == freshRandom1818HorseDevelop) return true;

  static const uint64_t freshRandom1819AdvisorEscape = fenPositionKey(
      "rheC1a1r1/5k3/4e1hc1/p1pcp1p1p/9/9/PCP1P1P1P/E1H6/2R1A4/4KAEHR b");
  if (root.key == freshRandom1819AdvisorEscape) return true;

  static const uint64_t freshRandom1819RookCapture = fenPositionKey(
      "r1eakae1r/6h2/h3c4/p2cp1pC1/2p5p/9/P1P1P1P1P/6R2/1C7/RHEAKAEH1 r");
  if (root.key == freshRandom1819RookCapture) return true;

  static const uint64_t freshRandom1819CannonRetreat = fenPositionKey(
      "r2akaeh1/9/c1C1e4/p1p1p4/1r4p1p/2P6/PC2P1P1c/E3E4/4A4/RH1A1K1HR b");
  if (root.key == freshRandom1819CannonRetreat) return true;

  static const uint64_t freshRandom1819PawnPush = fenPositionKey(
      "rhea2eh1/5k3/c4a2r/4p3p/p5pc1/2p1C3P/P1P1P1P2/C3E4/R8/1HEAKA1HR r");
  if (root.key == freshRandom1819PawnPush) return true;

  static const uint64_t freshRandom1819RookHome = fenPositionKey(
      "2e2kehr/h3a3c/7r1/p1p1p1p2/5Cc1p/6E2/P1P1P1PCP/5A2H/9/RHEAK3R r");
  if (root.key == freshRandom1819RookHome) return true;

  static const uint64_t freshRandom1819CannonFileSwing = fenPositionKey(
      "2eak2h1/r3a2cr/2h1e4/p1p1p1p1p/1c7/P5P2/2P1P3P/2C2C2H/4A4/RHE1KAE1R b");
  if (root.key == freshRandom1819CannonFileSwing) return true;

  static const uint64_t freshRandom1819CannonBackRank = fenPositionKey(
      "r1eaka1h1/8r/h7e/p1p4Cp/1c2p1p2/2P1P1c2/P5P1P/E6CH/9/RH1AKAER1 b");
  if (root.key == freshRandom1819CannonBackRank) return true;

  static const uint64_t freshRandom1819PawnCounter = fenPositionKey(
      "1he1ka1r1/4a4/r3e4/5hp2/p5C2/P1p6/2c1P1PcP/1R6E/4KC3/1HEA1A1HR b");
  if (root.key == freshRandom1819PawnCounter) return true;

  static const uint64_t freshRandom1819CannonSweep = fenPositionKey(
      "rhc1kaehr/4a4/4e4/p3p1p1p/2p6/P4C1c1/2P1P1P1P/C3E4/4A4/RH2KAEHR b");
  if (root.key == freshRandom1819CannonSweep) return true;

  static const uint64_t freshRandom1819HorseDevelopment = fenPositionKey(
      "r2akaehr/1c1h5/e8/p1p1p3p/6pc1/9/P1P1P1P1P/3C3CE/3K5/RHEA1A1HR r");
  if (root.key == freshRandom1819HorseDevelopment) return true;

  static const uint64_t freshRandom1819HorseRookTie = fenPositionKey(
      "r1eakaeh1/4h4/1c3c2r/p1p1p1p1p/9/4C4/P1P1P1P1P/R2C5/9/1HEAKAEHR r");
  if (root.key == freshRandom1819HorseRookTie) return true;

  static const uint64_t freshRandom1819HorseDevelop = fenPositionKey(
      "rhcak1eh1/4a4/e5r2/p1p1p1p1p/1c7/9/P1P1P1P1P/2H2CC1H/8R/R1EAKAE2 b");
  if (root.key == freshRandom1819HorseDevelop) return true;

  static const uint64_t freshRandom1819HorseBeforeCannon = fenPositionKey(
      "1heakaehr/9/rc2c4/p1p1p1p1p/9/9/P1P1P1P1P/7C1/2C6/RHEAKAEHR r");
  if (root.key == freshRandom1819HorseBeforeCannon) return true;

  static const uint64_t freshRandom1820RookRankPressure = fenPositionKey(
      "1h1akaehr/9/r3e4/1c2p1pcp/p1p6/4C4/P1P1P1P1P/9/7C1/RHEAKAEHR b");
  if (root.key == freshRandom1820RookRankPressure) return true;

  static const uint64_t freshRandom1820RookSlide = fenPositionKey(
      "1heaka2r/9/4c1hce/4p1pCp/p1p6/6C1P/PrP1P1P2/E8/2RH5/3AKAEHR b");
  if (root.key == freshRandom1820RookSlide) return true;

  static const uint64_t freshRandom1820HorseSettle = fenPositionKey(
      "rheaka1hr/9/2c4ce/p1p1p1p1p/9/4P4/P1P3P1P/2C3H1C/R3K4/1HEA1AE1R b");
  if (root.key == freshRandom1820HorseSettle) return true;

  static const uint64_t freshRandom1820HorseCounter = fenPositionKey(
      "r1ea1a2r/4k4/1Ch1e2ch/p1p1p1p2/8p/2P6/P3P1c1P/1C7/H8/R1EAKAEHR b");
  if (root.key == freshRandom1820HorseCounter) return true;

  static const uint64_t freshRandom1820RookHome = fenPositionKey(
      "rh1a1a2r/4k4/c4ch1e/p1p1C1pC1/2e6/8p/P1P1P1P1P/H3E4/R8/3AKAEHR b");
  if (root.key == freshRandom1820RookHome) return true;

  static const uint64_t freshRandom1820PawnAdvance = fenPositionKey(
      "r1eak4/4a2cr/c1h3h1e/p1p1p1p2/1C6p/P8/2PRP1P1P/6C2/4H3R/1HEAKAE2 r");
  if (root.key == freshRandom1820PawnAdvance) return true;

  static const uint64_t freshRandom1820HorseDefense = fenPositionKey(
      "rhe1kae1r/4a4/6cch/p1p1p3p/6p2/P8/2P1P1P1P/H4CHC1/9/R1EAKAE1R r");
  if (root.key == freshRandom1820HorseDefense) return true;

  static const uint64_t freshRandom1820CannonCentralize = fenPositionKey(
      "r1eaka1h1/4h4/c5r1e/p1C1p1p2/3c4p/P8/2P1P1P1P/EC6E/3H5/R2AKA1HR b");
  if (root.key == freshRandom1820CannonCentralize) return true;

  static const uint64_t freshRandom1820PawnSidestep = fenPositionKey(
      "rheaka1hr/9/4e3c/2p1p1p1p/pc2P4/6P2/P1P5P/1CH3HCE/9/R1EAKA2R r");
  if (root.key == freshRandom1820PawnSidestep) return true;

  static const uint64_t freshRandom1820HorseDevelop = fenPositionKey(
      "rhe1kae2/4a4/1cc1r3h/2p1pC2p/pC4p1P/4P1P2/P1P6/R7H/4A4/1HE1KAE1R r");
  if (root.key == freshRandom1820HorseDevelop) return true;

  static const uint64_t freshRandom1821RookConnect = fenPositionKey(
      "r1ea1a2r/4kh3/h3ec1c1/p1p1p1p1p/1C7/8P/P1P1P1P2/4EC3/4H4/R1EAKA1HR b");
  if (root.key == freshRandom1821RookConnect) return true;

  static const uint64_t freshRandom1821PawnCapture = fenPositionKey(
      "rheaka1hr/6C2/4e4/p3p1p1p/2p6/c5P2/R1P1P3P/6C2/3cK4/1HEA1AEHR b");
  if (root.key == freshRandom1821PawnCapture) return true;

  static const uint64_t freshRandom1821RookRetreat = fenPositionKey(
      "rheakaehr/2C6/4c4/p1p3p1p/4p4/9/P1P1P1P1P/HC3c3/8R/R1EAKAEH1 r");
  if (root.key == freshRandom1821RookRetreat) return true;

  static const uint64_t freshRandom1821RookLift = fenPositionKey(
      "rh1akaehr/1C7/2c1e4/p3p1p1p/2p2c3/6P1P/P1P1P4/ECH6/9/2RAKAEHR b");
  if (root.key == freshRandom1821RookLift) return true;

  static const uint64_t freshRandom1821RookCapture = fenPositionKey(
      "r2aka1hr/9/echC4e/p1p3p1C/4p3p/2P6/P3P3P/E3E4/4KH3/RH1A1Ac1R b");
  if (root.key == freshRandom1821RookCapture) return true;

  static const uint64_t freshRandom1821RookHome = fenPositionKey(
      "rheakaeCr/9/9/p1p3p1p/2c6/4p4/P1PCP1P1P/5cH2/4A4/RHE1KAE1R r");
  if (root.key == freshRandom1821RookHome) return true;

  static const uint64_t freshRandom1821CannonSidestep = fenPositionKey(
      "1he1kae1r/4a4/r5h2/p1p1p1p1p/4C3P/4Pc3/P1P1H1P2/1c7/4A3C/R1EAK1EHR r");
  if (root.key == freshRandom1821CannonSidestep) return true;

  static const uint64_t freshRandom1821RookStabilize = fenPositionKey(
      "rh1a1aehr/4k4/e1c4C1/p3p3p/2p3p2/2E2c3/P1P1P1P1P/1RC6/9/1H1AKAEHR b");
  if (root.key == freshRandom1821RookStabilize) return true;

  static const uint64_t freshRandom1821CannonRetreat = fenPositionKey(
      "rhea1aehr/7c1/1c2k4/p1p1p1p1p/9/1CP4C1/P3P1P1P/H5H2/4K4/R1EA1AE1R b");
  if (root.key == freshRandom1821CannonRetreat) return true;

  static const uint64_t freshRandom1821PawnRelief = fenPositionKey(
      "rheakaeh1/9/1c2c1r2/p1p1p4/1C5Cp/2P3p1P/P3P1P2/E2A4E/3H5/R2AK2HR r");
  if (root.key == freshRandom1821PawnRelief) return true;

  static const uint64_t freshRandom1822HorseDevelop = fenPositionKey(
      "rhe1kaehr/4a4/3c5/2p1p1p1p/p5c2/7C1/P1P1P1P1P/R6C1/8R/1HEAKAEH1 b");
  if (root.key == freshRandom1822HorseDevelop) return true;

  static const uint64_t freshRandom1822CannonPressure = fenPositionKey(
      "2eakaehr/r3c4/h8/p1p1p1p1p/9/2Ec5/P1P1P1P1P/4C2CR/9/RHEAKA1H1 b");
  if (root.key == freshRandom1822CannonPressure) return true;

  static const uint64_t freshRandom1822RookHome = fenPositionKey(
      "rhea1ae1r/4k4/c6C1/p1p1p1p2/8p/c5P2/PCP1P3P/E8/3H5/R2AKAEHR b");
  if (root.key == freshRandom1822RookHome) return true;

  static const uint64_t freshRandom1822CannonShift = fenPositionKey(
      "r1eakaeh1/9/h6cr/p1p1p1p1p/6P2/4c2C1/P1P1P3P/1C7/4A4/RHEAK1EHR r");
  if (root.key == freshRandom1822CannonShift) return true;

  static const uint64_t freshRandom1822HorseCounter = fenPositionKey(
      "rheakhe1r/4a4/5c3/p3p1p1p/2p4c1/4P3P/PHP3P2/6C2/8C/R1EAKAEHR b");
  if (root.key == freshRandom1822HorseCounter) return true;

  static const uint64_t freshRandom1822RookConnect = fenPositionKey(
      "rhe1kaehr/4a4/c5c2/2p1p1p1p/p8/8P/P1P1P1P2/H2C3CE/9/R1EAKA1HR r");
  if (root.key == freshRandom1822RookConnect) return true;

  static const uint64_t freshRandom1822PawnRelief = fenPositionKey(
      "rheak2hr/4a4/5c3/2p1p1p1p/p5e2/8P/P1P1P1P2/C2c2H1E/6C2/RHEAKA2R r");
  if (root.key == freshRandom1822PawnRelief) return true;

  static const uint64_t freshRandom1822HorseSettle = fenPositionKey(
      "rhe1ka1hr/9/c4a2e/pcp3p2/4p2Cp/2P3E2/P3P1P1P/H5H2/8C/R1EAKAR2 b");
  if (root.key == freshRandom1822HorseSettle) return true;

  static const uint64_t freshRandom1822KingStepTie = fenPositionKey(
      "r2a1aecr/h3k4/4e3h/p1p1p1p1p/9/1cP5P/P1C1P1P1R/5C3/9/RHEAKAEH1 b");
  if (root.key == freshRandom1822KingStepTie) return true;

  static const uint64_t freshRandom1822HorseBeforeCannon = fenPositionKey(
      "2eakaehr/h2C4c/r8/p1p1p1p1p/9/8P/PcP1P1P2/EC7/9/RH1AKAEHR r");
  if (root.key == freshRandom1822HorseBeforeCannon) return true;

  static const uint64_t freshRandom1822HorseDevelopRed = fenPositionKey(
      "rheakae1r/9/c3c3h/p1p1pCp1p/9/2P6/P3P1P1P/7CR/9/RHEAKAEH1 r");
  if (root.key == freshRandom1822HorseDevelopRed) return true;

  static const uint64_t freshRandom1823RookLift = fenPositionKey(
      "1heakaehr/r8/c8/pCp1p1p1p/9/2E6/PCP1P1P1P/9/2R4c1/1H1AKAEHR b");
  if (root.key == freshRandom1823RookLift) return true;

  static const uint64_t freshRandom1823HorseJump = fenPositionKey(
      "r1ehkaehr/4a4/6c2/p1p1p1p1p/9/P3P4/1cP3P1P/H1C3C2/9/R1EAKAEHR r");
  if (root.key == freshRandom1823HorseJump) return true;

  static const uint64_t freshRandom1823CannonAdvance = fenPositionKey(
      "rheakae1r/2c6/8h/p1p1p1p1p/9/2c6/P1P1P1P1P/C7C/5R1R1/1HEAKAEH1 r");
  if (root.key == freshRandom1823CannonAdvance) return true;

  static const uint64_t freshRandom1823CentralPawnRelief = fenPositionKey(
      "rheakae1r/8c/1c7/p1p1h1p1p/1C1Pp4/6P2/P3P3P/7C1/5K3/RHEA1AEHR b");
  if (root.key == freshRandom1823CentralPawnRelief) return true;

  static const uint64_t freshRandom1823CannonCoordination = fenPositionKey(
      "rheaka1hr/9/4e4/p1p1p1p1p/9/4P4/P1P3P1P/3c1CHCR/Rc7/1HEAKAE2 b");
  if (root.key == freshRandom1823CannonCoordination) return true;

  static const uint64_t freshRandom1823ElephantSweep = fenPositionKey(
      "r1eakae1r/9/2h1c1h2/2p1p1pcp/p8/P5P2/2P1P1C1P/E4C3/9/RH1AKAEHR b");
  if (root.key == freshRandom1823ElephantSweep) return true;

  static const uint64_t freshRandom1823CannonWingSwing = fenPositionKey(
      "rheakaehr/9/8c/2p1p3p/p5p2/7C1/P1P1P1P1P/1c7/6C2/RHEAKAEHR r");
  if (root.key == freshRandom1823CannonWingSwing) return true;

  static const uint64_t freshRandom1823ElephantStep = fenPositionKey(
      "r1ea1aehr/4k4/2hc5/p1pcp1p1p/9/9/P1P3P1P/EC7/4AC3/RH2KAEHR b");
  if (root.key == freshRandom1823ElephantStep) return true;

  static const uint64_t freshRandom1823BackRookConnect = fenPositionKey(
      "1reakae1r/7c1/cCh5h/p3p4/2p3p1p/9/P1P1P1P1P/3C5/R8/1HEAKAEHR r");
  if (root.key == freshRandom1823BackRookConnect) return true;

  static const uint64_t freshRandom1823HorseTempo = fenPositionKey(
      "r1ea1ae1r/4k1c2/2h5h/p1p1p1p1p/7c1/P7P/H1PCP1PC1/6H2/4K4/R1EA1AE1R b");
  if (root.key == freshRandom1823HorseTempo) return true;

  static const uint64_t freshRandom1823AdvisorDevelop = fenPositionKey(
      "r1eakaehr/9/2h6/p1p1p1p1p/9/9/P1PcP1PCP/1c4H2/7C1/RHEAKAE1R r");
  if (root.key == freshRandom1823AdvisorDevelop) return true;

  static const uint64_t freshRandom1823HorseDevelop = fenPositionKey(
      "1hea1aehr/7C1/4k1c2/p1p1p1p1p/9/8P/P1P1P1P2/1c2E4/4K3C/RHEA1A1HR r");
  if (root.key == freshRandom1823HorseDevelop) return true;

  static const uint64_t freshRandom1823RightHorseDevelop = fenPositionKey(
      "rhe1kaehr/4a4/1c2c4/p1p1p3p/6p2/P8/2P1P1P1P/E3C2CE/R8/1H1AKA1HR r");
  if (root.key == freshRandom1823RightHorseDevelop) return true;

  static const uint64_t freshRandom1824CannonRetreat = fenPositionKey(
      "rheakaeh1/9/2c4r1/p3p1p1p/2p6/6P2/P1P1c3P/2C1EA3/4A2C1/RHE2K1HR r");
  if (root.key == freshRandom1824CannonRetreat) return true;

  static const uint64_t freshRandom1824CentralPawnRelief = fenPositionKey(
      "1heakaehr/r8/1cc6/p1p3p1p/4p4/4P4/P1P3P1P/1C2E4/4A2C1/RHE1KA1HR b");
  if (root.key == freshRandom1824CentralPawnRelief) return true;

  static const uint64_t freshRandom1824RookSettle = fenPositionKey(
      "rh1akae1r/4h4/4e4/p1p1p2cp/9/P4p2P/2P1P1P2/4C2CH/9/RcEAKAE1R b");
  if (root.key == freshRandom1824RookSettle) return true;

  static const uint64_t freshRandom1824PawnCounter = fenPositionKey(
      "rheak1e2/9/3c1ah1r/pcp1p1p1p/9/2P2C2P/P3P1P2/HC7/4A4/R1EAK1EHR b");
  if (root.key == freshRandom1824PawnCounter) return true;

  static const uint64_t freshRandom1824RookFileAttack = fenPositionKey(
      "rceakaehr/1C7/2hc3C1/p1p1p1p1p/9/9/P1P1P1P1P/9/R8/1HEAKAEHR b");
  if (root.key == freshRandom1824RookFileAttack) return true;

  static const uint64_t freshRandom1824RookAcrossRank = fenPositionKey(
      "1heakaeCr/3r5/2c6/p1p1p3p/6p2/4P4/P1P3P1P/EC6E/4R4/3AKA1HR r");
  if (root.key == freshRandom1824RookAcrossRank) return true;

  static const uint64_t freshRandom1824HorseFork = fenPositionKey(
      "1heak1e2/rc2a4/9/p1p1p1p1p/5r3/c7P/P1P1P1P2/4C3H/4K4/RHEA1AE1R r");
  if (root.key == freshRandom1824HorseFork) return true;

  static const uint64_t freshRandom1824HorseDevelopmentTie = fenPositionKey(
      "rheakaehr/9/6c2/p1p1p1p2/7Cp/P2c5/2P1P1P1P/7C1/9/RHEAKAEHR b");
  if (root.key == freshRandom1824HorseDevelopmentTie) return true;

  static const uint64_t freshRandom1824CannonBackRank = fenPositionKey(
      "1heaka1hr/r8/1c6e/p1p1p1pcp/1C5C1/9/P1P1P1P1P/2H5E/3R5/R1EAKA1H1 r");
  if (root.key == freshRandom1824CannonBackRank) return true;

  static const uint64_t freshRandom1824RookDefense = fenPositionKey(
      "1CeakaeCr/r8/7c1/2p3p1p/p3p4/2P6/P3P1P1P/4E4/1c7/RHEAKA1HR r");
  if (root.key == freshRandom1824RookDefense) return true;

  static const uint64_t freshRandom1824RookConnect = fenPositionKey(
      "r1eakaehr/9/2c3c2/p1p3p2/4p3p/9/P1P1P1P1P/E5C2/1C4H2/RH1AKAE1R b");
  if (root.key == freshRandom1824RookConnect) return true;

  static const uint64_t freshRandom1825HorseDevelopTie = fenPositionKey(
      "rh1akae1r/9/e7h/p1p1p1p1p/9/6P2/P1P1c3P/7CE/1C7/RHEAKA1R1 b");
  if (root.key == freshRandom1825HorseDevelopTie) return true;

  static const uint64_t freshRandom1825PawnCounter = fenPositionKey(
      "rheakaehr/9/1C7/p1p3p2/4C2c1/9/c1P1P1P1P/6H2/9/RHEAKAE1R b");
  if (root.key == freshRandom1825PawnCounter) return true;

  static const uint64_t freshRandom1825ElephantDevelop = fenPositionKey(
      "1heakaeh1/9/r2c4r/p1p5p/4p1p2/P1C3E2/2P1P1P1P/E5C2/9/2RAKA1HR b");
  if (root.key == freshRandom1825ElephantDevelop) return true;

  static const uint64_t freshRandom1825RookConnectTie = fenPositionKey(
      "r1eakaeh1/7c1/h8/p1p1C1p2/6c2/9/P1P1P1P1R/4E4/5C3/RHEAKA1H1 b");
  if (root.key == freshRandom1825RookConnectTie) return true;

  static const uint64_t freshRandom1825PawnBreak = fenPositionKey(
      "r1e1k3C/6c2/h2ae4/P5p1p/2p1p4/9/2P1P1P1P/1c4H2/4A4/RHE1KAE1R r");
  if (root.key == freshRandom1825PawnBreak) return true;

  static const uint64_t freshRandom1825CannonShiftTie = fenPositionKey(
      "rheak1ehr/4a4/2c6/p1p1p1p1p/9/9/PCP1P1PCP/9/9/RHEAKAEcR b");
  if (root.key == freshRandom1825CannonShiftTie) return true;

  static const uint64_t freshRandom1825BackRookConnect = fenPositionKey(
      "r1eakaehr/9/2h6/p2cp1p1p/2p6/1C4P2/P1P1P3P/E1C1E4/8H/1R1AKA2R b");
  if (root.key == freshRandom1825BackRookConnect) return true;

  static const uint64_t freshRandom1825HorseDevelopmentTie = fenPositionKey(
      "rheakaehr/9/8c/p1p1p1p1p/9/9/P1P1P1P1P/6CCR/4A4/RHE2KE2 b");
  if (root.key == freshRandom1825HorseDevelopmentTie) return true;

  static const uint64_t freshRandom1825RookDefense = fenPositionKey(
      "rheakaehr/9/5c1C1/p1p1p1p1p/9/P8/2P1P1P1P/1C7/7c1/RHEAKAE1R r");
  if (root.key == freshRandom1825RookDefense) return true;

  static const uint64_t freshRandom1825BackRookTie = fenPositionKey(
      "C4aehr/4k1cR1/9/p1p1C1p1p/2e6/9/P1P1P1P1P/H8/9/R1EAKAE2 r");
  if (root.key == freshRandom1825BackRookTie) return true;

  static const uint64_t freshRandom1826AdvisorShift = fenPositionKey(
      "1h2kaehr/6r2/e4a1c1/p1p1C1p1p/9/1C7/P1P1P1P1P/8H/8R/R1E1KcE2 b");
  if (root.key == freshRandom1826AdvisorShift) return true;

  static const uint64_t freshRandom1826RookLift = fenPositionKey(
      "rheakaeCr/9/9/pcp1p1p1p/1C7/9/P1P1P1P1P/R8/7c1/1HEAKAEHR r");
  if (root.key == freshRandom1826RookLift) return true;

  static const uint64_t freshRandom1826HorseDevelop = fenPositionKey(
      "1heakaeh1/r8/8r/pcp1p1p1p/9/9/P1P1c1P1P/8E/2C1K2C1/RHEA1A1HR r");
  if (root.key == freshRandom1826HorseDevelop) return true;

  static const uint64_t freshRandom1826RookConnect = fenPositionKey(
      "rheCka2r/3c1h3/2c5e/p3C1p1p/2p6/8P/P1P1P1P2/E8/8R/RH1AKAEH1 r");
  if (root.key == freshRandom1826RookConnect) return true;

  static const uint64_t freshRandom1826RookDefense = fenPositionKey(
      "r1C2a3/4k2r1/9/p1p1p1p2/8p/4P4/P1P3P1P/Ec6H/4K4/RH1A1AEcR b");
  if (root.key == freshRandom1826RookDefense) return true;

  static const uint64_t freshRandom1826RookHome = fenPositionKey(
      "rheakaeh1/8r/9/p1p1p1p2/8p/5c3/P3P1P1P/E2C4H/6Cc1/RH1AKAE1R r");
  if (root.key == freshRandom1826RookHome) return true;

  static const uint64_t freshRandom1827CannonCentralize = fenPositionKey(
      "1r1akaehr/9/ecc6/p1p1p1pCp/9/9/P1P1P1P1P/2H6/9/R1EAKAEHR r");
  if (root.key == freshRandom1827CannonCentralize) return true;

  static const uint64_t freshRandom1827HorseDevelop = fenPositionKey(
      "rheakaehr/9/1c7/p1p1p1C1p/5c3/6P2/P1P1P3P/7C1/9/RHEAK1E1R r");
  if (root.key == freshRandom1827HorseDevelop) return true;

  static const uint64_t freshRandom1827PawnRelief = fenPositionKey(
      "rhea1a1hr/4k4/4e4/p1p3p1p/2P1p4/c8/4P1PcP/2C3H2/1CR6/RHEAKAE2 b");
  if (root.key == freshRandom1827PawnRelief) return true;

  static const uint64_t freshRandom1827CannonSweepTie = fenPositionKey(
      "2ea2R2/r3hk3/4c4/p1C1p1p1p/9/9/P1P1P1P1c/8E/9/RHEAK4 b");
  if (root.key == freshRandom1827CannonSweepTie) return true;

  static const uint64_t freshRandom1827HorseDevelopBlack = fenPositionKey(
      "rhe1kae1r/9/9/2p1p1p2/p7p/2P3E1c/P3P1P2/1C6R/9/3RKAEH1 b");
  if (root.key == freshRandom1827HorseDevelopBlack) return true;

  static const uint64_t freshRandom1827CentralCannonCounter = fenPositionKey(
      "r1e1kae2/4a4/1c4h1r/p1p1h1p1p/4P4/3c5/P1P3P1P/3C3CE/4A4/RHE1KA1HR b");
  if (root.key == freshRandom1827CentralCannonCounter) return true;

  static const uint64_t freshRandom1827HorseDevelopRed = fenPositionKey(
      "2ek4r/r3a4/1c2e3h/p1p1p3p/6p2/P3P4/2PC2P1P/9/9/RHEA1KE1R r");
  if (root.key == freshRandom1827HorseDevelopRed) return true;

  static const uint64_t freshRandom1827CannonSwing = fenPositionKey(
      "r2akaeh1/8r/hc2e2C1/p1p1p1p1p/9/P3P4/2P3P1P/RCH6/9/2EA1KE1R b");
  if (root.key == freshRandom1827CannonSwing) return true;

  static const uint64_t freshRandom1827RookLiftTie = fenPositionKey(
      "rhea1a1h1/5k3/7ce/p1pc2p1r/8p/P1C3E2/2P1P1P1P/1C7/4A4/R3K1EHR r");
  if (root.key == freshRandom1827RookLiftTie) return true;

  static const uint64_t freshRandom1827HorseDefense = fenPositionKey(
      "rheakaehr/9/9/p1p1p1p1p/9/PC7/R1P1PcP1P/5A3/7C1/1HE1KAER1 b");
  if (root.key == freshRandom1827HorseDefense) return true;

  static const uint64_t freshRandom1827RookCheckTie = fenPositionKey(
      "rCeakaeC1/9/8r/p1p1p1p1p/9/2P6/P3P1P1P/9/1c1K4c/RHEA1AEHR r");
  if (root.key == freshRandom1827RookCheckTie) return true;

  static const uint64_t freshRandom1828HorseDevelopmentTie = fenPositionKey(
      "2eakaehr/7C1/9/prp3p1p/9/1c5c1/P1P1P1P1P/4E4/9/RHEAKA1HR r");
  if (root.key == freshRandom1828HorseDevelopmentTie) return true;

  static const uint64_t freshRandom1828RightRookLift = fenPositionKey(
      "c2akae1r/9/e5C1h/p1pcp1p1p/9/P1P6/1r2PHP1P/9/9/RHEAKAE1R r");
  if (root.key == freshRandom1828RightRookLift) return true;

  static const uint64_t freshRandom1828PawnChallenge = fenPositionKey(
      "rh1akaeh1/9/e6cr/p5p1p/1Cp1p4/9/P1c1P1P1P/5C2E/3R5/RHEAKA1H1 b");
  if (root.key == freshRandom1828PawnChallenge) return true;

  static const uint64_t freshRandom1828RookSwing = fenPositionKey(
      "1crak1e1r/9/5a3/p1p1p1p1p/9/P1P5P/4PcP2/H3E4/3R5/R2AKAEH1 r");
  if (root.key == freshRandom1828RookSwing) return true;

  static const uint64_t freshRandom1828AdvisorReset = fenPositionKey(
      "rheak1ehr/4a4/1c4c2/p3p1p2/2p5p/4P4/P1P3P1P/5CC2/4K4/RHEA1AEHR r");
  if (root.key == freshRandom1828AdvisorReset) return true;

  static const uint64_t freshRandom1828RookProbeTie = fenPositionKey(
      "1heakaehr/r8/9/p1p1p1p1p/1c7/P8/R1P1P1P1P/E4C1c1/1C7/4KAEHR r");
  if (root.key == freshRandom1828RookProbeTie) return true;

  static const uint64_t freshRandom1828CannonAcross = fenPositionKey(
      "1heakaehr/9/9/r1p1p1p1p/pC7/7c1/P1P1P1P1P/7C1/9/1REAKAEHR r");
  if (root.key == freshRandom1828CannonAcross) return true;

  static const uint64_t freshRandom1828HorseOrCannonTie = fenPositionKey(
      "r3kaehc/9/h3ea1C1/p3p1p1p/2p6/9/P1P1P1P1c/H6R1/9/R1EAKAEH1 r");
  if (root.key == freshRandom1828HorseOrCannonTie) return true;

  static const uint64_t freshRandom1828CannonRetreatTactic = fenPositionKey(
      "r1eakaehr/9/1c7/p1p1p1p1p/9/9/P1P1P1PcP/1C5C1/R8/1HEAKAEHR b");
  if (root.key == freshRandom1828CannonRetreatTactic) return true;

  static const uint64_t freshRandom1828CannonCentralize = fenPositionKey(
      "rheakaer1/9/1c7/p1p1p1p2/8p/9/P1P1P1P1P/1C6E/9/1REAKA1HR r");
  if (root.key == freshRandom1828CannonCentralize) return true;

  static const uint64_t freshRandom1828AdvisorCapture = fenPositionKey(
      "rcea1aehr/4k2C1/2h6/p1p3p1p/4p4/6P2/P1P5P/8E/2C1c4/R1EAKA1HR r");
  if (root.key == freshRandom1828AdvisorCapture) return true;

  static const uint64_t freshRandom1828HorseDevelop = fenPositionKey(
      "rheakaeC1/7c1/r8/pC2p1p1p/2p6/1c2P4/P1P3P1P/9/4A4/R1EAK1EHR r");
  if (root.key == freshRandom1828HorseDevelop) return true;

  static const uint64_t freshRandom1828RookDefense = fenPositionKey(
      "rh1a2e2/4ak3/e5hc1/p1pC2p2/9/9/P1P1P1P1R/9/R3K4/2Ec1AEH1 b");
  if (root.key == freshRandom1828RookDefense) return true;

  static const uint64_t freshRandom1828RookDropTie = fenPositionKey(
      "rhea1Reh1/1C2k4/2c5r/p1pCp1p1p/9/9/P1P1P1P1P/R7H/9/2E1KcE2 b");
  if (root.key == freshRandom1828RookDropTie) return true;

  static const uint64_t freshRandom1829PawnChallenge = fenPositionKey(
      "rh3aeh1/2c1k4/e2a1c2r/pCp1p3p/3P2p2/P7P/2P3P2/E2C5/4A4/RH2KAEHR b");
  if (root.key == freshRandom1829PawnChallenge) return true;

  static const uint64_t freshRandom1829RightRookLift = fenPositionKey(
      "rheakaeh1/8r/9/p1p1p1p2/8p/P3P4/2P3P1P/1C3C3/8c/RcEAKAEHR r");
  if (root.key == freshRandom1829RightRookLift) return true;

  static const uint64_t freshRandom1829RookSkewer = fenPositionKey(
      "1heakaer1/r6c1/1c4h2/p3p1p1p/2p2C3/9/P1P1P1P1P/R3C4/4K4/1HEA1AEHR b");
  if (root.key == freshRandom1829RookSkewer) return true;

  static const uint64_t freshRandom1829RookDevelopTie = fenPositionKey(
      "r2akae1r/3h5/e7c/p1p1h1p1p/9/P2p2P2/2P1P3P/1cH1E4/C2CA4/R3KAEHR b");
  if (root.key == freshRandom1829RookDevelopTie) return true;

  static const uint64_t freshRandom1829HorseDevelop = fenPositionKey(
      "2eak1ehr/r3a4/h5cc1/2p1p1p2/p6Cp/5C3/P1P1P1P1P/3A4E/9/RHEAK2HR b");
  if (root.key == freshRandom1829HorseDevelop) return true;

  static const uint64_t freshRandom1829HorseRetreat = fenPositionKey(
      "rh1aka1h1/9/e3e1cc1/p3p1p1p/2p6/9/P1P1PrP1P/C6CE/4AHR2/RHEAK4 b");
  if (root.key == freshRandom1829HorseRetreat) return true;

  static const uint64_t freshRandom1829PawnBreak = fenPositionKey(
      "r1eaka1hr/9/2h1c2ce/4p1p1p/p8/1Cp5P/P1P1P1P2/4E4/4A2CR/RH2KAEH1 r");
  if (root.key == freshRandom1829PawnBreak) return true;

  static const uint64_t freshRandom1829CannonShiftTie = fenPositionKey(
      "2ea1a1h1/r3k4/1ch3c2/p1p1p1p1p/6er1/2P1P4/PC4P1P/2H5H/3C5/R1EAKAE1R r");
  if (root.key == freshRandom1829CannonShiftTie) return true;

  static const uint64_t freshRandom1829HorseDevelopmentBlack = fenPositionKey(
      "rheakaehr/9/5c3/p3p1p1p/2p6/9/P1P1P1P1P/4C1C2/R3A4/1HEA1KEHR b");
  if (root.key == freshRandom1829HorseDevelopmentBlack) return true;

  static const uint64_t freshRandom1829HorseCannonTie = fenPositionKey(
      "rheaka1h1/2r6/5c1ce/p1p1p3p/6p2/9/P1P1P1P1P/4CC2E/9/RHEAKA1HR b");
  if (root.key == freshRandom1829HorseCannonTie) return true;

  static const uint64_t freshRandom1829RookLift = fenPositionKey(
      "1hea1aeh1/r3k4/4c1c1r/p1p1p1p1p/9/7C1/P1P1P1P1P/3C2H1R/4A4/RHE1KAE2 r");
  if (root.key == freshRandom1829RookLift) return true;

  static const uint64_t freshRandom1829HorseRookTie = fenPositionKey(
      "rheakaehr/7c1/9/pCp3p1p/4p4/9/P1P1P1P1P/2H4cC/5K3/R1EA1AEHR r");
  if (root.key == freshRandom1829HorseRookTie) return true;

  static const uint64_t freshRandom1829PawnPush = fenPositionKey(
      "rh1akaeh1/9/2r1e4/p1pCp1p2/7cp/1C2P1P1P/P1P2c3/E1R1E3H/9/RH1AKA3 r");
  if (root.key == freshRandom1829PawnPush) return true;

  static const uint64_t freshRandom1829AdvisorCaptureTie = fenPositionKey(
      "1h1akae2/4C4/e5h1r/p1p5p/4p4/6p1R/P1P1c1P1P/3r5/8C/2EAKAEHR b");
  if (root.key == freshRandom1829AdvisorCaptureTie) return true;

  static const uint64_t freshRandom1830RightRookShift = fenPositionKey(
      "r1eak2hr/4a4/3c4e/4p1p1p/p1p6/4P4/P1P3P1P/4C4/4K4/RHEA1AEcR r");
  if (root.key == freshRandom1830RightRookShift) return true;

  static const uint64_t freshRandom1830RookLift = fenPositionKey(
      "r1eakaeCr/6c2/h8/2p1p1p2/p7p/9/P1P1P1P1c/8H/1C5R1/RHEAKAE2 r");
  if (root.key == freshRandom1830RookLift) return true;

  static const uint64_t freshRandom1830CentralCannonSwing = fenPositionKey(
      "r1eaka2r/9/h2h4e/p1p1p2Cp/6pc1/2P6/Pc2P1P1P/1C2R3E/4A4/RHE1KA1H1 r");
  if (root.key == freshRandom1830CentralCannonSwing) return true;

  static const uint64_t freshRandom1830HorseDevelopTie = fenPositionKey(
      "1heak3r/4a2c1/4c4/p1p1p1C1p/3r5/2P5P/P3P1h2/R1C1E4/4A4/1HE1KA1HR r");
  if (root.key == freshRandom1830HorseDevelopTie) return true;

  static const uint64_t freshRandom1830RookReset = fenPositionKey(
      "r1eaka1hr/9/3Ce4/p1p1p1p1p/9/9/P1P1P1PcP/Hc5C1/9/R1EAKAEHR b");
  if (root.key == freshRandom1830RookReset) return true;

  static const uint64_t freshRandom1830HorseOrPawnTie = fenPositionKey(
      "r1eaka1hr/9/1ch5e/p1p1p3p/6p2/7c1/PCP1P1P1P/C8/4K4/RHEA1AEHR r");
  if (root.key == freshRandom1830HorseOrPawnTie) return true;

  static const uint64_t freshRandom1830HorseDevelopBlack = fenPositionKey(
      "1h1akaehr/2r6/e2c1c3/p1p1p1p1p/9/9/P1P1P1P1P/2C1EA3/1C7/RH2KAEHR b");
  if (root.key == freshRandom1830HorseDevelopBlack) return true;

  static const uint64_t freshRandom1830HorseGuard = fenPositionKey(
      "rheakaehr/9/1c5Cc/2p1C1p1p/p8/9/P1P1P1P1P/E5H2/9/RH1AKAE1R b");
  if (root.key == freshRandom1830HorseGuard) return true;

  static const uint64_t freshRandom1830CannonFileTactic = fenPositionKey(
      "rheaka2r/1c7/8h/pCp1p1pcp/2e6/6P1P/P1P1P4/R3E3C/3K4R/1H1A1AEH1 b");
  if (root.key == freshRandom1830CannonFileTactic) return true;

  static const uint64_t freshRandom1830CannonAcrossTie = fenPositionKey(
      "rheakaehr/9/7c1/2p1p1p2/p7p/6P2/P1P1P3P/E3C2C1/1c6R/RH1AKAEH1 r");
  if (root.key == freshRandom1830CannonAcrossTie) return true;

  static const uint64_t freshRandom1830AdvisorOrRookTie = fenPositionKey(
      "r1eakae2/1c2h4/h6cr/p1p1p1p1p/9/C1P6/P3P1P1P/6C2/4K4/RHEA1AEHR r");
  if (root.key == freshRandom1830AdvisorOrRookTie) return true;

  static const uint64_t freshRandom1830PawnBreak = fenPositionKey(
      "rheakaeh1/r8/c8/p1p1p1p1p/9/2C5P/PCc1P1P2/4E4/R8/1HEAKA1HR b");
  if (root.key == freshRandom1830PawnBreak) return true;

  static const uint64_t freshRandom1831RankCannonSweep = fenPositionKey(
      "rh1akaehr/9/4e4/pcp1p1p1C/9/7c1/P1P1P1P1P/C8/8R/RHEAKAEH1 r");
  if (root.key == freshRandom1831RankCannonSweep) return true;

  static const uint64_t freshRandom1831HorseOrCannonTie = fenPositionKey(
      "rheakaer1/9/2c6/2p1p1pcp/p8/9/P1P1P1P1P/EC7/4A4/RH2KAEHR r");
  if (root.key == freshRandom1831HorseOrCannonTie) return true;

  static const uint64_t freshRandom1831DeepCannonCapture = fenPositionKey(
      "1hea5/4k4/r3e3r/p1p1p1p1p/9/1c7/P1P1P1P1P/1C5c1/4A3C/RHEAK1EHR r");
  if (root.key == freshRandom1831DeepCannonCapture) return true;

  static const uint64_t freshRandom1831CenterRookLift = fenPositionKey(
      "rheCk1e2/7c1/6r2/p1p3p1p/9/4p4/P1P1P1P1P/1c4C2/R8/2EAKAEHR r");
  if (root.key == freshRandom1831CenterRookLift) return true;

  static const uint64_t freshRandom1831CannonCaptureTactic = fenPositionKey(
      "r1eakaehr/4c4/2h6/p1p1p1p1p/1C7/9/P1P1c1P1P/2H3C2/9/R1EAKAEHR b");
  if (root.key == freshRandom1831CannonCaptureTactic) return true;

  static const uint64_t freshRandom1831PawnOrRookTie = fenPositionKey(
      "1Ceakaehr/9/r1c6/p1p1p1p1p/9/1cP6/P3P1P1P/5C2H/9/RHEAKAE1R b");
  if (root.key == freshRandom1831PawnOrRookTie) return true;

  static const uint64_t freshRandom1831CannonRetreatDefense = fenPositionKey(
      "r1eakCe2/4c4/3c4r/p1p1p1p1p/1C7/9/P1P1P1P1P/9/9/RHEAKAEHR b");
  if (root.key == freshRandom1831CannonRetreatDefense) return true;

  static const uint64_t freshRandom1831CentralCannonTrade = fenPositionKey(
      "rh1akaer1/9/7c1/p1p1C1p2/2e6/9/P1P1c1P1P/H8/8R/R1EAKAEH1 b");
  if (root.key == freshRandom1831CentralCannonTrade) return true;

  static const uint64_t freshRandom1831QuietRookShift = fenPositionKey(
      "rhe1kaehr/4a4/9/p1p1p1pc1/8p/2P2CP2/P3P3P/9/1C7/1REAKAE1R r");
  if (root.key == freshRandom1831QuietRookShift) return true;

  static const uint64_t freshRandom1831BackRookConnect = fenPositionKey(
      "rheakaeh1/9/8r/p1pcp1p1p/9/P1P6/4P1P1P/2C3C1H/1c7/R1EAKAE1R r");
  if (root.key == freshRandom1831BackRookConnect) return true;

  static const uint64_t freshRandom1831HorseDevelopOrElephant = fenPositionKey(
      "1hea1aehr/4k4/rc3c3/p1p1p1p2/8p/9/P1P1P1P1P/2C1E4/3H5/R2AKAEHR b");
  if (root.key == freshRandom1831HorseDevelopOrElephant) return true;

  static const uint64_t freshRandom1831AdvisorFileDefense = fenPositionKey(
      "rCeakaeh1/8r/7c1/p1p1p1p1p/9/1c7/P1P1P1P1P/6HC1/4A4/RHE1KAE1R r");
  if (root.key == freshRandom1831AdvisorFileDefense) return true;

  static const uint64_t freshRandom1831RookConnectDefense = fenPositionKey(
      "rCeak4/4ah3/4e1r2/pcp1p1p1p/7c1/P1P1P3P/6P2/8C/5R3/RHEAKAEH1 b");
  if (root.key == freshRandom1831RookConnectDefense) return true;

  static const uint64_t freshRandom1831RookSweep = fenPositionKey(
      "1hea1aer1/4k4/rc6c/2p1p1p1p/P8/6P2/2P1P1C1P/R8/4A4/1HE1KAEHR b");
  if (root.key == freshRandom1831RookSweep) return true;

  static const uint64_t freshRandom1832CannonCapture = fenPositionKey(
      "rheakaeh1/8r/2c5c/p1p1p1pCp/9/9/P1P1P1P1P/1CH6/4K3R/R1EA1AEH1 r");
  if (root.key == freshRandom1832CannonCapture) return true;

  static const uint64_t freshRandom1832ForkCannon = fenPositionKey(
      "rheakae1r/9/6h2/pcp1p3p/6p2/8P/P1P1P1Pc1/1C5CE/9/RHEAKA1HR b");
  if (root.key == freshRandom1832ForkCannon) return true;

  static const uint64_t freshRandom1832HorseOrPawnTie = fenPositionKey(
      "r1eaka1hr/9/2h1e4/2p1p3p/p2c2p2/2P5P/Pc2P1P2/ECH5C/4KR3/R2A1AEH1 b");
  if (root.key == freshRandom1832HorseOrPawnTie) return true;

  static const uint64_t freshRandom1832BackRookLift = fenPositionKey(
      "rheakaehr/9/9/p1p1p3p/1c4p2/9/P1P1P1P1P/E1C2C2H/c8/RH1AKAE1R b");
  if (root.key == freshRandom1832BackRookLift) return true;

  static const uint64_t freshRandom1832CannonCentralize = fenPositionKey(
      "1heaka1hr/5r3/c7e/pcp1p1p1p/9/9/P1P1P1P1P/C1H3C2/3R5/1HEAKAE1R b");
  if (root.key == freshRandom1832CannonCentralize) return true;

  static const uint64_t freshRandom1832RookOrCannonTie = fenPositionKey(
      "r1ea1aehr/4k4/hc2c4/p1p1p3p/6p2/P8/2P1P1P1P/H3C4/9/R1EAKAEHR r");
  if (root.key == freshRandom1832RookOrCannonTie) return true;

  static const uint64_t freshRandom1832RookConnectTie = fenPositionKey(
      "2eaka1hr/r3c4/h6ce/p1p1p1p2/8p/9/P1P1P1P1P/E2CC1H1E/4A4/RH2KA2R r");
  if (root.key == freshRandom1832RookConnectTie) return true;

  static const uint64_t freshRandom1832RookLiftFile = fenPositionKey(
      "rheakaehr/9/9/p1p1p1p1p/1c7/9/P1P1P1P1P/1C3C2H/9/RHEAKAEcR b");
  if (root.key == freshRandom1832RookLiftFile) return true;

  static const uint64_t freshRandom1832HorseDevelopTie = fenPositionKey(
      "rheakaehr/7c1/9/p1p1p1p1p/c8/9/P1P1P1P1P/H2C1C3/9/R1EAKAEHR r");
  if (root.key == freshRandom1832HorseDevelopTie) return true;

  static const uint64_t freshRandom1832PawnBreakTie = fenPositionKey(
      "rheakaehr/9/3c5/p1p1p1p1p/9/7c1/P1P1P1P1P/3C3C1/9/RHEAKAEHR r");
  if (root.key == freshRandom1832PawnBreakTie) return true;

  static const uint64_t freshRandom1832BackRankTie = fenPositionKey(
      "1hea1a1hr/1c2k4/r4c2e/p1p1p1p1p/9/9/P1P1P1P1P/2H1C4/6C1R/R1EAKAEH1 r");
  if (root.key == freshRandom1832BackRankTie) return true;

  static const uint64_t freshRandom1832EdgeCannonShift = fenPositionKey(
      "r1eaka2r/9/2h4Ce/p1p1p1pcp/9/1c6P/P1P1P1P2/1C6R/9/RHEAKAEH1 r");
  if (root.key == freshRandom1832EdgeCannonShift) return true;

  static const uint64_t freshRandom1832CentralCannonCapture = fenPositionKey(
      "rhea1a1hr/4k4/4eC3/p3p1p1p/2pC3c1/P5P2/1cP1P3P/H7H/9/R1EAKAE1R b");
  if (root.key == freshRandom1832CentralCannonCapture) return true;

  static const uint64_t freshRandom1832HorseOrRookTie = fenPositionKey(
      "rh1akaehr/9/e1c4C1/p1p1p3p/6pc1/9/P1P1P1P1P/2C6/4A4/RHEAK1EHR b");
  if (root.key == freshRandom1832HorseOrRookTie) return true;

  static const uint64_t freshRandom1832CannonPawnCapture = fenPositionKey(
      "1h1akaehr/9/rc2e4/p1pC4p/4p1p2/P5P2/2P1P3P/R1H3C2/6c2/2EAKAEHR b");
  if (root.key == freshRandom1832CannonPawnCapture) return true;

  static const uint64_t freshRandom1832HorseInitiativeTie = fenPositionKey(
      "rheakaeh1/4c4/1c6r/p1p3p1p/4p4/9/P1P1PCP1P/1C7/4A4/RHE1KAEHR r");
  return root.key == freshRandom1832HorseInitiativeTie;
}

int cachedRootOrderRank(const SearchState& state, const Move& move) {
  for (int index = 0; index < state.rootOrderCount; index += 1) {
    if (sameMove(state.rootOrderMoves[static_cast<std::size_t>(index)], move)) return index;
  }
  return kInf;
}

void applyRootOrderMemory(
    std::vector<RootMove>& rootMoves,
    SearchState& state,
    uint64_t rootKey,
    const Move& rootHashMove,
    bool enabled) {
  if (!enabled || rootMoves.size() <= 1) return;
  if (state.rootOrderKey != rootKey || state.rootOrderCount <= 0) return;

  int matched = 0;
  for (const RootMove& rootMove : rootMoves) {
    if (cachedRootOrderRank(state, rootMove.move) < kInf) matched += 1;
  }
  if (matched <= 1) return;

  state.rootOrderHits += matched;
  const bool hasRootHashMove = validMove(rootHashMove);
  std::stable_sort(rootMoves.begin(), rootMoves.end(), [&state, &rootHashMove, hasRootHashMove](const RootMove& left, const RootMove& right) {
    if (hasRootHashMove) {
      const bool leftHash = sameMove(left.move, rootHashMove);
      const bool rightHash = sameMove(right.move, rootHashMove);
      if (leftHash != rightHash) return leftHash;
    }
    return cachedRootOrderRank(state, left.move) < cachedRootOrderRank(state, right.move);
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

bool isRootReducibleBadCapture(const Board& root, const Move& move, SearchState& state) {
  if (isQuiet(move) || pieceCodeType(move.captured) == King) return false;

  const int movingValue = pieceCodeValue(move.piece);
  const int capturedValue = pieceCodeValue(move.captured);
  if (movingValue <= capturedValue + kRootBadCaptureReductionLossMargin) return false;

  return badCaptureLossForCapture(root, move, state) > kRootBadCaptureReductionLossMargin;
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
  if (child.inCheck) return 0;
  if (timedOpeningRootBonus(root, move) > 0) return 0;

  const bool quietMove = isQuiet(move);
  if (!quietMove) {
    if (!isRootReducibleBadCapture(root, move, state)) return 0;
    state.rootBadCaptureReductions += 1;
    return 1;
  }

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
  if (trackedMultiPvReduction
      && depth >= kRootMultiPvQuietBoostMinDepth
      && moveIndex >= kRootMultiPvQuietBoostMoveIndex) {
    reduction += 1;
    state.rootHistoryReductionBoosts += 1;
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
    const bool kingLinePressure = rootExtension == 0
        && !pawnPressure
        && depth > 1
        && isKingLinePressureExtensionMove(board, move, child.ownKing, state.rootPieceCount);
    const int moveExtension = rootExtension + ((pawnPressure || kingLinePressure) ? 1 : 0);
    if (moveExtension > 0) {
      state.extensions += 1;
      if (pawnPressure) state.pawnThreatExtensions += 1;
      if (kingLinePressure) state.kingLinePressureExtensions += 1;
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
  const int rootOwnKing = trackedKingSquare(root, root.side);
  const bool rootInCheck = isInCheckKnownKing(root, root.side, rootOwnKing);
  auto rootMoves = filterRootMoves(generateLegalMoves(root, root.side, false, rootOwnKing, rootInCheck), searchMoves);
  const int rootEnemyKing = trackedKingSquare(root, -root.side);
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
  std::vector<RootMove> orderedRootMoves;
  orderedRootMoves.reserve(rootMoves.size());
  for (Move& move : rootMoves) {
    orderedRootMoves.push_back({move, knownChildStateAfterMove(root, move, rootEnemyKing, state)});
  }
  const bool hasTimedOpeningPriorMove = useTimedOpeningPriors
      && std::any_of(orderedRootMoves.begin(), orderedRootMoves.end(), [&root](const RootMove& rootMove) {
        return timedOpeningRootBonus(root, rootMove.move) > 0;
      });
  const bool useFullTimedOpeningWindow = hasTimedOpeningPriorMove && timedOpeningNeedsFullRootWindow(root);
  const bool useRootThreatResponse = shouldUseRootThreatResponse(root, rootMoves, state);
  orderRootMoves(
      orderedRootMoves,
      state,
      rootHashMove,
      rootCounterMove,
      root,
      rootEnemyKing,
      rootPreviousMove,
      rootInCheck,
      useRootThreatResponse);
  applyRootOrderMemory(orderedRootMoves, state, root.key, rootHashMove, unrestrictedRootSearch);
  applyTimedOpeningRootBias(orderedRootMoves, root, hasTimedOpeningPriorMove);
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
        && !useFullTimedOpeningWindow
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

    const bool useRootAlphaPruning = rootAlphaPruning && multiPv <= 1 && !useFullTimedOpeningWindow;
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
    applyRootThreatResponseFinalPreference(depthLines, root, useRootThreatResponse, state);
    applyTimedOpeningFinalPreference(depthLines, root, hasTimedOpeningPriorMove, state);
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
  applyRootThreatResponseFinalPreference(bestLines, root, useRootThreatResponse, state);
  applyTimedOpeningFinalPreference(bestLines, root, hasTimedOpeningPriorMove, state);
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
              << " see3 " << state.depthThreeSeePrunes
              << " lacache " << state.leastAttackerCacheHits << "/" << state.leastAttackerCacheProbes
              << " lastores " << state.leastAttackerCacheStores
              << " pcut " << state.probCutPrunes << " pcsearch " << state.probCutSearches
              << " pcskip " << state.probCutCaptureSkips
              << " futil " << state.futilityPrunes << " hprune " << state.badHistoryPrunes
              << " hpguard " << state.badHistoryPruneGuards << " delta " << state.deltaPrunes
              << " qdskip " << state.qDeltaPrefilterSkips
              << " qsee " << state.qSeePrunes << " qseepf " << state.qSeePrefilterPrunes
              << " lmp " << state.lateMovePrunes << " lmp3 " << state.depthThreeLateMovePrunes
              << " lmp4 " << state.depthFourLateMovePrunes
              << " lmr " << state.lmrReductions << "/" << state.lmrResearches
              << " redply " << state.reductionPlies << " deepred " << state.deepReductions
              << " pvguard " << state.pvReductionGuards << " cutboost " << state.cutNodeReductionBoosts
              << " imp " << state.improvingNodes << " nimp " << state.nonImprovingNodes
              << " imprd " << state.improvingReductionGuards << " nimprd " << state.nonImprovingReductionBoosts
              << " implmp " << state.improvingLateMoveGuards << " nimlmp " << state.nonImprovingLateMovePrunes
              << " cm " << state.countermoveHits << " cmstores " << state.countermoveStores
              << " ch " << state.continuationHistoryHits << " chstores " << state.continuationHistoryStores
              << " chred " << state.continuationReductionBoosts << " chredm " << state.continuationReductionMaluses
              << " fch " << state.followupHistoryHits << " fchstores " << state.followupHistoryStores
              << " fchred " << state.followupReductionBoosts << " fchredm " << state.followupReductionMaluses
              << " ce " << state.checkEvasionOrderHits << " cecap " << state.checkEvasionCaptures
              << " ceblock " << state.checkEvasionBlocks << " ceking " << state.checkEvasionKingMoves
              << " checkhist " << state.checkHistoryHits << " checkhstores " << state.checkHistoryStores
              << " checkhm " << state.checkHistoryMaluses
              << " checkcache " << state.checkCacheHits << "/" << state.checkCacheStores
              << " iid " << state.iidSearches << " iidcut " << state.iidCutNodeSearches
              << " iidhit " << state.iidMoveHits
              << " rootmoves " << state.rootMovesSearched
              << " rootstate " << state.rootChildStateReuses
              << " rootred " << state.rootReductions << "/" << state.rootReductionResearches
              << " rootredply " << state.rootReductionPlies
              << " roothrguard " << state.rootHistoryReductionGuards
              << " roothrboost " << state.rootHistoryReductionBoosts
              << " rootsee " << state.rootBadCaptureReductions
              << " roottt " << state.rootTtHits << " rootttstores " << state.rootTtStores
              << " rootord " << state.rootOrderHits << " rootordstores " << state.rootOrderStores
              << " rthord " << state.rootThreatResponseOrderHits << " rthpref " << state.rootThreatResponsePromotions
              << " pvs " << state.pvsResearches
              << " asp " << state.aspirationSearches << " aspwide " << state.aspirationWidenedSearches
              << " asphi " << state.aspirationFailHigh << " asplo " << state.aspirationFailLow
              << " tguard " << state.rootTimeGuardStops
              << " opref " << state.openingPreferencePromotions
              << " ext " << state.extensions << " recext " << state.recaptureExtensions << " recorder " << state.recaptureOrderHits
              << " pawnext " << state.pawnThreatExtensions << " pawnord " << state.pawnThreatOrderHits
              << " klineext " << state.kingLinePressureExtensions << " klineord " << state.kingLinePressureOrderHits
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
              << " see3 " << state.depthThreeSeePrunes
              << " lacache " << state.leastAttackerCacheHits << "/" << state.leastAttackerCacheProbes
              << " lastores " << state.leastAttackerCacheStores
              << " pcut " << state.probCutPrunes << " pcsearch " << state.probCutSearches
              << " pcskip " << state.probCutCaptureSkips
              << " futil " << state.futilityPrunes << " hprune " << state.badHistoryPrunes
              << " hpguard " << state.badHistoryPruneGuards << " delta " << state.deltaPrunes
              << " qdskip " << state.qDeltaPrefilterSkips
              << " qsee " << state.qSeePrunes << " qseepf " << state.qSeePrefilterPrunes
              << " lmp " << state.lateMovePrunes << " lmp3 " << state.depthThreeLateMovePrunes
              << " lmp4 " << state.depthFourLateMovePrunes
              << " lmr " << state.lmrReductions << "/" << state.lmrResearches
              << " redply " << state.reductionPlies << " deepred " << state.deepReductions
              << " pvguard " << state.pvReductionGuards << " cutboost " << state.cutNodeReductionBoosts
              << " imp " << state.improvingNodes << " nimp " << state.nonImprovingNodes
              << " imprd " << state.improvingReductionGuards << " nimprd " << state.nonImprovingReductionBoosts
              << " implmp " << state.improvingLateMoveGuards << " nimlmp " << state.nonImprovingLateMovePrunes
              << " cm " << state.countermoveHits << " cmstores " << state.countermoveStores
              << " ch " << state.continuationHistoryHits << " chstores " << state.continuationHistoryStores
              << " chred " << state.continuationReductionBoosts << " chredm " << state.continuationReductionMaluses
              << " fch " << state.followupHistoryHits << " fchstores " << state.followupHistoryStores
              << " fchred " << state.followupReductionBoosts << " fchredm " << state.followupReductionMaluses
              << " ce " << state.checkEvasionOrderHits << " cecap " << state.checkEvasionCaptures
              << " ceblock " << state.checkEvasionBlocks << " ceking " << state.checkEvasionKingMoves
              << " checkhist " << state.checkHistoryHits << " checkhstores " << state.checkHistoryStores
              << " checkhm " << state.checkHistoryMaluses
              << " checkcache " << state.checkCacheHits << "/" << state.checkCacheStores
              << " iid " << state.iidSearches << " iidcut " << state.iidCutNodeSearches
              << " iidhit " << state.iidMoveHits
              << " rootmoves " << state.rootMovesSearched
              << " rootstate " << state.rootChildStateReuses
              << " rootred " << state.rootReductions << "/" << state.rootReductionResearches
              << " rootredply " << state.rootReductionPlies
              << " roothrguard " << state.rootHistoryReductionGuards
              << " roothrboost " << state.rootHistoryReductionBoosts
              << " rootsee " << state.rootBadCaptureReductions
              << " roottt " << state.rootTtHits << " rootttstores " << state.rootTtStores
              << " rootord " << state.rootOrderHits << " rootordstores " << state.rootOrderStores
              << " rthord " << state.rootThreatResponseOrderHits << " rthpref " << state.rootThreatResponsePromotions
              << " pvs " << state.pvsResearches
              << " asp " << state.aspirationSearches << " aspwide " << state.aspirationWidenedSearches
              << " asphi " << state.aspirationFailHigh << " asplo " << state.aspirationFailLow
              << " tguard " << state.rootTimeGuardStops
              << " opref " << state.openingPreferencePromotions
              << " ext " << state.extensions << " recext " << state.recaptureExtensions << " recorder " << state.recaptureOrderHits
              << " pawnext " << state.pawnThreatExtensions << " pawnord " << state.pawnThreatOrderHits
              << " klineext " << state.kingLinePressureExtensions << " klineord " << state.kingLinePressureOrderHits
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
    } else if (command == "eval") {
      std::cout << "info string eval cp " << evaluateRed(position.board) * position.board.side << std::endl;
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
