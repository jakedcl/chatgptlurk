import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { adjacentConversation, getConversation, indexConversations } from "./conversations";
import { parseExportFile } from "./parse-file";
import { DEFAULT_TIMEZONE } from "./time";
import type { Prompt } from "./types";

function prompt(partial: Pick<Prompt, "id" | "c" | "t" | "ts" | "date" | "text"> & Partial<Prompt>): Prompt {
  return {
    local: `${partial.date}T00:00:00Z`,
    time: "00:00",
    ...partial,
  };
}

test("groups prompts by conversation without copying or reordering the source list", () => {
  const first = prompt({ id: "a2", c: "a", t: "Old name", ts: 30, date: "2024-01-03", time: "08:00", text: "later a" });
  const earlyB = prompt({ id: "b2", c: "b", t: "Beta", ts: 20, date: "2024-01-02", time: "01:00", text: "later b" });
  const earlyA = prompt({ id: "a1", c: "a", t: "Alpha", ts: 10, date: "2024-01-01", time: "09:00", text: "first a" });
  const lateB = prompt({ id: "b1", c: "b", t: "Beta", ts: 15, date: "2024-01-01", time: "12:00", text: "early b" });
  const prompts = [first, earlyB, earlyA, lateB];
  const sourceIds = prompts.map((p) => p.id);

  const index = indexConversations(prompts);

  assert.deepEqual(prompts.map((p) => p.id), sourceIds);
  assert.deepEqual(
    index.order.map((group) => group.id),
    ["a", "b"],
  );
  assert.equal(index.order[0]?.position, 0);
  assert.equal(index.order[1]?.position, 1);
  assert.equal(getConversation(index, "a"), index.order[0]);
  assert.deepEqual(
    getConversation(index, "a")?.prompts.map((p) => p.id),
    ["a1", "a2"],
  );
  assert.deepEqual(
    getConversation(index, "b")?.prompts.map((p) => p.id),
    ["b1", "b2"],
  );
  assert.equal(getConversation(index, "a")?.prompts[0], earlyA);
  assert.equal(getConversation(index, "a")?.title, "Old name");
  assert.equal(getConversation(index, "a")?.start, 10);
  assert.equal(getConversation(index, "a")?.end, 30);
  assert.equal(getConversation(index, "a")?.firstDate, "2024-01-01");
  assert.equal(getConversation(index, "a")?.lastDate, "2024-01-03");
  assert.equal(adjacentConversation(index, "a", 1)?.id, "b");
  assert.equal(adjacentConversation(index, "a", -1), null);
  assert.equal(adjacentConversation(index, "b", -1)?.id, "a");
  assert.equal(adjacentConversation(index, "b", 1), null);
  assert.equal(adjacentConversation(index, "missing", 1), null);
  assert.equal(getConversation(index, "missing"), null);
});

test("breaks start-time ties by conversation id and prompt ties by prompt id", () => {
  const index = indexConversations([
    prompt({ id: "m2", c: "m", t: "  ", ts: 5, date: "2024-02-01", text: "second" }),
    prompt({ id: "m1", c: "m", t: "Em", ts: 5, date: "2024-02-01", text: "first" }),
    prompt({ id: "a1", c: "a", t: "Ay", ts: 5, date: "2024-02-01", text: "only" }),
  ]);
  assert.deepEqual(
    index.order.map((group) => group.id),
    ["a", "m"],
  );
  assert.deepEqual(
    getConversation(index, "m")?.prompts.map((p) => p.id),
    ["m1", "m2"],
  );
  assert.equal(getConversation(index, "m")?.title, "Em");
});

test("returns an empty index for no prompts", () => {
  const index = indexConversations([]);
  assert.equal(index.order.length, 0);
  assert.equal(getConversation(index, "a"), null);
  assert.equal(adjacentConversation(index, "a", -1), null);
});

test("groups the synthetic export in conversation order", async () => {
  const fixture = readFileSync(new URL("../fixtures/sample-export.json", import.meta.url), "utf8");
  const result = await parseExportFile(new File([fixture], "conversations.json", { type: "application/json" }), DEFAULT_TIMEZONE);
  const index = indexConversations(result.prompts);

  assert.deepEqual(
    index.order.map((group) => group.id),
    ["conv-bread", "conv-train", "conv-december"],
  );
  assert.deepEqual(
    index.order.map((group) => group.title),
    ["Weekend bread plan", "Train schedule notes", "December packing list"],
  );
  assert.deepEqual(
    getConversation(index, "conv-bread")?.prompts.map((p) => p.id),
    ["msg-sourdough", "msg-picture"],
  );
  assert.deepEqual(
    getConversation(index, "conv-train")?.prompts.map((p) => p.id),
    ["msg-train"],
  );
  assert.deepEqual(
    getConversation(index, "conv-december")?.prompts.map((p) => p.id),
    ["msg-pack", "msg-voice"],
  );
  assert.equal(getConversation(index, "conv-bread")?.firstDate, "2024-06-15");
  assert.equal(getConversation(index, "conv-december")?.firstDate, "2024-12-02");
  assert.equal(adjacentConversation(index, "conv-train", -1)?.id, "conv-bread");
  assert.equal(adjacentConversation(index, "conv-train", 1)?.id, "conv-december");
  const joined = index.order.flatMap((group) => group.prompts.map((p) => p.text)).join("\n");
  assert.doesNotMatch(joined, /hidden prompt/);
  assert.doesNotMatch(joined, /common practice/);
});
