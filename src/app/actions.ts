'use server';

import { revalidatePath } from 'next/cache';
import { writeFile, readFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { anthropic } from '@/lib/anthropic';
import { VISION_PROMPT } from '@/lib/prompts';
import type { OotdEntry, PinEntry, VisionTagResult } from '@/lib/types';

// heic-convert has no type declarations
// eslint-disable-next-line @typescript-eslint/no-require-imports
const heicConvert = require('heic-convert') as (opts: {
  buffer: Buffer;
  format: 'JPEG' | 'PNG';
  quality?: number;
}) => Promise<ArrayBuffer>;

const DATA_PATH = process.env.DATA_PATH!;
const DATA_DIR = path.join(process.cwd(), 'src/data/analysis');
const HEIC_TYPES = new Set(['image/heic', 'image/heif']);

async function analyzeImage(file: File): Promise<VisionTagResult> {
  const isHeic =
    HEIC_TYPES.has(file.type) ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif');

  const rawBuffer = Buffer.from((await file.arrayBuffer()) as ArrayBuffer);
  const buffer = isHeic
    ? Buffer.from(await heicConvert({ buffer: rawBuffer, format: 'JPEG', quality: 0.9 }))
    : rawBuffer;

  const mediaType = isHeic
    ? ('image/jpeg' as const)
    : ((file.type || 'image/jpeg') as
        | 'image/jpeg'
        | 'image/png'
        | 'image/gif'
        | 'image/webp');

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: buffer.toString('base64'),
            },
          },
          { type: 'text', text: VISION_PROMPT },
        ],
      },
    ],
  });

  const text =
    message.content[0].type === 'text' ? message.content[0].text.trim() : '';
  return JSON.parse(text);
}

async function saveImage(
  file: File,
  type: 'wardrobe' | 'taste',
): Promise<string> {
  const dir = path.join(DATA_PATH, type);
  await mkdir(dir, { recursive: true });

  const isHeic =
    HEIC_TYPES.has(file.type) ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif');

  const rawBuffer = Buffer.from((await file.arrayBuffer()) as ArrayBuffer);
  const ext = isHeic ? 'jpg' : file.name.split('.').pop() ?? 'jpg';
  const buffer = isHeic
    ? Buffer.from(await heicConvert({ buffer: rawBuffer, format: 'JPEG', quality: 0.9 }))
    : rawBuffer;

  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, filename), buffer);
  return `/api/image?type=${type}&file=${filename}`;
}

async function readJson<T>(filename: string): Promise<T[]> {
  try {
    const content = await readFile(path.join(DATA_DIR, filename), 'utf-8');
    return content.trim() ? JSON.parse(content) : [];
  } catch {
    return [];
  }
}

async function writeJson<T>(filename: string, data: T[]): Promise<void> {
  await writeFile(
    path.join(DATA_DIR, filename),
    JSON.stringify(data, null, 2),
    'utf-8',
  );
}

type ActionResult = { ok: true } | { ok: false; error: string };

export async function addToWardrobe(formData: FormData): Promise<ActionResult> {
  try {
    const file = formData.get('image') as File;

    const [tagsResult, imagePath] = await Promise.all([
      analyzeImage(file)
        .then((tags) => ({ ok: true as const, tags }))
        .catch(() => ({ ok: false as const })),
      saveImage(file, 'wardrobe'),
    ]);

    const tags = tagsResult.ok
      ? tagsResult.tags
      : { mood: [], colorTone: [], seasonFeel: [] };

    const entry: OotdEntry = {
      id: randomUUID(),
      date: new Date().toISOString().split('T')[0],
      imagePath,
      weather: { temp: null, condition: null },
      mood: tags.mood,
      luggage: [],
      colorTone: tags.colorTone,
      seasonFeel: tags.seasonFeel,
    };

    const entries = await readJson<OotdEntry>('wardrobe.json');
    entries.unshift(entry);
    await writeJson('wardrobe.json', entries);
    revalidatePath('/');

    if (!tagsResult.ok)
      return { ok: false, error: 'AI 분석 실패 — 태그 없이 저장했습니다.' };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '이미지 등록에 실패했습니다.',
    };
  }
}

export async function addToTaste(formData: FormData): Promise<ActionResult> {
  try {
    const file = formData.get('image') as File;

    const [tagsResult, imagePath] = await Promise.all([
      analyzeImage(file)
        .then((tags) => ({ ok: true as const, tags }))
        .catch(() => ({ ok: false as const })),
      saveImage(file, 'taste'),
    ]);

    const tags = tagsResult.ok
      ? tagsResult.tags
      : { mood: [], colorTone: [], seasonFeel: [] };

    const entry: PinEntry = {
      id: randomUUID(),
      imagePath,
      mood: tags.mood,
      colorTone: tags.colorTone,
      seasonFeel: tags.seasonFeel,
    };

    const entries = await readJson<PinEntry>('taste.json');
    entries.unshift(entry);
    await writeJson('taste.json', entries);
    revalidatePath('/');

    if (!tagsResult.ok)
      return { ok: false, error: 'AI 분석 실패 — 태그 없이 저장했습니다.' };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '이미지 등록에 실패했습니다.',
    };
  }
}
