'use client';

import { useState, useEffect } from 'react';
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

function MultiChips<T extends string>({
  options, selected, labels, onChange,
}: {
  options: T[];
  selected: T[];
  labels: Record<T, string>;
  onChange: (next: T[]) => void;
}) {
  const toggle = (v: T) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => toggle(v)}
          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
            selected.includes(v)
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
          }`}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  );
}


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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget && !isSaving && !isDeleting) onClose(); }}
    >
      <div className="bg-white rounded-xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        <div className="bg-gray-100 rounded-t-xl overflow-hidden">
          <img src={entry.imagePath} alt="" className="w-full block" />
        </div>

        <div className="p-4 space-y-4">
          {isWardrobe && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">날짜</p>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5"
              />
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 mb-1.5">기분</p>
            <MultiChips
              options={['CASUAL', 'FORMAL', 'DATE'] as Mood[]}
              selected={mood}
              labels={MOOD_LABELS}
              onChange={setMood}
            />
          </div>

          {isWardrobe && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">짐</p>
              <MultiChips
                options={['LIGHT', 'NORMAL', 'HEAVY'] as Luggage[]}
                selected={luggage}
                labels={LUGGAGE_LABELS}
                onChange={setLuggage}
              />
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 mb-1.5">색감</p>
            <MultiChips
              options={['WARM', 'COOL', 'NEUTRAL', 'COLORFUL', 'MONOCHROME'] as ColorTone[]}
              selected={colorTone}
              labels={COLOR_LABELS}
              onChange={setColorTone}
            />
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1.5">계절감</p>
            <MultiChips
              options={['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] as SeasonFeel[]}
              selected={seasonFeel}
              labels={SEASON_LABELS}
              onChange={setSeasonFeel}
            />
          </div>

          {isWardrobe && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">날씨</p>
              <MultiChips
                options={['PRECIPITATION', 'OTHER'] as WeatherCondition[]}
                selected={weatherCondition}
                labels={WEATHER_LABELS}
                onChange={setWeatherCondition}
              />
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  value={weatherTemp}
                  onChange={(e) => setWeatherTemp(e.target.value)}
                  placeholder="온도"
                  className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-1.5"
                />
                <span className="text-sm text-gray-400">°C</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-4 pb-4">
          {mode === 'upload' ? (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
            >
              취소
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 py-2 text-sm border border-red-200 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
