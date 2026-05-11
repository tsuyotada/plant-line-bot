import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface PlantIdentifyResult {
  matchedPlantId: string;
  matchedPlantName: string;
  confidence: number;
  reason: string;
  needsUserConfirmation: boolean;
}

// 一度に参考写真を渡す植物の上限（GPT-4oの画像処理負荷考慮）
const MAX_REFERENCE_PHOTOS = 6;

export async function identifyPlantFromPhoto(params: {
  imageUrl: string;
  plants: {
    id: string;
    name: string;
    species?: string | null;
    memo?: string | null;
    latestPhotoUrl?: string | null;
  }[];
}): Promise<PlantIdentifyResult | null> {
  const { imageUrl, plants } = params;

  // 参考写真がある植物を上限件数まで絞り込む
  const plantsWithPhoto = plants
    .filter((p) => p.latestPhotoUrl && !p.latestPhotoUrl.startsWith("data:"))
    .slice(0, MAX_REFERENCE_PHOTOS);

  const plantsWithPhotoIds = new Set(plantsWithPhoto.map((p) => p.id));

  const plantList = plants
    .map((p, i) => {
      const extras: string[] = [];
      if (p.species) extras.push(`品種: ${p.species}`);
      if (p.memo) extras.push(`メモ: ${p.memo}`);
      const tag = plantsWithPhotoIds.has(p.id) ? " [参考写真あり]" : "";
      return `${i + 1}. id="${p.id}" 名前="${p.name}"${extras.length ? ` (${extras.join(", ")})` : ""}${tag}`;
    })
    .join("\n");

  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" | "high" | "auto" } };

  const content: ContentPart[] = [];

  // 1. 判定対象の新しい写真
  content.push({ type: "text", text: "【判定対象：新しく撮影された写真】" });
  content.push({ type: "image_url", image_url: { url: imageUrl, detail: "low" } });

  // 2. 登録済み植物の参考写真（過去に登録された写真）
  if (plantsWithPhoto.length > 0) {
    content.push({
      type: "text",
      text: "\n【このユーザーが過去に登録した植物の参考写真】（視覚比較に使ってください）",
    });
    for (const plant of plantsWithPhoto) {
      content.push({
        type: "text",
        text: `▼ ${plant.name}${plant.species ? ` (${plant.species})` : ""}`,
      });
      content.push({
        type: "image_url",
        image_url: { url: plant.latestPhotoUrl!, detail: "low" },
      });
    }
  }

  // 3. 判定プロンプト
  const hasRefPhotos = plantsWithPhoto.length > 0;

  const promptText = `あなたは植物識別の専門家です。

${
  hasRefPhotos
    ? `【判定手順（参考写真がある場合）】
1. 「判定対象の新しい写真」と「各登録植物の参考写真」を、葉の形・色・テクスチャ・茎・花・全体の雰囲気で丁寧に比較してください
2. 参考写真と明確に似ている植物がある場合 → その植物を選び confidence を 0.65 以上にしてください
3. どの参考写真とも似ていない、または比較が難しい場合 → confidence を 0.5 未満にしてください
4. 全く判断できない場合 → confidence を 0.3 以下にしてください
5. 参考写真がある植物については、テキスト情報よりも視覚的な比較を優先してください`
    : `【判定手順】
1. 写真に写っている植物の特徴を観察してください（葉の形・色・茎・花・全体の様子）
2. 登録植物リストと照合し、最も近いものを選んでください
3. 判断が難しい場合は confidence を 0.5 未満にしてください
4. 全く判断できない場合は confidence を 0.3 以下にしてください`
}

【登録植物リスト】
${plantList}

【重要ルール】
- matchedPlantId は必ず上記リストのidの中から選んでください
- matchedPlantName は必ず上記リストの名前の中から選んでください
- リスト外の植物名・idは絶対に出力しないでください
- 「消去法」「よくわからないから」という理由だけで特定の植物を選ばないでください
- 花が写っている・明らかにハーブ系・シソ科の葉・広葉・葉物野菜など、根菜類と見た目が大きく異なる場合は、根菜類や球根類に当てはめないでください
- えごま・大葉・パセリ・コリアンダーなどのハーブ類は、見た目が全く異なる野菜と同一視しないでください
- カレンジュラ・マリーゴールドなどの花は、野菜類と同一視しないでください
- 確信がない場合は confidence を低く（0.5未満）設定してください。誤答よりも低 confidence の方が望ましいです

以下のJSON形式のみで返答してください（前置き・説明文不要）：
{
  "matchedPlantId": "リスト内のid",
  "matchedPlantName": "リスト内の植物名",
  "confidence": 0.0〜1.0,
  "reason": "判断理由（日本語で50文字以内、参考写真との比較結果があれば含める）",
  "needsUserConfirmation": true
}`;

  content.push({ type: "text", text: promptText });

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content,
        },
      ],
      max_tokens: 200,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const rawContent = response.choices?.[0]?.message?.content?.trim();
    if (!rawContent) return null;

    const parsed = JSON.parse(rawContent) as {
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

    const refPhotoCount = plantsWithPhoto.length;
    console.log(
      `[AI] identify完了 matched=${parsed.matchedPlantName} confidence=${parsed.confidence} refPhotos=${refPhotoCount}`
    );

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
