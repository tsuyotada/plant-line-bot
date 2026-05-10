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
 * care_rules → 水やり/液体肥料判定 → フォールバック の順で助言テキストを構築する。
 */
export function buildPlantCareCards(
  plants: PlantAdviceInput[],
  careRulesMap: Map<string, CareRule[]>,
): PlantCareCard[] {
  return plants.map(plant => {
    const rules = careRulesMap.get(plant.id) ?? [];
    const priority = getCarePriority(plant.daysSinceLastPhoto);
    const needsWater = priority === "urgent" || priority === "attention";
    const needsFertilizer =
      plant.fertilizerEnabled &&
      plant.daysSinceLastFertilized >= plant.fertilizerIntervalDays;
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

    const rule = bestAdviceRule(rules);
    if (rule) parts.push(rule.message);

    if (needsWater && needsFertilizer) {
      parts.push("水やりと液体肥料のタイミングです。");
    } else if (needsWater) {
      parts.push(
        priority === "urgent"
          ? "土が乾いている可能性があります。水やりを確認しましょう。"
          : "そろそろ水やりのタイミングかもしれません。"
      );
    } else if (needsFertilizer) {
      parts.push("液体肥料をあげるタイミングです。");
    }

    if (parts.length === 0) {
      parts.push("今日は観察中心で、葉や土の様子を軽く見てあげてください。");
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
