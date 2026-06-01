import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

type CareRule = {
  task_type:
    | "watering"
    | "observation"
    | "fertilizing"
    | "pruning"
    | "harvesting"
    | "environment"
    | "soil"
    | "support"
    | "other";
  task_detail: string;
  interval_days: number;
  title: string;
  message: string;
  confidence: "low" | "medium" | "high";
};

export async function POST(req: Request) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { plantId } = await req.json();

    if (!plantId) {
      return NextResponse.json(
        { error: "plantId is required" },
        { status: 400 }
      );
    }

    const { data: plant, error: plantError } = await supabase
      .from("plants")
      .select("*")
      .eq("id", plantId)
      .single();

    if (plantError || !plant) {
      return NextResponse.json(
        {
          error: "Plant not found",
          detail: plantError?.message ?? null,
        },
        { status: 404 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `
あなたは植物ジャーナルの書き手です。
ユーザーが植物との観察を楽しめるよう、やさしい定期観察ルールを作ってください。

以下の植物について、定期的なお世話ルールを作ってください。

植物情報:
${JSON.stringify(plant, null, 2)}

条件:
- 日本の一般家庭・ベランダ栽培を想定
- 初心者向け
- task_type は watering / observation / fertilizing / pruning / harvesting / environment / soil / support / other のいずれか
- task_type は大分類として使う
- task_detail は必ず空文字にしない
- task_detail は title と同じでもよいが、できれば具体的な内容にする
- 例：
  task_type: watering
  task_detail: 土が乾いていたら水やり
  title: 水やり
- environment は 日照調整・風対策・温度対策・鉢の向き変更
- soil は 用土の表面ほぐし・増し土・植え替え・排水チェック
- support は 摘芯・人工授粉・間引き・支柱・誘引
- title は短く、画面の見出しに使える日本語
- message はLINE通知にそのまま使える自然な日本語
- interval_days は 1以上の整数

【messageの文体ルール】
messageフィールドは「植物ジャーナルの便り」として書く。
・命令形を使わない（「〜してください」「〜しましょう」「〜する必要があります」「必ず」「今すぐ」「確認してください」は使わない）
・「そろそろ〇〇の時期かもしれません」「〇〇も少し気にかけてみるとよさそうです」のような柔らかい表現を使う
・断定しすぎない、急かさない
・観察のきっかけとして届ける
例：
  NG: 「水やりをしてください」「肥料を与えてください」「葉の裏を確認してください」
  OK: 「そろそろ水やりの頃合いかもしれません。土の様子を少し見てみてもよさそうです」
  OK: 「液体肥料の時期が近づいているかもしれません」
  OK: 「葉の裏も、たまに眺めてみるとよさそうです」

【水やりルールの設定ガイドライン】
task_type: watering のルールを作る場合、植物タイプに応じて interval_days と title を調整すること。

・ハーブ・葉もの野菜・根菜類（ミント、バジル、パセリ、ローズマリー、九条ネギ、ルッコラ、しそ、ラディッシュ、カブ、ニンジン等）の場合：
  - 小さい鉢・浅いプランターでの栽培が多く、土量が少なく乾きやすい
  - interval_days は 1〜2 を目安にする（「毎日土の様子を見る」イメージ）
  - title は「水やり確認」「土の乾き確認」「水やりのめやす」など20字以内にする
  - message では「毎日水やり」とは書かず「土の表面が乾いていたら少し水を足してあげるとよさそうです」のような表現にする
  - NG: 「毎日水やりしてください」「水が不足しています」
  - OK: 「葉がしなっとしている日は水切れのサインかもしれません。表面が乾いていたら少し水を足してあげるとよさそうです」
  - OK: 「小さめの鉢は乾くのが早いので、今日も土の様子を少し眺めてみてもよさそうです」

・サボテン・多肉系の場合：
  - interval_days は 7〜21 を目安にする

・その他の一般植物（トマト・ナス等の果菜類、観葉植物等）の場合：
  - interval_days は 2〜4 を目安にする

【植物タイプ別の収穫表現ルール】
task_type: harvesting を使う場合、植物の種類に応じてtitleとmessageの表現を変えること。

・ハーブ・葉もの野菜（ミント、バジル、パセリ、ローズマリー、九条ネギ、ルッコラ、しそ、タイム、オレガノ等）の場合：
  - title は「摘み取り」「葉を使う」「葉摘みのタイミング」などにする（「収穫」は使わない）
  - message では「収穫」より「摘む」「使う」「少し摘んでもよさそうです」を優先する
  - NG: 「実を収穫しましょう」「収穫できます」「葉を収穫してください」
  - OK: 「葉が茂ってきたら、使う分だけ少し摘んでもよさそうです」
  - OK: 「伸びすぎているところがあれば、先端を少し摘むと風通しがよくなりそうです」
  - OK: 「そろそろ摘み取りどきを見てもよさそうです」

・実もの野菜（トマト、ナス、きゅうり、ピーマン、イチゴ等）の場合：
  - 「実」「収穫」の表現をそのまま使ってよい
  - OK: 「実が色づいてきたら、そろそろ収穫の頃合いかもしれません」

・根菜類（ラディッシュ、にんじん、大根、カブ等）の場合：
  - title は「収穫どきを確認」「根の育ちを見る」などにする
  - message では「株元のふくらみを見ながら、そろそろ抜きどきを確認してみてもよさそうです」などの表現を使う
`,
      text: {
        format: {
          type: "json_schema",
          name: "care_rules",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              rules: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    task_type: {
                      type: "string",
enum: [
  "watering",
  "observation",
  "fertilizing",
  "pruning",
  "harvesting",
  "environment",
  "soil",
  "support",
  "other",
],
                    },
                    task_detail: { type: "string" },
                    interval_days: {
                      type: "integer",
                      minimum: 1,
                    },
                    title: { type: "string" },
                    message: { type: "string" },
                    confidence: {
                      type: "string",
                      enum: ["low", "medium", "high"],
                    },
                  },
                  required: [
                    "task_type",
                    "task_detail",
                    "interval_days",
                    "title",
                    "message",
                    "confidence",
                  ],
                },
              },
            },
            required: ["rules"],
          },
        },
      },
    });

    console.log("AI text:", response.output_text);

