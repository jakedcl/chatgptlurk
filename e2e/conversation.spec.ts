import { expect, test } from "@playwright/test";
import path from "node:path";

const fixture = path.join(process.cwd(), "fixtures", "sample-export.json");

test("conversation title opens prompts in order and back returns to the day", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Drop your export")).toBeVisible();
  await page.getByTestId("export-file").setInputFiles(fixture);
  await expect(page.getByTestId("stat-prompts")).toHaveText("5");

  await page.getByLabel("Jump to month").selectOption("2024-06");
  await page.getByRole("button", { name: "2024-06-15: 3 prompts" }).click();
  await page.getByTestId("day-panel").getByTestId("day-open-conversation").first().click();

  const view = page.getByTestId("conversation-view");
  await expect(view).toBeVisible();
  await expect(page.getByTestId("conversation-title")).toHaveText("Weekend bread plan");
  await expect(view).toContainText("How long should a practice sourdough starter ferment before the first loaf?");
  await expect(view).toContainText("What is in this picture?");
  await expect(view).toContainText("[image ×2]");
  await expect(view).not.toContainText("do not show this hidden prompt");
  await expect(view).not.toContainText("A week of daily feeds is a common practice.");
  const text = await view.innerText();
  expect(text.indexOf("sourdough starter")).toBeLessThan(text.indexOf("What is in this picture?"));
  await expect(page.getByTestId("conversation-prev")).toBeDisabled();

  await page.getByTestId("conversation-next").click();
  await expect(page.getByTestId("conversation-title")).toHaveText("Train schedule notes");
  await expect(view).toContainText("The noon train to Beacon is delayed.");
  await expect(view).toContainText("[file: timetable.txt]");

  await page.getByTestId("conversation-next").click();
  await expect(page.getByTestId("conversation-title")).toHaveText("December packing list");
  const december = await view.innerText();
  expect(december.indexOf("Pack a weekend bag")).toBeLessThan(december.indexOf("[voice message]"));

  await page.getByTestId("conversation-prev").click();
  await expect(page.getByTestId("conversation-title")).toHaveText("Train schedule notes");
  await page.getByTestId("conversation-back").click();
  await expect(page.getByTestId("day-panel")).toContainText("Saturday, June 15, 2024");
  await expect(page.getByTestId("day-panel")).toContainText("sourdough starter");
  await expect(page.getByTestId("conversation-view")).toHaveCount(0);

  await page.getByTestId("search-input").fill("Beacon");
  await expect(page.getByText(/matching prompt/)).toBeVisible();
  await page.getByTestId("search-open-conversation").click();
  await expect(page.getByTestId("conversation-title")).toHaveText("Train schedule notes");
  await expect(view).toContainText("Beacon is delayed");
  await page.getByTestId("conversation-back").click();
  await expect(page.getByTestId("day-panel")).toContainText("Beacon is delayed");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("day-panel").getByTestId("day-open-conversation").first().click();
  await expect(page.getByTestId("conversation-view")).toBeVisible();
  await expect(page.getByTestId("conversation-back")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
