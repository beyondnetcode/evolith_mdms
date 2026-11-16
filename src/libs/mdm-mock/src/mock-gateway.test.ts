import {
  MdmProblemError,
  catalogOf,
  parseOrNull,
  parsePartyRoleType,
  parseParty,
  parsePartyPage,
  withResponseValidation,
  type MdmErrorCode,
  type OpenEstablishmentRequest,
  type Party,
  type PartyQuery,
  type RegisterPartyRequest,
  type RoleTypeInput,
} from '@mdm/contracts';
import { describe, expect, it } from 'vitest';
import { fixedClock } from './clock.ts';
import { MockMdmGateway } from './mock-gateway.ts';
import { ORG_PARTY_ID } from './seed.ts';
import { MdmMockStore } from './store.ts';

const TODAY = '2026-10-24';

function gateway(options: { readonly mode?: 'normal' | 'vacio' | 'error' } = {}) {
  return new MockMdmGateway({ store: new MdmMockStore(), clock: fixedClock(TODAY), actor: 'prueba', ...options });
}

const QUERY: PartyQuery = { search: null, roleTypeCode: null, status: null, type: null, identifier: null, sortBy: 'code', sortOrder: 'asc', page: 1, pageSize: 20 };

/** RUC válidos por módulo 11 que la semilla no usa. */
const FREE_RUC = '20101010105';
const OTHER_FREE_RUC = '20525252524';

function registration(overrides: Partial<RegisterPartyRequest> = {}): RegisterPartyRequest {
  return {
    type: 'ORGANIZATION',
    code: 'nueva  empresa',
    legalName: 'NUEVA EMPRESA S.A.C.',
    tradeName: null,
    primaryIdentifier: { countryCode: 'PE', schemeCode: 'PE-RUC', value: FREE_RUC, validFrom: null },
    roles: [],
    ...overrides,
  };
}

function establishmentRequest(overrides: Partial<OpenEstablishmentRequest> = {}): OpenEstablishmentRequest {
  return {
    code: 'LURIN',
    kindCode: 'BRANCH',
    name: 'Sede Lurín',
    taxEstablishmentCode: '0003',
    isPrincipal: false,
    address: { line1: 'Av. Ejemplo 1', line2: null, ubigeo: '150119', department: null, province: null, district: null, postalCode: null, countryCode: 'PE', reference: null },
    ...overrides,
  };
}

/** Espera que la promesa falle con el estado y el `code` del contrato. */
async function expectProblem(promise: Promise<unknown>, status: number, code: MdmErrorCode): Promise<void> {
  const error: unknown = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(MdmProblemError);
  if (error instanceof MdmProblemError) expect({ status: error.problem.status, code: error.problem.code }).toEqual({ status, code });
}

async function partyByCode(api: MockMdmGateway, code: string): Promise<Party> {
  const page = await api.listParties({ ...QUERY, search: code, status: null, identifier: null });
  const summary = page.items.find((item) => item.code === code) ?? (await api.listParties({ ...QUERY, search: code, status: 'Archived' })).items[0];
  if (summary === undefined) throw new Error(`No existe ${code} en la semilla`);
  return api.getParty(summary.id);
}

