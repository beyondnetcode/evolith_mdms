/**
 * Fechas civiles `AAAA-MM-DD` del selector de fecha: sin zona horaria, todo en UTC para que un día
 * no se corra por el desfase de Lima (una ETD no es un instante).
 */
export interface CivilDay {
  readonly year: number;
  /** 1 a 12. */
  readonly month: number;
  readonly day: number;
}

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function readIsoDate(value: string): CivilDay | null {
  const parts = ISO_PATTERN.exec(value);
  if (parts === null) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? { year, month, day } : null;
}

export function toIsoDate({ year, month, day }: CivilDay): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** `2026-10-18` → `18/10/2026`; lo que no es una fecha válida se muestra tal como se escribió. */
export function displayDate(value: string): string {
  const date = readIsoDate(value);
  return date === null ? value : `${String(date.day).padStart(2, '0')}/${String(date.month).padStart(2, '0')}/${date.year}`;
}

/** Interpreta lo escrito como `dd/mm/aaaa`; si no es una fecha válida devuelve el texto tal cual. */
export function parseTypedDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  const formatted = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter((p) => p !== '').join('/');
  if (digits.length < 8) return formatted;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const date = readIsoDate(toIsoDate({ year, month, day }));
  return date === null ? formatted : toIsoDate(date);
}

export function addDays(date: CivilDay, days: number): CivilDay {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function addMonths(date: CivilDay, months: number): CivilDay {
  const d = new Date(Date.UTC(date.year, date.month - 1 + months, 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: Math.min(date.day, last) };
}

/** Lunes = 0 … domingo = 6. */
export function dayOfWeek(date: CivilDay): number {
  return (new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() + 6) % 7;
}

export function daysOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function sameDay(a: CivilDay | null, b: CivilDay | null): boolean {
  return a !== null && b !== null && a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Hoy en Lima. */
export function todayInLima(): CivilDay {
  const [year = '1970', month = '01', day = '01'] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()).split('-');
  return { year: Number(year), month: Number(month), day: Number(day) };
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** Interpreta lo escrito como `hh:mm` de 24 h; si no es una hora válida devuelve el texto formateado. */
export function parseTypedTime(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  const formatted = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
  return formatted;
}

/** Fecha (`AAAA-MM-DD`) y hora (`hh:mm`) de Lima en este instante (UTC-5 fijo, sin horario de verano). */
export function nowInLima(now: Date = new Date()): { readonly date: string; readonly time: string } {
  const lima = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString();
  return { date: lima.slice(0, 10), time: lima.slice(11, 16) };
}

/** La fecha civil (`AAAA-MM-DD`) de Lima `days` días antes de `now`: el mínimo de una fecha al modificar. */
export function daysAgoInLima(days: number, now: Date = new Date()): string {
  return nowInLima(new Date(now.getTime() - days * 24 * 60 * 60 * 1000)).date;
}
