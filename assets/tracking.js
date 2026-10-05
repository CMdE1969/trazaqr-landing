// Consentimiento compartido entre trazaqr.com y app.trazaqr.com.
// Nunca carga Meta ni Google antes de una elección afirmativa.
(function () {
  const APP = location.hostname === 'app.trazaqr.com' || location.hostname === 'localhost'
  const PIXEL_ID = '1410899413954942'
  const GA_ID = 'G-M9CX3LKYQ5'
  const ADS_ID = 'AW-18483216349'
  const ADS_CONVERSION = 'AW-18483216349/7GTqCJ7goI4dEN3_ve1E'
  const DAY = 60 * 60 * 24
  let metaLoaded = false
  let googleLoaded = false
  let adsLoaded = false
  let lastMetaPath = ''
  let lastGooglePath = ''
  let lastMetaStartPath = ''
  let lastGoogleStartPath = ''
  const pendingConversions = new Set()
  function safePath() {
    return !/^\/(conductor|verificar|confirmar)(\/|$)/.test(location.pathname) && !/^\/expediciones\/[^/]+/.test(location.pathname)
  }

  function read(name) {
    const value = document.cookie.split('; ').find(part => part.startsWith(name + '='))
    return value ? value.slice(name.length + 1) : null
  }
  function write(name, value) {
    const domain = /(^|\.)trazaqr\.com$/.test(location.hostname) ? '; Domain=.trazaqr.com' : ''
    document.cookie = name + '=' + value + '; Max-Age=' + (180 * DAY) + '; Path=/; SameSite=Lax; Secure' + domain
  }
  function analyticsAllowed() { return read('tqr_analytics') === 'si' }
  // Nueva elección: el consentimiento anterior solo mencionaba a Meta.
  function marketingAllowed() { return read('tqr_advertising') === 'si' }

  function ensureGoogleTag(id) {
    const hadGtag = typeof window.gtag === 'function'
    window.dataLayer = window.dataLayer || []
    window.gtag = window.gtag || function () { dataLayer.push(arguments) }
    if (!hadGtag) gtag('js', new Date())
    if (!document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]')) {
      const script = document.createElement('script')
      script.async = true
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id
      document.head.appendChild(script)
    }
  }

  function loadMeta() {
    if (!marketingAllowed() || metaLoaded || !safePath()) return
    metaLoaded = true
    !function (f,b,e,v,n,t,s) {
      if (f.fbq) return
      n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)}
      if (!f._fbq) f._fbq=n
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[]
      t=b.createElement(e);t.async=!0;t.src=v
      s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)
    }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js')
    // Los eventos se envían explícitamente; no inferir datos del formulario.
    fbq('set', 'autoConfig', false, PIXEL_ID)
    fbq('init', PIXEL_ID)
    pageView()
  }
  function loadGoogle() {
    if (!APP || !analyticsAllowed() || googleLoaded) return
    googleLoaded = true
    ensureGoogleTag(GA_ID)
    gtag('config', GA_ID, { send_page_view: false })
    pageView()
  }
  function loadGoogleAds() {
    if (!marketingAllowed() || adsLoaded || !safePath()) return
    adsLoaded = true
    ensureGoogleTag(ADS_ID)
    gtag('config', ADS_ID)
  }
  function pageView() {
    const path = location.pathname
    if (APP && !metaLoaded) loadMeta()
    if (!safePath()) return
    if (!adsLoaded) loadGoogleAds()
    if (marketingAllowed() && metaLoaded && lastMetaPath !== path) {
      fbq('track', 'PageView')
      lastMetaPath = path
    }
    if (APP && analyticsAllowed() && googleLoaded && lastGooglePath !== path) {
      gtag('event', 'page_view', { page_path: path, page_location: location.origin + path })
      lastGooglePath = path
    }
    if (APP && path === '/registro') {
      if (marketingAllowed() && metaLoaded && lastMetaStartPath !== path) {
        fbq('track', 'Lead', { content_name: 'Inicio de prueba de 30 días' })
        lastMetaStartPath = path
      }
      if (analyticsAllowed() && googleLoaded && lastGoogleStartPath !== path) {
        gtag('event', 'sign_up_start', { method: 'web' })
        lastGoogleStartPath = path
      }
    } else {
      lastMetaStartPath = ''
      lastGoogleStartPath = ''
    }
    flushConversions()
  }
  function completeRegistration(userId) {
    if (!userId || (!marketingAllowed() && !analyticsAllowed())) return
    pendingConversions.add(userId)
    if (safePath()) {
      loadGoogle()
      loadMeta()
      loadGoogleAds()
      flushConversions()
    }
  }
  function flushConversions() {
    if (!safePath()) return
    for (const userId of pendingConversions) {
    const key = 'tqr_conversion_' + userId
    if (sessionStorage.getItem(key)) { pendingConversions.delete(userId); continue }
    let sent = false
    if (marketingAllowed() && metaLoaded) {
      fbq('track', 'CompleteRegistration', { content_name: 'Prueba de 30 días', status: 'completed' })
      sent = true
    }
    if (marketingAllowed() && adsLoaded) {
      gtag('event', 'conversion', { send_to: ADS_CONVERSION, value: 0, currency: 'EUR' })
      sent = true
    }
    if (analyticsAllowed() && googleLoaded) {
      gtag('event', 'sign_up', { method: 'web' })
      sent = true
    }
    if (sent) { sessionStorage.setItem(key, '1'); pendingConversions.delete(userId) }
    }
  }
  function removeBanner() { document.getElementById('tqr-tracking-consent')?.remove() }
  function button(label, value, onClick) {
    const el = document.createElement('button')
    el.type = 'button'; el.textContent = label
    el.style.cssText = 'padding:9px 15px;border:1px solid white;border-radius:7px;background:' + (value ? '#fff' : 'transparent') + ';color:' + (value ? '#0A1628' : '#fff') + ';cursor:pointer;font:600 14px system-ui'
    el.addEventListener('click', onClick)
    return el
  }
  function showBanner() {
    if (document.getElementById('tqr-tracking-consent')) return
    // En la web pública primero se resuelve su banner de estadísticas existente.
    if (!APP && (document.getElementById('banner-cookies') || document.getElementById('cookie-banner'))) {
      setTimeout(showBanner, 300)
      return
    }
    const banner = document.createElement('div')
    banner.id = 'tqr-tracking-consent'
    banner.setAttribute('role', 'dialog')
    banner.setAttribute('aria-label', 'Preferencias de medición')
    banner.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:10000;background:#0A1628;color:white;padding:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center;box-shadow:0 -4px 16px #0a162844;font:14px/1.5 system-ui'
    const copy = document.createElement('span')
    copy.style.maxWidth = '650px'
    copy.textContent = APP
      ? '¿Nos permites medir visitas y registros? Google Analytics crea estadísticas; Meta y Google Ads miden anuncios. Solo se activan si aceptas.'
      : '¿Nos permites medir los resultados de los anuncios con Meta y Google Ads? Solo se activan si aceptas.'
    const link = document.createElement('a')
    link.href = 'https://trazaqr.com/cookies'; link.textContent = ' Más información y preferencias'
    link.style.color = '#9fc3ee'; copy.appendChild(link)
    banner.appendChild(copy)
    const actions = document.createElement('span')
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap'
    if (APP && read('tqr_analytics') === null && read('tqr_advertising') === null) {
      actions.appendChild(button('Aceptar ambas', true, function () { write('tqr_analytics', 'si'); write('tqr_advertising', 'si'); removeBanner(); loadGoogle(); loadMeta(); loadGoogleAds() }))
      actions.appendChild(button('Solo estadísticas', false, function () { write('tqr_analytics', 'si'); write('tqr_advertising', 'no'); removeBanner(); loadGoogle() }))
      actions.appendChild(button('Rechazar', false, function () { write('tqr_analytics', 'no'); write('tqr_advertising', 'no'); removeBanner() }))
    } else if (APP && read('tqr_analytics') === null) {
      actions.appendChild(button('Aceptar estadísticas', true, function () { write('tqr_analytics', 'si'); removeBanner(); loadGoogle() }))
      actions.appendChild(button('Rechazar estadísticas', false, function () { write('tqr_analytics', 'no'); removeBanner() }))
    } else {
      actions.appendChild(button('Aceptar publicidad', true, function () { write('tqr_advertising', 'si'); removeBanner(); loadMeta(); loadGoogleAds() }))
      actions.appendChild(button('Rechazar', false, function () { write('tqr_advertising', 'no'); removeBanner() }))
    }
    banner.appendChild(actions)
    document.body.appendChild(banner)
  }
  function syncLandingChoice() {
    if (APP) return
    try {
      const choice = localStorage.getItem('tqr_cookies')
      if (choice === 'si' || choice === 'no') write('tqr_analytics', choice)
    } catch (e) { /* almacenamiento bloqueado */ }
  }
  window.tqrTracking = { pageView, completeRegistration, refresh: function () { loadGoogle(); loadMeta(); loadGoogleAds() } }
  document.addEventListener('click', function (event) {
    if (!APP && (event.target.closest('#ck-aceptar, #ck-rechazar, #cookie-banner button, .botones button'))) {
      setTimeout(syncLandingChoice, 0)
    }
  })
  document.addEventListener('DOMContentLoaded', function () {
    syncLandingChoice()
    loadGoogle(); loadMeta(); loadGoogleAds()
    if (read('tqr_advertising') === null || (APP && read('tqr_analytics') === null)) showBanner()
  })
})()
