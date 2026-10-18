# Verification

## Automated checks

- `npm run build`: TypeScript and Vite production build passes. Vite reports a bundle-size advisory.
- `npm run lint`: no errors; three existing shadcn Fast Refresh export warnings.
- `npm test`: four Python tests pass, covering timestamp normalization, active branches, year boundaries, streaks, source filtering, undated Codex messages, citation formats, and missing account records.

## Browser checks

- Desktop and mobile layouts render without document-width overflow.
- Both / ChatGPT / Codex selections update totals and recap; Both is the default.
- Codex records open in the Codex explorer; undated activity has an explicit empty state.
- Privacy values match the local archive, memory examples expand, and source links open the appropriate record.
- Privacy and source-filter flows have no application console errors. An unrelated missing favicon request was excluded.
- Earlier checks covered yearly and hourly activity, recap navigation and download, search, JSON inspection, and file previews.

Archive data, screenshots, database, and machine-specific configuration are excluded from this repository. Verification uses a local export; it does not establish compatibility with every export schema.
