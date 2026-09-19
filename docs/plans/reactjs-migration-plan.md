# Migration Plan: l5s-com → Bun + React 19 + TanStack + Vite + Vitest

## Current Architecture Summary

| Aspect | Current | Target |
|---|---|---|
| Runtime | Bun ✓ | Bun |
| Build | Vite 8 ✓ | Vite 8 |
| UI Framework | None (vanilla JS, 3 HTML pages) | React 19 (SPA) |
| Styling | Tailwind via CDN | Tailwind v4 (npm package) |
| Routing | None (multi-page app) | TanStack Router |
| Data Fetching | Raw `fetch()` + manual state | TanStack Query |
| Testing | Playwright (e2e only) | Playwright + **Vitest** (unit) |
| Icons | Feather + Lucide + FontAwesome (3 libs) | Lucide React (unified) |
| TypeScript | No tsconfig.json | Strict TypeScript |
| Backend | Google Apps Script | Same (no change needed) |
| State | Global `state` + localStorage | React hooks + TanStack Query cache |

---

## Phase 1: Foundation & Dependencies

### 1.1 Install core dependencies

```bash
bun add react@rc react-dom@rc @tanstack/react-router @tanstack/react-query
bun add -d @types/react @types/react-dom typescript vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react tailwindcss@next postcss autoprefixer
```

- `react@rc` / `react-dom@rc` — React 19 (RC as of early 2026; adjust when stable)
- `@tanstack/react-router` — file-based or config-based routing
- `@tanstack/react-query` — server state & caching
- `vitest` — unit/integration tests, Vite-native
- `@vitejs/plugin-react` — React JSX transform for Vite
- `tailwindcss@next` — Tailwind v4 (PostCSS-based, no CDN)

### 1.2 Create `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

### 1.3 Configure Vite (`vite.config.ts`)

- Switch from MPA (3 HTML entries) to SPA
- Add `@vitejs/plugin-react`
- **Keep** the `/api` proxy to `localhost:8000`
- Move source from root `*.html` + `*.js` to `src/` (React components)
- Base config stays, `rollupOptions.input` removed (single `index.html` in root)

### 1.4 Configure Tailwind v4

- `postcss.config.js` with `tailwindcss` + `autoprefixer`
- `src/index.css` with `@import "tailwindcss"`
- `tailwind.config.ts` — port the custom colors, fonts, shadows, animations from `shared-tailwind-config.js`

### 1.5 Configure Vitest

- Add `test` config block to `vite.config.ts` or create `vitest.config.ts`
- Include `@testing-library/jest-dom` matchers
- Set `environment: 'jsdom'`

---

## Phase 2: Application Architecture (SPA Migration)

### 2.1 Directory structure

```
src/
├── main.tsx              # React entry point
├── App.tsx               # Router + QueryClientProvider wrapper
├── index.css             # Tailwind imports + global styles
├── routes/
│   ├── __root.tsx        # Root layout (header, footer)
│   ├── index.tsx         # Landing page
│   ├── form.tsx          # Client form (was form.html)
│   └── login.tsx         # Admin/login page (was login.html)
├── components/
│   ├── ui/               # Shared UI primitives
│   ├── landing/          # Landing page components
│   ├── form/             # Client form components
│   └── admin/            # Admin dashboard components (panel, orders, config, share)
├── hooks/
│   ├── useConfig.ts      # Fetch/update merchant config
│   ├── useOrders.ts      # Fetch/update orders (TanStack Query)
│   └── useAuth.ts        # Login/logout + localStorage session
├── lib/
│   ├── api.ts            # fetch wrapper to Google Apps Script
│   ├── constants.ts      # Couriers, days, plan features, URLS
│   └── utils.ts          # normalizeText, escapeHtml, etc.
└── types/
    └── index.ts          # MerchantConfig, Order, User, etc.
```

### 2.2 Route design (TanStack Router)

```
/login          → Login/Admin dashboard
/form           → Client shipping form (reads ?merchant= from query param)
/               → Landing page (hero, features, pricing)
```

The current 3 HTML pages map directly to 3 routes. The router replaces Vite's multi-page setup.

### 2.3 State management strategy

- **Server state** (config, orders, login) → TanStack Query (`useQuery`, `useMutation`)
- **UI state** (form inputs, dropdowns, toasts) → React `useState` / `useReducer`
- **Persistent session** → localStorage via a small `useAuth` hook (replaces `SafeStorage`)
- **Form state** → Could use `react-hook-form` as an optional enhancement later

---

## Phase 3: Component Migration (Detailed)

### 3.1 Landing Page (`src/routes/index.tsx`)

