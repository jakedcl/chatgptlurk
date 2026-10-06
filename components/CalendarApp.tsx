"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adjacentConversation, getConversation, type ConversationIndex } from "@/lib/conversations";
import type { Prompt, SearchHit, SearchResponse } from "@/lib/types";
import type { Summary } from "@/lib/types";
import { addDays, addMonths, monthLabel, shortDate, todayIn, WEEKDAYS } from "@/lib/dates";
import { formatChars } from "@/lib/format";
import { HEAT_BG, makeScale } from "@/lib/heat";
import { searchPrompts } from "@/lib/search";
import { groupByDate } from "@/lib/summary";
import { YearHeatmap } from "./YearHeatmap";
import { MonthGrid } from "./MonthGrid";
import { DayPanel } from "./DayPanel";
import { ConversationView } from "./ConversationView";
import { SearchBox } from "./SearchBox";
import { queryTerms } from "./Highlight";
import { Logo } from "./Logo";

type Props = {
  summary: Summary;
  prompts: Prompt[];
  conversations: ConversationIndex;
  timezone: string;
  timezones: string[];
  sourceName: string;
  persisted: boolean;
  persistNote: string | null;
  skippedHidden: number;
  initialDate: string | null;
  initialQuery: string;
  initialConversation: string | null;
  tzBusy: boolean;
  onTimezone: (tz: string) => void;
  onBrowse: () => void;
  onClear: () => void;
};

