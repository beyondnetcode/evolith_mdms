import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface CardListProps<Row> {
  /** Nombre accesible de la lista. */
  readonly label: string;
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row) => string;
  readonly rowHref: (row: Row) => string;
  readonly rowState?: unknown;
  /** Titular del elemento: es el enlace, y todo el elemento es su objetivo táctil. */
  readonly title: (row: Row) => string;
  /** Dato breve a la derecha del titular (p. ej. la fecha de creación). */
  readonly meta?: (row: Row) => ReactNode;
  /** Líneas de apoyo y etiquetas debajo del titular. */
  readonly body: (row: Row) => ReactNode;
}

/**
 * Lista de `compact` de una bandeja (composición de M3, D-021): la versión de la tabla de datos para
 * pantallas angostas. Un elemento por fila, con el identificador como titular enlazado, un dato breve al
 * final y las demás columnas como apoyo. Todo el elemento es el objetivo táctil.
 */
export function CardList<Row>({ label, rows, rowKey, rowHref, rowState, title, meta, body }: CardListProps<Row>) {
  return (
    <ul aria-label={label} className="overflow-hidden rounded-md border border-outline-variant">
      {rows.map((row) => (
        <li
          key={rowKey(row)}
          className="relative flex flex-col gap-2 border-t border-outline-variant px-4 py-3 first:border-t-0 row-state"
        >
          <div className="flex items-baseline justify-between gap-2">
            <Link to={rowHref(row)} state={rowState} className="text-body-large-emphasized text-primary tabular-nums after:absolute after:inset-0">
              {title(row)}
            </Link>
            {meta !== undefined && <span className="text-label-small text-on-surface-variant tabular-nums">{meta(row)}</span>}
          </div>
          {body(row)}
        </li>
      ))}
    </ul>
  );
}
