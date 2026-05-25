import type { WardrobeEntry, TasteEntry } from '@/lib/types';

export function buildAlt(entry: WardrobeEntry | TasteEntry): string {
  const parts = [...entry.mood, ...entry.colorTone, ...entry.seasonFeel];
  return parts.length > 0 ? `${parts.join(', ')} 코디` : '코디 사진';
}
