import type { ReactNode } from 'react';
import { Button } from '../Button.tsx';
import { ModalDialog } from '../ModalDialog.tsx';

interface ConfirmDialogProps {
  readonly title: string;
  readonly open: boolean;
  readonly onCancel: () => void;
  /** Texto de la acción que cierra sin confirmar; por defecto «Volver». */
  readonly cancelLabel?: string;
  /** La acción que confirma: un botón o un enlace con estilo de botón de texto. */
  readonly confirm: ReactNode;
  readonly children: ReactNode;
}

/**
 * Composición de M3 (D-021): diálogo básico de confirmación con dos acciones de texto, la que vuelve primero y
 * la que confirma al final («¿Descartar la solicitud?»). `Escape` y el fondo cierran sin confirmar.
 */
export function ConfirmDialog({ title, open, onCancel, cancelLabel = 'Volver', confirm, children }: ConfirmDialogProps) {
  return (
    <ModalDialog
      title={title}
      open={open}
      onClose={onCancel}
      actions={
        <>
          <Button onClick={onCancel}>{cancelLabel}</Button>
          {confirm}
        </>
      }
    >
      {children}
    </ModalDialog>
  );
}
