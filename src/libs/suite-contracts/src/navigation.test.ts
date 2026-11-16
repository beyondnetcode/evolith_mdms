import { describe, expect, it } from 'vitest';
import { isDestinationActive, isDestinationRoot, type NavDestination } from './navigation.ts';

const ORGANIZATIONS: NavDestination = { path: '/mdm/organizaciones', label: 'Organizaciones', icon: 'domain' };
const REQUESTS: NavDestination = { path: '/solicitudes', label: 'Expedientes', icon: 'list_alt', matchPrefixes: ['/expedientes'] };

describe('destino activo de la navegación local (ADR-0245 D4.1)', () => {
  it.each(['/mdm/organizaciones', '/mdm/organizaciones/', '/mdm/organizaciones/nueva', '/mdm/organizaciones/0b6f-1'])(
    '«Organizaciones» está activo en %s',
    (pathname) => {
      expect(isDestinationActive(ORGANIZATIONS, pathname)).toBe(true);
    },
  );

  it.each(['/mdm', '/mdm/organizacionesx', '/mdm/org', '/solicitudes'])('«Organizaciones» no está activo en %s', (pathname) => {
    expect(isDestinationActive(ORGANIZATIONS, pathname)).toBe(false);
  });

  it('también cuenta las raíces declaradas en `matchPrefixes`', () => {
    expect(isDestinationActive(REQUESTS, '/expedientes/SIL-00001')).toBe(true);
    expect(isDestinationActive(REQUESTS, '/expedientesx')).toBe(false);
  });

  it('una pantalla de primer nivel es exactamente la dirección de un destino', () => {
    expect(isDestinationRoot([ORGANIZATIONS, REQUESTS], '/mdm/organizaciones')).toBe(true);
    expect(isDestinationRoot([ORGANIZATIONS, REQUESTS], '/solicitudes/')).toBe(true);
    expect(isDestinationRoot([ORGANIZATIONS, REQUESTS], '/mdm/organizaciones/nueva')).toBe(false);
    expect(isDestinationRoot([], '/solicitudes')).toBe(false);
  });
});
