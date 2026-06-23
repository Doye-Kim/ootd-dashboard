'use server';

import path from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { anthropic, VISION_MODEL } from '@/lib/anthropic';
import { readJson, writeJson } from '@/lib/data';
import { VISION_PROMPT } from '@/lib/prompts';
import { withFileLock, imagePathToFilePath, type ActionResult } from './_utils';
import type { VisionTagResult, Correction } from '@/lib/types';

const CALIBRATION_PATH = path.join(
  process.cwd(),
  'src/data/analysis/calibration.json',
);

type CalibrationCategory = 'mood' | 'colorTone' | 'seasonFeel';
const CATEGORIES: CalibrationCategory[] = ['mood', 'colorTone', 'seasonFeel'];
type CalibrationStore = Record<CalibrationCategory, string[]>;

async function readCalibrationStore(): Promise<CalibrationStore> {
  try {
    const raw = JSON.parse(await readFile(CALIBRATION_PATH, 'utf-8'));
    return {
      mood: raw.mood ?? [],
      colorTone: raw.colorTone ?? [],
      seasonFeel: raw.seasonFeel ?? [],
    };
  } catch {
    return { mood: [], colorTone: [], seasonFeel: [] };
  }
}

function formatCalibrationStore(store: CalibrationStore): string {
  return CATEGORIES.filter((cat) => store[cat].length > 0)
    .map((cat) => `[${cat} 판단 보정]\n${store[cat].map((t) => `- ${t}`).join('\n')}`)
    .join('\n\n');
}

export async function readCalibration(): Promise<string> {
  return formatCalibrationStore(await readCalibrationStore());
}

export async function recordCorrection(
  imagePath: string,
  original: VisionTagResult,
  corrected: VisionTagResult,
): Promise<void> {
  let count = 0;
  await withFileLock('corrections', async () => {
    const list = await readJson<Correction>('corrections.json');
    list.unshift({
      imagePath,
      original,
      corrected,
      timestamp: new Date().toISOString().split('T')[0],
    });
    const trimmed = list.slice(0, 20);
    await writeJson('corrections.json', trimmed);
    count = trimmed.length;
  });
  if (count > 0 && count % 5 === 0) {
    generateCalibration().catch(console.error);
  }
}

