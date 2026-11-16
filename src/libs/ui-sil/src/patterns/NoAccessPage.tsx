import type { ReactNode, Ref } from 'react';
import { joinClasses } from '../join-classes.ts';

interface NoAccessPageProps {
  readonly headingId: string;
  readonly title: string;
  readonly message: string;
  /** `alert` cuando el bloqueo es la respuesta a un intento de ingreso (US-SIL-004): se anuncia al llegar. */
  readonly announce?: boolean;
  /** La salida: volver a un lugar donde sí se tiene acceso. */
  readonly action: ReactNode;
  /** Para llevar el foco al título al llegar (quien monta la página decide si lo hace). */
  readonly headingRef?: Ref<HTMLHeadingElement>;
  readonly className?: string;
}

/**
 * Página de «sin acceso» o «no encontrada» (composición de M3, D-021): título, por qué y una sola salida. No revela
 * si el recurso existe (ADR-0165 P-SEC-01). La usan la suite (sin acceso a un sistema) y SIL (sin acceso o 404).
 */
export function NoAccessPage({ headingId, title, message, announce = false, action, headingRef, className }: NoAccessPageProps) {
  return (
    <section aria-labelledby={headingId} className={joinClasses('flex w-full max-w-xl flex-col items-start gap-4 py-8', className)}>
      <h1 ref={headingRef} tabIndex={headingRef === undefined ? undefined : -1} id={headingId} className="text-headline-small outline-none">
        {title}
      </h1>
      {announce ? (
        <p role="alert" className="text-body-large">
          {message}
        </p>
      ) : (
        <p className="text-body-large">{message}</p>
      )}
      {action}
    </section>
  );
}
