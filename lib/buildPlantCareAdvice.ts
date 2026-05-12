import { getCarePriority, type CarePriority, type CareRule } from "./dailyCareMessage";

export type CareTag =
  | "水やり"
  | "液体肥料"
  | "観察"
  | "写真記録"
  | "剪定"
  | "収穫"
  | "環境確認";

export type PlantAdviceInput = {
  id: string;
  display_name: string;
  plantType?: string | null;
  daysSinceLastPhoto: number | null;
  fertilizerEnabled: boolean;
  fertilizerIntervalDays: number;
  daysSinceLastFertilized: number;
  latestPhotoUrl: string | null;
};

export type PlantCareCard = {
  plantId: string;
  plantName: string;
  plantType?: string | null;
  advice: string;
  tags: CareTag[];
  priority: CarePriority;
  latestPhotoUrl: string | null;
};

// 液体肥料リマインダーをインターバル経過後に表示し続ける日数
// 例: interval=14 → 14日目〜16日目に表示、17日目に消える。28日目にまた表示。
const FERTILIZER_REMINDER_DAYS = 3;

// 日付+plantId をシードにした決定論的選択（同じ日は同じ結果、翌日は変わる）
function datePick<T>(items: T[], seed: string): T {
  let h = 0;
  for (const c of seed) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return items[Math.abs(h) % items.length];
}

const WATER_URGENT_PHRASES = [
  "土が乾いている可能性があります。水やりを確認しましょう。",
  "水切れのサインがないか、葉と土を確認してください。",
  "そろそろ水やりの頃合いです。土の乾きを確認してみてください。",
];

const WATER_ATTENTION_PHRASES = [
  "そろそろ水やりのタイミングかもしれません。",
  "土の表面が乾いてきたら、水やりしてあげましょう。",
  "水やりのタイミングに近づいています。土を確認してみてください。",
];

const FERTILIZER_PHRASES = [
  "液体肥料をあげるタイミングです。",
  "そろそろ液体肥料の頃合いです。",
  "液体肥料を忘れずにあげてみてください。",
];

const FALLBACK_PHRASES = [
  "今日は葉や土の様子を軽く見てあげてください。",
  "葉の色や張りをざっと確認してみましょう。",
  "茎の状態や新芽の様子をチェックしてみてください。",
  "今日は土の乾き具合を確認してみてください。",
];

// タスク種別の優先順位: 観察・環境系を優先してアドバイスに反映
const TASK_TYPE_RANK: Record<string, number> = {
  observation: 1, environment: 2, soil: 3, support: 4,
  pruning: 5, harvesting: 6, other: 7, watering: 99, fertilizing: 99,
};

function bestAdviceRule(rules: CareRule[]): CareRule | null {
  return (
    rules
      .filter(r => r.is_active && r.task_type !== "watering" && r.task_type !== "fertilizing")
      .sort((a, b) => {
        const ra = TASK_TYPE_RANK[a.task_type] ?? 8;
        const rb = TASK_TYPE_RANK[b.task_type] ?? 8;
        if (ra !== rb) return ra - rb;
        const cs: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (cs[a.confidence] ?? 1) - (cs[b.confidence] ?? 1);
      })[0] ?? null
  );
}

/**
 * 植物ごとのケアアドバイスカードを生成する（APP表示用）。
 * today を渡すと、水やり文とフォールバック文が日付+plantId ベースで日替わりになる。
 */
export function buildPlantCareCards(
  plants: PlantAdviceInput[],
  careRulesMap: Map<string, CareRule[]>,
  today = "",
): PlantCareCard[] {
  return plants.map(plant => {
    const rules = careRulesMap.get(plant.id) ?? [];
    const priority = getCarePriority(plant.daysSinceLastPhoto);
    const needsWater = priority === "urgent" || priority === "attention";

    // 液体肥料: インターバル経過後 FERTILIZER_REMINDER_DAYS 日間のみ表示し、以後は次のサイクルまで非表示。
    // last_fertilized_at が記録されない場合も created_at 起点で周期的にリマインドする。
    const daysPastInterval = plant.daysSinceLastFertilized - plant.fertilizerIntervalDays;
    const needsFertilizer =
      plant.fertilizerEnabled &&
      daysPastInterval >= 0 &&
      daysPastInterval % plant.fertilizerIntervalDays < FERTILIZER_REMINDER_DAYS;

    const needsPhoto = (plant.daysSinceLastPhoto ?? 999) >= 3;

    // タグ（該当するケア項目を付与）
    const tags: CareTag[] = [];
    if (needsWater) tags.push("水やり");
    if (needsFertilizer) tags.push("液体肥料");
    if (rules.some(r => r.is_active && r.task_type === "observation")) tags.push("観察");
    if (needsPhoto) tags.push("写真記録");
    if (rules.some(r => r.is_active && r.task_type === "pruning")) tags.push("剪定");
    if (rules.some(r => r.is_active && r.task_type === "harvesting")) tags.push("収穫");
    if (rules.some(r => r.is_active && r.task_type === "environment")) tags.push("環境確認");

    // アドバイステキスト: care_rule.message → 水やり/肥料 → フォールバック の順
    const parts: string[] = [];
    const seed = `${today}:${plant.id}`;

    const rule = bestAdviceRule(rules);
    if (rule) parts.push(rule.message);

    if (needsWater && needsFertilizer) {
      parts.push("水やりと液体肥料のタイミングです。");
    } else if (needsWater) {
      const phrases = priority === "urgent" ? WATER_URGENT_PHRASES : WATER_ATTENTION_PHRASES;
      parts.push(datePick(phrases, seed + ":water"));
    } else if (needsFertilizer) {
      parts.push(datePick(FERTILIZER_PHRASES, seed + ":fert"));
    }

    if (parts.length === 0) {
      parts.push(datePick(FALLBACK_PHRASES, seed + ":fallback"));
    }

    return {
      plantId: plant.id,
      plantName: plant.display_name,
      plantType: plant.plantType ?? null,
      advice: parts.join(" "),
      tags,
      priority,
      latestPhotoUrl: plant.latestPhotoUrl,
    };
  });
}
