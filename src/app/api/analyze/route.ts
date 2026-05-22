import { anthropic } from '@/lib/anthropic';
import { VISION_PROMPT } from '@/lib/prompts';
import type { ApiResponse, VisionTagResult } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const heicConvert = require('heic-convert') as (opts: {
  buffer: Buffer;
  format: 'JPEG' | 'PNG';
  quality?: number;
}) => Promise<ArrayBuffer>;

const HEIC_TYPES = new Set(['image/heic', 'image/heif']);

async function toJpeg(buffer: Buffer): Promise<Buffer> {
  return Buffer.from(await heicConvert({ buffer, format: 'JPEG', quality: 0.9 }));
}

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const imageFile = formData.get('image');

  if (!(imageFile instanceof File)) {
    return Response.json(
      { error: '이미지 파일이 필요합니다.' } satisfies ApiResponse<VisionTagResult>,
      { status: 400 }
    );
  }

  const isHeic =
    HEIC_TYPES.has(imageFile.type) ||
    imageFile.name.toLowerCase().endsWith('.heic') ||
    imageFile.name.toLowerCase().endsWith('.heif');

  const rawBuffer = Buffer.from(await imageFile.arrayBuffer() as ArrayBuffer);
  const buffer = isHeic ? await toJpeg(rawBuffer) : rawBuffer;
  const mediaType = isHeic
    ? ('image/jpeg' as const)
    : ((imageFile.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp');

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

  const rawText =
    message.content[0].type === 'text' ? message.content[0].text.trim() : '';

  let result: VisionTagResult;
  try {
    result = JSON.parse(rawText);
  } catch {
    return Response.json(
      { error: 'Claude 응답 파싱 실패' } satisfies ApiResponse<VisionTagResult>,
      { status: 500 }
    );
  }

  return Response.json({ data: result } satisfies ApiResponse<VisionTagResult>);
}
