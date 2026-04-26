import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { buildTodayTasksForPlants, buildTodayLineMessage } from "@/lib/plantGrowthAdvisor";

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

  // Active plants only
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

  if (plants.length === 0) {
    const message = `【${today} のお世話メモ🌱】\n登録されている植物がありません🌿`;
    await sendLine(lineToken, lineUserId, message);
    return NextResponse.json({ ok: true, today, count: 0 });
  }

  // Build advisor input with display names
  const plantsForAdvisor = plants.map((p) => ({
    id: p.id,
    display_name: getPlantLabel(p.plant_type),
    species: p.species ?? null,
    started_at: p.started_at ?? null,
    planted_at: p.planted_at ?? null,
    memo: p.memo ?? null,
    location: p.location ?? null,
  }));

  let todayTasks: Awaited<ReturnType<typeof buildTodayTasksForPlants>> = [];
  try {
    todayTasks = await buildTodayTasksForPlants(plantsForAdvisor, today);
  } catch (err) {
    console.error("LINE daily: AI task generation failed:", err);
  }

  const message = buildTodayLineMessage(today, todayTasks);

  const res = await sendLine(lineToken, lineUserId, message);
  if (!res.ok) {
    const errorText = await res.text();
    return NextResponse.json({ ok: false, error: errorText }, { status: res.status });
  }

  return NextResponse.json({
    ok: true,
    today,
    count: todayTasks.length,
  });
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
