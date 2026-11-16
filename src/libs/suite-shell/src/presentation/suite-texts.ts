/** Textos exactos del anexo A1 de UX-SIL-001 (S-01, S-02 y S-03). */
export const SUITE_TEXTS = {
  signedOut: 'Cerraste sesión en la suite.',
  signIn: {
    title: 'Inicia sesión',
    /** Descriptor del panel de marca (R-01): literal. */
    panelDescriptor: 'Accede a tus sistemas de operación logística.',
    supportText: 'Elige tu inquilino y usa tu usuario.',
    /** Botón de texto bajo «Iniciar sesión» y título del diálogo que abre (R-02). */
    helpButton: '¿Necesitas ayuda para ingresar?',
    helpTitle: 'Ayuda para ingresar',
    signInHelp: 'Si no recuerdas tu usuario o tu contraseña, comunícate con el administrador de accesos.',
    prototype: 'Prototipo: los usuarios y las claves son de prueba y no corresponden a cuentas reales.',
    // Un inquilino ajeno responde lo mismo que una clave mala: el mensaje no dice cuál de los tres falló.
    credentials: 'Inquilino, usuario o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.',
    locked: 'Tu cuenta está bloqueada. Pide a tu jefatura o al administrador de accesos que la desbloquee.',
    expired: 'Tu sesión terminó. Inicia sesión para continuar.',
    missingTenant: 'Elige tu inquilino.',
    tenantsUnavailable: 'No se pudo cargar la lista de inquilinos.',
    testUsersNeedTenant: 'Elige un inquilino para ver sus usuarios de prueba.',
    missingUser: 'Indica tu usuario.',
    missingPassword: 'Indica tu contraseña.',
  },
  home: {
    /** Encabezados de los dos grupos del lanzador (R-06, R-28). */
    available: 'Tus sistemas',
    unavailable: 'Aún no disponibles en este prototipo',
    /** Al final de la lista (R-08). */
    missing: '¿Te falta algún sistema? Pídelo a tu jefatura o al administrador de accesos.',
    /** Estado vacío del lanzador (R-09). */
    emptyTitle: 'Aún no tienes sistemas asignados',
    hours: 'Las horas se muestran en hora de Lima (UTC-5).',
    prototype: 'Prototipo: esta pantalla simula el portal de la suite y será reemplazada por el portal real.',
    empty: 'Tu usuario no tiene acceso a ningún sistema de la suite. Pídelo a tu jefatura o al administrador de accesos.',
    // Sin la sigla interna «UMS» (anexo A1 §11.6, M-10): el usuario no la conoce.
    umsDown:
      'No podemos comprobar tus permisos en este momento. Puedes seguir trabajando; si el problema continúa, se te pedirá iniciar sesión.',
    maintenance: 'No está disponible por mantenimiento. Inténtalo más tarde.',
    /** Bloque «Tu contexto de trabajo» de S-02 (D-030). */
    context: 'Tu contexto de trabajo',
    tenant: 'Inquilino',
    site: 'Sede de trabajo',
    siteHelp: 'Los sistemas de abajo se abren con tu perfil de esta sede.',
    allSitesHelp: 'Ves los sistemas de todas tus sedes; al abrir uno con varias, eliges cuál.',
    siteChanged: (site: string) => `Ahora trabajas en ${site}.`,
    /** Sistemas fuera del alcance del prototipo: sin jerga de proyecto («Fase 1»). */
    notAvailable: 'Aún no disponible en este prototipo.',
  },
  expired: {
    title: 'Tu sesión terminó',
    body: 'Lo que no guardaste se conserva en esta página; inicia sesión para continuar.',
  },
} as const;

/** Motivo por el que no se ingresa a un sistema (US-SIL-004 escenarios 3 y 4). */
export type NoAccessReason = 'no-role' | 'no-site';

/**
 * Página completa de una dirección de un sistema sin acceso (anexo A1 §5): no revela si el sistema existe. Los
 * mensajes son los literales de la US-SIL-004, que nombran a UMS: la historia prevalece sobre M-10.
 */
export function noSystemAccessTexts(systemCode: string) {
  return {
    title: `Sin acceso a ${systemCode}`,
    body: {
      'no-role': `No tienes acceso a ${systemCode}. Solicita el rol al administrador de UMS.`,
      'no-site': 'Tu usuario no tiene una sede asignada. Solicítala al administrador de UMS.',
    } satisfies Record<NoAccessReason, string>,
  } as const;
}

/** 404 de la suite: una dirección que no es de la suite ni de ningún sistema montado. */
export const NOT_FOUND_TEXTS = {
  title: 'Página no encontrada',
  body: 'La dirección que abriste no existe en Suite.',
} as const;
