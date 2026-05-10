/**
 * Plant trivia map: plant_type → array of short trivia strings.
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
};

function datePick<T>(items: T[], dateStr: string, salt: number): T {
  const seed = `${dateStr}:${salt}`;
  let h = 0;
  for (const c of seed) {
    h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  }
  return items[Math.abs(h) % items.length];
}

/**
 * Returns a deterministic daily trivia string for the given plant type.
 * The same plant + date always returns the same trivia (no flickering on re-render).
 * Returns null if the plant type is unknown or has no trivia entries.
 */
export function getPlantTrivia(
  plantType: string | null | undefined,
  dateStr: string,
): string | null {
  if (!plantType) return null;
  const trivias = PLANT_TRIVIAS[plantType];
  if (!trivias || trivias.length === 0) return null;
  return datePick(trivias, dateStr, 777);
}
