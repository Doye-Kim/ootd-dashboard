import { readFile } from 'fs/promises';
import path from 'path';
import GalleryView from '@/components/GalleryView';
import type { TasteEntry } from '@/lib/types';

export default async function TastePage() {
  let items: TasteEntry[] = [];
  try {
    const content = await readFile(
      path.join(process.cwd(), 'src/data/analysis/taste.json'),
      'utf-8',
    );
    items = content.trim() ? JSON.parse(content) : [];
  } catch {}

  return <GalleryView type='taste' items={items} />;
}
