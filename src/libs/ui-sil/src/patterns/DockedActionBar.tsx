import type { ReactNode } from 'react';

interface DockedActionBarProps {
  /** Nota a la izquierda, en `body-medium` (p. ej. «Guardar no envía nada al TMS.»). */
  readonly note?: string;
  /** Las acciones, a la derecha: la principal al final. */
  readonly children: ReactNode;
}

/**
 * Composición de M3 (D-021): barra de acciones acoplada al pie de un formulario largo (UX-SIL-001 §3.4), en
 * `surface-container`, siempre visible al desplazar. Se usa en escritorio; en `compact` las acciones van en la
 * barra superior del diálogo de pantalla completa.
 */
export function DockedActionBar({ note, children }: DockedActionBarProps) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 bg-surface-container px-6 py-3 medium:-mx-6">
      {note !== undefined && <p className="mr-auto text-body-medium text-on-surface-variant">{note}</p>}
      {children}
    </div>
  );
}
