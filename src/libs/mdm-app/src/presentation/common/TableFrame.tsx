import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { SECTION_TABLE } from './table-styles.ts';

/**
 * Marco de una tabla de sección con desplazamiento horizontal. Si la tabla no cabe (siete columnas en `medium`), el
 * marco entra en el orden de tabulación como región con nombre para poder desplazarlo con el teclado (WCAG 2.1.1;
 * regla `scrollable-region-focusable` de axe). Si cabe, no añade una parada de foco inútil.
 */
export function TableFrame({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useLayoutEffect(() => {
    const element = frame.current;
    if (element === null) return;
    const measure = (): void => setScrollable(element.scrollWidth > element.clientWidth);
    measure();
    // jsdom no tiene `ResizeObserver`: allí no hay maquetación y la tabla nunca desborda.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frame}
      role={scrollable ? 'region' : undefined}
      aria-label={scrollable ? label : undefined}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- región desplazable: debe poder recibir el foco para desplazarla con el teclado (WCAG 2.1.1)
      tabIndex={scrollable ? 0 : undefined}
      className={SECTION_TABLE.frame}
    >
      {children}
    </div>
  );
}
