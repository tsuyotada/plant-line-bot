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

// care_rules are AI-generated routine maintenance schedules, not anomaly detections.
// Their descriptions routinely mention "害虫がいないか確認" etc., so keyword matching
// always produces false positives. ⚠️ is reserved for future photo-analysis anomalies.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function hasActualProblemSign(_rule: CareRule): boolean {
  return false;
}

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

  // Notable rule = only care rules containing detected-problem keywords (not routine reminders)
  const notableRule = rules
    .filter(r => r.is_active && r.confidence !== "low" && hasActualProblemSign(r))
    .sort((a, b) => {
      const cs: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (cs[a.confidence] ?? 1) - (cs[b.confidence] ?? 1);
    })[0] ?? null;

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

// Build the multi-line description for the 📸 spotlight section.
// Always uses observation-style text — never care instructions or TODO phrases.
function buildSpotlightDescription(c: ClassifiedPlant): string {
  const { plant } = c;
  const days = plant.daysSinceLastPhoto;
  const name = plant.display_name;
  if (days === null || days === 0) return `${name}の最新の様子です。`;
  if (days === 1) return `${name}の昨日の様子です。`;
  if (days <= 3) return `${name}の${days}日前の様子です。`;
  return `${name}はしばらく写真の記録がありません。`;
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
  shareUrl?: string | null,
): { message: string; messageBody: string; spotlightPhotoUrl: string | null; appLinkPhrase: string; appUrl: string } {
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
  const trivia = getPlantTrivia(triviaPlant?.plant_type ?? null, today, triviaPlant?.display_name ?? null);

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

    // 🌿 Routine care: merge bothItems into fert/water pools for threshold check
    const routineLines: string[] = [];
    const allFertPlants = [...bothItems, ...fertItems];
    const allWaterPlants = [...bothItems, ...waterItems];

    if (allFertPlants.length >= GROUPING_THRESHOLD) {
      // All fertilizer-needing plants (both water+fert and fert-only) grouped together
      routineLines.push(...buildGroupedLines("液体肥料のタイミング", allFertPlants));
      // Remaining water-only plants shown separately
      if (waterItems.length >= GROUPING_THRESHOLD) {
        routineLines.push(...buildGroupedLines("水やりのタイミング", waterItems));
      } else {
        waterItems.forEach(c => routineLines.push(`・${c.plant.display_name}：${c.summary}`));
      }
    } else if (allWaterPlants.length >= GROUPING_THRESHOLD) {
      // All water-needing plants grouped together (no large fert pool)
      routineLines.push(...buildGroupedLines("水やりのタイミング", allWaterPlants));
      // Remaining fert-only plants shown separately
      if (fertItems.length >= GROUPING_THRESHOLD) {
        routineLines.push(...buildGroupedLines("液体肥料のタイミング", fertItems));
      } else {
        fertItems.forEach(c => routineLines.push(`・${c.plant.display_name}：${c.summary}`));
      }
    } else {
      // All buckets below threshold — show individually
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
    }

    if (routineLines.length > 0) {
      if (notableItems.length > 0) lines.push(""); // separator between ⚠️ and 🌿
      lines.push("🌿 今日のケア");
      lines.push(...routineLines);
    }

  }

  // Trivia without spotlight: add after care section
  if (!spotlight && trivia) {
    lines.push("", `💡 ${trivia}`);
  }

  const messageBody = lines.join("\n");

  if (shareUrl) {
    lines.push("", appLinkPhrase, "家族の植物ページ：", shareUrl);
  } else {
    lines.push("", appLinkPhrase, appUrl);
  }

  return { message: lines.join("\n"), messageBody, spotlightPhotoUrl, appLinkPhrase, appUrl };
}
