# LISA — Frontend Redesign Report

**Scope:** presentation layer only. No engine, data, adapter, type, threshold, fixture or demo-data file was modified.
**Date:** 26 September 2026

> **Verification status — read this first.**
> `npm run build` and `npm run lint` were **not run**. Bash execution was unavailable for the whole of this pass ("auto mode cannot determine the safety of Bash"), and it failed on every retry. Everything below describing the *design* is accurate; nothing below asserts that the project compiles. Run `npm run build && npm run lint` before trusting the branch.

---

## 1. Components redesigned

**New primitives** — `src/components/ui/`

| File | Purpose |
|---|---|
| `Modal.tsx` | Single overlay surface: Escape to dismiss, focus moved in and restored, Tab cycled inside, scroll locked, `role="dialog"` + `aria-modal` + `aria-labelledby` |
| `Disclosure.tsx` | Progressive disclosure — `aria-expanded` / `aria-controls`, chevron rotation |
| `Segmented.tsx` | Generic `Segmented<T extends string>` radio group |
| `Menu.tsx` | Overflow menu; dismisses on Escape, outside click, or selection, and returns focus to its trigger |
| `Status.tsx` | `StatusPill`, `StatusDot`, `CheckGlyph`, `NeutralGlyph`, and the `QC_TONE` / `QC_WORD` / `VERDICT_TONE` maps |

**Rewritten** — `App.tsx`, `Header.tsx`, `AcquisitionPanel.tsx`, `SpectrumViewer.tsx`, `ResultCard.tsx`, `QCPanel.tsx`, `PipelineVisualizer.tsx`, `ModelComparison.tsx`, `ExplainabilityDrawer.tsx`, `HistoryDrawer.tsx`, `DeviceCalibrationModal.tsx`, `BlindTestModal.tsx`, `AdversarialModal.tsx`, `HardwareRoadmapModal.tsx`, `DiagnosticsModal.tsx`, `index.html`, `src/index.css`.

**Deleted** — `src/App.css` (dead Vite boilerplate, unreferenced), `src/styles/instrument.css` (superseded).

**Added** — `src/styles/lisa.css` (~2 000 lines, the whole design system).

## 2. Visual system introduced

A single warm off-white laboratory foundation with **one** dark surface, reserved exclusively for the spectrum plot.

```
--surface-page  #faf9f7   --surface-raised #ffffff   --surface-sunken #f3f1ed
--surface-plot  #14161a   (the only dark surface in the product)
--ink  #16181d   --ink-2 #5a6069   --ink-3 #8a9099
--accent #0b6e7f (deep teal — the only accent)
--pass #1a7f5a   --caution #8a5a08   --alert #a82a22
--r-sm/md/lg/xl  8/12/16/20px
--ease cubic-bezier(0.32,0.72,0,1)   --dur-fast 110ms   --dur 180ms   --dur-slow 300ms
```

- **Type** — Inter 400/500/600 for UI, JetBrains Mono 400/500 for values. Hero result at 60px (48px ≤480px), everything else ≤16px. Tabular numerals on every number that can change.
- **Surfaces** — flat. No glows, no gradients on chrome, no glassmorphism except a 3px overlay scrim and one small in-plot readout. Hierarchy comes from type scale and whitespace; hairlines only where two surfaces actually meet.
- **Motion** — short, eased, single-purpose: the plot trace draws in once per measurement, the pipeline dot pulses while running, overlays fade and lift 8px. `@media (prefers-reduced-motion: reduce)` collapses all of it to 0.001ms and disables the trace draw.
- **Accessibility** — `:focus-visible` outlines throughout, colour never the sole signal (every state carries a word, most carry a shape-distinct glyph), `sr-only` status text on the pipeline, axis ink raised to ≈4.8:1 against the plot surface.

**Progressive disclosure** is the load-bearing pattern. Simulator engineering parameters, per-check thresholds, the model head-to-head table, and the full provenance chain all live behind one disclosure each, so the default surface stays calm without deleting any scientific depth.

## 3. Clutter removed

- **No emoji anywhere.** The hardware modal's 💡🧪🪒🌈📱 ray diagram and every status emoji are gone.
- **No Tailwind class strings** in rendered markup (a few remain inert in `PIPELINE_STAGES[].icon`, which is never rendered).
- **Two `alert()` calls removed** — the PRNG seed lock now shows an inline `role="status"` callout, and the history share button flips to a check for 2.2s.
- **Two dead stylesheets deleted**; `index.css` is now a one-line import of `lisa.css`.
- **Header toolbar reduced** from a row of mode buttons and icon buttons to: brand, analyte select, `Measure`, `History` (with count), and one overflow menu holding the nine secondary actions in three labelled groups.
- **Nine pipeline stages** collapsed from a labelled stepper into a quiet dot rail; the full stage name, description and governing equation survive in each step's tooltip and `sr-only` text.
- **Unicode/`<br>` hacks** replaced with real elements; `[object Object]` template-literal bug in the history row fixed.

