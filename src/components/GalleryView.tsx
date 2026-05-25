'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageGrid from '@/components/ImageGrid';
import PhotoUploader from '@/components/PhotoUploader';
import EntryModal from '@/components/EntryModal';
import {
  saveWardrobeEntry, saveTasteEntry,
  updateWardrobeEntry, updateTasteEntry,
  deleteWardrobeEntry, deleteTasteEntry,
  cancelUpload,
} from '@/app/actions';
import type { WardrobeEntry, TasteEntry, VisionTagResult, WeatherCondition } from '@/lib/types';

type Weather = { temp: number | null; condition: WeatherCondition | null };

type ModalState = { mode: 'upload' | 'edit'; entry: WardrobeEntry | TasteEntry } | null;

type Props =
  | { type: 'wardrobe'; items: WardrobeEntry[] }
  | { type: 'taste'; items: TasteEntry[] };

function buildAlt(entry: WardrobeEntry | TasteEntry): string {
  const parts = [...entry.mood, ...entry.colorTone, ...entry.seasonFeel];
  return parts.length > 0 ? `${parts.join(', ')} 코디` : '코디 사진';
}

export default function GalleryView({ type, items }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);

  const handleUploadReady = (imagePath: string, tags: VisionTagResult, date: string | null, weather: Weather) => {
    const base = {
      id: crypto.randomUUID(),
      imagePath,
      mood: tags.mood,
      colorTone: tags.colorTone,
      seasonFeel: tags.seasonFeel,
    };
    const entry: WardrobeEntry | TasteEntry =
      type === 'wardrobe'
        ? { ...base, date: date ?? new Date().toISOString().split('T')[0], weather, luggage: [] }
        : base;
    setModal({ mode: 'upload', entry });
  };

  const handleItemClick = (id: string) => {
    const entry = (items as (WardrobeEntry | TasteEntry)[]).find((i) => i.id === id);
    if (entry) setModal({ mode: 'edit', entry });
  };

  const handleSave = async (updated: WardrobeEntry | TasteEntry) => {
    const result =
      modal?.mode === 'upload'
        ? type === 'wardrobe'
          ? await saveWardrobeEntry(updated as WardrobeEntry)
          : await saveTasteEntry(updated as TasteEntry)
        : type === 'wardrobe'
          ? await updateWardrobeEntry(updated as WardrobeEntry)
          : await updateTasteEntry(updated as TasteEntry);
    if (!result.ok) { alert(result.error); return; }
    setModal(null);
    router.refresh();
  };

  const handleClose = async () => {
    if (modal?.mode === 'upload') {
      await cancelUpload(modal.entry.imagePath, type);
    }
    setModal(null);
  };

  const handleDelete = async () => {
    if (!modal || modal.mode !== 'edit') return;
    const { id, imagePath } = modal.entry;
    const result =
      type === 'wardrobe'
        ? await deleteWardrobeEntry(id, imagePath)
        : await deleteTasteEntry(id, imagePath);
    if (!result.ok) { alert(result.error); return; }
    setModal(null);
    router.refresh();
  };

  const gridItems = (items as (WardrobeEntry | TasteEntry)[]).map((item) => ({
    id: item.id,
    imagePath: item.imagePath,
    alt: buildAlt(item),
  }));

  return (
    <main>
      <div className="flex justify-end px-4 py-3 border-b border-gray-200">
        <PhotoUploader type={type} onUploadReady={handleUploadReady} />
      </div>
      <ImageGrid items={gridItems} onItemClick={handleItemClick} />
      {modal && (
        <EntryModal
          type={type}
          mode={modal.mode}
          entry={modal.entry}
          onSave={handleSave}
          onClose={handleClose}
          onDelete={modal.mode === 'edit' ? handleDelete : undefined}
        />
      )}
    </main>
  );
}
