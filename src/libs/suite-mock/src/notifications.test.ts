import { SuiteGatewayError, NOTIFICATION_TYPES, readStateKey, isVisibleForRole, destinationPath, type SuiteSession, type SuiteGateway } from '@suite/contracts';
import { describe, expect, it } from 'vitest';
import { NEW_NOTIFICATION_ARRIVAL_MS, createMockSuiteGateway, type SessionStorageAdapter, type MockSuiteOptions } from './mock-suite-gateway.ts';
import { applyFilter } from './notifications.ts';
import { createTestSession } from './test-session.ts';

function inMemoryStore(): SessionStorageAdapter {
  const data = new Map<string, string>();
  return {
    read: (key) => data.get(key) ?? null,
    write: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
  };
}

// 15/10/2026 12:00 en Lima: «hoy» es el 15 y las notificaciones de hoy (10:42, 09:15 y 08:30) ya llegaron.
const NOW = Date.parse('2026-10-15T12:00:00-05:00');

function create(options: Partial<MockSuiteOptions> = {}, clock = { now: NOW }) {
  const local = inMemoryStore();
  const gateway: SuiteGateway = createMockSuiteGateway({
    latencyMs: 0,
    storage: inMemoryStore(),
    localStorage: local,
    now: () => clock.now,
    ...options,
  });
  return { gateway, clock: clock, local };
}

const sessionOf = (user: string, currentSilProfile?: string): SuiteSession =>
  createTestSession({ user, now: NOW, ...(currentSilProfile === undefined ? {} : { currentSilProfile }) });

describe('datos de ejemplo por usuario y perfil (anexo A1 §10.7)', () => {
  it.each([
    ['ana.perez', undefined, 8, 3],
    ['luis.rojas', undefined, 5, 2],
    ['marta.quispe', undefined, 0, 0],
    ['carlos.vega', 'carlos.vega:SIL:CALLAO', 2, 1],
    ['carlos.vega', 'carlos.vega:SIL:PIURA', 0, 0],
    ['diego.salas', undefined, 0, 0],
  ])('%s (%s): %i notificaciones y %i sin leer', async (user, profile, total, unread) => {
    const { gateway } = create();
    const session = sessionOf(user, profile);
    const page = await gateway.listNotifications(session, { limit: 50 });
    expect(page.items).toHaveLength(total);
    expect(page.unread).toBe(unread);
    expect(await gateway.countUnread(session)).toEqual({ unread: unread });
  });

  it('Ana tiene los seis tipos, tres grupos de fecha en hora de Lima y las tres de hoy sin leer', async () => {
    const { gateway } = create();
    const { items } = await gateway.listNotifications(sessionOf('ana.perez'), { limit: 50 });
    expect(new Set(items.map((n) => n.type))).toEqual(new Set(NOTIFICATION_TYPES));
    expect(items.filter((n) => !n.read).map((n) => n.createdAt.slice(0, 10))).toEqual(['2026-10-15', '2026-10-15', '2026-10-15']);
    expect(new Set(items.map((n) => n.createdAt.slice(0, 10)))).toEqual(new Set(['2026-10-15', '2026-10-14', '2026-10-13', '2026-10-09']));
  });

  it('Luis solo recibe los tipos de su rol: sin observaciones', async () => {
    const { gateway } = create();
    const { items } = await gateway.listNotifications(sessionOf('luis.rojas'));
    expect(items.some((n) => n.type === 'OBSERVACION_REGISTRADA')).toBe(false);
    expect(items.every((n) => isVisibleForRole(n.type, 'ASISTENTE_TRANSPORTE'))).toBe(true);
  });

  it('el servicio puede entregar todo, pero un perfil solo ve los tipos que su rol permite', async () => {
    const { gateway } = create();
    // El perfil de Ana con el rol de Jefatura: de sus 8 solo le corresponden observaciones y crédito en Rojo.
    const base = sessionOf('ana.perez');
    const asManagement: SuiteSession = { ...base, profiles: base.profiles.map((p) => (p.system === 'SIL' ? { ...p, role: 'JEFATURA' } : p)) };
    const { items } = await gateway.listNotifications(asManagement, { limit: 50 });
    expect(new Set(items.map((n) => n.type))).toEqual(new Set(['OBSERVACION_REGISTRADA', 'CREDITO_ROJO']));
  });

  it('cada aviso lleva a una pantalla de SIL con una solicitud real de los datos de ejemplo', async () => {
    const { gateway } = create();
    const { items } = await gateway.listNotifications(sessionOf('ana.perez'), { limit: 50 });
    for (const n of items) {
      expect(['P-04', 'P-06']).toContain(n.destination.screen);
      expect(n.destination.operationId).toBe(n.params.operationId);
      expect(destinationPath(n.destination)).not.toBeNull();
    }
  });

  it('el orden es el más reciente arriba y estable en empates', () => {
    const base = { version: 1, system: 'SIL', severity: 'ERROR', type: 'CREDITO_ROJO', read: false, params: { operationId: 'OP-CAL-26-000409' }, destination: { screen: 'P-04', operationId: 'OP-CAL-26-000409' } } as const;
    const sameTime = '2026-10-15T10:00:00-05:00';
    const page = applyFilter(
      [
        { ...base, id: 'b', createdAt: sameTime },
        { ...base, id: 'a', createdAt: sameTime },
        { ...base, id: 'c', createdAt: '2026-10-15T11:00:00-05:00' },
      ],
      {},
      NOW,
    );
    expect(page.items.map((n) => n.id)).toEqual(['c', 'a', 'b']);
  });

  it('solo se muestran los últimos 90 días', () => {
    const base = { version: 1, system: 'SIL', severity: 'ERROR', type: 'CREDITO_ROJO', read: false, params: { operationId: 'OP-CAL-26-000409' }, destination: { screen: 'P-04', operationId: 'OP-CAL-26-000409' } } as const;
    const page = applyFilter(
      [
        { ...base, id: 'reciente', createdAt: '2026-08-01T10:00:00-05:00' },
        { ...base, id: 'antigua', createdAt: '2026-07-01T10:00:00-05:00' },
      ],
      {},
      NOW,
    );
    expect(page.items.map((n) => n.id)).toEqual(['reciente']);
    expect(page.unread).toBe(1);
  });
});

