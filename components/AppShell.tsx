"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { indexConversations, type ConversationIndex } from "@/lib/conversations";
import { clearLibrary, loadLibrary, saveLibrary, storageErrorNote } from "@/lib/idb";
import { friendlyError } from "@/lib/format";
import { buildSummary, rebucketPrompts } from "@/lib/summary";
import { DEFAULT_TIMEZONE, listTimezones } from "@/lib/time";
import type { ParseResult, Progress, Prompt, Summary } from "@/lib/types";
import { parseInWorker, type ParseJob } from "@/lib/worker-client";
import { CalendarApp } from "./CalendarApp";
import { BootScreen, Landing, ParseScreen } from "./Landing";

type Library = {
  prompts: Prompt[];
  conversations: ConversationIndex;
  summary: Summary;
  sourceName: string;
  persisted: boolean;
  persistNote: string | null;
  sessionId: number;
  skippedHidden: number;
};

type Status = { kind: "boot" } | { kind: "empty" } | { kind: "parsing"; fileName: string; progress: Progress } | { kind: "ready" };

type Nav = { date: string | null; q: string; conversation: string | null };

function readNav(): Nav {
  const url = new URL(window.location.href);
  const date = url.searchParams.get("date");
  const conversation = url.searchParams.get("c");
  return {
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    q: url.searchParams.get("q") ?? "",
    conversation: conversation && conversation.length <= 500 ? conversation : null,
  };
}

function clearNav() {
  const url = new URL(window.location.href);
  url.searchParams.delete("date");
  url.searchParams.delete("q");
  url.searchParams.delete("c");
  window.history.replaceState(null, "", url);
}

