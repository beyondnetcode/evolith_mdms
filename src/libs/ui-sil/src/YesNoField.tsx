import { useId } from 'react';
import { Icon } from './Icon.tsx';
import { joinClasses } from './join-classes.ts';

interface YesNoFieldProps {
  /** La pregunta completa: es la leyenda del grupo. */
  readonly label: string;
  readonly name: string;
  /** `SI`, `NO` o vacío: sin valor por defecto, nada viene marcado. */
  readonly defaultValue?: string;
  readonly required?: boolean;
  readonly error?: string | undefined;
  readonly help?: string | undefined;
  /** Id del primer botón de opción: el resumen de errores lleva el foco aquí. */
  readonly fieldId?: string;
  readonly className?: string;
}

const OPTIONS = [
  { value: 'SI', text: 'Sí' },
  { value: 'NO', text: 'No' },
] as const;

/**
 * Pregunta de respuesta Sí o No (US-SIL-001: «¿El cliente requiere servicio de transporte?»). Dos botones de
 * opción nativos en un `fieldset` con leyenda, con la anatomía del grupo «Tema»: flechas para moverse,
 * `Espacio` elige. No hay valor por defecto: hasta que la persona responde, ninguno está marcado.
 */
export function YesNoField({ label, name, defaultValue = '', required = false, error, help, fieldId, className }: YesNoFieldProps) {
  const autoId = useId();
  const id = fieldId ?? autoId;
  const supportingTextId = `${id}-apoyo`;
  const hasError = error !== undefined && error !== '';
  return (
    <fieldset
      aria-describedby={hasError || help !== undefined ? supportingTextId : undefined}
      className={joinClasses('flex min-w-0 flex-col gap-1', className)}
    >
      <legend className={joinClasses('mb-1 px-1 text-body-small', hasError ? 'text-error' : 'text-on-surface-variant')}>
        {label}
        {required && ' (obligatorio)'}
      </legend>
      <div className={joinClasses('flex flex-wrap gap-2 rounded-xs border p-1', hasError ? 'border-error' : 'border-outline')}>
        {OPTIONS.map((option, index) => (
          <label
            key={option.value}
            className="state-layer flex min-h-12 min-w-24 flex-1 cursor-pointer items-center gap-3 rounded-sm px-3 text-body-large text-on-surface has-checked:bg-secondary-container has-checked:text-on-secondary-container"
          >
            <input
              id={index === 0 ? id : undefined}
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={defaultValue === option.value}
              required={required}
              className="size-5 shrink-0 cursor-pointer accent-primary"
            />
            {option.text}
          </label>
        ))}
      </div>
      {hasError ? (
        <p id={supportingTextId} className="flex items-start gap-1 px-4 text-body-small text-error">
          <Icon name="error" className="size-4" />
          <span>{error}</span>
        </p>
      ) : (
        help !== undefined && (
          <p id={supportingTextId} className="px-4 text-body-small text-on-surface-variant">
            {help}
          </p>
        )
      )}
    </fieldset>
  );
}