describe('semilla y lecturas', () => {
  it('ORG S.A. es empresa del grupo con RUC 20100412447 y sedes CALLAO (principal) y PIURA', async () => {
    const organizacion = await gateway().getParty(ORG_PARTY_ID);
    expect(organizacion).toMatchObject({ code: 'ORG', legalName: 'ORG S.A.', status: 'Active' });
    expect(organizacion.identifiers[0]).toMatchObject({ schemeCode: 'PE-RUC', value: '20100412447', isPrimary: true, isCurrent: true });
    expect(organizacion.roles.map((role) => role.roleTypeCode)).toEqual(['INTERNAL_COMPANY']);
    expect(organizacion.establishments.map((e) => [e.code, e.isPrincipal])).toEqual([
      ['CALLAO', true],
      ['PIURA', false],
    ]);
  });

  it('cada respuesta cumple el contrato (validador de la frontera)', async () => {
    const api = gateway();
    const page = await api.listParties(QUERY);
    expect(parseOrNull(parsePartyPage, page)).not.toBeNull();
    for (const item of page.items) expect(parseOrNull(parseParty, await api.getParty(item.id))).not.toBeNull();
    await expect(withResponseValidation(api).listParties({ ...QUERY, page: 2 })).resolves.toMatchObject({ page: 2 });
  });

  it('P-01 pagina de 20 en 20 por código y excluye por defecto las archivadas y fusionadas', async () => {
    const page = await gateway().listParties(QUERY);
    expect(page.items).toHaveLength(20);
    expect(page.totalCount).toBe(23);
    expect(page.totalPages).toBe(2);
    const codes = page.items.map((item) => item.code);
    expect(codes).toEqual(codes.toSorted((a, b) => a.localeCompare(b, 'es')));
    expect(page.items.some((item) => item.status === 'Archived' || item.status === 'Merged')).toBe(false);
  });

  it('P-01 busca por texto en código, razón social o nombre comercial, sin distinguir mayúsculas', async () => {
    const page = await gateway().listParties({ ...QUERY, search: 'translima' });
    expect(page.items.map((item) => item.code)).toEqual(['TRANSLIM']);
  });

  it('P-01 filtra por rol vigente: un rol vencido o futuro no cuenta', async () => {
    const carriers = await gateway().listParties({ ...QUERY, roleTypeCode: 'CARRIER', pageSize: 100 });
    expect(carriers.items.map((item) => item.code)).not.toContain('AGROEXPORT-NORTE');
    const suppliers = await gateway().listParties({ ...QUERY, roleTypeCode: 'SUPPLIER', pageSize: 100 });
    expect(suppliers.items.map((item) => item.code)).not.toContain('ACME');
  });

  it('P-01 por identificador exacto encuentra también la archivada; incompleto es 400', async () => {
    const api = gateway();
    const page = await api.listParties({ ...QUERY, identifier: { countryCode: 'PE', schemeCode: 'PE-RUC', value: '20471471471' } });
    expect(page.items.map((item) => [item.code, item.status])).toEqual([['IMPORTADORA-ORIENTE', 'Archived']]);
    await expectProblem(api.listParties({ ...QUERY, identifier: { countryCode: 'PE', schemeCode: '', value: '1' } }), 400, 'validation.identifier_filter_incomplete');
  });

  it('una Party inexistente es 404 y la simulación de error responde 500', async () => {
    await expectProblem(gateway().getParty('00000000-0000-4000-8000-000000000000'), 404, 'common.not_found');
    await expectProblem(gateway({ mode: 'error' }).listParties(QUERY), 500, 'server.unexpected_error');
    await expect(gateway({ mode: 'vacio' }).listParties(QUERY)).resolves.toMatchObject({ items: [], totalCount: 0 });
  });
});

describe('alta (P-02)', () => {
  it('crea la organización con su código normalizado y versión 1', async () => {
    const api = gateway();
    const created = await api.registerParty(registration({ roles: [{ roleTypeCode: 'CUSTOMER', validFrom: null, validTo: null }] }));
    expect(created.version).toBe(1);
    const party = await api.getParty(created.id);
    expect(party).toMatchObject({ code: 'NUEVA_EMPRESA', status: 'Active', createdBy: 'prueba' });
    expect(party.identifiers[0]).toMatchObject({ isPrimary: true, validFrom: TODAY, isCurrent: true });
    expect(party.roles[0]).toMatchObject({ roleTypeCode: 'CUSTOMER', isCurrent: true });
  });

  it('PERSON no está admitido (422) y la razón social vacía es 400 con el campo', async () => {
    const api = gateway();
    await expectProblem(api.registerParty(registration({ type: 'PERSON' })), 422, 'party.person_not_supported');
    const error: unknown = await api.registerParty(registration({ legalName: '  ' })).catch((reason: unknown) => reason);
    expect(error instanceof MdmProblemError && error.problem.errors).toEqual({ legalName: ['validation.legal_name_required'] });
  });

  it('INV-PTY-04: esquema desconocido, no admitido, formato y dígito verificador', async () => {
    const api = gateway();
    const withIdentifier = (schemeCode: string, value: string, countryCode = 'PE') =>
      api.registerParty(registration({ primaryIdentifier: { countryCode, schemeCode, value, validFrom: null } }));
    await expectProblem(withIdentifier('PE-RUC', FREE_RUC, 'CL'), 422, 'party.identifier.scheme_unknown');
    await expectProblem(withIdentifier('EC-RUC', '1234567890123', 'EC'), 422, 'party.identifier.scheme_unknown');
    await expectProblem(withIdentifier('PE-DNI', '12345678'), 422, 'party.identifier.scheme_not_allowed');
    await expectProblem(withIdentifier('PE-RUC', '2010041244'), 422, 'party.identifier.invalid_format');
    await expectProblem(withIdentifier('PE-RUC', '20100412448'), 422, 'party.identifier.check_digit_invalid');
  });

  it('INV-PTY-02: el identificador de otra Party es duplicado, aunque esa Party esté archivada', async () => {
    const api = gateway();
    await expectProblem(api.registerParty(registration({ primaryIdentifier: { countryCode: 'PE', schemeCode: 'PE-RUC', value: '20100412447', validFrom: null } })), 409, 'party.identifier.duplicate');
    await expectProblem(api.registerParty(registration({ primaryIdentifier: { countryCode: 'PE', schemeCode: 'PE-RUC', value: '20-471471471', validFrom: null } })), 409, 'party.identifier.duplicate');
  });

  it('INV-PTY-07: el código no se reutiliza, ni el de una archivada', async () => {
    await expectProblem(gateway().registerParty(registration({ code: 'importadora-oriente' })), 409, 'party.code_not_unique');
  });

  it('INV-PTY-05 e INV-PTY-06 en los roles iniciales: sin solapes y empresa del grupo solo con identificador fiscal', async () => {
    const api = gateway();
    const overlapping = [
      { roleTypeCode: 'CUSTOMER', validFrom: '2026-01-01', validTo: null },
      { roleTypeCode: 'CUSTOMER', validFrom: '2026-06-01', validTo: '2026-12-31' },
    ];
    await expectProblem(api.registerParty(registration({ roles: overlapping })), 409, 'party.role.overlap');
    const chilean = { countryCode: 'CL', schemeCode: 'CL-RUT', value: '12345678K', validFrom: '2027-01-01' };
    const internal = [{ roleTypeCode: 'INTERNAL_COMPANY', validFrom: null, validTo: null }];
    await expectProblem(api.registerParty(registration({ primaryIdentifier: chilean, roles: internal })), 409, 'party.role.fiscal_identifier_required');
    await expectProblem(api.registerParty(registration({ roles: [{ roleTypeCode: 'NO_EXISTE', validFrom: null, validTo: null }] })), 422, 'party.role.type_unknown');
  });
});

