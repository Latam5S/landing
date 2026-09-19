# Add `enableAdvancedOrderStatus` config flag (Logística)

## Goal

Gate the three advanced statuses (EN PREPARACIÓN / EMPAQUETADO / CANCELADO) behind a boolean config flag, toggled via an on/off switch in the **Logística** card. When off, the options to **select** (status menu) and **filter** by these statuses are hidden; badges on existing orders, WhatsApp text, and exports keep working.

**Decisions:**
- Field name: `enableAdvancedOrderStatus` (boolean, default `false`).
- Screen label: "Estados avanzados de envío" · subtitle: "Habilita EN PREPARACIÓN, EMPAQUETADO y CANCELADO".
- Visual: on/off switch (Tailwind pill toggle).
- Gate menus only: badges for existing orders with these statuses always render.
- Keep the current interleaved order in the filter dropdown (PENDIENTE, EN PREPARACIÓN, EMPAQUETADO, ENVIADO, CANCELADO, TODOS) → requires two gated blocks.
- The **Actualizar Estado** popup must match the filter dropdown order: **PENDIENTE, EN PREPARACIÓN, EMPAQUETADO, ENVIADO, CANCELADO** (currently it is EN PREPARACIÓN, EMPAQUETADO, ENVIADO, PENDIENTE, CANCELADO — reorder it).

---

## Steps

### 1. `login-app.js` — config + helpers

- Add `enableAdvancedOrderStatus: false` to `initialState` (lines 51-58).
- New helpers:
  - `renderAdvancedStatusSwitch()` — sync switch button + knob state from `state.config.enableAdvancedOrderStatus`.
  - `renderAdvancedOrderStatusVisibility()` — toggle `hidden` on the two gated filter blocks.
  - `toggleAdvancedOrderStatus()` — flips the flag, re-renders switch + dropdown; if the active `state.filterStatus` is an advanced status, reset to `"PENDIENTE"` and call `onFilterChange()`.
- Call both render helpers from `renderDashboard` (lines 1581-1611).

### 2. `login-app.js` — reorder + gate `openStatusMenu` (lines ~246-280)

**Reorder** the buttons to match the filter dropdown order, minus `TODOS`:

1. MARCAR COMO PENDIENTE (`PENDIENTE`)
2. MARCAR COMO EN PREPARACIÓN (`EN_PREPARACION`)
3. MARCAR COMO EMPAQUETADO (`EMPAQUETADO`)
4. MARCAR COMO ENVIADO (`ENVIADO`)
5. MARCAR COMO CANCELADO (`CANCELADO`)

**Gate** the three advanced buttons (EN PREPARACIÓN / EMPAQUETADO / CANCELADO) conditionally with the flag: when `enableAdvancedOrderStatus` is falsy, they are omitted from the modal template. PENDIENTE and ENVIADO always render.

### 3. `login.html` — switch in Logística card (lines 531-580)

Add a switch row after the "Anticipación" helper paragraph:

```html
<div class="flex items-center justify-between pt-4 mt-4 border-t border-white/5">
  <div>
    <label class="text-xs font-bold text-slate-400 uppercase block">Estados avanzados de envío</label>
    <span class="text-[10px] text-slate-500 block mt-0.5">Habilita EN PREPARACIÓN, EMPAQUETADO y CANCELADO</span>
  </div>
  <button type="button" id="sw-advanced-statuses" onclick="app.toggleAdvancedOrderStatus()"
      class="relative w-12 h-7 rounded-full bg-slate-700 transition-colors flex-shrink-0">
    <span id="sw-knob" class="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform"></span>
  </button>
</div>
```

Knob moves via `translateX(20px)`; pill turns `bg-primary` when on.

### 4. `login.html` — gate filter dropdown, keep current order

Wrap the two interleaved gated groups in separate toggleable containers (each retains `divide-y divide-white/5` so separators look intact):

- `#advanced-status-filters-top` → EN PREPARACIÓN + EMPAQUETADO buttons (between PENDIENTE and ENVIADO)
- `#advanced-status-filters-bottom` → CANCELADO button (between ENVIADO and TODOS)

Both start with `hidden`; visibility driven by `renderAdvancedOrderStatusVisibility()`.

---

## Change C — Icon updates

Status/icons used (Lucide, consistent across filter dropdown and **Actualizar Estado** popup):

| Element | Icon |
|---|---|
| Toolbar **Estado** button (opens the popup) | `workflow` (was `plus-circle`) |
| `PENDIENTE` | `clock` |
| `EN_PREPARACION` | `package-open` (open box) |
| `EMPAQUETADO` | `package-check` (closed box with check) |
| `ENVIADO` | `truck` |
| `CANCELADO` | `x-circle` |

The `workflow` icon conveys status transitions better than a generic `plus-circle`.

---

## Change A — Print labels: exclude blocked statuses

- Add `PRINT_BLOCKED_STATUSES = ["ENVIADO", "CANCELADO", "ELIMINADO", "EMPAQUETADO"]`.
- New shared helper `getSourceOrders()` — selection logic shared with export:

```javascript
getSourceOrders: () => state.selectedOrders.size > 0
    ? state.allOrders.filter(x => state.selectedOrders.has(String(x.orderId || x.createdAt)))
    : state.visibleOrders,
```

- `printLabels` (`login-app.js:1435`): compute `targets = app.getSourceOrders().filter(x => !PRINT_BLOCKED_STATUSES.includes(x.status || "PENDIENTE"))`; if empty → toast "Nada para imprimir". Printable = only `PENDIENTE` + `EN_PREPARACION`.

## Change B — Excel export: match print's selection logic

- `exportExcel` (`:1372`) and `downloadFormat` (`:796`, plus the rows built from `list`) use `const list = app.getSourceOrders()` instead of `state.visibleOrders`.
- So: **no selection** → everything currently displayed; **selection** → only the selected rows.
- **No status exclusion on export** (selection logic only) — courier manifests/report include all statuses as today.

---

## Files to modify

| File | Changes |
|------|---------|
| `login-app.js` | `initialState`, 3 new helpers, `renderDashboard`, `openStatusMenu` reorder + gating, `PRINT_BLOCKED_STATUSES`, `getSourceOrders()`, `printLabels`, `exportExcel`, `downloadFormat` |
| `login.html` | Switch row in Logística; 2 gated filter blocks in dropdown; toolbar **Estado** button icon → `workflow` |

## Edge cases

- Old stored configs lack the key → `undefined` → treated as off (safe default).
- The switch itself updates the moment it's toggled (pending value), but the gating of the filter dropdown and **Actualizar Estado** popup only applies **after a successful Guardar** (`applySavedAdvancedOrderStatus()`). Until then the menus keep showing the previously saved value.
- Toggling off + saving while filtering by an advanced status resets filter to PENDIENTE.
- Flag persists only after clicking **Guardar** (consistent with existing config UX).
- Print: if all targets are blocked statuses → "Nada para imprimir" toast, no format modal.
- Export: no status filter; a selection restricts to selected rows across all couriers.

## Verification

- `bun run build`
- Manual: toggle switch → switch flips immediately but dropdown + status menu only update after **Guardar**; "Actualizar Estado" shows filter order PENDIENTE, EN PREPARACIÓN, EMPAQUETADO, ENVIADO, CANCELADO.
- Manual: print skips ENVIADO/CANCELADO/ELIMINADO/EMPAQUETADO; export with selection exports only selected rows.