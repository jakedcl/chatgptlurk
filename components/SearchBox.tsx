"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchHit, SearchResponse } from "@/lib/types";
import { shortDate, time12 } from "@/lib/dates";
import { Highlight, queryTerms } from "./Highlight";

type Props = {
  query: string;
  setQuery: (q: string) => void;
  result: SearchResponse | null;
  searching: boolean;
  onPickDay: (date: string) => void;
  onPickHit: (hit: SearchHit) => void;
};

export function SearchBox({ query, setQuery, result, searching, onPickDay, onPickHit }: Props) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const terms = useMemo(() => queryTerms(query), [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  const topDays = useMemo(
    () => (result ? Object.entries(result.days).sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0])).slice(0, 12) : []),
    [result],
  );
  const dayCount = result ? Object.keys(result.days).length : 0;
  const show = open && query.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative w-full sm:w-[420px]">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 focus-within:border-emerald-500/60 focus-within:bg-white/[0.06]">
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-zinc-500" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 1 0 3.4 9.83l3.13 3.14a.75.75 0 1 0 1.06-1.06l-3.13-3.14A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
            clipRule="evenodd"
          />
        </svg>
        <input
          ref={inputRef}
          data-testid="search-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (open) setOpen(false);
              else setQuery("");
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Enter" && result?.hits[0]) {
              onPickHit(result.hits[0]);
              setOpen(false);
            }
          }}
          placeholder='Search prompts…  (quotes match a phrase)'
          className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          spellCheck={false}
          aria-label="Search prompts"
        />
        {searching && <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-emerald-400" aria-label="Searching" />}
        {query ? (
          <button type="button" onClick={() => setQuery("")} className="shrink-0 text-xs text-zinc-500 hover:text-zinc-200" aria-label="Clear search">
            ✕
          </button>
        ) : (
          <kbd className="shrink-0 rounded border border-white/10 px-1.5 text-[10px] text-zinc-500">/</kbd>
        )}
      </div>

      {show && result && (
        <div className="absolute right-0 z-50 mt-2 flex max-h-[70vh] w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-900/95 shadow-2xl shadow-black/50 backdrop-blur sm:w-[560px]">
          <div className="border-b border-white/[0.06] px-4 py-3 text-xs text-zinc-400">
            {result.total ? (
              <>
                <span className="font-semibold text-amber-300">{result.total.toLocaleString()}</span> matching prompt{result.total === 1 ? "" : "s"} on{" "}
                <span className="font-semibold text-zinc-200">{dayCount}</span> day{dayCount === 1 ? "" : "s"} · highlighted on the calendar
              </>
            ) : searching ? (
              <>Searching…</>
            ) : (
              <>No prompts match “{query.trim()}”.</>
            )}
            {topDays.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {topDays.map(([d, n]) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      onPickDay(d);
                      setOpen(false);
                    }}
                    className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-amber-400/20 hover:text-amber-200"
                  >
                    {shortDate(d)} <span className="tabular-nums text-amber-300">{n}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto py-1 [scrollbar-width:thin]">
            {result.hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPickHit(h);
                    setOpen(false);
                  }}
                  className="block w-full px-4 py-2.5 text-left hover:bg-white/[0.05]"
                >
                  <div className="flex items-baseline gap-2 text-[11px]">
                    <span className="shrink-0 font-medium text-zinc-300">{shortDate(h.date)}</span>
                    <span className="shrink-0 font-mono text-zinc-500">{time12(h.time)}</span>
                    <span className="truncate text-emerald-300/80">
                      <Highlight text={h.t} terms={terms} />
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-zinc-300">
                    <Highlight text={h.snippet} terms={terms} />
                  </p>
                </button>
              </li>
            ))}
            {result.truncated && (
              <li className="px-4 py-2 text-center text-[11px] text-zinc-500">
                Showing newest {result.hits.length} of {result.total.toLocaleString()}. Narrow the search, or pick a day above.
              </li>
            )}
          </ul>
        </div>
      )}
      {show && !result && searching && (
        <div className="absolute right-0 z-50 mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/95 px-4 py-3 text-xs text-zinc-400 shadow-2xl sm:w-[560px]">
          Searching…
        </div>
      )}
    </div>
  );
}