export function CalendarApp({
  summary,
  prompts,
  conversations,
  timezone,
  timezones,
  sourceName,
  persisted,
  persistNote,
  skippedHidden,
  initialDate,
  initialQuery,
  initialConversation,
  tzBusy,
  onTimezone,
  onBrowse,
  onClear,
}: Props) {
  const first = summary.range.first!;
  const last = summary.range.last!;
  const activeDates = useMemo(() => Object.keys(summary.days).sort(), [summary.days]);
  const byDate = useMemo(() => groupByDate(prompts), [prompts]);

  const [selected, setSelected] = useState<string | null>(initialDate ?? last);
  const [month, setMonth] = useState<string>((initialDate ?? last).slice(0, 7));
  const minMonth = first.slice(0, 7);
  const maxMonth = last.slice(0, 7);
  const shownMonth = month < minMonth ? minMonth : month > maxMonth ? maxMonth : month;
  const [focusId, setFocusId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(initialConversation);
  const [conversationFocus, setConversationFocus] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [searchRes, setSearchRes] = useState<{ tz: string; res: SearchResponse } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [today] = useState(() => todayIn(timezone));

  const scale = useMemo(() => makeScale(Object.values(summary.days).map((v) => v[0])), [summary.days]);
  const terms = useMemo(() => queryTerms(query), [query]);
  const trimmedQ = query.trim();
  const liveRes = searchRes && searchRes.tz === timezone && trimmedQ.length >= 2 && searchRes.res.q === trimmedQ ? searchRes.res : null;
  const matches = liveRes ? liveRes.days : null;
  const searching = trimmedQ.length >= 2 && !liveRes;

  useEffect(() => {
    if (trimmedQ.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPrompts(prompts, trimmedQ).then((res) => {
        if (!cancelled) setSearchRes({ tz: timezone, res });
      });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQ, prompts, timezone]);

  useEffect(() => {
    const u = new URL(window.location.href);
    if (selected) u.searchParams.set("date", selected);
    else u.searchParams.delete("date");
    if (query.trim()) u.searchParams.set("q", query.trim());
    else u.searchParams.delete("q");
    if (conversationId) u.searchParams.set("c", conversationId);
    else u.searchParams.delete("c");
    window.history.replaceState(null, "", u);
  }, [selected, query, conversationId]);

  const selectDay = useCallback((date: string, focus: string | null = null) => {
    setSelected(date);
    setMonth(date.slice(0, 7));
    setFocusId(focus);
  }, []);

  const openConversation = useCallback(
    (id: string, promptId: string | null, date: string | null) => {
      if (date) selectDay(date, promptId);
      else if (promptId) setFocusId(promptId);
      setConversationFocus(promptId);
      setConversationId(id);
    },
    [selectDay],
  );

  const closeConversation = useCallback(() => {
    setConversationId(null);
    setConversationFocus(null);
  }, []);

  const stepActive = useCallback(
    (dir: -1 | 1) => {
      if (!selected) return;
      const pool = matches ? Object.keys(matches).sort() : activeDates;
      const next = dir === 1 ? pool.find((d) => d > selected) : [...pool].reverse().find((d) => d < selected);
      if (next) selectDay(next);
    },
    [selected, activeDates, matches, selectDay],
  );

  const canStep = useMemo(() => {
    const pool = matches ? Object.keys(matches).sort() : activeDates;
    return {
      prev: !!selected && pool.length > 0 && pool[0] < selected,
      next: !!selected && pool.length > 0 && pool[pool.length - 1] > selected,
    };
  }, [selected, activeDates, matches]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (conversationId) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        if (e.shiftKey) stepActive(dir);
        else if (selected) selectDay(addDays(selected, dir));
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (!selected) return;
        e.preventDefault();
        selectDay(addDays(selected, e.key === "ArrowUp" ? -7 : 7));
      } else if (e.key === "[" || e.key === "]") {
        setMonth(addMonths(shownMonth, e.key === "[" ? -1 : 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, selectDay, stepActive, shownMonth, conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeConversation();
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const neighbor = adjacentConversation(conversations, conversationId, e.key === "ArrowLeft" ? -1 : 1);
      if (neighbor) openConversation(neighbor.id, null, null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [conversationId, conversations, closeConversation, openConversation]);

  const onPickHit = useCallback(
    (h: SearchHit) => {
      closeConversation();
      selectDay(h.date, h.id);
    },
    [closeConversation, selectDay],
  );

  const onPickDay = useCallback(
    (date: string) => {
      closeConversation();
      selectDay(date);
    },
    [closeConversation, selectDay],
  );

  const monthTotal = summary.months[shownMonth] ?? 0;
  const monthDays = useMemo(() => activeDates.filter((d) => d.startsWith(shownMonth)), [activeDates, shownMonth]);
  const monthMatches = matches ? Object.entries(matches).filter(([d]) => d.startsWith(shownMonth)).reduce((a, [, n]) => a + n, 0) : 0;
  const spanDays = Math.round((Date.parse(last) - Date.parse(first)) / 864e5) + 1;
  const busiest = summary.busiest[0];
  const peakHour = summary.hours.indexOf(Math.max(...summary.hours));
  const peakWeekday = summary.weekdays.indexOf(Math.max(...summary.weekdays));
  const dayPrompts = selected ? (byDate[selected] ?? []) : null;
  const perDay = summary.totals.activeDays ? (summary.totals.prompts / summary.totals.activeDays).toFixed(1) : "0";

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="relative z-40 mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Prompt Calendar</h1>
              <p className="text-xs text-zinc-500">
                Every ChatGPT prompt, by day · {timezone.replaceAll("_", " ")}
                {tzBusy ? " · updating dates…" : ""}
              </p>
            </div>
          </div>
          <SearchBox
            query={query}
            setQuery={setQuery}
            result={liveRes}
            searching={searching}
            onPickDay={onPickDay}
            onPickHit={onPickHit}
            onOpenConversation={(hit) => openConversation(hit.c, hit.id, hit.date)}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            Timezone
            <select
              data-testid="timezone"
              value={timezone}
              disabled={tzBusy}
              onChange={(e) => onTimezone(e.target.value)}
              className="h-9 max-w-[240px] rounded-lg border border-white/10 bg-zinc-900 px-2 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none disabled:opacity-50"
              aria-label="Timezone"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="text-btn" onClick={onBrowse}>
            Re-upload
          </button>
          {confirmClear ? (
            <span className="flex items-center gap-2 text-xs text-zinc-400">
              Erase the calendar stored in this browser?
              <button type="button" data-testid="confirm-clear" className="text-btn border-red-400/40 text-red-200 hover:bg-red-500/10" onClick={onClear}>
                Clear data
              </button>
              <button type="button" className="text-btn" onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" data-testid="clear-data" className="text-btn" onClick={() => setConfirmClear(true)}>
              Clear data
            </button>
          )}
        </div>
        {persistNote && (
          <p className="text-xs text-amber-200/90" role="status">
            {persistNote}
          </p>
        )}
      </header>

      {conversationId ? (
        <ConversationView
          group={getConversation(conversations, conversationId)}
          prev={adjacentConversation(conversations, conversationId, -1)}
          next={adjacentConversation(conversations, conversationId, 1)}
          total={conversations.order.length}
          focusId={conversationFocus}
          terms={terms}
          onBack={closeConversation}
          onOpen={(id) => openConversation(id, null, null)}
        />
      ) : (
      <>
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat
          label="Prompts"
          value={summary.totals.prompts.toLocaleString()}
          sub={`${perDay} per active day`}
          testId="stat-prompts"
        />
        <Stat
          label="Active days"
          value={summary.totals.activeDays.toLocaleString()}
          sub={`of ${spanDays} days · ${spanDays ? Math.round((summary.totals.activeDays / spanDays) * 100) : 0}%`}
        />
        <Stat label="Conversations" value={summary.totals.conversations.toLocaleString()} sub={formatChars(summary.totals.chars)} />
        <Stat
          label="Range"
          value={`${shortDate(first).replace(/, \d{4}/, "")} → ${shortDate(last).replace(/, \d{4}/, "")}`}
          sub={`${first.slice(0, 4)} – ${last.slice(0, 4)}`}
        />
        {busiest && (
          <button type="button" onClick={() => selectDay(busiest.date)} className="text-left">
            <Stat label="Busiest day" value={`${busiest.prompts} prompts`} sub={shortDate(busiest.date)} interactive />
          </button>
        )}
        <Stat label="Peak time" value={`${((peakHour + 11) % 12) + 1} ${peakHour >= 12 ? "PM" : "AM"}`} sub={`${WEEKDAYS[peakWeekday]}s are busiest`} />
      </section>

      <section className="card mb-5 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-300">
            {matches ? (
              <>
                Matches for <span className="text-amber-300">“{query.trim()}”</span>
              </>
            ) : (
              "Activity overview"
            )}
          </h2>
          <Legend search={!!matches} />
        </div>
        <YearHeatmap days={summary.days} first={first} last={last} selected={selected} month={shownMonth} matches={matches} onSelect={selectDay} />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
        <section className="card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{monthLabel(shownMonth)}</h2>
              <p className="text-sm text-zinc-400">
                {monthTotal ? (
                  <>
                    <span className="font-medium text-zinc-200">{monthTotal.toLocaleString()}</span> prompts across {monthDays.length} days
                    {matches && (
                      <>
                        {" · "}
                        <span className="text-amber-300">{monthMatches} matches</span>
                      </>
                    )}
                  </>
                ) : (
                  "No prompts this month"
                )}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" className="icon-btn" disabled={shownMonth <= minMonth} onClick={() => setMonth(addMonths(shownMonth, -1))} aria-label="Previous month" title="Previous month ([)">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                  <path d="M12.7 15.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4l4.6-4.6a1 1 0 1 1 1.4 1.4L8.8 10l3.9 3.9a1 1 0 0 1 0 1.4Z" />
                </svg>
              </button>
              <select
                value={shownMonth}
                onChange={(e) => setMonth(e.target.value)}
                className="h-9 rounded-lg border border-white/10 bg-zinc-900 px-2 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
                aria-label="Jump to month"
              >
                {Object.keys(summary.months)
                  .sort()
                  .reverse()
                  .map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)} · {summary.months[m]}
                    </option>
                  ))}
                {!summary.months[shownMonth] && <option value={shownMonth}>{monthLabel(shownMonth)}</option>}
              </select>
              <button type="button" className="icon-btn" disabled={shownMonth >= maxMonth} onClick={() => setMonth(addMonths(shownMonth, 1))} aria-label="Next month" title="Next month (])">
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                  <path d="M7.3 4.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4l-4.6 4.6a1 1 0 0 1-1.4-1.4l3.9-3.9-3.9-3.9a1 1 0 0 1 0-1.4Z" />
                </svg>
              </button>
              <button
                type="button"
                className="ml-1 h-9 rounded-lg border border-white/10 px-3 text-sm text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40"
                disabled={shownMonth === maxMonth && selected === last}
                onClick={() => selectDay(last)}
              >
                Latest
              </button>
            </div>
          </div>
          <MonthGrid month={shownMonth} days={summary.days} scale={scale} selected={selected} today={today} matches={matches} onSelect={selectDay} />

          <div className="mt-5 grid gap-4 border-t border-white/[0.06] pt-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Busiest days</h3>
              <div className="flex flex-wrap gap-1.5">
                {summary.busiest.map((b) => (
                  <button
                    key={b.date}
                    type="button"
                    onClick={() => selectDay(b.date)}
                    className={[
                      "rounded-lg border px-2 py-1 text-xs transition",
                      b.date === selected ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200" : "border-white/[0.08] text-zinc-300 hover:bg-white/[0.05]",
                    ].join(" ")}
                  >
                    {shortDate(b.date)} <span className="font-semibold tabular-nums text-emerald-300">{b.prompts}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Time of day</h3>
              <HourBars hours={summary.hours} />
            </div>
          </div>
        </section>

        <aside className="card flex max-lg:max-h-[80vh] max-lg:min-h-[400px] flex-col overflow-hidden lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <DayPanel
            date={selected}
            prompts={dayPrompts}
            loading={false}
            error={null}
            terms={terms}
            focusId={focusId}
            onStep={stepActive}
            canStep={canStep}
            onOpenConversation={(id, promptId) => openConversation(id, promptId, null)}
          />
        </aside>
      </div>
      </>
      )}

      <footer className="mt-8 space-y-1 text-center text-[11px] leading-5 text-zinc-600">
        <p>
          Files never leave this device. Parsed in this browser from {sourceName}
          {persisted ? " · saved in IndexedDB on this browser only" : " · not saved locally"}.
          {skippedHidden > 0 ? ` Skipped ${skippedHidden} hidden or system message${skippedHidden === 1 ? "" : "s"}.` : ""}
        </p>
        <p>
          {conversationId
            ? "Esc back to the day · ←/→ previous and next conversation · / search"
            : "←/→ day · ↑/↓ week · shift+←/→ next active day · [ / ] month · / search"}
        </p>
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  interactive,
  testId,
}: {
  label: string;
  value: string;
  sub?: string;
  interactive?: boolean;
  testId?: string;
}) {
  return (
    <div className={["card h-full px-4 py-3", interactive ? "transition hover:border-emerald-500/40 hover:bg-white/[0.05]" : ""].join(" ")}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</div>
      <div data-testid={testId} className="mt-1 truncate text-lg font-semibold tabular-nums tracking-tight">
        {value}
      </div>
      {sub && <div className="truncate text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

function Legend({ search }: { search: boolean }) {
  const colors = search ? ["bg-white/[0.08]", "bg-amber-900", "bg-amber-700", "bg-amber-500", "bg-amber-400", "bg-amber-200"] : HEAT_BG;
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
      <span>{search ? "Fewer matches" : "Less"}</span>
      {colors.map((c, i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-[3px] ${c}`} />
      ))}
      <span>More</span>
    </div>
  );
}

function HourBars({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  return (
    <div>
      <div className="flex h-12 items-end gap-[2px]">
        {hours.map((n, i) => (
          <div
            key={i}
            title={`${((i + 11) % 12) + 1}${i >= 12 ? "pm" : "am"} · ${n.toLocaleString()} prompts`}
            className="flex-1 rounded-t-[2px] bg-teal-500/70 hover:bg-teal-300"
            style={{ height: `${Math.max(4, (n / max) * 100)}%` }}
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
  );
}
