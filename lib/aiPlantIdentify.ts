import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface PlantIdentifyResult {
  matchedPlantId: string;
  matchedPlantName: string;
  confidence: number;
  reason: string;
  needsUserConfirmation: boolean;
}

export async function identifyPlantFromPhoto(params: {
  imageUrl: string;
  plants: { id: string; name: string; species?: string | null; memo?: string | null }[];
}): Promise<PlantIdentifyResult | null> {
  const { imageUrl, plants } = params;

  const plantList = plants
    .map((p, i) => {
      const extras: string[] = [];
      if (p.species) extras.push(`品種: ${p.species}`);
      if (p.memo) extras.push(`メモ: ${p.memo}`);
      return `${i + 1}. id="${p.id}" 名前="${p.name}"${extras.length ? ` (${extras.join(", ")})` : ""}`;
    })
    .join("\n");

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
              text: `以下は登録済みの植物リストです。この写真に写っている植物がどれに最も近いか判定してください。

登録植物リスト：
${plantList}

【重要ルール】
- matchedPlantId は必ず上記リストのidの中から選んでください
- matchedPlantName は必ず上記リストの名前の中から選んでください
- リスト外の植物名・idは出力しないでください
- 判断が難しいときや確信が持てないときは confidence を 0.5 未満にしてください
- needsUserConfirmation は常に true にしてください

以下の JSON 形式のみで返答してください（前置き・説明文不要）：
{
  "matchedPlantId": "リスト内のid",
  "matchedPlantName": "リスト内の植物名",
  "confidence": 0.0〜1.0,
  "reason": "判断理由（日本語で30文字以内）",
  "needsUserConfirmation": true
}`,
            },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = JSON.parse(content) as {
      matchedPlantId?: string;
      matchedPlantName?: string;
      confidence?: number;
      reason?: string;
      needsUserConfirmation?: boolean;
    };

    if (!parsed.matchedPlantId || !parsed.matchedPlantName) return null;

    // ハルシネーション対策: 登録リスト外のIDは破棄
    const validIds = new Set(plants.map((p) => p.id));
    if (!validIds.has(parsed.matchedPlantId)) {
      console.error(`[AI] 識別結果のplant_idが登録リストにない: ${parsed.matchedPlantId}`);
      return null;
    }

    return {
      matchedPlantId: parsed.matchedPlantId,
      matchedPlantName: parsed.matchedPlantName,
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0))),
      reason: String(parsed.reason ?? ""),
      needsUserConfirmation: true,
    };
  } catch (error) {
    console.error("[AI] identifyPlantFromPhoto error:", error);
    return null;
  }
}
