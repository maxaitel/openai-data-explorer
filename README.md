# OpenAI Data Explorer

Local ChatGPT export explorer and usage recap. React, TypeScript, Vite, shadcn/ui, Recharts, and a Python/SQLite API.

## Run

Requires Node.js 22+ and Python 3.10+ with SQLite FTS5.

```sh
npm install
npm run import -- /absolute/path/to/export.zip
npm run dev
```

Open http://127.0.0.1:5173.

The API binds to 127.0.0.1:4311. Both processes stop together when `npm run dev` is stopped. Vite proxies `/api` requests. `npm run build` produces the frontend; the Python API is still required. `npm run preview` also proxies the API when that server is running.

## Features

- All-time and yearly usage, monthly/hourly activity, model rankings, title-based topics, active-day streaks, peak dates, and longest conversations.
- Six-slide recap with keyboard navigation, conversation drill-down, and text download.
- Full-text conversation search, model filters, sorting, pagination, readable messages, alternate branches, and expandable original JSON.
- Codex chats, Pages, site exports, account records, and Page history.
- Privacy overview of inferred ad interests, saved training flags, engagement metadata, memory citations, file provenance, and sharing records, with links to the source JSON. Availability depends on the export format.
- Every original archive file, including named attachments, media previews, safe text previews, and downloads.

## Data and calculation scope

Private data lives under gitignored `.data/`. The original ZIP remains in its original location and is needed for file previews/downloads. The SQLite index stores all JSON records and the file inventory; it never extracts or executes archived code or HTML. Reimport if you move the ZIP. No external services or model API calls are used. Fonts are bundled locally.

Insights default to both ChatGPT and Codex, with a source selector shared by the overview and recap. ChatGPT counts visible user/assistant messages on the active branch, excluding discarded alternatives and system/tool messages. Codex counts user/assistant message items, excluding tool outputs, repository snapshots, and PR metadata. Codex tasks without dates contribute to all-time totals, topics, and rankings, but not annual views or activity/streaks. Missing model names appear as Unknown. Explorer message counts include other branches and roles, so they can differ. User prompt timestamps drive activity, active days, and streaks, normalized from seconds or milliseconds into Pacific/Auckland. Undated messages count toward totals but not time-based metrics. Annual views include chats created or active in that year; messages are filtered by message timestamp.

Model rankings count assistant replies using their model metadata, falling back to the conversation model. Topics are explicit keyword matches on titles, can overlap, and are not exhaustive semantic classifications. The export may omit history. Counts do not represent tokens, cost, or measured time spent.

## Checks

```sh
npm run build
npm run lint
npm test
```

Tests cover mixed timestamps, midnight/year boundaries, active branches, model attribution, and streaks. Browser checks cover responsive layouts, period/activity selectors, recap progression, search, JSON inspection, conversation drill-down, and image preview.
