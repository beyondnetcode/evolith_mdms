import { describe, expect, it } from 'vitest';
import { canChooseSite, initialSite, parseSession, parseRawSession, currentProfileOf, profilesInSite, profilesOf, sitesOf, type SuiteSession } from './session.ts';

const VALID: SuiteSession = {
  version: 1,
  sessionId: 'mock-1',
  user: { id: 'carlos.vega', fullName: 'Carlos Vega', firstName: 'Carlos', initials: 'CV' },
  tenant: { code: 'ORG', name: 'Organización S.A.' },
  issuedAt: '2026-10-14T08:00:00-05:00',
  expiresAt: '2026-10-14T16:00:00-05:00',
  profiles: [
    { profileId: 'carlos.vega:SIL:CALLAO', system: 'SIL', role: 'NEGOCIO', site: 'Callao' },
    { profileId: 'carlos.vega:SIL:PIURA', system: 'SIL', role: 'NEGOCIO', site: 'Piura' },
    { profileId: 'carlos.vega:DT:CALLAO', system: 'DT', role: 'Consulta', site: 'Callao' },
  ],
  currentProfileBySystem: { SIL: 'carlos.vega:SIL:PIURA' },
  currentSite: null,
};

describe('interpretarSesion (lo guardado es entrada no confiable)', () => {
  it('acepta una sesión coherente', () => {
    expect(parseSession(structuredClone(VALID))).toEqual(VALID);
  });

  it('acepta un perfil sin sede: UMS puede no tenerla registrada (US-SIL-004 escenario 4)', () => {
    const withoutSite = { ...VALID, profiles: [{ ...VALID.profiles[0], site: null }], currentProfileBySystem: {} };
    expect(parseSession(structuredClone(withoutSite))?.profiles[0]?.site).toBeNull();
  });

  it.each([
    ['sin versión', { ...VALID, version: undefined }],
    ['versión futura', { ...VALID, version: 2 }],
    ['sin identificador', { ...VALID, sessionId: '' }],
    ['usuario sin iniciales de 2 letras', { ...VALID, user: { ...VALID.user, initials: 'C' } }],
    ['sin inquilino', { ...VALID, tenant: undefined }],
    ['inquilino con código inválido', { ...VALID, tenant: { code: 'uni mar', name: 'Organización S.A.' } }],
    ['inquilino sin nombre', { ...VALID, tenant: { code: 'ORG', name: '' } }],
    ['instante inválido', { ...VALID, expiresAt: 'mañana' }],
    ['sede desconocida', { ...VALID, profiles: [{ ...VALID.profiles[0], site: 'Paita' }] }],
    ['sistema fuera del catálogo', { ...VALID, profiles: [{ ...VALID.profiles[0], system: 'TMS' }] }],
    ['perfiles que no es lista', { ...VALID, profiles: {} }],
    ['perfil vigente que la sesión no concede', { ...VALID, currentProfileBySystem: { SIL: 'otra.persona:SIL:CALLAO' } }],
    ['sin sede de trabajo', { ...VALID, currentSite: undefined }],
    ['sede de trabajo que ningún perfil concede', { ...VALID, currentSite: 'Piura', profiles: VALID.profiles.filter((p) => p.site !== 'Piura') }],
    ['sede de trabajo desconocida', { ...VALID, currentSite: 'Paita' }],
    ['perfil vigente de otro sistema', { ...VALID, currentProfileBySystem: { SIL: 'carlos.vega:DT:CALLAO' } }],
  ])('descarta la sesión %s', (_name, value) => {
    expect(parseSession(value)).toBeNull();
  });

  it.each([null, undefined, 42, 'texto', [], true])('descarta %j', (value) => {
    expect(parseSession(value)).toBeNull();
  });

  it('el JSON roto o ausente es «sin sesión»', () => {
    expect(parseRawSession(null)).toBeNull();
    expect(parseRawSession('{no es json')).toBeNull();
    expect(parseRawSession(JSON.stringify(VALID))).toEqual(VALID);
  });
});

describe('perfiles de un sistema', () => {
  it('lista solo los perfiles del sistema pedido', () => {
    expect(profilesOf(VALID, 'SIL')).toHaveLength(2);
    expect(profilesOf(VALID, 'CMS')).toHaveLength(0);
  });

  it('el perfil vigente es el elegido o, a falta de él, el primero concedido', () => {
    expect(currentProfileOf(VALID, 'SIL')?.site).toBe('Piura');
    expect(currentProfileOf({ ...VALID, currentProfileBySystem: {} }, 'SIL')?.site).toBe('Callao');
    expect(currentProfileOf(VALID, 'CMS')).toBeNull();
  });
});

describe('sede de trabajo (D-030)', () => {
  const ORG_WIDE = { profileId: 'carlos.vega:DT:TODAS', system: 'DT', role: 'Consulta', site: null } as const;

  it('acepta perfiles de todas las sedes (OrgWide de UMS) y no los cuenta como sede', () => {
    const session = { ...VALID, profiles: [...VALID.profiles, ORG_WIDE] };
    expect(parseSession(structuredClone(session))).toEqual(session);
    expect(sitesOf(session)).toEqual(['Callao', 'Piura']);
  });

  it('se elige solo con más de una sede; la inicial es la única, o todas', () => {
    expect(canChooseSite(VALID)).toBe(true);
    expect(canChooseSite({ profiles: [VALID.profiles[0]!, ORG_WIDE] })).toBe(false);
    expect(initialSite([VALID.profiles[0]!, ORG_WIDE])).toBe('Callao');
    expect(initialSite(VALID.profiles)).toBeNull();
    expect(initialSite([ORG_WIDE])).toBeNull();
  });

  it('en una sede valen sus perfiles y los de todas las sedes; sin sede, todos', () => {
    const profiles = [...VALID.profiles, ORG_WIDE];
    expect(profilesInSite(profiles, 'Piura').map((p) => p.profileId)).toEqual(['carlos.vega:SIL:PIURA', 'carlos.vega:DT:TODAS']);
    expect(profilesInSite(profiles, null)).toHaveLength(4);
  });
});
