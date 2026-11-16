import type { EstablishmentKind, IdentifierScheme, PartyRoleType, RelationshipKind } from '@mdm/contracts';

/**
 * Catálogos de ejemplo (C-01 a C-04). Ilustrativos: la administración de esquemas y tipos de establecimiento y de
 * relación no tiene dueño (G-555). Los tipos de rol se administran desde MDM (D-046): su carga inicial vive aquí y el
 * almacén guarda la copia que se edita (`MdmMockStore.roleTypes`).
 */

export const IDENTIFIER_SCHEMES: readonly IdentifierScheme[] = [
  {
    code: 'PE-RUC',
    countryCode: 'PE',
    name: 'Registro Único de Contribuyentes',
    issuingAuthority: 'SUNAT',
    pattern: '^[0-9]{11}$',
    isFiscal: true,
    iso6523Icd: null,
    allowedPartyTypes: ['ORGANIZATION', 'PERSON'],
    isActive: true,
  },
  {
    code: 'PE-DNI',
    countryCode: 'PE',
    name: 'Documento Nacional de Identidad',
    issuingAuthority: 'RENIEC',
    pattern: '^[0-9]{8}$',
    isFiscal: false,
    iso6523Icd: null,
    allowedPartyTypes: ['PERSON'],
    isActive: true,
  },
  {
    code: 'PE-PARTIDA',
    countryCode: 'PE',
    name: 'Partida registral (SUNARP)',
    issuingAuthority: 'SUNARP',
    pattern: '^[0-9]{8}$',
    isFiscal: false,
    iso6523Icd: null,
    allowedPartyTypes: ['ORGANIZATION'],
    isActive: true,
  },
  {
    code: 'CL-RUT',
    countryCode: 'CL',
    name: 'Rol Único Tributario',
    issuingAuthority: 'SII',
    pattern: '^[0-9]{7,8}[0-9K]$',
    isFiscal: true,
    iso6523Icd: null,
    allowedPartyTypes: ['ORGANIZATION', 'PERSON'],
    isActive: true,
  },
  {
    code: 'EC-RUC',
    countryCode: 'EC',
    name: 'Registro Único de Contribuyentes (Ecuador)',
    issuingAuthority: 'SRI',
    pattern: '^[0-9]{13}$',
    isFiscal: true,
    iso6523Icd: null,
    allowedPartyTypes: ['ORGANIZATION', 'PERSON'],
    isActive: false,
  },
];

/** Instante y actor de la carga inicial de los catálogos. */
const CATALOG_LOADED_AT = '2024-03-01T14:00:00.000+00:00';
const CATALOG_ACTOR = 'carga-inicial';

type RoleTypeSeed = Pick<PartyRoleType, 'code' | 'name' | 'description' | 'unEdifact3035Code' | 'allowedPartyTypes' | 'requiresFiscalIdentifier'>;

const BOTH: PartyRoleType['allowedPartyTypes'] = ['ORGANIZATION', 'PERSON'];
const ORGANIZATION_ONLY: PartyRoleType['allowedPartyTypes'] = ['ORGANIZATION'];

/**
 * Carga inicial de tipos de rol (D-046): los de la primera entrega más los papeles del sector logístico que faltaban.
 * Los códigos UN/EDIFACT 3035 son los publicados para cada papel y se verifican contra el directorio oficial antes de
 * producción (consecuencia 4 de D-046).
 */
