import { DEFAULT_PAGE_SIZE, PARTY_STATUSES, normalizeIdentifierValue, type IdentifierFilter, type PartyQuery, type PartyStatus, type SortOrder } from '@mdm/contracts';

/**
 * Búsqueda de P-MDM-01 como estado de la dirección (SU-MDM-13): se puede guardar y compartir. Lo que llega por la
 * URL es entrada no confiable: se valida campo a campo y lo desconocido vuelve al valor por defecto. Los nombres
 * de los parámetros y sus valores van en español porque son parte de la URL (D-025).
 */

export const ORGANIZATION_SORT_FIELDS = ['code', 'legalName', 'updatedAt'] as const;
export type OrganizationSortField = (typeof ORGANIZATION_SORT_FIELDS)[number];

export const PAGE_SIZES = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export interface OrganizationSort {
  readonly field: OrganizationSortField;
  readonly order: SortOrder;
}

export interface OrganizationSearch {
  /** Texto contenido en código, razón social o nombre comercial; `''` sin texto. */
  readonly text: string;
  /** Rol vigente (C-02). */
  readonly roleTypeCode: string | null;
  /** `null`: activas y suspendidas (P-01 excluye por defecto las archivadas y fusionadas). */
  readonly status: PartyStatus | null;
  /** Búsqueda exacta: los tres datos o ninguno. */
  readonly identifier: IdentifierFilter | null;
  readonly sort: OrganizationSort;
  readonly page: number;
  readonly pageSize: PageSize;
}

export const DEFAULT_SORT: OrganizationSort = { field: 'code', order: 'asc' };

export const EMPTY_SEARCH: OrganizationSearch = {
  text: '',
  roleTypeCode: null,
  status: null,
  identifier: null,
  sort: DEFAULT_SORT,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

/** Valor en la URL de cada estado de la Party. */
export const STATUS_PARAM: Readonly<Record<PartyStatus, string>> = {
  Active: 'activa',
  Suspended: 'suspendida',
  Archived: 'archivada',
  Merged: 'fusionada',
};

const SORT_PARAM: Readonly<Record<OrganizationSortField, string>> = {
  code: 'codigo',
  legalName: 'razon-social',
  updatedAt: 'actualizada',
};

const MAX_TEXT = 200;
const COUNTRY = /^[A-Z]{2}$/;
const CATALOG_CODE = /^[A-Z0-9_-]{1,50}$/;

function keyOf<K extends string>(keys: readonly K[], record: Readonly<Record<K, string>>, value: string | null): K | null {
  return keys.find((key) => record[key] === value) ?? null;
}

function positiveInteger(value: string | null, fallback: number): number {
  const number = Number(value);
  return value !== null && Number.isInteger(number) && number >= 1 ? number : fallback;
}

function pageSizeOf(value: string | null): PageSize {
  return PAGE_SIZES.find((size) => String(size) === value) ?? DEFAULT_PAGE_SIZE;
}

function identifierOf(params: URLSearchParams): IdentifierFilter | null {
  const countryCode = params.get('pais') ?? '';
  const schemeCode = params.get('esquema') ?? '';
  const value = normalizeIdentifierValue(params.get('valor') ?? '').slice(0, 50);
  return COUNTRY.test(countryCode) && CATALOG_CODE.test(schemeCode) && value !== '' ? { countryCode, schemeCode, value } : null;
}

export function parseOrganizationSearch(params: URLSearchParams): OrganizationSearch {
  const role = params.get('rol');
  return {
    text: (params.get('q') ?? '').trim().slice(0, MAX_TEXT),
    roleTypeCode: role !== null && CATALOG_CODE.test(role) ? role : null,
    status: keyOf(PARTY_STATUSES, STATUS_PARAM, params.get('estado')),
    identifier: identifierOf(params),
    sort: {
      field: keyOf(ORGANIZATION_SORT_FIELDS, SORT_PARAM, params.get('orden')) ?? DEFAULT_SORT.field,
      order: params.get('dir') === 'desc' ? 'desc' : 'asc',
    },
    page: positiveInteger(params.get('pagina'), 1),
    pageSize: pageSizeOf(params.get('filas')),
  };
}

/** A la URL solo va lo que difiere del valor por defecto. */
export function toSearchParams(search: OrganizationSearch): URLSearchParams {
  const params = new URLSearchParams();
  if (search.text !== '') params.set('q', search.text);
  if (search.roleTypeCode !== null) params.set('rol', search.roleTypeCode);
  if (search.status !== null) params.set('estado', STATUS_PARAM[search.status]);
  if (search.identifier !== null) {
    params.set('pais', search.identifier.countryCode);
    params.set('esquema', search.identifier.schemeCode);
    params.set('valor', search.identifier.value);
  }
  if (search.sort.field !== DEFAULT_SORT.field) params.set('orden', SORT_PARAM[search.sort.field]);
  if (search.sort.order !== DEFAULT_SORT.order) params.set('dir', search.sort.order);
  if (search.page !== 1) params.set('pagina', String(search.page));
  if (search.pageSize !== DEFAULT_PAGE_SIZE) params.set('filas', String(search.pageSize));
  return params;
}

/** ¿Hay algo que «Limpiar filtros» pueda quitar? */
export function hasFilters(search: OrganizationSearch): boolean {
  return search.text !== '' || search.roleTypeCode !== null || search.status !== null || search.identifier !== null;
}

/** Consulta de P-01. `pageSize` y `page` pueden forzarse (la lista de `compact` crece con «Cargar más»). */
export function toPartyQuery(search: OrganizationSearch, paging: { readonly page: number; readonly pageSize: number } = search): PartyQuery {
  return {
    search: search.text === '' ? null : search.text,
    roleTypeCode: search.roleTypeCode,
    status: search.status,
    type: null,
    identifier: search.identifier,
    sortBy: search.sort.field,
    sortOrder: search.sort.order,
    page: paging.page,
    pageSize: paging.pageSize,
  };
}

/** Pulsar una cabecera: la misma columna invierte el sentido; otra columna empieza ascendente. */
export function nextSort(current: OrganizationSort, field: OrganizationSortField): OrganizationSort {
  return current.field === field ? { field, order: current.order === 'asc' ? 'desc' : 'asc' } : { field, order: 'asc' };
}

export type IdentifierField = keyof IdentifierFilter;

/** Orden de los campos de la búsqueda por identificador: país, esquema y valor. */
export const IDENTIFIER_FIELDS: readonly IdentifierField[] = ['countryCode', 'schemeCode', 'value'];

export interface IdentifierDraft {
  readonly countryCode: string;
  readonly schemeCode: string;
  readonly value: string;
}

/** Resultado de comprobar la búsqueda por identificador antes de enviarla (UX-MDM-001 §6.3). */
export type IdentifierDraftCheck =
  | { readonly kind: 'complete'; readonly filter: IdentifierFilter }
  | { readonly kind: 'empty' }
  | { readonly kind: 'incomplete'; readonly missing: readonly IdentifierField[] };

/** Los tres datos o ninguno: con uno o dos, la interfaz no envía la petición y señala qué falta. */
export function checkIdentifierDraft(draft: IdentifierDraft): IdentifierDraftCheck {
  const filter: IdentifierFilter = {
    countryCode: draft.countryCode.trim(),
    schemeCode: draft.schemeCode.trim(),
    value: normalizeIdentifierValue(draft.value),
  };
  const missing = IDENTIFIER_FIELDS.filter((field) => filter[field] === '');
  if (missing.length === 3) return { kind: 'empty' };
  return missing.length === 0 ? { kind: 'complete', filter } : { kind: 'incomplete', missing };
}
