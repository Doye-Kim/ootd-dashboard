import type { ApiResponse, WeatherCondition } from '@/lib/types';

type WeatherData = { temp: number; condition: WeatherCondition; label: string };

const LAT = 35.1796;
const LON = 129.0756;

function wmoToCondition(code: number): WeatherCondition {
  if (code <= 48) return 'OTHER';
  return 'PRECIPITATION';
}

function wmoToLabel(code: number): string {
  if (code === 0) return '맑음';
  if (code <= 3) return '흐림';
  if (code <= 48) return '안개';
  if (code <= 67) return '비';
  if (code <= 77) return '눈';
  if (code <= 82) return '소나기';
  if (code <= 86) return '눈';
  return '비';
}

async function fetchDayWeather(date: string): Promise<WeatherData | null> {
  const today = new Date().toISOString().split('T')[0];
  const base =
    date < today
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast';

  try {
    const url = `${base}?latitude=${LAT}&longitude=${LON}&start_date=${date}&end_date=${date}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia/Seoul`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const codes: number[] = json.daily?.weathercode ?? [];
    if (codes.length === 0) return null;

    return {
      temp: Math.round(
        (json.daily.temperature_2m_max[0] + json.daily.temperature_2m_min[0]) / 2,
      ),
      condition: wmoToCondition(codes[0]),
      label: wmoToLabel(codes[0]),
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