describe('concurrencia optimista (412) y Party terminal (INV-PTY-11)', () => {
  it('una versión que no es la vigente es 412 y no escribe nada', async () => {
    const api = gateway();
    const before = await api.getParty(ORG_PARTY_ID);
    await expectProblem(api.renameParty(ORG_PARTY_ID, { legalName: 'OTRA', tradeName: null }, before.version - 1), 412, 'precondition.failed');
    expect((await api.getParty(ORG_PARTY_ID)).legalName).toBe('ORG S.A.');
  });

  it('cualquier escritura en un subrecurso sube la versión de toda la Party', async () => {
    const api = gateway();
    const party = await api.getParty(ORG_PARTY_ID);
    const result = await api.openEstablishment(ORG_PARTY_ID, establishmentRequest(), party.version);
    expect(result.version).toBe(party.version + 1);
    const role = party.roles[0];
    if (role === undefined) throw new Error('ORG tiene un rol');
    await expectProblem(api.suspendRole(ORG_PARTY_ID, role.roleId, { reason: null }, party.version), 412, 'precondition.failed');
  });

  it('una Party archivada o fusionada es de solo lectura y no se reactiva', async () => {
    const api = gateway();
    const archived = await partyByCode(api, 'IMPORTADORA-ORIENTE');
    await expectProblem(api.renameParty(archived.id, { legalName: 'X', tradeName: null }, archived.version), 409, 'party.archived');
    await expectProblem(api.activateParty(archived.id, { reason: null }, archived.version), 409, 'party.archived');
    const merged = (await api.listParties({ ...QUERY, status: 'Merged' })).items[0];
    if (merged === undefined) throw new Error('La semilla tiene una fusionada');
    await expectProblem(api.suspendParty(merged.id, { reason: null }, merged.version), 409, 'party.merged');
  });

  it('ciclo de vida: suspender dos veces o activar una activa es 409; archivar es terminal', async () => {
    const api = gateway();
    const { version } = await api.suspendParty(ORG_PARTY_ID, { reason: 'Prueba' }, 7);
    await expectProblem(api.suspendParty(ORG_PARTY_ID, { reason: null }, version), 409, 'party.already_suspended');
    const active = await api.activateParty(ORG_PARTY_ID, { reason: null }, version);
    await expectProblem(api.activateParty(ORG_PARTY_ID, { reason: null }, active.version), 409, 'party.already_active');
    const archived = await api.archiveParty(ORG_PARTY_ID, active.version);
    await expectProblem(api.activateParty(ORG_PARTY_ID, { reason: null }, archived.version), 409, 'party.archived');
  });

  it('la escritura simulada de otra persona sube la versión y deja en 412 a quien tenía la anterior', async () => {
    const store = new MdmMockStore();
    const api = new MockMdmGateway({ store, clock: fixedClock(TODAY) });
    const loaded = await api.getParty(ORG_PARTY_ID);
    expect(store.simulateConcurrentEdit(ORG_PARTY_ID, { tradeName: 'Organización' })).toBe(loaded.version + 1);
    await expectProblem(api.renameParty(ORG_PARTY_ID, { legalName: 'ORG S.A.', tradeName: 'Mío' }, loaded.version), 412, 'precondition.failed');
    const reloaded = await api.getParty(ORG_PARTY_ID);
    expect(reloaded).toMatchObject({ tradeName: 'Organización', updatedBy: 'otra.persona' });
    expect(parseOrNull(parseParty, reloaded)).not.toBeNull();
    expect(store.simulateConcurrentEdit('no-existe')).toBeNull();
  });
});

