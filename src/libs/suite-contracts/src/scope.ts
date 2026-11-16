/**
 * Alcance del prototipo para toda la suite: con `false`, solo el Sprint Backlog 1 (ingreso con UMS, registro
 * y bandeja de SIL). Lo comparten el anfitrión (la campana de notificaciones de la cabecera) y SIL (las rutas
 * de P-04 a P-09), que lo lee en `presentation/sil-scope.ts`; un solo valor evita que se desalineen.
 */
interface PrototypeScope {
  readonly full: boolean;
}

/** Un objeto con tipo declarado: el valor es `boolean` y las ramas que lo consultan no se ven «siempre falsas». */
const PROTOTYPE_SCOPE: PrototypeScope = { full: false };

export const FULL_SCOPE = PROTOTYPE_SCOPE.full;
