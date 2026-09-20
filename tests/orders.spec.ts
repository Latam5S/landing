import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';
// @ts-ignore xlsx ships without bundled types
import * as XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Helpers: fake JWT + deterministic local-time formatter (mirrors formatCreatedAt)
// ---------------------------------------------------------------------------

function b64url(obj: unknown): string {
  const b64 = Buffer.from(JSON.stringify(obj)).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildAccessToken(): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'merchant_1',
    phone: '999888777',
    isAdmin: false,
    plan: 'Pro',
    iat: now,
    exp: now + 7200,
  };
  return `header.${b64url(payload)}.signature`;
}

// Same DayName dd/mm HH:MM AM|PM + local-timezone logic used by login-app.js formatCreatedAt
const DAY_NAMES_FULL = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

function formatLocal(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  let hh = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  return `${DAY_NAMES_FULL[d.getDay()]} ${dd}/${mm} ${hh}:${min} ${ampm}`;
}

// Excel (Reporte General): dd/mm/yy HH:MM AM|PM — mirrors formatCreatedAtExcel
function formatLocalExcel(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  let hh = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  return `${dd}/${mm}/${yy} ${hh}:${min} ${ampm}`;
}

// Search: dd/mm/yyyy HH:MM AM|PM — mirrors formatCreatedAtSearch
function formatLocalSearch(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let hh = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  return `${dd}/${mm}/${yyyy} ${hh}:${min} ${ampm}`;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const CREATED_AT = {
  marvisur: Date.UTC(2026, 8, 18, 20, 45),
  encomienda: Date.UTC(2026, 8, 17, 8, 5),
  shalom: Date.UTC(2026, 8, 16, 23, 59),
  olva: Date.UTC(2026, 8, 19, 0, 30),
  retiro: Date.UTC(2026, 8, 15, 12, 0),
};

type Order = { orderId: string; status: string; dataJson: Record<string, unknown> };

const TEST_ORDERS: Order[] = [
  {
    orderId: 'o1',
    status: 'EN_PREPARACION',
    dataJson: {
      clientName: 'Ana Torres',
      clientPhone: '987111111',
      clientDni: '11111111',
      clientDistrict: 'Miraflores',
      clientAddress: 'Av. Larco 123',
      clientRef: 'Casa blanca',
      courier: 'Marvisur',
      shippingDate: '20/09',
      createdAt: CREATED_AT.marvisur,
    },
  },
  {
    orderId: 'o2',
    status: 'EMPAQUETADO',
    dataJson: {
      clientName: 'Luis Ramos',
      clientPhone: '987222222',
      clientDni: '22222222',
      clientDistrict: 'San Isidro',
      clientAddress: 'Av. Conquistadores 456',
      clientRef: 'Edificio Azul',
      courier: 'Encomienda',
      shippingDate: '21/09',
      createdAt: new Date(CREATED_AT.encomienda).toISOString(),
    },
  },
  {
    orderId: 'o3',
    status: 'CANCELADO',
    dataJson: {
      clientName: 'Maria Diaz',
      clientPhone: '987333333',
      clientDni: '33333333',
      clientDistrict: 'Surco',
      clientAddress: 'Jr. Tizon 789',
      courier: 'Shalom',
      shippingDate: '22/09',
      createdAt: Math.floor(CREATED_AT.shalom / 1000),
    },
  },
  {
    orderId: 'o4',
    status: 'PENDIENTE',
    dataJson: {
      clientName: 'Carlos Soto',
      clientPhone: '987444444',
      clientDni: '44444444',
      clientDistrict: 'Lince',
      clientAddress: 'Av. Arequipa 100',
      courier: 'Olva Courier',
      shippingDate: '19/09',
      createdAt: CREATED_AT.olva,
    },
  },
  {
    orderId: 'o5',
    status: 'ENVIADO',
    dataJson: {
      clientName: 'Rosa Flores',
      clientPhone: '987555555',
      clientDni: '55555555',
      courier: 'Retiro en tienda',
      shippingDate: '18/09',
      createdAt: {
        _seconds: Math.floor(CREATED_AT.retiro / 1000),
        _nanoseconds: 0,
      },
    },
  },
  {
    orderId: 'o6',
    status: 'PENDIENTE',
    dataJson: {
      clientName: 'Legacy SinFecha',
      clientPhone: '987666666',
      clientDni: '66666666',
      courier: 'Marvisur',
      shippingDate: '23/09',
    },
  },
];

function baseConfig(advanced: boolean): Record<string, unknown> {
  return {
    merchantName: 'Tienda Demo',
    whatsapp: '999888777',
    couriers: ['Marvisur', 'Shalom', 'Encomienda', 'Retiro en tienda'],
    shippingDays: ['LUNES', 'VIERNES'],
    updateTime: '18:00',
    updateGap: '0',
    enableAdvancedOrderStatus: advanced,
  };
}

// ---------------------------------------------------------------------------
// API mocking (deterministic, no live backend required)
// ---------------------------------------------------------------------------

async function setupMocks(
  page: Page,
  opts: { advanced?: boolean; orders?: Order[] } = {},
): Promise<void> {
  const token = buildAccessToken();
  await page.route('**/api/legacy/auth/login', (route) =>
    route.fulfill({ json: { accessToken: token } }),
  );
  await page.route('**/api/legacy/config', (route) =>
    route.fulfill({ json: { dataJson: baseConfig(!!opts.advanced) } }),
  );
  await page.route('**/api/legacy/merchant', (route) =>
    route.fulfill({ json: { plan: 'Pro' } }),
  );
  await page.route('**/api/legacy/orders', (route) =>
    route.fulfill({ json: { orders: opts.orders ?? TEST_ORDERS } }),
  );
}

async function login(page: Page): Promise<void> {
  await expect(page.locator('#view-auth')).toBeVisible({ timeout: 10_000 });
  await page.fill('#auth-phone', '999888777');
  await page.fill('#auth-pass', '12345');
  await page.click('#view-auth button[type="submit"]');
  await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 15_000 });
}

