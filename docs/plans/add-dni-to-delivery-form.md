# Add DNI field to home delivery form

## Goal

Add a DNI/CE field to the home delivery (`#fields-home`) section so the printed rótulo can show `N°DOC:` for all order types, not just agency.

---

## Steps

### 1. `form.html` — Add DNI input to `#fields-home`

Insert a new DNI input after the district input and before the address input (or after reference — whichever feels more natural). Mirror the agency DNI field styling:

```html
<div>
    <label class="block text-sm font-bold text-gray-700 mb-2 ml-1">DNI/CE del Destinatario <span class="text-danger">*</span></label>
    <input id="c-dni-home" type="tel" maxlength="15"
        class="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-xl p-4 outline-none focus:border-brand_accent focus:bg-white focus:ring-4 focus:ring-brand_accent/10 input-transition placeholder-gray-400 font-medium shadow-sm"
        placeholder="Número de DNI / CE">
</div>
```

### 2. `form-app.js` — Handle the new field

#### a. Set/unset `required` and reset value in `onCourierChange`

Update the home delivery branch (around line 160) to set `required` on `#c-dni-home` and clear its value:

```javascript
} else {
    af.classList.add('hidden'); hf.classList.remove('hidden');
    document.getElementById('c-address').setAttribute('required', 'true');
    document.getElementById('c-district').setAttribute('required', 'true');
    document.getElementById('c-ref').setAttribute('required', 'true');
    document.getElementById('c-dni-home').setAttribute('required', 'true');   // NEW
    document.getElementById('c-dni-home').value = "";                         // NEW
    app.clearAgency();
    app.clearDistrict();
    app.loadExternalLists(realCourier);
    app.loadDateLabel();
}
```

Also add `'c-dni-home'` to the `removeAttribute('required')` loop at line 145:

```javascript
['c-dni', 'c-agency', 'c-address', 'c-district', 'c-ref', 'c-dni-home'].forEach(id => document.getElementById(id).removeAttribute('required'));
```

#### b. Include DNI in `submitOrder` for home delivery

In the home delivery branch (around line 364), add `data.clientDni`:

```javascript
data.clientDni = document.getElementById('c-dni-home').value.trim();
```

Also add `cacheData.dni` if you want the DNI cached for repeat customers:

```javascript
cacheData.district = data.clientDistrict;
cacheData.address = data.clientAddress;
cacheData.ref = data.clientRef;
cacheData.dni = data.clientDni;                                             // NEW
```

#### c. Update the WhatsApp message for home delivery

Add the DNI line to the `wa` string for home delivery (around line 368):

```javascript
wa = `📦 *NUEVO ENVÍO (DELIVERY)*\n\n👤 ${name}\n📱 ${phone}\n🆔 DNI: ${data.clientDni}\n📍 ${data.clientDistrict}\n🏠 ${data.clientAddress}\n🗺️ Ref: ${data.clientRef}\n\n🚚 ${state.selectedCourier}\n📅 ${day}`;
```

#### d. Cache restoration — fill DNI from cache

In `fillFromCache` (around line 123), restore the DNI value when client data is cached:

```javascript
} else {
    if (data.district) {
        document.getElementById('c-district').value = data.district;
        document.getElementById('btn-clear-district').classList.remove('hidden');
    }
    if (data.dni) {                                                         // NEW
        document.getElementById('c-dni-home').value = data.dni;              // NEW
    }                                                                       // NEW
    if (data.address) document.getElementById('c-address').value = data.address;
    if (data.ref) document.getElementById('c-ref').value = data.ref;
}
```

### 3. `login-app.js` — Labels (Plan 1)

Once Plan 1 (label format update to DESTINATARIO/DESTINO) is implemented, the existing `N°DOC:` conditional (`x.clientDni`) will automatically show the DNI for home delivery orders too, since `clientDni` will now be populated in the data payload.

### 4. Backend

The `action=saveOrder` POST to `VITE_API_URL` already sends `data.clientDni` in the payload. No backend changes needed.

---

## Files to modify

| File | Changes |
|------|---------|
| `form.html` | Add `#c-dni-home` input to `#fields-home` |
| `form-app.js` | `onCourierChange`, `submitOrder`, `fillFromCache`, WhatsApp message |
| `login-app.js` | (Plan 1 — optional, for printed labels) |

---

## Order of implementation

1. Add the HTML input to `form.html`
2. Wire it up in `form-app.js` (required toggle, data collection, cache, WhatsApp)
3. Test home delivery flow end-to-end
4. (Optional) Apply Plan 1 to show `N°DOC:` in printed rótulos