describe('autorización supuesta (403 reservado por el contrato)', () => {
  function as(role: 'ANALISTA_DATOS_MAESTROS' | 'RESPONSABLE_MDM' | 'CONSULTOR' | 'INTEGRADOR_ERP') {
    return new MockMdmGateway({ store: new MdmMockStore(), clock: fixedClock(TODAY), role });
  }

  it('el consultor y el integrador no registran ni editan; el analista sí', async () => {
    await expectProblem(as('CONSULTOR').registerParty(registration()), 403, 'auth.forbidden');
    await expectProblem(as('INTEGRADOR_ERP').renameParty(ORG_PARTY_ID, { legalName: 'X', tradeName: null }, 7), 403, 'auth.forbidden');
    await expect(as('ANALISTA_DATOS_MAESTROS').registerParty(registration())).resolves.toMatchObject({ version: 1 });
  });

  it('suspender, archivar y vencer identificadores son del responsable; el 403 va antes que el 412', async () => {
    const analyst = as('ANALISTA_DATOS_MAESTROS');
    await expectProblem(analyst.suspendParty(ORG_PARTY_ID, { reason: null }, 1), 403, 'auth.forbidden');
    await expectProblem(analyst.archiveParty(ORG_PARTY_ID, 1), 403, 'auth.forbidden');
    await expectProblem(analyst.expireIdentifier(ORG_PARTY_ID, 'x', { validTo: null, reason: null }, 1), 403, 'auth.forbidden');
    await expect(as('RESPONSABLE_MDM').suspendParty(ORG_PARTY_ID, { reason: null }, 7)).resolves.toEqual({ version: 8 });
  });

  it('leer es de todos los roles', async () => {
    await expect(as('CONSULTOR').getParty(ORG_PARTY_ID)).resolves.toMatchObject({ code: 'ORG' });
  });
});

describe('identificadores (P-09, P-10)', () => {
  it('INV-PTY-03: un primario nuevo sin reemplazo es 409; con reemplazo vence el anterior el día previo', async () => {
    const api = gateway();
    const request = { countryCode: 'PE', schemeCode: 'PE-RUC', value: FREE_RUC, validFrom: '2026-11-01', isPrimary: true, replacesPrimary: false };
    await expectProblem(api.addIdentifier(ORG_PARTY_ID, request, 7), 409, 'party.identifier.primary_exists');
    await api.addIdentifier(ORG_PARTY_ID, { ...request, replacesPrimary: true }, 7);
    const party = await api.getParty(ORG_PARTY_ID);
    expect(party.identifiers.find((i) => i.value === '20100412447')?.validTo).toBe('2026-10-31');
    await expectProblem(api.addIdentifier(ORG_PARTY_ID, { ...request, isPrimary: false, replacesPrimary: true }, party.version), 400, 'validation.failed');
  });

  it('no se vence el primario vigente sin sucesor ni el último fiscal de una empresa del grupo', async () => {
    const api = gateway();
    const organizacion = await api.getParty(ORG_PARTY_ID);
    const ruc = organizacion.identifiers[0];
    if (ruc === undefined) throw new Error('ORG tiene RUC');
    await expectProblem(api.expireIdentifier(ORG_PARTY_ID, ruc.identifierId, { validTo: null, reason: null }, 7), 409, 'party.identifier.primary_required');
    const created = await api.addIdentifier(
      ORG_PARTY_ID,
      { countryCode: 'CL', schemeCode: 'CL-RUT', value: '7654321K', validFrom: '2020-01-01', isPrimary: false, replacesPrimary: false },
      7,
    );
    const replaced = await api.addIdentifier(
      ORG_PARTY_ID,
      { countryCode: 'PE', schemeCode: 'PE-RUC', value: OTHER_FREE_RUC, validFrom: TODAY, isPrimary: true, replacesPrimary: true },
      created.version,
    );
    // El RUT chileno ya no es el último fiscal (queda el RUC nuevo): se puede vencer.
    const expired = await api.expireIdentifier(ORG_PARTY_ID, created.id, { validTo: TODAY, reason: null }, replaced.version);
    expect(expired.version).toBe(replaced.version + 1);
    await expectProblem(api.expireIdentifier(ORG_PARTY_ID, '00000000-0000-4000-8000-000000000000', { validTo: null, reason: null }, expired.version), 404, 'common.not_found');
  });

  it('INV-PTY-06: vencer o reemplazar el último identificador fiscal vigente de una empresa del grupo es 409', async () => {
    const api = gateway();
    const partida = { countryCode: 'PE', schemeCode: 'PE-PARTIDA', value: '11223344', validFrom: null, isPrimary: true, replacesPrimary: true };
    await expectProblem(api.addIdentifier(ORG_PARTY_ID, partida, 7), 409, 'party.identifier.fiscal_required');
    // Una organización con primario no fiscal, un RUT chileno fiscal secundario y el rol de empresa del grupo.
    const created = await api.registerParty(registration({ primaryIdentifier: { countryCode: 'PE', schemeCode: 'PE-PARTIDA', value: '55667788', validFrom: '2020-01-01' } }));
    const rut = await api.addIdentifier(
      created.id,
      { countryCode: 'CL', schemeCode: 'CL-RUT', value: '7654321K', validFrom: '2020-01-01', isPrimary: false, replacesPrimary: false },
      created.version,
    );
    const role = await api.assignRole(created.id, { roleTypeCode: 'INTERNAL_COMPANY', validFrom: null, validTo: null }, rut.version);
    await expectProblem(api.expireIdentifier(created.id, rut.id, { validTo: TODAY, reason: null }, role.version), 409, 'party.identifier.fiscal_required');
  });
});

