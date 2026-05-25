'use server';

import path from 'path';
import exifr from 'exifr';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { VISION_PROMPT } from '@/lib/prompts';
import { anthropic } from '@/lib/anthropic';
import { readJson, writeJson } from '@/lib/data';
import type {
  WardrobeEntry,
  TasteEntry,
  VisionTagResult,
  WeatherCondition,
} from '@/lib/types';

// heic-convert has no type declarations
// eslint-disable-next-line @typescript-eslint/no-require-imports
const heicConvert = require('heic-convert') as (opts: {
  buffer: Buffer;
  format: 'JPEG' | 'PNG';
  quality?: number;
}) => Promise<ArrayBuffer>;

if (!process.env.DATA_PATH) throw new Error('DATA_PATH 환경변수가 설정되지 않았습니다.');
const DATA_PATH = process.env.DATA_PATH;
const HEIC_TYPES = new Set(['image/heic', 'image/heif']);

const locks: Record<string, Promise<void>> = {};

async function withFileLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
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

function isHeic(file: File): boolean {
  return (
    HEIC_TYPES.has(file.type) ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  );
}

async function toJpeg(buf: Buffer): Promise<Buffer> {
  return Buffer.from(
    await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.9 }),
  );
}

async function analyzeImage(file: File): Promise<VisionTagResult> {
  const heic = isHeic(file);
  const raw = Buffer.from((await file.arrayBuffer()) as ArrayBuffer);
  const buffer = heic ? await toJpeg(raw) : raw;
  const mediaType = heic
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
  if (!text) throw new Error('AI 응답이 비어 있습니다.');
  return JSON.parse(text);
}

async function saveImageToDisk(
  file: File,
  type: 'wardrobe' | 'taste',
): Promise<string> {
  const dir = path.join(DATA_PATH, type);
  await mkdir(dir, { recursive: true });

  const heic = isHeic(file);
  const raw = Buffer.from((await file.arrayBuffer()) as ArrayBuffer);
  const ext = heic ? 'jpg' : file.name.split('.').pop() ?? 'jpg';
  const buffer = heic ? await toJpeg(raw) : raw;

  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, filename), buffer);
  return `/api/image?type=${type}&file=${filename}`;
}

async function extractExif(
  file: File,
): Promise<{ date: string | null; lat: number | null; lon: number | null }> {
  try {
    const buffer = Buffer.from((await file.arrayBuffer()) as ArrayBuffer);
    const exif = await exifr.parse(buffer, true);
    if (!exif) return { date: null, lat: null, lon: null };
    const date =
      exif.DateTimeOriginal instanceof Date
        ? exif.DateTimeOriginal.toISOString().split('T')[0]
        : null;
    const lat = typeof exif.latitude === 'number' ? exif.latitude : null;
    const lon = typeof exif.longitude === 'number' ? exif.longitude : null;
    return { date, lat, lon };
  } catch {
    return { date: null, lat: null, lon: null };
  }
}

function wmoToCondition(code: number): WeatherCondition {
  if (code === 0) return 'SUNNY';
  if (code <= 3) return 'CLOUDY';
  if (code <= 48) return 'CLOUDY';
  if (code <= 67) return 'RAINY';
  if (code <= 77) return 'SNOWY';
  if (code <= 82) return 'RAINY';
  if (code <= 86) return 'SNOWY';
  return 'RAINY';
}

async function fetchHistoricalWeather(
  lat: number,
  lon: number,
  date: string,
): Promise<{ temp: number | null; condition: WeatherCondition | null }> {
  try {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return { temp: null, condition: null };
    const json = await res.json();
    const max: number = json.daily.temperature_2m_max[0];
    const min: number = json.daily.temperature_2m_min[0];
    const code: number = json.daily.weathercode[0];
    return {
      temp: Math.round((max + min) / 2),
      condition: wmoToCondition(code),
    };
  } catch {
    return { temp: null, condition: null };
  }
}

function imagePathToFilePath(
  imagePath: string,
  type: 'wardrobe' | 'taste',
): string {
  const filename =
    new URL(imagePath, 'http://x').searchParams.get('file') ?? '';
  return path.join(DATA_PATH, type, path.basename(filename));
}

type ActionResult = { ok: true } | { ok: false; error: string };

type Weather = { temp: number | null; condition: WeatherCondition | null };

export async function prepareUpload(
  formData: FormData,
  type: 'wardrobe' | 'taste',
): Promise<
  | {
      ok: true;
      imagePath: string;
      tags: VisionTagResult;
      date: string | null;
      weather: Weather;
    }
  | { ok: false; error: string }
