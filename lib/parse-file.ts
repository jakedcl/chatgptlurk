import { Unzip, UnzipInflate, type UnzipFile } from "fflate";
import { promptsFromConversation, sortPrompts, type ExtractStats } from "./extract";
import { friendlyError } from "./format";
import { createConversationSplitter } from "./split-json";
import { assertTimezone } from "./time";
import type { ParseResult, Progress, Prompt } from "./types";

export type ConversationKind = "full" | "partial";

export function conversationKind(name: string): ConversationKind | null {
  const base = name.split(/[/\\]/).pop()?.toLowerCase() ?? "";
  if (base === "full-conversations.json") return "full";
  if (base === "conversations.json" || /^conversations-\d+\.json$/.test(base)) return "partial";
  return null;
}

function emptyStats(): ExtractStats {
  return { conversations: 0, skippedHidden: 0, skippedEmpty: 0, skippedNoTime: 0 };
}

function dedupeIds(prompts: Prompt[]): Prompt[] {
  const seen = new Set<string>();
  return prompts.map((p) => {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      return p;
    }
    let n = 2;
    let id = `${p.id}:${n}`;
    while (seen.has(id)) {
      n++;
      id = `${p.id}:${n}`;
    }
    seen.add(id);
    return { ...p, id };
  });
}

function ingest(json: string, tz: string, stats: ExtractStats, prompts: Prompt[]) {
  let conv: unknown;
  try {
    conv = JSON.parse(json);
  } catch {
    throw new Error("A conversation in this export could not be parsed. The file may be incomplete.");
  }
  prompts.push(...promptsFromConversation(conv, tz, stats));
}

type Bucket = { prompts: Prompt[]; stats: ExtractStats };

function feedJson(
  bytes: Uint8Array,
  final: boolean,
  decoder: TextDecoder,
  push: (text: string) => void,
  finish: () => void,
) {
  const text = decoder.decode(bytes, { stream: !final });
  if (text) push(text);
  if (final) finish();
}

async function readFile(
  file: File,
  onChunk: (chunk: Uint8Array, bytesRead: number, isFinal: boolean) => void,
) {
  const reader = file.stream().getReader();
  let bytes = 0;
  let queued: Uint8Array | null = null;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        onChunk(queued ?? new Uint8Array(), bytes, true);
        break;
      }
      if (queued) onChunk(queued, bytes, false);
      queued = value;
      bytes += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
}

function resultFrom(
  fileName: string,
  timezone: string,
  bucket: Bucket,
): ParseResult {
  return {
    sourceName: fileName || "export",
    timezone,
    prompts: dedupeIds(sortPrompts(bucket.prompts)),
    conversations: bucket.stats.conversations,
    skippedHidden: bucket.stats.skippedHidden,
    skippedEmpty: bucket.stats.skippedEmpty,
    skippedNoTime: bucket.stats.skippedNoTime,
  };
}

async function parseJsonFile(
  file: File,
  timezone: string,
  onProgress: (progress: Progress) => void,
): Promise<ParseResult> {
  const bucket: Bucket = { prompts: [], stats: emptyStats() };
  const decoder = new TextDecoder("utf-8");
  const splitter = createConversationSplitter((json) => ingest(json, timezone, bucket.stats, bucket.prompts));

  await readFile(file, (chunk, bytesRead, isFinal) => {
    onProgress({
      phase: "parse",
      bytesRead: isFinal ? file.size : bytesRead,
      bytesTotal: file.size,
      conversations: bucket.stats.conversations,
      prompts: bucket.prompts.length,
    });
    try {
      feedJson(chunk, isFinal, decoder, splitter.push, splitter.finish);
    } catch (err) {
      throw err instanceof Error ? err : new Error(friendlyError(err));
    }
    onProgress({
      phase: "parse",
      bytesRead: isFinal ? file.size : bytesRead,
      bytesTotal: file.size,
      conversations: bucket.stats.conversations,
      prompts: bucket.prompts.length,
    });
  });

  if (bucket.stats.conversations === 0 && file.size > 0 && file.size < 48_000_000) {
    const text = (await file.text()).trim();
    if (text.startsWith("{")) {
      try {
        const whole = JSON.parse(text) as { mapping?: unknown; conversations?: unknown };
        if (whole && typeof whole === "object" && whole.mapping && !whole.conversations) {
          bucket.prompts.push(...promptsFromConversation(whole, timezone, bucket.stats));
        }
      } catch {
        // The streaming parser already accepted the file; keep the empty result.
      }
    }
  }

  return resultFrom(file.name, timezone, bucket);
}

