'use client';

import { useState, useEffect, useRef } from 'react';
import ImageGrid from '@/components/ImageGrid';
import { Chips } from '@/components/Chips';
import { Button } from '@/components/Button';
import {
  MOOD_LABELS,
  COLOR_LABELS,
  WEATHER_LABELS,
  LUGGAGE_LABELS,
} from '@/lib/labels';
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

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getFullYear()).slice(2)}년 ${
    d.getMonth() + 1
  }월 ${d.getDate()}일 ${DAY_KO[d.getDay()]}요일`;
}

function dateToSeason(dateStr: string): SeasonFeel {
  const month = new Date(dateStr).getMonth() + 1;
  if (month >= 3 && month <= 5) return 'SPRING';
  if (month >= 6 && month <= 8) return 'SUMMER';
  if (month >= 9 && month <= 11) return 'AUTUMN';
  return 'WINTER';
}

function filterWardrobe(
  items: WardrobeEntry[],
  f: AppliedFilters,
): WardrobeEntry[] {
  const season = dateToSeason(f.date);
  return items.filter((item) => {
    if (f.moods.length > 0 && !f.moods.some((m) => item.mood.includes(m)))
      return false;
    if (
      f.colorTones.length > 0 &&
      !f.colorTones.includes(item.colorTone)
    )
      return false;
    if (
      f.luggages.length > 0 &&
      !f.luggages.some((l) => item.luggage.includes(l))
    )
      return false;
    if (item.seasonFeel.length > 0 && !item.seasonFeel.includes(season))
      return false;
    if (item.weather.condition.length > 0 && f.weatherConditions.length > 0) {
      if (
        !f.weatherConditions.some((wc) => item.weather.condition.includes(wc))
      )
        return false;
    }
    return true;
  });
}

function filterTaste(items: TasteEntry[], f: AppliedFilters): TasteEntry[] {
  const season = dateToSeason(f.date);
  return items.filter((item) => {
    if (f.moods.length > 0 && !f.moods.some((m) => item.mood.includes(m)))
      return false;
    if (
      f.colorTones.length > 0 &&
      !f.colorTones.includes(item.colorTone)
    )
      return false;
    if (item.seasonFeel.length > 0 && !item.seasonFeel.includes(season))
      return false;
    return true;
  });
}

export default function FilterDashboard({ wardrobe, taste }: Props) {
  const [today] = useState(() => new Date().toISOString().split('T')[0]);
  const [date, setDate] = useState(
    () => new Date().toISOString().split('T')[0],
  );
  const [weatherInfo, setWeatherInfo] = useState<{
    temp: number;
    condition: WeatherCondition;
    label: string;
    icon: string;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const [moods, setMoods] = useState<Mood[]>([]);
  const [colorTones, setColorTones] = useState<ColorTone[]>([]);
  const [weatherConditions, setWeatherConditions] = useState<
    WeatherCondition[]
  >([]);
  const [luggages, setLuggages] = useState<Luggage[]>([]);

  const [applied, setApplied] = useState<AppliedFilters | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

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
        }
      } catch {
        // 날씨 조회 실패 시 칩 그대로 유지
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const handleRecommend = () => {
    setApplied({ moods, colorTones, weatherConditions, luggages, date });
  };

  const resultWardrobe = applied ? filterWardrobe(wardrobe, applied) : [];
  const resultTaste = applied ? filterTaste(taste, applied) : [];

  const wardrobeGrid = resultWardrobe.map((item) => ({
    id: item.id,
    imagePath: item.imagePath,
    alt: buildAlt(item),
  }));
  const tasteGrid = resultTaste.map((item) => ({
    id: item.id,
    imagePath: item.imagePath,
    alt: buildAlt(item),
  }));

  return (
    <main className='sm:flex sm:items-start'>
      <div className='px-4 py-3 space-y-3 border-b border-gray-200 sm:border-b-0 sm:mt-4 sm:w-72 sm:shrink-0 sm:sticky sm:top-0 sm:min-h-screen dark:border-gray-700'>
        <div className='flex flex-col gap-0.5'>
          <label
            htmlFor='filter-date'
            className='flex items-center gap-1.5 cursor-pointer'
            onClick={() => { try { dateInputRef.current?.showPicker(); } catch {} }}>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              height='16'
              width='16'
              viewBox='0 -960 960 960'
              fill='currentColor'
              aria-hidden='true'
              className='text-gray-400 shrink-0'>
              <path d='M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-40q0-17 11.5-28.5T280-880q17 0 28.5 11.5T320-840v40h320v-40q0-17 11.5-28.5T680-880q17 0 28.5 11.5T720-840v40h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Z' />
            </svg>
            <span className='text-sm text-gray-400 tracking-wide'>
              {formatDate(date)}
            </span>
            <input
              ref={dateInputRef}
              id='filter-date'
              type='date'
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              className='sr-only'
            />
          </label>
          {weatherLoading ? (
            <span className='text-sm text-gray-400'>날씨 조회 중...</span>
          ) : weatherInfo ? (
            <span className='text-2xl font-semibold tracking-tight'>
              {weatherInfo.temp}°C {weatherInfo.icon}
            </span>
          ) : (
            <span className='text-sm text-gray-400'>날씨 정보 없음</span>
          )}
        </div>

        <div className='flex flex-col gap-3 w-fit'>
          <div className='space-y-2'>
            <fieldset className='flex items-center gap-3'>
              <legend className='float-left text-xs text-gray-400 w-7 shrink-0'>무드</legend>
              <Chips
                options={['CASUAL', 'FORMAL', 'DATE'] as Mood[]}
                selected={moods}
                labels={MOOD_LABELS}
                onChange={setMoods}
              />
            </fieldset>
            <fieldset className='flex items-center gap-3'>
              <legend className='float-left text-xs text-gray-400 w-7 shrink-0'>색감</legend>
              <Chips
                options={['WARM', 'COOL', 'NEUTRAL', 'COLORFUL', 'MONOCHROME'] as ColorTone[]}
                selected={colorTones}
                labels={COLOR_LABELS}
                onChange={setColorTones}
              />
            </fieldset>
            <fieldset className='flex items-center gap-3'>
              <legend className='float-left text-xs text-gray-400 w-7 shrink-0'>날씨</legend>
              <Chips
                options={['PRECIPITATION', 'OTHER'] as WeatherCondition[]}
                selected={weatherConditions}
                labels={WEATHER_LABELS}
                onChange={setWeatherConditions}
              />
            </fieldset>
            <fieldset className='flex items-center gap-3'>
              <legend className='float-left text-xs text-gray-400 w-7 shrink-0'>짐</legend>
              <Chips
                options={['LIGHT', 'NORMAL', 'HEAVY'] as Luggage[]}
                selected={luggages}
                labels={LUGGAGE_LABELS}
                onChange={setLuggages}
              />
            </fieldset>
          </div>
          <Button
            onClick={handleRecommend}
            disabled={weatherLoading}
            variant='outline'
            className='w-full mt-4 flex items-center justify-center gap-1.5'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              height='16'
              width='16'
              viewBox='0 -960 960 960'
              fill='currentColor'
              aria-hidden='true'>
              <path d='m646-438-86 138q-11 17-30.5 14T505-309l-28-112-273 273q-11 11-27.5 11.5T148-148q-11-11-11-28t11-28l273-274-112-28q-20-5-23-24.5t14-30.5l138-85-12-163q-2-20 16-29t33 4l125 105 151-61q19-8 33 6t6 33l-61 151 105 124q13 15 4 33t-29 16l-163-11ZM134-706q-6-6-6-14t6-14l52-52q6-6 14-6t14 6l52 52q6 6 6 14t-6 14l-52 52q-6 6-14 6t-14-6l-52-52Zm421 263 48-79 93 7-60-71 35-86-86 35-71-59 7 92-79 49 90 22 23 90Zm151 309-52-52q-6-6-6-14t6-14l52-52q6-6 14-6t14 6l52 52q6 6 6 14t-6 14l-52 52q-6 6-14 6t-14-6ZM569-570Z' />
            </svg>
            추천 받기
          </Button>
        </div>
      </div>

      <div className='sm:flex-1 sm:min-w-0'>
        {applied === null ? (
          <div className='flex items-center justify-center h-48 text-gray-400 text-sm'>
            조건을 설정하고 추천 받기를 눌러주세요
          </div>
        ) : (
          <>
            <section>
              <h2 className='px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400'>
                옷장
              </h2>
              {wardrobeGrid.length === 0 ? (
                <div className='flex items-center justify-center h-32 text-gray-400 text-sm'>
                  {wardrobe.length === 0
                    ? '등록된 코디가 없습니다'
                    : '조건에 맞는 코디가 없습니다'}
                </div>
              ) : (
                <ImageGrid items={wardrobeGrid} />
              )}
            </section>

            <section>
              <h2 className='px-4 py-2 text-sm font-medium text-slate-600 mt-10'>
                취향
              </h2>
              {tasteGrid.length === 0 ? (
                <div className='flex items-center justify-center h-32 text-gray-400 text-sm'>
                  {taste.length === 0
                    ? '등록된 사진이 없습니다'
                    : '조건에 맞는 사진이 없습니다'}
                </div>
              ) : (
                <ImageGrid items={tasteGrid} />
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
