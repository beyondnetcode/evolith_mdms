import { SuiteGatewayError, type SuiteGateway } from '@suite/contracts';
import { describe, expect, it } from 'vitest';
import { createMockSuiteGateway, type SessionStorageAdapter, type MockSuiteOptions } from './mock-suite-gateway.ts';
import { MOCK_SESSION_KEY, INACTIVITY_MS, WORKDAY_VALIDITY_MS, createTestSession } from './test-session.ts';
import { TEST_PASSWORD } from './test-users.ts';

function inMemoryStorage(): SessionStorageAdapter {
  const data = new Map<string, string>();
  return {
    read: (key) => data.get(key) ?? null,
    write: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
  };
}

function create(options: Partial<MockSuiteOptions> = {}, clock = { now: Date.parse('2026-10-14T13:00:00Z') }): { gateway: SuiteGateway; clock: { now: number } } {
  const gateway = createMockSuiteGateway({ latencyMs: 0, storage: inMemoryStorage(), now: () => clock.now, ...options });
  return { gateway, clock };
}

describe('iniciarSesion', () => {
  it('con la clave de prueba abre la sesión de la persona, sin credenciales en ella, y la deja guardada', async () => {
    const { gateway } = create();
    const result = await gateway.signIn('ORG', 'Ana.Perez ', TEST_PASSWORD);
    expect(result.type).toBe('ok');
    if (result.type !== 'ok') return;
    expect(result.session.user.fullName).toBe('Ana Pérez');
    expect(result.session.profiles.map((p) => p.profileId)).toEqual(['ana.perez:SIL:CALLAO', 'ana.perez:DT:CALLAO', 'ana.perez:CNS:CALLAO']);
    expect(JSON.stringify(result.session)).not.toContain(TEST_PASSWORD);
    expect(gateway.currentSession()).toEqual(result.session);
  });

  it('la sesión lleva el inquilino con el que se inició, aunque se teclee en minúsculas', async () => {
    const { gateway } = create();
    const result = await gateway.signIn(' unilog ', 'ricardo.paredes', TEST_PASSWORD);
    expect(result.type === 'ok' && result.session.tenant).toEqual({ code: 'UNILOG', name: 'Unilog S.A.C.' });
  });

  it('fuera de su inquilino la cuenta no existe: un inquilino ajeno o desconocido es «credenciales» y no cuenta para el bloqueo', async () => {
    const { gateway } = create();
    expect(await gateway.signIn('UNILOG', 'ana.perez', TEST_PASSWORD)).toEqual({ type: 'invalid-credentials' });
    expect(await gateway.signIn('ORG', 'sofia.ramos', TEST_PASSWORD)).toEqual({ type: 'invalid-credentials' });
    expect(await gateway.signIn('NO_EXISTE', 'ana.perez', TEST_PASSWORD)).toEqual({ type: 'invalid-credentials' });
    for (let i = 0; i < 5; i++) await gateway.signIn('UNILOG', 'luis.rojas', 'mala');
    expect((await gateway.signIn('ORG', 'luis.rojas', TEST_PASSWORD)).type).toBe('ok');
  });

  it('la variante de un caso en otro inquilino hereda sus perfiles y sus notificaciones', async () => {
    const { gateway } = create();
    const base = await gateway.signIn('ORG', 'ana.perez', TEST_PASSWORD);
    const variant = await gateway.signIn('ORG_TRANSPORTES', 'rosa.torres', TEST_PASSWORD);
    if (base.type !== 'ok' || variant.type !== 'ok') throw new Error('Se esperaban dos sesiones');
    expect(variant.session.user.fullName).toBe('Rosa Torres');
    expect(variant.session.profiles.map((p) => p.role)).toEqual(base.session.profiles.map((p) => p.role));
    expect(await gateway.countUnread(variant.session)).toEqual(await gateway.countUnread(base.session));
  });

  it('ofrece los inquilinos activos y visibles en el ingreso, ordenados por nombre, aun con UMS caído', async () => {
    for (const umsDown of [false, true]) {
      const { gateway } = create({ umsDown });
      expect(await gateway.listSignInTenants()).toEqual([
        { code: 'ORG', name: 'Organización S.A.' },
        { code: 'ORG_TRANSPORTES', name: 'Organización Transportes S.A.C.' },
        { code: 'UNILOG', name: 'Unilog S.A.C.' },
      ]);
    }
  });

  it('usuario inexistente y clave inválida devuelven lo mismo: «credenciales»', async () => {
    const { gateway } = create();
    expect(await gateway.signIn('ORG', 'ana.perez', 'otra')).toEqual({ type: 'invalid-credentials' });
    expect(await gateway.signIn('ORG', 'nadie', TEST_PASSWORD)).toEqual({ type: 'invalid-credentials' });
    expect(gateway.currentSession()).toBeNull();
  });

  it('la cuenta bloqueada de origen está bloqueada con cualquier clave', async () => {
    const { gateway } = create();
    expect(await gateway.signIn('ORG', 'cuenta.bloqueada', TEST_PASSWORD)).toEqual({ type: 'locked' });
    expect(await gateway.signIn('ORG', 'cuenta.bloqueada', 'otra')).toEqual({ type: 'locked' });
  });

  it('bloquea tras 5 intentos fallidos consecutivos y un acierto reinicia la cuenta', async () => {
    const { gateway } = create();
    for (let i = 0; i < 4; i++) await gateway.signIn('ORG', 'luis.rojas', 'mala');
    expect((await gateway.signIn('ORG', 'luis.rojas', TEST_PASSWORD)).type).toBe('ok');
    for (let i = 0; i < 5; i++) expect(await gateway.signIn('ORG', 'luis.rojas', 'mala')).toEqual({ type: 'invalid-credentials' });
    expect(await gateway.signIn('ORG', 'luis.rojas', TEST_PASSWORD)).toEqual({ type: 'locked' });
  });

  it('los intentos con usuarios inexistentes no cuentan: el bloqueo no revela qué cuentas existen', async () => {
    const { gateway } = create();
    for (let i = 0; i < 10; i++) expect(await gateway.signIn('ORG', 'nadie', 'mala')).toEqual({ type: 'invalid-credentials' });
  });

  it('con UMS caído responde «ums-no-responde» con una correlación y no abre sesión', async () => {
    const { gateway } = create({ umsDown: true });
    const result = await gateway.signIn('ORG', 'ana.perez', TEST_PASSWORD);
    expect(result).toMatchObject({ type: 'ums-unavailable' });
    expect(result.type === 'ums-unavailable' && result.correlation).toMatch(/^SUITE-[0-9A-F]{8}$/);
    expect(gateway.currentSession()).toBeNull();
  });
});

