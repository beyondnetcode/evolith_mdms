import type { SignInTenant } from '@suite/contracts';

/**
 * Fila de la tabla de inquilinos del mock (D-029). Reproduce las columnas del agregado `Tenant` de UMS que
 * deciden qué ofrece el inicio de sesión: un inquilino aparece en S-01 solo si está activo y tiene
 * `showOnLogin`. Las razones sociales son las que siembra UMS y siguen sin confirmar (G-269).
 */
export interface MockTenant extends SignInTenant {
  readonly active: boolean;
  readonly showOnLogin: boolean;
}

/** Tabla `Tenants` del mock: las empresas del grupo que inician sesión en la suite. */
export const MOCK_TENANTS: readonly MockTenant[] = [
  { code: 'ORG', name: 'Organización S.A.', active: true, showOnLogin: true },
  { code: 'ORG_TRANSPORTES', name: 'Organización Transportes S.A.C.', active: true, showOnLogin: true },
  { code: 'UNILOG', name: 'Unilog S.A.C.', active: true, showOnLogin: true },
];

/** Lo que responde `GET /api/v1/auth/tenants`: activos, visibles en el ingreso y ordenados por nombre. */
export function signInTenants(table: readonly MockTenant[] = MOCK_TENANTS): readonly SignInTenant[] {
  return table
    .filter((t) => t.active && t.showOnLogin)
    .map(({ code, name }) => ({ code, name }))
    .toSorted((a, b) => a.name.localeCompare(b.name, 'es'));
}

/** El inquilino activo con ese código, o `undefined`: uno inactivo no admite inicio de sesión. */
export function findActiveTenant(code: string, table: readonly MockTenant[] = MOCK_TENANTS): MockTenant | undefined {
  return table.find((t) => t.code === code && t.active);
}
