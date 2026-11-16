import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Icon, type IconName } from './Icon.tsx';
import { joinClasses } from './join-classes.ts';

export type Severity = 'error' | 'warning' | 'info' | 'neutral';

const DEFINITION: Readonly<Record<Severity, { classes: string; icon: IconName; word: string }>> = {
  error: { classes: 'bg-error-container text-on-error-container', icon: 'error', word: 'Error' },
  warning: { classes: 'bg-warning-container text-on-warning-container', icon: 'warning', word: 'Atención' },
  info: { classes: 'bg-primary-container text-on-primary-container', icon: 'info', word: 'Información' },
  /** Sin énfasis (anexo A1 §11.7): el aviso de prototipo, una vez por pantalla. */
  neutral: { classes: 'bg-surface-container-low text-on-surface-variant', icon: 'info', word: 'Información' },
};

interface InlineNoticeProps extends Omit<ComponentPropsWithoutRef<'div'>, 'title'> {
  readonly severity: Severity;
  /** Primera línea, en `title-small`. */
  readonly title?: ReactNode;
  /** Acciones (botones de texto) alineadas al final. */
  readonly actions?: ReactNode;
  /** Región en vivo: úsala solo si el aviso aparece tras una acción o un fallo (WCAG 4.1.3). */
  readonly announce?: boolean;
}

/**
 * Aviso en línea: composición de tarjeta rellena (M3 no tiene banner). Lo persistente va aquí;
 * lo transitorio, en snackbar. El icono y el texto dicen la gravedad, no solo el color.
 */
export function InlineNotice({ severity, title, actions, announce = false, children, className, ...rest }: InlineNoticeProps) {
  const definition = DEFINITION[severity];
  return (
    <div
      role={announce ? (severity === 'error' ? 'alert' : 'status') : undefined}
      className={joinClasses('flex flex-wrap items-start gap-3 rounded-md px-4', actions === undefined ? 'py-3' : 'py-2', definition.classes, className)}
      {...rest}
    >
      <Icon name={definition.icon} />
      <div className="min-w-48 flex-1">
        <span className="sr-only">{definition.word}: </span>
        {title !== undefined && <p className="text-title-small">{title}</p>}
        {children !== undefined && <div className="text-body-medium">{children}</div>}
      </div>
      {actions !== undefined && <div className="flex flex-wrap items-center gap-2 self-center">{actions}</div>}
    </div>
  );
}
