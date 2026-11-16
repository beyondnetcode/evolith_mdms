/*
 * Arranque del tema (anexo A1 §9.3). Script mínimo, SÍNCRONO y del mismo origen: va en el <head>, antes
 * de la hoja de estilos, para que el tema explícito (claro con el sistema oscuro, u oscuro con el sistema
 * claro) se aplique antes de pintar y no haya parpadeo. Va como archivo y no en línea para no exigir
 * `unsafe-inline` ni un hash en la política de contenido (ADR-0165). El caso «sistema» no necesita
 * JavaScript: lo resuelve el CSS con `prefers-color-scheme`.
 *
 * Resolución (la misma que `libs/suite-shell/src/application/theme-preferences.ts`): con sesión, clave del
 * usuario → clave del dispositivo → «sistema». Los valores son `light`, `dark` y `system`; también se leen
 * los que guardaron versiones anteriores (`claro`, `oscuro`, `sistema`). Todo dentro de try/catch: con el
 * almacenamiento bloqueado queda «sistema». Los colores de `theme-color` los emite el generador de tokens en
 * las etiquetas <meta>: aquí solo se copian.
 */
(function () {
  const LEGACY = { claro: 'light', oscuro: 'dark', sistema: 'system' };
  const valid = (v) => (v === 'light' || v === 'dark' || v === 'system' ? v : LEGACY[v] || null);

  function userId() {
    try {
      const session = JSON.parse(window.sessionStorage.getItem('suite.sesion.v1') || 'null');
      return session && session.user && typeof session.user.id === 'string' ? session.user.id : null;
    } catch {
      return null;
    }
  }

  function preference() {
    const id = userId();
    const fromUser = id === null ? null : valid(window.localStorage.getItem('suite.tema.' + id));
    return fromUser || valid(window.localStorage.getItem('suite.tema')) || 'system';
  }

  function metaColor(metas, theme) {
    let color = null;
    metas.forEach((meta) => {
      const media = meta.getAttribute('media') || '';
      if (media.indexOf(theme) !== -1) color = meta.getAttribute('content');
    });
    return color;
  }

  try {
    const theme = preference();
    if (theme === 'system') return;
    document.documentElement.setAttribute('data-theme', theme);
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    const color = metaColor(metas, theme);
    if (color) metas.forEach((meta) => meta.setAttribute('content', color));
  } catch {
    // Almacenamiento bloqueado o inaccesible: se queda en «sistema» y decide el CSS.
  }
})();
