import { describe, expect, it } from 'vitest';
import { readNetworkSettings } from './network-settings.ts';
import type { SuiteSession } from './session.ts';
import { currentGrantedProfile, grantedProfiles, profileLabel, profileSiteText, profilesSummary, type SystemDescriptor } from './system-module.ts';

const SIL: SystemDescriptor = { code: 'SIL', roleLabel: (role) => ({ JEFATURA: 'Jefatura', CUSTOMER_SERVICE: 'Customer Service' })[role] ?? null };

const SESSION: SuiteSession = {
  version: 1,
  sessionId: 'mock-1',
  user: { id: 'carlos.vega', fullName: 'Carlos Vega', firstName: 'Carlos', initials: 'CV' },
  tenant: { code: 'ORG', name: 'Organización S.A.' },
  issuedAt: '2026-10-14T08:00:00-05:00',
  expiresAt: '2026-10-14T16:00:00-05:00',
  profiles: [
    { profileId: 'carlos.vega:SIL:CALLAO', system: 'SIL', role: 'JEFATURA', site: 'Callao' },
    { profileId: 'carlos.vega:SIL:PIURA', system: 'SIL', role: 'JEFATURA', site: 'Piura' },
    { profileId: 'carlos.vega:SIL:X', system: 'SIL', role: 'ADMIN', site: 'Callao' },
    { profileId: 'carlos.vega:DT:CALLAO', system: 'DT', role: 'Consulta', site: 'Callao' },
  ],
  currentProfileBySystem: { SIL: 'carlos.vega:SIL:PIURA' },
  currentSite: null,
};

describe('frontera suite ↔ sistema (D-026)', () => {
  it('solo concede los perfiles cuyo rol el sistema reconoce', () => {
    expect(grantedProfiles(SESSION, SIL).map((p) => p.profileId)).toEqual(['carlos.vega:SIL:CALLAO', 'carlos.vega:SIL:PIURA']);
  });

  it('el perfil vigente es el elegido o, si no es válido, el primero concedido', () => {
    expect(currentGrantedProfile(SESSION, SIL)?.site).toBe('Piura');
    expect(currentGrantedProfile({ ...SESSION, currentProfileBySystem: { SIL: 'carlos.vega:SIL:X' } }, SIL)?.site).toBe('Callao');
    expect(currentGrantedProfile({ ...SESSION, profiles: [] }, SIL)).toBeNull();
  });

  it('las etiquetas usan el rol del sistema y, sin descriptor, el texto tal cual', () => {
    const [callao, piura, , dt] = SESSION.profiles;
    expect(profileLabel(callao!, [SIL])).toBe('Jefatura · Callao');
    expect(profileLabel(dt!, [SIL])).toBe('Consulta · Callao');
    expect(profilesSummary([callao!, piura!], [SIL])).toBe('Jefatura · Callao, Piura');
  });
});

describe('ajustes de red (`?sim=`)', () => {
  it('un perfil sin sede se nombra «sin sede» en un sistema que no admite todas las sedes, y «Todas las sedes» en los demás (D-030)', () => {
    const silWithoutSite = { profileId: 'rosa.diaz:SIL:SIN-SEDE', system: 'SIL', role: 'CUSTOMER_SERVICE', site: null } as const;
    const dtOrgWide = { profileId: 'diego.salas:DT:SIN-SEDE', system: 'DT', role: 'Consulta', site: null } as const;
    expect(profileSiteText(silWithoutSite, [SIL])).toBe('sin sede');
    expect(profileSiteText(silWithoutSite, [{ ...SIL, acceptsAllSites: true }])).toBe('Todas las sedes');
    expect(profileLabel(dtOrgWide, [SIL])).toBe('Consulta · Todas las sedes');
    // Sin sede sigue concedido: la guarda lo bloquea con su motivo («sin sede», US-SIL-004 escenario 4).
    expect(grantedProfiles({ ...SESSION, profiles: [silWithoutSite] }, SIL)).toHaveLength(1);
  });

  it('lee la simulación de una lista cerrada; lo desconocido no simula nada', () => {
    expect(readNetworkSettings('?sim=lento').latencyMs).toBe(2500);
    expect(readNetworkSettings('?sim=vacio').mode).toBe('vacio');
    expect(readNetworkSettings('?sim=notif-nueva').suite.notifications).toBe('nueva');
    expect(readNetworkSettings('?sim=<script>')).toEqual(readNetworkSettings(''));
  });
});
