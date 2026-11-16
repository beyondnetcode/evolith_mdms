/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role -- patrón combobox del APG: la lista es un ul con role listbox y options; no hay elemento nativo equivalente con búsqueda en el servidor */
import { Icon, joinClasses } from '@sil/ui';
import { useId, useState, type KeyboardEvent } from 'react';

export interface ComboboxOption {
  readonly id: string;
  /** Texto de la opción y, al elegirla, del campo. */
  readonly label: string;
}

/** Resultados de la búsqueda, como unión discriminada. */
export type ComboboxResults =
  /** Sin buscar todavía (menos caracteres de los necesarios, o ya hay una elegida). */
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly options: readonly ComboboxOption[] };

interface Props {
  readonly label: string;
  readonly fieldId: string;
  readonly required?: boolean;
  readonly help?: string;
  readonly error?: string | undefined;
  /** Texto escrito (controlado). */
  readonly text: string;
  readonly onTextChange: (text: string) => void;
  readonly results: ComboboxResults;
  readonly onSelect: (option: ComboboxOption) => void;
  readonly onRetry: () => void;
  /** Sin coincidencias (UX-MDM-001 §6.4). */
  readonly emptyText: string;
  /** «{n} resultados»: se anuncia al llegar. */
  readonly countText: (count: number) => string;
  readonly readOnly?: boolean;
}

const RETRY_ID = 'reintentar';

type Row = { readonly kind: 'option'; readonly option: ComboboxOption } | { readonly kind: 'retry' };

function rowsOf(results: ComboboxResults): readonly Row[] {
  if (results.kind === 'error') return [{ kind: 'retry' }];
  if (results.kind !== 'ready') return [];
  return results.options.map((option) => ({ kind: 'option', option }));
}

/** Lo que se anuncia (y se ve) cuando no hay opciones que elegir. */
function messageOf(results: ComboboxResults, emptyText: string): string | null {
  if (results.kind === 'loading') return 'Buscando…';
  if (results.kind === 'ready' && results.options.length === 0) return emptyText;
  return null;
}

function announcementOf(results: ComboboxResults, props: Pick<Props, 'emptyText' | 'countText'>): string {
  switch (results.kind) {
    case 'idle':
      return '';
    case 'loading':
      return 'Buscando…';
    case 'error':
      return 'No pudimos buscar.';
    case 'ready':
      return results.options.length === 0 ? props.emptyText : props.countText(results.options.length);
  }
}

interface ListProps {
  readonly id: string;
  readonly label: string;
  /** Vacía: la lista existe (el campo la controla) pero está oculta. */
  readonly rows: readonly Row[];
  readonly active: Row | undefined;
  readonly optionId: (row: Row) => string;
  readonly onChoose: (row: Row) => void;
}

function OptionList({ id, label, rows, active, optionId, onChoose }: ListProps) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label={label}
      hidden={rows.length === 0}
      className="absolute top-full left-0 z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xs bg-surface-container py-2 shadow-level-2"
    >
      {rows.map((row) => (
        // Las opciones se manejan desde el campo (`aria-activedescendant`); el ratón solo las elige.
        <li
          key={optionId(row)}
          id={optionId(row)}
          role="option"
          tabIndex={-1}
          aria-selected={row === active}
          onMouseDown={(event) => {
            event.preventDefault();
            onChoose(row);
          }}
          className={joinClasses(
            'flex min-h-12 cursor-pointer items-center px-4 py-2 text-body-large text-on-surface',
            row === active && 'bg-on-surface/8',
            row.kind === 'retry' && 'text-error',
          )}
        >
          {row.kind === 'retry' ? 'No pudimos buscar. Reintentar' : row.option.label}
        </li>
      ))}
    </ul>
  );
}