- Port `index.html` content into React components
- **Dark mode toggle** → replace the vanilla JS with a `useTheme` hook that toggles `class="dark"` on `<html>`
- **Canvas particles** → optional: keep as a canvas ref inside a `useEffect` or port to a lightweight library
- **Tailwind classes** → already present in HTML, copy directly (now they'll be compiled by PostCSS instead of CDN)
- CDN scripts removed: Feather icons → replace with `lucide-react`; Font Awesome → remove if possible or keep only what's used

### 3.2 Client Form (`src/routes/form.tsx`)

- Port `form-app.js` → React components
- The big monolithic `app` object → decomposed into hooks:
  - `useFormState()` — all form fields & progressive reveal logic
  - `useAgencySearch()` — agency autocomplete (debounced fetch + filter from static JSON)
  - `useDistrictSearch()` — district autocomplete
  - `useOrderSubmit()` — mutation to submit order
- Replace `lucide` CDN with `lucide-react` imports
- The dynamic rendering (`renderClient`, `renderOrders`, etc.) → replace innerHTML with React JSX

### 3.3 Admin Dashboard (`src/routes/login.tsx`)

- This is the most complex page (800+ lines of HTML, 1000+ lines of JS)
- Port to React with route-level code splitting:
  - `LoginPage` — auth form
  - `AdminPanel` — user management (for admin users)
  - `DashboardLayout` — sidebar + tabs (Config, Share, Orders)
  - `ConfigTab` — merchant settings form
  - `ShareTab` — link generation + sharing
  - `OrdersTab` — order list with filtering, selection, export, status updates
- Map the global `state` object → separate hooks: `useAuth`, `useOrders`, `useConfig`
- Map `SafeStorage` → localStorage with a typed wrapper
- Excel export → keep `xlsx` dependency, make it a utility service
- XSS `escapeHtml` → no longer needed (React escapes by default)

### 3.4 Skeleton Components

- `src/components/ui/Toast.tsx` — toast notification system
- `src/components/ui/Modal.tsx` — generic modal (replace the `generic-modal` DOM approach)
- `src/components/ui/LoadingOverlay.tsx` — loading spinner
- `src/components/ui/Autocomplete.tsx` — shared for agency/district search
- `src/ui/layout/Header.tsx` — shared header (if any)
- `src/ui/layout/Footer.tsx` — shared footer
- `src/components/ui/LucideIcon.tsx` — if needed for dynamic icons

---

## Phase 4: Configuration Migration

### 4.1 Tailwind Config

Port all custom values from `shared-tailwind-config.js` into a proper `tailwind.config.ts`:

- `colors`: primary, secondary, dark_bg, card_bg, glass, brand_accent, danger, whatsapp, neon variants
- `fontFamily`: Quicksand, Inter, label
- `boxShadow`: neon, neon-green
- `animation`: shake, fade-in, float, pulse-slow
- `keyframes`: shake, fadeIn, float

### 4.2 Global CSS

- Move all `<style>` block CSS from the HTML files into `src/index.css`
- Organize by page/component, deduplicate (e.g., `.logo-text-gradient` appears in all 3 HTMLs)
- Remove the `* { transition: ... }` global unless intentional
- Keep `@media print` styles from login page

### 4.3 Environment Variables

- Keep `.env.development` and `.env.production` as-is (VITE_ prefix already works with Vite)
- Replace `import.meta.env.VITE_API_URL` usage in JS → use React context or a config module

---

## Phase 5: Testing

### 5.1 Vitest setup

- Unit tests for: hooks (`useOrders`, `useAuth`), utilities (`normalizeText`, `escapeHtml`), components
- Integration tests for: form submission flow, admin login flow
- Example test: `src/hooks/__tests__/useOrders.test.tsx`
- Coverage config in vitest

### 5.2 Playwright (keep)

- Already configured; adjust `baseURL` if the dev server port changes
- Playwright tests should still work for e2e since the UI behavior is the same
- May need to update selectors if DOM structure changes

---

## Phase 6: Deletion & Cleanup

Once migration is complete and tested:

- Remove: `index.html`, `login.html`, `form.html`, `index-app.js`, `login-app.js`, `form-app.js`
- Remove: `shared-tailwind-config.js`, `shared-outage-banner.js`, `env-logger.js`
- Remove: Feather/FontAwesome CDN scripts (fully replaced by `lucide-react`)
- Remove: old `rollupOptions.input` from `vite.config.ts`
- Remove: `@types/bun` from devDependencies (now using `@types/react` + `tsconfig.json`)
- Move the JSON files in `public/` into more structured locations if needed
- The `bkp1/` directory can be removed (it has a backup tsconfig)

---

## Risk Areas & Mitigations

| Risk | Mitigation |
|---|---|
| **React 19 RC** may have breaking changes before stable | Pin exact RC version; add migration step when stable releases |
| **TanStack Router v7** API differences | Use latest docs; routes are simple enough (3 routes) |
| **Tailwind v4** changes (uses `@import` instead of `@tailwind` directives) | Follow v4 upgrade guide; most `tailwind.config` values still work |
| **Inline event handlers** (`onclick`, `oninput`, `onblur`) in HTML won't work with React | Use proper `onClick`, `onChange`, `onBlur` props |
| **Feather icons → Lucide React** | Both have similar APIs; may need icon name mapping |
| **localStorage caching** for offline support in form | Preserve in a typed wrapper hook |
| **InnerHTML rendering** in admin orders list → React components | Port each section of the template literal to proper JSX |

---

## Suggested Order of Execution

1. Phase 1 (Dependencies, configs)
2. Phase 2 (Architecture: `main.tsx`, `App.tsx`, router, basic layouts)
3. Phase 3 — Landing page (simplest, mostly static)
4. Phase 3 — Client form (medium complexity)
5. Phase 3 — Admin dashboard (most complex; do last)
6. Phase 4 (Tailwind config, global CSS dedup)
7. Phase 5 (Vitest for new code, update Playwright tests)
8. Phase 6 (Delete old files, verify build)
