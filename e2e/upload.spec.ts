import { expect, test } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";

const fixture = path.join(process.cwd(), "fixtures", "sample-export.json");

test("landing explains the export and keeps the file on device", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Drop your export")).toBeVisible();
  await expect(page.getByText("Files never leave this device.")).toBeVisible();
  await expect(page.getByText("Settings → Data controls → Export data")).toBeVisible();
  await expect(page.getByText(/sourdough/i)).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});

test("upload shows days and prompts, persists locally, then clears", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Drop your export")).toBeVisible();
  await page.getByTestId("export-file").setInputFiles(fixture);

  await expect(page.getByTestId("stat-prompts")).toHaveText("5");
  await expect(page.getByText("Pack a weekend bag for a fictional city break.")).toBeVisible();
  await expect(page.getByText("[voice message]")).toBeVisible();
  await expect(page.getByText("do not show this hidden prompt")).toHaveCount(0);
  await expect(page.getByText("A week of daily feeds is a common practice.")).toHaveCount(0);

  await page.getByLabel("Jump to month").selectOption("2024-06");
  await page.getByRole("button", { name: "2024-06-15: 3 prompts" }).click();
  await expect(page.getByTestId("day-panel")).toContainText(
    "How long should a practice sourdough starter ferment before the first loaf?",
  );
  await expect(page.getByTestId("day-panel")).toContainText("What is in this picture?");
  await expect(page.getByTestId("day-panel")).toContainText("[image ×2]");
  await expect(page.getByTestId("day-panel")).toContainText("The noon train to Beacon is delayed.");
  await expect(page.getByTestId("day-panel")).toContainText("[file: timetable.txt]");

  await page.getByTestId("search-input").fill("Beacon");
  await expect(page.getByText(/matching prompt/)).toBeVisible();
  await page.getByTestId("search-input").press("Enter");
  await expect(page.getByTestId("day-panel")).toContainText("Beacon is delayed");

  await page.reload();
  await expect(page.getByTestId("stat-prompts")).toHaveText("5");
  await expect(page.getByText(/saved in IndexedDB/)).toBeVisible();

  await page.getByTestId("timezone").selectOption("UTC");
  await page.getByLabel("Jump to month").selectOption("2024-06");
  await page.getByRole("button", { name: "2024-06-16: 1 prompts" }).click();
  await expect(page.getByTestId("day-panel")).toContainText("Beacon is delayed");
  await page.getByRole("button", { name: "2024-06-15: 2 prompts" }).click();
  await expect(page.getByTestId("day-panel")).not.toContainText("Beacon is delayed");
  await expect(page.getByTestId("day-panel")).toContainText("sourdough starter");

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.getByTestId("clear-data").click();
  await page.getByTestId("confirm-clear").click();
  await expect(page.getByText("Drop your export")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Drop your export")).toBeVisible();
  await expect(page.getByTestId("stat-prompts")).toHaveCount(0);
});

test("upload a zip that contains conversations.json", async ({ page }) => {
  const zipPath = path.join(tmpdir(), "prompt-calendar-sample.zip");
  const zipped = zipSync({
    "chat.html": strToU8("<html><p>ignore</p></html>"),
    "conversations.json": strToU8(readFileSync(fixture, "utf8")),
  });
  writeFileSync(zipPath, Buffer.from(zipped));

  await page.goto("/");
  await expect(page.getByText("Drop your export")).toBeVisible();
  await page.getByTestId("export-file").setInputFiles(zipPath);
  await expect(page.getByTestId("stat-prompts")).toHaveText("5");
  await expect(page.getByText("Pack a weekend bag for a fictional city break.")).toBeVisible();
});
