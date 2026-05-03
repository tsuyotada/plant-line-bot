import type { WeatherInfo } from "./dailyWeather";

export type PlantWithRecency = {
  id: string;
  display_name: string;
  location?: string | null;
  daysSinceLastPhoto: number | null;
  latestPhotoAt: string | null;
};

export type CarePriority = "recent" | "normal" | "attention" | "urgent";

export function getCarePriority(days: number | null): CarePriority {
  if (days === null || days >= 6) return "urgent";
  if (days <= 1) return "recent";
  if (days <= 3) return "normal";
  return "attention"; // 4〜5日
}

/**
 * 日付文字列 + salt をシードにした決定論的な配列選択。
 * 同じ日・同じ salt なら常に同じ要素を返す。
 */
function datePick<T>(items: T[], dateStr: string, salt: number): T {
  const seed = `${dateStr}:${salt}`;
  let h = 0;
  for (const c of seed) {
    h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  }
  return items[Math.abs(h) % items.length];
}

// ── テンプレート ──────────────────────────────────────────────────────────────

const WEATHER_LINES: Record<string, string[]> = {
  hot: [
    "今日は気温が高く、土が乾きやすい日です。水やりは朝のうちに。",
    "暑くなりそうです。葉焼けを防ぐため、水やりは早朝か夕方がベターです。",
    "強い日差しになりそうです。水やりと葉焼け対策の両方に気をつけて。",
  ],
  sunny: [
    "晴れています。土の表面が乾いていたら水やりのサインです。",
    "良い天気です。植物の様子をちょっとだけ見てあげましょう。",
    "晴れた日は乾きやすいので、鉢の表面だけ確認してみてください。",
  ],
  rainy: [
    "雨の予報です。屋外の植物は水やりを控えめに。",
    "雨が降りそうです。鉢に水がたまりすぎていないか確認してみてください。",
    "雨の日は根が傷みやすいです。水はけが気になる鉢を優先して見てあげてください。",
  ],
  cloudy: [
    "曇り空です。土の様子を見ながら、必要なら水やりを。",
    "曇りの日は水やりのタイミングを見極めやすいです。土を触って確認しましょう。",
    "過ごしやすい気候です。ゆっくり植物の様子を見てあげてください。",
  ],
  cold: [
    "気温が低めです。冷えた水は控えて、室温に近い水で水やりを。",
    "寒い日は植物も動きが緩やかです。水やりは控えめにして根腐れに注意。",
    "冷え込む日は水のあげすぎに注意です。土が乾いてから少量で。",
  ],
};

const CARE_LINES: Record<CarePriority, string[]> = {
  recent: [
    "最近記録あり。今日は様子を見守るだけでOK",
    "記録が新しいです。今日は軽く確認するだけで大丈夫",
    "最近観察できています。今日は見守り中心で",
  ],
  normal: [
    "少し日が空いています。土の表面を確認してみて",
    "そろそろチェックを。土が乾いていたら水やりを",
    "今日は土の乾き具合を確かめてみましょう",
  ],
  attention: [
    "最後の記録からしばらく経っています。土や葉を確認して",
    "少し間が空いています。鉢が軽くなっていたら水やり候補",
    "今日は優先してチェックを。水切れの可能性があります",
  ],
  urgent: [
    "しばらく記録がありません。水切れや葉の変化を確認して",
    "久しぶりのチェックが必要かもしれません。今日は必ず見てあげて",
    "記録がしばらくありません。土が乾いていたら水やりを優先して",
  ],
};

const CLOSING_LINES = [
  "無理ない範囲で、ちょこっとだけ気にかけてあげてください🌿",
  "植物との時間を楽しんでください🌱",
  "今日も植物たちと一緒に良い一日を☀️",
  "少しの手間が、植物の元気につながります🌿",
  "植物からのサインを見逃さないように観察してみてください🌱",
  "毎日少しの観察が、元気な植物への一番の近道です🌿",
];

// ── メッセージ構築 ────────────────────────────────────────────────────────────

function getWeatherKey(w: WeatherInfo): string {
  if (w.temperatureC >= 28) return "hot";
  if (w.temperatureC <= 10) return "cold";
  return w.weather; // "sunny" | "cloudy" | "rainy"
}

export function buildDailyCareMessage(
  today: string,
  plants: PlantWithRecency[],
  weather: WeatherInfo
): string {
  const weatherLine = datePick(WEATHER_LINES[getWeatherKey(weather)], today, 0);

  const plantLines = plants.slice(0, 5).map((plant, i) => {
    const priority = getCarePriority(plant.daysSinceLastPhoto);
    const careLine = datePick(CARE_LINES[priority], today, i + 1);
    return `・${plant.display_name}：${careLine}`;
  });

  const closing = datePick(CLOSING_LINES, today, 99);

  return [
    "【今日の植物メモ 🌱】",
    "",
    weatherLine,
    "",
    plantLines.join("\n"),
    "",
    closing,
  ].join("\n");
}