describe('vigencia de la sesión', () => {
  it('vence a las 8 h, con la hora de Lima en el instante', async () => {
    const { gateway, clock } = create();
    const result = await gateway.signIn('ORG', 'ana.perez', TEST_PASSWORD);
    if (result.type !== 'ok') throw new Error('Se esperaba una sesión');
    expect(result.session.issuedAt).toBe('2026-10-14T08:00:00-05:00');
    expect(result.session.expiresAt).toBe('2026-10-14T16:00:00-05:00');
    // Con actividad constante, solo el tope de la jornada la vence.
    clock.now += WORKDAY_VALIDITY_MS - 1;
    gateway.recordActivity();
    expect(gateway.currentSession()).not.toBeNull();
    clock.now += 1;
    gateway.recordActivity();
    expect(gateway.currentSession()).toBeNull();
  });

  it('vence por 30 min de inactividad, y la actividad la renueva', async () => {
    const { gateway, clock } = create();
    await gateway.signIn('ORG', 'ana.perez', TEST_PASSWORD);
    clock.now += INACTIVITY_MS - 1000;
    gateway.recordActivity();
    clock.now += INACTIVITY_MS - 1000;
    expect(gateway.currentSession()).not.toBeNull();
    clock.now += 1000;
    expect(gateway.currentSession()).toBeNull();
  });

  it('?sim=expira la acorta a 20 s', async () => {
    const { gateway, clock } = create({ expires: true });
    await gateway.signIn('ORG', 'ana.perez', TEST_PASSWORD);
    clock.now += 19_000;
    expect(gateway.currentSession()).not.toBeNull();
    clock.now += 1000;
    expect(gateway.currentSession()).toBeNull();
  });

  it('cerrar sesión la borra', async () => {
    const { gateway } = create();
    await gateway.signIn('ORG', 'ana.perez', TEST_PASSWORD);
    gateway.signOut();
    expect(gateway.currentSession()).toBeNull();
  });

  it('una sesión alterada en el almacenamiento no se acepta', () => {
    const storage = inMemoryStorage();
    storage.write(MOCK_SESSION_KEY, JSON.stringify({ ...createTestSession({ role: 'JEFATURA' }), currentProfileBySystem: { SIL: 'otro:SIL:CALLAO' } }));
    expect(create({ storage }).gateway.currentSession()).toBeNull();
  });
});

