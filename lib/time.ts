export const DEFAULT_TIMEZONE = "America/New_York";

const formatters = new Map<string, Intl.DateTimeFormat>();

export function assertTimezone(tz: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(0);
  } catch {
    throw new Error(`“${tz}” is not a timezone this browser understands.`);
  }
}

export function listTimezones(): string[] {
  const fallback = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Toronto",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Australia/Sydney",
    "UTC",
  ];
  try {
    const all = Intl.supportedValuesOf("timeZone");
    const withUtc = all.includes("UTC") ? all : ["UTC", ...all];
    return withUtc.includes(DEFAULT_TIMEZONE) ? withUtc : [DEFAULT_TIMEZONE, ...withUtc];
  } catch {
    return fallback;
  }
}

function formatter(tz: string): Intl.DateTimeFormat {
  let fmt = formatters.get(tz);
  if (!fmt) {
    assertTimezone(tz);
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(tz, fmt);
  }
  return fmt;
}

export type LocalParts = {
  date: string;
  time: string;
  local: string;
  hour: number;
};

/** Wall-clock parts for a unix timestamp in an IANA timezone. */
export function localParts(unixSec: number, tz: string): LocalParts {
  const d = new Date(unixSec * 1000);
  const p = Object.fromEntries(formatter(tz).formatToParts(d).map((x) => [x.type, x.value]));
  let hour = p.hour ?? "00";
  // Some engines report midnight as 24:00 on the previous civil day.
  if (hour === "24") hour = "00";
  const date = `${p.year}-${p.month}-${p.day}`;
  const time = `${hour}:${p.minute}:${p.second}`;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +hour, +p.minute, +p.second);
  const offMin = Math.round((asUTC - Math.floor(unixSec) * 1000) / 60000);
  const sign = offMin >= 0 ? "+" : "-";
  const abs = Math.abs(offMin);
  const off = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  return { date, time: time.slice(0, 5), local: `${date}T${time}${off}`, hour: +hour };
}
