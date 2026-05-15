import OpenAI from "openai";
import { softenText } from "./softenText";

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
              text: `あなたは植物ジャーナルの書き手です。
ユーザーが撮った植物の写真を見て、観察のきっかけをやさしく届けてください。

植物名：${plantName}
${stateText}

【トーン】
・命令・指示にしない。「植物から届く便り」のように書く
・「〜に見えます」「〜かもしれません」など推測表現を自然に使う
・気になる点がある場合も怖がらせすぎない。「少し気になる点があります」「早めに気にかけてみてもよさそうです」のように柔らかく
・最後の一言は提案として、「〜してみてもよさそうです」「〜の時期かもしれません」など命令形NG

【禁止表現】
「〜してください」「〜しましょう」「確認してください」「チェックしてください」「おすすめです（命令的な使い方）」

【制約】
・LINEで読みやすい形式
・200文字以内
・観察できることを箇条書きで2〜3点（・で始める）

【出力形式】
🌱 ${plantName}の様子を見ました

・〇〇に見えます
・〇〇かもしれません

〇〇してみてもよさそうです（命令形でなく、そっと添えるひとこと）

この形式でそのままLINEに送れる文章のみ出力してください。前置きや説明は不要です。`,
            },
          ],
        },
      ],
      max_tokens: 400,
      temperature: 0.6,
    });

    const raw = response.choices?.[0]?.message?.content?.trim() ?? null;
    return raw ? softenText(raw) : null;
  } catch (error) {
    console.error("AI photo advice error:", error);
    return null;
  }
}
