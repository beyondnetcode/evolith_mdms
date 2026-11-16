import { MIN_WIDTH_DP, WINDOW_SIZE_CLASSES, type WindowSizeClass } from '@sil/ui-tokens';
import { useSyncExternalStore } from 'react';

const CLASSES_WITH_QUERY = WINDOW_SIZE_CLASSES.filter((sizeClass) => sizeClass !== 'compact');

function mediaQueries(): MediaQueryList[] | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return CLASSES_WITH_QUERY.map((sizeClass) => window.matchMedia(`(min-width: ${MIN_WIDTH_DP[sizeClass]}px)`));
}

function subscribe(notify: () => void): () => void {
  const lists = mediaQueries() ?? [];
  for (const list of lists) list.addEventListener('change', notify);
  return () => {
    for (const list of lists) list.removeEventListener('change', notify);
  };
}

function read(): WindowSizeClass {
  const lists = mediaQueries();
  // Sin `matchMedia` (entornos de prueba) se asume escritorio, el uso más probable (SU-04).
  if (lists === null) return 'expanded';
  let sizeClass: WindowSizeClass = 'compact';
  lists.forEach((list, index) => {
    if (list.matches) sizeClass = CLASSES_WITH_QUERY[index] ?? sizeClass;
  });
  return sizeClass;
}

/** Clase de tamaño de ventana de M3 vigente; se actualiza al redimensionar o girar. */
export function useWindowSizeClass(): WindowSizeClass {
  return useSyncExternalStore(subscribe, read, () => 'expanded');
}
