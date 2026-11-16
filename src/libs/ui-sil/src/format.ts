/**
 * Fechas y horas de la interfaz: siempre en hora de Lima (UTC-5, RNF-013), 24 h y `es-PE`,
 * con el formateo de la plataforma (ADR-0109 §2.10).
 */
const TIME_ZONE = 'America/Lima';
const LOCALE = 'es-PE';

const fullDate = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit' });
const time = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** `2026-10-18` → `18/10/2026`. Una fecha civil no se desplaza por zona horaria. */
export function formatCivilDate(date: string): string {
  const [year, month, day] = date.split('-');
  return year !== undefined && month !== undefined && day !== undefined ? `${day}/${month}/${year}` : date;
}

/** Instante → `13/10/2026`. */
export function formatDate(instant: string): string {
  return fullDate.format(new Date(instant));
}

/** Instante → `13/10 09:40` (columna «Actualizada»). */
export function formatShortDateTime(instant: string): string {
  const date = new Date(instant);
  return `${shortDate.format(date)} ${time.format(date)}`;
}

const timeWithSeconds = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

/** Instante → `13/10/2026 09:12:03` (bitácora: la hora del servidor lleva segundos). */
export function formatDateTimeWithSeconds(instant: string): string {
  const date = new Date(instant);
  return `${fullDate.format(date)} ${timeWithSeconds.format(date)}`;
}

/** Instante → `09:12:03`. */
export function formatTimeWithSeconds(instant: string): string {
  return timeWithSeconds.format(new Date(instant));
}

/** Instante → `13/10/2026 09:12`. */
export function formatDateTime(instant: string): string {
  const date = new Date(instant);
  return `${fullDate.format(date)} ${time.format(date)}`;
}

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * Instante → «hoy 09:40», «ayer 22:50» y, desde el segundo día, `13/10 09:40` (R-13 del anexo A1 §12). Lo «hoy» y
 * lo «ayer» se deciden por el día CIVIL de Lima, no por las últimas 24 horas. `now` se inyecta: sin reloj implícito.
 */
export function formatRelativeDateTime(instant: string, now: Date): string {
  const date = new Date(instant);
  const day = dayKey.format(date);
  if (day === dayKey.format(now)) return `hoy ${time.format(date)}`;
  if (day === dayKey.format(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return `ayer ${time.format(date)}`;
  return `${shortDate.format(date)} ${time.format(date)}`;
}

/** Antigüedad de una lectura: «ahora», «hace 2 min», «hace 3 h». `elapsedMs` se calcula fuera, con un reloj inyectado. */
export function formatAge(elapsedMs: number): string {
  const minutes = Math.floor(Math.max(elapsedMs, 0) / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.floor(minutes / 60)} h`;
}
