/**
 * Clases de tamaño de ventana de Material Design 3 (UX-SIL-001 §7.2). Los anchos están en dp
 * (= px CSS) y repiten los `--breakpoint-*` generados desde `tokens/global/window.json`; una prueba los mantiene iguales.
 */
export const WINDOW_SIZE_CLASSES = ['compact', 'medium', 'expanded', 'large', 'extra-large'] as const;
export type WindowSizeClass = (typeof WINDOW_SIZE_CLASSES)[number];

/** Ancho mínimo, en dp, de cada clase. */
export const MIN_WIDTH_DP: Readonly<Record<WindowSizeClass, number>> = {
  compact: 0,
  medium: 600,
  expanded: 840,
  large: 1200,
  'extra-large': 1600,
};

export function windowSizeClass(widthDp: number): WindowSizeClass {
  let sizeClass: WindowSizeClass = 'compact';
  for (const candidate of WINDOW_SIZE_CLASSES) {
    if (widthDp >= MIN_WIDTH_DP[candidate]) sizeClass = candidate;
  }
  return sizeClass;
}

/** A partir de `expanded` la navegación es un riel expandido no modal y la bandeja es tabla. */
export function isDesktop(sizeClass: WindowSizeClass): boolean {
  return sizeClass === 'expanded' || sizeClass === 'large' || sizeClass === 'extra-large';
}

export { THEME_COLOR } from './theme-color.generated.ts';
