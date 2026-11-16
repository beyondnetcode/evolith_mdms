import type { ReactNode } from 'react';
import { joinClasses } from '../join-classes.ts';

interface SectionCardProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Tarjeta delineada de M3 (outlined card) como región con nombre: su título la nombra para navegar por
 * regiones con el lector de pantalla. La usan la ficha del expediente y las pantallas de consulta.
 */
export function SectionCard({ title, children, className }: SectionCardProps) {
  return (
    <section aria-label={title} className={joinClasses('flex flex-col gap-2 rounded-md border border-outline-variant p-4', className)}>
      <h2 className="text-title-medium">{title}</h2>
      {children}
    </section>
  );
}
