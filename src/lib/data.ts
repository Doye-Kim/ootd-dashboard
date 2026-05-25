import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src/data/analysis');

export async function readJson<T>(filename: string): Promise<T[]> {
  try {
    const content = await readFile(path.join(DATA_DIR, filename), 'utf-8');
    return content.trim() ? JSON.parse(content) : [];
  } catch {
    return [];
  }
}

export async function writeJson<T>(filename: string, data: T[]): Promise<void> {
  await writeFile(
    path.join(DATA_DIR, filename),
    JSON.stringify(data, null, 2),
    'utf-8',
  );
}
