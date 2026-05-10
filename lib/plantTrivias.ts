/**
 * Plant trivia map: plant_type key → array of short trivia strings.
 * Keys are English identifiers used as canonical plant type names.
 *
 * Design for future DB migration:
 *   Table: plant_trivias (id, plant_type TEXT, trivia TEXT, sort_order INT)
 *   Query: supabase.from("plant_trivias").select("trivia").eq("plant_type", plantType)
 *   Then pass the resulting array to datePick() to select today's entry.
 *   This file's getPlantTrivia() is the single point to swap out.
 */
const PLANT_TRIVIAS: Record<string, string[]> = {
  tomato: [
    "トマトは水を少し控えめにすると甘みが出やすいと言われます。ただし鉢植えでは乾かしすぎに注意です。",
    "トマトの葉や茎には独特の香りがあり、虫よけになることもあると言われています。",
    "トマトは花が風に揺れるだけで受粉しやすい構造になっていて、放っておいても実がつきやすい植物です。",
    "トマトが赤くなるのはリコピンという色素が増えているサインです。完熟するほど甘みが増しやすくなります。",
  ],
  mint: [
    "ミントは地下茎でどんどん広がるほど生命力が強い植物です。",
    "ミントにはペパーミント・スペアミント・アップルミントなど種類が多く、それぞれ香りが少しずつ違います。",
    "ミントは摘み取るほど脇芽が出やすく、こまめに収穫しながら育てると長く楽しめます。",
    "ミントの香りにはリラックス効果があると言われており、アロマやハーブティーとしても愛されています。",
  ],
  coriander: [
    "コリアンダーは葉・茎・種でまったく違う香りが楽しめる、一つで三役の植物です。",
    "コリアンダーの種を乾燥させるとスパイスになり、葉とは異なる甘い香りが広がります。",
    "コリアンダーは暑さより涼しい時期のほうが育ちやすく、夏は早めに花が咲きやすい傾向があります。",
    "コリアンダーの香りへの好みは人によって大きく分かれ、世界中の料理で使われる個性派ハーブです。",
  ],
  makrut_lime: [
    "コブミカンの葉はタイ料理をはじめ、アジア各国の料理に欠かせないハーブです。",
    "コブミカンの葉は8の字のようにくびれた独特の形をしていて、一度見ると忘れにくい植物です。",
    "コブミカンは寒さが苦手で、10℃を下回ると葉が落ちやすいので冬は室内で管理するとよいです。",
    "コブミカンの果皮も香りがとても豊かで、料理の風味付けに葉と合わせて使われることがあります。",
  ],
  everbearing_strawberry: [
    "四季成りイチゴは一季成りと違い、春から秋にかけて繰り返し実をつけやすい品種です。",
    "イチゴの赤い実は植物学的には「花托（かたく）」と呼ばれる部分で、小さなつぶつぶが本当の果実なんです。",
    "イチゴはランナーと呼ばれる茎を伸ばして子株を増やすことができ、株の更新に使えます。",
    "日当たりと水分管理がイチゴの味に大きく影響しやすく、完熟したものほど甘くなりやすいです。",
  ],
  strawberry: [
    "イチゴの赤い実は植物学的には「花托（かたく）」と呼ばれる部分で、表面の小さなつぶつぶが本当の果実です。",
    "イチゴはランナーと呼ばれる茎を伸ばして子株を増やすことができ、親株から苗を取ることができます。",
    "日当たりと水分管理がイチゴの甘みに大きく影響し、完熟させるほど糖度が上がりやすいです。",
    "イチゴは実が地面につかないよう「敷きわら」などを敷くと、汚れや病気を防ぎやすくなります。",
  ],
  italian_parsley: [
    "イタリアンパセリはカーリーパセリより葉が平らで、香りが穏やかなのが特徴です。",
    "パセリは鉄分やビタミンCが豊富で、飾りにしてしまうにはもったいないほど栄養素が詰まっています。",
    "パセリは発芽までに時間がかかりやすいですが、一度根付くと比較的丈夫に育ちやすい植物です。",
    "アゲハ蝶の幼虫はパセリが好きなので、葉の裏に卵がないか時々チェックすると安心です。",
  ],
  shiso: [
    "大葉（青じそ）は日本料理になくてはならないハーブで、収穫するほど次の葉が出やすくなります。",
    "しそは花が咲く前に葉を収穫すると、葉が柔らかく香りも楽しみやすい状態が続きやすいです。",
    "しそは乾燥より水分を好む植物なので、土の表面が乾いたらこまめに水やりするのがコツです。",
    "真夏の強い直射日光が続くとしその葉が固くなりやすいので、半日陰も意外と向いています。",
  ],
  perilla: [
    "えごまはしそと同じシソ科の植物で、葉はよく似ていますが香りが少し異なります。",
    "えごまの種からとれるえごま油は、オメガ3脂肪酸を多く含むと注目されています。",
    "えごまは暑さにも比較的強く、日本でも古くから食用・油用として親しまれてきた植物です。",
    "えごまの葉は韓国料理でよく使われ、焼き肉を包んで食べるなど独特の使い方が広まっています。",
  ],
  fig: [
    "イチジクは「花のない実」と書きますが、実は果実の内側にたくさんの花が集まった「花嚢」なんです。",
    "イチジクは収穫後に追熟しないため、木でしっかり完熟させてから収穫するのがおいしさの秘訣です。",
    "イチジクは世界最古の栽培植物の一つとされ、旧約聖書にも登場するほど古くから人々に親しまれてきました。",
    "イチジクの白い樹液はラテックスを含み、肌に触れるとかゆみが出ることがあるので収穫時は注意が必要です。",
  ],
  radish: [
    "ラディッシュは種まきから約20日で収穫できることから「二十日大根」とも呼ばれます。",
    "ラディッシュの根が細長くなるのは密植が原因であることが多く、適切な間引きが丸い形のコツです。",
    "ラディッシュは根だけでなく葉も食べられ、サラダや炒め物に使うと丸ごと無駄なく楽しめます。",
    "ラディッシュは高温期に育てると辛みが強くなりやすく、春や秋の涼しい時期が育てやすいです。",
  ],
  calendula: [
    "カレンジュラ（ポットマリーゴールド）の花びらは食用になり、サラダや料理の彩りに使われます。",
    "カレンジュラはコンパニオンプランツとして知られ、周りの植物の害虫を遠ざける効果があると言われています。",
    "カレンジュラは花が終わったらすぐ摘み取る「花がら摘み」をすることで、長く次々と咲き続けます。",
    "カレンジュラは古くからスキンケアに使われており、乾燥肌やかゆみを和らげるハーブとして知られています。",
  ],
  kohlrabi: [
    "コールラビはドイツ語で「キャベツ（Kohl）＋カブ（Rabi）」を意味する、茎が球状に膨らむ野菜です。",
    "コールラビは生でも加熱しても食べられ、大根やカブに似た甘みとシャキシャキ感が特徴です。",
    "コールラビはビタミンCが豊富で、球部分が直径7〜8cmほどになったら収穫のタイミングです。",
    "コールラビは種まきから約60日で収穫できる比較的育てやすいアブラナ科の野菜です。",
  ],
  kujo_negi: [
    "九条ネギは京都・九条地区が発祥の伝統野菜で、葉が柔らかく甘みが強いのが特徴です。",
    "九条ネギは根元を少し残して刈り取る「切り戻し収穫」をすると、繰り返し収穫し続けられます。",
    "九条ネギは寒さに当たるほど甘みが増すと言われ、冬に向かうほどより美味しくなっていきます。",
    "九条ネギは薬味から炒め物・鍋まで活躍する万能ネギで、日本各地で「地ネギ」として愛されています。",
  ],
  rosemary: [
    "ローズマリーは乾燥した土を好むため、水やりは土がしっかり乾いてから行うのがポイントです。",
    "ローズマリーは地中海沿岸原産の丈夫なハーブで、日当たりと風通しがよければ旺盛に育ちます。",
    "ローズマリーの香りには集中力を高める効果があると言われており、学習や仕事の場でも人気です。",
    "ローズマリーは「記憶の象徴」として古くから大切にされてきたハーブで、結婚式などの特別な場でも用いられました。",
  ],
  basil: [
    "バジルはトマトと並べて植えると互いの生育を助け合うと言われ、コンパニオンプランツの代表格です。",
    "バジルは花穂が出てきたら早めに摘み取る「摘心」をすることで、葉を長くたくさん楽しめます。",
    "バジルは熱で香りが飛びやすいため、料理の仕上げに生のまま加えると最もよい風味が楽しめます。",
    "バジルの名前はギリシャ語で「王」を意味する言葉に由来し、古くから聖なるハーブとして珍重されました。",
  ],
};

