import { Button, ModalDialog } from '@sil/ui';
import { useId, type SubmitEvent, type ReactNode } from 'react';
import { DangerButton } from '../DangerButton.tsx';

interface Props {
  /** En forma de pregunta: «¿Archivar ACME?». */
  readonly title: string;
  /** Verbo exacto: «Archivar», «Suspender», «Vencer». */
  readonly confirmLabel: string;
  /** `danger` en las terminales (D-MDM-08 a 12 y D-MDM-03); `primary` en las reversibles (D-MDM-13). */
  readonly tone: 'danger' | 'primary';
  /** Envío: el `submit` de `useSubmitAction` (Action de React 19). */
  readonly onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  readonly pending: boolean;
  readonly onCancel: () => void;
  /** Aviso al inicio del cuerpo: D-MDM-14 o el error del servidor. El diálogo no se cierra (UI-MDM-001 §4.2). */
  readonly notice?: ReactNode;
  readonly children: ReactNode;
}

/**
 * Confirmación (UX-MDM-001 §5.6; UI-MDM-001 §3.5): diálogo básico en todos los tamaños, título en forma de
 * pregunta, cuerpo que dice el efecto y dos botones. El foco inicial está en «Cancelar», no en la acción (AC-10,
 * WCAG 3.3.4). Campos de fecha y motivo solo donde el contrato los recibe.
 */
export function ConfirmDialog({ title, confirmLabel, tone, onSubmit, pending, onCancel, notice, children }: Props) {
  const formId = useId();
  const confirm = {
    type: 'submit',
    form: formId,
    'aria-disabled': pending ? true : undefined,
    'aria-busy': pending,
    children: pending ? `${confirmLabel}…` : confirmLabel,
  } as const;
  return (
    <ModalDialog
      open
      title={title}
      closable={!pending}
      onClose={() => {
        if (!pending) onCancel();
      }}
      actions={
        <>
          <Button data-autofocus="" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          {tone === 'danger' ? <DangerButton {...confirm} /> : <Button variant="filled" {...confirm} />}
        </>
      }
    >
      <form id={formId} noValidate onSubmit={onSubmit} className="flex flex-col gap-4 text-body-medium text-on-surface-variant">
        {notice}
        {children}
      </form>
    </ModalDialog>
  );
}
