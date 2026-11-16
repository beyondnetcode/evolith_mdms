/**
 * Navegación local de un sistema bajo la cabecera común de la suite (ADR-0245 D4.1): cada sistema aporta sus
 * destinos de primer nivel y, si la tiene, su acción principal; el marco común (`SystemFrame` de `@suite/header`)
 * los pinta en el riel o en el cajón según la clase de tamaño de ventana. El contrato no conoce la librería de
 * componentes: el nombre del icono es un parámetro de tipo que el marco fija con los iconos de `@sil/ui`.
 */
export interface NavDestination<TIcon extends string = string> {
  /** Dirección del destino, absoluta y en español (p. ej. `/mdm/organizaciones`). */
  readonly path: string;
  readonly label: string;
  readonly icon: TIcon;
  /**
   * Otras raíces de dirección en las que el destino también es el activo. Las subrutas de `path` ya cuentan:
   * `/mdm/organizaciones` está activo en `/mdm/organizaciones/nueva` sin declararlo.
   */
  readonly matchPrefixes?: readonly string[];
}

/** Acción principal del sistema (FAB de M3): arriba del riel desde `medium` y flotante en `compact` (R-18). */
export interface PrimaryAction<TIcon extends string = string> {
  readonly path: string;
  readonly label: string;
  readonly icon: TIcon;
}

/** ¿`pathname` es `prefix` o una de sus subrutas? Compara por segmentos: `/mdm/org` no cubre `/mdm/organizaciones`. */
function underPrefix(pathname: string, prefix: string): boolean {
  const root = prefix.length > 1 && prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  return pathname === root || pathname.startsWith(root === '/' ? '/' : `${root}/`);
}

/** El destino está activo en `pathname` si es su dirección, una subruta de ella o de alguno de sus `matchPrefixes`. */
export function isDestinationActive(destination: NavDestination, pathname: string): boolean {
  return [destination.path, ...(destination.matchPrefixes ?? [])].some((prefix) => underPrefix(pathname, prefix));
}

/** ¿`pathname` es exactamente la dirección de un destino? Es una pantalla de primer nivel del sistema. */
export function isDestinationRoot(destinations: readonly NavDestination[], pathname: string): boolean {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return destinations.some((destination) => destination.path === normalized);
}
