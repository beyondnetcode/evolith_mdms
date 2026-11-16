import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface Disclosure {
  readonly open: boolean;
  readonly toggle: () => void;
  readonly close: () => void;
  /** Ref de callback del contenedor que agrupa el botón y el panel. */
  readonly pinContainer: (node: HTMLDivElement | null) => void;
  /** Ref de callback del botón que abre el panel (recibe el foco al cerrar). */
  readonly pinButton: (node: HTMLButtonElement | null) => void;
  readonly panelId: string;
  /** Para el contenedor: `Escape` cierra y devuelve el foco al botón; `Tab` no sale del panel. */
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

const TABBABLE = 'a[href], button, input, select, textarea, summary, [tabindex]';

/** Elementos del contenedor a los que `Tab` puede llegar: visibles, habilitados y con `tabindex` no negativo. */
function tabbables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.closest('[inert], [hidden]') === null,
  );
}

/** `Tab` y `Mayús+Tab` dan la vuelta dentro del contenedor en vez de salir de él. */
function trapTab(event: KeyboardEvent<HTMLElement>, container: HTMLElement): void {
  const stops = tabbables(container);
  const first = stops[0];
  const last = stops.at(-1);
  if (first === undefined || last === undefined) return;
  const active = document.activeElement;
  const outside = !container.contains(active);
  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Vuelve inerte todo lo que hay fuera de `node`: sus hermanos y los de cada uno de sus ancestros.
 * Devuelve la función que deshace exactamente lo que hizo, sin tocar lo que ya era inerte.
 */
function makeRestInert(node: HTMLElement): () => void {
  const changed: HTMLElement[] = [];
  for (let current: HTMLElement | null = node; current !== null && current !== document.body; current = current.parentElement) {
    for (const sibling of current.parentElement?.children ?? []) {
      if (sibling === current || !(sibling instanceof HTMLElement) || sibling.hasAttribute('inert')) continue;
      if (['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) continue;
      sibling.setAttribute('inert', '');
      changed.push(sibling);
    }
  }
  return () => {
    for (const element of changed) element.removeAttribute('inert');
  };
}

/**
 * Comportamiento común de los paneles que se abren desde un botón (menús, filtros), conforme a
 * ADR-0110 P-UX-08: mientras está abierto el foco no sale de él (`Tab` y `Mayús+Tab` dan la vuelta)
 * y el resto de la página es inerte; `Escape` lo cierra; al cerrarse el foco vuelve al botón que lo
 * abrió, salvo que se cierre con un clic fuera (el foco va entonces a lo que se pulsó). Los nodos se
 * guardan con refs de callback para no exponer `.current` al render.
 */
export function useDisclosure(): Disclosure {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const node = container.current;
    const undo = node === null ? undefined : makeRestInert(node);
    const onPressOutside = (event: PointerEvent): void => {
      const destination = event.target;
      if (container.current !== null && destination instanceof Node && !container.current.contains(destination)) {
        restoreFocus.current = false;
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPressOutside);
    return () => {
      document.removeEventListener('pointerdown', onPressOutside);
      undo?.();
      // El panel se desmonta con el cierre: si el foco estaba dentro, se perdió; vuelve al botón.
      if (restoreFocus.current) button.current?.focus();
      restoreFocus.current = false;
    };
  }, [open]);

  const toggle = useCallback(() => {
    restoreFocus.current = true;
    setOpen((previous) => !previous);
  }, []);
  const close = useCallback(() => {
    restoreFocus.current = true;
    setOpen(false);
  }, []);
  const pinContainer = useCallback((node: HTMLDivElement | null) => {
    container.current = node;
  }, []);
  const pinButton = useCallback((node: HTMLButtonElement | null) => {
    button.current = node;
  }, []);
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!open) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        restoreFocus.current = true;
        setOpen(false);
        return;
      }
      // Un hijo que ya resolvió el `Tab` (p. ej. el menú, que se mueve entre sus elementos) lo marca.
      if (event.key === 'Tab' && !event.defaultPrevented && container.current !== null) trapTab(event, container.current);
    },
    [open],
  );

  return { open, toggle, close, pinContainer, pinButton, panelId, onKeyDown };
}
