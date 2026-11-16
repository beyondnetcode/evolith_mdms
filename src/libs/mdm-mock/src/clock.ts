/**
 * Fechas del mock. «Vigente» se calcula contra la fecha de hoy en `America/Lima` (UTC-5 sin horario de verano;
 * supuesto G-575) y las vigencias son intervalos cerrados `[desde, hasta]` con `hasta` nulo indefinido.
 */

const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Fecha civil de Lima (`aaaa-mm-dd`) del instante dado. */
export function limaDate(epochMs: number): string {
  return new Date(epochMs - LIMA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Instante con milisegundos y desfase explícito, como el contrato (`2026-10-24T15:04:05.123+00:00`). */
export function isoInstant(epochMs: number): string {
  return new Date(epochMs).toISOString().replace('Z', '+00:00');
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** ¿`today` cae dentro de `[from, to]`? Las fechas ISO se comparan como texto. */
export function isWithin(from: string, to: string | null, today: string): boolean {
  return from <= today && (to === null || today <= to);
}

/** ¿Se cruzan dos vigencias cerradas? `null` en «hasta» es indefinido. */
export function overlaps(a: { readonly from: string; readonly to: string | null }, b: { readonly from: string; readonly to: string | null }): boolean {
  return (b.to === null || a.from <= b.to) && (a.to === null || b.from <= a.to);
}

/** Reloj del mock: la fecha de Lima y el instante de cada escritura. Inyectable para las pruebas. */
export interface MockClock {
  readonly today: () => string;
  readonly now: () => string;
}

export const systemClock: MockClock = {
  today: () => limaDate(Date.now()),
  now: () => isoInstant(Date.now()),
};

/** Reloj fijo: los datos y las pruebas no cambian con el día. */
export function fixedClock(today: string): MockClock {
  return { today: () => today, now: () => `${today}T15:00:00.000+00:00` };
}
