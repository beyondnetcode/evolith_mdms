import type { ComponentPropsWithoutRef } from 'react';
import { joinClasses } from './join-classes.ts';

interface LoadingBarProps {
  /** Qué se está cargando; se anuncia como «Cargando {qué}». */
  readonly subject: string;
}

/**
 * Indicador lineal indeterminado en la parte superior de la región que carga. La carga va por
 * región y no desplaza el contenido (CLS < 0,1): se reserva el tamaño final con marcadores.
 */
export function LoadingBar({ subject }: LoadingBarProps) {
  return (
    <>
      <div role="progressbar" aria-label={`Cargando ${subject}`} className="h-1 w-full overflow-hidden rounded-full bg-secondary-container">
        <div className="indeterminate-animation h-full w-2/5 rounded-full bg-primary" />
      </div>
      {/* Con movimiento reducido la barra es estática (40 %) y el texto «Cargando…» se ve (UI-SIL-001 §3.8). */}
      <span aria-hidden="true" className="hidden text-body-small text-on-surface-variant motion-reduce:block">
        Cargando…
      </span>
    </>
  );
}

/** Marcador de posición con la forma del contenido final (M3 no especifica skeleton). */
export function Skeleton({ className, ...rest }: ComponentPropsWithoutRef<'div'>) {
  return <div aria-hidden="true" className={joinClasses('rounded-xs bg-surface-container-highest motion-safe:animate-pulse', className)} {...rest} />;
}
