# Add EN_PREPARACION, EMPAQUETADO, CANCELADO order statuses

## Goal

Expand order status support beyond `PENDIENTE` / `ENVIADO` / `ELIMINADO` to add `EN_PREPARACION`, `EMPAQUETADO`, and `CANCELADO`. The REST API delivers the raw value `EN_PREPARACION`, which must be mapped to the display label **"EN PREPARACIÓN"** everywhere users see it.

**Decisions:**
- Map statuses across all display surfaces (badge, filter, status-select modal, WhatsApp summary, Excel export).
- Do **not** add an `ELIMINADO` filter option (set by the delete endpoint, kept as-is).
- Colors: `EN_PREPARACION` = orange, `EMPAQUETADO` = indigo, `CANCELADO` = red.

**New status labels:**

| API value | Display label |
|---|---|
| `EN_PREPARACION` | EN PREPARACIÓN |
| `EMPAQUETADO` | EMPAQUETADO |
| `CANCELADO` | CANCELADO |

---

## Steps

### 1. `login-app.js` — Central label map (new)

Add after `escapeHtml` (~line 78):

```javascript
const STATUS_LABELS = {
    PENDIENTE: "PENDIENTE",
    ENVIADO: "ENVIADO",
    EN_PREPARACION: "EN PREPARACIÓN",
    EMPAQUETADO: "EMPAQUETADO",
    CANCELADO: "CANCELADO",
    ELIMINADO: "ELIMINADO",
};
const statusLabel = (s) => STATUS_LABELS[s] || (s || "PENDIENTE");
```

### 2. `login-app.js` — Status-select modal (`openStatusMenu`, lines 246-261)

Append 3 buttons (keep existing ENVIADO/PENDIENTE), same card style, colors:
- `EN_PREPARACION` — `bg-orange-500/20 text-orange-400 border-orange-500/30`, lucide `package-open`, text `MARCAR COMO EN PREPARACIÓN`
- `EMPAQUETADO` — `bg-indigo-500/20 text-indigo-400 border-indigo-500/30`, lucide `package-check`, text `MARCAR COMO EMPAQUETADO`
- `CANCELADO` — `bg-red-500/20 text-red-400 border-red-500/30`, lucide `x-circle`, text `MARCAR COMO CANCELADO`

### 3. `login-app.js` — `setStatus` confirm text (line 319)

Use `statusLabel(newStatus)` so the modal reads `¿Cambiar X envíos a EN PREPARACIÓN?` instead of the raw token.

### 4. `login-app.js` — WhatsApp summary (lines 352-353)

Replace the `ENVIADO` ternary with a map (grammar fits existing template `... está *${statusText}* ${emoji}`):
- `ENVIADO` → `"Enviado"` / `✅`
- `EN_PREPARACION` → `"en preparación"` / `📦`
- `EMPAQUETADO` → `"empaquetado"` / `📦`
- `CANCELADO` → `"cancelado"` / `❌`
- default → `"Programado"` / `📦`

### 5. `login-app.js` — Excel export (line 956)

`Estado: statusLabel(x.status)` (replaces raw `x.status || "PENDIENTE"`).

### 6. `login-app.js` — Filter (`setFilterStatus`, lines 1052-1080)

- Add labels to `texts`: `EN_PREPARACION: "En preparación"`, `EMPAQUETADO: "Empaquetado"`, `CANCELADO: "Cancelado"`.
- Add color branches (lines 1070-1076): orange (`bg-orange-500 border-orange-500`), indigo (`bg-indigo-500 border-indigo-500`), red (`bg-red-500 border-red-500`).
- Filtering logic itself (`renderOrders`, lines 1094-1096) needs no change — it already compares `x.status` to `state.filterStatus` verbatim.

### 7. `login-app.js` — Order-card badge (lines 1183-1191, 1202)

Add badge classes matching Step 2's colors; render `${statusLabel(status)}` instead of raw `${status}`.

### 8. `login.html` — Filter dropdown (lines 650-664)

Add three buttons with lucide icons:
- `EN PREPARACIÓN` (`package-open`), `EMPAQUETADOS` (`package-check`), `CANCELADOS` (`x-circle`) — all call `app.setFilterStatus('...')`.
- Widen dropdown `w-40` → `w-48` so "EN PREPARACIÓN" fits.

---

## Files to modify

| File | Changes |
|------|---------|
| `login-app.js` | Label map + helper, `openStatusMenu`, `setStatus`, WhatsApp summary, Excel export, `setFilterStatus`, badge rendering |
| `login.html` | Filter dropdown: 3 new options + wider menu; toolbar **Estado** button icon → `workflow` |

---

## Order of implementation

1. Add `STATUS_LABELS` + `statusLabel` helper
2. Badge rendering (Step 7) — most visible surface, exercise the map
3. Filter dropdown HTML (Step 8) + `setFilterStatus` (Step 6)
4. Status-select modal (Step 2) + confirm text (Step 3)
5. WhatsApp summary (Step 4) + Excel export (Step 5)

---

## Verification

- `bun run build` (required)
- `bun run e2e-test` if `.env.local` has `APP_USER`/`APP_PASS` and dev backend is up (no e2e test covers statuses, so optional sanity check)