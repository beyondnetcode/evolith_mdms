import { useCallback, useEffect, useRef, useState } from 'react';

/** Cómo encontrar el control al que vuelve el foco, en el momento de cerrar (puede haberse vuelto a pintar). */
export type FocusTarget = () => HTMLElement | null;

export interface DialogHost<D> {
  readonly dialog: D | null;
  readonly open: (dialog: D, returnFocusTo: FocusTarget) => void;
  readonly close: () => void;
}

/**
 * Un diálogo abierto a la vez y el retorno del foco al cerrarlo (UX-MDM-001 §7, WCAG 2.4.3; AC-11). La plataforma
 * devuelve el foco al elemento que lo tenía al abrir, pero un diálogo abierto desde un menú lo abre un elemento que
 * desaparece con el menú: por eso el foco vuelve al disparador visible (el botón del menú). Si ya no existe —la
 * fila de un elemento que dejó de mostrarse—, al encabezado de la sección (`fallback`). `revision` es la versión de lo
 * que se pinta (la de la ficha).
 */
export function useDialogHost<D>(fallback: FocusTarget, revision: number): DialogHost<D> {
  const [dialog, setDialog] = useState<D | null>(null);
  const target = useRef<FocusTarget | null>(null);
  const restore = useRef(false);
  const restored = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (dialog !== null || !restore.current) return;
    restore.current = false;
    const trigger = target.current?.() ?? null;
    restored.current = trigger?.isConnected === true ? trigger : fallback();
    restored.current?.focus();
  }, [dialog, fallback]);

  // Tras una escritura la ficha se vuelve a pintar con la versión nueva: si el disparador desapareció entonces
  // (el identificador vencido deja de mostrarse), el foco no se pierde en el documento.
  useEffect(() => {
    const element = restored.current;
    if (element === null || element.isConnected) return;
    restored.current = null;
    fallback()?.focus();
  }, [revision, fallback]);

  const open = useCallback((next: D, returnFocusTo: FocusTarget) => {
    target.current = returnFocusTo;
    setDialog(next);
  }, []);

  const close = useCallback(() => {
    restore.current = true;
    setDialog(null);
  }, []);

  return { dialog, open, close };
}
