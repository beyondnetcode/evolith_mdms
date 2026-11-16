import type { IdentifierScheme } from '@mdm/contracts';
import { describe, expect, it } from 'vitest';
import { checkDate, checkIdentifierValue, limaToday, previousDay } from './field-rules.ts';
import { checkExpiryDate, toAddIdentifierRequest, validateIdentifierDraft } from './identifier-form.ts';
import { emptyDraft, isDraftTouched, prefilledIdentifier, toRegisterRequest, validateOrganization, type OrganizationDraft } from './organization-form.ts';
import { availableCommands, commandAvailability, isExpired } from './party-policy.ts';
import { can } from './permissions.ts';

const TODAY = '2026-10-24';
const RUC: IdentifierScheme = {
  code: 'PE-RUC',
  countryCode: 'PE',
  name: 'Registro Único de Contribuyentes',
  issuingAuthority: 'SUNAT',
  pattern: '^[0-9]{11}$',
  isFiscal: true,
  iso6523Icd: null,
  allowedPartyTypes: ['ORGANIZATION'],
  isActive: true,
};

function draft(overrides: Partial<OrganizationDraft> = {}): OrganizationDraft {
  return { ...emptyDraft(TODAY), code: 'ACME', legalName: 'ACME S.A.C.', value: '20100412447', ...overrides };
}

describe('reglas de campo', () => {
  it('identificador: obligatorio, patrón del esquema y dígito verificador del RUC (módulo 11)', () => {
    expect(checkIdentifierValue('', RUC)).toEqual({ kind: 'required' });
    expect(checkIdentifierValue('2010', RUC)).toMatchObject({ kind: 'pattern', schemeCode: 'PE-RUC' });
    expect(checkIdentifierValue('20100412448', RUC)).toEqual({ kind: 'check_digit' });
    expect(checkIdentifierValue(' 2010-0412-447 ', RUC)).toBeNull();
    expect(checkIdentifierValue('123', undefined)).toBeNull();
  });

  it('fechas: formato, existencia y no anterior al inicio', () => {
    expect(checkDate('', { required: false, notBefore: null })).toBeNull();
    expect(checkDate('31/02/2026', { required: false, notBefore: null })).toEqual({ kind: 'date_invalid' });
    expect(checkDate('2026-02-31', { required: false, notBefore: null })).toEqual({ kind: 'date_invalid' });
    expect(checkDate('2026-01-01', { required: false, notBefore: '2026-02-01' })).toEqual({ kind: 'before', from: '2026-02-01' });
    expect(checkExpiryDate('2019-12-31', { validFrom: '2020-01-01' })).toEqual({ kind: 'before', from: '2020-01-01' });
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(limaToday(Date.parse('2026-10-25T04:59:00Z'))).toBe('2026-10-24');
  });
});

describe('borrador del alta (P-MDM-03)', () => {
  it('un borrador completo no tiene problemas y produce el cuerpo de P-02', () => {
    expect(validateOrganization(draft({ tradeName: '  ' }), [RUC], TODAY)).toEqual([]);
    expect(toRegisterRequest(draft({ tradeName: '  ', value: '2010 0412 447', validFrom: '' }))).toEqual({
      type: 'ORGANIZATION',
      code: 'ACME',
      legalName: 'ACME S.A.C.',
      tradeName: null,
      primaryIdentifier: { countryCode: 'PE', schemeCode: 'PE-RUC', value: '20100412447', validFrom: null },
      roles: [],
    });
  });

  it('los problemas salen en el orden de los campos; los roles iniciales no se cruzan', () => {
    const issues = validateOrganization(
      draft({
        code: '',
        value: '20100412448',
        roles: [
          { key: 1, roleTypeCode: 'CUSTOMER', validFrom: '2026-01-01', validTo: '' },
          { key: 2, roleTypeCode: 'CUSTOMER', validFrom: '2026-06-01', validTo: '2026-05-01' },
          { key: 3, roleTypeCode: 'CUSTOMER', validFrom: '2026-07-01', validTo: '' },
        ],
      }),
      [RUC],
      TODAY,
    );
    expect(issues.map((item) => [item.field, item.issue.kind])).toEqual([
      ['code', 'required'],
      ['value', 'check_digit'],
      ['role-2-validTo', 'before'],
      ['role-3-validTo', 'overlap'],
    ]);
  });

  it('el identificador de la URL se valida: lo que no tiene la forma del contrato se descarta', () => {
    expect(prefilledIdentifier(new URLSearchParams('pais=PE&esquema=PE-RUC&valor=2010-0412447'))).toEqual({
      countryCode: 'PE',
      schemeCode: 'PE-RUC',
      value: '20100412447',
    });
    expect(prefilledIdentifier(new URLSearchParams('pais=peru&esquema=PE-RUC&valor=1'))).toBeNull();
    expect(isDraftTouched(emptyDraft(TODAY), emptyDraft(TODAY))).toBe(false);
    expect(isDraftTouched({ ...emptyDraft(TODAY), legalName: 'X' }, emptyDraft(TODAY))).toBe(true);
  });
});

