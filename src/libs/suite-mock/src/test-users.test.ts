import { describe, expect, it } from 'vitest';
import { signInTenants } from './tenants.ts';
import { TEST_USERS, caseProfileId, findTestUserIn } from './test-users.ts';

describe('usuarios de prueba por inquilino (D-029)', () => {
  it('cada inquilino tiene su variante de los siete casos, con las mismas concesiones', () => {
    const cases = TEST_USERS.filter((u) => u.tenant === 'ORG');
    for (const { code } of signInTenants()) {
      const own = TEST_USERS.filter((u) => u.tenant === code);
      expect(own.map((u) => u.caseOf), code).toEqual(cases.map((u) => u.id));
      for (const variant of own) {
        const base = cases.find((u) => u.id === variant.caseOf);
        expect(variant.grants, variant.id).toEqual(base?.grants);
        expect(variant.lockedFromSource, variant.id).toBe(base?.lockedFromSource);
      }
    }
  });

  it('los usuarios son únicos en todo el mock y tienen iniciales de dos letras', () => {
    expect(new Set(TEST_USERS.map((u) => u.id)).size).toBe(TEST_USERS.length);
    for (const u of TEST_USERS) expect(u.initials, u.id).toMatch(/^[A-Z]{2}$/);
  });

  it('fuera de su inquilino la cuenta no existe', () => {
    expect(findTestUserIn('UNILOG', 'sofia.ramos')?.fullName).toBe('Sofía Ramos');
    expect(findTestUserIn('ORG', 'sofia.ramos')).toBeUndefined();
  });

  it('el perfil de una variante apunta al de su caso; el de un caso, a sí mismo', () => {
    expect(caseProfileId('sofia.ramos:SIL:CALLAO')).toBe('ana.perez:SIL:CALLAO');
    expect(caseProfileId('ana.perez:SIL:CALLAO')).toBe('ana.perez:SIL:CALLAO');
    expect(caseProfileId('prueba.jefatura:SIL:PIURA')).toBe('prueba.jefatura:SIL:PIURA');
  });
});
