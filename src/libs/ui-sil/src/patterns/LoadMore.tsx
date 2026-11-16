import { Button } from '../Button.tsx';

interface LoadMoreProps {
  readonly shown: number;
  readonly total: number;
  readonly hasMore: boolean;
  readonly loading: boolean;
  /** Se llegó a la profundidad máxima y quedan resultados sin mostrar. */
  readonly atLimit: boolean;
  /** Qué hacer para ver más allá del tope («usa la búsqueda o el filtro de sede»). */
  readonly limitText: string;
  readonly onLoadMore: () => void;
}

/** `compact`: «Mostrando X de Y» y el botón delineado «Cargar más» al final de la lista (composición de M3, D-021). */
export function LoadMore({ shown, total, hasMore, loading, atLimit, limitText, onLoadMore }: LoadMoreProps) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-body-small text-on-surface-variant tabular-nums" aria-live="polite">
        Mostrando {shown} de {total}
      </p>
      {hasMore && (
        <Button variant="outlined" aria-disabled={loading} onClick={() => !loading && onLoadMore()}>
          {loading ? 'Cargando…' : 'Cargar más'}
        </Button>
      )}
      {atLimit && <p className="text-body-small text-on-surface-variant">{limitText}</p>}
    </div>
  );
}
