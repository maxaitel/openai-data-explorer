# Bencho workspace rebuild

Reference: `bencho-workspace-concept.png`, generated with built-in Image Gen. Brief: a complete archive dashboard with charcoal navigation, white workspace, teal charts, mint peak panel, source tabs, statistics, rankings, and conversation table. The image is a reference; all application UI is real code.

## Bencho integration

Bencho MCP supplied Tab bar (Pro licence) and Seek (MIT), from https://bencho.dev. These are integrated application components, not a redistributed component library. Tab bar controls the data source with its spring-driven selection tile. Seek controls the debounced archive search with its original spring expansion. Removed the demo's mobile-keyboard suppression, added Escape focus restoration and tab resize synchronization. Both support reduced motion. Existing Radix controls retain dropdown/dialog accessibility. No new dependencies or backend changes.

## Verification

Used Codex in-app browser at 1536 × 1024, 1280 × 720, and 390 × 844. Captured browser screenshots and inspected the concept and final desktop using `view_image`. No fallback browser was needed.

- Both/ChatGPT switching changed real archive totals.
- Recap opened and advanced to the streak slide.
- Search expanded, accepted input, and returned matching records.
- A matching conversation opened; original JSON was readable.
- Empty search showed No results; Escape restored the search button.
- Privacy sections and file inventory loaded.
- Mobile document width was 390px, matching the viewport with no horizontal overflow.
- Browser error log was empty.

## Visual comparison

| Area | Evidence and resolution |
| --- | --- |
| Navigation | Charcoal rail, mint mark and grey selected row match the concept; mobile uses horizontal navigation. |
| Typography | Geist, strong headings and statistics, quieter metadata; explicit control and table sizes. |
| Palette | White canvas, teal charts and mint peak panel. Fixed inherited theme tokens that initially made bars grey. |
| Layout | Four open statistic columns, wide chart, narrower peak panel and paired rankings. Reduced excessive vertical spacing after comparison. |
| Controls | Actual Bencho spring interactions; corrected clipped inactive mobile source labels. |
| Content | Real archive values replace illustrative numbers. Kept existing coverage notes and supported table fields. |

Above-the-fold copy comparison: heading, navigation, actions, source choices and statistic labels match the intended surface. Intentional deviations: real dates/numbers, archive counts, undated-data note, actual model/topic names, retained activity grouping and explanatory labels. Date range is static text; the real time selector provides filtering. The layout is taller than the illustrative concept because coverage notes and six ranking rows remain. The implementation was visually verified against the concept with these functional adaptations; it is not a pixel-identical copy. No material unresolved visual defects in tested viewports.

## Checks

Build passes (existing large-bundle warning). Lint passes with three existing Fast Refresh export warnings in button/badge/tabs; no new Bencho warnings. All four backend tests pass. Final screenshot: `.data/bencho-preview.png`, gitignored because it contains archive data.
