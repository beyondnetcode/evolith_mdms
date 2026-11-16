/**
 * Validación en tiempo de ejecución de lo que cruza la frontera (ADR-0109 P-FE-06): las respuestas del
 * gateway —hoy el mock, mañana la API de Party— son entrada no confiable hasta que se comprueban campo a campo.
 * Combinadores escritos a mano para no añadir dependencias (S-07). Un fallo indica la ruta del primer campo
 * roto, para registrarlo; nunca se completa un valor a ojo.
 */

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly path: string; readonly expected: string };

export type Parser<T> = (input: unknown, path: string) => ParseResult<T>;

/** Forma de un objeto: un analizador por propiedad. Solo para tipos sin propiedades opcionales. */
export type Shape<T> = { readonly [K in keyof T]: Parser<T[K]> };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function success<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

export function failure(path: string, expected: string): ParseResult<never> {
  return { ok: false, path, expected };
}

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface TextRules {
  readonly min?: number;
  readonly max?: number;
  readonly pattern?: RegExp;
}

export function text(rules: TextRules = {}): Parser<string> {
  const { min = 0, max = Number.MAX_SAFE_INTEGER, pattern } = rules;
  return (input, path) => {
    if (typeof input !== 'string') return failure(path, 'texto');
    if (input.length < min || input.length > max) return failure(path, `texto de ${min} a ${max} caracteres`);
    if (pattern !== undefined && !pattern.test(input)) return failure(path, `texto con el patrón ${pattern.source}`);
    return success(input);
  };
}

export const uuid: Parser<string> = text({ pattern: UUID_PATTERN });

/** Fecha civil `aaaa-mm-dd` que existe en el calendario (no acepta `2026-02-30`). */
export const civilDate: Parser<string> = (input, path) => {
  if (typeof input !== 'string') return failure(path, 'fecha aaaa-mm-dd');
  const match = CIVIL_DATE_PATTERN.exec(input);
  if (match === null) return failure(path, 'fecha aaaa-mm-dd');
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const exists = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return exists ? success(input) : failure(path, 'fecha existente');
};

/** Instante ISO 8601 con desfase. */
export const instant: Parser<string> = (input, path) =>
  typeof input === 'string' && input.includes('T') && Number.isFinite(Date.parse(input)) ? success(input) : failure(path, 'instante ISO 8601');

export const boolean: Parser<boolean> = (input, path) => (typeof input === 'boolean' ? success(input) : failure(path, 'booleano'));

export function integer(min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): Parser<number> {
  return (input, path) =>
    typeof input === 'number' && Number.isInteger(input) && input >= min && input <= max ? success(input) : failure(path, `entero de ${min} a ${max}`);
}

/** Uno de los valores de una enumeración cerrada del contrato. */
export function oneOf<const T extends string>(values: readonly T[]): Parser<T> {
  const isMember = (input: unknown): input is T => typeof input === 'string' && (values as readonly string[]).includes(input);
  return (input, path) => (isMember(input) ? success(input) : failure(path, values.join(' | ')));
}

export function nullable<T>(parser: Parser<T>): Parser<T | null> {
  return (input, path) => (input === null ? success(null) : parser(input, path));
}

export function array<T>(parser: Parser<T>, max = Number.MAX_SAFE_INTEGER): Parser<readonly T[]> {
  return (input, path) => {
    if (!Array.isArray(input)) return failure(path, 'lista');
    if (input.length > max) return failure(path, `lista de hasta ${max} elementos`);
    const output: T[] = [];
    for (const [index, item] of (input as unknown[]).entries()) {
      const result = parser(item, `${path}[${index}]`);
      if (!result.ok) return result;
      output.push(result.value);
    }
    return success(output);
  };
}

/** Diccionario de texto a valor (p. ej. `errors` de Problem Details). */
export function dictionary<T>(parser: Parser<T>): Parser<Readonly<Record<string, T>>> {
  return (input, path) => {
    if (!isRecord(input)) return failure(path, 'objeto');
    const output: Record<string, T> = {};
    for (const [key, value] of Object.entries(input)) {
      const result = parser(value, `${path}.${key}`);
      if (!result.ok) return result;
      output[key] = result.value;
    }
    return success(output);
  };
}

export function object<T extends object>(shape: Shape<T>): Parser<T> {
  return (input, path) => {
    if (!isRecord(input)) return failure(path, 'objeto');
    const output: Record<string, unknown> = {};
    for (const [key, parser] of Object.entries<Parser<unknown>>(shape)) {
      const result = parser(input[key], `${path}.${key}`);
      if (!result.ok) return result;
      output[key] = result.value;
    }
    // Aserción justificada: `output` tiene exactamente una propiedad por clave de `shape`, cada una con el
    // tipo que su analizador garantiza; TypeScript no puede seguir esa correspondencia a través del bucle.
    return success(output as T);
  };
}

/** Atajo: el valor validado o `null`. */
export function parseOrNull<T>(parser: Parser<T>, input: unknown): T | null {
  const result = parser(input, '$');
  return result.ok ? result.value : null;
}
