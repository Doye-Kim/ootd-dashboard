import GalleryView from '@/components/GalleryView';
import { readJson } from '@/lib/data';
import type { WardrobeEntry } from '@/lib/types';

export default async function WardrobePage() {
  const items = await readJson<WardrobeEntry>('wardrobe.json');
  return <GalleryView type="wardrobe" items={items} />;
}
