import { friendlyError } from "./format";
import type { ParseRequest, ParseResult, Progress, WorkerOutbound } from "./types";

export type ParseJob = {
  promise: Promise<ParseResult>;
  cancel: () => void;
};

export function parseInWorker(file: File, timezone: string, onProgress: (progress: Progress) => void): ParseJob {
  if (typeof Worker === "undefined") {
    return {
      promise: Promise.reject(new Error("This browser cannot parse files in the background.")),
      cancel() {},
    };
  }

  const worker = new Worker(new URL("../workers/parse.worker.ts", import.meta.url));
  let settled = false;

  const promise = new Promise<ParseResult>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<WorkerOutbound>) => {
      const msg = event.data;
      if (!msg || settled) return;
      if (msg.type === "progress") onProgress(msg.progress);
      else if (msg.type === "done") {
        settled = true;
        worker.terminate();
        resolve(msg.result);
      } else if (msg.type === "error") {
        settled = true;
        worker.terminate();
        reject(new Error(msg.message));
      }
    };
    worker.onerror = (event) => {
      if (settled) return;
      settled = true;
      const message = friendlyError(event.message || "The browser stopped the parser.");
      worker.terminate();
      reject(
        new Error(
          event.message
            ? message
            : "The browser stopped the parser. This export may be too large for available memory. Close other tabs and try again. Nothing was uploaded.",
        ),
      );
    };
    const request: ParseRequest = { type: "parse", file, timezone };
    worker.postMessage(request);
  });

  return {
    promise,
    cancel() {
      if (settled) return;
      settled = true;
      worker.terminate();
    },
  };
}
