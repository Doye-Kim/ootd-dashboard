import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('sharp', () => {
  const mockInstance = {
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('converted-jpeg')),
  };
  return { default: vi.fn(() => mockInstance) };
});

vi.mock('@/lib/anthropic', () => ({
  anthropic: {
    messages: {
      create: vi.fn(),
    },
  },
}));

import sharp from 'sharp';
import { anthropic } from '@/lib/anthropic';
import { POST } from './route';

const mockCreate = vi.mocked(anthropic.messages.create);

function makeRequest(file?: File): Request {
  const formData = new FormData();
  if (file) formData.append('image', file);
  return new Request('http://localhost/api/analyze', {
    method: 'POST',
    body: formData,
  });
}

function mockClaudeResponse(tags: object) {
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(tags) }],
  } as never);
}

describe('POST /api/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('이미지 없으면 400', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('JPEG 이미지 → sharp 미호출, Claude에 image/jpeg로 전달, 200 반환', async () => {
    mockClaudeResponse({ mood: ['CASUAL'], colorTone: ['NEUTRAL'], seasonFeel: ['SPRING'] });

    const file = new File([Buffer.from('fake-jpeg')], 'outfit.jpg', { type: 'image/jpeg' });
    const res = await POST(makeRequest(file));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(sharp).not.toHaveBeenCalled();
    const call = mockCreate.mock.calls[0][0];
    const imageContent = call.messages[0].content[0] as { source: { media_type: string } };
    expect(imageContent.source.media_type).toBe('image/jpeg');
  });

  it('HEIC 파일 → sharp로 변환 후 Claude에 image/jpeg로 전달', async () => {
    mockClaudeResponse({ mood: [], colorTone: [], seasonFeel: [] });

    const file = new File([Buffer.from('fake-heic')], 'outfit.heic', { type: 'image/heic' });
    await POST(makeRequest(file));

    expect(sharp).toHaveBeenCalled();
    const call = mockCreate.mock.calls[0][0];
    const imageContent = call.messages[0].content[0] as { source: { media_type: string } };
    expect(imageContent.source.media_type).toBe('image/jpeg');
  });

  it('확장자가 .heic이면 MIME 타입 무관하게 변환', async () => {
    mockClaudeResponse({ mood: [], colorTone: [], seasonFeel: [] });

    const file = new File([Buffer.from('fake-heic')], 'photo.heic', { type: '' });
    await POST(makeRequest(file));

    expect(sharp).toHaveBeenCalled();
  });

  it('Claude 응답이 JSON이 아니면 500', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '이건 JSON이 아닙니다' }],
    } as never);

    const file = new File([Buffer.from('fake-jpeg')], 'outfit.jpg', { type: 'image/jpeg' });
    const res = await POST(makeRequest(file));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
