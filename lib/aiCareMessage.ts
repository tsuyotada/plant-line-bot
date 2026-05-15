import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type CareEvent = {
  task_type: string;
};

type Plant = {
  id: string;
  name: string;
};

export async function generateCareMessage(params: {
  today: string;
  events: CareEvent[];
  plants: Plant[];
  weather?: {
    temperature: number | null;
    precipitation: number | null;
    description: string;
  } | null;
}): Promise<string | null> {
  const { today, events, plants, weather } = params;

  if (!events || events.length === 0) {
    return null;
  }

  try {
    // ▼ イベント内容を整理
    const tasks = events.map((e) => e.task_type).join(", ");
    const plantNames = plants.map((p) => p.name).join(", ");

    const prompt = `
あなたは植物ジャーナルの書き手です。
ユーザーに観察のきっかけをそっと届ける、やさしいひとことを書いてください。

【トーン】
・命令・指示・ToDoにしない
・「植物から届く便り」のように書く
・急かさない、評価しない、責めない
・「そろそろ〇〇の頃合いかもしれません」「〇〇も少し気にかけてみてもよさそうです」のような表現を使う

【禁止表現】
「〜してください」「〜しましょう」「〜する必要があります」「必ず」「今すぐ」「確認してください」「チェックしてください」「忘れずに」

【条件】
・日本語
・80〜120文字程度
・やさしいが過剰にかわいくしない
・絵文字は1つまで

【情報】
日付: ${today}
植物: ${plantNames}
作業の種類: ${tasks}
天気: ${weather?.description ?? "不明"}
気温: ${weather?.temperature ?? "不明"}℃
降水確率: ${weather?.precipitation ?? "不明"}%

【出力】
そのままLINEで送れる文章のみ
`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const text = response.choices?.[0]?.message?.content?.trim();

    if (!text) return null;

    return text;
  } catch (error) {
    console.error("AI message generation error:", error);
    return null;
  }
}