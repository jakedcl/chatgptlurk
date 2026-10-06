import type { Prompt } from "./types";
import { localParts } from "./time";

export type ExtractStats = {
  conversations: number;
  skippedHidden: number;
  skippedEmpty: number;
  skippedNoTime: number;
};

type Attachment = { name?: string; mime_type?: string };

type ExportMessage = {
  id?: string;
  author?: { role?: string };
  create_time?: number | null;
  content?: {
    content_type?: string;
    parts?: unknown[];
    text?: string;
  } | null;
  metadata?: {
    is_visually_hidden_from_conversation?: boolean;
    is_user_system_message?: boolean;
    voice_mode_message?: boolean;
    attachments?: Attachment[];
  } | null;
};

type ExportConversation = {
  id?: string;
  conversation_id?: string;
  title?: string;
  create_time?: number | null;
  mapping?: Record<string, { message?: ExportMessage | null } | null> | null;
};

function partToText(part: unknown): string {
  if (part == null) return "";
  if (typeof part === "string") return part;
  if (typeof part !== "object") return String(part);
  const obj = part as { content_type?: string; text?: string; asset_pointer?: string };
  const ct = obj.content_type || "";
  if (ct === "audio_transcription") return (obj.text || "").trim();
  if (ct === "image_asset_pointer") return "[image]";
  if (ct === "real_time_user_audio_video_asset_pointer" || ct === "audio_asset_pointer") return "";
  if (ct.includes("video")) return "[video]";
  if (typeof obj.text === "string") return obj.text;
  if (ct.includes("asset_pointer") || obj.asset_pointer) return "[file]";
  return "";
}

function messageText(msg: ExportMessage): { text: string; voice: boolean } {
  const c = msg.content || {};
  const pieces: string[] = [];
  if (Array.isArray(c.parts)) {
    for (const p of c.parts) pieces.push(partToText(p));
  } else if (typeof c.text === "string") {
    pieces.push(c.text);
  }
  const hasAudio =
    Array.isArray(c.parts) &&
    c.parts.some((p) => {
      if (!p || typeof p !== "object") return false;
      return /audio/.test((p as { content_type?: string }).content_type || "");
    });
  const atts = msg.metadata?.attachments || [];
  for (const a of atts) {
    if (a && !(a.mime_type || "").startsWith("image/")) pieces.push(`[file: ${a.name || "attachment"}]`);
  }
  let text = pieces
    .filter((s) => s && s.trim())
    .join("\n")
    .trim();
  text = text
    .replace(/(?:\[image\]\s*){2,}/g, (m) => `[image ×${m.match(/\[image\]/g)?.length ?? 2}]\n`)
    .trim();
  if (!text && hasAudio) text = "[voice message]";
  return { text, voice: hasAudio || !!msg.metadata?.voice_mode_message };
}

export function promptsFromConversation(conv: unknown, tz: string, stats: ExtractStats): Prompt[] {
  if (!conv || typeof conv !== "object") return [];
  const c = conv as ExportConversation;
  stats.conversations++;
  const convId = String(c.id || c.conversation_id || `conversation-${stats.conversations}`);
  const title = (typeof c.title === "string" && c.title.trim()) || "Untitled";
  const mapping = c.mapping;
  if (!mapping || typeof mapping !== "object") return [];

  const out: Prompt[] = [];
  let index = 0;
  for (const node of Object.values(mapping)) {
    const msg = node && node.message;
    if (!msg || !msg.author || msg.author.role !== "user") continue;
    const md = msg.metadata || {};
    if (md.is_visually_hidden_from_conversation || md.is_user_system_message) {
      stats.skippedHidden++;
      continue;
    }
    const ct = msg.content && msg.content.content_type;
    if (ct === "user_editable_context") {
      stats.skippedHidden++;
      continue;
    }
    const ts = msg.create_time || c.create_time;
    if (!ts || typeof ts !== "number" || !Number.isFinite(ts)) {
      stats.skippedNoTime++;
      continue;
    }
    const { text, voice } = messageText(msg);
    if (!text) {
      stats.skippedEmpty++;
      continue;
    }
    const lp = localParts(ts, tz);
    const id = msg.id ? String(msg.id) : `${convId}:${index}`;
    index++;
    const prompt: Prompt = {
      id,
      c: convId,
      t: title,
      ts,
      local: lp.local,
      date: lp.date,
      time: lp.time,
      text,
    };
    if (voice) prompt.voice = true;
    out.push(prompt);
  }
  return out;
}

export function sortPrompts(prompts: Prompt[]): Prompt[] {
  return prompts.sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
}