describe('roles (P-12 a P-15)', () => {
  it('INV-PTY-05: un rol del mismo tipo no terminado que se cruza es 409; terminado ya no cuenta', async () => {
    const api = gateway();
    const acme = await partyByCode(api, 'ACME');
    const role = { roleTypeCode: 'CUSTOMER', validFrom: '2026-12-01', validTo: null };
    await expectProblem(api.assignRole(acme.id, role, acme.version), 409, 'party.role.overlap');
    const customer = acme.roles.find((item) => item.roleTypeCode === 'CUSTOMER');
    if (customer === undefined) throw new Error('ACME es cliente');
    const terminated = await api.terminateRole(acme.id, customer.roleId, { validTo: '2026-11-30', reason: null }, acme.version);
    await expect(api.assignRole(acme.id, role, terminated.version)).resolves.toMatchObject({ version: terminated.version + 1 });
    await expectProblem(api.suspendRole(acme.id, customer.roleId, { reason: null }, terminated.version + 1), 409, 'party.role.terminated');
  });

  it('INV-PTY-06: empresa del grupo sin identificador fiscal vigente es 409; con Party suspendida, party.not_active', async () => {
    const api = gateway();
    const created = await api.registerParty(
      registration({ primaryIdentifier: { countryCode: 'CL', schemeCode: 'CL-RUT', value: '12345678K', validFrom: '2027-01-01' } }),
    );
    await expectProblem(api.assignRole(created.id, { roleTypeCode: 'INTERNAL_COMPANY', validFrom: null, validTo: null }, 1), 409, 'party.role.fiscal_identifier_required');
    const translim = await partyByCode(api, 'TRANSLIM');
    await expectProblem(api.assignRole(translim.id, { roleTypeCode: 'CUSTOMER', validFrom: null, validTo: null }, translim.version), 409, 'party.not_active');
  });

  it('suspender y reactivar un rol; la fecha de término no puede ser anterior a su inicio', async () => {
    const api = gateway();
    const role = (await api.getParty(ORG_PARTY_ID)).roles[0];
    if (role === undefined) throw new Error('ORG tiene un rol');
    const suspended = await api.suspendRole(ORG_PARTY_ID, role.roleId, { reason: null }, 7);
    await expectProblem(api.suspendRole(ORG_PARTY_ID, role.roleId, { reason: null }, suspended.version), 409, 'party.role.already_suspended');
    const active = await api.activateRole(ORG_PARTY_ID, role.roleId, { reason: null }, suspended.version);
    await expectProblem(api.activateRole(ORG_PARTY_ID, role.roleId, { reason: null }, active.version), 409, 'party.role.already_active');
    await expectProblem(api.terminateRole(ORG_PARTY_ID, role.roleId, { validTo: '1977-12-31', reason: null }, active.version), 400, 'validation.failed');
  });
});

