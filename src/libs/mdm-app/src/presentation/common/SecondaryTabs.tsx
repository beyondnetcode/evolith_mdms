import { joinClasses } from '@sil/ui';
import { useId, useRef, type KeyboardEvent } from 'react';

export interface SecondaryTab<T extends string> {
  readonly id: T;
  readonly label: string;
}

interface Props<T extends string> {
  readonly label: string;
  readonly items: ReadonlyArray<SecondaryTab<T>>;
  readonly value: T;
  readonly onChange: (id: T) => void;
  /** `id` del panel que filtran (`role="tabpanel"`). */
  readonly panelId: string;
  /** Prefijo estable de los `id` de las pestañas (el panel se nombra con la activa). */
  readonly baseId: string;
}

export function secondaryTabId(baseId: string, id: string): string {
  return `${baseId}-filtro-${id}`;
}

/**
 * Pestañas secundarias de M3 (filtro segmentado de Establecimientos, UX-MDM-001 §5.4; UI-MDM-001 §3.3): etiqueta
 * `title-small`, indicador de 2 dp a todo el ancho, sin icono. `Tabs` de `ui-sil` solo pinta las primarias (G-586):
 * composición local hasta que se promueva. Mismo patrón de teclado del APG que `Tabs`: flechas, Inicio y Fin mueven y
 * activan; solo la activa está en el orden de tabulación.
 */
export function SecondaryTabs<T extends string>({ label, items, value, onChange, panelId, baseId }: Props<T>) {
  const list = useRef<HTMLDivElement>(null);
  const labelId = useId();

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const current = items.findIndex((item) => item.id === value);
    const moves: Readonly<Record<string, number>> = {
      ArrowRight: (current + 1) % items.length,
      ArrowLeft: (current - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    const index = moves[event.key];
    const destination = index === undefined ? undefined : items[index];
    if (destination === undefined) return;
    event.preventDefault();
    onChange(destination.id);
    list.current?.querySelector<HTMLElement>(`[id="${secondaryTabId(baseId, destination.id)}"]`)?.focus();
  }

  return (
    <div className="border-b border-outline-variant">
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <div ref={list} role="tablist" aria-labelledby={labelId} className="flex overflow-x-auto overscroll-x-contain no-scrollbar">
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              id={secondaryTabId(baseId, item.id)}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={onKeyDown}
              className={joinClasses(
                'state-layer relative flex h-12 min-w-20 shrink-0 cursor-pointer items-center justify-center px-4 text-title-small whitespace-nowrap',
                active ? 'text-on-surface' : 'text-on-surface-variant',
              )}
            >
              {item.label}
              {active && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
