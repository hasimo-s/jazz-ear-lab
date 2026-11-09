import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AttemptRecord } from '../engine/stats';

interface JelDB extends DBSchema {
  attempts: {
    key: string;
    value: AttemptRecord;
    indexes: { byTimestamp: number; byCategory: string; byItemKey: string };
  };
}

const DB_NAME = 'jazz-ear-lab';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<JelDB>> | null = null;

function db() {
  dbPromise ??= openDB<JelDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const store = database.createObjectStore('attempts', { keyPath: 'id' });
      store.createIndex('byTimestamp', 'timestamp');
      store.createIndex('byCategory', 'category');
      store.createIndex('byItemKey', 'itemKey');
    },
  });
  return dbPromise;
}

export async function addAttempt(a: AttemptRecord): Promise<void> {
  await (await db()).put('attempts', a);
}

export async function getAllAttempts(): Promise<AttemptRecord[]> {
  return (await db()).getAllFromIndex('attempts', 'byTimestamp');
}

export async function clearAttempts(): Promise<void> {
  await (await db()).clear('attempts');
}

/** テスト用: 接続をリセット */
export function _resetForTests() {
  dbPromise = null;
}
