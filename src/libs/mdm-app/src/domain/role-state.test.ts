import type { PartyRole } from '@mdm/contracts';
import { describe, expect, it } from 'vitest';
import {
  checkTerminationDate,
  compareRoles,
  defaultTerminationDate,
  findLoadedOverlap,
  isHistoricalRole,
  roleDisplayState,
  roleRowCommands,
  toRoleInput,
  validateRoleDraft,
} from './role-state.ts';

const TODAY = '2026-10-24';

function role(fields: Partial<PartyRole>): PartyRole {
  return {
    roleId: 'd0000000-0000-4000-8000-000000000001',
    roleTypeCode: 'CUSTOMER',
    status: 'Active',
    validFrom: '2024-03-01',
    validTo: null,
    isCurrent: true,
    ...fields,
  };
}

describe('estado visible del rol (UI-MDM-001 §2.2)', () => {
  it('la vigencia manda sobre el estado: vigente, futuro y vencido', () => {
    expect(roleDisplayState(role({}), TODAY)).toEqual({ kind: 'current' });
    expect(roleDisplayState(role({ isCurrent: false, validFrom: '2099-01-01' }), TODAY)).toEqual({ kind: 'future', startsOn: '2099-01-01' });
    expect(roleDisplayState(role({ isCurrent: false, validTo: '2025-12-31' }), TODAY)).toEqual({ kind: 'expired', endedOn: '2025-12-31' });
  });

  it('suspendido y terminado, aunque estén en vigencia', () => {
    expect(roleDisplayState(role({ status: 'Suspended', isCurrent: false }), TODAY)).toEqual({ kind: 'suspended' });
    expect(roleDisplayState(role({ status: 'Terminated', isCurrent: false, validTo: TODAY }), TODAY)).toEqual({ kind: 'terminated' });
  });

  it('histórico es terminado o vencido; suspendido y futuro no lo son', () => {
    expect(isHistoricalRole(role({ status: 'Terminated' }), TODAY)).toBe(true);
    expect(isHistoricalRole(role({ validTo: '2026-10-23' }), TODAY)).toBe(true);
    expect(isHistoricalRole(role({ validTo: TODAY }), TODAY)).toBe(false);
    expect(isHistoricalRole(role({ status: 'Suspended' }), TODAY)).toBe(false);
    expect(isHistoricalRole(role({ validFrom: '2099-01-01', isCurrent: false }), TODAY)).toBe(false);
  });

  it('ordena vigentes, futuros, suspendidos, vencidos y terminados', () => {
    const roles = [
      role({ roleTypeCode: 'T', status: 'Terminated' }),
      role({ roleTypeCode: 'V', isCurrent: false, validTo: '2025-01-01' }),
      role({ roleTypeCode: 'S', status: 'Suspended' }),
      role({ roleTypeCode: 'F', isCurrent: false, validFrom: '2099-01-01' }),
      role({ roleTypeCode: 'C' }),
    ];
    expect(roles.toSorted(compareRoles(TODAY)).map((item) => item.roleTypeCode)).toEqual(['C', 'F', 'S', 'V', 'T']);
  });

  it('órdenes por fila: un terminado no tiene ninguna', () => {
    expect(roleRowCommands(role({}))).toEqual(['suspendRole', 'terminateRole']);
    expect(roleRowCommands(role({ status: 'Suspended' }))).toEqual(['activateRole', 'terminateRole']);
    expect(roleRowCommands(role({ status: 'Terminated' }))).toEqual([]);
  });
});

describe('D-MDM-04 Asignar rol (US-MDM-007)', () => {
  const loaded = [role({ roleTypeCode: 'CARRIER', validFrom: '2024-03-01', validTo: '2025-12-31', isCurrent: false })];

  it('tipo obligatorio y «hasta» no anterior a «desde»', () => {
    expect(validateRoleDraft({ roleTypeCode: '', validFrom: TODAY, validTo: '2026-01-01' }, [], TODAY)).toEqual({
      roleTypeCode: { kind: 'required' },
      validTo: { kind: 'before', from: TODAY },
    });
  });

  it('detecta el solape con un rol cargado del mismo tipo no terminado (INV-PTY-05)', () => {
    const draft = { roleTypeCode: 'CARRIER', validFrom: '2025-06-01', validTo: '' };
    expect(findLoadedOverlap(draft, loaded, TODAY)?.roleTypeCode).toBe('CARRIER');
    expect(validateRoleDraft(draft, loaded, TODAY).validTo).toEqual({ kind: 'overlap', roleTypeCode: 'CARRIER', validFrom: '2024-03-01', validTo: '2025-12-31' });
    // Sin cruce de fechas, terminado o de otro tipo: no hay solape.
    expect(findLoadedOverlap({ ...draft, validFrom: '2026-01-01' }, loaded, TODAY)).toBeNull();
    expect(findLoadedOverlap(draft, [role({ ...loaded[0], status: 'Terminated' })], TODAY)).toBeNull();
    expect(findLoadedOverlap({ ...draft, roleTypeCode: 'CUSTOMER' }, loaded, TODAY)).toBeNull();
  });

  it('lo vacío viaja como null: hoy e indefinido (P-12)', () => {
    expect(toRoleInput({ roleTypeCode: 'CUSTOMER', validFrom: '', validTo: '' })).toEqual({ roleTypeCode: 'CUSTOMER', validFrom: null, validTo: null });
  });
});

describe('D-MDM-10 Terminar rol (US-MDM-008)', () => {
  it('«Termina el» por defecto es hoy, acotado a la vigencia del rol', () => {
    expect(defaultTerminationDate({ validFrom: '2024-03-01', validTo: null }, TODAY)).toBe(TODAY);
    expect(defaultTerminationDate({ validFrom: '2024-03-01', validTo: '2025-12-31' }, TODAY)).toBe('2025-12-31');
    expect(defaultTerminationDate({ validFrom: '2099-01-01', validTo: null }, TODAY)).toBe('2099-01-01');
  });

  it('entre «desde» y el «hasta» vigente (P-15)', () => {
    expect(checkTerminationDate('2024-01-01', { validFrom: '2024-03-01', validTo: null }, TODAY)).toEqual({ kind: 'before', from: '2024-03-01' });
    expect(checkTerminationDate('2026-01-01', { validFrom: '2024-03-01', validTo: '2025-12-31' }, TODAY)).toEqual({
      kind: 'out_of_range',
      from: '2024-03-01',
      to: '2025-12-31',
    });
    expect(checkTerminationDate('2025-06-30', { validFrom: '2024-03-01', validTo: '2025-12-31' }, TODAY)).toBeNull();
    expect(checkTerminationDate('', { validFrom: '2024-03-01', validTo: null }, TODAY)).toBeNull();
    expect(checkTerminationDate('2026-02-30', { validFrom: '2024-03-01', validTo: null }, TODAY)).toEqual({ kind: 'date_invalid' });
  });
});
