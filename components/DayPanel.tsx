"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Prompt } from "@/lib/types";
import { longDate, time12 } from "@/lib/dates";
import { Highlight } from "./Highlight";

const COLLAPSE_CHARS = 420;
const COLLAPSE_LINES = 7;

function hue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function PromptItem({
  p,
  terms,
  focused,
  sameConvAsPrev,
}: {
  p: Prompt;
  terms: string[];
  focused: boolean;
  sameConvAsPrev: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const lines = useMemo(() => p.text.split("\n").length, [p.text]);
  const long = p.text.length > COLLAPSE_CHARS || lines > COLLAPSE_LINES;

  useEffect(() => {
    if (focused && ref.current) {
      setOpen(true);
      const el = ref.current;
      const box = el.closest<HTMLElement>("[data-scroll]");
      requestAnimationFrame(() => {
        if (!box) return el.scrollIntoView({ block: "center" });
        const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
        box.scrollTo({ top: Math.max(0, top - box.clientHeight / 3), behavior: "smooth" });
      });
    }
  }, [focused]);

  let shown = p.text;
  if (long && !open) {
    shown = p.text.split("\n").slice(0, COLLAPSE_LINES).join("\n");
    if (shown.length > COLLAPSE_CHARS) shown = shown.slice(0, COLLAPSE_CHARS);
    shown = shown.trimEnd() + "…";
  }
  const h = hue(p.c);

  return (
    <li ref={ref} data-prompt-id={p.id} className={["relative pb-5 pl-6 last:pb-1", focused ? "animate-[flash_1.6s_ease-out]" : ""].join(" ")}>
      <span className="absolute bottom-0 left-[7px] top-2 w-px bg-white/10" />
      <span className="absolute left-0.5 top-1.5 h-3 w-3 rounded-full ring-4 ring-zinc-900" style={{ background: `hsl(${h} 70% 62%)` }} />
      <div className="mb-1 flex items-baseline gap-2 text-xs">
        <time dateTime={p.local} title={p.local} className="shrink-0 font-mono tabular-nums text-zinc-400">
          {time12(p.time)}
        </time>
        <span
          className={["truncate font-medium", sameConvAsPrev ? "text-zinc-500" : ""].join(" ")}
          style={sameConvAsPrev ? undefined : { color: `hsl(${h} 70% 75%)` }}
          title={p.t}
        >
          {p.t}
        </span>
        {p.voice && (
          <span className="shrink-0 rounded bg-sky-500/15 px-1 text-[10px] text-sky-300" title="Voice message">
            voice
          </span>
        )}
      </div>
      <div
        className={[
          "whitespace-pre-wrap break-words rounded-lg border px-3 py-2 text-[13.5px] leading-relaxed text-zinc-200",
          focused ? "border-amber-400/60 bg-amber-400/[0.06]" : "border-white/[0.06] bg-white/[0.03]",
        ].join(" ")}
      >
        <Highlight text={shown} terms={terms} />
      </div>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-xs font-medium text-emerald-400 hover:text-emerald-300">
          {open ? "Show less" : `Show more · ${p.text.length.toLocaleString()} chars`}
        </button>
      )}
    </li>
  );
}

type Props = {
  date: string | null;
  prompts: Prompt[] | null;
  loading: boolean;
  error: string | null;
  terms: string[];
  focusId: string | null;
  onStep: (dir: -1 | 1) => void;
  canStep: { prev: boolean; next: boolean };
};

function DayPanelImpl({ date, prompts, loading, error, terms, focusId, onStep, canStep }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusId) listRef.current?.scrollTo({ top: 0 });
  }, [date, focusId]);

  const hours = useMemo(() => {
    const h = Array(24).fill(0) as number[];
    prompts?.forEach((p) => h[Number(p.time.slice(0, 2))]++);
    return h;
  }, [prompts]);
  const maxH = Math.max(1, ...hours);
  const convs = useMemo(() => new Set(prompts?.map((p) => p.c)).size, [prompts]);

  if (!date) {
    return <div className="flex h-full items-center justify-center p-8 text-sm text-zinc-500">Pick a day to see its prompts.</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="day-panel">
      <div className="border-b border-white/[0.06] p-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{longDate(date)}</h2>
            <p className="mt-0.5 text-sm text-zinc-400">
              {prompts ? (
                prompts.length ? (
                  <>
                    <span className="font-medium text-zinc-200">{prompts.length}</span> prompt{prompts.length === 1 ? "" : "s"} · {convs}{" "}
                    conversation{convs === 1 ? "" : "s"} · {time12(prompts[0].time)} – {time12(prompts[prompts.length - 1].time)}
                  </>
                ) : (
                  "No prompts this day"
                )
              ) : (
                "Loading…"
              )}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => onStep(-1)} disabled={!canStep.prev} className="icon-btn" aria-label="Previous active day" title="Previous active day (shift+←)">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                <path d="M12.7 15.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4l4.6-4.6a1 1 0 1 1 1.4 1.4L8.8 10l3.9 3.9a1 1 0 0 1 0 1.4Z" />
              </svg>
            </button>
            <button type="button" onClick={() => onStep(1)} disabled={!canStep.next} className="icon-btn" aria-label="Next active day" title="Next active day (shift+→)">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                <path d="M7.3 4.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4l-4.6 4.6a1 1 0 0 1-1.4-1.4l3.9-3.9-3.9-3.9a1 1 0 0 1 0-1.4Z" />
              </svg>
            </button>
          </div>
        </div>
        {prompts && prompts.length > 0 && (
          <div className="mt-4">
            <div className="flex h-10 items-end gap-[2px]">
              {hours.map((n, i) => (
                <div
                  key={i}
                  title={`${time12(`${String(i).padStart(2, "0")}:00`)} · ${n}`}
                  className={["flex-1 rounded-t-[2px]", n ? "bg-emerald-500/80" : "bg-white/[0.05]"].join(" ")}
                  style={{ height: `${n ? Math.max(12, (n / maxH) * 100) : 6}%` }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
              <span>12a</span>
              <span>6a</span>
              <span>12p</span>
              <span>6p</span>
              <span>11p</span>
            </div>
          </div>
        )}
      </div>
      <div ref={listRef} data-scroll className="min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-width:thin]">
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        {loading && !prompts && (
          <ul className="space-y-4" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-16 animate-pulse rounded-lg bg-white/[0.04]" />
            ))}
          </ul>
        )}
        {prompts && prompts.length === 0 && !loading && <p className="py-10 text-center text-sm text-zinc-500">Nothing asked on this day.</p>}
        {prompts && prompts.length > 0 && (
          <ol>
            {prompts.map((p, i) => (
              <PromptItem key={p.id} p={p} terms={terms} focused={p.id === focusId} sameConvAsPrev={i > 0 && prompts[i - 1].c === p.c} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export const DayPanel = memo(DayPanelImpl);
