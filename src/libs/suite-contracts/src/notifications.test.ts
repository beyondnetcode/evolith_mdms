import { describe, expect, it } from 'vitest';
import {
  SEVERITY_BY_TYPE,
  NOTIFICATION_TYPES,
  readStateKey,
  isNotificationType,
  isVisibleForRole,
  parseReadState,
  destinationPath,
  serializeReadState,
  notificationText,
  visibleTypesFor,
  type Notification,
} from './notifications.ts';

const BASE = { version: 1, id: 'nt-1', system: 'SIL', createdAt: '2026-10-15T10:42:00-05:00', read: false } as const;

function note(partial: Pick<Notification, 'type' | 'params'> & Partial<Notification>): Notification {
  return { ...BASE, severity: 'INFO', destination: { screen: 'P-06', operationId: 'OP-CAL-26-000360' }, ...partial };
}

describe('textos exactos del catálogo (anexo A1 §10.4)', () => {
  it('Observado, en singular y en plural', () => {
    const one = note({ type: 'OBSERVACION_REGISTRADA', params: { operationId: 'OP-CAL-26-000394', openObservations: 1 } });
    expect(notificationText(one)).toEqual({
      title: 'Solicitud OP-CAL-26-000394 observada',
      detail: 'Tiene 1 observación abierta. Revísala en la validación.',
    });
    const two = note({ type: 'OBSERVACION_REGISTRADA', params: { operationId: 'OP-CAL-26-000412', openObservations: 2 } });
    expect(notificationText(two).detail).toBe('Tiene 2 observaciones abiertas. Revísalas en la validación.');
  });

  it('crédito en Rojo y en Verde', () => {
    expect(notificationText(note({ type: 'CREDITO_ROJO', params: { operationId: 'OP-CAL-26-000409' } }))).toEqual({
      title: 'Crédito en Rojo en la solicitud OP-CAL-26-000409',
      detail: 'Crédito en Rojo: no hay orden de transporte. Revisa el semáforo en la validación.',
    });
    expect(notificationText(note({ type: 'CREDITO_VERDE', params: { operationId: 'OP-CAL-26-000405' } }))).toEqual({
      title: 'Crédito habilitado en la solicitud OP-CAL-26-000405',
      detail: 'El semáforo quedó en Verde. La orden se emite por contenedor.',
    });
  });

  it('versión nueva de la orden compara con la anterior', () => {
    expect(notificationText(note({ type: 'ORDEN_VERSION_NUEVA', params: { operationId: 'OP-CAL-26-000360', version: 3 } }))).toEqual({
      title: 'Nueva versión de la orden de OP-CAL-26-000360',
      detail: 'La orden pasó a la v3. Compárala con la v2 en la orden de servicio.',
    });
  });

  it('orden emitida no promete recepción en el TMS', () => {
    const { title, detail } = notificationText(note({ type: 'ORDEN_EMITIDA', params: { operationId: 'OP-CAL-26-000401' } }));
    expect(title).toBe('Orden de OP-CAL-26-000401 emitida');
    expect(detail).toBe('SIL emitió la orden de todos los contenedores. No confirma que el TMS la recibió.');
  });

  it('entrega fallida lleva el contenedor y el código de correlación', () => {
    const { title, detail } = notificationText(
      note({ type: 'ENTREGA_FALLIDA', params: { operationId: 'OP-CAL-26-000399', container: 'ABCU 123456-0', correlationCode: 'COR-7F3A9C' } }),
    );
    expect(title).toBe('Entrega fallida: contenedor ABCU 123456-0');
    expect(detail).toBe('No se pudo entregar la orden de ABCU 123456-0 al canal de integración. Comunica este código a soporte: COR-7F3A9C.');
  });

  it('ningún texto nombra a la persona que actuó, enlaza al TMS ni crea una tarea (D-018, D-019, D-020)', () => {
    const samples: Notification[] = [
      note({ type: 'OBSERVACION_REGISTRADA', params: { operationId: 'OP-CAL-26-000412', openObservations: 2 } }),
      note({ type: 'CREDITO_ROJO', params: { operationId: 'OP-CAL-26-000409' } }),
      note({ type: 'CREDITO_VERDE', params: { operationId: 'OP-CAL-26-000405' } }),
      note({ type: 'ORDEN_VERSION_NUEVA', params: { operationId: 'OP-CAL-26-000360', version: 2 } }),
      note({ type: 'ORDEN_EMITIDA', params: { operationId: 'OP-CAL-26-000401' } }),
      note({ type: 'ENTREGA_FALLIDA', params: { operationId: 'OP-CAL-26-000399', container: 'ABCU 123456-0', correlationCode: 'COR-1' } }),
    ];
    for (const sample of samples) {
      const { title, detail } = notificationText(sample);
      expect(`${title} ${detail}`).not.toMatch(/asign|responsable|vence|pendiente de|por hacer|http|A\. Pérez/i);
    }
  });
});

