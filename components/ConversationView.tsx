"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ConversationGroup } from "@/lib/conversations";
import { longDate, shortDate, time12 } from "@/lib/dates";
import type { Prompt } from "@/lib/types";
import { Highlight } from "./Highlight";

const COLLAPSE_CHARS = 420;
const COLLAPSE_LINES = 7;

function rangeLabel(group: ConversationGroup): string {
  if (group.firstDate === group.lastDate) return longDate(group.firstDate);
  return `${shortDate(group.firstDate)} – ${shortDate(group.lastDate)}`;
}

function ConversationPrompt({ p, terms, focused }: { p: Prompt; terms: string[]; focused: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => p.text.split("\n").length, [p.text]);
  const long = p.text.length > COLLAPSE_CHARS || lines > COLLAPSE_LINES;

  useEffect(() => {
    if (focused && ref.current) {
      setOpen(true);
      ref.current.scrollIntoView({ block: "center" });
    }
  }, [focused]);

  let shown = p.text;
  if (long && !open) {
    shown = p.text.split("\n").slice(0, COLLAPSE_LINES).join("\n");
    if (shown.length > COLLAPSE_CHARS) shown = shown.slice(0, COLLAPSE_CHARS);
    shown = shown.trimEnd() + "…";
  }

  return (
    <div ref={ref} data-prompt-id={p.id} className={focused ? "animate-[flash_1.6s_ease-out] rounded-lg" : undefined}>
      <div className="mb-1 flex items-center gap-2 text-xs">
        <time dateTime={p.local} title={p.local} className="font-mono tabular-nums text-zinc-400">
          {time12(p.time)}
        </time>
        {p.voice && (
          <span className="rounded bg-sky-500/15 px-1 text-[10px] text-sky-300" title="Voice message">
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
        <button type="button" onClick={() => setOpen((value) => !value)} className="mt-1 text-xs font-medium text-emerald-400 hover:text-emerald-300">
          {open ? "Show less" : `Show more · ${p.text.length.toLocaleString()} chars`}
        </button>
      )}
    </div>
  );
}

function NeighborButton({
  dir,
  group,
  testId,
  onOpen,
}: {
  dir: -1 | 1;
  group: ConversationGroup | null;
  testId: string;
  onOpen: (id: string) => void;
}) {
  const label = dir === -1 ? "Previous" : "Next";
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={!group}
      onClick={() => group && onOpen(group.id)}
      aria-label={group ? `${label} conversation: ${group.title}` : `${label} conversation`}
      title={group ? group.title : undefined}
      className={[
        "flex min-w-0 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-left transition hover:bg-white/[0.06] disabled:pointer-events-none disabled:opacity-40",
        dir === 1 ? "justify-end text-right" : "",
      ].join(" ")}
    >
      {dir === -1 && (
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
          <path d="M12.7 15.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4l4.6-4.6a1 1 0 1 1 1.4 1.4L8.8 10l3.9 3.9a1 1 0 0 1 0 1.4Z" />
        </svg>
      )}
      <span className="min-w-0">
        <span className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</span>
        <span className="block truncate text-xs text-zinc-200">{group?.title ?? "None"}</span>
      </span>
      {dir === 1 && (
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
          <path d="M7.3 4.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4l-4.6 4.6a1 1 0 0 1-1.4-1.4l3.9-3.9-3.9-3.9a1 1 0 0 1 0-1.4Z" />
        </svg>
      )}
    </button>
  );
}

type Props = {
  group: ConversationGroup | null;
  prev: ConversationGroup | null;
  next: ConversationGroup | null;
  total: number;
  focusId: string | null;
  terms: string[];
  onBack: () => void;
  onOpen: (id: string) => void;
};

export function ConversationView({ group, prev, next, total, focusId, terms, onBack, onOpen }: Props) {
  const topRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!focusId) topRef.current?.scrollIntoView({ block: "start" });
  }, [group?.id, focusId]);

  return (
    <section ref={topRef} data-testid="conversation-view" aria-label="Conversation" className="mx-auto w-full max-w-3xl">
      <div className="card overflow-hidden">
        <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-zinc-950/90 p-4 backdrop-blur sm:p-5">
          <button type="button" data-testid="conversation-back" onClick={onBack} className="text-btn gap-1.5" aria-label="Back to calendar">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M12.7 15.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4l4.6-4.6a1 1 0 1 1 1.4 1.4L8.8 10l3.9 3.9a1 1 0 0 1 0 1.4Z" />
            </svg>
            Back to day
          </button>
          {group ? (
            <>
              <h2 data-testid="conversation-title" className="mt-4 break-words text-xl font-semibold tracking-tight text-zinc-100">
                {group.title}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                <span className="font-medium text-zinc-200">{group.prompts.length}</span> prompt{group.prompts.length === 1 ? "" : "s"}
                {" · "}
                {rangeLabel(group)}
                {total > 0 ? ` · ${group.position + 1} of ${total}` : ""}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Only your prompts, in the order you sent them.</p>
            </>
          ) : (
            <p className="mt-4 text-sm text-zinc-400" role="alert">
              This conversation is not in the saved index.
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 [&>*]:min-w-0">
            <NeighborButton dir={-1} group={prev} testId="conversation-prev" onOpen={onOpen} />
            <NeighborButton dir={1} group={next} testId="conversation-next" onOpen={onOpen} />
          </div>
        </div>
        <div className="p-4 sm:p-5">
          {group && group.prompts.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">No user prompts in this conversation.</p>}
          {group && group.prompts.length > 0 && (
            <div className="space-y-5">
              {group.prompts.map((prompt, index) => {
                const showDate = index === 0 || group.prompts[index - 1]?.date !== prompt.date;
                return (
                  <div key={prompt.id}>
                    {showDate && (
                      <h3 className={["mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500", index === 0 ? "" : "mt-8"].join(" ")}>
                        {longDate(prompt.date)}
                      </h3>
                    )}
                    <ConversationPrompt p={prompt} terms={terms} focused={prompt.id === focusId} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