async function parseZip(
  file: File,
  timezone: string,
  onProgress: (progress: Progress) => void,
): Promise<ParseResult> {
  const buckets: Record<ConversationKind, Bucket> = {
    full: { prompts: [], stats: emptyStats() },
    partial: { prompts: [], stats: emptyStats() },
  };
  let sawFull = false;
  let sawPartial = false;
  let zipError: Error | null = null;
  let bytesRead = 0;

  const uz = new Unzip();
  uz.register(UnzipInflate);

  const report = () => {
    const active = sawFull ? buckets.full : buckets.partial;
    onProgress({
      phase: "unzip",
      bytesRead,
      bytesTotal: file.size,
      conversations: active.stats.conversations,
      prompts: active.prompts.length,
    });
  };

  uz.onfile = (entry: UnzipFile) => {
    const kind = conversationKind(entry.name);
    if (!kind || (kind === "partial" && sawFull)) {
      entry.ondata = () => {};
      try {
        entry.start();
      } catch {
        // Skip files we don't need, even if their compression is unknown.
      }
      return;
    }
    if (kind === "full") sawFull = true;
    else sawPartial = true;
    const bucket = buckets[kind];
    const decoder = new TextDecoder("utf-8");
    const splitter = createConversationSplitter((json) => ingest(json, timezone, bucket.stats, bucket.prompts));
    entry.ondata = (err, chunk, final) => {
      if (zipError) return;
      if (err) {
        zipError = err instanceof Error ? err : new Error("That zip could not be opened.");
        return;
      }
      try {
        feedJson(chunk ?? new Uint8Array(), final, decoder, splitter.push, splitter.finish);
      } catch (e) {
        zipError = e instanceof Error ? e : new Error(friendlyError(e));
      }
    };
    try {
      entry.start();
    } catch (e) {
      zipError = e instanceof Error ? e : new Error("That zip could not be opened.");
    }
  };

  await readFile(file, (chunk, read, isFinal) => {
    if (zipError) throw zipError;
    bytesRead = isFinal ? file.size : read;
    try {
      uz.push(chunk, isFinal);
    } catch (e) {
      throw new Error(
        e instanceof Error && /invalid|unzip|zip/i.test(e.message)
          ? "That zip could not be opened. Drop the original ChatGPT export, or unzip it and choose conversations.json."
          : friendlyError(e),
      );
    }
    if (zipError) throw zipError;
    report();
  });

  if (!sawFull && !sawPartial) {
    throw new Error("That zip does not contain conversations.json or full-conversations.json.");
  }

  const chosen = sawFull ? buckets.full : buckets.partial;
  const source = sawFull ? "full-conversations.json" : file.name || "conversations.json";
  return resultFrom(source, timezone, chosen);
}

/**
 * Parse a ChatGPT export entirely in memory. Never calls the network.
 * `file` is a JSON export or a zip that contains conversations.json / full-conversations.json.
 */
export async function parseExportFile(
  file: File,
  timezone: string,
  onProgress?: (progress: Progress) => void,
): Promise<ParseResult> {
  assertTimezone(timezone);
  if (!file || file.size === 0) throw new Error("That file is empty.");
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (header[0] === 0x1f && header[1] === 0x8b) {
    throw new Error("This looks like gzip. ChatGPT sends a .zip. Drop that zip, or pick conversations.json inside it.");
  }
  const report = onProgress ?? (() => {});
  const isZip = header[0] === 0x50 && header[1] === 0x4b;
  try {
    return isZip ? await parseZip(file, timezone, report) : await parseJsonFile(file, timezone, report);
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}
