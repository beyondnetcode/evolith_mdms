import { describe, expect, it } from 'vitest';
import { defaultTenantOf, isTenantCode, normalizeTenantCode } from './tenants.ts';

describe('inquilinos del inicio de sesión (D-029)', () => {
  it('normaliza el código como lo compara el servidor', () => {
    expect(normalizeTenantCode('  org_transportes ')).toBe('ORG_TRANSPORTES');
  });

  it.each([['ORG', true], ['ORG_TRANSPORTES', true], ['organizacion', false], ['UNI MAR', false], ['', false], [42, false]])(
    'isTenantCode(%j) es %s',
    (value, expected) => {
      expect(isTenantCode(value)).toBe(expected);
    },
  );

  it('abre con ORG si se ofrece; si no, con el primero; sin lista, vacío', () => {
    const unilog = { code: 'UNILOG', name: 'Unilog S.A.C.' };
    expect(defaultTenantOf([unilog, { code: 'ORG', name: 'Organización S.A.' }])).toBe('ORG');
    expect(defaultTenantOf([unilog])).toBe('UNILOG');
    expect(defaultTenantOf([])).toBe('');
  });
});
