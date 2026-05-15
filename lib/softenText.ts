/**
 * Post-processing safety net: replaces command/imperative phrases with
 * gentle, observational language aligned with the Plant Care journal tone.
 *
 * Applied to all AI-generated text before it reaches the user.
 * The primary defence is the system prompt; this is the fallback.
 */

const SOFTEN_RULES: [RegExp, string][] = [
  // ── Command endings ──────────────────────────────────────────────────────
  [/確認してください([。！]?)/g, "見てみると安心かもしれません$1"],
  [/確認しましょう([。！]?)/g,  "眺めてみてもよさそうです$1"],
  [/チェックしてください([。！]?)/g, "気にかけてみてもよさそうです$1"],
  [/チェックしましょう([。！]?)/g,   "気にかけてみるとよさそうです$1"],
  [/水をあげてください([。！]?)/g,   "そろそろ水やりの頃合いかもしれません$1"],
  [/水やりしてください([。！]?)/g,   "そろそろ水やりの頃合いかもしれません$1"],
  [/肥料を与えてください([。！]?)/g, "液体肥料の頃合いかもしれません$1"],
  [/肥料をあげてください([。！]?)/g, "液体肥料の頃合いかもしれません$1"],
  [/剪定してください([。！]?)/g,     "剪定の時期かもしれません$1"],
  [/駆除してください([。！]?)/g,     "早めに対応を考えると安心かもしれません$1"],
  [/対処してください([。！]?)/g,     "様子を見ておくと安心かもしれません$1"],
  // Generic command endings (applied last, after specific ones above)
  [/してください([。！]?)/g, "してみるとよさそうです$1"],
  [/しましょう([。！]?)/g,   "してみてもよさそうです$1"],
  // ── Urgency / pressure words ─────────────────────────────────────────────
  [/今すぐ/g,              "早めに"],
  [/必ず([^。！\n]*)/g,    "できれば$1"],
  [/する必要があります([。！]?)/g, "かもしれません$1"],
  // ── Vocabulary substitutions ─────────────────────────────────────────────
  [/警告/g,          "少し気になるところ"],
  [/診断結果/g,      "今日の様子"],
  [/チェックリスト/g, "今日の気づき"],
  [/やるべきこと/g,   "気にかけること"],
  [/タスク/g,        "気にかけること"],
  [/リマインダー/g,   "便り"],
  [/管理表/g,        "観察ノート"],
];

export function softenText(text: string): string {
  if (!text) return text;
  let result = text;
  for (const [pattern, replacement] of SOFTEN_RULES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
