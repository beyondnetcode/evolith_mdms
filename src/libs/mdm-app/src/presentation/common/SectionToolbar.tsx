import { Button } from '@sil/ui';
import { useId, type ReactNode } from 'react';

/** Acción primaria de la sección: disponible, o deshabilitada con su explicación visible. */
export type SectionAction =
  | { readonly kind: 'available'; readonly label: string; readonly onSelect: (trigger: HTMLElement) => void }
  | { readonly kind: 'blocked'; readonly label: string; readonly reason: string };

interface Props {
  /** Interruptor o pestañas de filtro, a la izquierda. */
  readonly filter?: ReactNode;
  /** `null` si la persona no puede (o la organización es de solo lectura): no se pinta (UX-MDM-001 §5.4). */
  readonly action: SectionAction | null;
}

/**
 * Barra de sección (UI-MDM-001 §3.3 y §5.2): filtro a la izquierda y botón tonal con la acción primaria a la derecha.
 * Bloqueada (organización suspendida), el botón conserva el foco con `aria-disabled` y su explicación es texto de
 * apoyo visible, enlazado con `aria-describedby` (WCAG 1.4.13; UX-MDM-001 §5.4), no un _tooltip_.
 */
export function SectionToolbar({ filter, action }: Props) {
  const reasonId = useId();
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      {filter !== undefined && <div className="min-w-64 flex-1">{filter}</div>}
      {action !== null && (
        <div className="ms-auto flex flex-col items-end gap-1">
          {action.kind === 'available' ? (
            <Button variant="tonal" onClick={(event) => action.onSelect(event.currentTarget)}>
              {action.label}
            </Button>
          ) : (
            <>
              <Button variant="tonal" aria-disabled aria-describedby={reasonId}>
                {action.label}
              </Button>
              <p id={reasonId} className="text-body-small text-on-surface-variant">
                {action.reason}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
