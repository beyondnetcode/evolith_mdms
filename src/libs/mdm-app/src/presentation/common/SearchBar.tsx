import { Icon, IconButton } from '@sil/ui';
import { useId, useState } from 'react';

interface Props {
  /** Nombre accesible del campo y texto de la barra. */
  readonly label: string;
  /** Texto vigente (el de la URL). */
  readonly value: string;
  readonly onSearch: (text: string) => void;
  readonly maxLength?: number;
}

/**
 * Search bar de M3 (56 dp, forma `full`, `surface-container-high`; UI-MDM-001 §3.2). Busca al enviar (Intro),
 * no con cada tecla. `SearchBar` de SIL no se puede importar (frontera D-026) ni sirve tal cual: aquí no hay
 * search view con sugerencias. Propuesto para `ui-sil` (G-580).
 */
export function SearchBar({ label, value, onSearch, maxLength = 200 }: Props) {
  const id = useId();
  const [typed, setTyped] = useState(value);
  const [previous, setPrevious] = useState(value);
  // Si la URL cambia desde fuera (p. ej. «Limpiar filtros»), el campo la sigue.
  if (value !== previous) {
    setPrevious(value);
    setTyped(value);
  }
  return (
    <form
      role="search"
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(typed.trim());
      }}
      className="flex h-14 items-center gap-1 rounded-full bg-surface-container-high pr-2 pl-4 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-secondary"
    >
      <Icon name="search" className="text-on-surface-variant" />
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={typed}
        maxLength={maxLength}
        autoComplete="off"
        placeholder={label}
        onChange={(event) => setTyped(event.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-body-large text-on-surface placeholder:text-on-surface-variant focus:outline-none"
      />
      {typed !== '' && (
        <IconButton
          aria-label="Borrar búsqueda"
          onClick={() => {
            setTyped('');
            onSearch('');
          }}
        >
          <Icon name="close" />
        </IconButton>
      )}
    </form>
  );
}
