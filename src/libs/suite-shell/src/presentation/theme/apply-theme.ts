import { THEME_COLOR } from '@sil/ui-tokens';
import type { ThemePreference } from '../../domain/theme-preference.ts';

/**
 * Aplica la preferencia al documento (anexo A1 §9.3). `system` quita `data-theme` y decide
 * `prefers-color-scheme` desde el CSS; un valor explícito lo escribe en la raíz y los tokens fijan
 * `color-scheme` coherente. `theme-color`: con `system` cada etiqueta recupera su color por su
 * `media`; con un valor explícito las dos llevan el color elegido (barra del navegador móvil).
 */
export function applyTheme(preference: ThemePreference, root: HTMLElement = document.documentElement): void {
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
  for (const meta of root.ownerDocument.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const isDark = (meta.getAttribute('media') ?? '').includes('dark');
    meta.content = preference === 'system' ? THEME_COLOR[isDark ? 'dark' : 'light'] : THEME_COLOR[preference];
  }
}