describe('filtros y paginación', () => {
  it('«No leídas» y «Tipo» los aplica el servicio, y el total de no leídas no depende de los filtros', async () => {
    const { gateway } = create();
    const session = sessionOf('ana.perez');
    const unreadOnly = await gateway.listNotifications(session, { unreadOnly: true });
    expect(unreadOnly.items).toHaveLength(3);
    const credit = await gateway.listNotifications(session, { types: ['CREDITO_VERDE', 'CREDITO_ROJO'] });
    expect(credit.items.map((n) => n.type).toSorted()).toEqual(['CREDITO_ROJO', 'CREDITO_VERDE', 'CREDITO_VERDE']);
    expect(credit.unread).toBe(3);
    const combined = await gateway.listNotifications(session, { types: ['CREDITO_VERDE'], unreadOnly: true });
    expect(combined.items).toHaveLength(1);
  });

  it('pagina con cursor sin repetir ni saltar, y respeta el límite de 1 a 50', async () => {
    const { gateway } = create();
    const session = sessionOf('ana.perez');
    const first = await gateway.listNotifications(session, { limit: 3 });
    expect(first.items).toHaveLength(3);
    expect(first.nextCursor).not.toBeNull();
    const second = await gateway.listNotifications(session, { limit: 3, ...(first.nextCursor === null ? {} : { cursor: first.nextCursor }) });
    const third = await gateway.listNotifications(session, { limit: 3, ...(second.nextCursor === null ? {} : { cursor: second.nextCursor }) });
    const ids = [...first.items, ...second.items, ...third.items].map((n) => n.id);
    expect(new Set(ids).size).toBe(8);
    expect(third.nextCursor).toBeNull();
    expect((await gateway.listNotifications(session, { limit: 0 })).items).toHaveLength(1);
    expect((await gateway.listNotifications(session, { limit: 500 })).items).toHaveLength(8);
  });
});

describe('marcar como leída', () => {
  it('es idempotente y baja la cuenta una sola vez', async () => {
    const { gateway } = create();
    const session = sessionOf('ana.perez');
    expect(await gateway.markRead(session, 'nt-ana-01')).toEqual({ type: 'ok', unread: 2 });
    expect(await gateway.markRead(session, 'nt-ana-01')).toEqual({ type: 'ok', unread: 2 });
    expect(await gateway.countUnread(session)).toEqual({ unread: 2 });
  });

  it('una notificación que no existe, o que el rol no ve, devuelve «no-existe»', async () => {
    const { gateway } = create();
    expect(await gateway.markRead(sessionOf('ana.perez'), 'nt-no-existe')).toEqual({ type: 'not-found' });
    // De Ana, pero con el perfil de Luis no se puede marcar.
    expect(await gateway.markRead(sessionOf('luis.rojas'), 'nt-ana-01')).toEqual({ type: 'not-found' });
  });

  it('«Marcar todas» marca todas las del perfil, no solo las filtradas ni las cargadas', async () => {
    const { gateway } = create();
    const session = sessionOf('ana.perez');
    // Aunque la vista tenga un filtro o una sola página cargada, marca las tres.
    await gateway.listNotifications(session, { types: ['CREDITO_VERDE'], limit: 1 });
    expect(await gateway.markAllRead(session)).toEqual({ type: 'ok', markedCount: 3, unread: 0 });
    expect((await gateway.listNotifications(session, { unreadOnly: true })).items).toHaveLength(0);
    expect(await gateway.markAllRead(session)).toEqual({ type: 'ok', markedCount: 0, unread: 0 });
  });

  it('la lectura es por usuario: lo que marca Ana no cambia lo de Luis', async () => {
    const { gateway } = create();
    await gateway.markAllRead(sessionOf('ana.perez'));
    expect((await gateway.countUnread(sessionOf('luis.rojas'))).unread).toBe(2);
  });

  it('la lectura es por perfil: cambiar de sede cambia la lista y la cuenta', async () => {
    const { gateway } = create();
    await gateway.markAllRead(sessionOf('carlos.vega', 'carlos.vega:SIL:CALLAO'));
    expect((await gateway.countUnread(sessionOf('carlos.vega', 'carlos.vega:SIL:CALLAO'))).unread).toBe(0);
    expect((await gateway.listNotifications(sessionOf('carlos.vega', 'carlos.vega:SIL:PIURA'))).items).toHaveLength(0);
  });

  it('el estado de lectura persiste en el almacén del usuario y un estado corrupto vuelve todo a no leído', async () => {
    const { gateway, local } = create();
    const session = sessionOf('ana.perez');
    await gateway.markRead(session, 'nt-ana-02');
    const key = readStateKey('ana.perez');
    expect(local.read(key)).toContain('nt-ana-02');
    local.write(key, '{no es json');
    expect((await gateway.countUnread(session)).unread).toBe(3);
  });

  it('no se escribe nada en el almacén de otro usuario', async () => {
    const { gateway, local } = create();
    await gateway.markRead(sessionOf('ana.perez'), 'nt-ana-01');
    expect(local.read(readStateKey('luis.rojas'))).toBeNull();
  });
});

