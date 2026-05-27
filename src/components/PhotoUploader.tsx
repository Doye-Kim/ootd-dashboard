'use client';

import { useRef, useTransition } from 'react';
import { prepareUpload } from '@/app/actions';
import { Button } from '@/components/Button';
import type { VisionTagResult, Weather } from '@/lib/types';

type Props = {
  type: 'wardrobe' | 'taste';
  onUploadReady: (
    id: string,
    imagePath: string,
    tags: VisionTagResult,
    tagsOk: boolean,
    date: string | null,
    weather: Weather,
  ) => void;
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
      try {
        const result = await prepareUpload(formData, type);
        if (inputRef.current) inputRef.current.value = '';
        if (!result.ok) {
          alert(result.error);
          return;
        }
        onUploadReady(
          result.id,
          result.imagePath,
          result.tags,
          result.tagsOk,
          result.date,
          result.weather,
        );
      } catch (e) {
        if (inputRef.current) inputRef.current.value = '';
        alert(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <>
      <input
        ref={inputRef}
        type='file'
        accept='image/*,.heic,.heif'
        className='hidden'
        onChange={handleChange}
      />
      <Button
        variant='secondary'
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        className='px-4'>
        {isPending ? '분석 중...' : '+ 사진 등록'}
      </Button>
    </>
  );
}
