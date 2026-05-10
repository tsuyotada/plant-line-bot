import { getPlantTrivia } from "./plantTrivias";

export type PlantWithRecency = {
  id: string;
  display_name: string;
  plant_type?: string | null;
  location?: string | null;
  daysSinceLastPhoto: number | null;
  latestPhotoAt: string | null;
  latestPhotoUrl?: string | null;
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
  "余力があれば、水やり前に1枚写真を残しておくと変化に気づきやすいです👇",
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

// Notable task types: these are shown individually (never grouped)
const NOTABLE_TASK_TYPES = new Set(["observation", "environment", "pruning", "harvesting", "soil", "support"]);
const NOTABLE_TASK_RANK: Record<string, number> = {
  observation: 1, environment: 2, soil: 3, pruning: 4, harvesting: 5, support: 6,
};
const LINE_TASK_RANK: Record<string, number> = {
  observation: 1, environment: 2, soil: 3, support: 4, pruning: 5, harvesting: 6, other: 7, watering: 99, fertilizing: 99,
};
const GROUPING_THRESHOLD = 4; // 4件以上なら同一TODOをグルーピング

type PlantActionType = "notable" | "both" | "water" | "fertilizer" | "ok";

type ClassifiedPlant = {
  plant: PlantWithRecency;
  summary: string;
  actionType: PlantActionType;
  notableRule: CareRule | null;
};

function classifyPlant(plant: PlantWithRecency, rules: CareRule[]): ClassifiedPlant {
  const priority = getCarePriority(plant.daysSinceLastPhoto);
  const needsWater = priority === "urgent" || priority === "attention";
  const needsFertilizer =
    plant.fertilizerEnabled &&
    plant.daysSinceLastFertilized >= plant.fertilizerIntervalDays;

  // Best notable rule (medium+ confidence, non-watering/fertilizing task)
  const notableRule = rules
    .filter(r => r.is_active && NOTABLE_TASK_TYPES.has(r.task_type) && r.confidence !== "low")
    .sort((a, b) => (NOTABLE_TASK_RANK[a.task_type] ?? 7) - (NOTABLE_TASK_RANK[b.task_type] ?? 7))[0] ?? null;

  let actionType: PlantActionType;
  if (notableRule) {
    actionType = "notable";
  } else if (needsWater && needsFertilizer) {
    actionType = "both";
  } else if (needsWater) {
    actionType = "water";
  } else if (needsFertilizer) {
    actionType = "fertilizer";
  } else {
    actionType = "ok";
  }

  // Build the one-line summary for bullet lists
  let summary: string;
  if (notableRule) {
    const ruleText = notableRule.title.length <= 22
      ? notableRule.title
      : notableRule.message.slice(0, 35) + "…";
    summary = ruleText;
    if (needsWater && needsFertilizer) summary += "、水やりと液体肥料も";
    else if (needsWater) summary += "、水やりも確認を";
    else if (needsFertilizer) summary += "、液体肥料のタイミングも";
  } else if (actionType === "both") {
    summary = "水やりと液体肥料のタイミングです";
  } else if (actionType === "water") {
    const bestRule = rules
      .filter(r => r.is_active && r.task_type !== "fertilizing")
      .sort((a, b) => (LINE_TASK_RANK[a.task_type] ?? 8) - (LINE_TASK_RANK[b.task_type] ?? 8))[0];
    if (bestRule?.title && bestRule.title.length <= 20) {
      summary = bestRule.title;
    } else {
      summary = priority === "urgent" ? "土が乾いていたら水やりを" : "水やりのタイミングを確認して";
    }
  } else if (actionType === "fertilizer") {
    summary = "液体肥料をあげるタイミングです";
  } else {
    const obsRule = rules.find(r => r.is_active && r.task_type === "observation" && r.confidence !== "low");
    summary = obsRule?.title ?? "今日は観察中心で";
  }

  return { plant, summary, actionType, notableRule };
}

// Build the multi-line description for the 📸 spotlight section
function buildSpotlightDescription(c: ClassifiedPlant): string {
  const { plant, actionType, notableRule } = c;
  if (notableRule?.message) return notableRule.message;
  if (actionType === "both") {
    return `${plant.display_name}は水やりと液体肥料のタイミングです。様子も見てあげましょう。`;
  }
  if (actionType === "water") {
    const priority = getCarePriority(plant.daysSinceLastPhoto);
    if (priority === "urgent") {
      return `${plant.display_name}はしばらく写真が記録されていません。土の乾き具合を確認してみましょう。`;
    }
    return `${plant.display_name}の水やりのタイミングが近づいています。`;
  }
  if (actionType === "fertilizer") {
    return `${plant.display_name}に液体肥料をあげるタイミングです。`;
  }
  return `${plant.display_name}の最近の様子です。`;
}

// Pick the best spotlight plant: notable > both > water > fertilizer > ok (all require latestPhotoUrl)
function pickSpotlight(classified: ClassifiedPlant[]): ClassifiedPlant | null {
  const withPhoto = classified.filter(c => !!c.plant.latestPhotoUrl);
  if (withPhoto.length === 0) return null;
  const order: PlantActionType[] = ["notable", "both", "water", "fertilizer", "ok"];
  for (const type of order) {
    const found = withPhoto.find(c => c.actionType === type);
    if (found) return found;
  }
  return withPhoto[0];
}

// Build 2-line grouped care summary for 4+ plants with same TODO
function buildGroupedLines(label: string, items: ClassifiedPlant[]): string[] {
  const shown = items.slice(0, 4).map(c => c.plant.display_name).join("、");
  const rest = items.length - 4;
  const suffix = rest > 0 ? ` ほか${rest}件` : "";
  return [`${label}が${items.length}件あります。`, `対象：${shown}${suffix}`];
}

export function buildDailyCareMessage(
  today: string,
  plants: PlantWithRecency[],
  careRulesMap: Map<string, CareRule[]> = new Map(),
): { message: string; spotlightPhotoUrl: string | null } {
  const appLinkPhrase = datePick(APP_LINK_PHRASES, today, 200);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "https://plant-line-bot-forme.vercel.app/";

  const classified = plants.slice(0, 12).map(p =>
    classifyPlant(p, careRulesMap.get(p.id) ?? [])
  );

  // ── Spotlight ──────────────────────────────────────────
  const spotlight = pickSpotlight(classified);
  const spotlightPhotoUrl = spotlight?.plant.latestPhotoUrl ?? null;

  // Trivia: use spotlight plant first, then first action plant, then any plant
  const triviaPlant =
    spotlight?.plant ??
    classified.find(c => c.actionType !== "ok")?.plant ??
    classified[0]?.plant ??
    null;
  const trivia = triviaPlant?.plant_type ? getPlantTrivia(triviaPlant.plant_type, today) : null;

  // ── Classify action buckets ────────────────────────────
  const notableItems  = classified.filter(c => c.actionType === "notable");
  const bothItems     = classified.filter(c => c.actionType === "both");
  const waterItems    = classified.filter(c => c.actionType === "water");
  const fertItems     = classified.filter(c => c.actionType === "fertilizer");
  const anyAction     = notableItems.length + bothItems.length + waterItems.length + fertItems.length > 0;

  // ── Assemble message ───────────────────────────────────
  const lines: string[] = ["【今日の植物メモ 🌱】", ""];

  // 📸 Spotlight block (only when there's a photo)
  if (spotlight) {
    lines.push("📸 今日の1枚");
    lines.push(buildSpotlightDescription(spotlight));
    if (trivia) lines.push(`💡 ${trivia}`);
    lines.push("");
  }

  // Care block
  if (!anyAction) {
    lines.push("今日は全体的に大丈夫そうです。ゆっくり様子を見てあげてください。");
  } else {
    // ⚠️ Notable: always shown individually
    if (notableItems.length > 0) {
      lines.push("⚠️ 気になるサイン");
      notableItems.forEach(c => lines.push(`・${c.plant.display_name}：${c.summary}`));
    }

    // 🌿 Routine care: group when ≥ GROUPING_THRESHOLD, individual otherwise
    const routineLines: string[] = [];

    if (bothItems.length >= GROUPING_THRESHOLD) {
      routineLines.push(...buildGroupedLines("水やりと液体肥料のタイミング", bothItems));
    } else {
      bothItems.forEach(c => routineLines.push(`・${c.plant.display_name}：${c.summary}`));
    }

    if (waterItems.length >= GROUPING_THRESHOLD) {
      routineLines.push(...buildGroupedLines("水やりのタイミング", waterItems));
    } else {
      waterItems.forEach(c => routineLines.push(`・${c.plant.display_name}：${c.summary}`));
    }

    if (fertItems.length >= GROUPING_THRESHOLD) {
      routineLines.push(...buildGroupedLines("液体肥料のタイミング", fertItems));
    } else {
      fertItems.forEach(c => routineLines.push(`・${c.plant.display_name}：${c.summary}`));
    }

    if (routineLines.length > 0) {
      if (notableItems.length > 0) lines.push(""); // separator between ⚠️ and 🌿
      lines.push("🌿 今日のケア");
      lines.push(...routineLines);
    }

    // Closing reassurance when there are no notable issues
    if (notableItems.length === 0) {
      lines.push("", "今日は大きな異変はなさそうです。");
    }
  }

  // Trivia without spotlight: add after care section
  if (!spotlight && trivia) {
    lines.push("", `💡 ${trivia}`);
  }

  // App link — no extra blank line when a closing line immediately precedes it
  const lastLine = lines[lines.length - 1];
  const closingLine = "今日は大きな異変はなさそうです。";
  if (lastLine === closingLine) {
    lines.push(appLinkPhrase, appUrl);
  } else {
    lines.push("", appLinkPhrase, appUrl);
  }

  return { message: lines.join("\n"), spotlightPhotoUrl };
}
