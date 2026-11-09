import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addAttempt, clearAttempts, getAllAttempts } from './db';
import type { AttemptRecord } from '../engine/stats';

const rec = (id: string, timestamp: number): AttemptRecord => ({
  id, sessionId: 's', questionId: 'q', seed: 1, category: 'interval', difficulty: 'beginner',
  itemKey: 'interval:M3:ascending', answerId: 'M3', chosenId: 'M3', correct: true, playCount: 1, responseMs: 500, timestamp,
});

describe('IndexedDB storage', () => {
  it('保存・時系列取得・消去', async () => {
    await addAttempt(rec('b', 2));
    await addAttempt(rec('a', 1));
    expect((await getAllAttempts()).map((a) => a.id)).toEqual(['a', 'b']);
    await clearAttempts();
    expect(await getAllAttempts()).toEqual([]);
  });
});
