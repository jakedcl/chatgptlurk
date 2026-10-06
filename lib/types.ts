export type Prompt = {
  id: string;
  /** conversation id */
  c: string;
  /** conversation title */
  t: string;
  /** unix seconds (may include a fraction) */
  ts: number;
  /** ISO timestamp in the chosen timezone, e.g. 2024-06-15T14:05:00-04:00 */
  local: string;
  /** YYYY-MM-DD in the chosen timezone */
  date: string;
  /** HH:mm in the chosen timezone */
  time: string;
  text: string;
  voice?: boolean;
};

export type Summary = {
  generatedAt: string;
  timezone: string;
  source: string;
  totals: { prompts: number; conversations: number; activeDays: number; chars: number; voice: number };
  range: { first: string | null; last: string | null };
  busiest: { date: string; prompts: number; conversations: number }[];
  hours: number[];
  weekdays: number[];
  months: Record<string, number>;
  /** date -> [prompts, conversations] */
  days: Record<string, [number, number]>;
};

export type SearchHit = {
  id: string;
  /** conversation id */
  c: string;
  date: string;
  time: string;
  t: string;
  snippet: string;
  inTitle: boolean;
};

export type SearchResponse = {
  q: string;
  total: number;
  /** date -> number of matching prompts */
  days: Record<string, number>;
  hits: SearchHit[];
  truncated: boolean;
};

export type Progress = {
  phase: "read" | "unzip" | "parse" | "save";
  bytesRead: number;
  bytesTotal: number;
  conversations: number;
  prompts: number;
};

export type ParseResult = {
  sourceName: string;
  timezone: string;
  prompts: Prompt[];
  conversations: number;
  skippedHidden: number;
  skippedEmpty: number;
  skippedNoTime: number;
};

export type ParseRequest = {
  type: "parse";
  file: File;
  timezone: string;
};

export type WorkerOutbound =
  | { type: "progress"; progress: Progress }
  | { type: "done"; result: ParseResult }
  | { type: "error"; message: string };
