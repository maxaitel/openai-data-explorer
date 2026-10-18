# OpenAI Data Explorer

A private, browser-based ChatGPT and Codex export explorer. Open a ZIP or JSON export, or explore 240 seeded fictional conversations in demo mode. The dark interface uses Bencho upload, tabs, search and charts with optional musical feedback.

## Run

Requires Node.js 22.16+.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. No server, account or API key is required. `npm run build` produces a self-contained static site in `dist/`.

## Import and privacy

Exports are parsed in a browser Web Worker. Archive contents are never sent to the host. Fonts and scripts are bundled locally. The app automatically stores the original file in IndexedDB so it can reopen after a reload. Remove saved archive clears that copy. Browser storage limits vary; if saving fails, the archive remains available for the current visit. Demo mode uses synthetic data and does not replace a saved export.

Supported imports: export ZIPs and conversation JSON files. ZIPs have no fixed size cap: the reader accesses the file in slices and leaves attachments on disk until opened. ZIPs over 1 GB are supported. There are no fixed JSON-size, total-index-size or entry-count limits. Conversation arrays are parsed incrementally, including files wrapped in a `conversations` property. Normalized records still occupy browser memory; this is not an unlimited-memory database. Individual attachment previews remain limited to 128 MB. Very large exports may exceed device memory. HTML and other active archive documents are downloaded, never executed by the explorer.

Features include usage graphs, model and topic rankings, recaps, conversation search and original JSON, Codex, Pages, Sites, file previews/downloads, and available account/privacy metadata. Missing fields depend on the export version. Sound can be muted from the speaker control; the preference is remembered.

## Deployment — Cloudflare Pages

Connect the GitHub repository `maxaitel/openai-data-explorer` to Cloudflare Pages with:

- Production branch: `main`
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: `/`
- Node version: `22.16.0` (also pinned in `.node-version`)
- Custom domain: `openai-data.maxaitel.org`

Only the static `dist` directory is published. No Functions, database, paid runtime or archive uploads are needed. `public/_headers` supplies the production content security policy. Private local archives in `.data/` and QA screenshots in `.qa/` are gitignored and excluded from the build. Pushes to main trigger production builds when Git integration is enabled.

The Python/SQLite tools in `server/` remain optional local utilities (`npm run import -- /path/to/export.zip`); the deployed frontend does not use them.

## Calculation scope

Insights default to both ChatGPT and Codex, with a source selector shared by the overview and recap. ChatGPT counts visible user/assistant messages on the active branch, excluding discarded alternatives and system/tool messages. Codex counts user/assistant message items, excluding tool outputs, repository snapshots, and PR metadata. Codex tasks without dates contribute to all-time totals, topics, and rankings, but not annual views or activity/streaks. Missing model names appear as Unknown. Explorer message counts include other branches and roles, so they can differ. User prompt timestamps drive activity, active days, and streaks, normalized from seconds or milliseconds into Pacific/Auckland. Undated messages count toward totals but not time-based metrics. Annual views include chats created or active in that year; messages are filtered by message timestamp.

Model rankings count assistant replies using their model metadata, falling back to the conversation model. Topics are explicit keyword matches on titles, can overlap, and are not exhaustive semantic classifications. The export may omit history. Counts do not represent tokens, cost, or measured time spent.

## Checks

```sh
npm run check
```

This builds TypeScript/Vite, runs lint, five browser-import/calculation unit tests and four legacy Python tests (Python 3.10+ required only for those tests). See `design/VERIFICATION.md` for Bencho provenance and browser checks.
