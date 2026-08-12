# Solar & Battery Advisor

A client-side React web app that helps Australian households analyse their smart
meter interval data, model time-of-use tariffs, simulate battery storage, compare
power plans, and understand their solar generation.

**Privacy guarantee:** there is no backend. Usage data is parsed and processed
entirely in your browser and is never uploaded anywhere. Only settings (tariff
plans, battery quotes, household profile) are saved to `localStorage` on your
device; usage data must be re-imported each session.

## Features

- **Simple mode** — upload a CSV and get a quick "is a battery worth it?" verdict
- **Advanced mode** — full multi-page app: Import, Tariffs, Battery, Compare, Analytics
- CSV import for common AU retailer interval exports, AEMO NEM12 files, and solar
  inverter exports (SolarEdge, Fronius, SMA, Goodwe, Growatt)
- Time-of-use tariff modelling with fixed charges, feed-in periods, controlled
  loads, and public holiday handling
- Battery simulator with solar/arbitrage charging strategies, curtailment capture,
  cycle/warranty analysis, and backup-power estimates
- Tariff plan comparison (auto-ranked and manual) and real-bill provider comparison
- Usage analytics: heatmaps, daily profiles, seasonality, solar self-consumption
- Shareable comparison links (settings only, never usage data) and offline/PWA support

## Tech stack

React 18 + Vite + TypeScript, Tailwind CSS + shadcn/ui, Recharts, Zustand,
PapaParse, date-fns, React Router.

## Installing the desktop app

**See [INSTALL.md](INSTALL.md) for exact step-by-step instructions.** The short
version: download the Setup `.exe` from the **[Releases page](../../releases/latest)**
and run it - the target PC needs nothing else (no Node.js, no repository).
The repository ZIP is source code, not an installable app; its `.bat`/`.ps1`
files are build tools that require Node.js.

## Development installation

**Requirements:** [Node.js](https://nodejs.org/) 18 or later (includes npm).

```bash
git clone https://github.com/markosharknz1/Solar-Battery_ROI.git
cd Solar-Battery_ROI
npm install
```

## Running locally

```bash
npm run dev
```

Opens the dev server at `http://localhost:5173` (or the next free port). From
there you can click **Try with sample data** on the home page to explore the app
without your own CSV.

## Building for production

```bash
npm run build
npm run preview   # optional: serve the production build locally to test it
```

The production build outputs to `dist/`, includes a service worker (installable/
offline-capable PWA), and is ready to deploy as-is.

## Deploying

The app is fully static and has no environment variables or backend to configure.

**Vercel** — a `vercel.json` rewrite rule is already included for client-side
routing. Either run `vercel deploy --prod` from the project root, or connect the
GitHub repo in the Vercel dashboard for auto-deploys on push.

**Netlify** (or any static host) — deploy the `dist/` folder after running
`npm run build`. If your host needs an explicit SPA rewrite rule, redirect all
routes to `/index.html`.

## Type-checking

```bash
npx tsc --noEmit
```

## Project structure

```
src/
  types/       Shared TypeScript types (meter, tariff, battery)
  lib/         CSV parsing, tariff/battery calculation engines, presets
  store/       Zustand stores (usage data, tariffs, battery, UI mode)
  components/  UI components grouped by feature area
  pages/       Route-level pages
public/sample/ Sample CSV data used by "Try with sample data"
```
