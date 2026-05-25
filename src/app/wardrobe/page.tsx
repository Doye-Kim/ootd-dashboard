import { readFile } from 'fs/promises';
import path from 'path';
import GalleryView from '@/components/GalleryView';
import type { WardrobeEntry } from '@/lib/types';

export default async function WardrobePage() {
  let items: WardrobeEntry[] = [];
  try {
    const content = await readFile(
      path.join(process.cwd(), 'src/data/analysis/wardrobe.json'),
      'utf-8'
    );
    items = content.trim() ? JSON.parse(content) : [];
  } catch {}

  return <GalleryView type="wardrobe" items={items} />;
}
