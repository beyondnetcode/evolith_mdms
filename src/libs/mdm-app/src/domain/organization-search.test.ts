import { describe, expect, it } from 'vitest';
import { MDM_DESCRIPTOR } from './mdm-descriptor.ts';
import {
  EMPTY_SEARCH,
  checkIdentifierDraft,
  hasFilters,
  nextSort,
  parseOrganizationSearch,
  toPartyQuery,
  toSearchParams,
} from './organization-search.ts';
import { can } from './permissions.ts';

describe('búsqueda de P-MDM-01 en la dirección', () => {
  it('ida y vuelta: lo que se escribe en la URL se lee igual', () => {
    const search = {
      ...EMPTY_SEARCH,
      text: 'acme',
      roleTypeCode: 'CUSTOMER',
      status: 'Suspended' as const,
      identifier: { countryCode: 'PE', schemeCode: 'PE-RUC', value: '20601234565' },
      sort: { field: 'legalName' as const, order: 'desc' as const },
      page: 3,
      pageSize: 50 as const,
    };
    const params = toSearchParams(search);
    expect(params.toString()).toBe('q=acme&rol=CUSTOMER&estado=suspendida&pais=PE&esquema=PE-RUC&valor=20601234565&orden=razon-social&dir=desc&pagina=3&filas=50');
    expect(parseOrganizationSearch(params)).toEqual(search);
  });

  it('los valores por defecto no ensucian la URL', () => {
    expect(toSearchParams(EMPTY_SEARCH).toString()).toBe('');
  });

  it('lo que llega por la URL es entrada no confiable: lo inválido vuelve al valor por defecto', () => {
    const search = parseOrganizationSearch(new URLSearchParams('rol=<script>&estado=borrada&pagina=-2&filas=7&orden=x&pais=peru&esquema=PE-RUC&valor=1'));
    expect(search).toEqual(EMPTY_SEARCH);
  });

  it('a la consulta de P-01: sin texto es null y la paginación se puede forzar', () => {
    const query = toPartyQuery({ ...EMPTY_SEARCH, page: 4 }, { page: 1, pageSize: 60 });
    expect(query).toMatchObject({ search: null, status: null, identifier: null, sortBy: 'code', sortOrder: 'asc', page: 1, pageSize: 60 });
  });

  it('ordenar por la misma columna invierte el sentido; por otra, empieza ascendente', () => {
    expect(nextSort({ field: 'code', order: 'asc' }, 'code')).toEqual({ field: 'code', order: 'desc' });
    expect(nextSort({ field: 'code', order: 'desc' }, 'updatedAt')).toEqual({ field: 'updatedAt', order: 'asc' });
  });

  it('«Limpiar filtros» solo aparece con texto, rol, estado o identificador', () => {
    expect(hasFilters(EMPTY_SEARCH)).toBe(false);
    expect(hasFilters({ ...EMPTY_SEARCH, page: 2 })).toBe(false);
    expect(hasFilters({ ...EMPTY_SEARCH, roleTypeCode: 'CARRIER' })).toBe(true);
  });
});

describe('búsqueda por identificador: los tres datos o ninguno', () => {
  it('con los tres, normaliza el valor; sin ninguno, no hay filtro; con uno o dos, dice qué falta', () => {
    expect(checkIdentifierDraft({ countryCode: 'PE', schemeCode: 'PE-RUC', value: ' 20-100412447 ' })).toEqual({
      kind: 'complete',
      filter: { countryCode: 'PE', schemeCode: 'PE-RUC', value: '20100412447' },
    });
    expect(checkIdentifierDraft({ countryCode: '', schemeCode: '', value: '  ' })).toEqual({ kind: 'empty' });
    expect(checkIdentifierDraft({ countryCode: 'PE', schemeCode: '', value: '' })).toEqual({ kind: 'incomplete', missing: ['schemeCode', 'value'] });
  });
});

describe('MDM ante la suite', () => {
  it('reconoce solo sus roles y los nombra', () => {
    expect(MDM_DESCRIPTOR.code).toBe('MDM');
    expect(MDM_DESCRIPTOR.roleLabel('ANALISTA_DATOS_MAESTROS')).toBe('Analista de datos maestros');
    expect(MDM_DESCRIPTOR.roleLabel('Consulta')).toBeNull();
  });

  it('matriz rol × acción (supuesto SU-MDM-02): registrar es de analista y responsable; vincular el ERP, del integrador', () => {
    expect(can('ANALISTA_DATOS_MAESTROS', 'organization.register')).toBe(true);
    expect(can('CONSULTOR', 'organization.register')).toBe(false);
    expect(can('ANALISTA_DATOS_MAESTROS', 'organization.archive')).toBe(false);
    expect(can('INTEGRADOR_ERP', 'externalReference.maintain')).toBe(true);
    expect(can('RESPONSABLE_MDM', 'externalReference.maintain')).toBe(false);
  });

  it('mantenimiento geográfico sigue los roles provisionales del mock (G-622)', () => {
    expect(can('RESPONSABLE_MDM', 'geography.maintain')).toBe(true);
    expect(can('RESPONSABLE_GEOGRAFIA', 'geography.maintain')).toBe(true);
    expect(can('ANALISTA_DATOS_MAESTROS', 'geography.maintain')).toBe(true);
    expect(can('CONSULTOR', 'geography.maintain')).toBe(false);
    expect(can('RESPONSABLE_MDM', 'geography.approve')).toBe(true);
    expect(can('RESPONSABLE_GEOGRAFIA', 'geography.approve')).toBe(true);
    expect(can('ANALISTA_DATOS_MAESTROS', 'geography.approve')).toBe(true);
  });
});
