import type { Address, PartyStatus } from '@mdm/contracts';
import { mockUuid, type EstablishmentRecord, type ExternalReferenceRecord, type PartyRecord, type RelationshipRecord, type SeedData } from './store.ts';
import { createGeoSeed } from './geo-seed.ts';

/*
 * DATOS DE EJEMPLO del mock de MDM: ficticios salvo ORG S.A. (RUC 20100412447, el único con dígito verificador
 * comprobado en DOM-MDM-001 §3.3). El resto de RUC son inventados pero válidos por módulo 11. Los ids son
 * deterministas para que las pruebas y los enlaces compartidos no cambien entre cargas.
 */

/** Id de ORG S.A. en el mock: la empresa del grupo (`INTERNAL_COMPANY`). */
export const ORG_PARTY_ID = mockUuid('b0000000', 1);

const CREATED_AT = '2024-03-01T14:00:00.000+00:00';
const SEED_ACTOR = 'carga-inicial';

interface SeedParty {
  readonly code: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly ruc: string;
  readonly roles: readonly string[];
  readonly status?: PartyStatus;
  readonly updatedAt?: string;
}

/**
 * Organizaciones de ejemplo (sin ORG, que se arma aparte). Más de 20, para que P-MDM-01 pagine. Algunas llevan los
 * papeles logísticos de la carga inicial de D-046 (importador, depositario, exportador…) para que se vean.
 */
const PARTIES: readonly SeedParty[] = [
  { code: 'ACME', legalName: 'ACME PERÚ S.A.C.', tradeName: 'Acme', ruc: '20601234565', roles: ['CUSTOMER'], updatedAt: '2026-10-23T16:20:00.000+00:00' },
  { code: 'TRANSLIM', legalName: 'TRANSPORTES LIMA S.A.', tradeName: 'Translima', ruc: '20512345671', roles: ['CARRIER'], status: 'Suspended', updatedAt: '2026-10-20T13:05:00.000+00:00' },
  { code: 'ANDINA-FOODS', legalName: 'ANDINA FOODS S.A.C.', tradeName: 'Andina Foods', ruc: '20456789120', roles: ['CUSTOMER'] },
  { code: 'AGROEXPORT-NORTE', legalName: 'AGROEXPORTADORA DEL NORTE S.A.', tradeName: 'Agronorte', ruc: '20334455662', roles: ['CUSTOMER', 'SUPPLIER'] },
  { code: 'NAVIERA-PACIFICO', legalName: 'NAVIERA DEL PACÍFICO S.A.C.', tradeName: 'Navipac', ruc: '20778899001', roles: ['SHIPPING_AGENT'] },
  { code: 'ADUANAS-CALLAO', legalName: 'AGENCIA DE ADUANAS CALLAO S.A.C.', tradeName: null, ruc: '20112233441', roles: ['CUSTOMS_BROKER'] },
  { code: 'CARGA-SUR', legalName: 'CARGA SUR E.I.R.L.', tradeName: 'Cargasur', ruc: '20998877661', roles: ['CARRIER'] },
  { code: 'TEXTILES-INCA', legalName: 'TEXTILES INCA S.A.', tradeName: 'Inca Textil', ruc: '20554433228', roles: ['CUSTOMER', 'IMPORTER'] },
  { code: 'MINERA-COSTA', legalName: 'MINERA COSTA VERDE S.A.A.', tradeName: null, ruc: '20667788995', roles: ['CUSTOMER'] },
  { code: 'PESQUERA-PIURA', legalName: 'PESQUERA PIURA S.A.C.', tradeName: 'Pespiura', ruc: '20445566773', roles: ['CUSTOMER'] },
  { code: 'FRIO-LOGISTICO', legalName: 'FRÍO LOGÍSTICO DEL PERÚ S.A.C.', tradeName: 'Friolog', ruc: '20123123124', roles: ['SUPPLIER', 'WAREHOUSE_KEEPER'] },
  { code: 'CONTENEDORES-ANDES', legalName: 'CONTENEDORES DE LOS ANDES S.A.', tradeName: null, ruc: '20456456457', roles: ['SUPPLIER', 'FREIGHT_FORWARDER'] },
  { code: 'TRANSPORTES-ANDINOS', legalName: 'TRANSPORTES ANDINOS S.A.C.', tradeName: 'Transandinos', ruc: '20789789780', roles: ['CARRIER'] },
  { code: 'CAFE-SELVA', legalName: 'CAFÉ DE LA SELVA S.A.C.', tradeName: 'Café Selva', ruc: '20321321322', roles: ['CUSTOMER', 'EXPORTER', 'CONSIGNOR'] },
  { code: 'ESPARRAGOS-ICA', legalName: 'ESPÁRRAGOS DE ICA S.A.', tradeName: null, ruc: '20654654655', roles: ['CUSTOMER', 'CONSIGNEE', 'NOTIFY_PARTY'] },
  { code: 'MANGO-SULLANA', legalName: 'MANGOS SULLANA S.A.C.', tradeName: 'Mango Sullana', ruc: '20987987988', roles: ['CUSTOMER', 'EXPORTER'] },
  { code: 'COMBUSTIBLES-LIMA', legalName: 'COMBUSTIBLES LIMA S.A.', tradeName: null, ruc: '20135791351', roles: ['SUPPLIER'] },
  { code: 'GRUAS-PUERTO', legalName: 'GRÚAS DEL PUERTO S.A.C.', tradeName: 'Grupuerto', ruc: '20246802468', roles: ['SUPPLIER'] },
  { code: 'CEMENTOS-NORTE', legalName: 'CEMENTOS DEL NORTE S.A.A.', tradeName: null, ruc: '20369258142', roles: ['CUSTOMER'] },
  { code: 'QUIMICOS-PERU', legalName: 'QUÍMICOS INDUSTRIALES DEL PERÚ S.A.', tradeName: 'Quimperu', ruc: '20147258365', roles: ['CUSTOMER'] },
  { code: 'AGENCIA-MARITIMA', legalName: 'AGENCIA MARÍTIMA DEL SUR S.A.C.', tradeName: null, ruc: '20583691473', roles: ['SHIPPING_AGENT'] },
  { code: 'COURIER-RAPIDO', legalName: 'COURIER RÁPIDO S.A.C.', tradeName: 'Rapidex', ruc: '20692581475', roles: ['CARRIER'] },
  { code: 'IMPORTADORA-ORIENTE', legalName: 'IMPORTADORA DEL ORIENTE S.A.C.', tradeName: null, ruc: '20471471471', roles: ['CUSTOMER'], status: 'Archived' },
  { code: 'IMPORTADORA-ORIENTE-2', legalName: 'IMPORTADORA ORIENTE S.A.C.', tradeName: null, ruc: '20258258259', roles: ['CUSTOMER'], status: 'Merged' },
];

