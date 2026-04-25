import { generateCareMessage } from "@/lib/aiCareMessage";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getTodayJst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
  }).format(new Date());
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

  const { data: plantMasters, error: plantMasterError } = await supabase
    .from("plants_master")
    .select("plant_code, plant_name")
    .eq("enabled", true);

  if (plantMasterError) {
    return NextResponse.json(
      { ok: false, error: plantMasterError.message },
      { status: 500 }
    );
  }

  const plantLabelMap = new Map(
    (plantMasters ?? []).map((plant) => [plant.plant_code, plant.plant_name])
  );

  const { data: adviceMessages, error: adviceError } = await supabase
    .from("advice_messages")
    .select("event_code, title, message");

  if (adviceError) {
    return NextResponse.json(
      { ok: false, error: adviceError.message },
      { status: 500 }
    );
  }

  const adviceMap = new Map(
    (adviceMessages ?? []).map((advice) => [
      advice.event_code,
      {
        title: advice.title,
        message: advice.message,
      },
    ])
  );

  const { data: events, error: eventsError } = await supabase
    .from("care_events")
    .select("id, scheduled_for, status, task_type, plants(plant_type)")
    .eq("scheduled_for", today)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (eventsError) {
    return NextResponse.json(
      { ok: false, error: eventsError.message },
      { status: 500 }
    );
  }

  const lines =
    events && events.length > 0
      ? events.map((event: any, index: number) => {
          const plantType = event.plants?.plant_type ?? "";
          const plantName = plantLabelMap.get(plantType) ?? "植物";
          const advice = adviceMap.get(event.task_type) ?? {
            title: "お世話",
            message: "植物の様子を確認しましょう",
          };

          return `${index + 1}. ${plantName}：${advice.title}\n${advice.message}`;
        })
      : [];

      const aiMessage =
  events && events.length > 0
    ? await generateCareMessage({
        today,
        events: events.map((event: any) => ({
          task_type: event.task_type,
        })),
        plants: events.map((event: any) => {
          const plantType = event.plants?.plant_type ?? "";
          const plantName = plantLabelMap.get(plantType) ?? "植物";

          return {
            id: event.id,
            name: plantName,
          };
        }),
      })
    : null;

const fallbackMessage =
  lines.length > 0
    ? `【${today} の今日やること🌱】\n\n${lines.join(
        "\n\n"
      )}\n\n無理ない範囲で進めましょう🌿`
    : `【${today} のお世話メモ🌱】\n今日はお世話の予定はありません🌿`;

const message = aiMessage ?? fallbackMessage;
  


  const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lineToken}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [
        {
          type: "text",
          text: message,
        },
      ],
    }),
  });

  if (!lineRes.ok) {
    const errorText = await lineRes.text();
    return NextResponse.json(
      { ok: false, error: errorText },
      { status: lineRes.status }
    );
  }

  return NextResponse.json({
    ok: true,
    today,
    count: events?.length ?? 0,
  });
}