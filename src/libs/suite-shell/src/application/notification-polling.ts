import type { NetworkSettings } from '@suite/contracts';

/** Cada cuánto se consulta la cuenta de no leídas (anexo A1 §10.7); con `?sim=notif-nueva` baja a 5 s para ver la llegada. */
export const NOTIFICATIONS_POLL_MS = 60_000;
export const NOTIFICATIONS_FAST_POLL_MS = 5_000;

export function notificationsPollMs(settings: NetworkSettings): number {
  return settings.suite.notifications === 'nueva' ? NOTIFICATIONS_FAST_POLL_MS : NOTIFICATIONS_POLL_MS;
}

/** Cuántas notificaciones recientes se leen en cada sondeo para detectar llegadas. */
export const RECENT_NOTIFICATIONS = 10;
