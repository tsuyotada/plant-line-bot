import { createClient } from "@supabase/supabase-js";
import { getTodayWeather } from "./dailyWeather";
import { buildDailyCareMessage, getCarePriority, PlantWithRecency } from "./dailyCareMessage";

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

function getPlantLabel(plantType: string | null | undefined): string {
  if (!plantType) return "植物";
  return plantLabelMap[plantType] ?? plantType;
}

function getTodayJst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
}

export async function buildDailyNotificationMessage(): Promise<{
  message: string;
  today: string;
  plantCount: number;
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = getTodayJst();

  const { data: plantsRaw } = await supabase
    .from("plants")
    .select("*")
    .is("archived_at", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const plants = plantsRaw ?? [];
  console.log(`[Daily] 通知対象植物数=${plants.length}`);

  if (plants.length === 0) {
    return {
      message: `【${today} のお世話メモ🌱】\n登録されている植物がありません🌿`,
      today,
      plantCount: 0,
    };
  }

  const { data: photosRaw } = await supabase
    .from("plant_photos")
    .select("plant_id, taken_at")
    .order("taken_at", { ascending: false });

  const latestPhotoMap = new Map<string, string>();
  for (const photo of photosRaw ?? []) {
    if (!latestPhotoMap.has(photo.plant_id)) {
      latestPhotoMap.set(photo.plant_id, photo.taken_at);
    }
  }

  const weather = await getTodayWeather(today);
  console.log(
    `[Daily] 天気: weather=${weather.weather} temp=${weather.temperatureC}°C` +
    ` willRain=${weather.willRain} humidity=${weather.humidity}%`
  );

  const todayMs = new Date(today).getTime();
  const plantsWithRecency: PlantWithRecency[] = plants.map((p) => {
    const latestPhotoAt = latestPhotoMap.get(p.id) ?? null;
    let daysSinceLastPhoto: number | null = null;
    if (latestPhotoAt) {
      const photoDateMs = new Date(latestPhotoAt.slice(0, 10)).getTime();
      daysSinceLastPhoto = Math.floor((todayMs - photoDateMs) / (1000 * 60 * 60 * 24));
    }
    const displayName = getPlantLabel(p.plant_type);
    const carePriority = getCarePriority(daysSinceLastPhoto);
    console.log(
      `[Daily] plant_id=${p.id} name=${displayName}` +
      ` daysSinceLastPhoto=${daysSinceLastPhoto ?? "null"} carePriority=${carePriority}`
    );
    return {
      id: p.id,
      display_name: displayName,
      location: p.location ?? null,
      latestPhotoAt,
      daysSinceLastPhoto,
    };
  });

  const message = buildDailyCareMessage(today, plantsWithRecency, weather);
  return { message, today, plantCount: plants.length };
}
