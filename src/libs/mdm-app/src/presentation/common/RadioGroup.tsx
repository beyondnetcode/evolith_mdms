import { useId } from 'react';

export interface RadioOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface Props<T extends string> {
  readonly legend: string;
  readonly options: ReadonlyArray<RadioOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** `id` del primer botón: el resumen de errores enlaza con él. */
  readonly fieldId?: string;
  readonly help?: string;
  /** Mientras se envía: no cambia, pero conserva el foco (UI-MDM-001 §4.2). */
  readonly readOnly?: boolean;
  /** Foco inicial del formulario en la opción elegida (`data-autofocus`, como el resto de campos). */
  readonly initialFocus?: boolean;
}

/**
 * Grupo de radio nativo (`fieldset` + `legend`, WCAG 1.3.1) con objetivos de 48 dp (WCAG 2.5.8): las flechas mueven
 * la selección, como manda la plataforma. `RadioGroup` no existe en `ui-sil` (G-586): composición local hasta que se
 * promueva, con el mismo trazo que `Checkbox`.
 */
export function RadioGroup<T extends string>({ legend, options, value, onChange, fieldId, help, readOnly = false, initialFocus = false }: Props<T>) {
  const name = useId();
  const helpId = `${name}-apoyo`;
  return (
    <fieldset aria-describedby={help === undefined ? undefined : helpId} className="flex flex-col gap-1">
      <legend className="pb-1 text-body-medium text-on-surface-variant">{legend}</legend>
      {options.map((option, index) => {
        const id = index === 0 && fieldId !== undefined ? fieldId : `${name}-${option.value}`;
        return (
          <label key={option.value} htmlFor={id} className="flex min-h-12 cursor-pointer items-center gap-3">
            <input
              id={id}
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              data-autofocus={initialFocus && option.value === value ? '' : undefined}
              onChange={() => {
                if (!readOnly) onChange(option.value);
              }}
              className="size-5 shrink-0 cursor-pointer accent-primary"
            />
            <span className="text-body-large break-words">{option.label}</span>
          </label>
        );
      })}
      {help !== undefined && (
        <p id={helpId} className="ps-8 text-body-small text-on-surface-variant">
          {help}
        </p>
      )}
    </fieldset>
  );
}
