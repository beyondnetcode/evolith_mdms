/**
 * Inquilino que S-01 ofrece en el inicio de sesión (D-029). Es la forma de `GET /api/v1/auth/tenants` de UMS
 * (`{ items: [{ code, name }] }`, ordenado por `name`): el portal real lo leerá de ahí sin tocar la presentación.
 * Ofrecer un inquilino no autoriza nada: quien decide el ingreso es el servidor.
 */
export interface SignInTenant {
  /** Código canónico en mayúsculas (`ORG`, `ORG_TRANSPORTES`, `UNILOG`). */
  readonly code: string;
  /** Nombre visible («Organización S.A.»). */
  readonly name: string;
}

/** Inquilino con el que se abre S-01 si la lista lo ofrece (ADR-0156 §2.8: «ORG siempre, salvo indicación»). */
export const DEFAULT_TENANT_CODE = 'ORG';

const TENANT_CODE = /^[A-Z][A-Z0-9_]{0,49}$/;

/** El código como lo compara el servidor: sin espacios y en mayúsculas. */
export function normalizeTenantCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isTenantCode(value: unknown): value is string {
  return typeof value === 'string' && TENANT_CODE.test(value);
}

/** Inquilino que S-01 selecciona al abrir: ORG si se ofrece; si no, el primero de la lista. */
export function defaultTenantOf(tenants: readonly SignInTenant[]): string {
  return tenants.find((t) => t.code === DEFAULT_TENANT_CODE)?.code ?? tenants[0]?.code ?? '';
}
