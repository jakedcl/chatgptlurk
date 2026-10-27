# AGENTS.md — chatgptlurk

Prompt Calendar: a free, static site that turns your own ChatGPT data export into a year heatmap, month grid, day list, search, and conversation view. Files never leave the visitor's browser.

## Dev framework

This repo follows Jake's dev framework: [jakedcl/dev-framework](https://github.com/jakedcl/dev-framework) (start at its `AGENTS.md`). The framework is the source of truth; if anything in this file conflicts with it, the framework wins.

## Stack
- Next.js 16.3 with `output: "export"` (static site, `out/`), React 19.2, TypeScript, Tailwind CSS 4.
- `fflate` inflates the zip in the browser. A Web Worker parses it. IndexedDB stores a compact prompt index.
- Tests: node `--test` via tsx for `lib/*.test.ts`, Playwright for `e2e/`.
- Vercel Hobby, Next.js preset, no env vars. Pushes to `main` redeploy.

## Layout
- `app/` (single page). `components/` CalendarApp, YearHeatmap, MonthGrid, DayPanel, ConversationView, SearchBox, Landing.
- `lib/` parse-file, split-json, conversations, extract, search, dates/time, idb, worker-client. `workers/parse.worker.ts`.
- `fixtures/sample-export.json` is synthetic.

## Commands
- `npm run dev` (http://127.0.0.1:43123), `npm test`, `npm run test:e2e`, `npm run build`, `npx serve out -l 43123` to preview.

## Gotchas
- Privacy is the product. No API routes, server code, database, or uploads. Don't add any.
- Never commit a real `conversations.json` or export.
- Only `author.role === "user"` messages are kept. Hidden, system, and `user_editable_context` messages are skipped.
- Prefer `full-conversations.json`; otherwise combine `conversations-000.json` parts.
- Exports around 150 MB are streamed in the worker one conversation at a time. Don't load the whole file into memory.
- Days are bucketed in America/New_York by default. The timezone picker rebuckets in memory without rereading the file.
