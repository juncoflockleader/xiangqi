import { moveToNotation } from "./board.js";

const PRACTICE_FOCUS = Object.freeze({
  "missed-material": Object.freeze({
    title: "Material tactics",
    text: "Practice scanning forcing captures before choosing a quiet move.",
    drill: "candidate-captures",
    tag: "material"
  }),
  "unsafe-capture": Object.freeze({
    title: "Capture safety",
    text: "Practice checking recaptures and protected pieces before taking material.",
    drill: "capture-safety",
    tag: "tactics"
  }),
  "missed-check": Object.freeze({
    title: "Forcing checks",
    text: "Practice looking at checks first, especially when the opponent's general is exposed.",
    drill: "forcing-checks",
    tag: "forcing"
  }),
  "missed-threat": Object.freeze({
    title: "Building initiative",
    text: "Practice finding moves that create immediate threats instead of only improving position.",
    drill: "initiative-threats",
    tag: "initiative"
  }),
  "allowed-threat": Object.freeze({
    title: "Threat defense",
    text: "Practice asking what the opponent threatens after your move.",
    drill: "defensive-threats",
    tag: "defense"
  }),
  "positional-drift": Object.freeze({
    title: "Piece coordination",
    text: "Practice comparing quiet candidate moves by activity, protection, and long-term pressure.",
    drill: "coordination",
    tag: "positional"
  })
});

export function practiceFocusFromReview(review) {
  const primary = primaryMistakeCategory(review?.mistakes);
  if (!primary) return null;

  return {
    ...practiceFocusForCategory(primary.category, primary),
    move: notationFor(review.move),
    bestMove: notationFor(review.bestMove),
    classification: review.classification ?? null,
    centipawnLoss: Math.round(review.centipawnLoss ?? 0),
    reason: primary.summary ?? review.mistakes?.summary ?? ""
  };
}

export function aggregatePracticeFocusFromReview(review, options = {}) {
  const maxFocus = normalizeLimit(options.maxFocus ?? options.limit ?? 3);
  const groups = new Map();

  for (const move of review?.moves ?? []) {
    for (const category of move.review?.mistakes?.categories ?? []) {
      const key = category.category;
      const current = groups.get(key) ?? {
        category: key,
        count: 0,
        severity: 0,
        centipawnLoss: 0,
        examples: []
      };

      current.count += 1;
      current.severity += Math.round(category.severity ?? 0);
      current.centipawnLoss += Math.round(move.review?.centipawnLoss ?? 0);
      if (current.examples.length < 3) {
        current.examples.push({
          ply: move.ply,
          moveNumber: move.moveNumber,
          side: move.side,
          move: move.notation,
          bestMove: notationFor(move.review?.bestMove),
          classification: move.review?.classification ?? null,
          centipawnLoss: Math.round(move.review?.centipawnLoss ?? 0),
          reason: category.summary ?? ""
        });
      }

      groups.set(key, current);
    }
  }

  return [...groups.values()]
    .sort(comparePracticeGroups)
    .slice(0, maxFocus)
    .map((group) => ({
      ...practiceFocusForCategory(group.category, group),
      count: group.count,
      totalSeverity: group.severity,
      averageSeverity: group.count > 0 ? Math.round(group.severity / group.count) : 0,
      averageCentipawnLoss: group.count > 0 ? Math.round(group.centipawnLoss / group.count) : 0,
      examples: group.examples
    }));
}

function primaryMistakeCategory(mistakes) {
  if (!mistakes || mistakes.primary === "none") return null;
  return (mistakes.categories ?? []).find((category) => category.category === mistakes.primary)
    ?? mistakes.categories?.[0]
    ?? null;
}

function practiceFocusForCategory(category, context = {}) {
  const focus = PRACTICE_FOCUS[category] ?? {
    title: "Decision quality",
    text: "Practice comparing candidate moves before committing.",
    drill: "candidate-comparison",
    tag: context.tag ?? "accuracy"
  };

  return {
    kind: "practice",
    category,
    tag: context.tag ?? focus.tag,
    title: focus.title,
    text: focus.text,
    drill: focus.drill,
    severity: Math.round(context.severity ?? context.averageSeverity ?? 0)
  };
}

function comparePracticeGroups(a, b) {
  if (b.count !== a.count) return b.count - a.count;
  if (b.severity !== a.severity) return b.severity - a.severity;
  return a.category.localeCompare(b.category);
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 3;
  return Math.max(0, Math.min(12, parsed));
}

function notationFor(move) {
  if (!move) return null;
  return typeof move === "string" ? move : move.notation ?? moveToNotation(move);
}
