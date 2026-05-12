import { supabaseServer as supabase } from "../src/lib/supabase-server";
import { getCarePriority, type CareRule } from "./dailyCareMessage";
import { buildPlantCareCards, type PlantAdviceInput, type PlantCareCard } from "./buildPlantCareAdvice";
import { getPlantTrivia } from "./plantTrivias";

export type PhotoHistoryItem = { id: string; url: string; takenAt: string };

export type SummaryStats = {
  waterCount: number;
  fertilizerCount: number;
  observationCount: number;
  photoCount: number;
  total: number;
};

export type HouseholdData = {
  plants: any[];
  archivedPlants: any[];
  today: string;
  latestPhotos: Record<string, string>;
  photoHistories: Record<string, PhotoHistoryItem[]>;
  plantHasTodayEventRecord: Record<string, boolean>;
  careCardMap: Record<string, { advice: string; tags: string[]; priority: string }>;
  plantCareCards: PlantCareCard[];
  spotlightCard: PlantCareCard | null;
  spotlightTrivia: string | null;
  summaryStats: SummaryStats;
  hasError: boolean;
};

export function todayStringJst(): string {
  // JST 4:00 AM で日付を切り替える（UTC+5h してから UTC 日付を取ると JST 4:00 AM = UTC 19:00 が境界になる）
  return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const plantLabelMap: Record<string, string> = {
  tomato: "トマト",
  coriander: "コリアンダー",
  makrut_lime: "コブミカン",
  mint: "ミント",
  everbearing_strawberry: "四季成りイチゴ",
  italian_parsley: "イタリアンパセリ",
  shiso: "大葉",
  perilla: "えごま",
};

export function getPlantLabel(plantType: string | null | undefined): string {
  if (!plantType) return "植物";
  return plantLabelMap[plantType] ?? plantType;
}

export async function fetchHouseholdData(householdId: string): Promise<HouseholdData> {
  const today = todayStringJst();

  const [
    { data: allPlantsRaw, error: plantsError },
    { data: photosRaw },
    { data: careRulesRaw },
  ] = await Promise.all([
    supabase
      .from("plants")
      .select("*")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false }),
    supabase
      .from("plant_photos")
      .select("id, plant_id, image_url, taken_at")
      .order("taken_at", { ascending: false })
      .limit(500),
    supabase
      .from("care_rules")
      .select("id, plant_id, task_type, task_detail, interval_days, title, message, confidence, is_active")
      .eq("is_active", true),
  ]);

  const allPlants = (allPlantsRaw ?? []).sort((a, b) => {
    const aOrd: number | null = a.sort_order ?? null;
    const bOrd: number | null = b.sort_order ?? null;
    if (aOrd !== null && bOrd !== null) return aOrd - bOrd;
    if (aOrd !== null) return -1;
    if (bOrd !== null) return 1;
    return 0;
  });
  const plants = allPlants.filter((p) => !p.archived_at);
  const archivedPlants = allPlants.filter((p) => !!p.archived_at);

  const photos = photosRaw ?? [];
  const latestPhotos: Record<string, string> = {};
  const photoHistories: Record<string, PhotoHistoryItem[]> = {};

  for (const photo of photos) {
    const url: string = photo.image_url ?? "";
    if (!url) continue;
    if (!latestPhotos[photo.plant_id]) latestPhotos[photo.plant_id] = url;
    if (!photoHistories[photo.plant_id]) photoHistories[photo.plant_id] = [];
    photoHistories[photo.plant_id].push({
      id: photo.id,
      url,
      takenAt: String(photo.taken_at ?? "").slice(0, 10),
    });
  }

  const todayMs = new Date(today).getTime();
  const plantHasTodayEventRecord = Object.fromEntries(
    plants.map((plant) => {
      const latestPhoto = photoHistories[plant.id]?.[0];
      const daysSince = latestPhoto
        ? Math.floor((todayMs - new Date(latestPhoto.takenAt).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const priority = getCarePriority(daysSince);
      return [plant.id, priority === "urgent" || priority === "attention"];
    })
  );

  const careRulesMap = new Map<string, CareRule[]>();
  for (const rule of careRulesRaw ?? []) {
    if (!careRulesMap.has(rule.plant_id)) careRulesMap.set(rule.plant_id, []);
    careRulesMap.get(rule.plant_id)!.push(rule as CareRule);
  }

  const plantAdviceInputs: PlantAdviceInput[] = plants.map((plant) => {
    const latestPhoto = photoHistories[plant.id]?.[0];
    const daysSinceLastPhoto = latestPhoto
      ? Math.floor((todayMs - new Date(latestPhoto.takenAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const fertilizerBaseDate =
      (plant.last_fertilized_at as string | null) ??
      (plant.created_at as string | null) ??
      today;
    const daysSinceLastFertilized = Math.floor(
      (todayMs - new Date(String(fertilizerBaseDate).slice(0, 10)).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return {
      id: plant.id,
      display_name: getPlantLabel(plant.plant_type),
      plantType: plant.plant_type ?? null,
      daysSinceLastPhoto,
      fertilizerEnabled: plant.fertilizer_enabled !== false,
      fertilizerIntervalDays: (plant.fertilizer_interval_days as number | null) ?? 14,
      daysSinceLastFertilized,
      latestPhotoUrl: latestPhotos[plant.id] ?? null,
    };
  });

  const plantCareCards = buildPlantCareCards(plantAdviceInputs, careRulesMap, today);

  const careCardMap = Object.fromEntries(
    plantCareCards.map((c) => [c.plantId, { advice: c.advice, tags: c.tags, priority: c.priority }])
  );

  const spotlightCard = (() => {
    const withPhoto = plantCareCards.filter((c) => !!c.latestPhotoUrl);
    if (withPhoto.length === 0) return null;
    const priorityPool = withPhoto.filter((c) => c.priority === "urgent" || c.priority === "attention");
    const pool = priorityPool.length > 0 ? priorityPool : withPhoto;
    const seed = today + ":spotlight";
    let h = 0;
    for (const ch of seed) h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0;
    return pool[Math.abs(h) % pool.length];
  })();

  const spotlightTrivia = spotlightCard
    ? getPlantTrivia(spotlightCard.plantType ?? null, today)
    : null;

  const summaryStats: SummaryStats = {
    waterCount: plantCareCards.filter((c) => c.tags.includes("水やり")).length,
    fertilizerCount: plantCareCards.filter((c) => c.tags.includes("液体肥料")).length,
    observationCount: plantCareCards.filter((c) =>
      c.tags.some((t) => t === "観察" || t === "環境確認")
    ).length,
    photoCount: plantCareCards.filter((c) => c.tags.includes("写真記録")).length,
    total: plantCareCards.length,
  };

  return {
    plants,
    archivedPlants,
    today,
    latestPhotos,
    photoHistories,
    plantHasTodayEventRecord,
    careCardMap,
    plantCareCards,
    spotlightCard,
    spotlightTrivia,
    summaryStats,
    hasError: !!plantsError,
  };
}
