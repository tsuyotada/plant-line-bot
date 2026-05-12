import { createClient } from "@supabase/supabase-js";
import { buildDailyCareMessage, PlantWithRecency, CareRule } from "./dailyCareMessage";

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

export async function buildDailyNotificationMessage(householdId: string): Promise<{
  message: string;
  today: string;
  plantCount: number;
  spotlightPhotoUrl: string | null;
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = getTodayJst();

  const [
    { data: plantsRaw },
    { data: photosRaw },
    { data: careRulesRaw },
    { data: shareLinkData },
  ] = await Promise.all([
    supabase
      .from("plants")
      .select("*")
      .eq("household_id", householdId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("plant_photos")
      .select("plant_id, taken_at, image_url, storage_path")
      .order("taken_at", { ascending: false }),
    supabase
      .from("care_rules")
      .select("id, plant_id, task_type, task_detail, interval_days, title, message, confidence, is_active")
      .eq("is_active", true),
    supabase
      .from("household_share_links")
      .select("token")
      .eq("household_id", householdId)
      .eq("enabled", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const plants = plantsRaw ?? [];
  console.log(`[Daily] 通知対象植物数=${plants.length} care_rules=${careRulesRaw?.length ?? 0}`);

  if (plants.length === 0) {
    return {
      message: `【${today} のお世話メモ🌱】\n登録されている植物がありません🌿`,
      today,
      plantCount: 0,
      spotlightPhotoUrl: null,
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const latestPhotoMap = new Map<string, string>();
  const latestPhotoUrlMap = new Map<string, string>();
  const latestStoragePathMap = new Map<string, string>(); // plantId → storage_path (for signed URL generation)
  for (const photo of photosRaw ?? []) {
    if (!latestPhotoMap.has(photo.plant_id)) {
      latestPhotoMap.set(photo.plant_id, photo.taken_at);
      if (photo.storage_path) {
        latestStoragePathMap.set(photo.plant_id, photo.storage_path);
      }
      const url: string | null =
        photo.image_url ||
        (photo.storage_path
          ? `${supabaseUrl}/storage/v1/object/public/plant-photos/${photo.storage_path}`
          : null);
      if (url) latestPhotoUrlMap.set(photo.plant_id, url);
    }
  }

  // care_rules を plant_id でグループ化
  const careRulesMap = new Map<string, CareRule[]>();
  for (const rule of careRulesRaw ?? []) {
    if (!careRulesMap.has(rule.plant_id)) careRulesMap.set(rule.plant_id, []);
    careRulesMap.get(rule.plant_id)!.push(rule as CareRule);
  }

  const todayMs = new Date(today).getTime();
  const plantsWithRecency: PlantWithRecency[] = plants.map((p) => {
    const latestPhotoAt = latestPhotoMap.get(p.id) ?? null;
    let daysSinceLastPhoto: number | null = null;
    if (latestPhotoAt) {
      const photoDateMs = new Date(latestPhotoAt.slice(0, 10)).getTime();
      daysSinceLastPhoto = Math.floor((todayMs - photoDateMs) / (1000 * 60 * 60 * 24));
    }
    const displayName = getPlantLabel(p.plant_type);

    const fertilizerEnabled = p.fertilizer_enabled !== false;
    const fertilizerIntervalDays = (p.fertilizer_interval_days as number | null) ?? 14;
    const fertilizerBaseDate =
      (p.last_fertilized_at as string | null) ??
      (p.created_at as string | null) ??
      today;
    const daysSinceLastFertilized = Math.floor(
      (todayMs - new Date(String(fertilizerBaseDate).slice(0, 10)).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    console.log(
      `[Daily] plant_id=${p.id} name=${displayName}` +
      ` daysSinceLastPhoto=${daysSinceLastPhoto ?? "null"}` +
      ` daysSinceLastFertilized=${daysSinceLastFertilized} fertilizerEnabled=${fertilizerEnabled}` +
      ` careRules=${careRulesMap.get(p.id)?.length ?? 0}`
    );
    return {
      id: p.id,
      display_name: displayName,
      plant_type: p.plant_type ?? null,
      location: p.location ?? null,
      latestPhotoAt,
      latestPhotoUrl: latestPhotoUrlMap.get(p.id) ?? null,
      daysSinceLastPhoto,
      fertilizerEnabled,
      fertilizerIntervalDays,
      daysSinceLastFertilized,
    };
  });

  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://plant-line-bot-forme.vercel.app";
  const shareToken = (shareLinkData as { token: string } | null)?.token ?? null;
  const shareUrl = shareToken ? `${appBaseUrl}/share/${shareToken}` : null;

  const { message, spotlightPhotoUrl: rawSpotlightUrl } = buildDailyCareMessage(today, plantsWithRecency, careRulesMap, shareUrl);

  // Upgrade spotlight to a signed URL (1h validity) so LINE servers can fetch the image
  // regardless of whether the Supabase Storage bucket is public or private.
  let spotlightPhotoUrl: string | null = rawSpotlightUrl;
  if (rawSpotlightUrl) {
    const spotlightPlantId = [...latestPhotoUrlMap.entries()]
      .find(([, url]) => url === rawSpotlightUrl)?.[0];
    const storagePath = spotlightPlantId ? latestStoragePathMap.get(spotlightPlantId) : undefined;
    if (storagePath) {
      const { data: signedData, error: signError } = await supabase
        .storage
        .from("plant-photos")
        .createSignedUrl(storagePath, 3600);
      if (signError) {
        console.warn(`[Daily] spotlight署名付きURL生成失敗 storagePath=${storagePath}:`, signError.message);
      } else if (signedData?.signedUrl) {
        console.log(`[Daily] spotlight署名付きURL生成成功 storagePath=${storagePath}`);
        spotlightPhotoUrl = signedData.signedUrl;
      }
    } else {
      console.log(`[Daily] spotlight URL（image_url直接）: ${rawSpotlightUrl.slice(0, 100)}`);
    }
  }

  return { message, today, plantCount: plants.length, spotlightPhotoUrl };
}