function address(line1: string, district: string, ubigeo: string): Address {
  return { line1, line2: null, ubigeo, department: 'Lima', province: 'Lima', district, postalCode: null, countryCode: 'PE', reference: null };
}

function establishment(sequence: number, fields: Pick<EstablishmentRecord, 'code' | 'kindCode' | 'name' | 'taxEstablishmentCode' | 'isPrincipal' | 'address'>): EstablishmentRecord {
  return { id: mockUuid('e0000000', sequence), isActive: true, isClosed: false, closedAt: null, closedBy: null, ...fields };
}

function organizacion(): PartyRecord {
  return {
    id: ORG_PARTY_ID,
    type: 'ORGANIZATION',
    code: 'ORG',
    legalName: 'ORG S.A.',
    tradeName: 'Organización',
    status: 'Active',
    version: 7,
    identifiers: [
      { identifierId: mockUuid('c0000000', 1), countryCode: 'PE', schemeCode: 'PE-RUC', value: '20100412447', isPrimary: true, validFrom: '1978-01-01', validTo: null },
    ],
    roles: [{ roleId: mockUuid('d0000000', 1), roleTypeCode: 'INTERNAL_COMPANY', status: 'Active', validFrom: '1978-01-01', validTo: null }],
    establishments: [
      establishment(1, {
        code: 'CALLAO',
        kindCode: 'BRANCH',
        name: 'Sede Callao',
        taxEstablishmentCode: '0001',
        isPrincipal: true,
        address: { ...address('Av. Néstor Gambetta 0000', 'Callao', '070101'), department: 'Callao', province: 'Callao' },
      }),
      establishment(2, {
        code: 'PIURA',
        kindCode: 'BRANCH',
        name: 'Sede Piura',
        taxEstablishmentCode: '0002',
        isPrincipal: false,
        address: { ...address('Av. Sánchez Cerro 0000', 'Piura', '200101'), department: 'Piura', province: 'Piura' },
      }),
    ],
    createdAt: CREATED_AT,
    createdBy: SEED_ACTOR,
    updatedAt: '2026-10-24T16:10:00.000+00:00',
    updatedBy: 'aarroyo',
  };
}

function toRecord(seed: SeedParty, index: number): PartyRecord {
  const sequence = index + 2;
  return {
    id: mockUuid('b0000000', sequence),
    type: 'ORGANIZATION',
    code: seed.code,
    legalName: seed.legalName,
    tradeName: seed.tradeName,
    status: seed.status ?? 'Active',
    version: 1 + (index % 4),
    identifiers: [
      { identifierId: mockUuid('c0000000', sequence), countryCode: 'PE', schemeCode: 'PE-RUC', value: seed.ruc, isPrimary: true, validFrom: '2024-03-01', validTo: null },
    ],
    roles: seed.roles.map((roleTypeCode, roleIndex) => ({
      roleId: mockUuid('d0000000', sequence * 10 + roleIndex),
      roleTypeCode,
      status: 'Active',
      validFrom: '2024-03-01',
      validTo: null,
    })),
    establishments: [],
    createdAt: CREATED_AT,
    createdBy: SEED_ACTOR,
    updatedAt: seed.updatedAt ?? null,
    updatedBy: seed.updatedAt === undefined ? null : 'aarroyo',
  };
}

