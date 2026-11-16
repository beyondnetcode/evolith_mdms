import { MAX_PAGE_SIZE, type EstablishmentStatusFilter, type ExternalKeyFilter, type MdmGateway, type MdmRole, type PartyQuery } from '@mdm/contracts';
import { keepPreviousData, queryOptions } from '@tanstack/react-query';

/**
 * Estado de servidor de MDM: lo gestiona TanStack Query, no el estado de UI (D-024). Las claves incluyen el rol
 * porque la caché de un perfil no debe servirse a otro.
 */
/** Raíz de las consultas del catálogo de tipos de rol: se invalida entera tras escribir en él (C-05 a C-08). */
export const ROLE_TYPES_KEY = ['mdm', 'catalogs', 'role-types'] as const;

/** Los tipos que se ofrecen al asignar un rol: solo los activos (D-046). */
export function assignableRoleTypes<T extends { readonly isActive: boolean }>(types: readonly T[]): readonly T[] {
  return types.filter((type) => type.isActive);
}

export const mdmQueries = {
  parties: (gateway: MdmGateway, role: MdmRole, query: PartyQuery) =>
    queryOptions({
      queryKey: ['mdm', role, 'parties', query],
      queryFn: ({ signal }) => gateway.listParties(query, { signal }),
      // Mientras llega la página nueva se conserva la anterior: la búsqueda sigue activa y la tabla no salta.
      placeholderData: keepPreviousData,
    }),
  party: (gateway: MdmGateway, role: MdmRole, partyId: string) =>
    queryOptions({
      queryKey: ['mdm', role, 'party', partyId],
      queryFn: ({ signal }) => gateway.getParty(partyId, { signal }),
    }),
  /**
   * P-16 con el filtro de la sección (`null` es «Todos»). La clave cuelga de la de la ficha: al refrescarla tras una
   * escritura (`PartyCache.afterWrite`) también se refrescan los establecimientos.
   */
  establishments: (gateway: MdmGateway, role: MdmRole, partyId: string, status: EstablishmentStatusFilter | null) =>
    queryOptions({
      queryKey: ['mdm', role, 'party', partyId, 'establishments', status ?? 'all'],
      queryFn: ({ signal }) => gateway.listEstablishments(partyId, status, { signal }),
    }),
  /** X-01 de un establecimiento: cuántas referencias vinculadas tiene (prerrequisito de D-MDM-09). */
  establishmentReferences: (gateway: MdmGateway, role: MdmRole, partyId: string, establishmentId: string) =>
    queryOptions({
      queryKey: ['mdm', role, 'party', partyId, 'external-references', establishmentId],
      queryFn: ({ signal }) =>
        gateway.listExternalReferences(
          { partyId: null, mdmObject: { type: 'ESTABLISHMENT', id: establishmentId }, externalKey: null, syncStatus: null, page: 1, pageSize: MAX_PAGE_SIZE },
          { signal },
        ),
    }),
  /**
   * R-01 de una organización, en cualquiera de los dos extremos. Se carga al abrir la pestaña (UX-MDM-001 §5.4). La
   * clave cuelga de la de la ficha. Una página de 100 (el máximo del contrato): si hay más, la sección lo dice.
   */
  relationships: (gateway: MdmGateway, role: MdmRole, partyId: string, currentOnly: boolean) =>
    queryOptions({
      queryKey: ['mdm', role, 'party', partyId, 'relationships', currentOnly ? 'current' : 'all'],
      queryFn: ({ signal }) => gateway.listRelationships({ partyId, kindCode: null, currentOnly, page: 1, pageSize: MAX_PAGE_SIZE }, { signal }),
    }),
  /**
   * X-01 de una organización: las suyas y las de sus establecimientos (`partyId` es la dueña). La pestaña
   * Referencias externas y el detalle de cada establecimiento leen de esta misma consulta.
   */
  partyReferences: (gateway: MdmGateway, role: MdmRole, partyId: string) =>
    queryOptions({
      queryKey: ['mdm', role, 'party', partyId, 'external-references', 'all'],
      queryFn: ({ signal }) =>
        gateway.listExternalReferences({ partyId, mdmObject: null, externalKey: null, syncStatus: null, page: 1, pageSize: MAX_PAGE_SIZE }, { signal }),
    }),
  /** X-01 por la clave completa: a qué objeto está vinculada (tras `external_reference.key_duplicate`). */
  referenceByKey: (gateway: MdmGateway, role: MdmRole, key: ExternalKeyFilter) =>
    queryOptions({
      queryKey: ['mdm', role, 'external-reference-key', key],
      queryFn: ({ signal }) => gateway.listExternalReferences({ partyId: null, mdmObject: null, externalKey: key, syncStatus: null, page: 1, pageSize: 1 }, { signal }),
      staleTime: 0,
    }),
  /**
   * P-01 del buscador de D-MDM-06 (SU-MDM-08): por texto (código o nombres) o, si son solo dígitos, por RUC. Sin
   * `status`, el servidor excluye las archivadas y fusionadas; la búsqueda por identificador las incluye y se filtran
   * en la presentación.
   */
  partySearch: (gateway: MdmGateway, role: MdmRole, text: string) =>
    queryOptions({
      queryKey: ['mdm', role, 'party-search', text],
      queryFn: ({ signal }) => gateway.listParties(partySearchQuery(text), { signal }),
      staleTime: 30_000,
    }),
  relationshipKinds: (gateway: MdmGateway) =>
    queryOptions({
      queryKey: ['mdm', 'catalogs', 'relationship-kinds'],
      queryFn: ({ signal }) => gateway.listRelationshipKinds({ signal }),
      staleTime: 5 * 60_000,
    }),
  /**
   * C-02 de organización, con los desactivados: hacen falta para nombrar los roles existentes de un tipo desactivado
   * (D-046). Lo que se ofrece para asignar se filtra a los activos (`assignableRoleTypes`).
   */
  roleTypes: (gateway: MdmGateway) =>
    queryOptions({
      queryKey: [...ROLE_TYPES_KEY, 'organization'],
      queryFn: ({ signal }) => gateway.listRoleTypes({ partyType: 'ORGANIZATION', includeInactive: true }, { signal }),
      staleTime: 5 * 60_000,
    }),
  /** C-02 completo para P-MDM-04 (D-046): todos los tipos de parte y estados, siempre fresco al entrar. */
  roleTypeCatalog: (gateway: MdmGateway) =>
    queryOptions({
      queryKey: [...ROLE_TYPES_KEY, 'all'],
      queryFn: ({ signal }) => gateway.listRoleTypes({ partyType: null, includeInactive: true }, { signal }),
      staleTime: 0,
    }),
  identifierSchemes: (gateway: MdmGateway) =>
    queryOptions({
      queryKey: ['mdm', 'catalogs', 'identifier-schemes'],
      queryFn: ({ signal }) => gateway.listIdentifierSchemes({ countryCode: null, partyType: 'ORGANIZATION', includeInactive: false }, { signal }),
      staleTime: 5 * 60_000,
    }),
  establishmentKinds: (gateway: MdmGateway) =>
    queryOptions({
      queryKey: ['mdm', 'catalogs', 'establishment-kinds'],
      queryFn: ({ signal }) => gateway.listEstablishmentKinds({ signal }),
      staleTime: 5 * 60_000,
    }),
};

/** Resultados del buscador: pocos, los más parecidos por código. */
const SEARCH_PAGE_SIZE = 8;
const RUC_LIKE = /^\d{11}$/;

export function partySearchQuery(text: string): PartyQuery {
  const clean = text.trim();
  const byRuc = RUC_LIKE.test(clean);
  return {
    search: byRuc ? null : clean,
    roleTypeCode: null,
    status: null,
    type: 'ORGANIZATION',
    identifier: byRuc ? { countryCode: 'PE', schemeCode: 'PE-RUC', value: clean } : null,
    sortBy: 'code',
    sortOrder: 'asc',
    page: 1,
    pageSize: SEARCH_PAGE_SIZE,
  };
}
