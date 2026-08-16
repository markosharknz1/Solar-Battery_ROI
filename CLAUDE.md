# Solar & Battery Advisor - project brief for Claude

Client-side-only React app for AU households: import smart-meter CSVs and bill PDFs,
model time-of-use tariffs, simulate batteries, compare plans. **No backend, ever** -
the privacy stance is that usage data never leaves the device. Also ships as a
Windows desktop app (Electron wrapper).

Stack: React 18 + Vite + TypeScript, Tailwind v3 + shadcn/ui, Recharts, Zustand
(persist), PapaParse, pdfjs-dist, date-fns, React Router. Electron + electron-builder
for the installer.

## Layout

- `src/lib/` - all calculation engines, pure functions, no React:
  - `csvParser.ts` (3 meter formats: generic AU retailer, OVO 5-min, NEM12; + day-level `mergeMeterBuckets`)
  - `tariffCalculator.ts` (rate resolution incl. GST gross-up, public holidays), `dataProcessor.ts`
  - `batterySimulator.ts` (4-step loop: arbitrage -> curtailment -> solar -> peak discharge)
  - `billFields.ts` (PDF bill text -> fields + TOU rates; **pure, Node-testable** - pdfjs stays in `billPdfParser.ts` because its `?url` worker import is Vite-only)
  - `billToPlan.ts`, `billReconciliation.ts`, `seasonalAnalysis.ts`, `solarYield.ts`
  - `vpp.ts` (VPP program net-annual-value; programs live in `vppStore`, page `/vpp`,
    selected per battery quote - rebate reduces effective cost for payback)
- `src/store/` - Zustand stores. Interval data is session-only unless the user opts
  in via the keep-data toggle (`dataStore` persists meter buckets then and rebuilds
  intervals in persist's `merge()`). **Schema changes: bump the persist `version`,
  don't write migrations** (no real user base to migrate).
- `src/pages/`, `src/components/<area>/` - UI. No mode system (Simple/Advanced was
  removed in v1.4.0): one nav with input tabs (NEM data `/import`, Bills, Battery,
  VPP, Household `/household`) + analysis tabs (Overview, Tariffs, Compare, Analytics).
  `/` redirects to `/overview` (data loaded) or `/import` (fresh).
- `electron/main.js` - tiny embedded HTTP server with SPA fallback (BrowserRouter
  needs it), then a chromeless BrowserWindow. No node_modules ship in the asar.
  **The server port must stay fixed** (ladder starting at 8317): localStorage is
  origin-scoped INCLUDING the port, so a random port wipes all persisted state
  (plans, quotes, VPP programs) on every app launch.
- `build-installer.ps1` / `install.bat` / `build-and-install.bat` - build tooling,
  self-locating via `$PSScriptRoot`/`%~dp0`, auto-`npm install` when needed.
- `INSTALL.md` - user-facing install doc (written for GitHub novices; keep it that way).

## Domain conventions

- Days are 48 half-hour slots; `weekday` is 0=Mon..6=Sun (converted from JS Sunday-first).
- Tariff rates are stored in **dollars**/kWh with a `gstInclusive` flag per period/charge;
  UI shows cents. AGL bills itemise ex-GST, OVO/GloBird inclusive - detected per bill.
- Feed-in periods are never GST-grossed (FiT isn't subject to GST).
- CSV merge semantics: day-granularity, new import wins whole days (idempotent re-import).

## Working agreements (earned the hard way)

- **Verify before commit**: `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`,
  and a live browser click-through of what changed. Feedback docs may describe bugs
  that don't exist - check the actual code/runtime before "fixing".
- Money-math changes get ad hoc Node tests via `npx tsx <file>.temp.ts` from the repo
  root (tsx resolves the `@/` alias there); delete the temp file after. Bill-parser
  changes must be regression-run against the real bills in the owner's Downloads
  folder (AGL, GloBird dual-fuel + gas-only, OVO 2024 + 2025 layouts).
- Browser automation quirks: Radix Select/Tabs need real pointer-event sequences, not
  `.click()`; long-lived tabs accumulate stale HMR console errors - confirm errors in
  a fresh tab before debugging them.
- Commits explain the *why*; push to `main` on the private repo after user approval.

## Release process (how users install)

1. Bump `"version"` in package.json.
2. `powershell -File build-installer.ps1` (packages via %TEMP% - building inside the
   project tree hits a transient EPERM file lock on the owner's machine).
3. `gh release create v<X> "release/Solar & Battery Advisor Setup <X>.exe" --title "Solar & Battery Advisor <X>"`
4. Optionally `install.bat` to update the local install.
Users install from the Releases page only - the repo ZIP is not an installable app.

## Known gaps / backlog

- No standing automated test suite (all testing has been ad hoc tsx scripts + manual).
- Strategy Planner's accurate simulator honours only the first charge window (UI notes this).
- Solar yield is state-level averages, not postcode-precise (PVGIS API is the upgrade path).
- Bill TOU windows: OVO 2024 layout has no "when your rates apply" section, so plans
  built from those bills get all-day windows.
- Main bundle ~1MB; only ImportBillPage is code-split so far.
