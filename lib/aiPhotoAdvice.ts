import OpenAI from "openai";
import { softenText } from "./softenText";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type PlantGroup =
  | "herb"
  | "leafy"
  | "root_vegetable"
  | "fruit_tree"
  | "flower"
  | "fruit_vegetable"
  | "houseplant"
  | "general";

export function classifyPlantGroup(
  plantType: string | null | undefined,
  plantName: string,
): PlantGroup {
  const s = `${plantType ?? ""} ${plantName}`.toLowerCase();

  if (/mint|ミント|basil|バジル|rosemary|ローズマリー|coriander|コリアンダー|パクチー|thyme|タイム|sage|セージ|oregano|オレガノ|shiso|大葉|青じそ|perilla|えごま|italian_parsley|パセリ/.test(s)) return "herb";
  if (/negi|ネギ|kujo_negi|green_onion|spinach|ほうれん草|ホウレンソウ|lettuce|レタス|komatsuna|小松菜/.test(s)) return "leafy";
  if (/radish|ラディッシュ|二十日大根|kohlrabi|コールラビ|carrot|ニンジン|turnip|カブ|beet|ビーツ/.test(s)) return "root_vegetable";
  if (/makrut_lime|コブミカン|fig|イチジク|strawberry|イチゴ|citrus|柑橘|lemon|レモン|blueberry|ブルーベリー/.test(s)) return "fruit_tree";
  if (/calendula|カレンジュラ|marigold|マリーゴールド|pansy|パンジー|viola|ビオラ|petunia|ペチュニア/.test(s)) return "flower";
  if (/tomato|トマト|pepper|ピーマン|eggplant|ナス|cucumber|キュウリ|zucchini|ズッキーニ|pumpkin|カボチャ|bean|インゲン|pea|エンドウ/.test(s)) return "fruit_vegetable";
  if (/観葉|houseplant|pothos|ポトス|monstera|モンステラ|ficus|フィカス|cactus|サボテン|succulent|多肉|aloe|アロエ/.test(s)) return "houseplant";

  return "general";
}

const GROUP_OBSERVATION_HINTS: Record<PlantGroup, string> = {
  herb:
    "【この植物はハーブです。観察ポイント】葉の色ツヤ、新芽の勢い、茎の混み合いと風通し、花穂が出ていないか。「実」「果実」の表現は使わないこと。",
  leafy:
    "【この植物は葉もの・ネギ類です。観察ポイント】葉の色や張り、葉先の乾き、伸び方の勢い、株元の様子、土の乾き、混み合い。「実」「果実」の表現は使わないこと。",
  root_vegetable:
    "【この植物は根菜類です。観察ポイント】葉の勢い、株元のふくらみ（収穫時期の近さ）、土の乾き具合。「実」「果実」の表現は使わないこと。",
  fruit_tree:
    "【この植物は果樹・実つき植物です。観察ポイント】花や実の様子、葉色、枝の勢い、病害虫の様子。",
  flower:
    "【この植物は花植物です。観察ポイント】花・つぼみの様子、葉色、咲き終わった花（花がら）、風通し。",
  fruit_vegetable:
    "【この植物は果菜です。観察ポイント】花・実の様子、葉色、水切れのサイン、肥料切れのサイン、病害虫の様子。",
  houseplant:
    "【この植物は観葉植物です。観察ポイント】葉色・葉の張り、新芽の有無、土の乾き、置き場所の明るさ。「実」「果実」の表現は基本的に使わないこと。",
  general:
    "【観察ポイント】葉の色・土の乾き・全体的な勢いを中心に観察してください。",
};

export async function generatePhotoAdvice(params: {
  imageUrl: string;
  plantName: string;
  plantType?: string | null;
  initialStateType?: string | null;
  initialStateNote?: string | null;
}): Promise<string | null> {
  const { imageUrl, plantName, plantType, initialStateType, initialStateNote } = params;

  const stateLines: string[] = [];
  if (initialStateType) stateLines.push(`植えたときの状態：${initialStateType}`);
  if (initialStateNote) stateLines.push(`メモ：${initialStateNote}`);
  const stateText = stateLines.length > 0 ? stateLines.join("\n") : "";

  const group = classifyPlantGroup(plantType, plantName);
  const observationHint = GROUP_OBSERVATION_HINTS[group];

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

${observationHint}

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
