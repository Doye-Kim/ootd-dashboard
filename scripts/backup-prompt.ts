import fs from 'fs';
import path from 'path';

const VERSIONS_DIR = path.join(process.cwd(), 'src/prompts/versions');
const INDEX_PATH = path.join(process.cwd(), 'src/prompts/index.ts');

if (!fs.existsSync(INDEX_PATH)) process.exit(0);

const indexContent = fs.readFileSync(INDEX_PATH, 'utf-8');
const versionMatch = indexContent.match(/CURRENT_VERSION.*=.*'(v\d+)'/);
if (!versionMatch) process.exit(0);

const current = versionMatch[1];
const num = parseInt(current.replace('v', ''), 10);
const next = `v${num + 1}`;
const nextPath = path.join(VERSIONS_DIR, `vision_${next}.ts`);

if (!fs.existsSync(nextPath)) {
  const currentPath = path.join(VERSIONS_DIR, `vision_${current}.ts`);
  if (fs.existsSync(currentPath)) {
    const content = fs.readFileSync(currentPath, 'utf-8').replace(
      new RegExp(`vision_${current}`, 'g'),
      `vision_${next}`,
    );
    fs.writeFileSync(nextPath, content);
    console.log(`[prompt-backup] ${next} 파일 생성됨 → 내용 수정 후 index.ts CURRENT_VERSION을 '${next}'로 변경하세요`);
  }
}
