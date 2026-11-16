import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * ¿Se desplazó el contenido? (UI-04, UI-SIL-001 §4.1): un centinela de 1 px al inicio del documento y un
 * `IntersectionObserver`, sin escuchar `scroll` (no corre en cada fotograma). `sentinel` es la ref de callback del
 * elemento; `scrolled` es verdadero en cuanto el centinela sale de la ventana, es decir, con más de 1 px de
 * desplazamiento. Sin `IntersectionObserver` (pruebas) nunca hay desplazamiento.
 */
export function useScrolled(): { readonly scrolled: boolean; readonly sentinel: (node: HTMLElement | null) => void } {
  const [scrolled, setScrolled] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  const sentinel = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (node === null || typeof IntersectionObserver === 'undefined') return;
    observer.current = new IntersectionObserver(([entry]) => setScrolled(entry !== undefined && !entry.isIntersecting));
    observer.current.observe(node);
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  return { scrolled, sentinel };
}
