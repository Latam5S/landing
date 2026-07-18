# Latam5S (l5s-com) — Agent Guide

## Stack
- **Runtime/PM:** Bun (v1.2.15+) — use `bun install`, `bun run <script>`
- **Build:** Vite 8 (vanilla JS multi-page app: `index.html`, `login.html`, `form.html`)
- **Styling:** TailwindCSS via CDN (`cdn.tailwindcss.com`), config in `shared-tailwind-config.js`
- **Icons:** Feather (`index.html`) + Lucide (`login.html`, `form.html`) + FontAwesome — 3 libs in use
- **Testing:** Playwright (E2E only, no unit tests)
- **Backend:** Google Apps Script (proxied through `/api` in dev, Lambda URL in prod)
- **Deploy:** GitHub Pages — push to `release/*` triggers CI (`bun install && bun run build` → `dist/`)

## Commands
| Command | What it does |
|---|---|
| `bun run dev` | Vite dev server on **port 8090**, proxies `/api` → `localhost:8000` |
| `bun run build` | Vite build → `dist/` |
| `bun run preview` | Build + preview |
| `bun run e2e-test` | Playwright (headless, single chromium project) |
| `bun run e2e-test:ui` | Playwright UI mode |

## Testing
- Playwright config at `playwright.config.ts`: loads `.env.development`, runs against `http://localhost:8090`, auto-starts dev server
- E2E tests require `APP_USER` + `APP_PASS` env vars — add them to `.env.local`:
  ```
  APP_USER=987590758
  APP_PASS=54321
  ```
- Tests clear localStorage/sessionStorage in `beforeEach`
- Only 1 spec file (`tests/app.spec.ts`) with 4 tests — cheap to run

## Environment
- **`VITE_APP_TITLE`** + **`VITE_API_URL`** read by Vite (`import.meta.env`)
- `.env.local` overrides — use for local dev (not committed, in `.gitignore`)
- `.env.development.*` / `.env.production.*` — CI uses these
- Production API: `https://evifzf5t3dfbk3rxwcailmaaue0itpjq.lambda-url.us-east-2.on.aws`
- Dev API: `/api` (Vite proxy → `localhost:8000`)

## Architecture
- **3 HTML pages** (no framework, plain JS modules):
  - `index.html` → landing page (`index-app.js`)
  - `login.html` → auth + admin/dashboard (800+ lines HTML, 1600+ lines in `login-app.js`)
  - `form.html` → client shipping form (`form-app.js`, reads `?merchant=` query param)
- **No TypeScript** in app code — only build/config files use `.ts`
- **No tsconfig.json**, no ESLint, no Prettier
- `rest-client.js` — shared API wrapper (auth token in localStorage, fetches to Google Apps Script)
- `public/` — static JSON files for districts, agencies, couriers (Shalom, Olva, Marvisur, Dinsides, Encomienda)
- `bkp1/` — old backup, safe to ignore

## Conventions
- Dark mode: `class` strategy on `<html>`, persisted in `localStorage("color-theme")`
- Tailwind custom colors: `primary` (#3B82F6), `secondary` (#10B981), `dark_bg` (#020617), `card_bg` (#0f172a), `brand_accent` (#D96B4F)
- Plans: `Gratis` (free), `Pro` (S/49.90/mes), `Empresa` — feature-gated in login-app.js
- All forms use inline event handlers (`onclick`, `oninput`, `onsubmit`) bound to global `app` objects

## Planned Migration
- `docs/plans/reactjs-migration-plan.md` outlines the move to React 19 + TanStack Router/Query + Vitest + Tailwind v4
- Until migrated, treat this as a vanilla JS multi-page app
