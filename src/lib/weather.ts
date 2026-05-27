import type { WeatherCondition } from '@/lib/types';

export const DEFAULT_LAT = 35.1796;
export const DEFAULT_LON = 129.0756;

export function wmoToCondition(code: number): WeatherCondition {
  if (code <= 48) return 'OTHER';
  return 'PRECIPITATION';
}
