import ImageGrid from '@/components/ImageGrid';
import PhotoUploader from '@/components/PhotoUploader';

type Item = {
  id: string;
  imagePath: string;
  mood?: string[];
  colorTone?: string[];
  seasonFeel?: string[];
};

type Props = {
  type: 'wardrobe' | 'taste';
  items: Item[];
};

function buildAlt(item: Item): string {
  const parts = [
    ...(item.mood ?? []),
    ...(item.colorTone ?? []),
    ...(item.seasonFeel ?? []),
  ];
  return parts.length > 0 ? `${parts.join(', ')} 코디` : '코디 사진';
}

export default function GalleryView({ type, items }: Props) {
  const gridItems = items.map((item) => ({
    id: item.id,
    imagePath: item.imagePath,
    alt: buildAlt(item),
  }));

  console.log(type);
  return (
    <main>
      <div className='flex justify-end px-4 py-3 border-b border-gray-200'>
        <PhotoUploader type={type} />
      </div>
      <ImageGrid items={gridItems} />
    </main>
  );
}
