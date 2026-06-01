import OpenAI from "openai";
import { softenText } from "./softenText";
import { classifyPlantGroup, type PlantGroup } from "./plantClassify";

export { classifyPlantGroup };

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// タイプ別・基本観察ポイント
const GROUP_OBSERVATION_HINTS: Record<PlantGroup, string> = {
  herb:
    "【観察ポイント（ハーブ）】葉の色ツヤ、新芽の勢い、茎の混み合いと風通し、花穂が出ていないか。「実」「果実」の表現は使わないこと。",
  leafy:
    "【観察ポイント（葉もの・ネギ類）】葉の色や張り、葉先の乾き、伸び方の勢い、株元の様子、土の乾き、混み合い。「実」「果実」の表現は使わないこと。",
  root_vegetable:
    "【観察ポイント（根菜類）】葉の勢い・密集具合、株元のふくらみ、土の乾き。「実」「果実」の表現は使わないこと。収穫の話は株元が確認できるほど育ってから。",
  fruit_tree:
    "【観察ポイント（果樹・実つき植物）】花や実の様子、葉色、枝の勢い、病害虫の様子。",
  flower:
    "【観察ポイント（花植物）】花・つぼみの様子、葉色、咲き終わった花（花がら）、風通し。",
  fruit_vegetable:
    "【観察ポイント（果菜）】花・実の様子、葉色、水切れのサイン、肥料切れのサイン、病害虫の様子。",
  houseplant:
    "【観察ポイント（観葉植物）】葉色・葉の張り、新芽の有無、土の乾き、置き場所の明るさ。「実」「果実」の表現は基本的に使わないこと。",
  general:
    "【観察ポイント】葉の色・土の乾き・全体的な勢いを中心に観察してください。",
};

// タイプ別・間引き／土寄せ／混み合いチェックポイント（早期段階では使用しない）
const GROUP_THINNING_HINTS: Record<PlantGroup, string> = {
  root_vegetable: `【間引き・土寄せのチェックポイント（根菜類）】
写真を見て、当てはまる場合は助言に含めてください：
・芽や株が密集している（隣の芽と接触、または数cm以内に複数の芽が重なっている）
  → 「少し混み合ってきたら、元気そうな芽を残して間隔をあけてみてもよさそうです」
  → 「混み合ったところだけ少し減らすと育ちやすくなりそうです」
  ※ラディッシュは最終株間の目安が約3〜5cm、カブ・ニンジンは5〜10cm程度
・本葉が出て間引きが必要そうで、株元が細くふらつきそうな場合
  → 間引きとセットで「間引いたあと、株元に軽く土を寄せてあげると安定しやすくなりそうです」
・密集していない・状態がよい場合は、間引き・土寄せには触れなくてよい`,

  leafy: `【混み合いチェックポイント（葉もの・ネギ類）】
・葉や株が密集して風通しが悪そうな場合
  → 「少し混み合ってきたら、間引いて風通しをよくするとよさそうです」
・茎が細くひょろっと伸びている（徒長気味）に見える場合も触れてよい
・ネギ類の場合のみ、株元への軽い土寄せに触れてよい（葉もの全般には不要）`,

  herb: `【混み合いチェックポイント（ハーブ）】
・葉や茎が密集して風通しが悪そうな場合
  → 「少し込み合ってきたら、収穫を兼ねて間引いてみてもよさそうです」
・花穂が出ていたら、摘み取りの時期を柔らかく提案する`,

  fruit_vegetable: "",
  fruit_tree: "",
  flower: "",
  houseplant: "",
  general: "",
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
  const thinningHint = GROUP_THINNING_HINTS[group];

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

【写真から成長段階を判断する】
まず写真を見て、現在の成長段階をひとつ判断してください：
「発芽前」「発芽直後（双葉）」「小さな芽」「本葉が出始めた」「ある程度育っている」「収穫が近そう」

【段階に応じた制御ルール】
・成長段階が「発芽前」「発芽直後」「小さな芽」のとき：
  - 収穫・食べごろ・収穫時期・収穫できます などの表現は絶対に使わないこと
  - 間引き・土寄せへの言及も避けること（まだ株元が確認できない段階）
・成長段階が「本葉が出始めた」以降で株が密集して見える場合：
  - 後述のチェックポイントも参照して助言に含めること
${thinningHint ? "\n" + thinningHint : ""}

【トーン】
・命令・指示にしない。「植物から届く便り」のように書く
・「〜に見えます」「〜かもしれません」など推測表現を自然に使う
・気になる点も「そろそろ〜かもしれません」「〜してみてもよさそうです」のように柔らかく
・最後の一言は提案として命令形NG

【禁止表現】
「〜してください」「〜しましょう」「確認してください」「チェックしてください」

【制約】
・LINEで読みやすい形式
・250文字以内
・観察ポイントを箇条書きで2〜3点（・で始める）
・写真から見える範囲での提案に絞る

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
      max_tokens: 500,
      temperature: 0.6,
    });

    const raw = response.choices?.[0]?.message?.content?.trim() ?? null;
    return raw ? softenText(raw) : null;
  } catch (error) {
    console.error("AI photo advice error:", error);
    return null;
  }
}
