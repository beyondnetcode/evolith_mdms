import { formatDate } from '@sil/ui';
import type { Notification } from '@suite/contracts';

/**
 * Agrupación por fecha (anexo A1 §10.3): «Hoy», «Ayer» y después `dd/mm/aaaa`, siempre por el día de
 * Lima (UTC-5, sin horario de verano) y no por el del navegador.
 */
const TIME_ZONE = 'America/Lima';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const limaDay = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const limaTime = new Intl.DateTimeFormat('es-PE', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** `AAAA-MM-DD` del día de Lima de un instante. */
export function dayKey(instantMs: number): string {
  return limaDay.format(new Date(instantMs));
}

export function dayLabel(instant: string, nowMs: number): string {
  const day = dayKey(Date.parse(instant));
  if (day === dayKey(nowMs)) return 'Hoy';
  if (day === dayKey(nowMs - MS_PER_DAY)) return 'Ayer';
  return formatDate(instant);
}

/** `hh:mm` de Lima, para `<time>`. */
export function shortTime(instant: string): string {
  return limaTime.format(new Date(instant));
}

export interface NotificationGroup {
  readonly key: string;
  readonly label: string;
  readonly items: readonly Notification[];
}

/** Agrupa conservando el orden recibido (más reciente arriba): cada día es un grupo contiguo. */
export function groupByDate(items: readonly Notification[], nowMs: number): NotificationGroup[] {
  const groups: Array<{ key: string; label: string; items: Notification[] }> = [];
  for (const item of items) {
    const key = dayKey(Date.parse(item.createdAt));
    const current = groups.at(-1);
    if (current?.key === key) current.items.push(item);
    else groups.push({ key, label: dayLabel(item.createdAt, nowMs), items: [item] });
  }
  return groups;
}
