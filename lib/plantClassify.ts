export type PlantGroup =
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
  if (/negi|ネギ|kujo_negi|green_onion|spinach|ほうれん草|ホウレンソウ|lettuce|レタス|komatsuna|小松菜|ルッコラ|arugula|rocket/.test(s)) return "leafy";
  if (/radish|ラディッシュ|二十日大根|kohlrabi|コールラビ|carrot|ニンジン|turnip|カブ|beet|ビーツ/.test(s)) return "root_vegetable";
  if (/makrut_lime|コブミカン|fig|イチジク|strawberry|イチゴ|citrus|柑橘|lemon|レモン|blueberry|ブルーベリー/.test(s)) return "fruit_tree";
  if (/calendula|カレンジュラ|marigold|マリーゴールド|pansy|パンジー|viola|ビオラ|petunia|ペチュニア/.test(s)) return "flower";
  if (/tomato|トマト|pepper|ピーマン|eggplant|ナス|cucumber|キュウリ|zucchini|ズッキーニ|pumpkin|カボチャ|bean|インゲン|pea|エンドウ/.test(s)) return "fruit_vegetable";
  if (/観葉|houseplant|pothos|ポトス|monstera|モンステラ|ficus|フィカス|cactus|サボテン|succulent|多肉|aloe|アロエ/.test(s)) return "houseplant";

  return "general";
}

/**
 * harvesting タスクに対して表示するタグラベルを植物タイプに応じて返す。
 * 葉物・ハーブ → "摘み取り"、根菜・実もの・その他 → "収穫"
 */
export function getHarvestLabel(
  plantType: string | null | undefined,
  plantName: string,
): "摘み取り" | "収穫" {
  const group = classifyPlantGroup(plantType, plantName);
  if (group === "herb" || group === "leafy") return "摘み取り";
  return "収穫";
}

/**
 * harvesting タスクの提案文を植物タイプに応じて返す。
 * フォールバック用: care_rule.message がない場合や、UI直接生成時に使用。
 */
export function getHarvestSuggestionText(
  plantType: string | null | undefined,
  plantName: string,
): string {
  const group = classifyPlantGroup(plantType, plantName);
  switch (group) {
    case "herb":
      return "葉が茂ってきたら、使う分だけ少し摘んでもよさそうです。伸びすぎているところがあれば、先端を少し摘むと風通しがよくなりそうです。";
    case "leafy":
      return "葉が伸びてきたら、使う分だけ少し摘んでもよさそうです。";
    case "root_vegetable":
      return "株元のふくらみを見ながら、そろそろ抜きどきを確認してみてもよさそうです。";
    default:
      return "";
  }
}
