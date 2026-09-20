# Add order creation date + time (Fecha de Creación)

## Status: Implemented ✅

## Goal

Show **Fecha de Creación** (order creation date) for non-Shalom/Olva couriers: as a new column in the **Reporte General** Excel export, and as a field in each order card on the **Envíos** tab. `createdAt` is stored in UTC and converted to the **user's local timezone** for display.

**Decisions:**
- **UI (Envíos tab):** `DayName dd/mm HH:MM AM|PM` (12-hour), matching the "fecha de envío" day-name style, e.g. `Viernes 18/09 03:45 PM`. Rendered as the **first field**, directly below the client name (before DNI / teléfono).
- **Excel (Reporte General):** `dd/mm/yy HH:MM AM|PM` (with year), consistent with the existing `Fecha Envío` column, e.g. `18/09/26 03:45 PM`. `Fecha de Creación` is **column 1**.
- `createdAt` is UTC (`Date.now()` at `form-app.js:615`) → normalized to a `Date` and rendered with local getters for the browser's timezone.
- Only the **Reporte General** export gets the column (the only export covering Marvisur/Encomienda/Delivery/Retiro en tienda). Shalom / Olva / Dinsides mass-upload formats stay untouched (courier-mandated columns).
- `createdAt` (formatted) is added to the orders-tab search string so users can filter by creation date.
- Icons: `package-plus` (Fecha de creación, secondary color) and `truck` (Fecha de envío, **highlighted** pill: white bold text, `primary`-tinted bg/border).

---

## Implementation (`login-app.js`)

### 1. Helpers (near `statusLabel`, ~line 79)

Three functions split parsing from formatting:

```javascript
const parseCreatedAt = (ts) => { /* returns Date | null */ };
const formatCreatedAt = (ts) => { /* UI: DayName dd/mm HH:MM AM|PM */ };
const formatCreatedAtExcel = (ts) => { /* Excel: dd/mm/yy HH:MM AM|PM */ };
```

`parseCreatedAt` normalizes the varied backend shapes (all treated as UTC):
1. Firestore-style object `{_seconds}` / `{seconds}` → `new Date(sec * 1000)`
2. Numeric timestamp (ms) or numeric string (seconds when `< 1e12`) → `new Date(num)`
3. ISO/parseable string → `new Date(ts)`
4. Missing/invalid → `null` → both formatters return `""`

`DAY_NAMES_FULL` (Domingo–Sábado) drives the day-name output; `hh` uses 12-hour with `AM|PM`.

### 2. Excel export — "Reporte General" branch (~line 1050)

- `"Fecha de Creación": formatCreatedAtExcel(x.createdAt)` is **column 1**, followed by `"Fecha Envío"`, `"Courier"`, etc.
- Shalom / Olva / Dinsides branches unchanged.

### 3. Orders tab — `renderOrders` card (~line 1380)

- "Fecha de creación" chip, rendered only when `x.createdAt` exists.
- Chip order in the meta row (all under the client name):
  1. **Fecha de creación** (formatted with `formatCreatedAt`)
  2. Doc. Identidad (when present)
  3. Teléfono
  4. **Fecha de envío** — highlighted pill (`font-bold text-white bg-primary/10 border border-primary/25 rounded-md`), `truck` icon
- `formatCreatedAt(x.createdAt)` added to the search text concatenation (~line 1210) so creation dates are searchable.

---

## Tests (`tests/orders.spec.ts`)

New Playwright spec (13 tests) covering this feature and the extended-status work (`add-advanced-statuses-flag.md` / commit `e8ef03d`):

- **Creation date (cards + search + date filter):** local-time value rendered for every `createdAt` shape — Unix ms, ISO string, Unix seconds, and Firestore `{_seconds}`; creation date is the **first** meta field (asserts chip title order `[Fecha de creación, Doc. Identidad, Teléfono, Fecha de envío]`); legacy orders *without* `createdAt` omit the chip with the rest of the card intact.
- **Search box:** matches by `DayName dd/mm`, `dd/mm/yy` (Excel) and `dd/mm/yyyy`; searching by full date **or by year alone** filters the list.
- **Date filter (`#date-specific`):** native `input type="date"` (display format follows the user's browser/OS locale). Filters **only by fecha de envío**: the selected year/month/day must equal the order's shipping date (year defaults to the current year for `dd/mm`-only shipping dates); a correct day/month with a different year excludes the order.
- **Reporte General export:** `Fecha de Creación` is column 1 as `dd/mm/yy HH:MM AM|PM`; local value asserted for all four `createdAt` shapes; legacy order → empty cell; `Estado` header present.
- **Unchanged courier formats:** Shalom mass-upload export keeps its courier-mandated columns (`DESTINATARIO (DOC)` first, **no** `Fecha de Creación`) — regression guard for the untouched branches.
- **Panel title:** dashboard shows the merchant name, falling back to `Mi Panel` only when empty/whitespace.
- **Extended statuses:** display labels on cards; filter options gated by `enableAdvancedOrderStatus`; status modal gating + ordering; export maps raw status tokens to labels.

Infrastructure:
- API mocked via `page.route('**/api/legacy/**')` (config/merchant/orders/login) — deterministic, no live backend needed.
- SheetJS CDN mocked to `node_modules/xlsx/dist/xlsx.full.min.js`; parsed with `xlsx@0.18.5` devDependency from the test (`mockSheetJs` / `exportRows` helpers).
- Test helpers mirror the app formatters: `formatLocal` (DayName) and `formatLocalExcel` (dd/mm/yy), both using local getters.
- `playwright.config.ts` loads `.env.development` **and** `.env.local` (`APP_USER=987590758`, `APP_PASS=54321`).

## Files to modify

| File | Changes |
|------|---------|
| `login-app.js` | `parseCreatedAt` / `formatCreatedAt` / `formatCreatedAtExcel` helpers; Reporte General map (col 1 `Fecha de Creación`, `formatCreatedAtExcel`); renderOrders card chips (creation first, envío highlighted) + search string |
| `tests/orders.spec.ts` | New E2E spec (9 tests), mocked API, xlsx export parsing, helper mirrors |
| `playwright.config.ts` | Load `.env.local` in addition to `.env.development` |
| `form-app.js` | Already emits `createdAt: Date.now()` (line 615) — no change needed |

## Edge cases

- `createdAt` shapes: Unix ms, Unix seconds, ISO string, Firestore `{_seconds}` — all normalized to a local `Date`.
- Missing/invalid `createdAt` → empty Excel cell / chip omitted.
- Legacy orders created before `createdAt` existed → safe empty fallback.
- Conversion is per-browser timezone (UTC → local), per requirement.
- `dd/mm/yy` uses `getFullYear().slice(-2)` for the 2-digit year.

## Verification

- `bun run build` ✅
- `bunx playwright test tests/orders.spec.ts --reporter=line` → **9 passed** ✅
- Full suite: `bun run e2e-test` — note the 3 pre-existing `tests/app.spec.ts` tests still require the live backend at `localhost:8000`.