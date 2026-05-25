'use client';

import { useRef, useTransition } from 'react';
import { prepareUpload } from '@/app/actions';
import type { VisionTagResult, Weather } from '@/lib/types';

type Props = {
  type: 'wardrobe' | 'taste';
  onUploadReady: (imagePath: string, tags: VisionTagResult, date: string | null, weather: Weather) => void;
};

export default function PhotoUploader({ type, onUploadReady }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    startTransition(async () => {
      const result = await prepareUpload(formData, type);
      if (inputRef.current) inputRef.current.value = '';
      if (!result.ok) { alert(result.error); return; }
      onUploadReady(result.imagePath, result.tags, result.date, result.weather);
    });
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={handleChange}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        className="px-4 py-2 text-sm border border-gray-300 rounded disabled:opacity-50"
      >
        {isPending ? '분석 중...' : '+ 사진 등록'}
      </button>
    </>
  );
}
