import OpenAI from "openai";
import { softenText } from "./softenText";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `あなたは家庭菜園・観葉植物のやさしい相談相手です。
植物を「管理」するのではなく、ユーザーが植物との関係を続けやすくなるよう、
観察のきっかけをそっと届ける存在として振る舞います。

【回答ルール】
・LINEで読みやすい長さにする
・長くても300文字以内
・断定しすぎない
・原因は2〜3個に絞る
・命令・指示にしない。観察のきっかけとして柔らかく伝える
  例：「〜してみてもよさそうです」「〜の時期かもしれません」「少し気にかけてみると安心かもしれません」
・農薬や薬剤は安易にすすめない
・写真がないと判断できない場合は、写真があるとより正確に見られると伝える
・医療・食中毒・毒性が関わる場合は、安全側に寄せる
・前のメッセージの文脈を踏まえて答える
・「それ」「さっきの」など代名詞は会話履歴から補完する
・植物の豆知識が自然に使えそうなら、1つだけ柔らかく触れてください。無理に入れなくて構いません。
・虫・病気・弱りなどが気になる場合は、豆知識より先に気になる点を柔らかく伝える。
  怖がらせすぎず「少し気になるところがあります」「早めに気にかけてみると安心かもしれません」のように。
・植物の種類を考慮すること：ネギ・ハーブ・葉もの・観葉植物には「実がつく」「実の様子」など果実前提の表現は使わない。葉の色・株元・香り・新芽などに注目する。

【禁止表現】
「〜してください」「〜しましょう」「〜する必要があります」「必ず」「今すぐ」
「確認してください」「チェックしてください」「警告」「診断結果」`;

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type PlantContext = {
  name: string;
  plantType: string | null;
  trivia: string | null;
  species?: string | null;
};

export async function generatePlantChatReply(params: {
  userMessage: string;
  conversationHistory?: ConversationMessage[];
  plantContext?: PlantContext[];
}): Promise<string | null> {
  const { userMessage, conversationHistory = [], plantContext } = params;

  if (!userMessage.trim()) return null;

  // Limit history to last 20 messages to keep context manageable
  const recentHistory = conversationHistory.slice(-20);

  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (plantContext && plantContext.length > 0) {
      const lines = plantContext
        .map((p) => {
          let line = `- ${p.name}`;
          if (p.species) line += `（${p.species}）`;
          if (p.trivia) line += `：${p.trivia}`;
          return line;
        })
        .join("\n");
      messages.push({
        role: "system",
        content: `【見守り中の植物と今日の豆知識】\n${lines}`,
      });
    }

    messages.push(
      ...recentHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: userMessage },
    );

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.6,
    });

    const raw = response.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    return softenText(raw);
  } catch (error) {
    console.error("AI plant chat error:", error);
    return null;
  }
}
