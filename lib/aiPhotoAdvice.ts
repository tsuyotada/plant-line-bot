import OpenAI from "openai";
import { softenText } from "./softenText";
import { classifyPlantGroup, type PlantGroup } from "./plantClassify";

export { classifyPlantGroup };

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 同じ植物の写真がこの枚数以上あれば比較モードで分析する
export const COMPARISON_MIN_PHOTOS = 2;
// 比較に使う過去写真の最大枚数
export const MAX_PAST_PHOTOS = 2;

export type PastPhotoContext = {
  imageUrl: string;
  takenAt: string;        // YYYY-MM-DD
  siteComment?: string | null;
};

export type PhotoAdviceResult = {
  lineMessage: string;
  siteComment: string;
  changeSummary: string | null;
  careAdvice: string | null;
  watchPoint: string | null;
  analysisVersion: 1 | 2;   // 1=単発, 2=比較
};

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

// タイプ別・乾きやすさ観察ポイント
const GROUP_DRYNESS_HINTS: Partial<Record<PlantGroup, string>> = {
  herb: `【乾きやすさの観察ポイント（ハーブ）】
写真から読み取れるものがあれば、観察のきっかけとして柔らかく添えてください：
・鉢が小さそう・浅そうに見える場合 → 「小さめの鉢なので、土が乾くのが少し早そうです」
・葉がしなびている・垂れているように見える場合 → 「葉がしなっとしているように見えます。水切れのサインかもしれません」
・土の表面が乾いて白っぽく見える場合 → 「表面が乾いて見えるので、夕方にもう一度土の様子を見てもよさそうです」
・写真から上記のいずれも読み取れない場合は省略する`,

  leafy: `【乾きやすさの観察ポイント（葉もの・ネギ類）】
写真から読み取れるものがあれば、観察のきっかけとして柔らかく添えてください：
・浅いプランター・小さい鉢に見える場合 → 「浅いプランターなら、暑い日は毎日土の様子を見てもよさそうです」
・葉先が乾いている・全体的に元気がなさそうな場合 → 「葉先が少し乾いているように見えます。水切れかもしれません」
・鉢に対して株が密集しているように見える場合 → 「鉢に対して株が茂っているので、乾きが早い時期かもしれません」
・写真から上記のいずれも読み取れない場合は省略する`,

  root_vegetable: `【乾きやすさの観察ポイント（根菜類）】
写真から読み取れるものがあれば、観察のきっかけとして柔らかく添えてください：
・葉がしなびている・垂れているように見える場合 → 「葉がしなっとしているように見えます。ラディッシュは水切れで葉がしなびやすいので、今日は土の乾き具合を見てもよさそうです」
・鉢が浅そう・密植されているように見える場合 → 「鉢に対して葉がよく茂っているので、水切れしやすい時期かもしれません」
・土の表面が乾いて見える場合 → 「表面が乾いているように見えます。少し水を足してあげるとよさそうです」
・写真から上記のいずれも読み取れない場合は省略する`,
};

// タイプ別・間引き／土寄せ／混み合いチェックポイント
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

// タイプ別・比較観察ポイント（comparison mode 用）
const GROUP_COMPARISON_HINTS: Record<PlantGroup, string> = {
  herb: "ハーブは：葉の量・密度・新芽の勢い、花穂の有無、茎の伸び、摘心が必要かどうかを特に見てください。",
  leafy: "葉もの・ネギ類は：葉の量・色・高さの変化、密集してきたかどうか、株元の変化を特に見てください。",
  root_vegetable: "根菜類は：葉の勢い、株元（根の肩）のふくらみ変化、密植かどうか、土の表面の様子を特に見てください。",
  fruit_tree: "果樹・実つき植物は：実や花・つぼみの変化、葉色の変化、枝の伸びを特に見てください。",
  flower: "花植物は：花・つぼみの増減、咲き終わりの有無、葉色の変化を特に見てください。",
  fruit_vegetable: "果菜は：花・実の数や大きさの変化、葉色、株の広がり、支柱が必要かどうかを特に見てください。",
  houseplant: "観葉植物は：葉色・ツヤ・張りの変化、新芽の有無、株のボリューム変化を特に見てください。",
  general: "全体的な勢い・葉の様子・土の状態の変化を見てください。",
};

function buildStateText(
  initialStateType?: string | null,
  initialStateNote?: string | null
): string {
  const lines: string[] = [];
  if (initialStateType) lines.push(`植えたときの状態：${initialStateType}`);
  if (initialStateNote) lines.push(`メモ：${initialStateNote}`);
  return lines.join("\n");
}

