import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type PlantTodayTask = {
  plant_id: string;
  plant_name: string;
  growth_stage: string;
  tasks: string[];
};

export async function buildTodayTasksForPlants(
  plants: Array<{
    id: string;
    display_name: string;
    species?: string | null;
    started_at?: string | null;
    planted_at?: string | null;
    memo?: string | null;
    location?: string | null;
  }>,
  today: string
): Promise<PlantTodayTask[]> {
  if (plants.length === 0) return [];

  const plantLines = plants
    .map((p) => {
      const startDate = p.started_at ?? p.planted_at ?? null;
      const days =
        startDate != null
          ? Math.max(
              0,
              Math.floor(
                (new Date(today).getTime() - new Date(startDate).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            )
          : null;
      const parts = [
        `plant_id="${p.id}"`,
        p.display_name,
        p.species ? `品種:${p.species}` : null,
        days != null ? `育成開始から${days}日` : "育成日数不明",
        p.location ? `置き場所:${p.location}` : null,
        p.memo ? `メモ:${p.memo}` : null,
      ].filter(Boolean);
      return `- ${parts.join(" ")}`;
    })
    .join("\n");

  const prompt = `あなたは家庭菜園と観葉植物の専門家です。
以下の植物リストを見て、それぞれに「今日やるべきこと」を生成してください。

今日の日付: ${today}

植物リスト:
${plantLines}

【絶対守るルール】
・今日できること・今日必要なことのみ出す
・将来の作業（葉が育ったら収穫、2週間ごとに肥料、支柱を立てる、混み合ったら間引くなど）は絶対に出さない
・育成日数から現在の成長ステージを推定する
  0〜7日: 種まき直後・発芽前
  8〜20日: 発芽〜双葉
  21〜45日: 本葉が出始め
  46日〜: 苗が育っている
・タスクは1植物につき最大2件
・判定に自信がなければ「今日は観察中心で様子を見る」などの安全な内容にする

【出力形式】JSONのみ・前置き不要:
{"plants":[{"plant_id":"ID","growth_stage":"成長ステージ名","tasks":["今日やること"]}]}
全植物をJSONに含めること。タスクなしの場合はtasks:[]`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 800,
      temperature: 0.3,
    });

    const text = response.choices?.[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(text) as {
      plants?: Array<{
        plant_id: string;
        growth_stage: string;
        tasks: string[];
      }>;
    };
    const items = parsed.plants ?? [];
    const nameMap = new Map(plants.map((p) => [p.id, p.display_name]));

    return items
      .filter((item) => item.tasks && item.tasks.length > 0)
      .map((item) => ({
        plant_id: item.plant_id,
        plant_name: nameMap.get(item.plant_id) ?? "植物",
        growth_stage: item.growth_stage ?? "",
        tasks: item.tasks.slice(0, 2),
      }));
  } catch (err) {
    console.error("buildTodayTasksForPlants error:", err);
    return [];
  }
}

export function buildTodayLineMessage(
  today: string,
  plantTasks: PlantTodayTask[]
): string {
  if (plantTasks.length === 0) {
    return `【${today} のお世話メモ🌱】\n今日はゆっくり見守る日です🌿`;
  }

  const lines = plantTasks
    .slice(0, 5)
    .flatMap((pt) => pt.tasks.map((task) => `🌿 ${pt.plant_name}：${task}`));

  return `【${today} の今日やること🌱】\n\n${lines.join("\n\n")}\n\n無理ない範囲で進めましょう🌿`;
}