describe('sistemasDe y elegirPerfil', () => {
  it('solo devuelve los sistemas de la sesión, por nombre canónico, con MDM disponible y con ruta', async () => {
    const { gateway } = create();
    const result = await gateway.signIn('ORG', 'carlos.vega', TEST_PASSWORD);
    if (result.type !== 'ok') throw new Error('Se esperaba una sesión');
    const cards = await gateway.systemsOf(result.session);
    expect(cards.map((t) => t.code)).toEqual(['MDM', 'DT', 'CMS', 'YMS', 'UMS']);
    expect(cards.find((t) => t.code === 'MDM')).toMatchObject({ availability: 'DISPONIBLE', path: '/mdm/organizaciones' });
    expect(cards.filter((t) => t.code !== 'MDM').every((t) => t.availability === 'FUERA_DE_ALCANCE' && t.path === undefined)).toBe(true);
  });

  it('?sim=mantenimiento deja MDM sin ruta; ?sim=vacio no concede nada; ?sim=error falla con correlación', async () => {
    const base = createTestSession({ user: 'carlos.vega' });
    const mdm = (await create({ maintenance: true }).gateway.systemsOf(base)).find((t) => t.code === 'MDM');
    expect(mdm).toMatchObject({ availability: 'EN_MANTENIMIENTO' });
    expect(mdm?.path).toBeUndefined();
    expect(await create({ empty: true }).gateway.systemsOf(base)).toEqual([]);
    await expect(create({ loadError: true }).gateway.systemsOf(base)).rejects.toBeInstanceOf(SuiteGatewayError);
  });

  it('elegirPerfil cambia solo el perfil vigente del sistema y rechaza perfiles que la sesión no concede', async () => {
    const { gateway } = create();
    await gateway.signIn('ORG', 'carlos.vega', TEST_PASSWORD);
    const next = gateway.chooseProfile('SIL', 'carlos.vega:SIL:PIURA');
    expect(next?.currentProfileBySystem.SIL).toBe('carlos.vega:SIL:PIURA');
    expect(gateway.currentSession()?.currentProfileBySystem.SIL).toBe('carlos.vega:SIL:PIURA');
    expect(gateway.chooseProfile('SIL', 'otra.persona:SIL:CALLAO')).toBeNull();
    expect(gateway.chooseProfile('DT', 'carlos.vega:SIL:CALLAO')).toBeNull();
  });
});

describe('crearSesionDePrueba (ayudante de pruebas)', () => {
  it('construye la sesión de un usuario de prueba o una sintética con el rol pedido', () => {
    expect(createTestSession({ user: 'diego.salas' }).profiles.map((p) => p.system)).toEqual(['DT']);
    const synthetic = createTestSession({ role: 'JEFATURA', site: 'Piura' });
    expect(synthetic.profiles).toEqual([{ profileId: 'prueba.jefatura:SIL:PIURA', system: 'SIL', role: 'JEFATURA', site: 'Piura' }]);
    expect(() => createTestSession({ user: 'nadie' })).toThrow('desconocido');
  });
});

describe('?sim=expira en una sesión ya abierta', () => {
  it('una sesión sembrada con jornada completa vence igualmente a los 20 s de emitida', () => {
    const storage = inMemoryStorage();
    const issued = Date.parse('2026-10-14T13:00:00Z');
    storage.write(MOCK_SESSION_KEY, JSON.stringify(createTestSession({ role: 'JEFATURA', now: issued })));
    const clock = { now: issued + 19_000 };
    const { gateway } = create({ expires: true, storage }, clock);
    expect(gateway.currentSession()).not.toBeNull();
    clock.now = issued + 20_000;
    expect(gateway.currentSession()).toBeNull();
  });
});

describe('sede de trabajo (D-030)', () => {
  it('abre con la única sede, o con todas si hay varias', async () => {
    const { gateway } = create();
    const ana = await gateway.signIn('ORG', 'ana.perez', TEST_PASSWORD);
    expect(ana.type === 'ok' && ana.session.currentSite).toBe('Callao');
    const carlos = await gateway.signIn('ORG', 'carlos.vega', TEST_PASSWORD);
    expect(carlos.type === 'ok' && carlos.session.currentSite).toBeNull();
  });

  it('elegir sede guarda la sede y pasa cada sistema a un perfil que valga en ella', async () => {
    const { gateway } = create();
    await gateway.signIn('ORG', 'carlos.vega', TEST_PASSWORD);
    const callao = gateway.chooseSite('Callao');
    expect(callao?.currentSite).toBe('Callao');
    // DT tiene perfil en las dos sedes: pasa al de Callao.
    expect(callao?.currentProfileBySystem.DT).toBe('carlos.vega:DT:CALLAO');
    // SIL no tiene perfil en Callao: conserva el suyo (la sede solo filtra el lanzador).
    expect(callao?.currentProfileBySystem.SIL).toBe('carlos.vega:SIL:PIURA');
    expect(gateway.currentSession()?.currentSite).toBe('Callao');
    const piura = gateway.chooseSite('Piura');
    expect(piura?.currentProfileBySystem.DT).toBe('carlos.vega:DT:PIURA');
    // El perfil de todas las sedes (`OrgWide`) vale en cualquier sede: no cambia.
    expect(piura?.currentProfileBySystem.CMS).toBe('carlos.vega:CMS:SIN-SEDE');
    expect(gateway.chooseSite(null)?.currentProfileBySystem.DT).toBe('carlos.vega:DT:PIURA');
  });

  it('una sede que la persona no tiene no se elige', async () => {
    const { gateway } = create();
    await gateway.signIn('ORG', 'ana.perez', TEST_PASSWORD);
    expect(gateway.chooseSite('Piura')).toBeNull();
    expect(gateway.currentSession()?.currentSite).toBe('Callao');
  });
});
