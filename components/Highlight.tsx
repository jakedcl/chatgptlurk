"use client";

import { Fragment, useMemo } from "react";

export function queryTerms(q: string): string[] {
  const s = q.trim();
  if (s.length < 2) return [];
  if (/^".+"$/.test(s)) return [s.slice(1, -1)];
  return s.split(/\s+/).filter((t) => t.length > 0);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const parts = useMemo(() => {
    if (!terms.length) return null;
    const re = new RegExp(`(${terms.map(esc).sort((a, b) => b.length - a.length).join("|")})`, "gi");
    return text.split(re);
  }, [text, terms]);
  if (!parts) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-amber-400/90 px-0.5 text-amber-950">
            {p}
          </mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
