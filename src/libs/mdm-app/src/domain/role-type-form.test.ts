import { describe, expect, it } from 'vitest';
import { draftFromRoleType, emptyRoleTypeDraft, isRoleTypeDraftDirty, toCreateRoleTypeRequest, toRoleTypeInput, validateRoleTypeDraft } from './role-type-form.ts';

const CREATING = { creating: true, takenCodes: ['CARRIER', 'FREIGHT_FORWARDER'] };

describe('formulario de tipo de rol (US-MDM-014, D-046)', () => {
  it('un tipo nuevo nace admitido para organizaciones y sin errores de tipo de parte', () => {
    const draft = emptyRoleTypeDraft();
    expect(draft).toMatchObject({ organization: true, person: false });
    expect(validateRoleTypeDraft(draft, CREATING)).toEqual({ code: { kind: 'required' }, name: { kind: 'required' } });
  });

  it('el código se valida normalizado y no se reutiliza, ni el de un tipo desactivado', () => {
    const base = { ...emptyRoleTypeDraft(), name: 'X' };
    expect(validateRoleTypeDraft({ ...base, code: ' agente de-carga ' }, CREATING)).toEqual({});
    expect(validateRoleTypeDraft({ ...base, code: '1AGENTE' }, CREATING)).toEqual({ code: { kind: 'code_format' } });
    expect(validateRoleTypeDraft({ ...base, code: 'freight forwarder' }, CREATING)).toEqual({ code: { kind: 'taken' } });
    // Al editar, el código no se valida: es inmutable.
    expect(validateRoleTypeDraft({ ...base, code: 'CARRIER' }, { ...CREATING, creating: false })).toEqual({});
  });

  it('EDIFACT de dos letras, descripción hasta 500, nombre hasta 200 y al menos un tipo de parte', () => {
    const base = { ...emptyRoleTypeDraft(), code: 'X1', name: 'X' };
    expect(validateRoleTypeDraft({ ...base, unEdifact3035Code: 'c1' }, CREATING)).toEqual({ unEdifact3035Code: { kind: 'edifact_format' } });
    expect(validateRoleTypeDraft({ ...base, unEdifact3035Code: 'cn' }, CREATING)).toEqual({});
    expect(validateRoleTypeDraft({ ...base, description: 'x'.repeat(501) }, CREATING)).toEqual({ description: { kind: 'too_long' } });
    expect(validateRoleTypeDraft({ ...base, name: 'x'.repeat(201) }, CREATING)).toEqual({ name: { kind: 'too_long' } });
    expect(validateRoleTypeDraft({ ...base, organization: false }, CREATING)).toEqual({ allowedPartyTypes: { kind: 'required' } });
  });

  it('el cuerpo va normalizado: código en MAYÚSCULAS_CON_GUION_BAJO, vacíos como null', () => {
    const draft = { ...emptyRoleTypeDraft(), code: 'operador portuario', name: '  Operador ', description: '  ', unEdifact3035Code: 'pw', person: true };
    expect(toCreateRoleTypeRequest(draft)).toEqual({
      code: 'OPERADOR_PORTUARIO',
      name: 'Operador',
      description: null,
      unEdifact3035Code: 'PW',
      allowedPartyTypes: ['ORGANIZATION', 'PERSON'],
      requiresFiscalIdentifier: false,
    });
  });

  it('del tipo al borrador y vuelta, sin cambios no está sucio', () => {
    const type = {
      code: 'CONSIGNEE',
      name: 'Consignatario',
      description: null,
      unEdifact3035Code: 'CN',
      allowedPartyTypes: ['ORGANIZATION', 'PERSON'] as const,
      requiresFiscalIdentifier: false,
      isActive: true,
      version: 1,
      createdAt: '2024-03-01T14:00:00.000+00:00',
      createdBy: 'carga-inicial',
      updatedAt: null,
      updatedBy: null,
    };
    const draft = draftFromRoleType(type);
    expect(isRoleTypeDraftDirty(draft, draft)).toBe(false);
    expect(isRoleTypeDraftDirty(draft, { ...draft, requiresFiscalIdentifier: true })).toBe(true);
    expect(toRoleTypeInput(draft)).toEqual({ name: 'Consignatario', description: null, unEdifact3035Code: 'CN', allowedPartyTypes: ['ORGANIZATION', 'PERSON'], requiresFiscalIdentifier: false });
  });
});
