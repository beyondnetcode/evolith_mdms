import { describe, expect, it } from 'vitest';
import { findActiveTenant, signInTenants, type MockTenant } from './tenants.ts';

const TABLE: readonly MockTenant[] = [
  { code: 'ORG', name: 'Organización S.A.', active: true, showOnLogin: true },
  { code: 'INTERNAL_ADMIN', name: 'Administración interna', active: true, showOnLogin: false },
  { code: 'BAJA', name: 'Empresa dada de baja', active: false, showOnLogin: true },
];

describe('tabla de inquilinos del mock (D-029)', () => {
  it('el ingreso ofrece solo los activos con showOnLogin, sin las banderas', () => {
    expect(signInTenants(TABLE)).toEqual([{ code: 'ORG', name: 'Organización S.A.' }]);
  });

  it('un inquilino oculto en el ingreso admite sesión; uno inactivo, no', () => {
    expect(findActiveTenant('INTERNAL_ADMIN', TABLE)?.code).toBe('INTERNAL_ADMIN');
    expect(findActiveTenant('BAJA', TABLE)).toBeUndefined();
  });

  it('la tabla por defecto tiene las tres empresas del grupo', () => {
    expect(signInTenants().map((t) => t.code).toSorted()).toEqual(['ORG', 'ORG_TRANSPORTES', 'UNILOG']);
  });
});
