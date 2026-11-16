/**
 * Contrato mock de notificaciones de la suite (anexo A1 de UX-SIL-001, §10.7). Es de la SUITE y no
 * de SIL: SIL es su primer productor. NO es el de NMS ni el de ningún servicio real (G-186): se
 * sustituye cuando exista. Una notificación informa y enlaza; no crea tarea (D-019).
 */
export const NOTIFICATION_TYPES = [
  'OBSERVACION_REGISTRADA',
  'CREDITO_ROJO',
  'CREDITO_VERDE',
  'ORDEN_VERSION_NUEVA',
  'ORDEN_EMITIDA',
  'ENTREGA_FALLIDA',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export type NotificationSeverity = 'ATENCION' | 'ERROR' | 'EXITO' | 'INFO';

/** La gravedad la determina el tipo (§10.4). */
export const SEVERITY_BY_TYPE: Readonly<Record<NotificationType, NotificationSeverity>> = {
  OBSERVACION_REGISTRADA: 'ATENCION',
  CREDITO_ROJO: 'ERROR',
  CREDITO_VERDE: 'EXITO',
  ORDEN_VERSION_NUEVA: 'INFO',
  ORDEN_EMITIDA: 'INFO',
  ENTREGA_FALLIDA: 'ERROR',
};

/** Pantalla de SIL a la que lleva la notificación: nombra pantalla y solicitud, nunca una URL. */
export interface NotificationDestination {
  readonly screen: 'P-04' | 'P-06';
  readonly operationId: string;
}

interface NotificationBase {
  readonly version: 1;
  readonly id: string;
  readonly system: 'SIL';
  readonly severity: NotificationSeverity;
  /** Instante ISO 8601 con desfase de Lima (`-05:00`). */
  readonly createdAt: string;
  /** Por usuario: lo que ESTE usuario marcó (SU-41). */
  readonly read: boolean;
  readonly destination: NotificationDestination;
}

/**
 * El gateway entrega PARÁMETROS, no texto: el título y el detalle los compone `notificationText`
 * con la tabla del §10.4, que así se prueba una vez. Cada tipo lleva los parámetros que su texto necesita.
 */
export type Notification = NotificationBase &
  (
    | { readonly type: 'OBSERVACION_REGISTRADA'; readonly params: { readonly operationId: string; readonly openObservations: number } }
    | { readonly type: 'CREDITO_ROJO'; readonly params: { readonly operationId: string } }
    | { readonly type: 'CREDITO_VERDE'; readonly params: { readonly operationId: string } }
    | { readonly type: 'ORDEN_VERSION_NUEVA'; readonly params: { readonly operationId: string; readonly version: number } }
    | { readonly type: 'ORDEN_EMITIDA'; readonly params: { readonly operationId: string } }
    | {
        readonly type: 'ENTREGA_FALLIDA';
        readonly params: { readonly operationId: string; readonly container: string; readonly correlationCode: string };
      }
  );

export interface NotificationText {
  readonly title: string;
  readonly detail: string;
}

/** Título y detalle exactos del anexo A1 §10.4. Ninguno nombra a la persona que actuó ni promete recepción en el TMS. */
export function notificationText(notification: Notification): NotificationText {
  switch (notification.type) {
    case 'OBSERVACION_REGISTRADA': {
      const { operationId, openObservations: n } = notification.params;
      return {
        title: `Solicitud ${operationId} observada`,
        detail:
          n === 1 ? 'Tiene 1 observación abierta. Revísala en la validación.' : `Tiene ${n} observaciones abiertas. Revísalas en la validación.`,
      };
    }
    case 'CREDITO_ROJO':
      return {
        title: `Crédito en Rojo en la solicitud ${notification.params.operationId}`,
        detail: 'Crédito en Rojo: no hay orden de transporte. Revisa el semáforo en la validación.',
      };
    case 'CREDITO_VERDE':
      return {
        title: `Crédito habilitado en la solicitud ${notification.params.operationId}`,
        detail: 'El semáforo quedó en Verde. La orden se emite por contenedor.',
      };
    case 'ORDEN_VERSION_NUEVA': {
      const { operationId, version } = notification.params;
      return {
        title: `Nueva versión de la orden de ${operationId}`,
        detail: `La orden pasó a la v${version}. Compárala con la v${version - 1} en la orden de servicio.`,
      };
    }
    case 'ORDEN_EMITIDA':
      return {
        title: `Orden de ${notification.params.operationId} emitida`,
        detail: 'SIL emitió la orden de todos los contenedores. No confirma que el TMS la recibió.',
      };
    case 'ENTREGA_FALLIDA': {
      const { container, correlationCode } = notification.params;
      return {
        title: `Entrega fallida: contenedor ${container}`,
        detail: `No se pudo entregar la orden de ${container} al canal de integración. Comunica este código a soporte: ${correlationCode}.`,
      };
    }
  }
}

/**
 * Visibilidad por rol (§10.4, supuesto SU-40, G-187). Dos condiciones a la vez: el rol puede abrir el
 * destino y el evento cambia algo que el rol opera o sigue. Los roles son los cuatro de SIL (D-018),
 * como texto: la suite no depende del contrato de SIL.
 */
const TYPES_BY_ROLE: Readonly<Record<string, readonly NotificationType[]>> = {
  CUSTOMER_SERVICE: NOTIFICATION_TYPES,
  ASISTENTE_TRANSPORTE: ['CREDITO_ROJO', 'CREDITO_VERDE', 'ORDEN_VERSION_NUEVA', 'ORDEN_EMITIDA', 'ENTREGA_FALLIDA'],
  COORDINADOR_TRANSPORTE: ['CREDITO_ROJO', 'CREDITO_VERDE', 'ORDEN_VERSION_NUEVA', 'ORDEN_EMITIDA'],
  JEFATURA: ['OBSERVACION_REGISTRADA', 'CREDITO_ROJO'],
};

/** Un rol desconocido no ve nada: falla cerrado. Ocultar no es controlar: el servidor real vuelve a filtrar. */
export function visibleTypesFor(role: string): readonly NotificationType[] {
  return TYPES_BY_ROLE[role] ?? [];
}

export function isVisibleForRole(type: NotificationType, role: string): boolean {
  return visibleTypesFor(role).includes(type);
}

/** Ventana de lectura (SU-42): las notificaciones de los últimos 90 días. */
export const NOTIFICATIONS_WINDOW_DAYS = 90;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

export interface NotificationFilter {
  readonly unreadOnly?: boolean;
  readonly types?: readonly NotificationType[];
  /** Opaco: el que devolvió la página anterior. */
  readonly cursor?: string;
  /** 1 a 50; 20 por defecto. */
  readonly limit?: number;
}

export interface NotificationPage {
  readonly items: readonly Notification[];
  readonly nextCursor: string | null;
  /** Total de no leídas del perfil, sin importar los filtros. */
  readonly unread: number;
}

export type MarkReadOutcome =
  | { readonly type: 'ok'; readonly unread: number }
  | { readonly type: 'not-found' }
  | { readonly type: 'error'; readonly correlation: string };

export type MarkAllReadOutcome =
  | { readonly type: 'ok'; readonly markedCount: number; readonly unread: 0 }
  | { readonly type: 'error'; readonly correlation: string };

/**
 * El estado de lectura guardado por el mock es entrada no confiable (ADR-0109 P-FE-06): se valida y,
 * ante cualquier incoherencia, se descarta entero (todo vuelve a «no leída»).
 */
export function parseReadState(raw: string | null): ReadonlySet<string> {
  if (raw === null) return new Set();
  try {
    return readIdsOf(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id !== '' && id.length <= 64;
}

function readIdsOf(value: unknown): ReadonlySet<string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return new Set();
  const storedValue = value as Record<string, unknown>;
  const readIds = storedValue.leidas;
  if (storedValue.version !== 1 || !Array.isArray(readIds) || readIds.length > 1000) return new Set();
  const ids: unknown[] = readIds;
  return ids.every(isValidId) ? new Set(ids) : new Set();
}

export function serializeReadState(ids: ReadonlySet<string>): string {
  return JSON.stringify({ version: 1, leidas: [...ids].toSorted() });
}

/** Clave del mock donde vive el estado de lectura del usuario (recomendación del anexo A1 §10.7). */
export function readStateKey(userId: string): string {
  return `organizacion.notificaciones.${userId}`;
}

/** Ruta de SIL de un destino, o `null` si el identificador no tiene la forma de una operación (sin redirector abierto). */
export function destinationPath(destination: NotificationDestination): string | null {
  if (!/^OP-[A-Z]{3}-\d{2}-\d{6}$/.test(destination.operationId)) return null;
  const id = encodeURIComponent(destination.operationId);
  return destination.screen === 'P-04' ? `/solicitudes/${id}/validacion` : `/solicitudes/${id}/orden`;
}
