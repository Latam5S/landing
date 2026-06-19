(function () {
  var STORAGE_KEY = 'l5s_outage_banner_dismissed'

  try {
    if (localStorage.getItem(STORAGE_KEY) === 'true') return
  } catch (e) {
    return
  }

  var banner = document.createElement('div')
  banner.id = 'outage-banner'
  banner.setAttribute('role', 'alert')
  banner.style.cssText =
    'position:sticky;top:0;z-index:9999;width:100%;background:#f59e0b;color:#1e293b;padding:12px 16px;text-align:center;font-family:"Quicksand",sans-serif;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;box-shadow:0 4px 12px rgba(245,158,11,0.4)'

  banner.innerHTML =
    '<span style="font-size:22px;line-height:1">🛠️</span>' +
    '<span>Mantenimiento programado: Estaremos fuera de servicio por 30 minutos el sábado 20 de junio a las 5:00 a.m. ¡Agradecemos tu comprensión!</span>' +
    '<button id="outage-ack-btn" style="background:#1e293b;color:#fff;border:none;padding:6px 20px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;font-family:\'Quicksand\',sans-serif;white-space:nowrap">Entendido</button>'

  document.body.prepend(banner)

  pushHeadersDown()

  document.getElementById('outage-ack-btn').addEventListener('click', function () {
    try { localStorage.setItem(STORAGE_KEY, 'true') } catch (e) {}
    banner.style.display = 'none'
    restoreHeaders()
  })

  function pushHeadersDown() {
    var h = banner.offsetHeight
    var els = document.querySelectorAll('header')
    for (var i = 0; i < els.length; i++) {
      var pos = getComputedStyle(els[i]).position
      if (pos === 'fixed' || pos === 'sticky') {
        els[i].dataset.outageOrigTop = els[i].style.top || ''
        els[i].style.top = h + 'px'
      }
    }
  }

  function restoreHeaders() {
    var els = document.querySelectorAll('header')
    for (var i = 0; i < els.length; i++) {
      if (els[i].dataset.outageOrigTop !== undefined) {
        els[i].style.top = els[i].dataset.outageOrigTop
        delete els[i].dataset.outageOrigTop
      }
    }
  }
})()
