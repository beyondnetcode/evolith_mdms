import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Icon } from './Icon.tsx';
import { joinClasses } from './join-classes.ts';

interface FieldBase {
  readonly label: string;
  /** Texto de apoyo bajo el campo; no sustituye a la etiqueta (WCAG 3.3.2). */
  readonly help?: ReactNode;
  readonly error?: string | undefined;
  readonly fieldId?: string;
  /** El valor difiere del vigente (P-07): borde `primary` de 2 dp, con el «Cambió: antes …» en la ayuda. */
  readonly changed?: boolean;
}

const CONTAINER = 'relative flex flex-col gap-1';
/**
 * Etiqueta sobre el borde: ocupa como mucho el ancho del campo y se trunca en una sola línea, así nunca baja
 * sobre el valor escrito (el nombre accesible sigue siendo el texto completo).
 */
const LABEL =
  'pointer-events-none absolute inset-x-3 -top-2 z-10 flex text-body-small text-on-surface-variant peer-focus:text-primary peer-aria-invalid:text-error';
/** El fondo de la muesca lo fija el contenedor (`--field-background`, UI-09): no asoma como un parche de otro tono. */
const LABEL_TEXT = 'pointer-events-auto min-w-0 truncate bg-(--field-background) px-1';
const CONTROL =
  'peer h-14 w-full rounded-xs border border-outline bg-transparent px-4 text-body-large text-on-surface ' +
  'placeholder:text-on-surface-variant hover:border-on-surface focus:border-2 focus:border-primary focus:outline-none ' +
  'data-changed:border-2 data-changed:border-primary aria-invalid:border-error aria-invalid:focus:border-error disabled:border-on-surface/12 disabled:text-on-surface/38';

function SupportingText({ id, help, error }: { id: string; help?: ReactNode; error?: string | undefined }) {
  if (error !== undefined && error !== '') {
    return (
      <p id={id} className="flex items-start gap-1 px-4 text-body-small text-error">
        <Icon name="error" className="size-4" />
        <span>{error}</span>
      </p>
    );
  }
  return help === undefined ? null : (
    <p id={id} className="px-4 text-body-small text-on-surface-variant">
      {help}
    </p>
  );
}

interface TextFieldProps extends FieldBase, Omit<ComponentPropsWithoutRef<'input'>, 'id' | 'aria-invalid'> {
  /** Control al final del campo (p. ej. «Mostrar contraseña»): un botón de icono de 48 dp dentro del borde. */
  readonly finalAction?: ReactNode;
}

/**
 * Campo de texto delineado de M3 (56 dp). La etiqueta es siempre visible y persistente sobre el
 * borde. Con error se marca `aria-invalid` y el mensaje se asocia con `aria-describedby`.
 */
export function TextField({ label, help, error, required, fieldId, changed, finalAction, className, ...rest }: TextFieldProps) {
  const autoId = useId();
  const id = fieldId ?? autoId;
  const supportingTextId = `${id}-apoyo`;
  const hasSupportingText = (error !== undefined && error !== '') || help !== undefined;
  return (
    <div className={joinClasses(CONTAINER, className)}>
      <div className="relative">
        <input
          id={id}
          required={required}
          aria-required={required}
          aria-invalid={error !== undefined && error !== '' ? true : undefined}
          aria-describedby={hasSupportingText ? supportingTextId : undefined}
          data-changed={changed === true ? '' : undefined}
          className={joinClasses(CONTROL, finalAction !== undefined && 'pr-14')}
          {...rest}
        />
        <label htmlFor={id} className={LABEL}>
          <span className={LABEL_TEXT}>
            {label}
            {required === true && ' (obligatorio)'}
          </span>
        </label>
        {finalAction !== undefined && <div className="absolute top-1 right-1 z-20">{finalAction}</div>}
      </div>
      <SupportingText id={supportingTextId} help={help} error={error} />
    </div>
  );
}

export interface SelectOption {
  readonly id: string;
  readonly name: string;
}

interface SelectFieldProps extends FieldBase, Omit<ComponentPropsWithoutRef<'select'>, 'id' | 'aria-invalid' | 'children'> {
  readonly options: readonly SelectOption[];
  readonly emptyText?: string;
}

/** Menú desplegable de solo selección con la plataforma (`<select>`): teclado y lector de pantalla nativos. */
export function SelectField({
  label,
  help,
  error,
  required,
  fieldId,
  changed,
  options,
  emptyText = 'Seleccionar',
  className,
  ...rest
}: SelectFieldProps) {
  const autoId = useId();
  const id = fieldId ?? autoId;
  const supportingTextId = `${id}-apoyo`;
  const hasSupportingText = (error !== undefined && error !== '') || help !== undefined;
  return (
    <div className={joinClasses(CONTAINER, className)}>
      <div className="relative">
        <select
          id={id}
          required={required}
          aria-required={required}
          aria-invalid={error !== undefined && error !== '' ? true : undefined}
          aria-describedby={hasSupportingText ? supportingTextId : undefined}
          data-changed={changed === true ? '' : undefined}
          className={joinClasses(CONTROL, 'appearance-none pr-12')}
          {...rest}
        >
          <option value="">{emptyText}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <label htmlFor={id} className={LABEL}>
          <span className={LABEL_TEXT}>
            {label}
            {required === true && ' (obligatorio)'}
          </span>
        </label>
        <Icon name="expand_more" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-on-surface-variant" />
      </div>
      <SupportingText id={supportingTextId} help={help} error={error} />
    </div>
  );
}

interface TextAreaFieldProps extends FieldBase, Omit<ComponentPropsWithoutRef<'textarea'>, 'id' | 'aria-invalid'> {
  readonly max?: number;
  readonly currentValue?: string;
}

/** Texto multilínea con contador visible («120 / 500»). */
export function TextAreaField({ label, help, error, required, fieldId, changed, className, max, currentValue, ...rest }: TextAreaFieldProps) {
  const autoId = useId();
  const id = fieldId ?? autoId;
  const supportingTextId = `${id}-apoyo`;
  const hasSupportingText = (error !== undefined && error !== '') || help !== undefined;
  return (
    <div className={joinClasses(CONTAINER, className)}>
      <div className="relative">
        <textarea
          id={id}
          required={required}
          aria-invalid={error !== undefined && error !== '' ? true : undefined}
          aria-describedby={hasSupportingText ? supportingTextId : undefined}
          data-changed={changed === true ? '' : undefined}
          maxLength={max}
          className={joinClasses(CONTROL, 'min-h-28 py-4')}
          {...rest}
        />
        <label htmlFor={id} className={LABEL}>
          <span className={LABEL_TEXT}>{label}</span>
        </label>
      </div>
      <div className="flex justify-between gap-2">
        <div className="min-w-0 flex-1">
          <SupportingText id={supportingTextId} help={help} error={error} />
        </div>
        {max !== undefined && currentValue !== undefined && (
          <span className="px-4 text-body-small text-on-surface-variant">
            {currentValue.length} / {max}
          </span>
        )}
      </div>
    </div>
  );
}
