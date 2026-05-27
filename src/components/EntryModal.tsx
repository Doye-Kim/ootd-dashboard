'use client';

import { useState, useEffect, useRef } from 'react';
import { Chips } from '@/components/Chips';
import { Button } from '@/components/Button';
import { MOOD_LABELS, LUGGAGE_LABELS, COLOR_LABELS, SEASON_LABELS, WEATHER_LABELS } from '@/lib/labels';
import type {
  WardrobeEntry, TasteEntry,
  Mood, Luggage, ColorTone, SeasonFeel, WeatherCondition,
} from '@/lib/types';

type Props = {
  type: 'wardrobe' | 'taste';
  mode: 'upload' | 'edit';
  entry: WardrobeEntry | TasteEntry;
  onSave: (entry: WardrobeEntry | TasteEntry) => Promise<void>;
  onClose: () => void;
  onDelete?: () => Promise<void>;
};



export default function EntryModal({ type, mode, entry, onSave, onClose, onDelete }: Props) {
  const isWardrobe = type === 'wardrobe';
  const w = isWardrobe ? (entry as WardrobeEntry) : null;

  const [mood, setMood] = useState<Mood[]>(entry.mood);
  const [colorTone, setColorTone] = useState<ColorTone[]>(entry.colorTone);
  const [seasonFeel, setSeasonFeel] = useState<SeasonFeel[]>(entry.seasonFeel);
  const [luggage, setLuggage] = useState<Luggage[]>(w?.luggage ?? []);
  const [date, setDate] = useState(w?.date ?? new Date().toISOString().split('T')[0]);
  const [weatherCondition, setWeatherCondition] = useState<WeatherCondition[]>(w?.weather.condition ?? []);
  const [weatherTemp, setWeatherTemp] = useState(w?.weather.temp != null ? String(w.weather.temp) : '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);

  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving && !isDeleting) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, isSaving, isDeleting]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const base = { mood, colorTone, seasonFeel };
      const updated: WardrobeEntry | TasteEntry = isWardrobe
        ? {
            ...(entry as WardrobeEntry),
            ...base,
            luggage,
            date,
            weather: {
              temp: weatherTemp !== '' ? Number(weatherTemp) : null,
              condition: weatherCondition,
            },
          }
        : { ...(entry as TasteEntry), ...base };
      await onSave(updated);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };

  const handleDragMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta < 0) return;
    sheetRef.current.style.transform = `translateY(${delta}px)`;
    sheetRef.current.style.transition = 'none';
  };

  const handleDragEnd = (e: React.TouchEvent) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    const delta = e.changedTouches[0].clientY - dragStartY.current;
    dragStartY.current = null;
    if (delta > 100) {
      onClose();
    } else {
      sheetRef.current.style.transition = 'transform 0.2s ease-out';
      sheetRef.current.style.transform = '';
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" style={{ height: '100dvh' }}
      onClick={(e) => { if (e.target === e.currentTarget && !isSaving && !isDeleting) onClose(); }}
    >
      <div ref={sheetRef} className="animate-slide-up sm:[animation:none] bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-sm max-h-[70vh] sm:max-h-[90vh] overflow-y-auto overscroll-y-contain">
        <div
          className="flex justify-center pt-3 pb-1 sm:hidden cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="bg-gray-100 sm:rounded-t-xl overflow-hidden">
          <img src={entry.imagePath} alt="" className="w-full block" />
        </div>

        <div className="p-4 space-y-4">
          {isWardrobe && (
            <div>
              <label htmlFor="entry-date" className="text-xs text-gray-400 mb-1.5 block">날짜</label>
              <input
                id="entry-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5"
              />
            </div>
          )}

          <fieldset>
            <legend className="text-xs text-gray-400 mb-1.5">기분</legend>
            <Chips
              options={['CASUAL', 'FORMAL', 'DATE'] as Mood[]}
              selected={mood}
              labels={MOOD_LABELS}
              onChange={setMood}
            />
          </fieldset>

          {isWardrobe && (
            <fieldset>
              <legend className="text-xs text-gray-400 mb-1.5">짐</legend>
              <Chips
                options={['LIGHT', 'NORMAL', 'HEAVY'] as Luggage[]}
                selected={luggage}
                labels={LUGGAGE_LABELS}
                onChange={setLuggage}
              />
            </fieldset>
          )}

          <fieldset>
            <legend className="text-xs text-gray-400 mb-1.5">색감</legend>
            <Chips
              options={['WARM', 'COOL', 'NEUTRAL', 'COLORFUL', 'MONOCHROME'] as ColorTone[]}
              selected={colorTone}
              labels={COLOR_LABELS}
              onChange={setColorTone}
            />
          </fieldset>

          <fieldset>
            <legend className="text-xs text-gray-400 mb-1.5">계절감</legend>
            <Chips
              options={['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] as SeasonFeel[]}
              selected={seasonFeel}
              labels={SEASON_LABELS}
              onChange={setSeasonFeel}
            />
          </fieldset>

          {isWardrobe && (
            <fieldset>
              <legend className="text-xs text-gray-400 mb-1.5">날씨</legend>
              <Chips
                options={['PRECIPITATION', 'OTHER'] as WeatherCondition[]}
                selected={weatherCondition}
                labels={WEATHER_LABELS}
                onChange={setWeatherCondition}
              />
              <div className="flex items-center gap-2 mt-2">
                <label htmlFor="entry-temp" className="sr-only">온도</label>
                <input
                  id="entry-temp"
                  type="number"
                  value={weatherTemp}
                  onChange={(e) => setWeatherTemp(e.target.value)}
                  placeholder="온도"
                  className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-1.5"
                />
                <span className="text-sm text-gray-400" aria-hidden="true">°C</span>
              </div>
            </fieldset>
          )}
        </div>

        <div className="flex gap-2 px-4 pb-4">
          {mode === 'upload' ? (
            <Button variant="outline" onClick={onClose} className="flex-1">취소</Button>
          ) : (
            <Button variant="danger" onClick={handleDelete} disabled={isDeleting} className="flex-1">
              {isDeleting ? '삭제 중...' : '삭제'}
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving} className="flex-1">
            {isSaving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}
