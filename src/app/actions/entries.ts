'use server';

import { revalidatePath } from 'next/cache';
import { unlink } from 'fs/promises';
import { readJson, writeJson } from '@/lib/data';
import { withFileLock, imagePathToFilePath, tagsChanged, type ActionResult } from './_utils';
import type { WardrobeEntry, TasteEntry, VisionTagResult } from '@/lib/types';
import { recordCorrection } from './calibration';

export async function saveWardrobeEntry(
  entry: WardrobeEntry,
  originalTags?: VisionTagResult,
): Promise<ActionResult> {
  try {
    await withFileLock('wardrobe', async () => {
      const entries = await readJson<WardrobeEntry>('wardrobe.json');
      entries.unshift(entry);
      await writeJson('wardrobe.json', entries);
    });
    if (originalTags) {
      const finalTags: VisionTagResult = { mood: entry.mood, colorTone: entry.colorTone, seasonFeel: entry.seasonFeel };
      if (tagsChanged(originalTags, finalTags)) {
        await recordCorrection(entry.imagePath, originalTags, finalTags).catch(() => {});
      }
    }
    revalidatePath('/wardrobe');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '저장에 실패했습니다.' };
  }
}

export async function saveTasteEntry(
  entry: TasteEntry,
  originalTags?: VisionTagResult,
): Promise<ActionResult> {
  try {
    await withFileLock('taste', async () => {
      const entries = await readJson<TasteEntry>('taste.json');
      entries.unshift(entry);
      await writeJson('taste.json', entries);
    });
    if (originalTags) {
      const finalTags: VisionTagResult = { mood: entry.mood, colorTone: entry.colorTone, seasonFeel: entry.seasonFeel };
      if (tagsChanged(originalTags, finalTags)) {
        await recordCorrection(entry.imagePath, originalTags, finalTags).catch(() => {});
      }
    }
    revalidatePath('/taste');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '저장에 실패했습니다.' };
  }
}

export async function updateWardrobeEntry(entry: WardrobeEntry): Promise<ActionResult> {
  try {
    return await withFileLock('wardrobe', async () => {
      const entries = await readJson<WardrobeEntry>('wardrobe.json');
      const idx = entries.findIndex((e) => e.id === entry.id);
      if (idx === -1) return { ok: false, error: '항목을 찾을 수 없습니다.' };
      entries[idx] = entry;
      await writeJson('wardrobe.json', entries);
      revalidatePath('/wardrobe');
      return { ok: true };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '수정에 실패했습니다.' };
  }
}

export async function updateTasteEntry(entry: TasteEntry): Promise<ActionResult> {
  try {
    return await withFileLock('taste', async () => {
      const entries = await readJson<TasteEntry>('taste.json');
      const idx = entries.findIndex((e) => e.id === entry.id);
      if (idx === -1) return { ok: false, error: '항목을 찾을 수 없습니다.' };
      entries[idx] = entry;
      await writeJson('taste.json', entries);
      revalidatePath('/taste');
      return { ok: true };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '수정에 실패했습니다.' };
  }
}

export async function deleteWardrobeEntry(id: string, imagePath: string): Promise<ActionResult> {
  try {
    return await withFileLock('wardrobe', async () => {
      const entries = await readJson<WardrobeEntry>('wardrobe.json');
      await writeJson('wardrobe.json', entries.filter((e) => e.id !== id));
      await unlink(imagePathToFilePath(imagePath, 'wardrobe')).catch(() => {});
      revalidatePath('/wardrobe');
      return { ok: true };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '삭제에 실패했습니다.' };
  }
}

export async function deleteTasteEntry(id: string, imagePath: string): Promise<ActionResult> {
  try {
    return await withFileLock('taste', async () => {
      const entries = await readJson<TasteEntry>('taste.json');
      await writeJson('taste.json', entries.filter((e) => e.id !== id));
      await unlink(imagePathToFilePath(imagePath, 'taste')).catch(() => {});
      revalidatePath('/taste');
      return { ok: true };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '삭제에 실패했습니다.' };
  }
}
