import {
  SEVERITY_BY_TYPE,
  MAX_LIMIT,
  DEFAULT_LIMIT,
  NOTIFICATIONS_WINDOW_DAYS,
  isVisibleForRole,
  type Notification,
  type NotificationPage,
  type NotificationFilter,
  type NotificationType,
} from '@suite/contracts';

/**
 * Datos de ejemplo de notificaciones (anexo A1 §10.7). SEMILLA DETERMINISTA relativa al reloj del mock
 * (hoy, ayer, días anteriores): no se persiste. Lo único que se guarda es el estado de lectura por
 * usuario. SUPUESTO (G-186): las acciones de P-04, P-05 y P-06 NO generan notificaciones; el anexo las
 * trata como acción propia (snackbar y aviso en línea, §10.2) y el origen real (NMS) no existe, así que
 * en el mock no hay productor. Los `operationId` y los códigos salen de los escenarios de `@sil/mock`
 * para que cada aviso lleve a una pantalla que cuenta lo mismo.
 */

const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Día civil de Lima de un instante, como `AAAA-MM-DD`, desplazado `dias` hacia atrás. */
function limaDay(nowMs: number, days: number): string {
  return new Date(nowMs - LIMA_OFFSET_MS - days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Instante ISO con desfase de Lima de un instante en ms. */
function limaIso(ms: number): string {
  return `${new Date(ms - LIMA_OFFSET_MS).toISOString().slice(0, 19)}-05:00`;
}

/**
 * `instante(ahora, 0, '10:42')` = hoy a las 10:42 de Lima; `1` = ayer. Una notificación no puede ser del
 * futuro: si la hora de hoy más tardía de la semilla aún no llegó, las de hoy se corren todas hacia atrás lo mismo.
 */
function instant(nowMs: number, days: number, time: string): string {
  const exact = Date.parse(`${limaDay(nowMs, days)}T${time}:00-05:00`);
  if (days !== 0) return limaIso(exact);
  const delay = Math.max(Date.parse(`${limaDay(nowMs, 0)}T10:42:00-05:00`) - nowMs, 0);
  return limaIso(exact - Math.ceil(delay / 60_000) * 60_000);
}

/** Notificación sin el estado de lectura, que es del usuario y no de la semilla. */
export type NotificationSeed = DistributiveOmit<Notification, 'read'>;
type DistributiveOmit<T, K extends keyof Notification> = T extends unknown ? Omit<T, K> : never;

/** Perfil de SIL (`profileId` de la sesión) y su rol: el filtro por rol sale de aquí, no de la semilla. */
export interface ProfileSeed {
  readonly role: string;
  readonly notifications: readonly NotificationSeed[];
}

const base = { version: 1, system: 'SIL' } as const;
// Contenedores con el número y el código que muestran P-06 de OP-CAL-26-000399 y OP-CAL-26-000360. Son los
// que genera `containerNumber` de `@sil/mock` (índices 31 y 62): se repiten aquí para que el mock de la suite
// no dependa del de SIL.
const DELIVERY_399 = { container: 'TGHU 345489-1', correlationCode: 'COR-7F3A-91B2' } as const;
const DELIVERY_360 = { container: 'HLXU 590978-2', correlationCode: '7F3C-21AB' } as const;

function destinationP04(operationId: string) {
  return { screen: 'P-04', operationId: operationId } as const;
}
function destinationP06(operationId: string) {
  return { screen: 'P-06', operationId: operationId } as const;
}

function observation(id: string, operationId: string, n: number, createdAt: string): NotificationSeed {
  return { ...base, id, type: 'OBSERVACION_REGISTRADA', severity: SEVERITY_BY_TYPE.OBSERVACION_REGISTRADA, createdAt: createdAt, params: { operationId: operationId, openObservations: n }, destination: destinationP04(operationId) };
}
function red(id: string, operationId: string, createdAt: string): NotificationSeed {
  return { ...base, id, type: 'CREDITO_ROJO', severity: SEVERITY_BY_TYPE.CREDITO_ROJO, createdAt: createdAt, params: { operationId: operationId }, destination: destinationP04(operationId) };
}
function green(id: string, operationId: string, createdAt: string): NotificationSeed {
  return { ...base, id, type: 'CREDITO_VERDE', severity: SEVERITY_BY_TYPE.CREDITO_VERDE, createdAt: createdAt, params: { operationId: operationId }, destination: destinationP04(operationId) };
}
function version(id: string, operationId: string, v: number, createdAt: string): NotificationSeed {
  return { ...base, id, type: 'ORDEN_VERSION_NUEVA', severity: SEVERITY_BY_TYPE.ORDEN_VERSION_NUEVA, createdAt: createdAt, params: { operationId: operationId, version: v }, destination: destinationP06(operationId) };
}
function issued(id: string, operationId: string, createdAt: string): NotificationSeed {
  return { ...base, id, type: 'ORDEN_EMITIDA', severity: SEVERITY_BY_TYPE.ORDEN_EMITIDA, createdAt: createdAt, params: { operationId: operationId }, destination: destinationP06(operationId) };
}
function failed(id: string, operationId: string, delivery: { readonly container: string; readonly correlationCode: string }, createdAt: string): NotificationSeed {
  return { ...base, id, type: 'ENTREGA_FALLIDA', severity: SEVERITY_BY_TYPE.ENTREGA_FALLIDA, createdAt: createdAt, params: { operationId: operationId, ...delivery }, destination: destinationP06(operationId) };
}

/** Qué notificaciones están ya leídas en la semilla de cada perfil (el resto llega como «no leída»). */
export function seedsByProfile(nowMs: number): Readonly<Record<string, ProfileSeed>> {
  const t = (days: number, time: string): string => instant(nowMs, days, time);
  return {
    // Los seis tipos, tres grupos de fecha, leídas y no leídas: insignia «3».
    'ana.perez:SIL:CALLAO': {
      role: 'CUSTOMER_SERVICE',
      notifications: [
        failed('nt-ana-01', 'OP-CAL-26-000399', DELIVERY_399, t(0, '10:42')),
        observation('nt-ana-02', 'OP-CAL-26-000394', 1, t(0, '09:15')),
        green('nt-ana-03', 'OP-CAL-26-000405', t(0, '08:30')),
        issued('nt-ana-04', 'OP-CAL-26-000401', t(1, '17:05')),
        red('nt-ana-05', 'OP-CAL-26-000409', t(1, '11:20')),
        version('nt-ana-06', 'OP-CAL-26-000360', 3, t(2, '16:45')),
        observation('nt-ana-07', 'OP-CAL-26-000412', 2, t(2, '10:10')),
        green('nt-ana-08', 'OP-CAL-26-000398', t(6, '09:00')),
      ],
    },
    // Solo los tipos del rol: sin observaciones.
    'luis.rojas:SIL:CALLAO': {
      role: 'ASISTENTE_TRANSPORTE',
      notifications: [
        failed('nt-luis-01', 'OP-CAL-26-000360', DELIVERY_360, t(0, '10:42')),
        red('nt-luis-02', 'OP-CAL-26-000409', t(0, '09:50')),
        green('nt-luis-03', 'OP-CAL-26-000405', t(1, '15:10')),
        version('nt-luis-04', 'OP-CAL-26-000393', 2, t(1, '11:30')),
        issued('nt-luis-05', 'OP-CAL-26-000401', t(2, '14:00')),
      ],
    },
    // El mock no tiene solicitudes de Piura: lista vacía con la campana siempre presente.
    'marta.quispe:SIL:PIURA': { role: 'COORDINADOR_TRANSPORTE', notifications: [] },
    // Cambiar de sede cambia la lista y la insignia.
    'carlos.vega:SIL:CALLAO': {
      role: 'JEFATURA',
      notifications: [observation('nt-carlos-01', 'OP-CAL-26-000394', 1, t(0, '09:15')), red('nt-carlos-02', 'OP-CAL-26-000409', t(1, '11:20'))],
    },
    'carlos.vega:SIL:PIURA': { role: 'JEFATURA', notifications: [] },
  };
}

/** Cuáles de la semilla llegan «no leídas» la primera vez (el resto ya estaba leído). */
export const INITIAL_UNREAD: ReadonlySet<string> = new Set([
  'nt-ana-01',
  'nt-ana-02',
  'nt-ana-03',
  'nt-luis-01',
  'nt-luis-02',
  'nt-carlos-01',
  'nt-nueva-01',
]);

/**
 * `?sim=notif-nueva`: una entrega fallida nueva (o, si el rol no la ve, un crédito en Rojo) a los 15 s.
 * Solo en la sede Callao, que es la que tiene solicitudes de ejemplo.
 */
export function newNotification(role: string, createdAtMs: number): NotificationSeed {
  const iso = limaIso(createdAtMs);
  return isVisibleForRole('ENTREGA_FALLIDA', role)
    ? failed('nt-nueva-01', 'OP-CAL-26-000360', DELIVERY_360, iso)
    : red('nt-nueva-01', 'OP-CAL-26-000409', iso);
}

/** Orden estable: la más reciente arriba y, en empate, por identificador. */
function byRecentStable(a: Notification, b: Notification): number {
  const delta = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  return delta !== 0 ? delta : a.id.localeCompare(b.id);
}

export function applyFilter(visible: readonly Notification[], filter: NotificationFilter, nowMs: number): NotificationPage {
  const since = nowMs - NOTIFICATIONS_WINDOW_DAYS * MS_PER_DAY;
  const window = visible.filter((n) => Date.parse(n.createdAt) >= since).toSorted(byRecentStable);
  const unread = window.filter((n) => !n.read).length;
  const types: readonly NotificationType[] | undefined = filter.types !== undefined && filter.types.length > 0 ? filter.types : undefined;
  const filtered = window.filter((n) => (filter.unreadOnly !== true || !n.read) && (types === undefined || types.includes(n.type)));
  const limit = Math.min(Math.max(Math.trunc(filter.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
  const start = filter.cursor === undefined ? 0 : filtered.findIndex((n) => n.id === filter.cursor) + 1;
  const items = filtered.slice(start, start + limit);
  const last = items.at(-1);
  const hasMore = start + limit < filtered.length;
  return { items, nextCursor: hasMore && last !== undefined ? last.id : null, unread: unread };
}