describe('simulaciones ?sim=notif-*', () => {
  it('notif-vacio: ninguna notificación para nadie', async () => {
    const { gateway } = create({ notifications: 'vacio' });
    expect((await gateway.listNotifications(sessionOf('ana.perez'))).items).toEqual([]);
    expect(await gateway.countUnread(sessionOf('ana.perez'))).toEqual({ unread: 0 });
  });

  it('notif-error: la lectura y la cuenta fallan con correlación', async () => {
    const { gateway } = create({ notifications: 'error' });
    await expect(gateway.listNotifications(sessionOf('ana.perez'))).rejects.toBeInstanceOf(SuiteGatewayError);
    await expect(gateway.countUnread(sessionOf('ana.perez'))).rejects.toMatchObject({ correlation: expect.stringMatching(/^SUITE-/) as unknown });
  });

  it('notif-error-marcar: las escrituras devuelven «error» y no cambian nada', async () => {
    const { gateway } = create({ notifications: 'error-marcar' });
    const session = sessionOf('ana.perez');
    expect(await gateway.markRead(session, 'nt-ana-01')).toMatchObject({ type: 'error' });
    expect(await gateway.markAllRead(session)).toMatchObject({ type: 'error' });
    expect((await gateway.countUnread(session)).unread).toBe(3);
  });

  it('notif-nueva: a los 15 s llega una entrega fallida (o un crédito en Rojo si el rol no la ve), solo en Callao', async () => {
    const clock = { now: NOW };
    const { gateway } = create({ notifications: 'nueva' }, clock);
    const ana = sessionOf('ana.perez');
    expect((await gateway.countUnread(ana)).unread).toBe(3);
    clock.now += NEW_NOTIFICATION_ARRIVAL_MS - 1;
    expect((await gateway.countUnread(ana)).unread).toBe(3);
    clock.now += 1;
    const { items, unread: unread } = await gateway.listNotifications(ana);
    expect(unread).toBe(4);
    expect(items[0]).toMatchObject({ id: 'nt-nueva-01', type: 'ENTREGA_FALLIDA', read: false });
    // Jefatura no ve entregas fallidas: recibe un crédito en Rojo.
    const carlos = sessionOf('carlos.vega', 'carlos.vega:SIL:CALLAO');
    expect((await gateway.listNotifications(carlos)).items[0]).toMatchObject({ id: 'nt-nueva-01', type: 'CREDITO_ROJO' });
    // Piura no tiene solicitudes de ejemplo: no llega nada.
    expect((await gateway.countUnread(sessionOf('carlos.vega', 'carlos.vega:SIL:PIURA'))).unread).toBe(0);
  });

  it('notif-reiniciar: borra el estado de lectura del usuario', async () => {
    const clock = { now: NOW };
    const local = inMemoryStore();
    const first = createMockSuiteGateway({ latencyMs: 0, storage: inMemoryStore(), localStorage: local, now: () => clock.now });
    await first.markAllRead(sessionOf('ana.perez'));
    expect((await first.countUnread(sessionOf('ana.perez'))).unread).toBe(0);
    const reset = createMockSuiteGateway({ latencyMs: 0, storage: inMemoryStore(), localStorage: local, notifications: 'reiniciar', now: () => clock.now });
    expect((await reset.countUnread(sessionOf('ana.perez'))).unread).toBe(3);
  });
});
