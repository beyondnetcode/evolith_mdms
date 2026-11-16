import { useEffect, useRef } from 'react';
import { NavigationType, useNavigationType } from 'react-router';

/**
 * Tras un cambio de pantalla dentro de la aplicación el foco va al `h1` (WCAG 2.4.3): una SPA no
 * recarga la página y el foco se quedaría en el control de la pantalla anterior. En la primera
 * carga (`POP`) no se mueve: el navegador ya lo gestiona. El DOM es un sistema externo.
 */
export function useFocusOnTitle() {
  const title = useRef<HTMLHeadingElement>(null);
  const type = useNavigationType();
  useEffect(() => {
    if (type !== NavigationType.Pop) title.current?.focus({ preventScroll: true });
  }, [type]);
  return title;
}
