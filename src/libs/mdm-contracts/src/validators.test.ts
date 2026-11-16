import { describe, expect, it } from 'vitest';
import { catalogOf, parseIdentifierScheme, parsePartyRoleType, type PartyRoleType } from './catalogs.ts';
import { parseRoleTypeCreatedResponse } from './gateway.ts';
import { isValidRuc, normalizeCode, normalizeIdentifierValue, rucCheckDigit } from './identifiers.ts';
import { parseOrNull } from './parse.ts';
import { parseParty, parsePartyPage, parsePartySummary, type Party, type PartySummary } from './party.ts';
import { hasProblemCode, MdmProblemError, parseProblemDetails, problemFrom } from './problem.ts';
import { parseExternalReference } from './relationships.ts';
import { isValidEdifact3035Code, isValidRoleTypeCode, normalizeEdifact3035Code, normalizeRoleTypeCode } from './role-types.ts';

const PARTY_ID = '0b9c7e0e-2f4a-4c39-9a51-1f0d7a3e9c11';

const ORG: Party = {
  id: PARTY_ID,
  type: 'ORGANIZATION',
  code: 'ORG',
  legalName: 'ORG S.A.',
  tradeName: 'Organización',
  status: 'Active',
  version: 7,
  identifiers: [
    {
      identifierId: '5f1d2b8a-90c4-4a7e-8d3b-6a2e1c9f0b47',
      countryCode: 'PE',
      schemeCode: 'PE-RUC',
      value: '20100412447',
      isPrimary: true,
      validFrom: '1978-01-01',
      validTo: null,
      isCurrent: true,
    },
  ],
  roles: [
    { roleId: 'c3a8e1f2-7b6d-4e59-a0c1-2d4f6b8e9a10', roleTypeCode: 'INTERNAL_COMPANY', status: 'Active', validFrom: '1978-01-01', validTo: null, isCurrent: true },
  ],
  establishments: [
    {
      id: '7e2c4a91-3d5b-4f60-8a17-b9c0d2e4f681',
      partyId: PARTY_ID,
      code: 'CALLAO',
      kindCode: 'BRANCH',
      name: 'Sede Callao',
      taxEstablishmentCode: '0001',
      isPrincipal: true,
      isActive: true,
      isClosed: false,
      closedAt: null,
      closedBy: null,
      address: {
        line1: 'Av. Ejemplo 123',
        line2: null,
        ubigeo: '070101',
        department: 'Callao',
        province: 'Callao',
        district: 'Callao',
        postalCode: null,
        countryCode: 'PE',
        reference: null,
      },
    },
  ],
  createdAt: '2026-10-24T15:02:11.400+00:00',
  createdBy: 'aarroyo',
  updatedAt: '2026-10-24T16:10:00.000+00:00',
  updatedBy: 'aarroyo',
};

const SUMMARY: PartySummary = {
  id: PARTY_ID,
  type: 'ORGANIZATION',
  code: 'ORG',
  legalName: 'ORG S.A.',
  tradeName: 'Organización',
  status: 'Active',
  primaryIdentifier: ORG.identifiers[0] ?? null,
  currentRoleTypeCodes: ['INTERNAL_COMPANY'],
  version: 7,
  updatedAt: null,
};

