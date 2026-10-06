/** Quantile thresholds over non-zero day counts → levels 0..5 */
export function makeScale(counts: number[]) {
  const s = counts.filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p: number) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 1);
  const t = [q(0.25), q(0.5), q(0.75), q(0.92)];
  return (n: number): 0 | 1 | 2 | 3 | 4 | 5 => {
    if (!n) return 0;
    if (n <= t[0]) return 1;
    if (n <= t[1]) return 2;
    if (n <= t[2]) return 3;
    if (n <= t[3]) return 4;
    return 5;
  };
}

export const HEAT_BG = [
  "bg-white/[0.035]",
  "bg-emerald-950",
  "bg-emerald-900",
  "bg-emerald-700",
  "bg-emerald-500",
  "bg-emerald-300",
] as const;

export const HEAT_TEXT = [
  "text-zinc-600",
  "text-emerald-200/80",
  "text-emerald-100",
  "text-white",
  "text-emerald-950",
  "text-emerald-950",
] as const;
