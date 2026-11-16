import { useId, type ReactNode } from 'react';

interface Props {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** Qué produce la casilla; se asocia como descripción accesible. */
  readonly description?: ReactNode;
  /** Mientras se envía: no cambia, pero conserva el foco y el contraste (UI-MDM-001 §4.2). */
  readonly readOnly?: boolean;
  readonly fieldId?: string;
  readonly error?: string | undefined;
}

/**
 * Casilla nativa con su etiqueta y un objetivo de 48 dp (WCAG 2.5.8). `Checkbox` no existe en `ui-sil` (G-580,
 * UI-MDM-001 §5.3): composición local hasta que se promueva.
 */
export function Checkbox({ label, checked, onChange, description, readOnly = false, fieldId, error }: Props) {
  const autoId = useId();
  const id = fieldId ?? autoId;
  const descriptionId = `${id}-apoyo`;
  const hasError = error !== undefined && error !== '';
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={description !== undefined || hasError ? descriptionId : undefined}
          onChange={(event) => {
            if (!readOnly) onChange(event.target.checked);
          }}
          className="size-5 shrink-0 cursor-pointer accent-primary"
        />
        <span className="text-body-large">{label}</span>
      </label>
      {(description !== undefined || hasError) && (
        <p id={descriptionId} className={hasError ? 'ps-8 text-body-small text-error' : 'ps-8 text-body-small text-on-surface-variant'}>
          {hasError ? error : description}
        </p>
      )}
    </div>
  );
}
