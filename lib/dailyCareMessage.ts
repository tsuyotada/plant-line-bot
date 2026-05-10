export type PlantWithRecency = {
  id: string;
  display_name: string;
  location?: string | null;
  daysSinceLastPhoto: number | null;
  latestPhotoAt: string | null;
  fertilizerEnabled: boolean;
  fertilizerIntervalDays: number;
  daysSinceLastFertilized: number;
};

export type CarePriority = "recent" | "normal" | "attention" | "urgent";

export type CareRule = {
  id: string;
  plant_id: string;
  task_type: string;
  task_detail: string;
  interval_days: number;
  title: string;
  message: string;
  confidence: "low" | "medium" | "high";
  is_active: boolean;
};

export function getCarePriority(days: number | null): CarePriority {
  if (days === null || days >= 6) return "urgent";
  if (days <= 1) return "recent";
  if (days <= 3) return "normal";
  return "attention"; // 4〜5日
}

const APP_LINK_PHRASES = [
  "余力あれば水やり前に写真撮影も！👇",
  "写真を残しておくと、次の変化に気づきやすいです👇",
  "今日のお世話ついでに、1枚だけ記録しておきましょう👇",
  "水やり前の様子を残しておくと、あとで見返しやすいです👇",
  "植物の変化を写真で残しておきましょう👇",
  "今日のお世話をアプリで確認する👇",
  "写真つきで今日のお世話を確認する👇",
];

function datePick<T>(items: T[], dateStr: string, salt: number): T {
  const seed = `${dateStr}:${salt}`;
  let h = 0;
  for (const c of seed) {
    h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  }
  return items[Math.abs(h) % items.length];
}

// タスク種別の優先順位（LINE要約用）: 観察・環境系を水やり/肥料より優先
const LINE_TASK_RANK: Record<string, number> = {
  observation: 1, environment: 2, soil: 3, support: 4,
  pruning: 5, harvesting: 6, other: 7, watering: 99, fertilizing: 99,
};

function buildLineSummary(
  plant: PlantWithRecency,
  rules: CareRule[],
): { summary: string; needsAction: boolean } {
  const priority = getCarePriority(plant.daysSinceLastPhoto);
  const needsWater = priority === "urgent" || priority === "attention";
  const needsFertilizer =
    plant.fertilizerEnabled &&
    plant.daysSinceLastFertilized >= plant.fertilizerIntervalDays;
  const needsAction = needsWater || needsFertilizer;

  let summary: string;
  if (needsWater && needsFertilizer) {
    summary = "水やりと液体肥料のタイミングです";
  } else if (needsWater) {
    // care_rule のタイトルが短ければそちらを使う（より具体的な表現）
    const rule = rules
      .filter(r => r.is_active && r.task_type !== "fertilizing")
      .sort((a, b) => (LINE_TASK_RANK[a.task_type] ?? 8) - (LINE_TASK_RANK[b.task_type] ?? 8))[0];
    if (rule?.title && rule.title.length <= 20) {
      summary = rule.title;
    } else {
      summary = priority === "urgent" ? "土が乾いていたら水やりを" : "水やりのタイミングを確認して";
    }
  } else if (needsFertilizer) {
    summary = "液体肥料をあげるタイミングです";
  } else {
    // 重要度の高い観察ルールがあれば反映
    const rule = rules.find(
      r => r.is_active && r.task_type === "observation" && r.confidence !== "low"
    );
    summary = rule?.title ?? "今日は観察中心で";
  }

  return { summary, needsAction };
}

export function buildDailyCareMessage(
  today: string,
  plants: PlantWithRecency[],
  careRulesMap: Map<string, CareRule[]> = new Map(),
): string {
  const appLinkPhrase = datePick(APP_LINK_PHRASES, today, 200);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "https://plant-line-bot-forme.vercel.app/";

  const summaries = plants.slice(0, 8).map(plant => ({
    plant,
    ...buildLineSummary(plant, careRulesMap.get(plant.id) ?? []),
  }));

  const actionItems = summaries.filter(s => s.needsAction);

  const intro = actionItems.length > 0
    ? "今日は少し気にかけたい植物があります。"
    : "今日は全体的に様子見でOKです。";

  const plantSection =
    actionItems.length > 0
      ? actionItems.map(({ plant, summary }) => `・${plant.display_name}：${summary}`).join("\n")
      : "今日のお世話はありません 🌿";

  return [
    "【今日の植物メモ 🌱】",
    "",
    intro,
    "",
    plantSection,
    "",
    appLinkPhrase,
    appUrl,
    "詳細はアプリで見てください🌿",
  ].join("\n");
}
