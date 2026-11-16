import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

const DELAY_MS = 500;
const MARGIN_PX = 8;

interface TooltipProps {
  /** Texto breve; es lo mismo que el nombre accesible del control, para quien no pueda pasar el cursor. */
  readonly text: string;
  readonly children: ReactNode;
}

function withFocus(destination: EventTarget): boolean {
  if (!(destination instanceof Element)) return true;
  try {
    return destination.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * Tooltip simple de M3 (UX-SIL-001 §3.8, WCAG 1.4.13): aparece al pasar el cursor y con el foco del
 * teclado (`:focus-visible`), `Escape` lo cierra, se puede pasar el cursor sobre él sin que
 * desaparezca y no tapa el control. Solo acompaña a controles enfocables: nunca a una etiqueta de
 * estado. El texto no sustituye al nombre accesible, que el control ya tiene. Mientras el control
 * tiene abierto su panel (`aria-expanded="true"`), el globo no aparece: taparía el panel y se quedaría
 * con el `Escape` que debe cerrarlo (ADR-0110 P-UX-08).
 */
export function Tooltip({ text, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [offset, setOffset] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapper = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);

  function cancel(): void {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }

  function panelOpen(): boolean {
    return (wrapper.current?.querySelector('[aria-expanded="true"]') ?? null) !== null;
  }

  function showAfter(ms: number): void {
    cancel();
    timer.current = setTimeout(() => {
      if (!panelOpen()) setVisible(true);
    }, ms);
  }

  function hide(): void {
    cancel();
    setVisible(false);
  }

  useEffect(() => cancel, []);

  // Si el globo se saldría de la ventana (el avatar está en el borde), se desplaza lo justo.
  useLayoutEffect(() => {
    const element = bubble.current;
    if (!visible || element === null) return;
    const box = element.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    setOffset(Math.max(MARGIN_PX - box.left, 0) - Math.max(box.right - (width - MARGIN_PX), 0));
  }, [visible, text]);

  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>): void {
    if (event.key === 'Escape' && visible) {
      // Con el panel abierto, el `Escape` sigue hasta el panel para cerrarlo.
      if (!panelOpen()) event.stopPropagation();
      hide();
    }
  }

  return (
    // El envoltorio solo escucha eventos que ya burbujean desde el control enfocable que contiene.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <span
      ref={wrapper}
      className="relative inline-flex"
      onMouseEnter={() => showAfter(DELAY_MS)}
      onMouseLeave={hide}
      onPointerDown={hide}
      onFocus={(event) => {
        if (withFocus(event.target)) showAfter(0);
      }}
      onBlur={hide}
      onKeyDown={onKeyDown}
    >
      {children}
      {visible && (
        // El `pt-1` forma parte del globo: el cursor puede viajar del control al texto sin salir (1.4.13).
        <span role="tooltip" className="pointer-events-auto absolute top-full left-1/2 z-50 pt-1" style={{ translate: '-50% 0' }}>
          <span
            ref={bubble}
            style={{ translate: `${offset}px 0` }}
            className="block rounded-xs bg-inverse-surface px-2 py-1 text-body-small whitespace-nowrap text-inverse-on-surface"
          >
            {text}
          </span>
        </span>
      )}
    </span>
  );
}
