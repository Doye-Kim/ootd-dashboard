export type Mood = 'CASUAL' | 'FORMAL' | 'DATE';
export type Luggage = 'LIGHT' | 'NORMAL' | 'HEAVY';
export type ColorTone = 'WARM' | 'COOL' | 'NEUTRAL' | 'COLORFUL' | 'MONOCHROME';
export type SeasonFeel = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';
export type WeatherCondition = 'PRECIPITATION' | 'OTHER';

export type WardrobeEntry = {
  id: string;
  date: string;
  imagePath: string;
  weather: {
    temp: number | null;
    condition: WeatherCondition[];
  };
  mood: Mood[];
  luggage: Luggage[];
  colorTone: ColorTone;
  seasonFeel: SeasonFeel[];
};

export type TasteEntry = {
  id: string;
  imagePath: string;
  mood: Mood[];
  colorTone: ColorTone;
  seasonFeel: SeasonFeel[];
};

export type Weather = {
  temp: number | null;
  condition: WeatherCondition[];
};

export type VisionTagResult = {
  mood: Mood[];
  colorTone: ColorTone;
  seasonFeel: SeasonFeel[];
};

export type Correction = {
  imagePath: string;
  original: VisionTagResult;
  corrected: VisionTagResult;
  timestamp: string;
};

export type ApiResponse<T> = { data: T } | { error: string };
