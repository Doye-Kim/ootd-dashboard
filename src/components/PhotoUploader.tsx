'use client';

import { useRef, useTransition } from 'react';
import { addToWardrobe, addToTaste } from '@/app/actions';

type Props = { type: 'wardrobe' | 'taste' };

export default function PhotoUploader({ type }: Props) {
  console.log('type', type);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const action = type === 'wardrobe' ? addToWardrobe : addToTaste;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);
    console.log(file, formData);

    startTransition(async () => {
      const result = await action(formData);
      console.log('res', result);
      if (inputRef.current) inputRef.current.value = '';
      if (!result.ok) alert(result.error);
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
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        className='px-4 py-2 text-sm border border-gray-300 rounded disabled:opacity-50'>
        {isPending ? '등록 중...' : '+ 사진 등록'}
      </button>
    </>
  );
}
