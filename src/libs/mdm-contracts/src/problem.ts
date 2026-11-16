import { array, dictionary, integer, isRecord, text } from './parse.ts';

/**
 * Errores del contrato (API-MDM-002 §6 y §7): Problem Details (RFC 9457) con la extensión `code`. Cada `code`
 * va ligado a un único estado HTTP; un Problem Details cuyo par estado-código no está en el contrato se
 * descarta como respuesta inválida. El `code` y el `instance` se registran, no se muestran (UX-MDM-001 §6).
 */

/** `409`: choca con el estado actual o con otro dato. */
export const CONFLICT_CODES = [
  'party.code_not_unique',
  'party.archived',
  'party.merged',
  'party.already_active',
  'party.already_suspended',
  'party.not_active',
  'party.identifier.duplicate',
  'party.identifier.primary_exists',
  'party.identifier.primary_required',
  'party.identifier.fiscal_required',
  'party.identifier.already_expired',
  'party.role.fiscal_identifier_required',
  'party.role.overlap',
  'party.role.already_active',
  'party.role.already_suspended',
  'party.role.terminated',
  'establishment.code_not_unique',
  'establishment.principal_exists',
  'establishment.already_active',
  'establishment.already_inactive',
  'establishment.closed',
  'party_relationship.party_not_active',
  'party_relationship.overlap',
  'party_relationship.already_ended',
  'external_reference.target_not_active',
  'external_reference.key_duplicate',
  'external_reference.already_unlinked',
  'party_role_type.code_duplicate',
  'party_role_type.already_active',
  'party_role_type.already_inactive',
  'party_role_type.inactive',
  'geo.place.already_active',
  'geo.place.already_inactive',
  'geo.place.has_children',
  'geo.place.historical',
  'geo.place.parent_inactive',
  'geo.country.level_in_use',
  'geo.country.schema_not_declared',
  'geo.code.duplicate',
  'geo.code.current_exists',
  'geo.code.canonical_required',
  'geo.code.already_expired',
  'geo.code.ambiguous',
  'geo.name.duplicate',
  'geo.name.already_expired',
  'geo.name.official_not_expirable',
  'geo.correspondence.duplicate',
  'geo.correspondence.already_expired',
] as const;
export type ConflictCode = (typeof CONFLICT_CODES)[number];

/** `422`: el valor no es admisible (lo decide un catálogo o una regla sin estado). */
export const UNPROCESSABLE_CODES = [
  'party.person_not_supported',
  'party.identifier.scheme_unknown',
  'party.identifier.scheme_not_allowed',
  'party.identifier.invalid_format',
  'party.identifier.check_digit_invalid',
  'party.role.type_unknown',
  'party.role.type_not_allowed',
  'establishment.kind_unknown',
  'establishment.kind_not_supported',
  'party_relationship.self_reference',
  'party_relationship.kind_unknown',
  'party_relationship.party_not_found',
  'external_reference.target_not_found',
  'party_role_type.code_invalid',
  'party_role_type.edifact_invalid',
  'geo.place.parent_not_found',
  'geo.place.parent_level_invalid',
  'geo.place.type_not_supported',
  'geo.place.cycle',
  'geo.country.level_order_invalid',
  'geo.scheme.unknown',
  'geo.scheme.not_applicable',
  'geo.code.invalid_format',
  'geo.code.country_mismatch',
  'geo.code.hierarchy_mismatch',
  'geo.correspondence.code_unknown',
  'geo.correspondence.self_reference',
  'geo.trade_location.function_deprecated',
  'geo.trade_location.not_trade_location',
  'geo.source.unknown',
] as const;
export type UnprocessableCode = (typeof UNPROCESSABLE_CODES)[number];

/** `400`. */
export const BAD_REQUEST_CODES = ['validation.failed', 'validation.identifier_filter_incomplete', 'validation.search_too_broad', 'request.malformed'] as const;
export type BadRequestCode = (typeof BAD_REQUEST_CODES)[number];

/** Códigos transversales con un estado fijo, heredados del contrato de Tenant. */
const SINGLE_STATUS_CODES = {
  'auth.unauthenticated': 401,
  'auth.user_required': 401,
  'auth.forbidden': 403,
  'common.not_found': 404,
  'request.method_not_allowed': 405,
  'precondition.failed': 412,
  'request.unsupported_media_type': 415,
  'precondition.required': 428,
  'server.unexpected_error': 500,
} as const;
type SingleStatusCodes = typeof SINGLE_STATUS_CODES;
export type TransversalCode = keyof SingleStatusCodes;