describe('validadores de las respuestas de Party', () => {
  it('acepta el ejemplo del contrato (P-03) tal cual', () => {
    expect(parseOrNull(parseParty, ORG)).toEqual(ORG);
  });

  it.each([
    ['un estado fuera de la enumeración', { ...ORG, status: 'Deleted' }, '$.status'],
    ['una versión cero', { ...ORG, version: 0 }, '$.version'],
    ['un id que no es UUID', { ...ORG, id: '42' }, '$.id'],
    ['una fecha que no existe', { ...ORG, identifiers: [{ ...ORG.identifiers[0], validFrom: '2026-02-30' }] }, '$.identifiers[0].validFrom'],
    ['un anexo que no es de 4 dígitos', { ...ORG, establishments: [{ ...ORG.establishments[0], taxEstablishmentCode: '1' }] }, '$.establishments[0].taxEstablishmentCode'],
    ['un establecimiento de otra Party', { ...ORG, establishments: [{ ...ORG.establishments[0], partyId: '7e2c4a91-3d5b-4f60-8a17-b9c0d2e4f681' }] }, '$.establishments[0].partyId'],
    ['un campo obligatorio ausente', { ...ORG, roles: undefined }, '$.roles'],
  ])('rechaza %s e indica el campo', (_case, input, path) => {
    const result = parseParty(input, '$');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.path).toBe(path);
  });

  it('la página de P-01 valida cada elemento y no admite más elementos que su tamaño', () => {
    const page = { items: [SUMMARY], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 };
    expect(parseOrNull(parsePartyPage, page)).toEqual(page);
    expect(parseOrNull(parsePartyPage, { ...page, pageSize: 0 })).toBeNull();
    expect(parseOrNull(parsePartyPage, { ...page, items: [SUMMARY, SUMMARY], pageSize: 1 })).toBeNull();
    expect(parseOrNull(parsePartySummary, { ...SUMMARY, currentRoleTypeCodes: ['cliente'] })).toBeNull();
  });

  it('el catálogo de esquemas exige un patrón que sea una expresión regular válida', () => {
    const scheme = {
      code: 'PE-RUC',
      countryCode: 'PE',
      name: 'Registro Único de Contribuyentes',
      issuingAuthority: 'SUNAT',
      pattern: '^[0-9]{11}$',
      isFiscal: true,
      iso6523Icd: null,
      allowedPartyTypes: ['ORGANIZATION', 'PERSON'],
      isActive: true,
    };
    expect(parseOrNull(catalogOf(parseIdentifierScheme), { items: [scheme] })).not.toBeNull();
    expect(parseOrNull(parseIdentifierScheme, { ...scheme, pattern: '^[0-9' })).toBeNull();
  });

  it('la referencia externa exige un syncStatus del contrato', () => {
    const reference = {
      id: '1b9c7e0e-2f4a-4c39-9a51-1f0d7a3e9c11',
      systemCode: 'ERP',
      systemInstance: 'PRD-100',
      externalObjectType: 'COMPANY',
      externalKey: '1000',
      mdmObjectType: 'PARTY',
      mdmObjectId: PARTY_ID,
      partyId: PARTY_ID,
      syncStatus: 'Linked',
      lastSyncedVersion: null,
      version: 1,
      createdAt: '2026-10-24T15:02:11.400+00:00',
      createdBy: 'integrador',
      updatedAt: null,
      updatedBy: null,
    };
    expect(parseOrNull(parseExternalReference, reference)).toEqual(reference);
    expect(parseOrNull(parseExternalReference, { ...reference, syncStatus: 'Synced' })).toBeNull();
  });
});

describe('Problem Details', () => {
  it('tipa el problema solo si el par estado-código existe en el contrato', () => {
    const duplicate = parseProblemDetails({ type: 'about:blank', title: 'Conflicto', status: 409, code: 'party.identifier.duplicate', instance: '/x/1' });
    expect(duplicate).toMatchObject({ status: 409, code: 'party.identifier.duplicate', instance: '/x/1', errors: {} });
    expect(parseProblemDetails({ title: 'Conflicto', status: 422, code: 'party.identifier.duplicate' })).toBeNull();
    expect(parseProblemDetails({ title: 'Versión', status: 412, code: 'precondition.failed' })).toMatchObject({ status: 412 });
    expect(parseProblemDetails({ title: 'Versión', status: 409, code: 'precondition.failed' })).toBeNull();
    expect(parseProblemDetails({ title: 'Inventado', status: 409, code: 'party.unknown' })).toBeNull();
  });

  it('conserva `errors` de validation.failed y rechaza uno mal formado', () => {
    const problem = parseProblemDetails({ title: 'Validación', status: 400, code: 'validation.failed', errors: { legalName: ['validation.legal_name_required'] } });
    expect(problem?.errors).toEqual({ legalName: ['validation.legal_name_required'] });
    expect(parseProblemDetails({ title: 'Validación', status: 400, code: 'validation.failed', errors: { legalName: 'x' } })).toBeNull();
  });

  it('el error lleva su problema y su correlación', () => {
    const problem = parseProblemDetails({ title: 'No encontrado', status: 404, code: 'common.not_found' });
    if (problem === null) throw new Error('Se esperaba un problema válido');
    const error = new MdmProblemError(problem, 'corr-1');
    expect(problemFrom(error)?.status).toBe(404);
    expect(hasProblemCode(error, 'common.not_found')).toBe(true);
    expect(hasProblemCode(new Error('otro'), 'common.not_found')).toBe(false);
    expect(error.correlation).toBe('corr-1');
  });
});