const ROLE_TYPE_SEEDS: readonly RoleTypeSeed[] = [
  { code: 'CUSTOMER', name: 'Cliente', description: 'Compra servicios a una empresa del grupo.', unEdifact3035Code: 'BY', allowedPartyTypes: BOTH, requiresFiscalIdentifier: false },
  { code: 'SUPPLIER', name: 'Proveedor', description: 'Vende bienes o servicios a una empresa del grupo.', unEdifact3035Code: 'SU', allowedPartyTypes: BOTH, requiresFiscalIdentifier: false },
  { code: 'CARRIER', name: 'Transportista', description: null, unEdifact3035Code: 'CA', allowedPartyTypes: ORGANIZATION_ONLY, requiresFiscalIdentifier: false },
  { code: 'CUSTOMS_BROKER', name: 'Agente de aduanas', description: null, unEdifact3035Code: 'CB', allowedPartyTypes: ORGANIZATION_ONLY, requiresFiscalIdentifier: false },
  { code: 'SHIPPING_AGENT', name: 'Agente marítimo', description: null, unEdifact3035Code: 'AE', allowedPartyTypes: ORGANIZATION_ONLY, requiresFiscalIdentifier: false },
  { code: 'INTERNAL_COMPANY', name: 'Empresa del grupo', description: 'Empresa de Organización; exige un identificador fiscal vigente.', unEdifact3035Code: null, allowedPartyTypes: ORGANIZATION_ONLY, requiresFiscalIdentifier: true },
  { code: 'FREIGHT_FORWARDER', name: 'Agente de carga internacional', description: 'Organiza el transporte internacional de la carga por cuenta de otro.', unEdifact3035Code: 'FW', allowedPartyTypes: ORGANIZATION_ONLY, requiresFiscalIdentifier: false },
  { code: 'CONSIGNEE', name: 'Consignatario', description: 'Recibe la carga en destino.', unEdifact3035Code: 'CN', allowedPartyTypes: BOTH, requiresFiscalIdentifier: false },
  { code: 'CONSIGNOR', name: 'Embarcador', description: 'Entrega la carga para su transporte.', unEdifact3035Code: 'CZ', allowedPartyTypes: BOTH, requiresFiscalIdentifier: false },
  { code: 'NOTIFY_PARTY', name: 'Parte a notificar', description: 'Recibe el aviso de llegada de la carga.', unEdifact3035Code: 'NI', allowedPartyTypes: BOTH, requiresFiscalIdentifier: false },
  { code: 'EXPORTER', name: 'Exportador', description: null, unEdifact3035Code: 'EX', allowedPartyTypes: BOTH, requiresFiscalIdentifier: false },
  { code: 'IMPORTER', name: 'Importador', description: null, unEdifact3035Code: 'IM', allowedPartyTypes: BOTH, requiresFiscalIdentifier: false },
  { code: 'WAREHOUSE_KEEPER', name: 'Depositario', description: 'Custodia la mercancía en un almacén o depósito.', unEdifact3035Code: 'WH', allowedPartyTypes: ORGANIZATION_ONLY, requiresFiscalIdentifier: false },
];

/** Tipos de rol de la carga inicial, todos activos y en su versión 1. Cada almacén del mock parte de una copia. */
export const ROLE_TYPES: readonly PartyRoleType[] = ROLE_TYPE_SEEDS.map((seed) => ({
  ...seed,
  isActive: true,
  version: 1,
  createdAt: CATALOG_LOADED_AT,
  createdBy: CATALOG_ACTOR,
  updatedAt: null,
  updatedBy: null,
}));

export const ESTABLISHMENT_KINDS: readonly EstablishmentKind[] = [
  { code: 'HEAD_OFFICE', name: 'Sede principal', isSupported: true, isActive: true },
  { code: 'BRANCH', name: 'Sede', isSupported: true, isActive: true },
  { code: 'PLANT', name: 'Planta', isSupported: true, isActive: true },
  { code: 'WAREHOUSE', name: 'Almacén', isSupported: false, isActive: true },
];

export const RELATIONSHIP_KINDS: readonly RelationshipKind[] = [
  { code: 'PARENT_OF', name: 'Matriz de', fromLabel: 'Matriz', toLabel: 'Filial', isActive: true },
  { code: 'GROUP_MEMBER_OF', name: 'Integra el grupo de', fromLabel: 'Integrante', toLabel: 'Cabeza de grupo', isActive: true },
  { code: 'AGENT_OF', name: 'Agente de', fromLabel: 'Agente', toLabel: 'Representada', isActive: true },
];