> {
  let imagePath: string | undefined;
  try {
    const file = formData.get('image') as File;
    const [tagsResult, savedPath, exif] = await Promise.all([
      analyzeImage(file)
        .then((tags) => ({ ok: true as const, tags }))
        .catch(() => ({
          ok: false as const,
          tags: { mood: [], colorTone: [], seasonFeel: [] } as VisionTagResult,
        })),
      saveImageToDisk(file, type),
      extractExif(file),
    ]);
    imagePath = savedPath;
    const lat = exif.lat ?? 35.1796;
    const lon = exif.lon ?? 129.0756;
    const weather: Weather =
      exif.date !== null
        ? await fetchHistoricalWeather(lat, lon, exif.date)
        : { temp: null, condition: null };
    return {
      ok: true,
      imagePath,
      tags: tagsResult.tags,
      date: exif.date,
      weather,
    };
  } catch (e) {
    if (imagePath) await unlink(imagePathToFilePath(imagePath, type)).catch(() => {});
    return {
      ok: false,
      error: e instanceof Error ? e.message : '이미지 저장에 실패했습니다.',
    };
  }
}

export async function saveWardrobeEntry(
  entry: WardrobeEntry,
): Promise<ActionResult> {
  try {
    return await withFileLock('wardrobe', async () => {
      const entries = await readJson<WardrobeEntry>('wardrobe.json');
      entries.unshift(entry);
      await writeJson('wardrobe.json', entries);
      revalidatePath('/wardrobe');
      return { ok: true };
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '저장에 실패했습니다.',
    };
  }
}

export async function saveTasteEntry(entry: TasteEntry): Promise<ActionResult> {
  try {
    return await withFileLock('taste', async () => {
      const entries = await readJson<TasteEntry>('taste.json');
      entries.unshift(entry);
      await writeJson('taste.json', entries);
      revalidatePath('/taste');
      return { ok: true };
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '저장에 실패했습니다.',
    };
  }
}

export async function updateWardrobeEntry(
  entry: WardrobeEntry,
): Promise<ActionResult> {
  try {
    return await withFileLock('wardrobe', async () => {
      const entries = await readJson<WardrobeEntry>('wardrobe.json');
      const idx = entries.findIndex((e) => e.id === entry.id);
      if (idx === -1) return { ok: false, error: '항목을 찾을 수 없습니다.' };
      entries[idx] = entry;
      await writeJson('wardrobe.json', entries);
      revalidatePath('/wardrobe');
      return { ok: true };
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '수정에 실패했습니다.',
    };
  }
}

export async function updateTasteEntry(
  entry: TasteEntry,
): Promise<ActionResult> {
  try {
    return await withFileLock('taste', async () => {
      const entries = await readJson<TasteEntry>('taste.json');
      const idx = entries.findIndex((e) => e.id === entry.id);
      if (idx === -1) return { ok: false, error: '항목을 찾을 수 없습니다.' };
      entries[idx] = entry;
      await writeJson('taste.json', entries);
      revalidatePath('/taste');
      return { ok: true };
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '수정에 실패했습니다.',
    };
  }
}

export async function deleteWardrobeEntry(
  id: string,
  imagePath: string,
): Promise<ActionResult> {
  try {
    return await withFileLock('wardrobe', async () => {
      const entries = await readJson<WardrobeEntry>('wardrobe.json');
      await writeJson(
        'wardrobe.json',
        entries.filter((e) => e.id !== id),
      );
      await unlink(imagePathToFilePath(imagePath, 'wardrobe')).catch(() => {});
      revalidatePath('/wardrobe');
      return { ok: true };
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '삭제에 실패했습니다.',
    };
  }
}

export async function deleteTasteEntry(
  id: string,
  imagePath: string,
): Promise<ActionResult> {
  try {
    return await withFileLock('taste', async () => {
      const entries = await readJson<TasteEntry>('taste.json');
      await writeJson(
        'taste.json',
        entries.filter((e) => e.id !== id),
      );
      await unlink(imagePathToFilePath(imagePath, 'taste')).catch(() => {});
      revalidatePath('/taste');
      return { ok: true };
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '삭제에 실패했습니다.',
    };
  }
}

export async function cancelUpload(
  imagePath: string,
  type: 'wardrobe' | 'taste',
): Promise<void> {
  await unlink(imagePathToFilePath(imagePath, type)).catch(() => {});
}
