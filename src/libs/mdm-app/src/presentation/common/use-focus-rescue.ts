import { useCallback, useEffect, useRef } from 'react';
import type { FocusTarget } from './dialogs/use-dialog-host.ts';

/**
 * Tras una acción de un clic la sección se vuelve a pintar con los datos nuevos; si el control que tenía el foco
 * desapareció (el establecimiento desactivado deja de verse con el filtro «Activos»), el foco no se pierde en el
 * documento: va a `fallback`, el encabezado de la sección (UX-MDM-001 §7, WCAG 2.4.3). `revision` cambia con los datos;
 * se comprueba solo en el primer cambio tras `arm()`.
 */
export function useFocusRescue(fallback: FocusTarget, revision: unknown): () => void {
  const armed = useRef(false);
  useEffect(() => {
    if (!armed.current) return;
    armed.current = false;
    const active = document.activeElement;
    if (active === null || active === document.body || !active.isConnected) fallback()?.focus();
  }, [revision, fallback]);
  return useCallback(() => {
    armed.current = true;
  }, []);
}
