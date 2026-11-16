/* eslint-disable complexity, jsx-a11y/no-noninteractive-element-to-interactive-role -- patrón combobox del APG: la lista es un ul con role listbox y options; no hay elemento nativo equivalente con filtrado */
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from './Icon.tsx';
import { joinClasses } from './join-classes.ts';
import type { SelectOption } from './Fields.tsx';

interface MasterDataFieldProps {
  readonly label: string;
  readonly options: readonly SelectOption[];
  /** Nombre del campo en el formulario: el valor que viaja es el id de la opción. */
  readonly name?: string;
  /** Controlado: el id elegido. */
  readonly value?: string;
  /** No controlado: el id con que empieza. */
  readonly defaultValue?: string;
  readonly onValueChange?: (id: string) => void;
  readonly required?: boolean;
  readonly error?: string | undefined;
  readonly help?: string | undefined;
  readonly fieldId?: string;
  /** Mientras llegan las opciones: «Cargando opciones…» dentro del campo. */
  readonly loading?: boolean;
  /** El valor difiere del vigente (P-07): borde `primary` de 2 dp. */
  readonly changed?: boolean;
  /** El campo no aplica: se ve atenuado, no se abre ni se edita (el valor que viaja es el de `value`). */
  readonly disabled?: boolean;
  /** Maestro del que salen las opciones: «clientes». Sirve para el aviso de un valor no proyectado. */
  readonly masterData?: string;
  readonly className?: string;
}

const NO_SELECTION = 'Sin selección';

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Menú desplegable con filtrado, de solo selección (UX-SIL-001 §3.6): campo de texto delineado de
 * 56 dp con la lista de un maestro. Escribir filtra; solo se puede elegir una opción de la lista: SIL
 * no crea maestros, así que no hay «Agregar nuevo» (R-08). Patrón combobox del APG (ARIA 1.2): flechas,
 * Inicio y Fin, `Enter` elige, `Escape` cierra. Un campo opcional ofrece «Sin selección».
 */
export function MasterDataField({
  label,
  options,
  name,
  value,
  defaultValue = '',
  onValueChange,
  required = false,
  error,
  help,
  fieldId,
  loading = false,
  changed = false,
  disabled = false,
  masterData,
  className,
}: MasterDataFieldProps) {
  const autoId = useId();
  const id = fieldId ?? autoId;
  const listId = `${id}-lista`;
  const supportingTextId = `${id}-apoyo`;
  const [internal, setInternal] = useState(defaultValue);
  const chosen = value ?? internal;
  const chosenName = options.find((o) => o.id === chosen)?.name ?? '';
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const entry = useRef<HTMLInputElement>(null);

  const text = typed ?? chosenName;
  const filtered = useMemo(() => {
    const searched = normalize(typed ?? '');
    return options.filter((o) => searched === '' || normalize(o.name).includes(searched));
  }, [options, typed]);
  const rows: readonly SelectOption[] = required || (typed ?? '') !== '' ? filtered : [{ id: '', name: NO_SELECTION }, ...filtered];
  const notProjected = chosen !== '' && chosenName === '' && options.length > 0 && !loading;
  const errorMessage =
    error !== undefined && error !== ''
      ? error
      : notProjected
        ? `No encontramos ${chosen} en el maestro de ${masterData ?? 'este campo'}. Sin él no se puede registrar la solicitud.`
        : undefined;

  function choose(option: SelectOption): void {
    setInternal(option.id);
    onValueChange?.(option.id);
    setTyped(null);
    setOpen(false);
  }

  function openPanel(): void {
    if (loading || disabled) return;
    setOpen(true);
    const position = rows.findIndex((f) => f.id === chosen);
    setActive(Math.max(position, 0));
  }

  function closeAndRestoreFocus(): void {
    setOpen(false);
    setTyped(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    const last = rows.length - 1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) openPanel();
        else setActive((a) => Math.min(a + 1, last));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) openPanel();
        else setActive((a) => Math.max(a - 1, 0));
        break;
      case 'Home':
        if (open) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case 'End':
        if (open) {
          event.preventDefault();
          setActive(last);
        }
        break;
      case 'Enter':
        if (open) {
          event.preventDefault();
          const option = rows[active];
          if (option !== undefined) choose(option);
        }
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          closeAndRestoreFocus();
        }
        break;
    }
  }

  return (
    <div className={joinClasses('relative flex min-w-0 flex-col gap-1', className)}>
      <div className="relative">
        {name !== undefined && <input type="hidden" name={name} value={chosen} />}
        <input
          ref={entry}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open && rows[active] !== undefined ? `${id}-opcion-${active}` : undefined}
          aria-required={required}
          aria-invalid={errorMessage === undefined ? undefined : true}
          aria-describedby={errorMessage !== undefined || help !== undefined ? supportingTextId : undefined}
          aria-busy={loading}
          disabled={disabled}
          data-changed={changed ? '' : undefined}
          value={loading ? '' : text}
          placeholder={loading ? 'Cargando opciones…' : undefined}
          onChange={(event) => {
            setTyped(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onClick={openPanel}
          onFocus={(event) => event.target.select()}
          onBlur={() => closeAndRestoreFocus()}
          onKeyDown={onKeyDown}
          className={
            'peer h-14 w-full rounded-xs border border-outline bg-transparent pr-12 pl-4 text-body-large text-on-surface placeholder:text-on-surface-variant ' +
            'focus:border-2 focus:border-primary focus:outline-none data-changed:border-2 data-changed:border-primary ' +
            'aria-invalid:border-error aria-invalid:focus:border-error disabled:border-on-surface/12 disabled:text-on-surface/38'
          }
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute inset-x-3 -top-2 z-10 flex text-body-small text-on-surface-variant peer-focus:text-primary peer-disabled:text-on-surface/38 peer-aria-invalid:text-error"
        >
          <span className="pointer-events-auto min-w-0 truncate bg-(--field-background) px-1">
            {label}
            {required && ' (obligatorio)'}
          </span>
        </label>
        <Icon
          name="expand_more"
          className={joinClasses(
            'pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 transition-transform',
            disabled ? 'text-on-surface/38' : 'text-on-surface-variant',
            open && 'rotate-180',
          )}
        />
        {open && (
          // `mousedown` evita que el campo pierda el foco (y restaure el texto) antes de elegir.
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className="absolute top-full left-0 z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xs bg-surface-container py-2 shadow-level-2"
          >
            {rows.length === 0 && <li className="px-4 py-3 text-body-medium text-on-surface-variant">No hay coincidencias.</li>}
            {rows.map((option, index) => (
              // Las opciones se manejan desde el campo (`aria-activedescendant`); el ratón solo las elige.
              <li
                key={option.id === '' ? 'vacia' : option.id}
                id={`${id}-opcion-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={option.id === chosen}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(index)}
                className={joinClasses(
                  'flex min-h-12 cursor-pointer items-center gap-3 px-4 text-body-large text-on-surface',
                  index === active && 'bg-on-surface/8',
                  option.id === '' && 'text-on-surface-variant',
                )}
              >
                <span className="flex size-5 shrink-0 items-center justify-center">{option.id === chosen && option.id !== '' && <Icon name="check" className="size-5" />}</span>
                {option.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      {errorMessage !== undefined ? (
        <p id={supportingTextId} className="flex items-start gap-1 px-4 text-body-small text-error">
          <Icon name="error" className="size-4" />
          <span>{errorMessage}</span>
        </p>
      ) : (
        help !== undefined && (
          <p id={supportingTextId} className="px-4 text-body-small text-on-surface-variant">
            {help}
          </p>
        )
      )}
    </div>
  );
}
