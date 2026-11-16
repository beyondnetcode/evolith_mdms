import { InlineNotice } from '@sil/ui';
import { useEffect, useRef } from 'react';

export interface SummaryError {
  /** `id` del control con el error: el enlace lleva el foco a él. */
  readonly fieldId: string;
  readonly message: string;
}

interface Props {
  readonly errors: readonly SummaryError[];
  /** Cambia en cada envío con errores: el resumen vuelve a recibir el foco aunque los errores sean los mismos. */
  readonly attempt: number;
}

export const ERROR_SUMMARY_TITLE = 'Revisa los campos marcados.';

/**
 * Resumen de errores (UX-MDM-001 §7, WCAG 3.3.1 y 2.4.3; UI-MDM-001 AC-15): al enviar con errores recibe el foco
 * —en lugar de anunciarse dos veces— y cada enlace lleva al campo. No existe en `ui-sil` y en `sil-app` hay dos
 * versiones privadas que MDM no puede importar (G-580): vive aquí hasta que se promueva.
 */
export function ErrorSummary({ errors, attempt }: Props) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (attempt > 0) container.current?.focus();
  }, [attempt]);

  if (errors.length === 0) return null;
  return (
    <div
      ref={container}
      tabIndex={-1}
      className="rounded-md outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-secondary"
    >
      <InlineNotice severity="error" title={ERROR_SUMMARY_TITLE}>
        <ul className="mt-1 flex list-disc flex-col gap-1 ps-5">
          {errors.map((error) => (
            <li key={error.fieldId}>
              <a
                href={`#${error.fieldId}`}
                className="underline"
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById(error.fieldId)?.focus();
                }}
              >
                {error.message}
              </a>
            </li>
          ))}
        </ul>
      </InlineNotice>
    </div>
  );
}
