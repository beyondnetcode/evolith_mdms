import { Icon } from './Icon.tsx';
import { joinClasses } from './join-classes.ts';
import { useDisclosure } from './use-disclosure.ts';

export interface FilterOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface FilterChipProps<T extends string> {
  readonly label: string;
  readonly options: ReadonlyArray<FilterOption<T>>;
  readonly selection: readonly T[];
  readonly onChange: (selection: T[]) => void;
  /** Valor del chip sin selección: «Contenedor: Todos». Sin él, el chip solo muestra su etiqueta. */
  readonly noSelectionText?: string;
  /**
   * Alto visible del chip: 48 dp (el de las barras actuales) o 32 dp, el contenedor de M3. Con 32 el objetivo
   * táctil sigue siendo de 48 dp por `target-48` (ADR-0110 §2.3).
   */
  readonly containerHeight?: 32 | 48;
}

/** Clase del alto visible de un chip de filtro: 48 dp o el contenedor M3 de 32 dp. */
export function chipHeightClass(containerHeight: 32 | 48): string {
  return containerHeight === 32 ? 'h-8' : 'h-12';
}

/**
 * Filter chip con menú de selección múltiple (forma `small`). El menú es un grupo de
 * casillas nativas: `Escape` lo cierra y devuelve el foco al chip; un clic fuera también lo cierra.
 */
export function FilterChip<T extends string>({ label, options, selection, onChange, noSelectionText, containerHeight = 48 }: FilterChipProps<T>) {
  const { open, toggle, pinContainer, pinButton, panelId, onKeyDown } = useDisclosure();
  const applied = selection.length > 0;
  const summary =
    selection.length === 1 ? (options.find((o) => o.value === selection[0])?.label ?? '') : `${selection.length} seleccionados`;

  return (
    <div ref={pinContainer} role="presentation" className="relative" onKeyDown={onKeyDown}>
      <button
        ref={pinButton}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        className={joinClasses(
          'state-layer target-48 inline-flex cursor-pointer items-center gap-2 rounded-sm pr-2 text-label-large whitespace-nowrap',
          chipHeightClass(containerHeight),
          applied
            ? 'bg-secondary-container pl-2 text-on-secondary-container'
            : 'border border-outline pl-4 text-on-surface-variant',
        )}
      >
        {applied && <Icon name="check" className="size-4.5" />}
        {applied ? `${label}: ${summary}` : noSelectionText === undefined ? label : `${label}: ${noSelectionText}`}
        <Icon name="expand_more" className="size-4.5" />
      </button>
      {open && (
        <fieldset
          id={panelId}
          className="absolute top-full left-0 z-20 mt-1 flex max-h-96 w-max min-w-56 flex-col overflow-y-auto rounded-xs bg-surface-container py-2 shadow-level-2"
        >
          <legend className="sr-only">{label}</legend>
          {options.map((option) => {
            const checked = selection.includes(option.value);
            return (
              <label
                key={option.value}
                className="state-layer flex h-12 shrink-0 cursor-pointer items-center gap-3 px-4 text-body-large text-on-surface"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange(checked ? selection.filter((v) => v !== option.value) : [...selection, option.value])
                  }
                  className="size-4.5 shrink-0 accent-primary"
                />
                {option.label}
              </label>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}