function daysBetween(dateA: string, dateB: string): number {
  return Math.round(
    (new Date(dateB).getTime() - new Date(dateA).getTime()) / (1000 * 60 * 60 * 24)
  );
}

// ─── 単発モード（過去写真なし or 1枚目）────────────────────────────
async function generateSinglePhotoAdvice(params: {
  imageUrl: string;
  plantName: string;
  group: PlantGroup;
  stateText: string;
}): Promise<PhotoAdviceResult | null> {
  const { imageUrl, plantName, group, stateText } = params;
  const observationHint = GROUP_OBSERVATION_HINTS[group];
  const thinningHint = GROUP_THINNING_HINTS[group];
  const drynessHint = GROUP_DRYNESS_HINTS[group] ?? "";

  const prompt = `あなたは植物ジャーナルの書き手です。
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
${thinningHint ? "\n" + thinningHint : ""}${drynessHint ? "\n" + drynessHint : ""}

【トーン】
・命令・指示にしない。「植物から届く便り」のように書く
・「〜に見えます」「〜かもしれません」など推測表現を自然に使う
・気になる点も「そろそろ〜かもしれません」「〜してみてもよさそうです」のように柔らかく
・最後の一言は提案として命令形NG

【禁止表現】
「〜してください」「〜しましょう」「確認してください」「チェックしてください」

【出力形式（JSON）】
以下のJSONのみ返してください。余分なテキストは一切不要です。
{
  "observation": "今回の写真から見えること（60〜80字）",
  "changeSummary": null,
  "encouragement": "育っている実感の一言（20〜30字）",
  "careAdvice": "今やるとよいこと（命令形でなく、30〜50字）",
  "watchPoint": "次に見るとよいポイント（20〜40字）",
  "lineMessage": "LINE用短文（絵文字を含む・3点箇条書き・最後に一言・200文字以内）",
  "siteComment": "Web用コメント（200〜250字、詳しめ）"
}

lineMessageの形式：
🌱 ${plantName}の様子を見ました

・〇〇に見えます
・〇〇かもしれません

〇〇してみてもよさそうです`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
            { type: "text", text: prompt },
          ],
        },
      ],
      max_tokens: 700,
      temperature: 0.65,
    });

    const raw = response.choices?.[0]?.message?.content?.trim() ?? null;
    if (!raw) return null;
    return parseAdviceJson(raw, 1);
  } catch (error) {
    console.error("[aiPhotoAdvice] single mode error:", error);
    return null;
  }
}

// ─── 比較モード（過去写真あり）────────────────────────────────────
async function generateComparisonAdvice(params: {
  imageUrl: string;
  plantName: string;
  group: PlantGroup;
  stateText: string;
  pastPhotos: PastPhotoContext[];
  today: string;
}): Promise<PhotoAdviceResult | null> {
  const { imageUrl, plantName, group, stateText, pastPhotos, today } = params;
  const observationHint = GROUP_OBSERVATION_HINTS[group];
  const comparisonHint = GROUP_COMPARISON_HINTS[group];
  const thinningHint = GROUP_THINNING_HINTS[group];

  // 過去写真のコンテキスト情報（テキスト）
  const pastContextLines = pastPhotos
    .map((p, i) => {
      const daysAgo = daysBetween(p.takenAt, today);
      const label = daysAgo === 0 ? "今日" : daysAgo === 1 ? "昨日" : `${daysAgo}日前`;
      const comment = p.siteComment ? `\n  前回のメモ：${p.siteComment}` : "";
      return `- 過去写真${i + 1}（${label}撮影）${comment}`;
    })
    .join("\n");

  const prompt = `あなたは植物ジャーナルの書き手です。
同じ植物の写真を時系列で比較して、変化を観察してください。

植物名：${plantName}
${stateText}

【写真の順番】
${pastContextLines}
- 今回の写真（本日撮影）← 最後の画像

${observationHint}
${comparisonHint}
${thinningHint ? "\n" + thinningHint : ""}

【変化の比較観点】
以下の変化を確認してください（写真から読み取れる範囲で）：
・葉の量・大きさ・色の変化
・新芽・花・実・つぼみの有無
・茎の伸び・株のボリューム変化
・土の乾き具合
・しおれ・黄変・徒長などの変化
・鉢サイズとのバランス

「前回から何が変わったように見えるか」を必ず書いてください。
変化がない場合も「大きな変化はまだ少ないですが、〜は安定しています」のように必ず記載してください。

例：
・「前回より葉が広がって見えます」
・「中心の新芽が少し目立ってきました」
・「株元が少し太ってきたように見えます」
・「大きな変化はまだ少ないですが、葉色は安定しています」

【トーン】
・命令・指示にしない
・「〜に見えます」「〜かもしれません」など推測表現を自然に使う
・育っている実感が伝わるように
・断定しすぎず、写真から分かる範囲で

【禁止表現】
「〜してください」「〜しましょう」「確認してください」「チェックしてください」

【出力形式（JSON）】
以下のJSONのみ返してください。余分なテキストは一切不要です。
{
  "observation": "今回の写真から見えること（50〜80字）",
  "changeSummary": "前回からの変化（必ず記載、40〜60字）",
  "encouragement": "育っている実感の一言（20〜30字）",
  "careAdvice": "今やるとよいこと（命令形でなく、30〜50字）",
  "watchPoint": "次に見るとよいポイント（20〜40字）",
  "lineMessage": "LINE用短文（3行・改行区切り・150文字以内・絵文字なし）",
  "siteComment": "Web用コメント（200〜250字、変化の観察を中心に）"
}

lineMessageの形式（3行・改行区切り）：
[変化・成長へのコメント]
[careAdviceを柔らかく1行で]
[watchPointを「次は〜」の形で]`;

  // コンテンツ配列：古い順に過去写真、最後に今回の写真
  const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    ...pastPhotos.map((p) => ({
      type: "image_url" as const,
      image_url: { url: p.imageUrl, detail: "low" as const },
    })),
    { type: "image_url" as const, image_url: { url: imageUrl, detail: "low" as const } },
    { type: "text" as const, text: prompt },
  ];

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: imageContent }],
      max_tokens: 700,
      temperature: 0.65,
    });

    const raw = response.choices?.[0]?.message?.content?.trim() ?? null;
    if (!raw) return null;
    return parseAdviceJson(raw, 2);
  } catch (error) {
    console.error("[aiPhotoAdvice] comparison mode error:", error);
    return null;
  }
}