const content = response.output_text;
console.log("AI raw content:", content);

if (!content) {
  return NextResponse.json(
    {
      error: "Failed to generate care rules",
      detail: "AI response was empty",
    },
    { status: 500 }
  );
}

const parsed = JSON.parse(content);

    const plantName =
      plant.name ??
      plant.plant_name ??
      plant.plant_type ??
      plant.nickname ??
      "unknown";

    const plantType =
      plant.type ??
      plant.plant_type ??
      plant.plant_name ??
      plant.name ??
      null;

const rows = parsed.rules.map((rule: CareRule) => ({
  plant_id: plant.id,
  user_id: plant.user_id ?? null,
  plant_name: plantName,
  plant_type: plantType,
  task_type: rule.task_type,
  task_detail:
  rule.task_detail?.trim() ||
  rule.title?.trim() ||
  "植物の状態を確認",
  interval_days: rule.interval_days,
  title: rule.title,
  message: rule.message,
  source: "ai",
  confidence: rule.confidence,
  is_active: true,
}));

    const { error: insertError } = await supabase
      .from("care_rules")
      .insert(rows);

    console.log("INSERT ERROR:", insertError);
    console.log("ROWS:", rows);

    if (insertError) {
      return NextResponse.json(
        {
          error: "Failed to insert care_rules",
          detail: insertError.message,
        },
        { status: 500 }
      );
    }

    const { data: insertedRules, error: selectRulesError } = await supabase
      .from("care_rules")
      .select("id, plant_id, task_type, interval_days")
      .eq("plant_id", plant.id)
      .order("created_at", { ascending: false })
      .limit(rows.length);

    if (selectRulesError || !insertedRules) {
      return NextResponse.json(
        {
          error: "Failed to select inserted care_rules",
          detail: selectRulesError?.message ?? "insertedRules is null",
        },
        { status: 500 }
      );
    }

    const eventsToInsert: {
      plant_id: string;
      rule_id: string;
      task_type: string;
      scheduled_for: string;
      status: string;
    }[] = [];

    const today = new Date();
    const daysToGenerate = 30;

    for (const rule of insertedRules) {
      for (let i = 0; i < daysToGenerate; i++) {
        if (i % rule.interval_days === 0) {
          const date = new Date(today);
          date.setDate(today.getDate() + i);

          eventsToInsert.push({
            plant_id: rule.plant_id,
            rule_id: rule.id,
            task_type: rule.task_type,
            scheduled_for: date.toISOString().split("T")[0],
            status: "pending",
          });
        }
      }
    }

    let insertedEventsCount = 0;

    if (eventsToInsert.length > 0) {
      const { error: eventsError } = await supabase
        .from("care_events")
        .insert(eventsToInsert);

      if (eventsError) {
        return NextResponse.json(
          {
            error: "Failed to insert care_events",
            detail: eventsError.message,
          },
          { status: 500 }
        );
      }

      insertedEventsCount = eventsToInsert.length;
    }

    return NextResponse.json({
      ok: true,
      plant,
      rules: insertedRules,
      eventsCount: insertedEventsCount,
    });
  } catch (error) {
    console.error("generate-care-rules error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate care rules",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}