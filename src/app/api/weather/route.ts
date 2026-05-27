import { DEFAULT_LAT, DEFAULT_LON, wmoToCondition } from '@/lib/weather';
import type { ApiResponse, WeatherCondition } from '@/lib/types';

type WeatherData = { temp: number; condition: WeatherCondition; label: string; icon: string };

function wmoToLabel(code: number): { label: string; icon: string } {
  if (code === 0) return { label: '맑음', icon: '☀️' };
  if (code <= 3) return { label: '흐림', icon: '⛅' };
  if (code <= 48) return { label: '안개', icon: '🌫️' };
  if (code <= 67) return { label: '비', icon: '🌧️' };
  if (code <= 77) return { label: '눈', icon: '🌨️' };
  if (code <= 82) return { label: '소나기', icon: '🌦️' };
  if (code <= 86) return { label: '눈', icon: '🌨️' };
  return { label: '비', icon: '🌧️' };
}

async function fetchDayWeather(date: string): Promise<WeatherData | null> {
  const today = new Date().toISOString().split('T')[0];
  const base =
    date < today
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast';

  try {
    const url = `${base}?latitude=${DEFAULT_LAT}&longitude=${DEFAULT_LON}&start_date=${date}&end_date=${date}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia/Seoul`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const codes: number[] = json.daily?.weathercode ?? [];
    if (codes.length === 0) return null;

    const { label, icon } = wmoToLabel(codes[0]);
    return {
      temp: Math.round(
        (json.daily.temperature_2m_max[0] + json.daily.temperature_2m_min[0]) / 2,
      ),
      condition: wmoToCondition(codes[0]),
      label,
      icon,
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json(
      { error: 'date 파라미터가 필요합니다. (YYYY-MM-DD)' } satisfies ApiResponse<WeatherData>,
      { status: 400 },
    );
  }

  const data = await fetchDayWeather(date);
  if (!data) {
    return Response.json(
      { error: '날씨 데이터를 가져오지 못했습니다.' } satisfies ApiResponse<WeatherData>,
      { status: 502 },
    );
  }

  return Response.json({ data } satisfies ApiResponse<WeatherData>);
}
