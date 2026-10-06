"use client";

import { useState } from "react";
import type { Progress } from "@/lib/types";
import { formatBytes } from "@/lib/format";
import { Logo } from "./Logo";

type LandingProps = {
  timezone: string;
  timezones: string[];
  onTimezone: (tz: string) => void;
  onBrowse: () => void;
  onFile: (file: File) => void;
  error: string | null;
};

export function Landing({ timezone, timezones, onTimezone, onBrowse, onFile, error }: LandingProps) {
  const [over, setOver] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-12 sm:px-8 sm:py-16">
      <header className="mb-8 flex items-center gap-3">
        <Logo />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Prompt Calendar</h1>
          <p className="text-sm text-zinc-400">Your ChatGPT prompts, arranged by day.</p>
        </div>
      </header>

      <p className="max-w-2xl text-[15px] leading-7 text-zinc-300">
        Drop a ChatGPT data export and this page builds a calendar of the prompts you sent. Parsing happens in your
        browser. The file is not uploaded.
      </p>

      <section className="card mt-6 p-5 sm:p-6">
        <h2 className="text-sm font-medium text-zinc-200">Get your export</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-400">
          <li>In ChatGPT, open Settings → Data controls → Export data.</li>
          <li>Confirm the request, then download the zip from the email OpenAI sends.</li>
          <li>
            Drop that zip here, or pick <code className="text-zinc-200">conversations.json</code> or{" "}
            <code className="text-zinc-200">full-conversations.json</code> from inside it.
          </li>
        </ol>
      </section>

      <div
        className={[
          "mt-5 flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center transition",
          over ? "border-emerald-400/70 bg-emerald-400/10" : "border-white/15 bg-white/[0.03]",
        ].join(" ")}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
      >
        <p className="text-lg font-medium text-zinc-100">Drop your export</p>
        <p className="mt-1 text-sm text-zinc-500">.zip, conversations.json, or full-conversations.json</p>
        <button type="button" className="mt-5 h-10 rounded-lg bg-emerald-500 px-4 text-sm font-medium text-emerald-950 hover:bg-emerald-400" onClick={onBrowse}>
          Choose a file
        </button>
        <label className="mt-5 flex items-center gap-2 text-xs text-zinc-500">
          Bucket days in
          <select
            data-testid="timezone"
            value={timezone}
            onChange={(e) => onTimezone(e.target.value)}
            className="h-8 max-w-[220px] rounded-lg border border-white/10 bg-zinc-900 px-2 text-sm text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
            aria-label="Timezone"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      )}

      <section className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] px-5 py-4 text-sm leading-6 text-zinc-300">
        <p className="font-medium text-emerald-200">Files never leave this device.</p>
        <p className="mt-1 text-zinc-400">
          There is no account and no server copy. A refresh can reopen the calendar from IndexedDB in this browser.
          Clear data deletes that local copy. A file around 150 MB is parsed on a background thread so the page can keep
          moving. If the browser runs out of memory, you get an error and nothing is kept.
        </p>
      </section>
    </main>
  );
}

export function BootScreen() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6" aria-busy="true">
      <p className="text-sm text-zinc-300">Checking this browser for a saved calendar…</p>
      <p className="mt-2 text-xs text-zinc-500">Files never leave this device.</p>
      <div className="mt-6 space-y-3">
        <div className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
        <div className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" />
      </div>
    </main>
  );
}

const PHASE_LABEL: Record<Progress["phase"], string> = {
  read: "Reading your export",
  unzip: "Unzipping",
  parse: "Parsing conversations",
  save: "Saving on this device",
};

export function ParseScreen({
  fileName,
  progress,
  onCancel,
}: {
  fileName: string;
  progress: Progress;
  onCancel: () => void;
}) {
  const pct = progress.bytesTotal > 0 ? Math.min(100, Math.round((progress.bytesRead / progress.bytesTotal) * 100)) : 0;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{fileName}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{PHASE_LABEL[progress.phase]}</h1>
      <p className="mt-2 text-sm text-zinc-400" role="status" aria-live="polite">
        {progress.phase === "save"
          ? "Writing the calendar into IndexedDB. The export itself is not stored."
          : `${formatBytes(progress.bytesRead)} of ${formatBytes(progress.bytesTotal)} · ${progress.conversations.toLocaleString()} conversations · ${progress.prompts.toLocaleString()} prompts`}
      </p>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-200" style={{ width: `${progress.phase === "save" ? 100 : pct}%` }} />
      </div>
      <p className="mt-4 text-sm text-emerald-200/90">Files never leave this device.</p>
      <button type="button" data-testid="cancel-parse" className="text-btn mt-6 w-fit" onClick={onCancel}>
        Cancel
      </button>
    </main>
  );
}
