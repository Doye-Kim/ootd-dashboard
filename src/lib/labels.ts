import type {
  Mood,
  Luggage,
  ColorTone,
  SeasonFeel,
  WeatherCondition,
} from '@/lib/types';

export const MOOD_LABELS: Record<Mood, string> = {
  CASUAL: '캐주얼',
  FORMAL: '포멀',
  DATE: '데이트',
};
export const LUGGAGE_LABELS: Record<Luggage, string> = {
  LIGHT: '가벼움',
  NORMAL: '보통',
  HEAVY: '무거움',
};
export const COLOR_LABELS: Record<ColorTone, string> = {
  WARM: '웜',
  COOL: '쿨',
  NEUTRAL: '뉴트럴',
  COLORFUL: '컬러풀',
  MONOCHROME: '무채색',
};
export const SEASON_LABELS: Record<SeasonFeel, string> = {
  SPRING: '봄',
  SUMMER: '여름',
  AUTUMN: '가을',
  WINTER: '겨울',
};
export const WEATHER_LABELS: Record<WeatherCondition, string> = {
  PRECIPITATION: '눈·비',
  OTHER: '그 외',
};
