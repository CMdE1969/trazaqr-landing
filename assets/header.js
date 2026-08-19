/* ==========================================================================
   TrazaQR — Comportamiento del menú público (hamburguesa móvil).

   El HTML del <nav> es la fuente de verdad en partials/header.html y se
   inserta en cada página EN TIEMPO DE BUILD (scripts/build-header.js),
   entre los marcadores TQR:HEADER:START / TQR:HEADER:END.

   Este fichero NO genera ni inyecta ningún markup — los enlaces ya están
   en el HTML servido, a propósito, para que existan sin depender de JS
   (SEO/crawlers). Aquí solo se engancha el comportamiento sobre el <nav>
   que ya está presente:
     - abrir/cerrar la hamburguesa;
     - aria-expanded / aria-label dinámicos;
     - cerrar al pulsar fuera del menú;
     - cerrar con la tecla Escape;
     - cerrar al seleccionar cualquier opción.
   ========================================================================== */
(function () {
  'use strict';

  function init() {
    var toggle = document.getElementById('tqr-nav-toggle');
    var list = document.getElementById('tqr-nav-links');
    if (!toggle || !list) return; // página sin cabecera pública — no debería ocurrir

    var nav = toggle.closest('.tqr-nav') || list.closest('.tqr-nav') || list.parentElement;
    var icon = toggle.querySelector('span');

    function isOpen() {
      return list.classList.contains('tqr-open');
    }

    function setOpen(open) {
      list.classList.toggle('tqr-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      if (icon) icon.textContent = open ? '×' : '☰';
    }

    // Abrir/cerrar con el botón.
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!isOpen());
    });

    // Cerrar al seleccionar cualquier opción del menú.
    list.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    // Cerrar al pulsar fuera del menú.
    document.addEventListener('click', function (e) {
      if (isOpen() && nav && !nav.contains(e.target)) setOpen(false);
    });

    // Cerrar con Escape (y devolver el foco al botón).
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Si se ensancha la ventana por encima del breakpoint con el menú
    // móvil abierto, no dejarlo "abierto" oculto en el DOM.
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900 && isOpen()) setOpen(false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