describe('gravedad y catálogo', () => {
  it('hay seis tipos y cada uno tiene su gravedad', () => {
    expect(NOTIFICATION_TYPES).toHaveLength(6);
    expect(SEVERITY_BY_TYPE).toEqual({
      OBSERVACION_REGISTRADA: 'ATENCION',
      CREDITO_ROJO: 'ERROR',
      CREDITO_VERDE: 'EXITO',
      ORDEN_VERSION_NUEVA: 'INFO',
      ORDEN_EMITIDA: 'INFO',
      ENTREGA_FALLIDA: 'ERROR',
    });
  });

  it('esTipoNotificacion valida en la frontera', () => {
    expect(isNotificationType('CREDITO_ROJO')).toBe(true);
    expect(isNotificationType('TAREA_ASIGNADA')).toBe(false);
    expect(isNotificationType(undefined)).toBe(false);
  });
});

describe('visibilidad por rol (anexo A1 §10.4, SU-40)', () => {
  it.each([
    ['CUSTOMER_SERVICE', [...NOTIFICATION_TYPES]],
    ['ASISTENTE_TRANSPORTE', ['CREDITO_ROJO', 'CREDITO_VERDE', 'ORDEN_VERSION_NUEVA', 'ORDEN_EMITIDA', 'ENTREGA_FALLIDA']],
    ['COORDINADOR_TRANSPORTE', ['CREDITO_ROJO', 'CREDITO_VERDE', 'ORDEN_VERSION_NUEVA', 'ORDEN_EMITIDA']],
    ['JEFATURA', ['OBSERVACION_REGISTRADA', 'CREDITO_ROJO']],
  ])('%s ve exactamente %j', (role, expected) => {
    expect([...visibleTypesFor(role)].toSorted()).toEqual([...expected].toSorted());
  });

  it('el crédito en Rojo lo ven los cuatro actores; la entrega fallida, solo quien opera el envío', () => {
    for (const role of ['CUSTOMER_SERVICE', 'ASISTENTE_TRANSPORTE', 'COORDINADOR_TRANSPORTE', 'JEFATURA']) expect(isVisibleForRole('CREDITO_ROJO', role)).toBe(true);
    expect(isVisibleForRole('ENTREGA_FALLIDA', 'COORDINADOR_TRANSPORTE')).toBe(false);
    expect(isVisibleForRole('ENTREGA_FALLIDA', 'JEFATURA')).toBe(false);
  });

  it('un rol desconocido no ve nada (falla cerrado)', () => {
    expect(visibleTypesFor('ADMIN')).toEqual([]);
    expect(isVisibleForRole('CREDITO_ROJO', '')).toBe(false);
  });
});

describe('enlace profundo: pantalla y solicitud, nunca una URL', () => {
  it('P-04 lleva a la validación y P-06 a la orden', () => {
    expect(destinationPath({ screen: 'P-04', operationId: 'OP-CAL-26-000409' })).toBe('/solicitudes/OP-CAL-26-000409/validacion');
    expect(destinationPath({ screen: 'P-06', operationId: 'OP-CAL-26-000360' })).toBe('/solicitudes/OP-CAL-26-000360/orden');
  });

  it.each(['//evil.example', 'https://evil.example/x', '../../x', 'OP-CAL-26-1', '', 'op-cal-26-000409'])('descarta el identificador %j', (operationId) => {
    expect(destinationPath({ screen: 'P-04', operationId })).toBeNull();
  });
});

describe('estado de lectura guardado (entrada no confiable)', () => {
  it('ida y vuelta', () => {
    const ids = new Set(['nt-2', 'nt-1']);
    expect([...parseReadState(serializeReadState(ids))].toSorted()).toEqual(['nt-1', 'nt-2']);
  });

  it.each([
    null,
    '',
    'no es json',
    '[]',
    '{"version":2,"leidas":["a"]}',
    '{"version":1}',
    '{"version":1,"leidas":"a"}',
    '{"version":1,"leidas":[1]}',
    '{"version":1,"leidas":[""]}',
    `{"version":1,"leidas":["${'x'.repeat(65)}"]}`,
  ])('descarta %j y todo vuelve a no leída', (raw) => {
    expect(parseReadState(raw).size).toBe(0);
  });

  it('la clave es por usuario', () => {
    expect(readStateKey('ana.perez')).toBe('organizacion.notificaciones.ana.perez');
  });
});
