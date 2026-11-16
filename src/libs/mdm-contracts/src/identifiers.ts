/**
 * Reglas de identificadores y códigos que el contrato publica y que la interfaz anticipa (`INV-PTY-04`,
 * `INV-PTY-07`). El servidor sigue siendo quien decide; aquí solo se evita enviar lo que se sabe inválido.
 */

/** Esquema del RUC peruano: el único con dígito verificador en la primera entrega (DOM-MDM-001 §3.3). */
export const RUC_SCHEME_CODE = 'PE-RUC';

const RUC_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

/** Valor del identificador normalizado: recorte, mayúsculas, sin espacios ni guiones (API-MDM-002 §2). */
export function normalizeIdentifierValue(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]/g, '');
}

/** `code` de Party o establecimiento normalizado: recorte, mayúsculas invariantes y espacios por `_`. */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '_');
}

/** Dígito verificador del RUC por módulo 11 sobre los diez primeros dígitos. */
export function rucCheckDigit(firstTenDigits: string): number | null {
  if (!/^[0-9]{10}$/.test(firstTenDigits)) return null;
  const sum = RUC_WEIGHTS.reduce((total, weight, index) => total + weight * Number(firstTenDigits[index]), 0);
  const digit = 11 - (sum % 11);
  if (digit === 10) return 0;
  if (digit === 11) return 1;
  return digit;
}

/** RUC de 11 dígitos con dígito verificador correcto. Recibe el valor ya normalizado. */
export function isValidRuc(value: string): boolean {
  if (!/^[0-9]{11}$/.test(value)) return false;
  return rucCheckDigit(value.slice(0, 10)) === Number(value[10]);
}