async function goToOrders(page: Page): Promise<void> {
  await page.click('#nav-orders');
  await expect(page.locator('#tab-orders')).toBeVisible();
}

async function setFilterTodos(page: Page): Promise<void> {
  await page.click('#filter-trigger-btn');
  await page.click('#filter-dropdown-menu button:has-text("TODOS")');
}

// Serve SheetJS from the local node_modules instead of the CDN
async function mockSheetJs(page: Page): Promise<void> {
  const sheetJsPath = path.resolve(
    __dirname,
    '../node_modules/xlsx/dist/xlsx.full.min.js',
  );
  await page.route('**/cdn.sheetjs.com/**', (route) =>
    route.fulfill({ path: sheetJsPath, contentType: 'application/javascript' }),
  );
}

async function exportRows(
  page: Page,
  formatButtonText: string,
): Promise<unknown[][]> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator(`#modal-export button:has-text("${formatButtonText}")`).click(),
  ]);
  const buffer = readFileSync((await download.path()) as string);
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
}

function orderCheckbox(page: Page, clientName: string) {
  return page.locator(
    `xpath=//div[contains(@class,"bg-black") and contains(., "${clientName}")]//input[@type="checkbox"]`,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Orders tab — creation date (fecha de creación)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('order cards show the creation date converted to local time', async ({
    page,
  }) => {
    await setupMocks(page, { advanced: true });
    await login(page);
    await goToOrders(page);
    await setFilterTodos(page);

    await expect(page.locator('#orders-list')).toContainText('Ana Torres');
    await expect(page.locator('#orders-list')).toContainText(
      formatLocal(CREATED_AT.marvisur),
    );
    // ISO string, Unix-seconds timestamps and Firestore {_seconds} are also rendered
    await expect(page.locator('#orders-list')).toContainText(
      formatLocal(CREATED_AT.encomienda),
    );
    await expect(page.locator('#orders-list')).toContainText(
      formatLocal(CREATED_AT.shalom),
    );
    await expect(page.locator('#orders-list')).toContainText(
      formatLocal(CREATED_AT.retiro),
    );

    // Fecha de creación es el primer campo, debajo del nombre del cliente
    const metaTitles = await page
      .locator('#orders-list')
      .getByText('Ana Torres')
      .first()
      .locator(
        'xpath=ancestor::div[contains(@class,"bg-black")][1]//span[@title]',
      )
      .evaluateAll((els) => els.map((el) => el.getAttribute('title')));
    expect(metaTitles).toEqual([
      'Fecha de creación',
      'Doc. Identidad',
      'Teléfono',
      'Fecha de envío',
    ]);

    // Legacy orders without createdAt: no creation chip, rest of the card intact
    const legacyTitles = await page
      .locator('#orders-list')
      .getByText('Legacy SinFecha')
      .first()
      .locator(
        'xpath=ancestor::div[contains(@class,"bg-black")][1]//span[@title]',
      )
      .evaluateAll((els) => els.map((el) => el.getAttribute('title')));
    expect(legacyTitles).not.toContain('Fecha de creación');
    expect(legacyTitles).toEqual([
      'Doc. Identidad',
      'Teléfono',
      'Fecha de envío',
    ]);
  });

  test('searching by creation date filters the orders list', async ({
    page,
  }) => {
    await setupMocks(page, { advanced: true });
    await login(page);
    await goToOrders(page);
    await setFilterTodos(page);

    await page.fill(
      '#inp-search-orders',
      formatLocal(CREATED_AT.marvisur).toLowerCase(),
    );
    await expect(page.locator('#orders-list')).toContainText('Ana Torres');
    await expect(page.locator('#orders-list')).not.toContainText('Luis Ramos');

    // Año completo (dd/mm/yyyy) — el filtro también debe aplicar por año
    await page.fill('#inp-search-orders', formatLocalSearch(CREATED_AT.marvisur));
    await expect(page.locator('#orders-list')).toContainText('Ana Torres');
    await expect(page.locator('#orders-list')).not.toContainText('Luis Ramos');

    // Solo el año (4 dígitos)
    const year = new Date(CREATED_AT.marvisur).getFullYear().toString();
    await page.fill('#inp-search-orders', year);
    await expect(page.locator('#orders-list')).toContainText('Ana Torres');
    await expect(page.locator('#orders-list')).not.toContainText('Legacy SinFecha');
  });

  test('date filter (#date-specific) filters by fecha de envío considering day, month and year', async ({
    page,
  }) => {
    await setupMocks(page, { advanced: true });
    await login(page);
    await goToOrders(page);
    await setFilterTodos(page);
    await expect(page.locator('#orders-list')).toContainText('Ana Torres');

    const curYear = new Date().getFullYear();

    // Ana Torres (o1) shippingDate = '20/09' → matches this year
    await page.fill('#date-specific', `${curYear}-09-20`);
    await expect(page.locator('#orders-list')).toContainText('Ana Torres');
    await expect(page.locator('#orders-list')).not.toContainText('Luis Ramos');

    // Same day/month but a different year → excluded (year now applies)
    await page.fill('#date-specific', `${curYear - 1}-09-20`);
    await expect(page.locator('#orders-list')).not.toContainText('Ana Torres');

    // Legacy order (o6) shippingDate = '23/09' still filtered by day/month/year
    await page.fill('#date-specific', `${curYear}-09-23`);
    await expect(page.locator('#orders-list')).toContainText('Legacy SinFecha');
    await expect(page.locator('#orders-list')).not.toContainText('Ana Torres');
    await page.fill('#date-specific', `${curYear}-01-01`);
    await expect(page.locator('#orders-list')).not.toContainText('Legacy SinFecha');
  });

  test('reporte general export includes "Fecha de Creación" with local value', async ({
    page,
  }) => {
    await setupMocks(page, { advanced: true });
    await login(page);
    await goToOrders(page);
    await setFilterTodos(page);
    await expect(page.locator('#orders-list')).toContainText('Rosa Flores');

    await mockSheetJs(page);
    await page.click('#tab-orders button:has-text("Excel")');
    await expect(page.locator('#modal-export')).toBeVisible();

    const rows = await exportRows(page, 'Reporte General');

    const headers = rows[0] as string[];
    expect(headers[0]).toBe('Fecha de Creación');
    expect(headers).toContain('Fecha Envío');
    expect(headers).toContain('Estado');

    // Unix ms (o1)
    const marvisurRow = rows.find(
      (r) => r[2] === 'Marvisur' && r[3] === 'Ana Torres',
    );
    expect(marvisurRow).toBeTruthy();
    expect(marvisurRow![0]).toBe(formatLocalExcel(CREATED_AT.marvisur));

    // ISO string (o2)
    const encomiendaRow = rows.find(
      (r) => r[2] === 'Encomienda' && r[3] === 'Luis Ramos',
    );
    expect(encomiendaRow).toBeTruthy();
    expect(encomiendaRow![0]).toBe(formatLocalExcel(CREATED_AT.encomienda));

    // Unix seconds (o3)
    const shalomRow = rows.find(
      (r) => r[2] === 'Shalom' && r[3] === 'Maria Diaz',
    );
    expect(shalomRow).toBeTruthy();
    expect(shalomRow![0]).toBe(formatLocalExcel(CREATED_AT.shalom));

    // Firestore {_seconds} (o5)
    const retiroRow = rows.find(
      (r) => r[2] === 'Retiro en tienda' && r[3] === 'Rosa Flores',
    );
    expect(retiroRow).toBeTruthy();
    expect(retiroRow![0]).toBe(formatLocalExcel(CREATED_AT.retiro));

    // Legacy order without createdAt → empty cell
    const legacyRow = rows.find(
      (r) => r[3] === 'Legacy SinFecha',
    );
    expect(legacyRow).toBeTruthy();
    expect(legacyRow![0]).toBe('');
  });

  test('shalom mass-upload export keeps its courier-mandated columns (no "Fecha de Creación")', async ({
    page,
  }) => {
    await setupMocks(page, { advanced: true });
    await login(page);
    await goToOrders(page);
    await setFilterTodos(page);
    await expect(page.locator('#orders-list')).toContainText('Rosa Flores');

    await mockSheetJs(page);
    await page.click('#tab-orders button:has-text("Excel")');
    await expect(page.locator('#modal-export')).toBeVisible();

    const rows = await exportRows(page, 'Shalom');

    const headers = rows[0] as string[];
    expect(headers[0]).toBe('DESTINATARIO (DOC)');
    expect(headers).not.toContain('Fecha de Creación');
    // Only Maria Diaz (o3) is a Shalom order in the fixture
    const shalomRows = rows.slice(1).filter((r) => r[0] === '33333333');
    expect(shalomRows).toHaveLength(1);
  });
});

