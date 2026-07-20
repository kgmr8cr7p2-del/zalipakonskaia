import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth";

const OFFICE = {
  name: "Санкт-Петербург",
  address: "Конногвардейский бульвар, 4",
  latitude: 59.9329,
  longitude: 30.2991,
};

const weatherLabels: Record<number, string> = {
  0: "Ясно",
  1: "Преимущественно ясно",
  2: "Переменная облачность",
  3: "Пасмурно",
  45: "Туман",
  48: "Изморозь",
  51: "Легкая морось",
  53: "Морось",
  55: "Сильная морось",
  56: "Ледяная морось",
  57: "Сильная ледяная морось",
  61: "Небольшой дождь",
  63: "Дождь",
  65: "Сильный дождь",
  66: "Ледяной дождь",
  67: "Сильный ледяной дождь",
  71: "Небольшой снег",
  73: "Снег",
  75: "Сильный снег",
  77: "Снежные зерна",
  80: "Кратковременный дождь",
  81: "Ливень",
  82: "Сильный ливень",
  85: "Снегопад",
  86: "Сильный снегопад",
  95: "Гроза",
  96: "Гроза с градом",
  99: "Сильная гроза с градом",
};

export async function GET() {
  await requireVerifiedUser();
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(OFFICE.latitude));
  url.searchParams.set("longitude", String(OFFICE.longitude));
  url.searchParams.set("timezone", "Europe/Moscow");
  url.searchParams.set("forecast_hours", "24");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("current", "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m");
  url.searchParams.set("hourly", "precipitation_probability,precipitation,weather_code,temperature_2m");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max");

  try {
    const response = await fetch(url, { next: { revalidate: 600 } });
    if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
    const data = await response.json();
    const precipitationProbability = data.hourly?.precipitation_probability ?? [];
    const precipitation = data.hourly?.precipitation ?? [];
    const nextPrecipitationIndex = precipitationProbability.findIndex((value: number, index: number) => value >= 45 || Number(precipitation[index] ?? 0) > 0);
    const tomorrowWeatherCode = Number(data.daily?.weather_code?.[1] ?? data.current?.weather_code ?? 0);

    return NextResponse.json(
      {
        office: OFFICE,
        updatedAt: new Date().toISOString(),
        temperature: Math.round(Number(data.current?.temperature_2m ?? 0)),
        apparentTemperature: Math.round(Number(data.current?.apparent_temperature ?? 0)),
        precipitation: Number(data.current?.precipitation ?? 0),
        windSpeed: Math.round(Number(data.current?.wind_speed_10m ?? 0)),
        windGusts: Math.round(Number(data.current?.wind_gusts_10m ?? 0)),
        weatherCode: Number(data.current?.weather_code ?? 0),
        summary: weatherLabels[Number(data.current?.weather_code ?? 0)] ?? "Погода",
        hourlyForecast: buildHourlyForecast(data),
        tomorrow: data.daily?.time?.[1]
          ? {
              date: data.daily.time[1],
              temperatureMin: Math.round(Number(data.daily.temperature_2m_min?.[1] ?? 0)),
              temperatureMax: Math.round(Number(data.daily.temperature_2m_max?.[1] ?? 0)),
              precipitation: Number(data.daily.precipitation_sum?.[1] ?? 0),
              probability: Number(data.daily.precipitation_probability_max?.[1] ?? 0),
              summary: weatherLabels[tomorrowWeatherCode] ?? "Forecast",
            }
          : null,
        nextPrecipitation:
          nextPrecipitationIndex >= 0
            ? {
                time: data.hourly.time[nextPrecipitationIndex],
                probability: precipitationProbability[nextPrecipitationIndex],
                precipitation: precipitation[nextPrecipitationIndex],
                summary: weatherLabels[Number(data.hourly.weather_code[nextPrecipitationIndex] ?? 0)] ?? "Осадки",
              }
            : null,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=900",
        },
      },
    );
  } catch {
    return NextResponse.json({
      office: OFFICE,
      updatedAt: new Date().toISOString(),
      unavailable: true,
      summary: "Погода временно недоступна",
    });
  }
}

function buildHourlyForecast(data: any) {
  const times = data.hourly?.time ?? [];
  const now = Date.now();
  const firstFutureIndex = times.findIndex((time: string) => new Date(time).getTime() >= now);
  const start = firstFutureIndex >= 0 ? firstFutureIndex : 0;

  return times.slice(start, start + 4).map((time: string, offset: number) => {
    const index = start + offset;
    const weatherCode = Number(data.hourly?.weather_code?.[index] ?? data.current?.weather_code ?? 0);
    return {
      time,
      temperature: Math.round(Number(data.hourly?.temperature_2m?.[index] ?? 0)),
      probability: Number(data.hourly?.precipitation_probability?.[index] ?? 0),
      precipitation: Number(data.hourly?.precipitation?.[index] ?? 0),
      summary: weatherLabels[weatherCode] ?? "Weather",
    };
  });
}
