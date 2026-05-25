'use client';

import { useState, useEffect } from 'react';
import ImageGrid from '@/components/ImageGrid';
import { Chips } from '@/components/Chips';
import { Button } from '@/components/Button';
import { MOOD_LABELS, COLOR_LABELS, WEATHER_LABELS, LUGGAGE_LABELS } from '@/lib/labels';
import { buildAlt } from '@/lib/utils';
import type {
  WardrobeEntry,
  TasteEntry,
  Mood,
  ColorTone,
  WeatherCondition,
  Luggage,
  SeasonFeel,
} from '@/lib/types';

type Props = { wardrobe: WardrobeEntry[]; taste: TasteEntry[] };

type AppliedFilters = {
  moods: Mood[];
  colorTones: ColorTone[];
  weatherConditions: WeatherCondition[];
  luggages: Luggage[];
  date: string;
};


function dateToSeason(dateStr: string): SeasonFeel {
  const month = new Date(dateStr).getMonth() + 1;
  if (month >= 3 && month <= 5) return 'SPRING';
  if (month >= 6 && month <= 8) return 'SUMMER';
  if (month >= 9 && month <= 11) return 'AUTUMN';
  return 'WINTER';
}

function filterWardrobe(items: WardrobeEntry[], f: AppliedFilters): WardrobeEntry[] {
  const season = dateToSeason(f.date);
  return items.filter((item) => {
    if (f.moods.length > 0 && !f.moods.some((m) => item.mood.includes(m))) return false;
    if (f.colorTones.length > 0 && !f.colorTones.some((c) => item.colorTone.includes(c))) return false;
    if (f.luggages.length > 0 && !f.luggages.some((l) => item.luggage.includes(l))) return false;
    if (item.seasonFeel.length > 0 && !item.seasonFeel.includes(season)) return false;
    if (item.weather.condition.length > 0 && f.weatherConditions.length > 0) {
      if (!f.weatherConditions.some((wc) => item.weather.condition.includes(wc))) return false;
    }
    return true;
  });
}

function filterTaste(items: TasteEntry[], f: AppliedFilters): TasteEntry[] {
  const season = dateToSeason(f.date);
  return items.filter((item) => {
    if (f.moods.length > 0 && !f.moods.some((m) => item.mood.includes(m))) return false;
    if (f.colorTones.length > 0 && !f.colorTones.some((c) => item.colorTone.includes(c))) return false;
    if (item.seasonFeel.length > 0 && !item.seasonFeel.includes(season)) return false;
    return true;
  });
}

export default function FilterDashboard({ wardrobe, taste }: Props) {
  const [today] = useState(() => new Date().toISOString().split('T')[0]);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [weatherInfo, setWeatherInfo] = useState<{ temp: number; condition: WeatherCondition; label: string } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const [moods, setMoods] = useState<Mood[]>([]);
  const [colorTones, setColorTones] = useState<ColorTone[]>([]);
  const [weatherConditions, setWeatherConditions] = useState<WeatherCondition[]>([]);
  const [luggages, setLuggages] = useState<Luggage[]>([]);

  const [applied, setApplied] = useState<AppliedFilters | null>(null);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;

    async function load() {
      setWeatherLoading(true);
      setWeatherInfo(null);
      try {
        const res = await fetch(`/api/weather?date=${date}`);
        if (cancelled || !res.ok) return;
        const json = await res.json();
        if (!cancelled && 'data' in json) {
          setWeatherInfo(json.data);
          setWeatherConditions([json.data.condition]);
        }
      } catch {
        // 날씨 조회 실패 시 칩 그대로 유지
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [date]);

  const handleRecommend = () => {
    setApplied({ moods, colorTones, weatherConditions, luggages, date });
  };

  const resultWardrobe = applied ? filterWardrobe(wardrobe, applied) : [];
  const resultTaste = applied ? filterTaste(taste, applied) : [];

  const wardrobeGrid = resultWardrobe.map((item) => ({
    id: item.id, imagePath: item.imagePath, alt: buildAlt(item),
  }));
  const tasteGrid = resultTaste.map((item) => ({
    id: item.id, imagePath: item.imagePath, alt: buildAlt(item),
  }));

  return (
    <main>
      <div className="px-4 py-3 border-b border-gray-200 space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          />
          <span className="text-sm text-gray-400">
            {weatherLoading
              ? '날씨 조회 중...'
              : weatherInfo
                ? `${weatherInfo.label} ${weatherInfo.temp}°C`
                : date
                  ? '날씨 정보 없음'
                  : ''}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-7 shrink-0">기분</span>
            <Chips options={['CASUAL', 'FORMAL', 'DATE'] as Mood[]} selected={moods} labels={MOOD_LABELS} onChange={setMoods} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-7 shrink-0">색감</span>
            <Chips options={['WARM', 'COOL', 'NEUTRAL', 'COLORFUL', 'MONOCHROME'] as ColorTone[]} selected={colorTones} labels={COLOR_LABELS} onChange={setColorTones} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-7 shrink-0">날씨</span>
            <Chips options={['PRECIPITATION', 'OTHER'] as WeatherCondition[]} selected={weatherConditions} labels={WEATHER_LABELS} onChange={setWeatherConditions} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-7 shrink-0">짐</span>
            <Chips options={['LIGHT', 'NORMAL', 'HEAVY'] as Luggage[]} selected={luggages} labels={LUGGAGE_LABELS} onChange={setLuggages} />
          </div>
        </div>

        <Button onClick={handleRecommend} disabled={weatherLoading} className="w-full">
          추천 받기
        </Button>
      </div>

      {applied === null ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          조건을 설정하고 추천 받기를 눌러주세요
        </div>
      ) : (
        <>
          <section>
            <h2 className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 border-b border-gray-100">
              옷장 {wardrobeGrid.length > 0 && `(${wardrobeGrid.length})`}
            </h2>
            {wardrobeGrid.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                {wardrobe.length === 0 ? '등록된 코디가 없습니다' : '조건에 맞는 코디가 없습니다'}
              </div>
            ) : (
              <ImageGrid items={wardrobeGrid} />
            )}
          </section>

          <section>
            <h2 className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 border-b border-gray-100">
              취향 {tasteGrid.length > 0 && `(${tasteGrid.length})`}
            </h2>
            {tasteGrid.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                {taste.length === 0 ? '등록된 사진이 없습니다' : '조건에 맞는 사진이 없습니다'}
              </div>
            ) : (
              <ImageGrid items={tasteGrid} />
            )}
          </section>
        </>
      )}
    </main>
  );
}
