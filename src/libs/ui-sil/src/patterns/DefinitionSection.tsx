import { Icon } from '../Icon.tsx';

export interface DefinitionItem {
  readonly label: string;
  readonly value: string;
}

interface DefinitionSectionProps {
  readonly title: string;
  readonly items: readonly DefinitionItem[];
  readonly open?: boolean;
}

/**
 * Sección plegable de pares etiqueta/valor (`<details>` con `<dl>`): teclado y lector de pantalla nativos. Quien
 * la usa formatea los valores (fechas, «Sin dato» para un vacío). Cada par va en una sola línea —etiqueta en
 * negrita, «:» y valor, ambos en `body-medium`—, y un valor largo envuelve sin desbordar.
 */
export function DefinitionSection({ title, items, open = false }: DefinitionSectionProps) {
  return (
    <details open={open} className="group border-t border-outline-variant first:border-t-0">
      <summary className="state-layer flex h-12 cursor-pointer list-none items-center justify-between gap-2 text-title-small">
        {title}
        <Icon name="expand_more" className="transition-transform group-open:rotate-180" />
      </summary>
      <dl className="grid gap-x-6 gap-y-2 pb-3 medium:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 text-body-medium break-words">
            <dt className="inline text-body-medium-emphasized">
              {item.label}
              <span aria-hidden="true">:</span>
            </dt>
            <dd className="ms-1 inline">{item.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
