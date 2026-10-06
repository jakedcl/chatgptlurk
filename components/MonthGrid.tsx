"use client";

import { memo, useMemo } from "react";
import { monthGrid, WEEKDAYS } from "@/lib/dates";
import { HEAT_BG, HEAT_TEXT } from "@/lib/heat";

type Props = {
  month: string;
  days: Record<string, [number, number]>;
  scale: (n: number) => 0 | 1 | 2 | 3 | 4 | 5;
  selected: string | null;
  today: string;
  matches: Record<string, number> | null;
  onSelect: (date: string) => void;
};

function MonthGridImpl({ month, days, scale, selected, today, matches, onSelect }: Props) {
  const cells = useMemo(() => monthGrid(month), [month]);
  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} className="min-h-[64px] rounded-xl sm:min-h-[92px]" />;
          const [n, convs] = days[d] ?? [0, 0];
          const lvl = scale(n);
          const isSel = d === selected;
          const m = matches?.[d] ?? 0;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(d)}
              aria-pressed={isSel}
              aria-label={`${d}: ${n} prompts`}
              className={[
                "group relative flex min-h-[64px] flex-col justify-between rounded-xl p-1.5 text-left transition sm:min-h-[92px] sm:p-2.5",
                HEAT_BG[lvl],
                n ? "hover:brightness-125" : "hover:bg-white/[0.07]",
                isSel ? "ring-2 ring-white shadow-[0_0_0_4px_rgba(255,255,255,0.08)]" : "ring-1 ring-inset ring-white/[0.04]",
                matches && !m ? "opacity-40" : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-1">
                <span
                  className={[
                    "text-xs font-medium tabular-nums",
                    d === today
                      ? "flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-zinc-900"
                      : n
                        ? HEAT_TEXT[lvl]
                        : "text-zinc-500",
                  ].join(" ")}
                >
                  {Number(d.slice(8))}
                </span>
                {m > 0 && (
                  <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-semibold leading-4 text-amber-950 tabular-nums">
                    {m}
                  </span>
                )}
              </div>
              {n > 0 && (
                <div className={HEAT_TEXT[lvl]}>
                  <div className="text-base font-semibold leading-none tabular-nums sm:text-2xl">{n}</div>
                  <div className="mt-0.5 hidden text-[10px] opacity-75 sm:block">
                    {convs} chat{convs === 1 ? "" : "s"}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const MonthGrid = memo(MonthGridImpl);
