import GalleryView from '@/components/GalleryView';
import { readJson } from '@/lib/data';
import type { TasteEntry } from '@/lib/types';

export default async function TastePage() {
  const items = await readJson<TasteEntry>('taste.json');
  return <GalleryView type="taste" items={items} />;
}
