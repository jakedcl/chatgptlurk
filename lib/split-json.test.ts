import assert from "node:assert/strict";
import test from "node:test";
import { createConversationSplitter } from "./split-json";

function split(input: string): string[] {
  const out: string[] = [];
  const splitter = createConversationSplitter((json) => out.push(json));
  const mid = Math.max(1, Math.floor(input.length / 2));
  splitter.push(input.slice(0, mid));
  splitter.push(input.slice(mid));
  splitter.finish();
  return out;
}

test("splits a top-level array, including braces inside strings", () => {
  const raw = '[{"id":"a","text":"brace } and ]"},{"id":"b","n":2}]';
  const objects = split(raw).map((json) => JSON.parse(json) as { id: string });
  assert.deepEqual(
    objects.map((o) => o.id),
    ["a", "b"],
  );
});

test("reads a conversations array on a wrapper object and skips other keys", () => {
  const raw = `{
    "user": { "email": "not-a-real-person@example.com", "note": "has ] { braces" },
    "conversations": [
      { "id": "one", "mapping": {} },
      { "id": "two", "mapping": {} }
    ],
    "tail": true
  }`;
  const objects = split(raw).map((json) => JSON.parse(json) as { id: string });
  assert.deepEqual(
    objects.map((o) => o.id),
    ["one", "two"],
  );
});

test("rejects html and truncated json", () => {
  const html = createConversationSplitter(() => {});
  assert.throws(() => {
    html.push("<!doctype html>");
    html.finish();
  }, /HTML/);

  const cut = createConversationSplitter(() => {});
  assert.throws(() => {
    cut.push('[{"id":"only"');
    cut.finish();
  }, /incomplete/);
});

test("accepts an empty conversation list", () => {
  const out: string[] = [];
  const splitter = createConversationSplitter((json) => out.push(json));
  splitter.push("  [ ]  ");
  splitter.finish();
  assert.deepEqual(out, []);
});
