/**
 * Pull conversation objects out of a ChatGPT export without holding the whole file.
 * Accepts a top-level array, or an object with a `conversations` array.
 * The callback receives one raw JSON object at a time; the caller should parse it
 * and drop it before the next object arrives.
 */

export type Splitter = {
  push(chunk: string): void;
  finish(): void;
};

const WS = new Set([" ", "\n", "\r", "\t", "\uFEFF"]);

export function createConversationSplitter(onObject: (json: string) => void): Splitter {
  let buf = "";
  let pos = 0;
  let phase:
    | "begin"
    | "array"
    | "element"
    | "object"
    | "colon"
    | "value"
    | "skipPrim"
    | "skipNest"
    | "done" = "begin";
  let inString = false;
  let escape = false;
  let depth = 0;
  let arrayDepth = 0;
  let elemStart = 0;
  let key = "";
  let capturingKey = false;

  function fail(message: string): never {
    throw new Error(message);
  }

  function compact() {
    if (phase === "element") {
      if (elemStart > 262_144) {
        buf = buf.slice(elemStart);
        pos -= elemStart;
        elemStart = 0;
      }
      return;
    }
    if (pos > 262_144) {
      buf = buf.slice(pos);
      pos = 0;
    }
  }

  function push(chunk: string) {
    if (!chunk || phase === "done") {
      if (chunk && phase === "done") {
        for (let i = 0; i < chunk.length; i++) {
          if (!WS.has(chunk[i]!)) {
            fail("This file has extra data after the conversation list.");
          }
        }
      }
      return;
    }
    buf += chunk;
    const n = buf.length;
    while (pos < n) {
      const c = buf[pos]!;

      if (inString) {
        if (escape) {
          escape = false;
          if (capturingKey) key += c;
        } else if (c === "\\") {
          escape = true;
        } else if (c === '"') {
          inString = false;
          if (capturingKey) {
            capturingKey = false;
            phase = "colon";
          } else if (phase === "value") {
            phase = "object";
          }
        } else if (capturingKey) {
          key += c;
        }
        pos++;
        continue;
      }

      if (c === '"') {
        if (phase === "object" && depth === 1) {
          inString = true;
          capturingKey = true;
          key = "";
          pos++;
          continue;
        }
        if (phase === "value") {
          inString = true;
          pos++;
          continue;
        }
        inString = true;
        pos++;
        continue;
      }

      if (phase === "begin") {
        if (WS.has(c)) {
          pos++;
          continue;
        }
        if (c === "[") {
          phase = "array";
          depth = 1;
          arrayDepth = 1;
          pos++;
          continue;
        }
        if (c === "{") {
          phase = "object";
          depth = 1;
          pos++;
          continue;
        }
        if (c === "<") {
          fail(
            "This looks like HTML, not a ChatGPT export. Drop the zip from OpenAI, or pick conversations.json inside it.",
          );
        }
        fail(
          "This file is not a ChatGPT conversations export. Choose conversations.json, full-conversations.json, or the zip that contains one of them.",
        );
      }

      if (phase === "array") {
        if (WS.has(c) || c === ",") {
          pos++;
          continue;
        }
        if (c === "]") {
          depth--;
          pos++;
          phase = arrayDepth === 1 ? "done" : "object";
          continue;
        }
        if (c === "{") {
          phase = "element";
          elemStart = pos;
          depth++;
          pos++;
          continue;
        }
        fail("This file is not a ChatGPT conversations export. The conversation list should be a JSON array of objects.");
      }

      if (phase === "element") {
        if (c === "{" || c === "[") depth++;
        else if (c === "}" || c === "]") {
          depth--;
          if (depth === arrayDepth) {
            const json = buf.slice(elemStart, pos + 1);
            if (json.length > 64_000_000) {
              fail("One conversation in this export is too large to parse in this browser.");
            }
            onObject(json);
            phase = "array";
          }
        }
        pos++;
        continue;
      }

      if (phase === "object") {
        if (WS.has(c) || c === ",") {
          pos++;
          continue;
        }
        if (c === "}") {
          depth--;
          pos++;
          if (depth === 0) phase = "done";
          continue;
        }
        fail("This file is not a ChatGPT conversations export. Expected a list of conversations.");
      }

      if (phase === "colon") {
        if (WS.has(c)) {
          pos++;
          continue;
        }
        if (c !== ":") fail("This file is not a ChatGPT conversations export. The JSON is malformed.");
        phase = "value";
        pos++;
        continue;
      }

      if (phase === "value") {
        if (WS.has(c)) {
          pos++;
          continue;
        }
        if (c === "[" && key === "conversations") {
          phase = "array";
          depth++;
          arrayDepth = depth;
          pos++;
          continue;
        }
        if (c === "{" || c === "[") {
          phase = "skipNest";
          depth++;
          pos++;
          continue;
        }
        if (c === '"') {
          inString = true;
          pos++;
          continue;
        }
        phase = "skipPrim";
        continue;
      }

      if (phase === "skipPrim") {
        if (c === "," || c === "}" || c === "]") {
          phase = "object";
          continue;
        }
        pos++;
        continue;
      }

      if (phase === "skipNest") {
        if (c === "{" || c === "[") depth++;
        else if (c === "}" || c === "]") {
          depth--;
          if (depth === 1) phase = "object";
        }
        pos++;
        continue;
      }

      if (phase === "done") {
        if (WS.has(c)) {
          pos++;
          continue;
        }
        fail("This file has extra data after the conversation list.");
      }
    }
    compact();
  }

  function finish() {
    if (phase === "begin") {
      if (!buf.trim()) fail("That file is empty.");
      fail(
        "This file is not a ChatGPT conversations export. Choose conversations.json, full-conversations.json, or the zip that contains one of them.",
      );
    }
    if (phase !== "done") {
      fail("This export looks incomplete. The file may have been cut off.");
    }
  }

  return { push, finish };
}
