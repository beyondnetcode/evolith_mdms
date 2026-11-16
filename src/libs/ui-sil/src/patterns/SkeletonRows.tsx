import { Skeleton } from '../Loading.tsx';

/** Marcadores de carga de una lista o tabla: reservan el alto de las filas para que nada salte (CLS). */
export function SkeletonRows({ count = 8, rowClassName = 'h-row-two-lines w-full' }: { readonly count?: number; readonly rowClassName?: string }) {
  return (
    <div className="flex flex-col gap-1" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className={rowClassName} />
      ))}
    </div>
  );
}
