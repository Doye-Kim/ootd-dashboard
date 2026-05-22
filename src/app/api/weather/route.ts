import type { ApiResponse, WeatherCondition } from '@/lib/types';

type WeatherData = { temp: number; condition: WeatherCondition };

const CONDITION_MAP: Record<string, WeatherCondition> = {
  Clear: 'SUNNY',
  Clouds: 'CLOUDY',
  Rain: 'RAINY',
  Drizzle: 'RAINY',
  Thunderstorm: 'RAINY',
  Snow: 'SNOWY',
};

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lon = parseFloat(searchParams.get('lon') ?? '');

  if (isNaN(lat) || isNaN(lon)) {
    return Response.json(
      { error: 'lat, lon 파라미터가 필요합니다.' } satisfies ApiResponse<WeatherData>,
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
  const res = await fetch(url);

  if (!res.ok) {
    return Response.json(
      { error: '날씨 데이터를 가져오지 못했습니다.' } satisfies ApiResponse<WeatherData>,
      { status: 502 }
    );
  }

  const json = await res.json();
  const temp = Math.round(json.main.temp);
  const condition: WeatherCondition = CONDITION_MAP[json.weather[0].main] ?? 'CLOUDY';

  return Response.json({ data: { temp, condition } } satisfies ApiResponse<WeatherData>);
}
