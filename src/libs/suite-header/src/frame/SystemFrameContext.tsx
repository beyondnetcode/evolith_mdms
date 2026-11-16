import { createContext, use } from 'react';

/**
 * Lo que el marco común ofrece a las pantallas del sistema montado. En `compact` la cabecera de la pantalla y la
 * barra superior son UNA sola barra (UX-SIL-001 §3.1): la pantalla pinta su cabecera en `compactSlot` por un
 * portal y lo declara con `registerCompactHeader`, para que el marco no repita el nombre del sistema ni el botón
 * de menú; con `openMenu` la pantalla abre el cajón de navegación desde su propio botón.
 */
export interface SystemFrameControls {
  /** Hueco de la barra superior donde la pantalla pinta su cabecera en `compact`; `null` mientras no exista. */
  readonly compactSlot: HTMLElement | null;
  readonly registerCompactHeader: (active: boolean) => void;
  readonly openMenu: () => void;
}

export const SystemFrameContext = createContext<SystemFrameControls | null>(null);

/** Controles del marco común; `null` fuera de un `SystemFrame`. */
export function useSystemFrame(): SystemFrameControls | null {
  return use(SystemFrameContext);
}
