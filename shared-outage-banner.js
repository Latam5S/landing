import './shared-tailwind-config.js';

(function () {
  const STORAGE_KEY = 'l5s_outage_banner_dismissed';

  try {
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;
  } catch (e) {
    console.error('Error accessing localStorage:', e);
    return;
  }

  const banner = document.createElement('div');
  banner.id = 'outage-banner';
  banner.setAttribute('role', 'alert');
  banner.style.cssText =
    'position:sticky;top:0;z-index:9999;width:100%;background:#f59e0b;color:#1e293b;padding:12px 16px;text-align:center;font-family:"Quicksand",sans-serif;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;box-shadow:0 4px 12px rgba(245,158,11,0.4)';

  banner.innerHTML =
    '<span style="font-size:22px;line-height:1">🛠️</span>' +
    '<span>Mantenimiento programado: Estaremos fuera de servicio por 30 minutos el martes 07 de julio a las 10:00 a.m. ¡Agradecemos tu comprensión!</span>' +
    '<button id="outage-ack-btn" style="background:#1e293b;color:#fff;border:none;padding:6px 20px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;font-family:\'Quicksand\',sans-serif;white-space:nowrap">Entendido</button>';

  document.body.prepend(banner);

  pushHeadersDown();

  document.getElementById('outage-ack-btn')
    .addEventListener('click', function () {
      try {
        localStorage.setItem(STORAGE_KEY, 'true');
      } catch (e) {
        console.error('Error accessing localStorage:', e);
      }
      banner.style.display = 'none';
      restoreHeaders();
    });

  function pushHeadersDown() {
    const h = banner.offsetHeight
    const els = document.querySelectorAll('header')
    for (const element of els) {
      const pos = getComputedStyle(element).position
      if (pos === 'fixed' || pos === 'sticky') {
        element.dataset.outageOrigTop = element.style.top || ''
        element.style.top = h + 'px'
      }
    }
  }

  function restoreHeaders() {
    const els = document.querySelectorAll('header')
    for (const element of els) {
      if (element.dataset.outageOrigTop !== undefined) {
        element.style.top = element.dataset.outageOrigTop
        delete element.dataset.outageOrigTop
      }
    }
  }
})();
