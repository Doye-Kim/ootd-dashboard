import FilterDashboard from '@/components/FilterDashboard';
import { readJson } from '@/lib/data';
import type { WardrobeEntry, TasteEntry } from '@/lib/types';

export default async function MainPage() {
  const [wardrobe, taste] = await Promise.all([
    readJson<WardrobeEntry>('wardrobe.json'),
    readJson<TasteEntry>('taste.json'),
  ]);
  return <FilterDashboard wardrobe={wardrobe} taste={taste} />;
}
