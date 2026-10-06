import type { Prompt } from "./types";

const DB_NAME = "prompt-calendar";
const DB_VERSION = 1;

export type StoredLibrary = {
  version: 1;
  timezone: string;
  sourceName: string;
  savedAt: string;
  prompts: Prompt[];
};

type MetaRecord = {
  version: 1;
  timezone: string;
  sourceName: string;
  savedAt: string;
  months: string[];
  promptCount: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      if (!db.objectStoreNames.contains("months")) db.createObjectStore("months");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open local storage."));
  });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Local storage request failed."));
  });
}

export async function loadLibrary(): Promise<StoredLibrary | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  try {
    const meta = await requestToPromise<MetaRecord | undefined>(
      db.transaction("meta", "readonly").objectStore("meta").get("current"),
    );
    if (!meta || meta.version !== 1 || !Array.isArray(meta.months)) return null;
    const tx = db.transaction("months", "readonly");
    const store = tx.objectStore("months");
    const lists = await Promise.all(meta.months.map((month) => requestToPromise<Prompt[] | undefined>(store.get(month))));
    const prompts = lists.flatMap((list) => list ?? []);
    prompts.sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
    return {
      version: 1,
      timezone: meta.timezone,
      sourceName: meta.sourceName,
      savedAt: meta.savedAt,
      prompts,
    };
  } finally {
    db.close();
  }
}

export async function saveLibrary(input: {
  prompts: Prompt[];
  timezone: string;
  sourceName: string;
}): Promise<void> {
  const db = await openDb();
  try {
    const byMonth = new Map<string, Prompt[]>();
    for (const prompt of input.prompts) {
      const month = prompt.date.slice(0, 7);
      const list = byMonth.get(month);
      if (list) list.push(prompt);
      else byMonth.set(month, [prompt]);
    }
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["meta", "months"], "readwrite");
      const months = tx.objectStore("months");
      const meta = tx.objectStore("meta");
      months.clear();
      for (const [month, list] of byMonth) months.put(list, month);
      const record: MetaRecord = {
        version: 1,
        timezone: input.timezone,
        sourceName: input.sourceName,
        savedAt: new Date().toISOString(),
        months: [...byMonth.keys()].sort(),
        promptCount: input.prompts.length,
      };
      meta.put(record, "current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not save the calendar in this browser."));
      tx.onabort = () => reject(tx.error ?? new Error("Could not save the calendar in this browser."));
    });
  } finally {
    db.close();
  }
}

export async function clearLibrary(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Could not clear local storage."));
    req.onblocked = () => resolve();
  });
}

export function storageErrorNote(err: unknown): string {
  if (err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22)) {
    return "This browser would not store the calendar (storage is full). It stays in memory until you refresh.";
  }
  return "Could not save a local copy. The calendar stays in memory until you refresh.";
}
