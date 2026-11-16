import type { NotificationSeverity, NotificationType } from '@suite/contracts';
import type { IconName } from '@sil/ui';

/** Textos exactos del anexo A1 §10 (campana, hoja, pantalla completa, estados y región en vivo). */
export const NOTIFICATION_TEXTS = {
  title: 'Notificaciones',
  markAllRead: 'Marcar todas como leídas',
  viewAll: 'Ver todas las notificaciones',
  loadPrevious: 'Cargar anteriores',
  footer: 'Se muestran las notificaciones de los últimos 90 días.',
  unread: 'No leída.',
  markRead: 'Marcar como leída',
  unreadFilter: 'No leídas',
  typeFilter: 'Tipo',
  clearFilters: 'Quitar filtros',
  showAllRead: 'Ver todas',
  loading: 'Cargando tus notificaciones',
  empty: { title: 'No tienes notificaciones.', supportText: 'Aquí aparecerán los avisos de SIL cuando lleguen.' },
  noUnread: 'No tienes notificaciones sin leer.',
  noMatches: 'Ninguna notificación coincide con los filtros.',
  error: 'No pudimos cargar tus notificaciones. Revisa tu conexión e inténtalo de nuevo.',
  markReadError: 'No se pudo marcar como leída. Inténtalo de nuevo.',
  markAllReadError: 'No se pudieron marcar las notificaciones. Inténtalo de nuevo.',
  back: 'Volver',
  more: 'Más',
} as const;

export function bellName(unreadCount: number | null): string {
  if (unreadCount === null) return 'Notificaciones';
  return unreadCount === 0 ? 'Notificaciones, ninguna sin leer' : `Notificaciones, ${unreadCount} sin leer`;
}

/** «{n} sin leer» del subtítulo de la hoja y de la pantalla. */
export function unreadText(unreadCount: number): string {
  return `${unreadCount} sin leer`;
}

/** Texto de «Marcar todas»: singular y plural (snackbar anunciada). */
export function markedText(markedCount: number): string {
  return markedCount === 1 ? 'Marcaste 1 notificación como leída.' : `Marcaste ${markedCount} notificaciones como leídas.`;
}

export function oneMarkedText(unreadCount: number): string {
  return `Notificación marcada como leída. Quedan ${unreadCount} sin leer.`;
}

export function arrivalText(titles: readonly string[]): string {
  return titles.length === 1 ? `Tienes una notificación nueva: ${titles[0] ?? ''}.` : `Tienes ${titles.length} notificaciones nuevas.`;
}

export function showNewText(n: number): string {
  return `Mostrar ${n} ${n === 1 ? 'nueva' : 'nuevas'}`;
}

export function loadedText(n: number): string {
  return `Se cargaron ${n} notificaciones más`;
}

/** Etiquetas del filtro «Tipo» (los nombres cortos de los seis tipos del §10.4). */
export const TYPE_LABEL: Readonly<Record<NotificationType, string>> = {
  OBSERVACION_REGISTRADA: 'Solicitud observada',
  CREDITO_ROJO: 'Crédito en Rojo',
  CREDITO_VERDE: 'Crédito habilitado',
  ORDEN_VERSION_NUEVA: 'Nueva versión de la orden',
  ORDEN_EMITIDA: 'Orden emitida',
  ENTREGA_FALLIDA: 'Entrega fallida',
};

/** Par de roles e icono de cada gravedad: el icono nunca es el único indicio, el título lo dice con palabras. */
export const SEVERITY_STYLE: Readonly<Record<NotificationSeverity, { readonly classes: string; readonly icon: IconName }>> = {
  ATENCION: { classes: 'bg-warning-container text-on-warning-container', icon: 'warning' },
  ERROR: { classes: 'bg-error-container text-on-error-container', icon: 'error' },
  EXITO: { classes: 'bg-success-container text-on-success-container', icon: 'check' },
  INFO: { classes: 'bg-primary-container text-on-primary-container', icon: 'info' },
};
