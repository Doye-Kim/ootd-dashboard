import path from 'path';
import type { VisionTagResult } from '@/lib/types';

if (!process.env.DATA_PATH) throw new Error('DATA_PATH 환경변수가 설정되지 않았습니다.');
export const DATA_PATH = process.env.DATA_PATH;

export type ActionResult = { ok: true } | { ok: false; error: string };

const locks: Record<string, Promise<void>> = {};

export async function withFileLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks[key] ?? Promise.resolve();
  let release!: () => void;
  locks[key] = new Promise<void>((r) => { release = r; });
  try {
    await prev;
    return await fn();
  } finally {
    release();
  }
}

export function imagePathToFilePath(imagePath: string, type: 'wardrobe' | 'taste'): string {
  const filename = new URL(imagePath, 'http://x').searchParams.get('file') ?? '';
  return path.join(DATA_PATH, type, path.basename(filename));
}

export function tagsChanged(a: VisionTagResult, b: VisionTagResult): boolean {
  const s = (arr: string[]) => [...arr].sort().join(',');
  return s(a.mood) !== s(b.mood) || a.colorTone !== b.colorTone || s(a.seasonFeel) !== s(b.seasonFeel);
}