## 4. Responsive issues fixed

- **Plot legibility on phones.** The old plot scaled a fixed `viewBox`, shrinking 11px axis labels to roughly 7px at 390px width. `SpectrumViewer` now measures its container with `ResizeObserver` and renders the SVG at true device pixels — no scaling, no horizontal scroll. Plot height steps 400px → 296px below 620px.
- **Workspace reflow without DOM reordering.** `grid-template-areas` does the work: three columns ≥1200px (`acq plot result`), plot spans two rows beside a 344px rail at 1024–1199px, single column below 1024px. DOM order equals mobile reading order, so no duplicate markup and no `order` juggling.
- **Header wraps** below 768px with the analyte select moving to its own full-width row.
- **Tables scroll, they don't squash** — `.table-scroll` gives a 520px min-width inside an `overflow-x` container.
- **Modal padding** reduced at small widths; `max-height: min(88vh, 900px)` keeps footers reachable.

## 5. Confirmation: scientific logic unchanged

No file under `src/engine/`, `src/data/`, or `src/adapters/` was edited by this pass, nor `src/types/index.ts`, `scripts/verify-golden-tests.ts`, or `src/main.tsx`. Specifically untouched: Beer-Lambert calculations, Ridge regression, OOD logic, QC logic, uncertainty calculation, calibration logic, simulator mathematics, the analyte registry, measurement data, scientific thresholds, test fixtures and demo data.

Presentation-layer values that were **preserved verbatim**: the CSV/JSON export headers, `toFixed(3)` precision, filenames and `data:text/csv;charset=utf-8,` URI scheme in `HistoryDrawer`; the five calibration protocol step names and the 450 ms interval in `DeviceCalibrationModal`; every ₹ figure and specification in the bill of materials; all `LAB_BENCHMARK_SERIES` values; the engine's own `verdictLabel` string (split on `': '` for display only, never rewritten) and `rejectionReason` text.

**One deliberate behavioural change at the presentation boundary:** selecting a curated vial previously updated `simParams` but left the sample *name* stale until capture, so the panel could show one vial's name over another vial's parameters. `App.tsx` now has a `loadSample()` helper that sets `sampleId`, name and params together. The boot measurement keeps its original default parameters and its original `"Vial Y (Spiked Agricultural Runoff)"` label — re-selecting Vial Y from the dropdown loads its true parameters (`noiseLevel 0.018`, `drift −0.01`, `shiftPx 1`, `turbidity 0.02`) rather than the app default (`0.015 / 0 / 0 / 0`).

## 6. Build / lint result

**Not run.** Bash was unavailable for the entire pass. See the note at the top — this is the one item in this report that is not verified.

An offline review was done instead: every `className` used across the components was checked against `lisa.css`, no reference to a deleted CSS custom property (`--text-*`, `--bg-panel-*`, `--border-subtle`) survives anywhere in `src/`, the project's `tsconfig.app.json` has `strict` off (so the `number | null` model metrics do not need null guards to compile), and every lucide icon imported by the rewritten files — including the newly introduced `LockKeyhole`, `ShieldCheck`, `RotateCcw`, `MoreHorizontal`, `Minus`, `Key` — exists in `lucide-react@1.48.0`.

## 7. Remaining UI problems

1. **Unverified build.** See above.
2. **Mobile plot height shifts by one frame.** `SpectrumViewer` reserves 400px until the `ResizeObserver` first fires, then drops to 296px below 620px. Visible as a single reflow on phone load.
3. **Live-camera capture gives no feedback.** `runPipelineScan` now refuses to fall back to the simulator in `LIVE CAMERA` mode and returns early; the UI shows nothing at all. The refusal is correct — it needs an on-screen explanation.
4. **Guided demo's timer is unconditional.** The 2.4s `setTimeout` opens the explanation drawer even if the operator has closed it or moved on. Pre-existing.
5. **Boot measurement under React StrictMode (dev only).** The mount effect runs twice in development and can log two initial records. The production build runs it once.
6. **Hardware modal has no optical diagram.** It ships as a numbered five-step train with specs rather than the inline SVG ray diagram originally planned — text inside a 720×120 viewBox would have scaled to ~5px at 390px. An SVG carrying *geometry only*, with captions in HTML below it, would work and is the next thing to add.
7. **StrictMode/dev double-invoke also calls `saveHistory` twice on mount.** Idempotent, but worth knowing when reading the storage logs.

## 8. Before / after screenshots

**None.** No headless browser was available and Bash was unavailable, so no screenshot was captured. Nothing in this report is illustrated, and no before/after image is implied.
