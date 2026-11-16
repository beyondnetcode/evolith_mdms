import { useId } from 'react';
import type { SelectOption } from './Fields.tsx';
import { Icon } from './Icon.tsx';
import { joinClasses } from './join-classes.ts';
import { useDisclosure } from './use-disclosure.ts';

interface MultiMasterDataFieldProps {
  readonly label: string;
  readonly options: readonly SelectOption[];
  /** Ids elegidos (controlado). */
  readonly selection: readonly string[];
  readonly onValueChange: (selection: string[]) => void;
  /** Nombre con que viajan los ids en el formulario (un campo oculto por id). */
  readonly name?: string;
  readonly error?: string | undefined;
  readonly help?: string | undefined;
  readonly fieldId?: string;
  readonly loading?: boolean;
  readonly className?: string;
}

function summaryOf(names: readonly string[], loading: boolean): string {
  if (loading) return 'Cargando opciones…';
  return names.length === 0 ? 'Sin selección' : names.join(', ');
}

/**
 * Menú desplegable de selección múltiple de un catálogo de MDM (US-SIL-001, «Otros recursos»: se marcan uno
 * o varios, sin cantidad). El campo delineado de 56 dp abre un panel de casillas nativas, como el del chip
 * de filtro: `Escape` lo cierra y devuelve el foco al campo; un clic fuera también. Solo se elige de la
 * lista: SIL no crea maestros.
 */
export function MultiMasterDataField({ label, options, selection, onValueChange, name, error, help, fieldId, loading = false, className }: MultiMasterDataFieldProps) {
  const autoId = useId();
  const id = fieldId ?? autoId;
  const labelId = `${id}-etiqueta`;
  const valueId = `${id}-valor`;
  const supportingTextId = `${id}-apoyo`;
  const { open, toggle, pinContainer, pinButton, panelId, onKeyDown } = useDisclosure();
  const hasError = error !== undefined && error !== '';
  const names = options.filter((o) => selection.includes(o.id)).map((o) => o.name);
  const summary = summaryOf(names, loading);

  return (
    <div className={joinClasses('relative flex min-w-0 flex-col gap-1', className)}>
      <div ref={pinContainer} role="presentation" className="relative" onKeyDown={onKeyDown}>
        {name !== undefined && selection.map((value) => <input key={value} type="hidden" name={name} value={value} />)}
        <button
          ref={pinButton}
          id={id}
          type="button"
          aria-labelledby={`${labelId} ${valueId}`}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-describedby={hasError || help !== undefined ? supportingTextId : undefined}
          aria-busy={loading}
          onClick={() => !loading && toggle()}
          className={joinClasses(
            'flex h-14 w-full cursor-pointer items-center rounded-xs border bg-transparent pr-12 pl-4 text-left text-body-large',
            'focus-visible:border-2 focus-visible:border-primary',
            hasError ? 'border-error' : 'border-outline',
          )}
        >
          <span id={valueId} className={joinClasses('truncate', names.length === 0 ? 'text-on-surface-variant' : 'text-on-surface')}>
            {summary}
          </span>
        </button>
        <span id={labelId} className={joinClasses('pointer-events-none absolute inset-x-3 -top-2 z-10 flex text-body-small', hasError ? 'text-error' : 'text-on-surface-variant')}>
          <span className="min-w-0 truncate bg-(--field-background) px-1">{label}</span>
        </span>
        <Icon
          name="expand_more"
          className={joinClasses('pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-on-surface-variant transition-transform', open && 'rotate-180')}
        />
        {open && (
          <fieldset id={panelId} className="absolute top-full left-0 z-30 mt-1 flex max-h-72 w-full flex-col overflow-y-auto rounded-xs bg-surface-container py-2 shadow-level-2">
            <legend className="sr-only">{label}</legend>
            {options.map((option) => {
              const checked = selection.includes(option.id);
              return (
                <label key={option.id} className="state-layer flex min-h-12 cursor-pointer items-center gap-3 px-4 text-body-large text-on-surface">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onValueChange(checked ? selection.filter((v) => v !== option.id) : [...selection, option.id])}
                    className="size-4.5 shrink-0 accent-primary"
                  />
                  {option.name}
                </label>
              );
            })}
          </fieldset>
        )}
      </div>
      <SupportingText id={supportingTextId} error={error} help={help} />
    </div>
  );
}

function SupportingText({ id, error, help }: { readonly id: string; readonly error: string | undefined; readonly help: string | undefined }) {
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