describe('establecimientos (P-18 a P-22)', () => {
  it('INV-PTY-09: solo un principal activo', async () => {
    const api = gateway();
    await expectProblem(api.openEstablishment(ORG_PARTY_ID, establishmentRequest({ isPrincipal: true }), 7), 409, 'establishment.principal_exists');
  });

  it('INV-PTY-08 e INV-PTY-10: el cierre es terminal y el código no se reutiliza, ni tras cerrar', async () => {
    const api = gateway();
    const piura = (await api.getParty(ORG_PARTY_ID)).establishments.find((e) => e.code === 'PIURA');
    if (piura === undefined) throw new Error('ORG tiene la sede PIURA');
    const closed = await api.closeEstablishment(ORG_PARTY_ID, piura.id, 7);
    await expectProblem(api.reactivateEstablishment(ORG_PARTY_ID, piura.id, { reason: null }, closed.version), 409, 'establishment.closed');
    await expectProblem(api.deactivateEstablishment(ORG_PARTY_ID, piura.id, { reason: null }, closed.version), 409, 'establishment.closed');
    await expectProblem(api.openEstablishment(ORG_PARTY_ID, establishmentRequest({ code: ' piura ' }), closed.version), 409, 'establishment.code_not_unique');
    const establishments = await api.listEstablishments(ORG_PARTY_ID, 'closed');
    expect(establishments.map((e) => [e.code, e.isActive, e.isClosed])).toEqual([['PIURA', false, true]]);
  });

  it('desactivar es reversible y no deja dos principales al reactivar; almacén no admitido (422)', async () => {
    const api = gateway();
    const callao = (await api.getParty(ORG_PARTY_ID)).establishments.find((e) => e.code === 'CALLAO');
    if (callao === undefined) throw new Error('ORG tiene la sede CALLAO');
    const inactive = await api.deactivateEstablishment(ORG_PARTY_ID, callao.id, { reason: null }, 7);
    await expectProblem(api.deactivateEstablishment(ORG_PARTY_ID, callao.id, { reason: null }, inactive.version), 409, 'establishment.already_inactive');
    const opened = await api.openEstablishment(ORG_PARTY_ID, establishmentRequest({ isPrincipal: true }), inactive.version);
    await expectProblem(api.reactivateEstablishment(ORG_PARTY_ID, callao.id, { reason: null }, opened.version), 409, 'establishment.principal_exists');
    await expectProblem(api.openEstablishment(ORG_PARTY_ID, establishmentRequest({ code: 'ALM', kindCode: 'WAREHOUSE' }), opened.version), 422, 'establishment.kind_not_supported');
  });

  it('con la Party suspendida no se abre un establecimiento', async () => {
    const api = gateway();
    const translim = await partyByCode(api, 'TRANSLIM');
    await expectProblem(api.openEstablishment(translim.id, establishmentRequest(), translim.version), 409, 'party.not_active');
  });
});

describe('relaciones (INV-PTY-12) y referencias externas (INV-PTY-13)', () => {
  it('sin autorreferencia, sin solape del mismo tipo y sentido, y con versión propia', async () => {
    const api = gateway();
    const acme = await partyByCode(api, 'ACME');
    const request = { fromPartyId: ORG_PARTY_ID, toPartyId: acme.id, kindCode: 'PARENT_OF', validFrom: '2026-01-01', validTo: null };
    await expectProblem(api.startRelationship({ ...request, toPartyId: ORG_PARTY_ID }), 422, 'party_relationship.self_reference');
    const created = await api.startRelationship(request);
    expect(created.version).toBe(1);
    expect((await api.getParty(ORG_PARTY_ID)).version).toBe(7);
    await expectProblem(api.startRelationship({ ...request, validFrom: '2026-06-01' }), 409, 'party_relationship.overlap');
    await expectProblem(api.endRelationship(created.id, { validTo: null, reason: null }, 2), 412, 'precondition.failed');
    const ended = await api.endRelationship(created.id, { validTo: null, reason: null }, 1);
    await expectProblem(api.endRelationship(created.id, { validTo: null, reason: null }, ended.version), 409, 'party_relationship.already_ended');
    const archived = await partyByCode(api, 'IMPORTADORA-ORIENTE');
    await expectProblem(api.startRelationship({ ...request, toPartyId: archived.id }), 409, 'party_relationship.party_not_active');
    await expectProblem(api.startRelationship({ ...request, toPartyId: '00000000-0000-4000-8000-000000000000' }), 422, 'party_relationship.party_not_found');
  });

  it('la clave externa apunta a un solo objeto, aunque esté desvinculada', async () => {
    const api = gateway();
    const existing = (await api.listExternalReferences({ partyId: ORG_PARTY_ID, mdmObject: null, externalKey: null, syncStatus: null, page: 1, pageSize: 20 })).items[0];
    if (existing === undefined) throw new Error('ORG tiene su clave del ERP');
    const unlinked = await api.unlinkExternalReference(existing.id, existing.version);
    await expectProblem(api.unlinkExternalReference(existing.id, unlinked.version), 409, 'external_reference.already_unlinked');
    const acme = await partyByCode(api, 'ACME');
    const request = { systemCode: 'ERP', systemInstance: 'PRD-100', externalObjectType: 'COMPANY', externalKey: '1000', mdmObjectType: 'PARTY' as const, mdmObjectId: acme.id };
    await expectProblem(api.linkExternalReference(request), 409, 'external_reference.key_duplicate');
    // «Ver a qué está vinculada»: X-01 por la clave completa encuentra la dueña, aunque esté desvinculada.
    const key = { systemCode: 'ERP', systemInstance: 'PRD-100', externalObjectType: 'COMPANY', externalKey: '1000' };
    const owner = await api.listExternalReferences({ partyId: null, mdmObject: null, externalKey: key, syncStatus: null, page: 1, pageSize: 20 });
    expect(owner.items.map((item) => [item.partyId, item.syncStatus])).toEqual([[ORG_PARTY_ID, 'Unlinked']]);
    await expect(api.linkExternalReference({ ...request, externalKey: '2000' })).resolves.toMatchObject({ version: 1 });
    await expectProblem(api.linkExternalReference({ ...request, externalKey: '3000', mdmObjectId: '00000000-0000-4000-8000-000000000000' }), 422, 'external_reference.target_not_found');
    const archived = await partyByCode(api, 'IMPORTADORA-ORIENTE');
    await expectProblem(api.linkExternalReference({ ...request, externalKey: '4000', mdmObjectId: archived.id }), 409, 'external_reference.target_not_active');
  });
});

