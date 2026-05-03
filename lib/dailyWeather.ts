export interface WeatherInfo {
  weather: "sunny" | "cloudy" | "rainy";
  temperatureC: number;
  willRain: boolean;
  humidity: number;
  maxTempC?: number;
  minTempC?: number;
  precipitationMm?: number;
  precipitationProbability?: number;
}

// ── Location (Nagoya) ─────────────────────────────────────────────
const NAGOYA_LAT = 35.18;
const NAGOYA_LON = 136.91;

// ── WMO code → weather type ───────────────────────────────────────
function wmoToWeather(code: number): WeatherInfo["weather"] {
  if (code <= 1) return "sunny";
  if (code <= 48) return "cloudy";
  return "rainy";
}

// ── Open-Meteo fetch ──────────────────────────────────────────────
async function fetchOpenMeteoWeather(_dateStr: string): Promise<WeatherInfo> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${NAGOYA_LAT}&longitude=${NAGOYA_LON}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode` +
    `&hourly=relativehumidity_2m` +
    `&timezone=Asia%2FTokyo` +
    `&forecast_days=1`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const daily = data.daily;
  const hourly = data.hourly;

  const maxTempC: number = daily.temperature_2m_max[0];
  const minTempC: number = daily.temperature_2m_min[0];
  const temperatureC = Math.round((maxTempC + minTempC) / 2);
  const precipitationMm: number = daily.precipitation_sum[0] ?? 0;
  const precipitationProbability: number = daily.precipitation_probability_max[0] ?? 0;
  const weatherCode: number = daily.weathercode[0];

  // Average daytime humidity (9am–18pm = hourly indices 9–18)
  const humidityValues: number[] = hourly.relativehumidity_2m.slice(9, 18);
  const humidity = Math.round(
    humidityValues.reduce((s: number, v: number) => s + v, 0) / humidityValues.length
  );

  const weather = wmoToWeather(weatherCode);
  const willRain = precipitationProbability > 40 || precipitationMm > 0.5;

  console.log(`[Weather] temperatureC=${temperatureC} (max=${maxTempC} min=${minTempC})`);
  console.log(`[Weather] willRain=${willRain} precipProb=${precipitationProbability}% precipMm=${precipitationMm}mm`);
  console.log(`[Weather] humidity=${humidity}% weatherCode=${weatherCode} → ${weather}`);

  return {
    weather,
    temperatureC,
    willRain,
    humidity,
    maxTempC,
    minTempC,
    precipitationMm,
    precipitationProbability,
  };
}

// ── Fallback: date-seeded pseudo-random (original logic) ──────────
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

function getFallbackWeather(dateStr: string): WeatherInfo {
  const h = hash32(dateStr);
  const month = new Date(dateStr).getMonth() + 1;
  const weatherOptions: WeatherInfo["weather"][] = ["sunny", "sunny", "cloudy", "rainy"];
  const weather = weatherOptions[h % weatherOptions.length];
  const baseTemp = seasonalBaseTemp(month);
  const temperatureC = baseTemp + ((h % 11) - 5);
  const humidity = weather === "rainy" ? 75 + (h % 20) : 40 + (h % 30);
  return { weather, temperatureC, willRain: weather === "rainy", humidity };
}

// ── Public API ────────────────────────────────────────────────────
export async function getTodayWeather(dateStr: string): Promise<WeatherInfo> {
  console.log("[Weather] Open-Meteo fetch start");
  try {
    const result = await fetchOpenMeteoWeather(dateStr);
    console.log("[Weather] Open-Meteo success");
    return result;
  } catch (err) {
    console.error("[Weather] Open-Meteo failed, using fallback:", err);
    const fallback = getFallbackWeather(dateStr);
    console.log(
      `[Weather] fallback temperatureC=${fallback.temperatureC}` +
      ` willRain=${fallback.willRain} humidity=${fallback.humidity}`
    );
    return fallback;
  }
}
