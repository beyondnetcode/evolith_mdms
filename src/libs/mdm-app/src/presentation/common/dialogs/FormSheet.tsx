import { Button, InlineNotice, ModalDialog, useWindowSizeClass } from '@sil/ui';
import { useEffect, useRef, useState, type SubmitEvent, type ReactNode } from 'react';

interface Props {
  readonly title: string;
  readonly formId: string;
  /** Verbo de la acción: «Guardar», «Agregar». */
  readonly submitLabel: string;
  /** Envío del formulario: el `submit` de `useSubmitAction` (Action de React 19). */
  readonly onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  readonly pending: boolean;
  /** Sin lo necesario para enviar (catálogos cargando): la acción queda deshabilitada. */
  readonly disabled?: boolean;
  /** Hay cambios sin guardar: cerrar pide confirmación. */
  readonly dirty: boolean;
  readonly onClose: () => void;
  /** Avisos al inicio del formulario: resumen de errores, D-MDM-14, error sin campo. */
  readonly notices?: ReactNode;
  readonly children: ReactNode;
}

/**
 * Formulario en diálogo (UX-MDM-001 §5.6; UI-MDM-001 §3.5): a pantalla completa en `compact` y hoja lateral modal
 * desde `medium`, con `ModalDialog` de `ui-sil` (`<dialog>` nativo: foco atrapado, `Escape`, resto inerte). El
 * foco inicial va al campo marcado con `data-autofocus`. Con cambios sin guardar, `Escape`, «Cerrar» y «Cancelar»
 * piden confirmación en lugar de cerrar (AC-09). Mientras se envía, el botón queda en progreso sin perder el foco.
 */
export function FormSheet({ title, formId, submitLabel, onSubmit, pending, disabled = false, dirty, onClose, notices, children }: Props) {
  const compact = useWindowSizeClass() === 'compact';
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const keepEditing = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmingDiscard) keepEditing.current?.focus();
  }, [confirmingDiscard]);

  function requestClose(): void {
    if (pending) return;
    if (dirty) setConfirmingDiscard(true);
    else onClose();
  }

  return (
    <ModalDialog
      open
      title={title}
      variant={compact ? 'full-screen' : 'side-sheet'}
      // Con cambios, la plataforma no cierra con `Escape`: lo intercepta el formulario para confirmar.
      closable={!dirty && !pending}
      onClose={requestClose}
      actions={
        <>
          <Button onClick={requestClose}>Cancelar</Button>
          <Button type="submit" form={formId} variant="filled" aria-disabled={pending || disabled ? true : undefined} aria-busy={pending}>
            {pending ? 'Guardando…' : submitLabel}
          </Button>
        </>
      }
    >
      {/* Con cambios, `Escape` no lo resuelve la plataforma (`closable`): aquí se pide confirmación. */}
      <div
        role="presentation"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && (dirty || pending)) {
            event.preventDefault();
            requestClose();
          }
        }}
      >
        <form
          id={formId}
          noValidate
          onSubmit={(event) => {
            // Sin catálogos no se envía; el envío en curso lo descarta `useSubmitAction`.
            if (disabled) event.preventDefault();
            else onSubmit(event);
          }}
          className="flex flex-col gap-4 pt-2"
        >
          {confirmingDiscard && (
            <InlineNotice
              severity="warning"
              announce
              title="¿Descartar los cambios sin guardar?"
              actions={
                <>
                  <Button ref={keepEditing} variant="text-inherit" onClick={() => setConfirmingDiscard(false)}>
                    Seguir editando
                  </Button>
                  <Button variant="text-inherit" onClick={onClose}>
                    Descartar
                  </Button>
                </>
              }
            >
              Se perderá lo que escribiste.
            </InlineNotice>
          )}
          {notices}
          {children}
        </form>
      </div>
    </ModalDialog>
  );
}
