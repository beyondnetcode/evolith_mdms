/**
 * Reglas del catálogo de tipos de rol que el contrato publica (API-MDM-002 §5.4, D-046) y que la interfaz anticipa.
 * El servidor sigue siendo quien decide; aquí solo se evita enviar lo que se sabe inválido.
 */

/** Código del tipo de rol ya normalizado: empieza por letra; letras, dígitos y `_`; de 2 a 50 caracteres. */
export const ROLE_TYPE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/;

/** Código UN/EDIFACT 3035 (calificador de parte): dos letras mayúsculas (D-046). */
export const EDIFACT_3035_PATTERN = /^[A-Z]{2}$/;

/** Longitudes del contrato. */
export const ROLE_TYPE_NAME_MAX = 200;
export const ROLE_TYPE_DESCRIPTION_MAX = 500;

/**
 * `code` del tipo de rol normalizado a MAYÚSCULAS_CON_GUION_BAJO: recorte, mayúsculas invariantes y cada tramo de
 * espacios o guiones por un `_`. «agente  de-carga» → `AGENTE_DE_CARGA`.
 */
export function normalizeRoleTypeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]+/g, '_');
}

/** ¿El código, ya normalizado, cumple el patrón (`party_role_type.code_invalid` si no)? */
export function isValidRoleTypeCode(normalized: string): boolean {
  return ROLE_TYPE_CODE_PATTERN.test(normalized);
}

/** Código UN/EDIFACT 3035 normalizado: recorte y mayúsculas; vacío es `null` (opcional). */
export function normalizeEdifact3035Code(value: string): string | null {
  const clean = value.trim().toUpperCase();
  return clean === '' ? null : clean;
}

/** ¿El código UN/EDIFACT 3035, ya normalizado, son dos letras (`party_role_type.edifact_invalid` si no)? */
export function isValidEdifact3035Code(normalized: string): boolean {
  return EDIFACT_3035_PATTERN.test(normalized);
}