/** Enriquecimientos puntuales: un rol vencido sin terminar, un rol futuro y un establecimiento de planta. */
function enrich(parties: readonly PartyRecord[]): void {
  const agronorte = parties.find((party) => party.code === 'AGROEXPORT-NORTE');
  agronorte?.roles.push({ roleId: mockUuid('d0000000', 900), roleTypeCode: 'CARRIER', status: 'Active', validFrom: '2024-03-01', validTo: '2025-12-31' });
  agronorte?.establishments.push(
    establishment(3, {
      code: 'PLANTA-PIURA',
      kindCode: 'PLANT',
      name: 'Planta de empaque Piura',
      taxEstablishmentCode: '0003',
      isPrincipal: false,
      address: { ...address('Carretera Piura-Sullana km 0', 'Castilla', '200104'), department: 'Piura', province: 'Piura' },
    }),
  );
  const acme = parties.find((party) => party.code === 'ACME');
  acme?.roles.push({ roleId: mockUuid('d0000000', 901), roleTypeCode: 'SUPPLIER', status: 'Active', validFrom: '2099-01-01', validTo: null });
}

function relationships(parties: readonly PartyRecord[]): RelationshipRecord[] {
  const idOf = (code: string): string => parties.find((party) => party.code === code)?.id ?? ORG_PARTY_ID;
  return [
    {
      id: mockUuid('f0000000', 1),
      fromPartyId: idOf('AGENCIA-MARITIMA'),
      toPartyId: idOf('NAVIERA-PACIFICO'),
      kindCode: 'AGENT_OF',
      validFrom: '2024-03-01',
      validTo: null,
      status: 'Active',
      version: 1,
      createdAt: CREATED_AT,
      createdBy: SEED_ACTOR,
      updatedAt: null,
      updatedBy: null,
    },
    // ORG en los dos extremos: agente vigente de una naviera y representada de un transportista hasta 2025.
    {
      id: mockUuid('f0000000', 2),
      fromPartyId: ORG_PARTY_ID,
      toPartyId: idOf('NAVIERA-PACIFICO'),
      kindCode: 'AGENT_OF',
      validFrom: '2024-03-01',
      validTo: null,
      status: 'Active',
      version: 1,
      createdAt: CREATED_AT,
      createdBy: SEED_ACTOR,
      updatedAt: null,
      updatedBy: null,
    },
    {
      id: mockUuid('f0000000', 3),
      fromPartyId: idOf('CARGA-SUR'),
      toPartyId: ORG_PARTY_ID,
      kindCode: 'AGENT_OF',
      validFrom: '2024-03-01',
      validTo: '2025-06-30',
      status: 'Ended',
      version: 2,
      createdAt: CREATED_AT,
      createdBy: SEED_ACTOR,
      updatedAt: '2025-06-30T15:00:00.000+00:00',
      updatedBy: 'aarroyo',
    },
  ];
}

function externalReferences(): ExternalReferenceRecord[] {
  return [
    {
      id: mockUuid('a1000000', 1),
      systemCode: 'ERP',
      systemInstance: 'PRD-100',
      externalObjectType: 'COMPANY',
      externalKey: '1000',
      mdmObjectType: 'PARTY',
      mdmObjectId: ORG_PARTY_ID,
      partyId: ORG_PARTY_ID,
      syncStatus: 'Linked',
      lastSyncedVersion: 7,
      version: 1,
      createdAt: CREATED_AT,
      createdBy: 'integrador-erp',
      updatedAt: null,
      updatedBy: null,
    },
    // La sede de Piura, pendiente de sincronizar con el ERP.
    {
      id: mockUuid('a1000000', 2),
      systemCode: 'ERP',
      systemInstance: 'PRD-100',
      externalObjectType: 'BRANCH',
      externalKey: '1000-02',
      mdmObjectType: 'ESTABLISHMENT',
      mdmObjectId: mockUuid('e0000000', 2),
      partyId: ORG_PARTY_ID,
      syncStatus: 'PendingSync',
      lastSyncedVersion: null,
      version: 1,
      createdAt: CREATED_AT,
      createdBy: 'integrador-erp',
      updatedAt: null,
      updatedBy: null,
    },
  ];
}

/** Datos nuevos en cada llamada: cada almacén muta los suyos sin afectar a otro. */
export function createSeed(): SeedData {
  const parties = [organizacion(), ...PARTIES.map(toRecord)];
  enrich(parties);
  return { parties, relationships: relationships(parties), externalReferences: externalReferences(), geography: createGeoSeed() };
}
