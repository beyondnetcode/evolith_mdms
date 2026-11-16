import { describe, expect, it } from 'vitest';
import type { MdmGateway } from './gateway.ts';
import { MdmContractError, MdmProblemError } from './problem.ts';
import type { PartyQuery } from './requests.ts';
import { withResponseValidation } from './validating-gateway.ts';

const QUERY: PartyQuery = {
  search: null,
  roleTypeCode: null,
  status: null,
  type: null,
  identifier: null,
  sortBy: 'code',
  sortOrder: 'asc',
  page: 1,
  pageSize: 20,
};

const notUsed = (): never => {
  throw new Error('No se usa en esta prueba');
};

/** Un gateway cuyas respuestas controla la prueba: simula una implementación que rompe el contrato. */
function gatewayAnswering(listParties: () => Promise<unknown>, registerParty: () => Promise<unknown> = notUsed): MdmGateway {
  const base = new Proxy({} as MdmGateway, { get: () => notUsed });
  // Aserción justificada: la prueba entrega a propósito respuestas fuera de contrato que el tipo no admite.
  return { ...base, listParties, registerParty } as unknown as MdmGateway;
}

describe('withResponseValidation', () => {
  it('deja pasar una respuesta válida', async () => {
    const page = { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 };
    await expect(withResponseValidation(gatewayAnswering(() => Promise.resolve(page))).listParties(QUERY)).resolves.toEqual(page);
  });

  it('falla cerrado ante una respuesta fuera de contrato, con la ruta del campo roto', async () => {
    const broken = { items: [{ id: 'no-uuid' }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 };
    const gateway = withResponseValidation(gatewayAnswering(() => Promise.resolve(broken)));
    const failure = gateway.listParties(QUERY);
    await expect(failure).rejects.toBeInstanceOf(MdmContractError);
    await expect(failure).rejects.toMatchObject({ violation: expect.stringContaining('$.items[0].id') as unknown });
  });

  it('valida también la respuesta de las escrituras', async () => {
    const gateway = withResponseValidation(gatewayAnswering(notUsed, () => Promise.resolve({ id: 'x', version: 1 })));
    await expect(
      gateway.registerParty({
        type: 'ORGANIZATION',
        code: 'X',
        legalName: 'X',
        tradeName: null,
        primaryIdentifier: { countryCode: 'PE', schemeCode: 'PE-RUC', value: '20100412447', validFrom: null },
        roles: [],
      }),
    ).rejects.toBeInstanceOf(MdmContractError);
  });

  it('valida la respuesta de lectura geográfica y falla cerrado ante DTO incompleto', async () => {
    const base = new Proxy({} as MdmGateway, { get: () => notUsed });
    const gateway = withResponseValidation({
      ...base,
      getCountry: () => Promise.resolve({ alpha2: 'PE' }),
    } as unknown as MdmGateway);
    await expect(gateway.getCountry('PE')).rejects.toBeInstanceOf(MdmContractError);
    await expect(gateway.getCountry('PE')).rejects.toMatchObject({
      violation: expect.stringContaining('$.placeId') as unknown,
    });
  });

  it('valida el alta de un tipo de rol (C-05): el código del tipo, no un UUID', async () => {
    const base = new Proxy({} as MdmGateway, { get: () => notUsed });
    const answering = (response: unknown) =>
      // Aserción justificada: la prueba entrega a propósito respuestas fuera de contrato que el tipo no admite.
      withResponseValidation({ ...base, createRoleType: () => Promise.resolve(response) } as unknown as MdmGateway);
    const request = { code: 'x', name: 'X', description: null, unEdifact3035Code: null, allowedPartyTypes: ['ORGANIZATION'] as const, requiresFiscalIdentifier: false };
    await expect(answering({ code: 'X1', version: 1 }).createRoleType(request)).resolves.toEqual({ code: 'X1', version: 1 });
    await expect(answering({ id: '0b9c7e0e-2f4a-4c39-9a51-1f0d7a3e9c11', version: 1 }).createRoleType(request)).rejects.toBeInstanceOf(MdmContractError);
  });

  it('los errores del servidor pasan sin tocar', async () => {
    const error = new MdmProblemError({ status: 500, code: 'server.unexpected_error', title: 'Error', detail: null, instance: null, errors: {} }, 'c-1');
    const gateway = withResponseValidation(gatewayAnswering(() => Promise.reject(error)));
    await expect(gateway.listParties(QUERY)).rejects.toBe(error);
  });
});
