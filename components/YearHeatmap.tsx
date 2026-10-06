"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { addDays, fmt, MONTHS, parse, shortDate } from "@/lib/dates";
import { HEAT_BG, makeScale } from "@/lib/heat";

const SEARCH_BG = ["", "bg-amber-900", "bg-amber-700", "bg-amber-500", "bg-amber-400", "bg-amber-200"] as const;

type Props = {
  days: Record<string, [number, number]>;
  first: string;
  last: string;
  selected: string | null;
  month: string;
  matches: Record<string, number> | null;
  onSelect: (date: string) => void;
};

function YearHeatmapImpl({ days, first, last, selected, month, matches, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { weeks, monthLabels } = useMemo(() => {
    const start = parse(first);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    const end = parse(last);
    end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));
    const weeks: string[][] = [];
    let cur = fmt(start);
    const endS = fmt(end);
    while (cur <= endS) {
      const w: string[] = [];
      for (let i = 0; i < 7; i++) {
        w.push(cur);
        cur = addDays(cur, 1);
      }
      weeks.push(w);
    }
    const monthLabels: { col: number; label: string }[] = [];
    weeks.forEach((w, i) => {
      const firstOfMonth = w.find((d) => d.endsWith("-01"));
      if (firstOfMonth) {
        const [y, m] = firstOfMonth.split("-").map(Number);
        monthLabels.push({ col: i, label: m === 1 ? `${MONTHS[0].slice(0, 3)} ${y}` : MONTHS[m - 1].slice(0, 3) });
      }
    });
    return { weeks, monthLabels };
  }, [first, last]);

  const scale = useMemo(() => makeScale(Object.values(days).map((v) => v[0])), [days]);
  const matchScale = useMemo(() => (matches ? makeScale(Object.values(matches)) : null), [matches]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [first, last]);

  const cols = { gridTemplateColumns: `repeat(${weeks.length}, minmax(10px, 1fr))` };

  return (
    <div ref={scrollRef} className="overflow-x-auto px-1.5 py-1.5 [scrollbar-width:thin]">
      <div className="flex min-w-[900px] gap-2">
        <div className="grid w-7 shrink-0 grid-rows-[16px_repeat(7,1fr)] gap-[3px] text-[10px] leading-none text-zinc-500">
          <span />
          {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => (
            <span key={i} className="flex items-center">
              {d}
            </span>
          ))}
        </div>
        <div className="flex-1">
          <div className="relative mb-[3px] grid h-4 gap-[3px] text-[10px] text-zinc-500" style={cols}>
            {monthLabels.map((m) => (
              <span key={m.col} className="whitespace-nowrap" style={{ gridColumnStart: m.col + 1 }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={cols}>
            {weeks.flat().map((d) => {
              const outside = d < first || d > last;
              const n = days[d]?.[0] ?? 0;
              const mcount = matches?.[d] ?? 0;
              const isSel = d === selected;
              const inMonth = d.startsWith(month);
              let bg: string = HEAT_BG[scale(n)];
              if (matches) bg = mcount ? SEARCH_BG[matchScale!(mcount)] : n ? "bg-white/[0.08]" : HEAT_BG[0];
              const label = `${shortDate(d)} · ${n} prompt${n === 1 ? "" : "s"}${matches ? ` · ${mcount} match${mcount === 1 ? "" : "es"}` : ""}`;
              return (
                <button
                  key={d}
                  type="button"
                  title={label}
                  aria-label={label}
                  disabled={outside}
                  onClick={() => onSelect(d)}
                  className={[
                    "aspect-square w-full rounded-[3px] transition-[transform,box-shadow] duration-100",
                    outside ? "invisible" : bg,
                    !outside && "hover:scale-125 hover:ring-1 hover:ring-white/60",
                    inMonth && !isSel && "ring-1 ring-white/15",
                    isSel && "relative z-10 scale-125 ring-2 ring-white",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export const YearHeatmap = memo(YearHeatmapImpl);