export function AppShell() {
  const timezones = useMemo(() => listTimezones(), []);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [status, setStatus] = useState<Status>({ kind: "boot" });
  const [library, setLibrary] = useState<Library | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [nav, setNav] = useState<Nav>({ date: null, q: "", conversation: null });
  const [tzBusy, setTzBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const jobRef = useRef<ParseJob | null>(null);
  const genRef = useRef(0);
  const tzGen = useRef(0);
  const libraryRef = useRef<Library | null>(null);

  useEffect(() => {
    libraryRef.current = library;
  }, [library]);

  useEffect(() => {
    let cancel = false;
    loadLibrary()
      .then(async (saved) => {
        if (cancel || genRef.current !== 0) return;
        const urlNav = readNav();
        if (!saved || saved.prompts.length === 0) {
          setNav(urlNav);
          setStatus({ kind: "empty" });
          return;
        }
        const tz = timezones.includes(saved.timezone) ? saved.timezone : DEFAULT_TIMEZONE;
        const prompts = tz === saved.timezone ? saved.prompts : await rebucketPrompts(saved.prompts, tz);
        if (cancel) return;
        setTimezone(tz);
        setNav(urlNav);
        setLibrary({
          prompts,
          conversations: indexConversations(prompts),
          summary: buildSummary(prompts, tz, saved.sourceName),
          sourceName: saved.sourceName,
          persisted: true,
          persistNote: null,
          sessionId: 1,
          skippedHidden: 0,
        });
        setStatus({ kind: "ready" });
      })
      .catch(() => {
        if (!cancel) setStatus({ kind: "empty" });
      });
    return () => {
      cancel = true;
    };
  }, [timezones]);

  const handleFile = useCallback(
    (file: File) => {
      setBanner(null);
      const gen = ++genRef.current;
      jobRef.current?.cancel();
      const progress: Progress = {
        phase: "read",
        bytesRead: 0,
        bytesTotal: file.size,
        conversations: 0,
        prompts: 0,
      };
      setStatus({ kind: "parsing", fileName: file.name || "export", progress });
      const job = parseInWorker(file, timezone, (next) => {
        if (genRef.current !== gen) return;
        setStatus({ kind: "parsing", fileName: file.name || "export", progress: next });
      });
      jobRef.current = job;
      job.promise
        .then(async (result: ParseResult) => {
          if (genRef.current !== gen) return;
          if (!result.prompts.length) {
            setStatus(libraryRef.current ? { kind: "ready" } : { kind: "empty" });
            setBanner("That file parsed, but it has no user prompts. Assistant replies and hidden system messages are skipped.");
            return;
          }
          setStatus({
            kind: "parsing",
            fileName: file.name || "export",
            progress: {
              phase: "save",
              bytesRead: file.size,
              bytesTotal: file.size,
              conversations: result.conversations,
              prompts: result.prompts.length,
            },
          });
          const summary = buildSummary(result.prompts, timezone, result.sourceName);
          let persisted = true;
          let persistNote: string | null = null;
          try {
            await saveLibrary({ prompts: result.prompts, timezone, sourceName: result.sourceName });
          } catch (err) {
            persisted = false;
            persistNote = storageErrorNote(err);
          }
          if (genRef.current !== gen) return;
          const sessionId = (libraryRef.current?.sessionId ?? 0) + 1;
          setLibrary({
            prompts: result.prompts,
            conversations: indexConversations(result.prompts),
            summary,
            sourceName: result.sourceName,
            persisted,
            persistNote,
            sessionId,
            skippedHidden: result.skippedHidden,
          });
          setNav({ date: null, q: "", conversation: null });
          setStatus({ kind: "ready" });
        })
        .catch((err: unknown) => {
          if (genRef.current !== gen) return;
          const message = friendlyError(err);
          if (/cancel/i.test(message)) return;
          setStatus(libraryRef.current ? { kind: "ready" } : { kind: "empty" });
          setBanner(message);
        });
    },
    [timezone],
  );

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      event.preventDefault();
      handleFile(file);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFile]);

  function cancelParse() {
    genRef.current++;
    jobRef.current?.cancel();
    setStatus(libraryRef.current ? { kind: "ready" } : { kind: "empty" });
  }

  async function changeTimezone(tz: string) {
    setTimezone(tz);
    const current = libraryRef.current;
    if (!current) return;
    const gen = ++tzGen.current;
    setTzBusy(true);
    try {
      const prompts = await rebucketPrompts(current.prompts, tz);
      if (tzGen.current !== gen) return;
      const summary = buildSummary(prompts, tz, current.sourceName);
      setLibrary({ ...current, prompts, summary, conversations: indexConversations(prompts) });
      try {
        await saveLibrary({ prompts, timezone: tz, sourceName: current.sourceName });
        if (tzGen.current !== gen) return;
        setLibrary((lib) => (lib ? { ...lib, persisted: true, persistNote: null } : lib));
      } catch (err) {
        if (tzGen.current !== gen) return;
        setLibrary((lib) => (lib ? { ...lib, persisted: false, persistNote: storageErrorNote(err) } : lib));
      }
    } finally {
      if (tzGen.current === gen) setTzBusy(false);
    }
  }

  async function clearData() {
    genRef.current++;
    jobRef.current?.cancel();
    try {
      await clearLibrary();
    } catch {
      setBanner("Could not delete the local copy. Try again.");
      return;
    }
    setLibrary(null);
    setBanner(null);
    setNav({ date: null, q: "", conversation: null });
    clearNav();
    setStatus({ kind: "empty" });
  }

  return (
    <>
      <input
        ref={fileRef}
        data-testid="export-file"
        type="file"
        accept=".json,.zip,application/json,application/zip,application/x-zip-compressed"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) handleFile(file);
        }}
      />
      {status.kind === "boot" && <BootScreen />}
      {status.kind === "parsing" && <ParseScreen fileName={status.fileName} progress={status.progress} onCancel={cancelParse} />}
      {status.kind === "empty" && (
        <Landing
          timezone={timezone}
          timezones={timezones}
          onTimezone={setTimezone}
          onBrowse={() => fileRef.current?.click()}
          onFile={handleFile}
          error={banner}
        />
      )}
      {status.kind === "ready" && library && (
        <>
          {banner && (
            <p className="mx-auto mt-4 max-w-[1440px] px-4 text-sm text-amber-200 sm:px-6" role="alert">
              {banner}
            </p>
          )}
          <CalendarApp
            key={library.sessionId}
            summary={library.summary}
            prompts={library.prompts}
            conversations={library.conversations}
            timezone={timezone}
            timezones={timezones}
            sourceName={library.sourceName}
            persisted={library.persisted}
            persistNote={library.persistNote}
            skippedHidden={library.skippedHidden}
            initialDate={nav.date}
            initialQuery={nav.q}
            initialConversation={nav.conversation}
            tzBusy={tzBusy}
            onTimezone={changeTimezone}
            onBrowse={() => fileRef.current?.click()}
            onClear={() => void clearData()}
          />
        </>
      )}
    </>
  );
}
