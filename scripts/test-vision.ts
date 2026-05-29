import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { VISION_PROMPT, CURRENT_VERSION } from '../src/prompts/index';
import { VISION_MODEL, VISION_TEMPERATURE } from '../src/lib/anthropic';
import type { VisionTagResult } from '../src/lib/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const TEST_DIR = path.join(process.cwd(), 'src/data/test');
const IMAGES_DIR = path.join(TEST_DIR, 'images');
const RESULTS_DIR = path.join(TEST_DIR, 'results');
const EXPECTED_PATH = path.join(TEST_DIR, 'expected.json');
const CALIBRATION_PATH = path.join(process.cwd(), 'src/data/analysis/calibration.txt');

function buildPrompt(): string {
  try {
    const calibration = fs.readFileSync(CALIBRATION_PATH, 'utf-8').trim();
    return calibration ? `${VISION_PROMPT}\n\n[보정 지침]\n${calibration}` : VISION_PROMPT;
  } catch {
    return VISION_PROMPT;
  }
}

type Expected = { filename: string; expected: VisionTagResult };

function diffTags(expected: VisionTagResult, actual: VisionTagResult): string[] {
  const lines: string[] = [];
  for (const key of ['mood', 'seasonFeel'] as const) {
    const missing = expected[key].filter((v) => !(actual[key] as string[]).includes(v));
    const extra = actual[key].filter((v) => !(expected[key] as string[]).includes(v));
    if (missing.length) lines.push(`  ${key}: 누락 [${missing.join(', ')}]`);
    if (extra.length) lines.push(`  ${key}: 추가됨 [${extra.join(', ')}]`);
  }
  if (expected.colorTone !== actual.colorTone)
    lines.push(`  colorTone: 기대 [${expected.colorTone}] 실제 [${actual.colorTone}]`);
  return lines;
}

async function analyzeImage(filename: string): Promise<VisionTagResult> {
  const buffer = fs.readFileSync(path.join(IMAGES_DIR, filename));
  const ext = path.extname(filename).toLowerCase();
  const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';

  const message = await anthropic.messages.create({
    model: VISION_MODEL,
    max_tokens: 256,
    temperature: VISION_TEMPERATURE,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } },
        { type: 'text', text: buildPrompt() },
      ],
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
  return JSON.parse(text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim());
}

async function runOnce(expected: Expected[]) {
  const results = [];
  let passed = 0;

  for (const item of expected) {
    const imagePath = path.join(IMAGES_DIR, item.filename);
    if (!fs.existsSync(imagePath)) {
      console.log(`⚠️  ${item.filename} — 이미지 없음, 건너뜀`);
      continue;
    }
    process.stdout.write(`분석 중: ${item.filename}... `);
    const actual = await analyzeImage(item.filename);
    const diffs = diffTags(item.expected, actual);
    const pass = diffs.length === 0;
    if (pass) passed++;
    results.push({ filename: item.filename, expected: item.expected, actual, pass, diff: diffs });
    console.log(pass ? '✅ 통과' : '❌ 실패');
    if (!pass) diffs.forEach((d) => console.log(d));
  }

  return { results, passed, total: results.length };
}

async function runRepeat(expected: Expected[], n: number) {
  console.log(`같은 이미지 ${n}회 반복 실행 (재현성 확인)\n`);

  for (const item of expected) {
    const imagePath = path.join(IMAGES_DIR, item.filename);
    if (!fs.existsSync(imagePath)) continue;

    console.log(`[${item.filename}]`);
    const outputs: VisionTagResult[] = [];

    for (let i = 0; i < n; i++) {
      process.stdout.write(`  ${i + 1}회... `);
      const result = await analyzeImage(item.filename);
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

  const expected: Expected[] = JSON.parse(fs.readFileSync(EXPECTED_PATH, 'utf-8'));

  if (repeatN) {
    await runRepeat(expected, repeatN);
    return;
  }

  console.log(`버전: ${CURRENT_VERSION}\n`);
  const { results, passed, total } = await runOnce(expected);

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().split('T')[0];
  const outPath = path.join(RESULTS_DIR, `${CURRENT_VERSION}_${timestamp}.json`);
  const totalDiffs = results.reduce((sum, r) => sum + r.diff.length, 0);
  fs.writeFileSync(outPath, JSON.stringify({ version: CURRENT_VERSION, timestamp, passed, total, totalDiffs, results }, null, 2));

  console.log(`\n결과: ${passed}/${total} 통과, diff ${totalDiffs}개 → ${outPath}`);
}

main().catch(console.error);
