import { MIN_WIDTH_DP } from '@sil/ui-tokens';

/*
 * AYUDANTES DE PRUEBAS (jsdom no trae `matchMedia`): el ancho de ventana y el esquema de color del sistema
 * operativo, de los que depende la forma de la interfaz. Los comparten los arneses de la suite, de SIL y del
 * anfitrión. No se usan en producción.
 */
let systemScheme: 'light' | 'dark' = 'light';

/** Simula el esquema de color del sistema operativo (`prefers-color-scheme`). */
export function setSystemScheme(scheme: 'light' | 'dark'): void {
  systemScheme = scheme;
}

/** Simula el ancho de ventana en dp. */
export function setWidth(widthDp: number): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => {
      const minimum = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0);
      return {
        matches: /prefers-color-scheme:\s*dark/.test(query) ? systemScheme === 'dark' : widthDp >= minimum,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      };
    },
  });
}

/** Un ancho representativo de cada clase de tamaño de ventana. */
export const WIDTHS = { compact: 412, medium: MIN_WIDTH_DP.medium + 100, expanded: MIN_WIDTH_DP.expanded + 160 } as const;
