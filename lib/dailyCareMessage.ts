import type { WeatherInfo } from "./dailyWeather";

export type PlantWithRecency = {
  id: string;
  display_name: string;
  location?: string | null;
  daysSinceLastPhoto: number | null;
  latestPhotoAt: string | null;
  fertilizerEnabled: boolean;
  fertilizerIntervalDays: number;
  daysSinceLastFertilized: number;
};

export type CarePriority = "recent" | "normal" | "attention" | "urgent";
type Season = "spring" | "summer" | "autumn" | "winter";

export function getCarePriority(days: number | null): CarePriority {
  if (days === null || days >= 6) return "urgent";
  if (days <= 1) return "recent";
  if (days <= 3) return "normal";
  return "attention"; // 4〜5日
}

function getSeason(dateStr: string): Season {
  const month = new Date(dateStr).getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function datePick<T>(items: T[], dateStr: string, salt: number): T {
  const seed = `${dateStr}:${salt}`;
  let h = 0;
  for (const c of seed) {
    h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  }
  return items[Math.abs(h) % items.length];
}

// ── Templates ─────────────────────────────────────────────────────

const WEATHER_LINES: Record<string, string[]> = {
  hot: [
    "今日は気温が高く、土が乾きやすい日です。水やりは朝のうちに。",
    "暑くなりそうです。葉焼けを防ぐため、水やりは早朝か夕方がベターです。",
    "強い日差しになりそうです。水やりと葉焼け対策の両方に気をつけて。",
    "高温が予想されます。鉢の土が乾く前に、朝早めの水やりを。",
    "気温が高い日は植物も疲れやすいです。朝の水やりを忘れずに。",
  ],
  sunny: [
    "晴れています。土の表面が乾いていたら水やりのサインです。",
    "良い天気です。植物の様子をちょっとだけ見てあげましょう。",
    "晴れた日は乾きやすいので、鉢の表面だけ確認してみてください。",
    "日差しが気持ちいい一日です。植物に少し声をかけながら様子を見て。",
    "いい天気です。土の乾き具合を軽くチェックしてあげましょう。",
  ],
  rainy: [
    "雨の予報です。屋外の植物は水やりを控えめに。",
    "雨が降りそうです。鉢に水がたまりすぎていないか確認してみてください。",
    "雨の日は根が傷みやすいです。水はけが気になる鉢を優先して見てあげてください。",
    "まとまった雨になりそうです。鉢底からの排水が気になる日です。",
    "雨の日は水やりより鉢皿や蒸れのチェックを優先しましょう。",
  ],
  cloudy: [
    "曇り空です。土の様子を見ながら、必要なら水やりを。",
    "曇りの日は水やりのタイミングを見極めやすいです。土を触って確認しましょう。",
    "過ごしやすい気候です。ゆっくり植物の様子を見てあげてください。",
    "曇り空は植物にとって穏やかな環境です。水やりは土を確認してから。",
    "じっくり観察しやすいお天気です。葉の状態も気にかけてみてください。",
  ],
  cold: [
    "気温が低めです。冷えた水は控えて、室温に近い水で水やりを。",
    "寒い日は植物も動きが緩やかです。水やりは控えめにして根腐れに注意。",
    "冷え込む日は水のあげすぎに注意です。土が乾いてから少量で。",
    "気温が低い日は根の活動も鈍くなります。乾いていても少量ずつ水やりを。",
    "寒さの続く日は、置き場所の見直しも植物へのやさしさです。",
  ],
};

const SEASON_LINES: Record<Season, string[]> = {
  spring: [
    "春は新芽や葉色の変化が出やすい時期です。",
    "気温の上昇とともに生育が活発になる季節です。",
    "春は根が動き始めるタイミング。水やりは少しずつ増やして。",
  ],
  summer: [
    "夏は水切れと蒸れの両方に気をつけたい時期です。",
    "高温が続く季節。朝夕の観察を習慣にしましょう。",
    "夏は乾きが早いので、土の状態をこまめに確認して。",
  ],
  autumn: [
    "秋は成長が少し落ち着き、水やり頻度を見直すタイミングです。",
    "気温が下がり始めたら、水やりを少し控えめに。",
    "秋は植物が越冬の準備をする季節。日照時間の変化にも注目して。",
  ],
  winter: [
    "冬は水を控えめにしつつ、冷え込みに注意したい時期です。",
    "休眠中の植物が多い季節。水のあげすぎに注意しましょう。",
    "冬は室内の乾燥にも要注意。窓際の冷え込みも気にかけて。",
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

const APP_LINK_PHRASES = [
  "余力あれば水やり前に写真撮影も！👇",
  "写真を残しておくと、次の変化に気づきやすいです👇",
  "今日のお世話ついでに、1枚だけ記録しておきましょう👇",
  "水やり前の様子を残しておくと、あとで見返しやすいです👇",
  "植物の変化を写真で残しておきましょう👇",
  "今日のお世話をアプリで確認する👇",
  "写真つきで今日のお世話を確認する👇",
];

function getWeatherKey(w: WeatherInfo): string {
  if (w.temperatureC >= 28) return "hot";
  if (w.temperatureC <= 10) return "cold";
  return w.weather; // "sunny" | "cloudy" | "rainy"
}

// ── Message builder ───────────────────────────────────────────────

export function buildDailyCareMessage(
  today: string,
  plants: PlantWithRecency[],
  weather: WeatherInfo
): string {
  const weatherKey = getWeatherKey(weather);
  const season = getSeason(today);

  const weatherLine = datePick(WEATHER_LINES[weatherKey], today, 0);
  const seasonLine = datePick(SEASON_LINES[season], today, 100);
  const closing = datePick(CLOSING_LINES, today, 99);
  const appLinkPhrase = datePick(APP_LINK_PHRASES, today, 200);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "https://plant-line-bot-forme.vercel.app/";

  const plantLines = plants
    .slice(0, 5)
    .flatMap((plant) => {
      const needsWatering = getCarePriority(plant.daysSinceLastPhoto) !== "recent";
      const needsFertilizer =
        plant.fertilizerEnabled &&
        plant.daysSinceLastFertilized >= plant.fertilizerIntervalDays;

      if (needsWatering && needsFertilizer) {
        return [`・${plant.display_name}：水やりと液体肥料をしましょう`];
      } else if (needsWatering) {
        return [`・${plant.display_name}：水やりをしましょう`];
      } else if (needsFertilizer) {
        return [`・${plant.display_name}：液体肥料をあげるタイミングです`];
      }
      return [];
    });

  const plantSection =
    plantLines.length > 0
      ? plantLines.join("\n")
      : "今日のお世話はありません 🌿";

  return [
    "【今日の植物メモ 🌱】",
    "",
    weatherLine,
    seasonLine,
    "",
    plantSection,
    "",
    closing,
    "",
    appLinkPhrase,
    appUrl,
  ].join("\n");
}
