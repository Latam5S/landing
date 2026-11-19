# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The main agent guide is `AGENTS.md` (stack, commands, testing, env vars, architecture, conventions). It is imported below; keep it as the single source of truth and put only Claude-specific notes or corrections in this file.

@AGENTS.md

## Additional notes

- **Run a single test:** `bunx playwright test tests/orders.spec.ts -g "<test name>" --reporter=line`. Only `orders.spec.ts` runs without a backend; it mocks `/api/legacy/**` with `page.route`.
- **API layer:** every backend call goes through `rest-client.js`, which calls REST endpoints under `/legacy/*` (auth, config, merchant, orders, admin). It exports two `APIClient` instances that keep separate localStorage tokens:
  - `merchantApi` (default export, key `latam5s_merchant_api_token`), used by `login-app.js` for the logged-in merchant/admin dashboard.
  - `anonymousApi` (key `latam5s_anonymous_api_token`), used by `form-app.js`. It gets a guest token through `/legacy/auth/guest/{merchantId}` so end customers can submit orders.
  To add a backend call, add a method to `APIClient` there and don't call `fetch` directly from the page scripts.
- **Page wiring:** each page script builds one `app` object and assigns it to `window.app`, so the inline `onclick="app.foo()"` handlers in the HTML can reach it. A new handler has to be a property of that object.
- **Courier/location data:** `form-app.js` fetches the static JSON lists in `public/` at runtime (`lstDistritos`, `lstDinsides` coverage, and the `lstShalom` / `lstOlvaCourier` / `lstMarvisur` / `lstEncomienda` agency lists). Agency updates are usually just edits to these JSON files.
- **Ubigeo scripts (root `*.ts`, run with `bun <file>.ts`):** `inspect-ubigeo.ts` and `extract-ubigeo.ts` read `public/rptUbigeo.xls` (via `xlsx`) and write `public/ubigeo.json`. `convert-encomienda.ts` then generates `public/lstEncomienda.json` from it.
- **Feature plans:** `docs/plans/*.md` holds per-feature implementation plans (order statuses, DNI field, creation date, React migration). Check them before working on those areas.
- **Env files:** `.env.*` is gitignored. `playwright.config.ts` loads `.env.development` and then `.env.local`. The repo only has `.env.development.1` / `.env.production.1` checked out locally, so put test credentials in `.env.local`.
