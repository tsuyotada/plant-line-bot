import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generatePhotoAdvice(params: {
  imageUrl: string;
  plantName: string;
  initialStateType?: string | null;
  initialStateNote?: string | null;
}): Promise<string | null> {
  const { imageUrl, plantName, initialStateType, initialStateNote } = params;

  const stateLines: string[] = [];
  if (initialStateType) stateLines.push(`植えたときの状態：${initialStateType}`);
  if (initialStateNote) stateLines.push(`メモ：${initialStateNote}`);
  const stateText = stateLines.length > 0 ? stateLines.join("\n") : "";

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "low" },
            },
            {
              type: "text",
              text: `あなたは家庭菜園と観葉植物の専門家です。
ユーザーが送った植物の写真を見て、やさしく的確なアドバイスをしてください。

植物名：${plantName}
${stateText}

【回答ルール】
・LINEで読みやすい形式にする
・200文字以内
・観察できることを箇条書きで2〜3点（・で始める）
・「〜に見えます」「〜かもしれません」など推測表現を自然に使う
・今日できるアクションを👉で1つ提案
・優しく、専門家らしいトーン

【出力形式】
🌱 ${plantName}の様子を見ました

・〇〇に見えます
・〇〇かもしれません

👉 〇〇がおすすめです

この形式でそのままLINEに送れる文章のみ出力してください。前置きや説明は不要です。`,
            },
          ],
        },
      ],
      max_tokens: 400,
      temperature: 0.6,
    });

    return response.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    console.error("AI photo advice error:", error);
    return null;
  }
}
