import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CareRule = {
  task_type:
    | "watering"
    | "observation"
    | "fertilizing"
    | "pruning"
    | "harvesting"
    | "other";
  interval_days: number;
  title: string;
  message: string;
  confidence: "low" | "medium" | "high";
};

export async function POST(req: Request) {
  try {
    const { plantId } = await req.json();

    if (!plantId) {
      return NextResponse.json({ error: "plantId is required" }, { status: 400 });
    }

    const { data: plant, error: plantError } = await supabase
      .from("plants")
      .select("*")
      .eq("id", plantId)
      .single();

    if (plantError || !plant) {
      return NextResponse.json(
        { error: "Plant not found", detail: plantError?.message ?? null },
        { status: 404 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `
あなたは家庭菜園・ベランダ栽培向けの植物ケアアシスタントです。

以下の植物について、定期的なお世話ルールを作ってください。

植物情報:
${JSON.stringify(plant, null, 2)}

条件:
- 日本の一般家庭・ベランダ栽培を想定
- 初心者向け
- 通知アプリで使うため、短く実行しやすい内容にする
- 水やり、観察、追肥、剪定、収穫確認などから必要なものだけ作る
- task_type は watering / observation / fertilizing / pruning / harvesting / other のいずれか
- interval_days は 1以上の整数
- title は短く
- message はLINE通知にそのまま使える自然な日本語
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
                        "other",
                      ],
                    },
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

    const parsed = JSON.parse(response.output_text) as { rules: CareRule[] };

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

    const rows = parsed.rules.map((rule) => ({
      plant_id: plant.id,
      user_id: plant.user_id ?? null,
      plant_name: plantName,
      plant_type: plantType,
      task_type: rule.task_type,
      interval_days: rule.interval_days,
      title: rule.title,
      message: rule.message,
      source: "ai",
      confidence: rule.confidence,
      is_active: true,
    }));
// ① insertだけする
const { error: insertError } = await supabase
  .from("care_rules")
  .insert(rows);

if (insertError) {
  return NextResponse.json(
    {
      error: "Failed to insert care_rules",
      detail: insertError.message,
    },
    { status: 500 }
  );
}

// ② 直後に取得
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