describe('agregar identificador (D-MDM-02)', () => {
  it('«Reemplaza» solo viaja con «Es primario»', () => {
    const base = { countryCode: 'PE', schemeCode: 'PE-RUC', value: '20100412447', validFrom: '', isPrimary: false, replacesPrimary: true };
    expect(toAddIdentifierRequest(base)).toMatchObject({ isPrimary: false, replacesPrimary: false, validFrom: null });
    expect(toAddIdentifierRequest({ ...base, isPrimary: true })).toMatchObject({ isPrimary: true, replacesPrimary: true });
    expect(validateIdentifierDraft({ ...base, schemeCode: '' }, [RUC])).toEqual({ schemeCode: { kind: 'required' } });
  });
});

describe('órdenes de la ficha según estado y rol', () => {
  const as = (role: Parameters<typeof can>[0]) => (action: Parameters<typeof can>[1]) => can(role, action);

  it('archivada o fusionada: ninguna (INV-PTY-11)', () => {
    expect([...availableCommands('Archived', as('RESPONSABLE_MDM'))]).toEqual([]);
    expect([...availableCommands('Merged', as('RESPONSABLE_MDM'))]).toEqual([]);
  });

  it('activa o suspendida: según la matriz supuesta; suspender y activar según el estado', () => {
    const party = ['rename', 'addIdentifier'];
    const roles = ['assignRole', 'suspendRole', 'activateRole'];
    const establishments = ['openEstablishment', 'editEstablishment', 'deactivateEstablishment', 'reactivateEstablishment'];
    const relationships = ['startRelationship', 'endRelationship'];
    expect([...availableCommands('Active', as('RESPONSABLE_MDM'))]).toEqual([
      'rename',
      'suspend',
      'archive',
      'addIdentifier',
      'expireIdentifier',
      ...roles,
      'terminateRole',
      ...establishments,
      'closeEstablishment',
      ...relationships,
    ]);
    expect([...availableCommands('Active', as('ANALISTA_DATOS_MAESTROS'))]).toEqual([...party, ...roles, ...establishments, ...relationships]);
    expect([...availableCommands('Active', as('CONSULTOR'))]).toEqual([]);
    // Las referencias externas son solo del integrador (SU-MDM-02).
    expect([...availableCommands('Active', as('INTEGRADOR_ERP'))]).toEqual(['linkReference', 'unlinkReference']);
  });

  it('suspendida: asignar y reactivar rol, abrir y reactivar establecimiento quedan bloqueados, no ocultos (contrato §6.2)', () => {
    expect([...availableCommands('Suspended', as('RESPONSABLE_MDM'))]).toEqual([
      'rename',
      'activate',
      'archive',
      'addIdentifier',
      'expireIdentifier',
      'suspendRole',
      'terminateRole',
      'editEstablishment',
      'deactivateEstablishment',
      'closeEstablishment',
      // Relaciones: el contrato solo las rechaza con la organización terminal (§6.2).
      'startRelationship',
      'endRelationship',
    ]);
    for (const command of ['assignRole', 'activateRole', 'openEstablishment', 'reactivateEstablishment'] as const) {
      expect(commandAvailability(command, 'Suspended', as('ANALISTA_DATOS_MAESTROS'))).toEqual({ kind: 'blocked', reason: 'party_suspended' });
      expect(commandAvailability(command, 'Suspended', as('CONSULTOR'))).toEqual({ kind: 'hidden' });
      expect(commandAvailability(command, 'Archived', as('RESPONSABLE_MDM'))).toEqual({ kind: 'hidden' });
    }
  });

  it('vencido es «hasta» anterior a hoy; uno futuro no lo está', () => {
    expect(isExpired({ validTo: '2026-10-23' }, TODAY)).toBe(true);
    expect(isExpired({ validTo: TODAY }, TODAY)).toBe(false);
    expect(isExpired({ validTo: null }, TODAY)).toBe(false);
  });
});
