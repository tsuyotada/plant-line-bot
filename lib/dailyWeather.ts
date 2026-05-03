export interface WeatherInfo {
  weather: "sunny" | "cloudy" | "rainy";
  temperatureC: number;
  willRain: boolean;
  humidity: number;
}

// 月ごとの日本の平均気温ベース値（°C）
function seasonalBaseTemp(month: number): number {
  const map: Record<number, number> = {
    1: 6, 2: 8, 3: 12, 4: 17, 5: 22, 6: 26,
    7: 30, 8: 31, 9: 26, 10: 20, 11: 14, 12: 8,
  };
  return map[month] ?? 20;
}

function hash32(str: string): number {
  let h = 0;
  for (const c of str) {
    h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  }
  return Math.abs(h);
}

/**
 * 指定日の天気情報を返す。
 * 現在はモック実装 — 同じ日付なら常に同じ値を返す決定論的な疑似ランダム。
 * 実運用では OpenWeatherMap などの API に差し替える。
 * 差し替えても呼び出し側は変更不要。
 */
export async function getTodayWeather(dateStr: string): Promise<WeatherInfo> {
  const h = hash32(dateStr);
  const month = new Date(dateStr).getMonth() + 1;

  // 晴れ50%・曇り25%・雨25%
  const weatherOptions: WeatherInfo["weather"][] = [
    "sunny", "sunny", "cloudy", "rainy",
  ];
  const weather = weatherOptions[h % weatherOptions.length];

  const baseTemp = seasonalBaseTemp(month);
  const temperatureC = baseTemp + ((h % 11) - 5); // ±5°C の日変動

  const humidity = weather === "rainy" ? 75 + (h % 20) : 40 + (h % 30);

  return { weather, temperatureC, willRain: weather === "rainy", humidity };
}
