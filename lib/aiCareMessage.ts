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
}): Promise<string | null> {
  const { today, events, plants } = params;

  if (!events || events.length === 0) {
    return null;
  }

  try {
    // ▼ イベント内容を整理
    const tasks = events.map((e) => e.task_type).join(", ");
    const plantNames = plants.map((p) => p.name).join(", ");

    const prompt = `
あなたは植物ケアのやさしいアシスタントです。
LINEで送る短い通知メッセージを作ってください。

【条件】
・日本語
・80〜120文字程度
・やることを明確に
・やさしいが過剰にかわいくしない
・絵文字は1つまで

【情報】
日付: ${today}
植物: ${plantNames}
作業: ${tasks}

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