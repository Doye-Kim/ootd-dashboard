import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { VISION_PROMPT, CURRENT_VERSION } from '../src/prompts/index';
import { vision_v1 } from '../src/prompts/versions/vision_v1';
import { VISION_MODEL, VISION_TEMPERATURE } from '../src/lib/anthropic';
import { DATA_PATH } from '../src/app/actions/_utils';
import { readCalibration } from '../src/app/actions/calibration';
import type { VisionTagResult } from '../src/lib/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const TEST_DIR = path.join(process.cwd(), 'src/data/test');
const IMAGES_DIR = path.join(TEST_DIR, 'images');
const RESULTS_DIR = path.join(TEST_DIR, 'results');
const EXPECTED_PATH = path.join(TEST_DIR, 'expected.json');

const baseArg = process.argv.slice(2).find((a) => a.startsWith('--base='));
const baseVersion = baseArg ? baseArg.split('=')[1] : null;
const runLabel = baseVersion ?? CURRENT_VERSION;

function readCalibrationVersion(version: string): string {
  return fs
    .readFileSync(
      path.join(
        process.cwd(),
        `src/data/analysis/versions/calibration_${version}.txt`,
      ),
      'utf-8',
    )
    .trim();
}

async function buildPrompt(): Promise<string> {
  if (baseVersion === 'v1') {
    const calibration = readCalibrationVersion('v1');
    return calibration
      ? `${vision_v1}\n\n[보정 지침]\n${calibration}`
      : vision_v1;
  }
  if (baseVersion === 'v3-calib1') {
    const calibration = readCalibrationVersion('v1');
    return calibration
      ? `${VISION_PROMPT}\n\n[보정 지침]\n${calibration}`
      : VISION_PROMPT;
  }
  const calibration = await readCalibration();
  return calibration
    ? `${VISION_PROMPT}\n\n[보정 지침]\n${calibration}`
    : VISION_PROMPT;
}

type Expected = {
  filename: string;
  type?: 'wardrobe' | 'taste';
  expected: VisionTagResult;
};

function resolveImagePath(item: Expected): string {
  return item.type
    ? path.join(DATA_PATH, item.type, item.filename)
    : path.join(IMAGES_DIR, item.filename);
}

function diffTags(
  expected: VisionTagResult,
  actual: VisionTagResult,
): string[] {
  const lines: string[] = [];
  for (const key of ['mood', 'seasonFeel'] as const) {
    const missing = expected[key].filter(
      (v) => !(actual[key] as string[]).includes(v),
    );
    const extra = actual[key].filter(
      (v) => !(expected[key] as string[]).includes(v),
    );
    if (missing.length) lines.push(`  ${key}: 누락 [${missing.join(', ')}]`);
    if (extra.length) lines.push(`  ${key}: 추가됨 [${extra.join(', ')}]`);
  }
  if (expected.colorTone !== actual.colorTone)
    lines.push(
      `  colorTone: 기대 [${expected.colorTone}] 실제 [${actual.colorTone}]`,
    );
  return lines;
}

async function analyzeImage(filePath: string): Promise<VisionTagResult> {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';
  const prompt = await buildPrompt();

  const message = await anthropic.messages.create({
    model: VISION_MODEL,
    max_tokens: 256,
    temperature: VISION_TEMPERATURE,
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
          { type: 'text', text: prompt },
        ],
      },
    ],
  });

  const text =
    message.content[0].type === 'text' ? message.content[0].text.trim() : '';
  return JSON.parse(
    text
      .replace(/^```[a-z]*\n?/i, '')
      .replace(/\n?```$/, '')
      .trim(),
  );
}

async function runOnce(expected: Expected[]) {
  const results = [];
  let passed = 0;

  for (const item of expected) {
    const imagePath = resolveImagePath(item);
    if (!fs.existsSync(imagePath)) {
      console.log(`⚠️  ${item.filename} — 이미지 없음, 건너뜀`);
      continue;
    }
    process.stdout.write(`분석 중: ${item.filename}... `);
    const actual = await analyzeImage(imagePath);
    const diffs = diffTags(item.expected, actual);
    const pass = diffs.length === 0;
    if (pass) passed++;
    results.push({
      filename: item.filename,
      expected: item.expected,
      actual,
      pass,
      diff: diffs,
    });
    console.log(pass ? '✅ 통과' : '❌ 실패');
    if (!pass) diffs.forEach((d) => console.log(d));
  }

  return { results, passed, total: results.length };
}

async function runRepeat(expected: Expected[], n: number) {
  console.log(`같은 이미지 ${n}회 반복 실행 (재현성 확인)\n`);

  for (const item of expected) {
    const imagePath = resolveImagePath(item);
    if (!fs.existsSync(imagePath)) continue;

    console.log(`[${item.filename}]`);
    const outputs: VisionTagResult[] = [];

    for (let i = 0; i < n; i++) {
      process.stdout.write(`  ${i + 1}회... `);
      const result = await analyzeImage(imagePath);
      outputs.push(result);
      console.log(JSON.stringify(result));
    }

    const allSame = outputs.every(
      (o) => JSON.stringify(o) === JSON.stringify(outputs[0]),
    );
    console.log(allSame ? '  ✅ 결과 일치\n' : '  ❌ 결과 불일치\n');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const repeatArg = args.find((a) => a.startsWith('--repeat='));
  const repeatN = repeatArg ? parseInt(repeatArg.split('=')[1], 10) : null;

  const expected: Expected[] = JSON.parse(
    fs.readFileSync(EXPECTED_PATH, 'utf-8'),
  );

  if (repeatN) {
    await runRepeat(expected, repeatN);
    return;
  }

  console.log(`버전: ${runLabel}\n`);
  const { results, passed, total } = await runOnce(expected);

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().split('T')[0];
  const outPath = path.join(RESULTS_DIR, `${runLabel}_${timestamp}.json`);
  const totalDiffs = results.reduce((sum, r) => sum + r.diff.length, 0);
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      { version: runLabel, timestamp, passed, total, totalDiffs, results },
      null,
      2,
    ),
  );

  console.log(
    `\n결과: ${passed}/${total} 통과, diff ${totalDiffs}개 → ${outPath}`,
  );
}

main().catch(console.error);
