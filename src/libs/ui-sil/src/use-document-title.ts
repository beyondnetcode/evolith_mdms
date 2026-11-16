import { useEffect } from 'react';

/**
 * Sincroniza el título de la pestaña con la pantalla (WCAG 2.4.2; anexo A1 §11.6, M-09): «{pantalla} · {sufijo}».
 * Cada sistema pone su sufijo («SIL · Suite»; la suite, «Suite»). Con `title` nulo, solo el
 * sufijo (S-02). El título es un sistema externo.
 */
export function useDocumentTitle(title: string | null, suffix: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title === null ? suffix : `${title} · ${suffix}`;
    return () => {
      document.title = previous;
    };
  }, [title, suffix]);
}
