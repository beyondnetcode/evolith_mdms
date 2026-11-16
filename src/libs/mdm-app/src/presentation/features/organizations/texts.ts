import type { IdentifierField } from '../../../domain/organization-search.ts';

const FIELD_NAME: Readonly<Record<IdentifierField, string>> = {
  countryCode: 'país',
  schemeCode: 'esquema',
  value: 'valor',
};

/** Microcopy de P-MDM-01 (UX-MDM-001 §5.3, §6.3 y §6.4). Propuesta sin validar con usuarios (SU-MDM-15). */
export const ORGANIZATIONS_TEXTS = {
  title: 'Organizaciones',
  searchLabel: 'Buscar por código, razón social o nombre comercial',
  identifierToggle: 'Buscar por identificador',
  identifierLegend: 'Buscar por identificador',
  identifierSubmit: 'Buscar',
  identifierClear: 'Quitar identificador',
  country: 'País',
  scheme: 'Esquema',
  value: 'Valor',
  roleFilter: 'Rol vigente',
  anyRole: 'Todos los roles',
  statusFilter: 'Estado',
  currentStatuses: 'Activas y suspendidas',
  clearFilters: 'Limpiar filtros',
  newOrganization: 'Nueva organización',
  loadMore: 'Cargar más',
  loading: 'las organizaciones',
  caption: (total: number) => `Organizaciones, ${total} ${total === 1 ? 'resultado' : 'resultados'}`,
  count: (total: number) => (total === 1 ? '1 organización' : `${total} organizaciones`),
  noPrimary: 'Sin identificador primario vigente',
  noRoles: 'Sin roles vigentes',
  emptyMaster: 'Aún no hay organizaciones registradas.',
  emptyText: (text: string) => `Ninguna organización coincide con «${text}».`,
  emptyTextHelp: 'Prueba con el identificador: es la búsqueda más segura.',
  emptyIdentifier: (scheme: string, value: string) => `No hay ninguna organización con ${scheme} ${value}, ni vigente ni vencido.`,
  emptyFilters: 'Ninguna organización coincide con estos filtros.',
  /** «Indica también el {país · esquema · valor} para buscar por identificador.» */
  identifierMissing: (field: IdentifierField) => `Indica también el ${FIELD_NAME[field]} para buscar por identificador.`,
} as const;

export const COLUMN_TEXTS = {
  code: 'Código',
  legalName: 'Razón social',
  tradeName: 'Nombre comercial',
  identifier: 'Identificador',
  roles: 'Roles vigentes',
  status: 'Estado',
  updatedAt: 'Actualizada',
} as const;
