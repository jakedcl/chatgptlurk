# Prompt Calendar

A public, free-to-host calendar of the prompts you sent ChatGPT. You upload your own OpenAI data export in the browser. The site turns it into a year heatmap, a month grid, a day list, and search.

## Privacy

**Files never leave the visitor's device.**

- The export is read in the browser. A Web Worker parses it. Nothing is posted to a server.
- This app has no API routes, no database, and no account. `output: 'export'` builds a static site, so the host only serves HTML, CSS, and JavaScript.
- The raw export is not written to disk by the app. After a successful parse, a compact index (prompt text, time, conversation title) is saved in **IndexedDB** in that browser so a refresh does not ask for the file again. That copy never leaves the device.
- **Clear data** deletes the IndexedDB database. Closing the tab does not upload anything.
- Do not commit a real `conversations.json`. The sample in `fixtures/` is synthetic.

## Run locally

Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

```bash
npm test          # parser unit tests, including a synthetic export
npm run build     # static files in out/
```

`npm run dev` is only a local dev server. It still does not receive the file. The production build is the `out/` folder. Preview it with any static file server, for example:

```bash
npx serve out -l 43123
```

## Use it

1. In ChatGPT, open **Settings → Data controls → Export data**.
2. Download the zip from the email OpenAI sends.
3. Drop the zip on the page, or choose `conversations.json` / `full-conversations.json` from inside it.

Days are bucketed in `America/New_York` until you pick another timezone. The picker rebuckets the prompts already in memory. It does not read the file again.

Search matches every word. Wrap a phrase in quotes for an exact match. Keyboard: `←/→` day, `↑/↓` week, `Shift+←/→` next active day, `[` / `]` month, `/` search.

Large exports (about 150 MB of JSON) are streamed in the worker so the page stays responsive. The parser keeps one conversation at a time, plus the prompt index. If the browser runs out of memory, the page shows an error and does not keep the file.

## Deploy on Vercel

Import this GitHub repo on the Vercel Hobby plan. Framework preset: Next.js. No environment variables. There is no serverless function and no file upload to Vercel. Pushes to `main` redeploy.

**Dashboard:** import `jakedcl/chatgptlurk`. Framework: Next.js. Leave environment variables empty. Deploy.

**CLI:**

```bash
npx vercel
```

`output: 'export'` in `next.config.ts` makes `next build` write static files to `out/`. Vercel serves those files. Do not add API routes that read exports, and do not put a real ChatGPT export in the repository.

## How parsing works

OpenAI's export is a JSON array of conversations (or an object with a `conversations` array). Each conversation has a `mapping` of messages. The parser keeps messages where `author.role === "user"`, skips `metadata.is_visually_hidden_from_conversation`, `is_user_system_message`, and `user_editable_context`, and skips empty messages. Text comes from string parts and `audio_transcription` objects. Images become `[image]`, other attachments become `[file: name]`, and voice-only turns become `[voice message]`.

A zip is inflated in the browser with `fflate`. If both `full-conversations.json` and `conversations.json` are present, the full file is used. `conversations-000.json` style parts are combined when no full file is present.
