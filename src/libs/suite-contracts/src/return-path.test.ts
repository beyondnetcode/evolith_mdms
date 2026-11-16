import { describe, expect, it } from 'vitest';
import { safeReturnPath } from './return-path.ts';

describe('rutaVolverSegura (sin redirector abierto, SU-35 y SU-36)', () => {
  it.each([
    ['/solicitudes', '/solicitudes'],
    ['/solicitudes/OP-CAL-26-000412/resumen?x=1#a', '/solicitudes/OP-CAL-26-000412/resumen?x=1#a'],
    ['/', '/'],
  ])('acepta la ruta relativa %s', (entry, expected) => {
    expect(safeReturnPath(entry)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    'solicitudes',
    '//evil.example',
    '/\\evil.example',
    'https://evil.example',
    'javascript:alert(1)',
    '/ruta\nsalto',
    '/ruta\\otra',
    '/acceso',
    '/acceso?volver=/solicitudes',
    `/${'a'.repeat(2100)}`,
  ])('descarta %j', (entry) => {
    expect(safeReturnPath(entry)).toBeNull();
  });
});