test.describe('Dashboard panel title (merchant name)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('shows the merchant name instead of "Mi Panel"', async ({ page }) => {
    await setupMocks(page, { advanced: true });
    await login(page);
    await expect(page.locator('#dashboard-title')).toHaveText('Tienda Demo');
  });

  test('falls back to "Mi Panel" when merchant name is empty', async ({
    page,
  }) => {
    await setupMocks(page, { advanced: true });
    await login(page);
    await page.evaluate(() => app.updateConfigInput('merchantName', ''));
    await expect(page.locator('#dashboard-title')).toHaveText('Mi Panel');
    await page.evaluate(() => app.updateConfigInput('merchantName', '  '));
    await expect(page.locator('#dashboard-title')).toHaveText('Mi Panel');
  });
});

test.describe('Extended order status model (enableAdvancedOrderStatus)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('advanced statuses render their display labels on order cards', async ({
    page,
  }) => {
    await setupMocks(page, { advanced: true });
    await login(page);
    await goToOrders(page);
    await setFilterTodos(page);

    const list = page.locator('#orders-list');
    await expect(list).toContainText('EN PREPARACIÓN');
    await expect(list).toContainText('EMPAQUETADO');
    await expect(list).toContainText('CANCELADO');
    await expect(list).toContainText('ENVIADO');
  });

  test('advanced filter options are hidden when the flag is off', async ({
    page,
  }) => {
    await setupMocks(page, { advanced: false });
    await login(page);
    await goToOrders(page);

    await page.click('#filter-trigger-btn');
    await expect(
      page.locator('#filter-dropdown-menu button:has-text("PENDIENTES")'),
    ).toBeVisible();
    await expect(page.locator('#advanced-status-filters-top')).toBeHidden();
    await expect(page.locator('#advanced-status-filters-bottom')).toBeHidden();
  });

  test('advanced filter options appear and work when the flag is on', async ({
    page,
  }) => {
    await setupMocks(page, { advanced: true });
    await login(page);
    await goToOrders(page);

    await page.click('#filter-trigger-btn');
    await expect(page.locator('#advanced-status-filters-top')).toBeVisible();
    await expect(page.locator('#advanced-status-filters-bottom')).toBeVisible();

    await page.click(
      '#advanced-status-filters-top button:has-text("EN PREPARACIÓN")',
    );
    await expect(page.locator('#filter-label-display')).toHaveText(
      'En preparación',
    );
    await expect(page.locator('#orders-list')).toContainText('Ana Torres');
    await expect(page.locator('#orders-list')).not.toContainText('Luis Ramos');
  });

  test('status select modal is gated and ordered by the flag', async ({
    page,
  }) => {
    await setupMocks(page, { advanced: true });
    await login(page);
    await goToOrders(page);
    await setFilterTodos(page);

    await orderCheckbox(page, 'Rosa Flores').check();
    await page.click('#tab-orders button:has-text("Estado")');
    await expect(page.locator('#generic-modal')).toBeVisible();

    const texts = await page
      .locator('#modal-content button')
      .allTextContents();
    const normalized = texts.map((t) => t.replace(/\s+/g, ' ').trim());
    expect(normalized).toEqual([
      'MARCAR COMO PENDIENTE',
      'MARCAR COMO EN PREPARACIÓN',
      'MARCAR COMO EMPAQUETADO',
      'MARCAR COMO ENVIADO',
      'MARCAR COMO CANCELADO',
    ]);
  });

  test('status select modal only shows PENDIENTE and ENVIADO when flag is off', async ({
    page,
  }) => {
    await setupMocks(page, { advanced: false });
    await login(page);
    await goToOrders(page);
    await setFilterTodos(page);

    await orderCheckbox(page, 'Rosa Flores').check();
    await page.click('#tab-orders button:has-text("Estado")');
    await expect(page.locator('#generic-modal')).toBeVisible();

    const texts = await page
      .locator('#modal-content button')
      .allTextContents();
    const normalized = texts.map((t) => t.replace(/\s+/g, ' ').trim());
    expect(normalized).toEqual(['MARCAR COMO PENDIENTE', 'MARCAR COMO ENVIADO']);
  });

  test('export maps raw status tokens to labels via statusLabel', async ({
    page,
  }) => {
    await setupMocks(page, { advanced: true });
    await login(page);
    await goToOrders(page);
    await setFilterTodos(page);
    await expect(page.locator('#orders-list')).toContainText('Rosa Flores');

    const sheetJsPath = path.resolve(
      __dirname,
      '../node_modules/xlsx/dist/xlsx.full.min.js',
    );
    await page.route('**/cdn.sheetjs.com/**', (route) =>
      route.fulfill({ path: sheetJsPath, contentType: 'application/javascript' }),
    );

    await page.click('#tab-orders button:has-text("Excel")');
    await expect(page.locator('#modal-export')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#modal-export button:has-text("Reporte General")').click(),
    ]);

    const buffer = readFileSync((await download.path()) as string);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

    const headers = rows[0] as string[];
    const estadoIdx = headers.indexOf('Estado');
    const marvisurRow = rows.find(
      (r) => r[2] === 'Marvisur' && r[3] === 'Ana Torres',
    );
    expect(marvisurRow).toBeTruthy();
    // Raw token EN_PREPARACION must be exported as the display label
    expect(marvisurRow![estadoIdx]).toBe('EN PREPARACIÓN');
  });
});