describe('identificadores', () => {
  it('el RUC de Organización tiene el dígito verificador correcto (módulo 11)', () => {
    expect(rucCheckDigit('2010041244')).toBe(7);
    expect(isValidRuc('20100412447')).toBe(true);
    expect(isValidRuc('20100412448')).toBe(false);
    expect(isValidRuc('2010041244')).toBe(false);
  });

  it('normaliza el valor y el código como el servidor', () => {
    expect(normalizeIdentifierValue(' 20-100 412447 ')).toBe('20100412447');
    expect(normalizeCode('  transportes  andinos ')).toBe('TRANSPORTES_ANDINOS');
  });
});

describe('tipos de rol (C-02, C-05 a C-08, D-046)', () => {
  const FORWARDER: PartyRoleType = {
    code: 'FREIGHT_FORWARDER',
    name: 'Agente de carga internacional',
    description: null,
    unEdifact3035Code: 'FW',
    allowedPartyTypes: ['ORGANIZATION'],
    requiresFiscalIdentifier: false,
    isActive: true,
    version: 3,
    createdAt: '2024-03-01T14:00:00.000+00:00',
    createdBy: 'carga-inicial',
    updatedAt: '2026-10-24T15:00:00.000+00:00',
    updatedBy: 'rosa.medina',
  };

  it('el tipo de rol lleva descripción, versión propia y auditoría', () => {
    expect(parseOrNull(catalogOf(parsePartyRoleType), { items: [FORWARDER] })).toEqual({ items: [FORWARDER] });
  });

  it.each([
    ['sin versión', { ...FORWARDER, version: undefined }, '$.version'],
    ['un código UN/EDIFACT de tres letras', { ...FORWARDER, unEdifact3035Code: 'FWD' }, '$.unEdifact3035Code'],
    ['un código UN/EDIFACT en minúsculas', { ...FORWARDER, unEdifact3035Code: 'fw' }, '$.unEdifact3035Code'],
    ['una descripción de más de 500', { ...FORWARDER, description: 'x'.repeat(501) }, '$.description'],
    ['un nombre vacío', { ...FORWARDER, name: '' }, '$.name'],
    ['un tipo de parte fuera de la enumeración', { ...FORWARDER, allowedPartyTypes: ['COMPANY'] }, '$.allowedPartyTypes[0]'],
    ['sin auditoría', { ...FORWARDER, createdBy: undefined }, '$.createdBy'],
  ])('rechaza %s', (_case, input, path) => {
    const result = parsePartyRoleType(input, '$');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.path).toBe(path);
  });

  it('el alta responde con el código y la versión', () => {
    expect(parseOrNull(parseRoleTypeCreatedResponse, { code: 'OPERADOR_PORTUARIO', version: 1 })).not.toBeNull();
    expect(parseOrNull(parseRoleTypeCreatedResponse, { code: 'operador', version: 1 })).toBeNull();
  });

  it('normaliza el código a MAYÚSCULAS_CON_GUION_BAJO y lo valida como el servidor', () => {
    expect(normalizeRoleTypeCode('  agente  de-carga ')).toBe('AGENTE_DE_CARGA');
    expect(isValidRoleTypeCode('AGENTE_DE_CARGA')).toBe(true);
    expect(isValidRoleTypeCode('A')).toBe(false);
    expect(isValidRoleTypeCode('1AGENTE')).toBe(false);
    expect(isValidRoleTypeCode('AGENTE.CARGA')).toBe(false);
    expect(isValidRoleTypeCode(`A${'B'.repeat(50)}`)).toBe(false);
  });

  it('el código UN/EDIFACT 3035 es opcional y de dos letras mayúsculas', () => {
    expect(normalizeEdifact3035Code(' cn ')).toBe('CN');
    expect(normalizeEdifact3035Code('  ')).toBeNull();
    expect(isValidEdifact3035Code('CN')).toBe(true);
    expect(isValidEdifact3035Code('C1')).toBe(false);
    expect(isValidEdifact3035Code('CNA')).toBe(false);
  });

  it('los códigos de error del catálogo van ligados a su estado', () => {
    expect(parseProblemDetails({ title: 'Duplicado', status: 409, code: 'party_role_type.code_duplicate' })).toMatchObject({ status: 409 });
    expect(parseProblemDetails({ title: 'Inactivo', status: 409, code: 'party_role_type.inactive' })).toMatchObject({ status: 409 });
    expect(parseProblemDetails({ title: 'Código', status: 422, code: 'party_role_type.code_invalid' })).toMatchObject({ status: 422 });
    expect(parseProblemDetails({ title: 'EDIFACT', status: 422, code: 'party_role_type.edifact_invalid' })).toMatchObject({ status: 422 });
    expect(parseProblemDetails({ title: 'Duplicado', status: 422, code: 'party_role_type.code_duplicate' })).toBeNull();
  });
});
