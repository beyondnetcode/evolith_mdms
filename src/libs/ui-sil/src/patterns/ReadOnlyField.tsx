import { TextField } from '../Fields.tsx';
import { Icon } from '../Icon.tsx';

interface ReadOnlyFieldProps {
  readonly label: string;
  readonly value: string;
  /** Por qué no se edita: va como texto de apoyo, detrás del candado. */
  readonly reason: string;
  readonly className?: string;
}

/** Composición de M3 (D-021): campo de solo lectura con candado y su razón (patrón de P-07): se ve, pero no se edita. */
export function ReadOnlyField({ label, value, reason, className }: ReadOnlyFieldProps) {
  return (
    <TextField
      label={label}
      value={value}
      readOnly
      {...(className === undefined ? {} : { className })}
      help={
        <>
          <Icon name="lock" className="mr-1 inline size-4 align-text-bottom" />
          {reason}
        </>
      }
    />
  );
}
