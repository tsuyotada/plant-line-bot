type WeatherInfo = {
  temperature: number | null;
  precipitation: number | null;
  weatherCode: number | null;
  description: string;
};

const WEATHER_CODE_MAP: Record<number, string> = {
  0: "快晴",
  1: "晴れ",
  2: "晴れ時々くもり",
  3: "くもり",
  45: "霧",
  48: "霧（着氷）",
  51: "小雨",
  53: "雨",
  55: "強い雨",
  61: "弱い雨",
  63: "雨",
  65: "強い雨",
  71: "雪",
  80: "にわか雨",
  95: "雷雨",
};

export async function getTodayWeather(
  lat: number,
  lon: number
): Promise<WeatherInfo | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,precipitation_probability_max,weathercode&timezone=Asia%2FTokyo`;

    const res = await fetch(url);

    if (!res.ok) {
      console.error("Weather API error:", await res.text());
      return null;
    }

    const data = await res.json();

    const temperature =
      data?.daily?.temperature_2m_max?.[0] ?? null;
    const precipitation =
      data?.daily?.precipitation_probability_max?.[0] ?? null;
    const weatherCode =
      data?.daily?.weathercode?.[0] ?? null;

    const description =
      weatherCode !== null && WEATHER_CODE_MAP[weatherCode]
        ? WEATHER_CODE_MAP[weatherCode]
        : "天気不明";

    return {
      temperature,
      precipitation,
      weatherCode,
      description,
    };
  } catch (error) {
    console.error("getTodayWeather error:", error);
    return null;
  }
}