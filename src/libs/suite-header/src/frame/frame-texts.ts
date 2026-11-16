/** Textos exactos del marco común de un sistema (anexo A1 §4; UI-SIL-001 §4.2). */
export const FRAME_TEXTS = {
  openMenu: 'Abrir menú de navegación',
  closeMenu: 'Cerrar menú de navegación',
  portal: 'Ir al portal',
  role: 'Rol:',
  site: 'Sede:',
  /** Nombre accesible del riel y del cajón: «Navegación de SIL». */
  navigation: (systemName: string) => `Navegación de ${systemName}`,
} as const;