describe('catálogo de tipos de rol (C-02, C-05 a C-08, D-046)', () => {
  const INPUT: RoleTypeInput = {
    name: 'Operador portuario',
    description: null,
    unEdifact3035Code: null,
    allowedPartyTypes: ['ORGANIZATION'],
    requiresFiscalIdentifier: false,
  };
  const ALL = { partyType: null, includeInactive: true } as const;

  it('la carga inicial suma los papeles logísticos con su código UN/EDIFACT 3035, todos activos y en versión 1', async () => {
    const api = gateway();
    const page = await api.listRoleTypes(ALL);
    expect(parseOrNull(catalogOf(parsePartyRoleType), page)).not.toBeNull();
    const byCode = Object.fromEntries(page.items.map((type) => [type.code, [type.name, type.unEdifact3035Code, type.isActive, type.version]]));
    expect(byCode).toMatchObject({
      CONSIGNEE: ['Consignatario', 'CN', true, 1],
      CONSIGNOR: ['Embarcador', 'CZ', true, 1],
      NOTIFY_PARTY: ['Parte a notificar', 'NI', true, 1],
      EXPORTER: ['Exportador', 'EX', true, 1],
      IMPORTER: ['Importador', 'IM', true, 1],
      WAREHOUSE_KEEPER: ['Depositario', 'WH', true, 1],
      FREIGHT_FORWARDER: ['Agente de carga internacional', 'FW', true, 1],
      CUSTOMER: ['Cliente', 'BY', true, 1],
      INTERNAL_COMPANY: ['Empresa del grupo', null, true, 1],
    });
    // Algunas organizaciones de la semilla ya tienen esos papeles.
    expect((await api.listParties({ ...QUERY, roleTypeCode: 'IMPORTER' })).totalCount).toBeGreaterThan(0);
  });

  it('alta con el código normalizado; el código no se reutiliza, ni el de un tipo desactivado', async () => {
    const api = gateway();
    await expect(api.createRoleType({ ...INPUT, code: '  operador  portuario ', unEdifact3035Code: ' pw ' })).resolves.toEqual({ code: 'OPERADOR_PORTUARIO', version: 1 });
    const created = (await api.listRoleTypes(ALL)).items.find((type) => type.code === 'OPERADOR_PORTUARIO');
    expect(created).toMatchObject({ unEdifact3035Code: 'PW', isActive: true, createdBy: 'prueba', updatedAt: null });
    await expectProblem(api.createRoleType({ ...INPUT, code: 'operador-portuario' }), 409, 'party_role_type.code_duplicate');
    await api.deactivateRoleType('OPERADOR_PORTUARIO', { reason: null }, 1);
    await expectProblem(api.createRoleType({ ...INPUT, code: 'OPERADOR_PORTUARIO' }), 409, 'party_role_type.code_duplicate');
  });

  it('forma (400) antes que las reglas del catálogo (422)', async () => {
    const api = gateway();
    await expectProblem(api.createRoleType({ ...INPUT, code: '   ' }), 400, 'validation.failed');
    await expectProblem(api.createRoleType({ ...INPUT, code: 'X1', name: ' ' }), 400, 'validation.failed');
    await expectProblem(api.createRoleType({ ...INPUT, code: 'X1', allowedPartyTypes: [] }), 400, 'validation.failed');
    await expectProblem(api.createRoleType({ ...INPUT, code: '1ABC' }), 422, 'party_role_type.code_invalid');
    await expectProblem(api.createRoleType({ ...INPUT, code: 'AGENTE.CARGA' }), 422, 'party_role_type.code_invalid');
    await expectProblem(api.createRoleType({ ...INPUT, code: 'X1', unEdifact3035Code: 'ABC' }), 422, 'party_role_type.edifact_invalid');
    await expectProblem(api.createRoleType({ ...INPUT, code: 'X1', unEdifact3035Code: 'A1' }), 422, 'party_role_type.edifact_invalid');
  });

  it('editar con versión propia: 404, 412 y el código inmutable; no sube la versión de ninguna Party', async () => {
    const api = gateway();
    const before = (await api.getParty(ORG_PARTY_ID)).version;
    await expectProblem(api.changeRoleType('NO_EXISTE', INPUT, 1), 404, 'common.not_found');
    await expectProblem(api.changeRoleType('CARRIER', INPUT, 2), 412, 'precondition.failed');
    await expect(api.changeRoleType('CARRIER', { ...INPUT, name: 'Transportista terrestre', description: '  Por carretera  ' }, 1)).resolves.toEqual({ version: 2 });
    const carrier = (await api.listRoleTypes(ALL)).items.find((type) => type.code === 'CARRIER');
    expect(carrier).toMatchObject({ code: 'CARRIER', name: 'Transportista terrestre', description: 'Por carretera', version: 2, updatedBy: 'prueba' });
    expect((await api.getParty(ORG_PARTY_ID)).version).toBe(before);
  });

  it('desactivar y reactivar: sin repetir la transición; desactivado sale del catálogo por defecto', async () => {
    const api = gateway();
    const deactivated = await api.deactivateRoleType('EXPORTER', { reason: 'Se unifica con embarcador' }, 1);
    await expectProblem(api.deactivateRoleType('EXPORTER', { reason: null }, deactivated.version), 409, 'party_role_type.already_inactive');
    expect((await api.listRoleTypes({ partyType: 'ORGANIZATION', includeInactive: false })).items.map((type) => type.code)).not.toContain('EXPORTER');
    const active = await api.activateRoleType('EXPORTER', { reason: null }, deactivated.version);
    await expectProblem(api.activateRoleType('EXPORTER', { reason: null }, active.version), 409, 'party_role_type.already_active');
  });

  it('un tipo desactivado no se asigna a roles nuevos (409) y los roles existentes se conservan', async () => {
    const api = gateway();
    await api.deactivateRoleType('CUSTOMER', { reason: null }, 1);
    const acme = await partyByCode(api, 'ACME');
    expect(acme.roles.find((role) => role.roleTypeCode === 'CUSTOMER')).toMatchObject({ status: 'Active', isCurrent: true });
    const agronorte = await partyByCode(api, 'AGROEXPORT-NORTE');
    await expectProblem(api.assignRole(agronorte.id, { roleTypeCode: 'CUSTOMER', validFrom: '2030-01-01', validTo: null }, agronorte.version), 409, 'party_role_type.inactive');
    await expectProblem(api.registerParty(registration({ roles: [{ roleTypeCode: 'CUSTOMER', validFrom: null, validTo: null }] })), 409, 'party_role_type.inactive');
    // Un tipo inexistente sigue siendo 422.
    await expectProblem(api.assignRole(agronorte.id, { roleTypeCode: 'NO_EXISTE', validFrom: null, validTo: null }, agronorte.version), 422, 'party.role.type_unknown');
  });

  it('administran el analista y el responsable (SUPUESTO); el consultor y el integrador reciben 403', async () => {
    const as = (role: 'ANALISTA_DATOS_MAESTROS' | 'RESPONSABLE_MDM' | 'CONSULTOR' | 'INTEGRADOR_ERP') =>
      new MockMdmGateway({ store: new MdmMockStore(), clock: fixedClock(TODAY), role });
    await expectProblem(as('CONSULTOR').createRoleType({ ...INPUT, code: 'X1' }), 403, 'auth.forbidden');
    await expectProblem(as('INTEGRADOR_ERP').deactivateRoleType('CARRIER', { reason: null }, 1), 403, 'auth.forbidden');
    await expect(as('CONSULTOR').listRoleTypes(ALL)).resolves.toMatchObject({ items: expect.any(Array) as unknown });
    await expect(as('ANALISTA_DATOS_MAESTROS').createRoleType({ ...INPUT, code: 'X1' })).resolves.toEqual({ code: 'X1', version: 1 });
    await expect(as('RESPONSABLE_MDM').changeRoleType('CARRIER', INPUT, 1)).resolves.toEqual({ version: 2 });
  });

  it('cada almacén tiene su catálogo: lo que edita uno no lo ve otro', async () => {
    await gateway().deactivateRoleType('CARRIER', { reason: null }, 1);
    expect((await gateway().listRoleTypes(ALL)).items.find((type) => type.code === 'CARRIER')?.isActive).toBe(true);
  });
});

describe('latencia simulada', () => {
  it('espera la latencia configurada y se puede cancelar', async () => {
    const api = new MockMdmGateway({ store: new MdmMockStore(), clock: fixedClock(TODAY), latencyMs: 30 });
    const controller = new AbortController();
    const pending = api.listParties(QUERY, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toBeDefined();
    const started = Date.now();
    await api.listParties(QUERY);
    expect(Date.now() - started).toBeGreaterThanOrEqual(25);
  });
});
