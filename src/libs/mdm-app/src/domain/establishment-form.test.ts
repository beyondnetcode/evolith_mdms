import type { Establishment } from '@mdm/contracts';
import { describe, expect, it } from 'vitest';
import {
  draftFromEstablishment,
  emptyEstablishmentDraft,
  establishmentRowCommands,
  establishmentState,
  findActivePrincipal,
  toEstablishmentInput,
  toOpenEstablishmentRequest,
  validateEstablishmentDraft,
} from './establishment-form.ts';

function establishment(fields: Partial<Establishment>): Establishment {
  return {
    id: 'e0000000-0000-4000-8000-000000000001',
    partyId: 'b0000000-0000-4000-8000-000000000001',
    code: 'CALLAO',
    kindCode: 'BRANCH',
    name: 'Sede Callao',
    taxEstablishmentCode: '0001',
    isPrincipal: true,
    isActive: true,
    isClosed: false,
    closedAt: null,
    closedBy: null,
    address: { line1: 'Av. 1', line2: null, ubigeo: '070101', department: null, province: null, district: null, postalCode: null, countryCode: 'PE', reference: null },
    ...fields,
  };
}

describe('estado del establecimiento (UI-MDM-001 §2.3)', () => {
  it('activo, inactivo o cerrado; cerrado no admite órdenes (INV-PTY-10)', () => {
    expect(establishmentState(establishment({}))).toEqual({ kind: 'active' });
    expect(establishmentState(establishment({ isActive: false }))).toEqual({ kind: 'inactive' });
    expect(establishmentState(establishment({ isActive: false, isClosed: true, closedAt: '2026-10-01T10:00:00.000+00:00' }))).toEqual({
      kind: 'closed',
      closedAt: '2026-10-01T10:00:00.000+00:00',
    });
    expect(establishmentRowCommands(establishment({}))).toEqual(['editEstablishment', 'deactivateEstablishment', 'closeEstablishment']);
    expect(establishmentRowCommands(establishment({ isActive: false }))).toEqual(['editEstablishment', 'reactivateEstablishment', 'closeEstablishment']);
    expect(establishmentRowCommands(establishment({ isClosed: true, isActive: false }))).toEqual([]);
  });

  it('el principal activo, sin contar el que se edita ni los inactivos o cerrados (INV-PTY-09)', () => {
    const principal = establishment({});
    const other = establishment({ id: 'e0000000-0000-4000-8000-000000000002', code: 'PIURA', isPrincipal: true, isActive: false });
    expect(findActivePrincipal([principal, other], null)?.code).toBe('CALLAO');
    expect(findActivePrincipal([principal, other], principal.id)).toBeUndefined();
  });
});

describe('D-MDM-05 Abrir o editar establecimiento (US-MDM-009)', () => {
  const rules = { creating: true, takenCodes: ['CALLAO'] };

  it('obligatorios: código, tipo, nombre, línea 1 y país', () => {
    expect(validateEstablishmentDraft({ ...emptyEstablishmentDraft(), countryCode: '' }, rules)).toEqual({
      code: { kind: 'required' },
      kindCode: { kind: 'required' },
      name: { kind: 'required' },
      line1: { kind: 'required' },
      countryCode: { kind: 'required' },
    });
  });

  it('código ya usado (aunque esté cerrado), anexo de 4 dígitos y ubigeo solo en Perú', () => {
    const draft = { ...emptyEstablishmentDraft(), code: ' callao ', kindCode: 'BRANCH', name: 'X', line1: 'Av. 2', taxEstablishmentCode: '12', ubigeo: '15010' };
    expect(validateEstablishmentDraft(draft, rules)).toEqual({ code: { kind: 'taken' }, taxEstablishmentCode: { kind: 'format' }, ubigeo: { kind: 'format' } });
    expect(validateEstablishmentDraft({ ...draft, code: 'LURIN', taxEstablishmentCode: '0002', ubigeo: '150101', countryCode: 'cl' }, rules)).toEqual({
      ubigeo: { kind: 'not_applicable' },
    });
    expect(validateEstablishmentDraft({ ...draft, code: 'LURIN', taxEstablishmentCode: '', ubigeo: '', countryCode: 'PER' }, rules)).toEqual({
      countryCode: { kind: 'format' },
    });
  });

  it('al editar, el código es inmutable y no se valida', () => {
    const draft = draftFromEstablishment(establishment({}));
    expect(validateEstablishmentDraft(draft, { creating: false, takenCodes: ['CALLAO'] })).toEqual({});
  });

  it('cuerpos de P-18 y P-19: vacío es null, código normalizado y país en mayúsculas', () => {
    const draft = { ...emptyEstablishmentDraft(), code: 'planta lurin', kindCode: 'PLANT', name: ' Planta ', line1: ' Av. 3 ', countryCode: 'pe' };
    expect(toOpenEstablishmentRequest(draft)).toMatchObject({ code: 'PLANTA_LURIN', name: 'Planta', taxEstablishmentCode: null });
    expect(toEstablishmentInput(draft).address).toEqual({
      line1: 'Av. 3',
      line2: null,
      ubigeo: null,
      department: null,
      province: null,
      district: null,
      postalCode: null,
      countryCode: 'PE',
      reference: null,
    });
    expect(toEstablishmentInput(draft)).not.toHaveProperty('code');
  });
});
