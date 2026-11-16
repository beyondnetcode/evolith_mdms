import { Icon } from '@sil/ui';
import { Link } from 'react-router';

/** Enlace de vuelta a una pantalla anterior: conserva lo que se le pase en `to` (búsqueda, filtros, página). */
export function BackLink({ to, children }: { readonly to: string; readonly children: string }) {
  return (
    <Link to={to} className="state-layer -ml-2 inline-flex min-h-12 w-fit items-center gap-2 rounded-full px-2 text-label-large text-primary">
      <Icon name="arrow_back" className="size-4.5" />
      {children}
    </Link>
  );
}
