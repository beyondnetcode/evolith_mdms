import type { ReactNode } from 'react';
import { InlineNotice } from '../InlineNotice.tsx';

export interface SummaryError {
  /** Id del control que recibe el foco al pulsar el enlace. */
  readonly fieldId: string;
  /** Nombre del campo tal como lo ve el usuario. */
  readonly label: string;
  readonly message: string;
}

interface ErrorSummaryProps {
  readonly title: string;
  readonly errors: readonly SummaryError[];
  /** Contenido después de la lista (p. ej. un enlace al recurso que causó el error). */
  readonly children?: ReactNode;
}

/**
 * Composición de M3 (D-021): resumen de errores de un formulario (WCAG 3.3.1). Un aviso en línea de error con
 * un enlace por campo, «Etiqueta: mensaje», que lleva el foco al control. Lo usan el registro y cualquier
 * formulario que valide al enviar; quien lo monta le pasa el foco al aparecer.
 */
export function ErrorSummary({ title, errors, children }: ErrorSummaryProps) {
  return (
    <InlineNotice severity="error" announce title={title}>
      <ul className="mt-1 list-disc pl-5">
        {errors.map((error) => (
          <li key={error.fieldId} className="py-1">
            <a
              href={`#${error.fieldId}`}
              className="underline"
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(error.fieldId)?.focus();
              }}
            >
              {error.label}: {error.message}
            </a>
          </li>
        ))}
      </ul>
      {children}
    </InlineNotice>
  );
}
