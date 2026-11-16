import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon.tsx';
import { joinClasses } from './join-classes.ts';

interface EmptyStateProps {
  readonly icon: IconName;
  /** Qué pasa y por qué está vacío: es el nombre del estado. */
  readonly title: string;
  /** Una o dos líneas de apoyo. */
  readonly children?: ReactNode;
  /** UNA sola acción que resuelve el vacío (botón o enlace). */
  readonly action?: ReactNode;
  /** `sheet`: dentro de una hoja o de un panel estrecho, alineado a la izquierda y con título más pequeño. */
  readonly placement?: 'page' | 'sheet';
  /** El vacío aparece tras buscar o filtrar: se anuncia con `role="status"` (WCAG 4.1.3). */
  readonly announce?: boolean;
  readonly className?: string;
}

/**
 * Estado vacío (UI-SIL-001 §4.13, UI-11, EX-01 del anexo A1 §12): un disco de 80 dp con un icono de 40 dp, el título,
 * una o dos líneas de apoyo y UNA acción. Sin ilustración ni fotografía (no hay activo con licencia, G-198). Un
 * solo componente sirve a primer uso, sin resultados, sin permiso y error de lectura. El icono es decorativo
 * (`aria-hidden`); el título es el nombre.
 */
export function EmptyState({ icon, title, children, action, placement = 'page', announce = false, className }: EmptyStateProps) {
  const centered = placement === 'page';
  return (
    <div
      role={announce ? 'status' : undefined}
      className={joinClasses('flex flex-col gap-3 py-12 medium:py-16', centered ? 'items-center text-center' : 'items-start text-left', className)}
    >
      <span aria-hidden="true" className="inline-flex size-20 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
        <Icon name={icon} className="size-10" />
      </span>
      <p className={joinClasses('max-w-90', centered ? 'text-title-large' : 'text-title-medium')}>{title}</p>
      {children !== undefined && <div className="max-w-90 text-body-medium text-on-surface-variant">{children}</div>}
      {action !== undefined && action !== false && <div className="pt-1">{action}</div>}
    </div>
  );
}
