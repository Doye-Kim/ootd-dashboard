import { readFile } from 'fs/promises';
import path from 'path';
import type { NextRequest } from 'next/server';

const DATA_PATH = process.env.DATA_PATH!;

const ALLOWED_TYPES = new Set(['wardrobe', 'taste']);
const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type');
  const file = searchParams.get('file');

  if (!type || !file || !ALLOWED_TYPES.has(type)) {
    return new Response('Bad Request', { status: 400 });
  }

  // 경로 탈출(../) 방지
  const filename = path.basename(file);
  const filePath = path.join(DATA_PATH, type, filename);

  try {
    const buffer = await readFile(filePath);
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const contentType = MIME[ext] ?? 'application/octet-stream';
    return new Response(buffer, { headers: { 'Content-Type': contentType } });
  } catch {
    return new Response('Not Found', { status: 404 });
  }
}