/**
 * Alias map: Japanese plant names and alternative English keys → canonical PLANT_TRIVIAS key.
 * Used when plant_type in the DB is stored as a Japanese name or non-canonical English key.
 */
const PLANT_NAME_ALIASES: Record<string, string> = {
  // Japanese names
  "コブミカン": "makrut_lime",
  "イチジク": "fig",
  "ラディッシュ": "radish",
  "二十日大根": "radish",
  "カレンジュラ": "calendula",
  "コールラビ": "kohlrabi",
  "えごま": "perilla",
  "大葉": "shiso",
  "青じそ": "shiso",
  "パクチー": "coriander",
  "コリアンダー": "coriander",
  "イチゴ": "strawberry",
  "四季成りイチゴ": "everbearing_strawberry",
  "九条ネギ": "kujo_negi",
  "ローズマリー": "rosemary",
  "ミント": "mint",
  "トマト": "tomato",
  "バジル": "basil",
  "パセリ": "italian_parsley",
  "イタリアンパセリ": "italian_parsley",
  // English aliases
  "strawberry": "everbearing_strawberry",
  "green_onion": "kujo_negi",
};

function datePick<T>(items: T[], dateStr: string, salt: number): T {
  const seed = `${dateStr}:${salt}`;
  let h = 0;
  for (const c of seed) {
    h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  }
  return items[Math.abs(h) % items.length];
}

function resolveKey(name: string | null | undefined): string | null {
  if (!name) return null;
  if (PLANT_TRIVIAS[name]) return name;
  const aliased = PLANT_NAME_ALIASES[name];
  return aliased && PLANT_TRIVIAS[aliased] ? aliased : null;
}

/**
 * Returns a deterministic daily trivia string for the given plant.
 * Tries plantType first, then falls back to displayName (for plants stored with Japanese names).
 * The same plant + date always returns the same trivia (no flickering on re-render).
 * Returns null if no matching trivia entry is found.
 */
export function getPlantTrivia(
  plantType: string | null | undefined,
  dateStr: string,
  displayName?: string | null,
): string | null {
  const key = resolveKey(plantType) ?? resolveKey(displayName) ?? null;
  if (!key) return null;
  const trivias = PLANT_TRIVIAS[key];
  if (!trivias || trivias.length === 0) return null;
  return datePick(trivias, dateStr, 777);
}
