import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `あなたは家庭菜園・観葉植物のやさしい相談相手です。
ユーザーからの植物相談に、日本語で短く実用的に答えてください。

【回答ルール】
・LINEで読みやすい長さにする
・長くても300文字以内
・断定しすぎない
・原因は2〜3個に絞る
・今日できる行動を具体的に書く
・農薬や薬剤は安易にすすめない
・写真がないと判断できない場合は、写真があるとより正確に見られると伝える
・医療・食中毒・毒性が関わる場合は、安全側に寄せる
・前のメッセージの文脈を踏まえて答える
・「それ」「さっきの」など代名詞は会話履歴から補完する
・植物の豆知識が自然に使えそうなら、1つだけ柔らかく触れてください。無理に入れなくて構いません。
・虫・病気・弱りなどの注意サインがある場合は、豆知識より注意喚起を優先してください。`;

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
        content: `【管理中の植物と今日の豆知識】\n${lines}`,
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

    const text = response.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return text;
  } catch (error) {
    console.error("AI plant chat error:", error);
    return null;
  }
}
