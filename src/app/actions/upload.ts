'use server';

import path from 'path';
import exifr from 'exifr';
import { randomUUID } from 'crypto';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { VISION_PROMPT } from '@/lib/prompts';
import { anthropic } from '@/lib/anthropic';
import { DATA_PATH, imagePathToFilePath } from './_utils';
import { readCalibration } from './calibration';
import type { VisionTagResult, Weather, WeatherCondition } from '@/lib/types';

// heic-convert has no type declarations
// eslint-disable-next-line @typescript-eslint/no-require-imports
const heicConvert = require('heic-convert') as (opts: {
  buffer: Buffer;
  format: 'JPEG' | 'PNG';
  quality?: number;
}) => Promise<ArrayBuffer>;

const HEIC_TYPES = new Set(['image/heic', 'image/heif']);

function isHeic(file: File): boolean {
  return (
    HEIC_TYPES.has(file.type) ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  );
}

async function toJpeg(buf: Buffer): Promise<Buffer> {
  return Buffer.from(await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.9 }));
}

async function analyzeImage(file: File, raw: Buffer): Promise<VisionTagResult> {
  const heic = isHeic(file);
  const buffer = heic ? await toJpeg(raw) : raw;
  const mediaType = heic
    ? ('image/jpeg' as const)
    : ((file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp');

  const calibration = await readCalibration();
  const prompt = calibration ? `${VISION_PROMPT}\n\n[보정 지침]\n${calibration}` : VISION_PROMPT;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } },
        { type: 'text', text: prompt },
      ],
    }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
  if (!responseText) throw new Error('AI 응답이 비어 있습니다.');
  const text = responseText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
  return JSON.parse(text);
}

async function saveImageToDisk(file: File, raw: Buffer, type: 'wardrobe' | 'taste'): Promise<string> {
  const dir = path.join(DATA_PATH, type);
  await mkdir(dir, { recursive: true });

  const heic = isHeic(file);
  const ext = heic ? 'jpg' : file.name.split('.').pop() ?? 'jpg';
  const buffer = heic ? await toJpeg(raw) : raw;

  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, filename), buffer);
  return `/api/image?type=${type}&file=${filename}`;
}

async function extractExif(raw: Buffer): Promise<{ date: string | null; lat: number | null; lon: number | null }> {
  try {
    const exif = await exifr.parse(raw, true);
    if (!exif) return { date: null, lat: null, lon: null };
    const date = exif.DateTimeOriginal instanceof Date
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
  if (code <= 48) return 'OTHER';
  return 'PRECIPITATION';
}

async function fetchHistoricalWeather(lat: number, lon: number, date: string): Promise<Weather> {
  try {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return { temp: null, condition: [] };
    const json = await res.json();
    return {
      temp: Math.round((json.daily.temperature_2m_max[0] + json.daily.temperature_2m_min[0]) / 2),
      condition: [wmoToCondition(json.daily.weathercode[0])],
    };
  } catch {
    return { temp: null, condition: [] };
  }
}

export async function prepareUpload(
  formData: FormData,
  type: 'wardrobe' | 'taste',
): Promise<
  | { ok: true; id: string; imagePath: string; tags: VisionTagResult; tagsOk: boolean; date: string | null; weather: Weather }
  | { ok: false; error: string }
> {
  let imagePath: string | undefined;
  try {
    const file = formData.get('image') as File;
    const raw = Buffer.from((await file.arrayBuffer()) as ArrayBuffer);
    const [tagsResult, savedPath, exif] = await Promise.all([
      analyzeImage(file, raw)
        .then((tags) => ({ ok: true as const, tags }))
        .catch((e) => {
          console.error('[analyzeImage 실패]', e instanceof Error ? e.message : e);
          return { ok: false as const, tags: { mood: [], colorTone: [], seasonFeel: [] } as VisionTagResult };
        }),
      saveImageToDisk(file, raw, type),
      extractExif(raw),
    ]);
    imagePath = savedPath;
    const lat = exif.lat ?? 35.1796;
    const lon = exif.lon ?? 129.0756;
    const weather: Weather = exif.date !== null
      ? await fetchHistoricalWeather(lat, lon, exif.date)
      : { temp: null, condition: [] };
    return { ok: true, id: randomUUID(), imagePath, tags: tagsResult.tags, tagsOk: tagsResult.ok, date: exif.date, weather };
  } catch (e) {
    if (imagePath) await unlink(imagePathToFilePath(imagePath, type)).catch(() => {});
    return { ok: false, error: e instanceof Error ? e.message : '이미지 저장에 실패했습니다.' };
  }
}

export async function cancelUpload(imagePath: string, type: 'wardrobe' | 'taste'): Promise<void> {
  await unlink(imagePathToFilePath(imagePath, type)).catch(() => {});
}
