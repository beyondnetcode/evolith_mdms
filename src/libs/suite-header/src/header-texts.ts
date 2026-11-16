/** Textos exactos de la cabecera común de la suite (anexo A1 §1, §3, §4 y §11). */
export const HEADER_TEXTS = {
  /** Enlace para saltar bloques, primero en el orden de foco (WCAG 2.4.1). */
  skipLink: 'Ir al contenido principal',
  help: 'La ayuda no está disponible en el prototipo.',
  signOut: 'Cerrar sesión',
  /** Salir de un sistema con cambios sin guardar (anexo A1 §4). */
  leave: {
    title: '¿Salir sin guardar?',
    body: 'Tienes cambios sin guardar. Si sales ahora, se perderán.',
  },
} as const;

/** Textos de S-03 para un sistema: «Elige la sede de SIL» (anexo A1 §4). */
export function sitePickerTexts(systemCode: string) {
  return {
    title: `Elige la sede de ${systemCode}`,
    supportText: `Tienes acceso a ${systemCode} en más de una sede. Elige con cuál vas a trabajar.`,
    legend: `Sede de ${systemCode}`,
  } as const;
}
