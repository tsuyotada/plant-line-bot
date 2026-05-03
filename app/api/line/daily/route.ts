import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getTodayWeather } from "@/lib/dailyWeather";
import {
  buildDailyCareMessage,
  getCarePriority,
  PlantWithRecency,
} from "@/lib/dailyCareMessage";

function getTodayJst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
  }).format(new Date());
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

function getPlantLabel(plantType: string | null | undefined) {
  if (!plantType) return "植物";
  return plantLabelMap[plantType] ?? plantType;
}

export async function GET() {
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const lineUserId = process.env.LINE_USER_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!lineToken || !lineUserId || !supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { ok: false, error: "環境変数が不足しています" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const today = getTodayJst();

  // 1. アクティブな植物を取得
  const { data: plantsRaw, error: plantsError } = await supabase
    .from("plants")
    .select("*")
    .is("archived_at", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (plantsError) {
    return NextResponse.json({ ok: false, error: plantsError.message }, { status: 500 });
  }

  const plants = plantsRaw ?? [];
  console.log(`[Daily] 通知対象植物数=${plants.length}`);

  if (plants.length === 0) {
    const message = `【${today} のお世話メモ🌱】\n登録されている植物がありません🌿`;
    await sendLine(lineToken, lineUserId, message);
    return NextResponse.json({ ok: true, today, count: 0 });
  }

  // 2. plant_photos から各植物の最新写真日を取得
  //    taken_at が「前回観察日 ≒ 前回水やり推定日」として機能する
  const { data: photosRaw } = await supabase
    .from("plant_photos")
    .select("plant_id, taken_at")
    .order("taken_at", { ascending: false });

  // plant_id → 最新 taken_at のマップ（降順なので最初に出たものが最新）
  const latestPhotoMap = new Map<string, string>();
  for (const photo of photosRaw ?? []) {
    if (!latestPhotoMap.has(photo.plant_id)) {
      latestPhotoMap.set(photo.plant_id, photo.taken_at);
    }
  }

  // 3. 天気情報を取得
  const weather = await getTodayWeather(today);
  console.log(
    `[Daily] 天気: weather=${weather.weather} temp=${weather.temperatureC}°C` +
    ` willRain=${weather.willRain} humidity=${weather.humidity}%`
  );

  // 4. 植物ごとの写真記録情報を計算
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
      ` latestPhotoAt=${latestPhotoAt?.slice(0, 10) ?? "なし"}` +
      ` estimatedLastWateredAt=${latestPhotoAt?.slice(0, 10) ?? "不明"}` +
      ` daysSinceLastPhoto=${daysSinceLastPhoto ?? "null"}` +
      ` carePriority=${carePriority}`
    );

    return {
      id: p.id,
      display_name: displayName,
      location: p.location ?? null,
      latestPhotoAt,
      daysSinceLastPhoto,
    };
  });

  // 5. 日替わりメッセージを生成
  const message = buildDailyCareMessage(today, plantsWithRecency, weather);
  console.log(`[Daily] 生成メッセージ:\n${message}`);

  // 6. LINE送信
  const res = await sendLine(lineToken, lineUserId, message);
  if (!res.ok) {
    const errorText = await res.text();
    return NextResponse.json({ ok: false, error: errorText }, { status: res.status });
  }

  return NextResponse.json({ ok: true, today, count: plants.length });
}

async function sendLine(token: string, userId: string, message: string) {
  return fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text: message }],
    }),
  });
}
