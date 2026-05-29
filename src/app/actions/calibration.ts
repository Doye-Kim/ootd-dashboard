'use server';

import path from 'path';
import { readFile, writeFile } from 'fs/promises';
import { anthropic } from '@/lib/anthropic';
import { readJson, writeJson } from '@/lib/data';
import { VISION_PROMPT } from '@/lib/prompts';
import { withFileLock, imagePathToFilePath, type ActionResult } from './_utils';
import type { VisionTagResult, Correction } from '@/lib/types';

const CALIBRATION_PATH = path.join(process.cwd(), 'src/data/analysis/calibration.txt');

export async function readCalibration(): Promise<string> {
  try {
    return (await readFile(CALIBRATION_PATH, 'utf-8')).trim();
  } catch {
    return '';
  }
}

export async function recordCorrection(imagePath: string, original: VisionTagResult, corrected: VisionTagResult): Promise<void> {
  let count = 0;
  await withFileLock('corrections', async () => {
    const list = await readJson<Correction>('corrections.json');
    list.unshift({ imagePath, original, corrected, timestamp: new Date().toISOString().split('T')[0] });
    const trimmed = list.slice(0, 20);
    await writeJson('corrections.json', trimmed);
    count = trimmed.length;
  });
  if (count > 0 && count % 5 === 0) {
    generateCalibration().catch(() => {});
  }
}

export async function generateCalibration(): Promise<ActionResult> {
  let toProcess: Correction[] = [];
  await withFileLock('corrections', async () => {
    const all = await readJson<Correction>('corrections.json');
    toProcess = all.slice(0, 5);
    await writeJson('corrections.json', all.slice(5));
  });
  if (toProcess.length === 0) return { ok: false, error: '교정 데이터가 없습니다.' };
  const corrections = toProcess;

  const current = await readCalibration();

  type ContentBlock =
    | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png'; data: string } }
    | { type: 'text'; text: string };

  const content: ContentBlock[] = [];

  for (const correction of corrections.slice(0, 5)) {
    const url = new URL(correction.imagePath, 'http://x');
    const type = url.searchParams.get('type') as 'wardrobe' | 'taste' | null;
    if (!type) continue;
    try {
      const filePath = imagePathToFilePath(correction.imagePath, type);
      const buffer = await readFile(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mediaType = ext === 'png' ? 'image/png' as const : 'image/jpeg' as const;
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } });
      content.push({ type: 'text', text: `AI 원본: mood=[${correction.original.mood}], colorTone=[${correction.original.colorTone}], seasonFeel=[${correction.original.seasonFeel}] → 사용자 교정: mood=[${correction.corrected.mood}], colorTone=[${correction.corrected.colorTone}], seasonFeel=[${correction.corrected.seasonFeel}]` });
    } catch {
      // 이미지 파일 없으면 스킵
    }
  }

  content.push({
    type: 'text',
    text: `위 코디 사진들과 사용자 교정 태그를 보고, 앞으로 비슷한 사진을 더 정확하게 태깅하기 위한 보정 지침을 한국어로 작성해줘.

[기본 프롬프트]
${VISION_PROMPT}

[기존 보정 지침]
${current || '없음'}

조건:
- 기본 프롬프트의 태그 정의와 판단 규칙을 위배하지 말 것
- 기존 보정 지침을 참고해 일관성 유지
- 마크다운(#, **, -, 등) 사용하지 말 것
- 아래 형식 그대로 반환 (대괄호 포함)

[분석]
각 사진에 대해 AI가 어떻게 판단했을지, 사용자가 왜 수정했을지 추론.

[지침]
3줄 이내, 각 줄은 완성된 문장.`,
  });

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content }],
  });

  const fullText = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
  if (!fullText) return { ok: false, error: 'AI 응답이 비어 있습니다.' };

  const calibration = fullText.split(/\[지침\]|#{1,3}\s*지침/)[1]?.trim() ?? '';
  if (!calibration) return { ok: false, error: '지침 섹션을 파싱할 수 없습니다.' };

  const logPath = path.join(process.cwd(), 'src/data/analysis/calibration_log.txt');
  const logEntry = `\n${'='.repeat(60)}\n${new Date().toISOString()}\n${'='.repeat(60)}\n${fullText}\n`;
  await writeFile(logPath, logEntry, { flag: 'a', encoding: 'utf-8' });

  await writeFile(CALIBRATION_PATH, calibration, 'utf-8');
  return { ok: true };
}
