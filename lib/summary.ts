import { weekday } from "./dates";
import type { Prompt, Summary } from "./types";
import { localParts } from "./time";

export function groupByDate(prompts: Prompt[]): Record<string, Prompt[]> {
  const out: Record<string, Prompt[]> = {};
  for (const p of prompts) (out[p.date] ??= []).push(p);
  return out;
}

export function buildSummary(prompts: Prompt[], timezone: string, source: string): Summary {
  const days: Record<string, { n: number; convs: Set<string> }> = {};
  const hours = Array(24).fill(0) as number[];
  const weekdays = Array(7).fill(0) as number[];
  const months: Record<string, number> = {};
  const convs = new Set<string>();
  let chars = 0;
  let voice = 0;

  for (const p of prompts) {
    const bucket = (days[p.date] ??= { n: 0, convs: new Set() });
    bucket.n++;
    bucket.convs.add(p.c);
    const hour = Number(p.time.slice(0, 2));
    if (hour >= 0 && hour < 24) hours[hour]++;
    weekdays[weekday(p.date)]++;
    const month = p.date.slice(0, 7);
    months[month] = (months[month] ?? 0) + 1;
    convs.add(p.c);
    chars += p.text.length;
    if (p.voice) voice++;
  }

  const dayCounts = Object.fromEntries(
    Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, v]) => [d, [v.n, v.convs.size] as [number, number]]),
  );
  const dates = Object.keys(dayCounts);
  const busiest = Object.entries(dayCounts)
    .sort((a, b) => b[1][0] - a[1][0] || b[0].localeCompare(a[0]))
    .slice(0, 10)
    .map(([date, [n, c]]) => ({ date, prompts: n, conversations: c }));

  return {
    generatedAt: new Date().toISOString(),
    timezone,
    source,
    totals: {
      prompts: prompts.length,
      conversations: convs.size,
      activeDays: dates.length,
      chars,
      voice,
    },
    range: { first: dates[0] ?? null, last: dates[dates.length - 1] ?? null },
    busiest,
    hours,
    weekdays,
    months,
    days: dayCounts,
  };
}

export function rebucketPrompt(prompt: Prompt, timezone: string): Prompt {
  const lp = localParts(prompt.ts, timezone);
  if (prompt.date === lp.date && prompt.time === lp.time && prompt.local === lp.local) return prompt;
  return { ...prompt, date: lp.date, time: lp.time, local: lp.local };
}

export async function rebucketPrompts(
  prompts: Prompt[],
  timezone: string,
  onTick?: (done: number, total: number) => void,
): Promise<Prompt[]> {
  const out = new Array<Prompt>(prompts.length);
  const size = 4000;
  for (let i = 0; i < prompts.length; i += size) {
    const end = Math.min(prompts.length, i + size);
    for (let j = i; j < end; j++) out[j] = rebucketPrompt(prompts[j]!, timezone);
    onTick?.(end, prompts.length);
    if (end < prompts.length) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return out;
}
