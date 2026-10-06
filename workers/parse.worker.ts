import { friendlyError } from "../lib/format";
import { parseExportFile } from "../lib/parse-file";
import type { ParseRequest, Progress, WorkerOutbound } from "../lib/types";

type WorkerScope = {
  addEventListener(type: "message", listener: (event: MessageEvent<ParseRequest>) => void): void;
  postMessage(message: WorkerOutbound): void;
};

const scope = globalThis as unknown as WorkerScope;

let lastPost = 0;
let pending: Progress | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function post(message: WorkerOutbound) {
  scope.postMessage(message);
}

function report(progress: Progress) {
  const now = Date.now();
  if (now - lastPost > 80) {
    lastPost = now;
    pending = null;
    post({ type: "progress", progress });
    return;
  }
  pending = progress;
  if (!timer) {
    timer = setTimeout(() => {
      timer = null;
      if (!pending) return;
      lastPost = Date.now();
      const next = pending;
      pending = null;
      post({ type: "progress", progress: next });
    }, 100);
  }
}

scope.addEventListener("message", (event: MessageEvent<ParseRequest>) => {
  const data = event.data;
  if (!data || data.type !== "parse" || !data.file) return;
  parseExportFile(data.file, data.timezone, report)
    .then((result) => {
      if (timer) clearTimeout(timer);
      post({ type: "done", result });
    })
    .catch((err: unknown) => {
      if (timer) clearTimeout(timer);
      post({ type: "error", message: friendlyError(err) });
    });
});
