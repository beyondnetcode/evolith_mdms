import type { Notification } from '@suite/contracts';
import { describe, expect, it } from 'vitest';
import { groupByDate, dayKey, dayLabel, shortTime } from './group-by-date.ts';

function note(id: string, createdAt: string): Notification {
  return {
    version: 1,
    id,
    system: 'SIL',
    type: 'CREDITO_ROJO',
    severity: 'ERROR',
    createdAt,
    read: false,
    params: { operationId: 'OP-CAL-26-000409' },
    destination: { screen: 'P-04', operationId: 'OP-CAL-26-000409' },
  };
}

// 15/10/2026 10:30 en Lima (UTC-5).
const NOW = Date.parse('2026-10-15T10:30:00-05:00');

describe('agrupación por fecha en hora de Lima', () => {
  it('«Hoy», «Ayer» y después dd/mm/aaaa', () => {
    expect(dayLabel('2026-10-15T08:00:00-05:00', NOW)).toBe('Hoy');
    expect(dayLabel('2026-10-14T23:59:00-05:00', NOW)).toBe('Ayer');
    expect(dayLabel('2026-10-13T16:45:00-05:00', NOW)).toBe('13/10/2026');
  });

  it('el día es el de Lima, no el del instante en UTC', () => {
    // 21:30 en Lima es ya el día siguiente en UTC: sigue siendo «Hoy» en Lima.
    expect(dayKey(Date.parse('2026-10-15T21:30:00-05:00'))).toBe('2026-10-15');
    expect(dayLabel('2026-10-15T21:30:00-05:00', NOW)).toBe('Hoy');
    // 00:10 UTC del 16 es 19:10 del 15 en Lima.
    expect(dayLabel('2026-10-16T00:10:00Z', NOW)).toBe('Hoy');
  });

  it('la hora se muestra hh:mm de Lima', () => {
    expect(shortTime('2026-10-15T10:42:00-05:00')).toBe('10:42');
    expect(shortTime('2026-10-15T15:42:00Z')).toBe('10:42');
  });

  it('agrupa por día conservando el orden recibido', () => {
    const groups = groupByDate(
      [note('a', '2026-10-15T10:42:00-05:00'), note('b', '2026-10-15T09:15:00-05:00'), note('c', '2026-10-14T17:05:00-05:00'), note('d', '2026-10-09T09:00:00-05:00')],
      NOW,
    );
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['Hoy', ['a', 'b']],
      ['Ayer', ['c']],
      ['09/10/2026', ['d']],
    ]);
  });
});