export async function generateCalibration(): Promise<ActionResult> {
  let toProcess: Correction[] = [];
  await withFileLock('corrections', async () => {
    const all = await readJson<Correction>('corrections.json');
    toProcess = all.slice(0, 5);
    await writeJson('corrections.json', all.slice(5));
  });
  if (toProcess.length === 0)
    return { ok: false, error: '교정 데이터가 없습니다.' };
  const corrections = toProcess;

  const store = await readCalibrationStore();

  type ContentBlock =
    | {
        type: 'image';
        source: {
          type: 'base64';
          media_type: 'image/jpeg' | 'image/png';
          data: string;
        };
      }
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
      const mediaType =
        ext === 'png' ? ('image/png' as const) : ('image/jpeg' as const);
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: buffer.toString('base64'),
        },
      });
      content.push({
        type: 'text',
        text: `AI 원본: mood=[${correction.original.mood}], colorTone=[${correction.original.colorTone}], seasonFeel=[${correction.original.seasonFeel}] → 사용자 교정: mood=[${correction.corrected.mood}], colorTone=[${correction.corrected.colorTone}], seasonFeel=[${correction.corrected.seasonFeel}]`,
      });
    } catch {
      // 이미지 파일 없으면 스킵
    }
  }

  const numbered = (items: string[]) =>
    items.length ? items.map((t, i) => `${i + 1}. ${t}`).join('\n') : '없음';

  content.push({
    type: 'text',
    text: `위 코디 사진들과 사용자 교정 태그를 보고, 카테고리별 보정 지침을 갱신해줘.

[기본 프롬프트]
${VISION_PROMPT}

[기존 mood 지침]
${numbered(store.mood)}

[기존 colorTone 지침]
${numbered(store.colorTone)}

[기존 seasonFeel 지침]
${numbered(store.seasonFeel)}

조건:
- 기본 프롬프트의 태그 정의와 판단 규칙을 위배하지 말 것
- 번호로 언급하지 않은 기존 항목은 그대로 유지되니 다시 쓰지 말 것
- "수정"은 새로운 사례와 명백히 모순되는 항목에만 적용할 것
- "추가"는 기존 지침에 없던 새로운 패턴일 때만 적을 것
- 마크다운(#, **, -, 등) 사용하지 말 것
- mood, colorTone, seasonFeel 세 카테고리 모두 아래와 똑같은 형식으로 빠짐없이 반환 (대괄호 포함)
- 각 카테고리의 "수정"은 없으면 "없음", 있으면 한 줄에 하나씩 "번호 → 새 문장"
- 각 카테고리의 "추가"는 없으면 "없음", 있으면 한 줄에 하나씩 새 문장

[분석]
각 사진에 대해 AI가 어떻게 판단했을지, 사용자가 왜 수정했을지 추론.

[mood]
수정:
추가:

[colorTone]
수정:
추가:

[seasonFeel]
수정:
추가:`,
  });

  const message = await anthropic.messages.create({
    model: VISION_MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content }],
  });

  const fullText =
    message.content[0].type === 'text' ? message.content[0].text.trim() : '';
  if (!fullText) return { ok: false, error: 'AI 응답이 비어 있습니다.' };

  function applyCategory(items: string[], category: CalibrationCategory): string[] {
    const sectionMatch = fullText.match(
      new RegExp(`\\[${category}\\]([\\s\\S]*?)(?=\\n\\[|$)`),
    );
    const section = sectionMatch?.[1] ?? '';
    const modBlock = section.match(/수정:([\s\S]*?)추가:/)?.[1] ?? '';
    const addBlock = section.match(/추가:([\s\S]*)/)?.[1] ?? '';

    const updated = [...items];
    for (const line of modBlock.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const m = line.match(/^(\d+)\s*→\s*(.+)$/);
      if (m) {
        const idx = parseInt(m[1], 10) - 1;
        if (idx >= 0 && idx < updated.length) updated[idx] = m[2].trim();
      }
    }
    const additions = addBlock
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && l !== '없음');
    return [...updated, ...additions];
  }

  const newStore: CalibrationStore = {
    mood: applyCategory(store.mood, 'mood'),
    colorTone: applyCategory(store.colorTone, 'colorTone'),
    seasonFeel: applyCategory(store.seasonFeel, 'seasonFeel'),
  };

  const logPath = path.join(
    process.cwd(),
    'src/data/analysis/calibration_log.txt',
  );
  const logEntry = `\n${'='.repeat(
    60,
  )}\n${new Date().toISOString()}\n${'='.repeat(60)}\n${fullText}\n`;
  await writeFile(logPath, logEntry, { flag: 'a', encoding: 'utf-8' });

  await writeFile(CALIBRATION_PATH, JSON.stringify(newStore, null, 2), 'utf-8');

  const calibration = formatCalibrationStore(newStore);

  try {
    const indexPath = path.join(process.cwd(), 'src/prompts/index.ts');
    const indexContent = await readFile(indexPath, 'utf-8');
    const match = indexContent.match(/CURRENT_VERSION = '(v\d+)'/);
    if (match) {
      const current = match[1];
      const next = `v${parseInt(current.slice(1)) + 1}`;
      const versionsDir = path.join(
        process.cwd(),
        'src/data/analysis/versions',
      );
      await mkdir(versionsDir, { recursive: true });
      await writeFile(
        path.join(versionsDir, `calibration_${next}.txt`),
        calibration,
        'utf-8',
      );
      await writeFile(
        indexPath,
        indexContent.replace(
          `CURRENT_VERSION = '${current}'`,
          `CURRENT_VERSION = '${next}'`,
        ),
        'utf-8',
      );
    }
  } catch {}

  return { ok: true };
}
