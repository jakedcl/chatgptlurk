import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { zipSync, strToU8 } from "fflate";
import { parseExportFile } from "./parse-file";
import { buildSummary } from "./summary";
import { DEFAULT_TIMEZONE } from "./time";

const fixture = readFileSync(new URL("../fixtures/sample-export.json", import.meta.url), "utf8");

function jsonFile(name: string, text: string) {
  return new File([text], name, { type: "application/json" });
}

test("parses the synthetic export in America/New_York", async () => {
  const result = await parseExportFile(jsonFile("conversations.json", fixture), DEFAULT_TIMEZONE);
  assert.equal(result.prompts.length, 5);
  assert.equal(result.conversations, 3);
  assert.ok(result.skippedHidden >= 2);

  const byId = Object.fromEntries(result.prompts.map((p) => [p.id, p]));
  assert.equal(byId["msg-sourdough"]?.date, "2024-06-15");
  assert.equal(byId["msg-sourdough"]?.time, "14:05");
  assert.equal(byId["msg-picture"]?.date, "2024-06-15");
  assert.match(byId["msg-picture"]?.text ?? "", /What is in this picture\?/);
  assert.match(byId["msg-picture"]?.text ?? "", /\[image ×2\]/);
  assert.equal(byId["msg-train"]?.date, "2024-06-15");
  assert.equal(byId["msg-train"]?.time, "20:30");
  assert.equal(byId["msg-train"]?.voice, true);
  assert.match(byId["msg-train"]?.text ?? "", /Beacon is delayed/);
  assert.match(byId["msg-train"]?.text ?? "", /\[file: timetable\.txt\]/);
  assert.equal(byId["msg-pack"]?.date, "2024-12-02");
  assert.equal(byId["msg-voice"]?.text, "[voice message]");
  assert.equal(byId["msg-voice"]?.voice, true);

  const joined = result.prompts.map((p) => p.text).join("\n");
  assert.doesNotMatch(joined, /hidden prompt/);
  assert.doesNotMatch(joined, /custom instructions/);
  assert.doesNotMatch(joined, /common practice/);
  assert.doesNotMatch(joined, /You are a baker/);

  const summary = buildSummary(result.prompts, DEFAULT_TIMEZONE, result.sourceName);
  assert.equal(summary.totals.prompts, 5);
  assert.equal(summary.totals.activeDays, 2);
  assert.equal(summary.range.first, "2024-06-15");
  assert.equal(summary.range.last, "2024-12-02");
  assert.equal(summary.days["2024-06-15"]?.[0], 3);
  assert.equal(summary.days["2024-12-02"]?.[0], 2);
});

test("moves the train note to June 16 in UTC", async () => {
  const result = await parseExportFile(jsonFile("conversations.json", fixture), "UTC");
  const train = result.prompts.find((p) => p.id === "msg-train");
  const bread = result.prompts.find((p) => p.id === "msg-sourdough");
  assert.equal(train?.date, "2024-06-16");
  assert.equal(train?.time, "00:30");
  assert.equal(bread?.date, "2024-06-15");
});

test("reads conversations.json from a zip and prefers full-conversations.json", async () => {
  const zip = zipSync({
    "chat.html": strToU8("<html><p>ignore this rendered transcript</p></html>"),
    "user.json": strToU8('{"id":"synthetic"}'),
    "conversations.json": strToU8(fixture),
    "nested/notes.txt": strToU8("not a conversation"),
  });
  const zipped = await parseExportFile(new File([zip], "chatgpt-export.zip", { type: "application/zip" }), DEFAULT_TIMEZONE);
  assert.equal(zipped.prompts.length, 5);
  assert.match(zipped.prompts.map((p) => p.text).join("\n"), /sourdough starter/);

  const both = zipSync({
    "conversations.json": strToU8(
      JSON.stringify([
        {
          id: "partial-only",
          title: "Partial",
          mapping: {
            a: {
              message: {
                id: "msg-partial",
                author: { role: "user" },
                create_time: 1718474700,
                content: { content_type: "text", parts: ["only in the partial export"] },
              },
            },
          },
        },
      ]),
    ),
    "full-conversations.json": strToU8(fixture),
  });
  const full = await parseExportFile(new File([both], "export.zip"), DEFAULT_TIMEZONE);
  const text = full.prompts.map((p) => p.text).join("\n");
  assert.match(text, /sourdough starter/);
  assert.doesNotMatch(text, /only in the partial export/);
  assert.equal(full.sourceName, "full-conversations.json");
});

test("reads a conversations wrapper object", async () => {
  const wrapped = JSON.stringify({
    conversations: JSON.parse(fixture),
  });
  const result = await parseExportFile(jsonFile("full-conversations.json", wrapped), DEFAULT_TIMEZONE);
  assert.equal(result.prompts.length, 5);
});

test("rejects a zip with no conversations file", async () => {
  const zip = zipSync({ "chat.html": strToU8("<html></html>") });
  await assert.rejects(
    () => parseExportFile(new File([zip], "empty.zip"), DEFAULT_TIMEZONE),
    /does not contain conversations\.json/,
  );
});
