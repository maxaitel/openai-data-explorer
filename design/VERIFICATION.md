# Bencho integration and verification

## Current interface

The current design follows the user’s minimalist correction: one centered Bencho upload card, a demo action and collapsed export help on a neutral charcoal background. Controls are light grey. The earlier generated workspace concept is historical, not the current upload specification.

Bencho MCP supplied Tab bar (Pro licence), Seek (MIT), Stacked bars (MIT) and Upload dropzone (MIT). These are integrated application components, not a redistributed component library. Tab bar controls the data source; Seek controls archive search; Stacked bars powers all four overview graph areas. Upload dropzone was adapted from its sample tray to real OS file selection and drag/drop. Spring transitions, scrub highlighting, rolling progress and reduced-motion handling are retained. Graphs support keyboard inspection. No decorative sample graph values are shown for user archives.

## Sound

Chart values map to a C-major pentatonic scale with a quiet harmonic, rounded attack, 240 ms decay and 75 ms note limit. Charts suppress generic interaction sounds. Upload, success and error have separate cues. A persistent mute prevents synthesis, including pending audio-resume callbacks. Playback requires browser user activation.

## Checks

`npm run check` passes: production build, lint (three existing Fast Refresh warnings in generated UI components), five archive tests and four Python tests. Vite reports the existing large application bundle warning.

Unit coverage includes active-branch counts, seconds/millisecond timestamps at the Auckland year boundary, deterministic demo totals and source splits, ZIP folder prefixes and attachment retrieval, malformed/unrelated JSON, and empty-source metrics.

Browser verification includes demo overview (240 fictional chats), a real ZIP import containing a fictional fixture, and the centered neutral upload card. Earlier graph checks covered keyboard inspection, topic drill-down, 390px mobile overflow, audio-node generation and muted interactions. No private archive or verification screenshot is published.
