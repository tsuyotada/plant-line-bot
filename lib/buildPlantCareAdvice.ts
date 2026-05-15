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

// ── 植物カテゴリ判定（ケア閾値の調整に使用） ────────────────────────────────

type PlantCategory = "succulent" | "general";

function detectPlantCategory(plantType: string | null | undefined): PlantCategory {
  if (!plantType) return "general";
  const t = plantType.toLowerCase();
  const succulentKeywords = [
    "サボテン", "cactus", "多肉", "succulent",
    "アガベ", "agave", "アロエ", "aloe",
    "ハオルシア", "haworthia", "ガステリア", "gasteria",
    "コノフィツム", "リトープス", "echeveria", "エケベリア",
    "ユーフォルビア", "euphorbia",
  ];
  if (succulentKeywords.some((k) => t.includes(k))) return "succulent";
  return "general";
}

/** 植物タイプを考慮した水やり優先度。サボテン系は大幅に閾値を緩和 */
function getCarePriorityForType(
  days: number | null,
  category: PlantCategory,
): CarePriority {
  if (category === "succulent") {
    if (days === null || days >= 21) return "urgent";
    if (days <= 5) return "recent";
    if (days <= 12) return "normal";
    return "attention"; // 13-20日
  }
  return getCarePriority(days);
}

/** サボテン系はデフォルト14日インターバルの液体肥料を抑制 */
function shouldShowFertilizer(plant: PlantAdviceInput, category: PlantCategory): boolean {
  if (!plant.fertilizerEnabled) return false;
  // サボテン/多肉：AIが30日超のインターバルを設定した場合のみ表示
  if (category === "succulent" && plant.fertilizerIntervalDays < 30) return false;
  const daysPastInterval = plant.daysSinceLastFertilized - plant.fertilizerIntervalDays;
  return (
    daysPastInterval >= 0 &&
    daysPastInterval % plant.fertilizerIntervalDays < FERTILIZER_REMINDER_DAYS
  );
}

// 日付+plantId をシードにした決定論的選択（同じ日は同じ結果、翌日は変わる）
function datePick<T>(items: T[], seed: string): T {
  let h = 0;
  for (const c of seed) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return items[Math.abs(h) % items.length];
}

const WATER_URGENT_PHRASES = [
  "土が乾いてきている可能性があります。次の水やりの前に、土の様子を少し眺めてみると安心かもしれません。",
  "水切れのサインがないか、葉と土を少し気にかけてみてもよさそうです。",
  "そろそろ水やりの頃合いかもしれません。土の乾き具合を眺めてみてもよさそうです。",
];

const WATER_ATTENTION_PHRASES = [
  "そろそろ水やりの時期かもしれません。",
  "土の表面が乾いてきたら、水やりの頃合いかもしれません。",
  "水やりのタイミングが近づいているかもしれません。土の様子を少し眺めてみてもよさそうです。",
];

const FERTILIZER_PHRASES = [
  "そろそろ液体肥料の頃合いかもしれません。",
  "液体肥料の時期が来ているかもしれません。",
  "液体肥料もそろそろかもしれないので、少し気にかけてみてもよさそうです。",
];

const FALLBACK_PHRASES = [
  "今日は葉や土の様子を、ちらっと眺めてみてもよさそうです。",
  "葉の色や張りを、ざっと眺めてみるとよさそうです。",
  "茎の状態や新芽の様子も、ついでに気にかけてみてもよさそうです。",
  "今日は土の乾き具合を、少し眺めてみると安心かもしれません。",
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
    const category = detectPlantCategory(plant.plantType);
    const priority = getCarePriorityForType(plant.daysSinceLastPhoto, category);
    const needsWater = priority === "urgent" || priority === "attention";

    // 液体肥料: インターバル経過後 FERTILIZER_REMINDER_DAYS 日間のみ表示し、以後は次のサイクルまで非表示。
    // サボテン/多肉はデフォルト14日インターバルを無視し、AI生成ルール（30日超）があるときだけ表示。
    const needsFertilizer = shouldShowFertilizer(plant, category);

    const needsPhoto = (plant.daysSinceLastPhoto ?? 999) >= 3;

    // タグ（最大3件、観察は他に何もない場合のみ）
    const tags: CareTag[] = [];
    // 1. 具体的なアクション
    if (needsWater) tags.push("水やり");
    if (needsFertilizer) tags.push("液体肥料");
    // 2. 最も具体的なルールベースのタグ（収穫 > 剪定 > 環境確認）
    const specificRuleTagMap: Partial<Record<string, CareTag>> = {
      harvesting: "収穫",
      pruning: "剪定",
      environment: "環境確認",
    };
    const specificRuleRank: Record<string, number> = { harvesting: 1, pruning: 2, environment: 3 };
    const bestSpecificRule = rules
      .filter(r => r.is_active && r.task_type in specificRuleTagMap)
      .sort((a, b) => (specificRuleRank[a.task_type] ?? 9) - (specificRuleRank[b.task_type] ?? 9))[0] ?? null;
    if (bestSpecificRule && tags.length < 3) tags.push(specificRuleTagMap[bestSpecificRule.task_type]!);
    // 3. 写真記録：他に具体的なタグがない場合のみ
    if (needsPhoto && tags.length === 0) tags.push("写真記録");
    // 4. 観察：他に何もない最終手段のみ
    if (tags.length === 0 && rules.some(r => r.is_active && r.task_type === "observation")) tags.push("観察");

    // アドバイステキスト: care_rule.message → 水やり/肥料 → フォールバック の順
    const parts: string[] = [];
    const seed = `${today}:${plant.id}`;

    const rule = bestAdviceRule(rules);
    if (rule) parts.push(rule.message);

    if (needsWater && needsFertilizer) {
      parts.push("水やりと液体肥料の頃合いかもしれません。");
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
