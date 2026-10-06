import type { Prompt } from "./types";

/** One conversation, in prompt order, pointing at the existing prompt index. */
export type ConversationGroup = {
  id: string;
  title: string;
  /** unix seconds of the earliest user prompt */
  start: number;
  /** unix seconds of the latest user prompt */
  end: number;
  firstDate: string;
  lastDate: string;
  /** index in `ConversationIndex.order` */
  position: number;
  /** same prompt objects as the flat index, earliest first */
  prompts: Prompt[];
};

export type ConversationIndex = {
  byId: Map<string, ConversationGroup>;
  /** earliest conversation first, then id */
  order: ConversationGroup[];
};

function comparePrompts(a: Prompt, b: Prompt): number {
  return a.ts - b.ts || a.id.localeCompare(b.id);
}

function conversationTitle(prompts: Prompt[]): string {
  for (let i = prompts.length - 1; i >= 0; i--) {
    const title = prompts[i]?.t.trim();
    if (title) return prompts[i]!.t.trim();
  }
  return "Untitled";
}

/**
 * Group an already-parsed prompt index by conversation.
 * Call this once when the index is ready (after parse, IndexedDB load, or timezone rebucket).
 * Opening a chat is then a map lookup — the export file is not read again.
 * Prompt text is not copied; each group holds the same objects as `prompts`.
 */
export function indexConversations(prompts: Prompt[]): ConversationIndex {
  const lists = new Map<string, Prompt[]>();
  for (const prompt of prompts) {
    const list = lists.get(prompt.c);
    if (list) list.push(prompt);
    else lists.set(prompt.c, [prompt]);
  }

  const groups: Omit<ConversationGroup, "position">[] = [];
  for (const [id, list] of lists) {
    if (list.length > 1) list.sort(comparePrompts);
    const first = list[0]!;
    const last = list[list.length - 1]!;
    groups.push({
      id,
      title: conversationTitle(list),
      start: first.ts,
      end: last.ts,
      firstDate: first.date,
      lastDate: last.date,
      prompts: list,
    });
  }

  groups.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const order: ConversationGroup[] = groups.map((group, position) => ({ ...group, position }));
  const byId = new Map<string, ConversationGroup>();
  for (const group of order) byId.set(group.id, group);
  return { byId, order };
}

export function getConversation(index: ConversationIndex, id: string): ConversationGroup | null {
  return index.byId.get(id) ?? null;
}

export function adjacentConversation(index: ConversationIndex, id: string, dir: -1 | 1): ConversationGroup | null {
  const group = index.byId.get(id);
  if (!group) return null;
  return index.order[group.position + dir] ?? null;
}
