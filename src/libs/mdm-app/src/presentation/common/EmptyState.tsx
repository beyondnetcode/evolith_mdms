import type { ReactNode } from 'react';
import { MdmIcon, type MdmIconName } from './MdmIcon.tsx';

interface Props {
  readonly icon: MdmIconName;
  readonly title: string;
  readonly children?: ReactNode;
  /** Acciones (botones o enlaces) bajo el texto. */
  readonly actions?: ReactNode;
  /** Región en vivo: solo si el vacío aparece tras buscar o filtrar (WCAG 4.1.3). */
  readonly announce?: boolean;
}

/** Estado vacío (UX-MDM-001 §6.4). `EmptyState` no existe aún en `ui-sil` (G-580). */
export function EmptyState({ icon, title, children, actions, announce = false }: Props) {
  return (
    <div role={announce ? 'status' : undefined} className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface-container-highest text-on-surface-variant">
        <MdmIcon name={icon} />
      </span>
      <p className="max-w-prose text-title-medium text-on-surface">{title}</p>
      {children !== undefined && <div className="max-w-prose text-body-medium text-on-surface-variant">{children}</div>}
      {actions !== undefined && <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
