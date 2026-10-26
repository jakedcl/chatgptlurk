# chatgptlurk

**[chatgptlurk.vercel.app](https://chatgptlurk.vercel.app)**

I export my ChatGPT data every so often and wanted to actually see it: when I was using it, how much, and what I was asking. So I built a calendar for it. Drop in your OpenAI export and you get a year heatmap of every prompt you've sent, a month view, a day-by-day list, search, and a way to read back through whole conversations.

Built with Next.js and TypeScript, using Cursor.

## Your data stays on your device

I didn't want anyone's chats (including mine) sitting on a server, so there isn't one.

- Your export is parsed right in the browser by a Web Worker. Nothing gets uploaded.
- The site is fully static: no API routes, no database, no accounts.
- After the first load, a small index (prompt text, time, conversation title) is cached in your browser's IndexedDB so a refresh doesn't make you re-upload. **Clear data** wipes it.

## How to use it

1. In ChatGPT, go to **Settings → Data controls → Export data**.
2. Download the zip from the email OpenAI sends you.
3. Drop the zip on the page (or pick `conversations.json` / `full-conversations.json` from inside it).

Some things you can do once it's loaded:

- Switch timezones. Days default to `America/New_York`, and changing it rebuckets everything instantly.
- Search across every prompt. Words match anywhere, and quotes match an exact phrase.
- Click any conversation title to read that chat's prompts in order, then step to the previous or next one.
- Get around with the keyboard: `←/→` day, `↑/↓` week, `Shift+←/→` next active day, `[` / `]` month, `/` search. In a conversation, `←/→` moves between chats and `Esc` goes back.

## Under the hood

The hardest part was big exports. Mine is about 150 MB of JSON, so the parser streams it inside a Web Worker and only holds one conversation at a time plus the prompt index. The page stays responsive the whole time.

The zip is unpacked in the browser with `fflate`. If the export has both `full-conversations.json` and `conversations.json`, it uses the full one, and it stitches together split `conversations-000.json` style parts when that's all there is.

OpenAI's format is a list of conversations, each with a tree (`mapping`) of messages. I pull only your own messages, skip hidden and system ones, and handle the odd cases: voice transcriptions come through as text, images show as `[image]`, files as `[file: name]`, and voice-only turns as `[voice message]`.

## Running it locally

Needs Node.js 20.9+.

```bash
npm install
npm run dev     # http://127.0.0.1:43123
npm test        # parser tests against a synthetic export
```

The sample export in `fixtures/` is fake data. Please don't commit a real one.
