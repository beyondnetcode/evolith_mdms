import { RUC_SCHEME_CODE, isValidRuc, normalizeIdentifierValue, type IdentifierScheme } from '@mdm/contracts';

/**
 * Reglas de campo que la interfaz anticipa antes de enviar (UX-MDM-001 §6.3). El servidor decide igualmente:
 * aquí solo se evita enviar lo que se sabe inválido. Devuelven el problema, no el texto: el texto es de la
 * presentación.
 */

/** Problema de un campo, con el dato que su mensaje necesita. */
export type FieldIssue =
  | { readonly kind: 'required' }
  | { readonly kind: 'too_long' }
  /** El valor no cumple el patrón del esquema del catálogo (`INV-PTY-04`). */
  | {
      readonly kind: 'pattern';
      readonly schemeCode: string;
      readonly schemeName: string;
    }
  /** RUC con dígito verificador incorrecto (módulo 11). */
  | { readonly kind: 'check_digit' }
  | { readonly kind: 'date_invalid' }
  /** La fecha es anterior a `from` (inicio de la vigencia). */
  | { readonly kind: 'before'; readonly from: string }
  /** La fecha cae fuera de `[from, to]` (término de un rol con «hasta» vigente, P-15). */
  | { readonly kind: 'out_of_range'; readonly from: string; readonly to: string }
  /** No cumple el formato fijo del campo (anexo SUNAT, ubigeo, país). */
  | { readonly kind: 'format' }
  /** El código ya está usado en lo cargado (`INV-PTY-08`). */
  | { readonly kind: 'taken' }
  /** El dato no aplica con el resto del formulario (ubigeo fuera de Perú). */
  | { readonly kind: 'not_applicable' }
  /** La otra organización de una relación es la propia (`INV-PTY-12`). */
  | { readonly kind: 'same_party'; readonly code: string }
  /** Se cruza con otro rol del mismo tipo (`INV-PTY-05`). */
  | {
      readonly kind: 'overlap';
      readonly roleTypeCode: string;
      readonly validFrom: string;
      readonly validTo: string | null;
    };

export interface TextRule {
  readonly required: boolean;
  readonly max: number;
}

/** Texto: obligatorio tras recortar y con longitud máxima. */
export function checkText(value: string, rule: TextRule): FieldIssue | null {
  const clean = value.trim();
  if (clean === '') return rule.required ? { kind: 'required' } : null;
  return clean.length > rule.max ? { kind: 'too_long' } : null;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ¿Es una fecha civil `AAAA-MM-DD` que existe en el calendario? */
export function isCivilDate(value: string): boolean {
  const parts = ISO_DATE.exec(value);
  if (parts === null) return false;
  const [year, month, day] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export interface DateRule {
  readonly required: boolean;
  /** Fecha mínima admitida (el «desde» de la vigencia), o `null`. */
  readonly notBefore: string | null;
}

/** Fecha civil: vacía solo si es opcional, existente y no anterior a `notBefore`. */
export function checkDate(value: string, rule: DateRule): FieldIssue | null {
  if (value === '') return rule.required ? { kind: 'required' } : null;
  if (!isCivilDate(value)) return { kind: 'date_invalid' };
  return rule.notBefore !== null && isCivilDate(rule.notBefore) && value < rule.notBefore ? { kind: 'before', from: rule.notBefore } : null;
}

/** Valor del identificador (`INV-PTY-04`): obligatorio, hasta 50, patrón del esquema y dígito del RUC. */
export function checkIdentifierValue(value: string, scheme: IdentifierScheme | undefined): FieldIssue | null {
  const normalized = normalizeIdentifierValue(value);
  if (normalized === '') return { kind: 'required' };
  if (normalized.length > 50) return { kind: 'too_long' };
  // Sin esquema elegido, el error lo dice el campo del esquema.
  if (scheme === undefined) return null;
  if (!new RegExp(scheme.pattern).test(normalized))
    return {
      kind: 'pattern',
      schemeCode: scheme.code,
      schemeName: scheme.name,
    };
  return scheme.code === RUC_SCHEME_CODE && !isValidRuc(normalized) ? { kind: 'check_digit' } : null;
}

/**
 * Fecha civil de hoy en Lima (UTC-5 sin horario de verano, supuesto G-575): la misma regla con la que el
 * servidor calcula `isCurrent`.
 */
export function limaToday(epochMs: number = Date.now()): string {
  return new Date(epochMs - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** ¿Se cruzan dos vigencias cerradas `[desde, hasta]`? `null` en «hasta» es indefinido. */
export function validitiesOverlap(
  a: { readonly validFrom: string; readonly validTo: string | null },
  b: { readonly validFrom: string; readonly validTo: string | null },
): boolean {
  return (b.validTo === null || a.validFrom <= b.validTo) && (a.validTo === null || b.validFrom <= a.validTo);
}

/** La menor de dos fechas civiles `AAAA-MM-DD` (se comparan como texto). */
export function earlierDate(a: string, b: string): string {
  return a <= b ? a : b;
}

/** La mayor de dos fechas civiles `AAAA-MM-DD`. */
export function laterDate(a: string, b: string): string {
  return a >= b ? a : b;
}

/** Día anterior a una fecha civil: el primario reemplazado vence el día previo al nuevo (G-570). */
export function previousDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
