import { type ComponentPropsWithoutRef, useId } from 'react';
import { Icon } from './Icon.tsx';
import { joinClasses } from './join-classes.ts';

interface SwitchProps extends Omit<ComponentPropsWithoutRef<'button'>, 'role' | 'onChange' | 'children'> {
  readonly label: string;
  /** Qué produce la opción; se asocia como descripción accesible. */
  readonly description?: string;
  readonly active: boolean;
  readonly onChange: (active: boolean) => void;
}

/**
 * Interruptor de M3 (pista de 52 × 32 dp) como `role="switch"` con su etiqueta y descripción.
 * El estado no se dice solo con el color: el control activo lleva un icono de verificación y el
 * lector anuncia «activado/desactivado» por `aria-checked`. Objetivo táctil de 48 dp.
 */
export function Switch({ label, description, active, onChange, disabled, className, ...rest }: SwitchProps) {
  const id = useId();
  const labelId = `${id}-etiqueta`;
  const descriptionId = `${id}-descripcion`;
  return (
    <div className={joinClasses('flex min-h-14 items-center gap-4', className)}>
      <div className="min-w-0 flex-1">
        <p id={labelId} className="text-body-large">
          {label}
        </p>
        {description !== undefined && (
          <p id={descriptionId} className="text-body-medium text-on-surface-variant">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-labelledby={labelId}
        aria-describedby={description === undefined ? undefined : descriptionId}
        disabled={disabled}
        onClick={() => onChange(!active)}
        className={joinClasses(
          'target-48 inline-flex h-8 w-13 shrink-0 cursor-pointer items-center rounded-full border-2 px-0.5 transition-colors',
          active ? 'border-primary bg-primary' : 'border-outline bg-surface-container-highest',
          'disabled:cursor-not-allowed disabled:opacity-38',
        )}
        {...rest}
      >
        <span
          aria-hidden="true"
          className={joinClasses(
            'flex items-center justify-center rounded-full transition-all',
            active ? 'size-6 translate-x-5 bg-on-primary text-primary' : 'size-4 translate-x-1 bg-outline',
          )}
        >
          {active && <Icon name="check" className="size-4" />}
        </span>
      </button>
    </div>
  );
}