/** Texto de apoyo o error del campo, enlazado con `aria-describedby`. */
function Supporting({ id, help, error }: { readonly id: string; readonly help: string | undefined; readonly error: string | undefined }) {
  if (error !== undefined) {
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

/**
 * Combobox con búsqueda en el servidor (UI-MDM-001 §4.1 y §5.3, propuesta `AsyncComboboxField`): patrón combobox del
 * APG con lista emergente (ARIA 1.2, `aria-autocomplete="list"`). Escribir busca; flechas arriba y abajo recorren las
 * opciones (`aria-activedescendant`, el foco no sale del campo); `Enter` elige; `Escape` cierra la lista y, si ya
 * estaba cerrada, borra lo escrito, sin cerrar el diálogo que lo contiene. «Buscando…», el número de resultados y
 * el vacío se anuncian en una región `status`. El error es una opción «No pudimos buscar. Reintentar».
 * `MasterDataField` de `ui-sil` filtra en local una lista dada (G-586): composición local hasta que se promueva.
 */
export function AsyncCombobox({
  label,
  fieldId,
  required,
  help,
  error,
  text,
  onTextChange,
  results,
  onSelect,
  onRetry,
  emptyText,
  countText,
  readOnly,
}: Props) {
  const listId = `${fieldId}-lista`;
  const supportingId = `${fieldId}-apoyo`;
  const statusId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rows = rowsOf(results);
  const showList = open && rows.length > 0;
  const message = open ? messageOf(results, emptyText) : null;
  const activeRow = showList ? rows[Math.min(active, rows.length - 1)] : undefined;
  const optionId = (row: Row): string => `${fieldId}-opcion-${row.kind === 'retry' ? RETRY_ID : row.option.id}`;
  const hasError = error !== undefined && error !== '';

  function choose(row: Row): void {
    if (row.kind === 'retry') {
      onRetry();
      return;
    }
    onSelect(row.option);
    setOpen(false);
  }

  function move(step: 1 | -1): void {
    if (!open) {
      setOpen(true);
      setActive(0);
      return;
    }
    setActive((current) => Math.max(0, Math.min(rows.length - 1, current + step)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        move(event.key === 'ArrowDown' ? 1 : -1);
        return;
      case 'Enter':
        if (activeRow === undefined) return;
        event.preventDefault();
        choose(activeRow);
        return;
      case 'Escape':
        // Cerrar la lista o borrar lo escrito no es cerrar el diálogo: el evento no sigue (WCAG 2.1.2).
        if (!open && text === '') return;
        event.preventDefault();
        event.stopPropagation();
        if (open) setOpen(false);
        else onTextChange('');
    }
  }

  return (
    <div className="relative flex min-w-0 flex-col gap-1">
      <div className="relative">
        <input
          id={fieldId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeRow === undefined ? undefined : optionId(activeRow)}
          aria-required={required}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError || help !== undefined ? supportingId : undefined}
          aria-busy={results.kind === 'loading'}
          readOnly={readOnly}
          value={text}
          onChange={(event) => {
            onTextChange(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onClick={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={
            'peer h-14 w-full rounded-xs border border-outline bg-transparent pr-12 pl-4 text-body-large text-on-surface ' +
            'focus:border-2 focus:border-primary focus:outline-none aria-invalid:border-error aria-invalid:focus:border-error'
          }
        />
        <label
          htmlFor={fieldId}
          className="absolute -top-2 left-3 z-10 bg-surface px-1 text-body-small text-on-surface-variant peer-aria-invalid:text-error peer-focus:text-primary"
        >
          {label}
          {required === true && ' (obligatorio)'}
        </label>
        <Icon name="search" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-on-surface-variant" />
        <OptionList id={listId} label={label} rows={showList ? rows : []} active={activeRow} optionId={optionId} onChoose={choose} />
        {message !== null && (
          <p aria-hidden="true" className="absolute top-full left-0 z-30 mt-1 w-full rounded-xs bg-surface-container px-4 py-3 text-body-medium text-on-surface-variant shadow-level-2">
            {message}
          </p>
        )}
      </div>
      <Supporting id={supportingId} help={help} error={hasError ? error : undefined} />
      <p id={statusId} role="status" className="sr-only">
        {open ? announcementOf(results, { emptyText, countText }) : ''}
      </p>
    </div>
  );
}