interface ProblemBase {
  readonly title: string;
  readonly detail: string | null;
  /** Identifica la ocurrencia; sirve de código de correlación para soporte. */
  readonly instance: string | null;
  /** Solo en `validation.failed`: un único campo con sus códigos `validation.*`. Vacío en el resto. */
  readonly errors: Readonly<Record<string, readonly string[]>>;
}

type TransversalProblem = { [C in TransversalCode]: ProblemBase & { readonly status: SingleStatusCodes[C]; readonly code: C } }[TransversalCode];

/** Unión discriminada por `status` y `code`: el par siempre es uno de los que publica el contrato. */
export type MdmProblem =
  | (ProblemBase & { readonly status: 404; readonly code: 'geo.country.schema_not_declared' })
  | (ProblemBase & { readonly status: 400; readonly code: BadRequestCode })
  | (ProblemBase & { readonly status: 409; readonly code: ConflictCode })
  | (ProblemBase & { readonly status: 422; readonly code: UnprocessableCode })
  | TransversalProblem;

export type MdmErrorCode = MdmProblem['code'];

function isMember<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

function isTransversalCode(code: string): code is TransversalCode {
  return Object.hasOwn(SINGLE_STATUS_CODES, code);
}

function transversal(status: number, code: string, base: ProblemBase): MdmProblem | null {
  if (!isTransversalCode(code) || SINGLE_STATUS_CODES[code] !== status) return null;
  // Aserción justificada: se acaba de comprobar que `status` es el que el contrato asigna a `code`.
  return { ...base, status: SINGLE_STATUS_CODES[code], code } as TransversalProblem;
}

/** Construye el problema tipado si el par estado-código existe en el contrato. */
export function problemOf(status: number, code: string, base: ProblemBase): MdmProblem | null {
  if (status === 404 && code === 'geo.country.schema_not_declared') return { ...base, status, code };
  if (status === 400 && isMember(BAD_REQUEST_CODES, code)) return { ...base, status, code };
  if (status === 409 && isMember(CONFLICT_CODES, code)) return { ...base, status, code };
  if (status === 422 && isMember(UNPROCESSABLE_CODES, code)) return { ...base, status, code };
  return transversal(status, code, base);
}

const optionalText = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const parseErrors = dictionary(array(text()));

/** Problem Details recibido (`unknown`) a problema tipado, o `null` si no cumple el contrato. */
export function parseProblemDetails(input: unknown): MdmProblem | null {
  if (!isRecord(input)) return null;
  const status = integer(400, 599)(input.status, '$.status');
  const code = text({ min: 1, max: 200 })(input.code, '$.code');
  const title = text()(input.title, '$.title');
  const errors = input.errors === undefined ? null : parseErrors(input.errors, '$.errors');
  if (!status.ok || !code.ok || !title.ok || errors?.ok === false) return null;
  const base: ProblemBase = {
    title: title.value,
    detail: optionalText(input.detail),
    instance: optionalText(input.instance),
    errors: errors?.ok === true ? errors.value : {},
  };
  return problemOf(status.value, code.value, base);
}

/** Respuesta de error del servidor, ya validada. La interfaz decide el mensaje por `problem.code`. */
export class MdmProblemError extends Error {
  readonly problem: MdmProblem;
  /** Lo lee `LoadError` de `ui-sil` para mostrarlo a soporte. */
  readonly correlation: string;

  constructor(problem: MdmProblem, correlation: string, options?: ErrorOptions) {
    super(`${problem.status} ${problem.code} (${correlation})`, options);
    this.name = 'MdmProblemError';
    this.problem = problem;
    this.correlation = correlation;
  }
}

/** Sin respuesta del servidor (red): «No hay conexión con el servidor. No se guardó nada.». */
export class MdmNetworkError extends Error {
  readonly correlation: string;

  constructor(correlation: string, options?: ErrorOptions) {
    super(`Sin respuesta del servidor (${correlation})`, options);
    this.name = 'MdmNetworkError';
    this.correlation = correlation;
  }
}

/** La respuesta no cumple el contrato: falla cerrado, nunca se muestra a medias. */
export class MdmContractError extends Error {
  readonly correlation: string;
  /** Ruta del primer campo roto y lo esperado: para el registro, no para la pantalla. */
  readonly violation: string;

  constructor(operation: string, violation: string, correlation: string) {
    super(`Respuesta de ${operation} fuera de contrato: ${violation}`);
    this.name = 'MdmContractError';
    this.violation = violation;
    this.correlation = correlation;
  }
}

/** El problema tipado de un error, si es una respuesta de error del contrato. */
export function problemFrom(error: unknown): MdmProblem | null {
  return error instanceof MdmProblemError ? error.problem : null;
}

/** ¿El error es la respuesta del contrato con este `code`? */
export function hasProblemCode(error: unknown, code: MdmErrorCode): boolean {
  return problemFrom(error)?.code === code;
}
