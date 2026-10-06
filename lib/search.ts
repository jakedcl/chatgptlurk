import type { Prompt, SearchHit, SearchResponse } from "./types";

function snippet(text: string, lower: string, term: string, radius = 90): string {
  const flat = text.replace(/\s+/g, " ");
  const lflat = lower.replace(/\s+/g, " ");
  const i = term ? lflat.indexOf(term) : -1;
  if (i < 0) return flat.length > radius * 2 ? flat.slice(0, radius * 2) + "…" : flat;
  const start = Math.max(0, i - radius);
  const end = Math.min(flat.length, i + term.length + radius);
  return (start > 0 ? "…" : "") + flat.slice(start, end) + (end < flat.length ? "…" : "");
}

export async function searchPrompts(prompts: Prompt[], q: string, limit = 150): Promise<SearchResponse> {
  const query = q.trim();
  const empty: SearchResponse = { q: query, total: 0, days: {}, hits: [], truncated: false };
  if (query.length < 2) return empty;
  const lower = query.toLowerCase();
  const phrase = /^".+"$/.test(lower) ? [lower.slice(1, -1)] : null;
  const terms = phrase ?? lower.split(/\s+/).filter(Boolean);
  const days: Record<string, number> = {};
  const matches: { p: Prompt; hay: string; inTitle: boolean }[] = [];
  const chunk = 2500;

  for (let i = 0; i < prompts.length; i += chunk) {
    const end = Math.min(prompts.length, i + chunk);
    for (let j = i; j < end; j++) {
      const p = prompts[j]!;
      const hay = p.text.toLowerCase();
      const title = p.t.toLowerCase();
      const inText = terms.every((t) => hay.includes(t));
      const inTitle = !inText && terms.every((t) => title.includes(t) || hay.includes(t));
      if (!inText && !inTitle) continue;
      days[p.date] = (days[p.date] ?? 0) + 1;
      matches.push({ p, hay, inTitle: !inText });
    }
    if (end < prompts.length) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  matches.sort((a, b) => Number(a.inTitle) - Number(b.inTitle) || b.p.ts - a.p.ts);
  const hits: SearchHit[] = matches.slice(0, limit).map(({ p, hay, inTitle }) => ({
    id: p.id,
    date: p.date,
    time: p.time,
    t: p.t,
    snippet: snippet(p.text, hay, terms.find((t) => hay.includes(t)) ?? ""),
    inTitle,
  }));
  return { q: query, total: matches.length, days, hits, truncated: matches.length > limit };
}
