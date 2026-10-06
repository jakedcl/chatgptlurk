export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0 B";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function formatChars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1e6).toFixed(1)}M characters typed`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}k characters typed`;
  return `${n.toLocaleString()} characters typed`;
}

export function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (/out of memory|invalid string length|allocation failed|array buffer allocation/i.test(raw)) {
    return "This export is too large for the browser's memory. Close other tabs and try again. Nothing was uploaded.";
  }
  if (/unknown compression|invalid zip|unexpected EOF|invalid uncompressed/i.test(raw)) {
    return "That zip could not be opened. Drop the original ChatGPT export, or unzip it and choose conversations.json.";
  }
  if (raw && raw.length < 400 && !raw.includes("\n")) return raw;
  return "Could not read that file. Choose a ChatGPT export zip, conversations.json, or full-conversations.json.";
}
