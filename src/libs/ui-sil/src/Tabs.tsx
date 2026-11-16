import { useId, useRef, type KeyboardEvent } from 'react';
import { joinClasses } from './join-classes.ts';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  /** Contador entre paréntesis en la etiqueta: «Por atender (12)». */
  readonly count?: number | string;
  /** Insignia numérica (observaciones abiertas). */
  readonly badge?: number;
}

interface TabsProps {
  readonly label: string;
  readonly items: readonly TabItem[];
  readonly value: string;
  readonly onChange: (id: string) => void;
  /** Identificadores estables para enlazar cada pestaña con su panel. */
  readonly baseId: string;
  readonly className?: string;
  /**
   * Pestañas fijas de M3: reparten el ancho por igual y la etiqueta puede ocupar dos líneas, para que
   * todas quepan sin desplazamiento oculto (en `compact`). Sin ella son desplazables.
   */
  readonly fixed?: boolean;
}

export function tabId(baseId: string, id: string): string {
  return `${baseId}-pestana-${id}`;
}

export function panelId(baseId: string): string {
  return `${baseId}-panel`;
}

/**
 * Pestañas primarias de M3 con el patrón de teclado del APG: flechas, Inicio y Fin mueven y
 * activan; solo la pestaña activa está en el orden de tabulación. Desplazables si no caben.
 */
export function Tabs({ label, items, value, onChange, baseId, className, fixed = false }: TabsProps) {
  const list = useRef<HTMLDivElement>(null);
  const labelId = useId();

  function targetIndex(key: string, current: number): number | null {
    switch (key) {
      case 'ArrowRight':
        return (current + 1) % items.length;
      case 'ArrowLeft':
        return (current - 1 + items.length) % items.length;
      case 'Home':
        return 0;
      case 'End':
        return items.length - 1;
      default:
        return null;
    }
  }

  function onPress(event: KeyboardEvent<HTMLButtonElement>): void {
    const index = targetIndex(
      event.key,
      items.findIndex((item) => item.id === value),
    );
    const destination = index === null ? undefined : items[index];
    if (destination === undefined) return;
    event.preventDefault();
    onChange(destination.id);
    list.current?.querySelector<HTMLElement>(`[id="${tabId(baseId, destination.id)}"]`)?.focus();
  }

  return (
    <div className={joinClasses('relative border-b border-outline-variant', className)}>
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <div
        ref={list}
        role="tablist"
        aria-labelledby={labelId}
        className="flex overflow-x-auto overscroll-x-contain no-scrollbar"
      >
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              id={tabId(baseId, item.id)}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={panelId(baseId)}
              tabIndex={active ? 0 : -1}
              onClick={() => {
                onChange(item.id);
              }}
              onKeyDown={onPress}
              className={joinClasses(
                'state-layer relative flex cursor-pointer items-center justify-center gap-2 text-title-small',
                fixed ? 'min-h-12 min-w-0 flex-1 px-2 py-2 text-center leading-tight' : 'h-12 min-w-24 shrink-0 px-4 whitespace-nowrap',
                active ? 'text-primary' : 'text-on-surface-variant',
              )}
            >
              {item.label}
              {item.count !== undefined && ` (${item.count})`}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-label-small text-on-error">
                  <span className="sr-only">, </span>
                  {item.badge}
                  <span className="sr-only"> abiertas</span>
                </span>
              )}
              {active && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.75 rounded-t-full bg-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