// JSON パース + softenText 適用
function parseAdviceJson(raw: string, version: 1 | 2): PhotoAdviceResult | null {
  try {
    const parsed = JSON.parse(raw);
    const lineMessage = softenText(String(parsed.lineMessage ?? "").trim());
    const siteComment = softenText(String(parsed.siteComment ?? "").trim());
    if (!lineMessage && !siteComment) return null;

    return {
      lineMessage: lineMessage || siteComment,
      siteComment: siteComment || lineMessage,
      changeSummary: parsed.changeSummary ? softenText(String(parsed.changeSummary).trim()) : null,
      careAdvice:    parsed.careAdvice    ? softenText(String(parsed.careAdvice).trim())    : null,
      watchPoint:    parsed.watchPoint    ? softenText(String(parsed.watchPoint).trim())    : null,
      analysisVersion: version,
    };
  } catch {
    console.error("[aiPhotoAdvice] JSON parse error, raw:", raw.slice(0, 200));
    return null;
  }
}

// ─── 公開 API ─────────────────────────────────────────────────────

export async function generatePhotoAdvice(params: {
  imageUrl: string;
  plantName: string;
  plantType?: string | null;
  initialStateType?: string | null;
  initialStateNote?: string | null;
  pastPhotos?: PastPhotoContext[];
  today?: string;
}): Promise<PhotoAdviceResult | null> {
  const {
    imageUrl,
    plantName,
    plantType,
    initialStateType,
    initialStateNote,
    pastPhotos = [],
    today = new Date().toISOString().slice(0, 10),
  } = params;

  const group = classifyPlantGroup(plantType, plantName);
  const stateText = buildStateText(initialStateType, initialStateNote);

  if (pastPhotos.length >= COMPARISON_MIN_PHOTOS - 1 && pastPhotos.length > 0) {
    // 比較モード：過去写真が1枚以上ある場合
    const result = await generateComparisonAdvice({
      imageUrl,
      plantName,
      group,
      stateText,
      pastPhotos,
      today,
    });
    if (result) return result;
  }

  // 単発モード（fallback含む）
  return generateSinglePhotoAdvice({ imageUrl, plantName, group, stateText });
}

// 後方互換：旧コードが文字列として使うケースへの互換ラッパー
export async function generatePhotoAdviceLegacy(params: {
  imageUrl: string;
  plantName: string;
  plantType?: string | null;
  initialStateType?: string | null;
  initialStateNote?: string | null;
}): Promise<string | null> {
  const result = await generatePhotoAdvice(params);
  return result?.lineMessage ?? null;
}
