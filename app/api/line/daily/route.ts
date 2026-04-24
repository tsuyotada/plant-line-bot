import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const plantLabelMap: Record<string, string> = {
  tomato: "トマト",
  coriander: "パクチー",
  makrut_lime: "コブミカン",
  mint: "ミント",
  everbearing_strawberry: "四季成りイチゴ",
  italian_parsley: "イタリアンパセリ",
  shiso: "大葉",
  perilla: "えごま",
};

const adviceMap: Record<string, { title: string; message: string }> = {
  citrus_water_check: {
    title: "水やりチェック",
    message: "土の乾き具合を見て、乾いていたらしっかり水やりしましょう",
  },
  citrus_leaf_check: {
    title: "葉の状態チェック",
    message: "葉色や害虫の有無を確認しましょう",
  },
  citrus_feed_check: {
    title: "肥料チェック",
    message: "生育期なので、薄めの追肥を検討しましょう",
  },
  mint_water_check: {
    title: "水やり",
    message: "土の表面が乾いていたら水をあげましょう",
  },
  mint_harvest_check: {
    title: "収穫チェック",
    message: "伸びた葉を少し摘んで、風通しよく保ちましょう",
  },
  mint_trim_check: {
    title: "切り戻しチェック",
    message: "混み合っていたら軽く切り戻しましょう",
  },
  strawberry_water_check: {
    title: "水やり",
    message: "乾きすぎに注意して水やりしましょう",
  },
  strawberry_flower_fruit_check: {
    title: "花と実のチェック",
    message: "花や実のつき具合、傷みや虫がないか確認しましょう",
  },
  strawberry_feed_check: {
    title: "追肥チェック",
    message: "開花・結実中なので、少量の追肥を検討しましょう",
  },
  establishment_check: {
    title: "活着チェック",
    message: "朝も葉がしおれていないか確認しましょう",
  },
  support_and_tying: {
    title: "支柱と誘引",
    message: "茎が倒れないよう軽く固定しましょう",
  },
  leaf_health_check: {
    title: "葉の状態チェック",
    message: "黄化・斑点・虫食いがないか見ましょう",
  },
  sucker_check: {
    title: "脇芽チェック",
    message: "小さいうちに取り除きましょう",
  },
  feed_check: {
    title: "追肥チェック",
    message: "実や生長の様子を見て調整しましょう",
  },
  parsley_water_check: {
    title: "水やり",
    message: "土が乾きすぎないよう確認しましょう",
  },
  parsley_harvest_check: {
    title: "収穫チェック",
    message: "外側の葉から少しずつ収穫しましょう",
  },
  parsley_leaf_check: {
    title: "葉の状態チェック",
    message: "葉色や虫食いがないか見ておきましょう",
  },
  coriander_germination_check: {
    title: "発芽チェック",
    message: "土が乾いていないか、芽が出てきていないか確認しましょう",
  },
  coriander_water_check: {
    title: "水やり",
    message: "種まき直後は乾燥しないよう、やさしく水を与えましょう",
  },
  coriander_thinning_check: {
    title: "間引きチェック",
    message: "混み合ってきたら元気な株を残して間引きを考えましょう",
  },
  coriander_harvest_check: {
    title: "収穫チェック",
    message: "育ってきたら外葉から収穫しましょう",
  },
  shiso_germination_check: {
    title: "発芽チェック",
    message: "土の表面が乾いていないか確認しましょう",
  },
  shiso_water_check: {
    title: "水やり",
    message: "乾燥しすぎないよう様子を見て水やりしましょう",
  },
  shiso_thinning_check: {
    title: "間引きチェック",
    message: "芽が混み合ってきたら間引いて育ちやすくしましょう",
  },
  shiso_harvest_check: {
    title: "収穫チェック",
    message: "葉が増えてきたらやわらかい葉から収穫しましょう",
  },
  perilla_germination_check: {
    title: "発芽チェック",
    message: "発芽の様子と土の乾き具合を確認しましょう",
  },
  perilla_water_check: {
    title: "水やり",
    message: "乾かしすぎないよう注意して水やりしましょう",
  },
  perilla_thinning_check: {
    title: "間引きチェック",
    message: "込み合ってきたら株間を確保するために間引きましょう",
  },
  perilla_harvest_check: {
    title: "収穫チェック",
    message: "葉が育ってきたら順に摘み取って使いましょう",
  },
};

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

  const { data: events, error } = await supabase
    .from("care_events")
    .select("id, scheduled_for, status, task_type, plants(plant_type)")
    .eq("scheduled_for", today)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  const lines =
    events && events.length > 0
      ? events.map((event: any, index: number) => {
          const plantType = event.plants?.plant_type ?? "";
          const plantName = plantLabelMap[plantType] ?? "植物";
          const advice = adviceMap[event.task_type] ?? {
            title: "お世話",
            message: "植物の様子を確認しましょう",
          };

          return `${index + 1}. ${plantName}：${advice.title}\n${advice.message}`;
        })
      : [];

  const message =
    lines.length > 0
      ? `【${today} の今日やること🌱】\n\n${lines.join(
          "\n\n"
        )}\n\n無理ない範囲で進めましょう🌿`
      : `【${today} のお世話メモ🌱】\n今日はお世話の予定はありません🌿`;

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