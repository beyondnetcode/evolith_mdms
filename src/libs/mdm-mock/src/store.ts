import type { Address, CodeScheme, MdmObjectType, PartyStatus, PartyType, RelationshipStatus, RoleStatus, Source, SyncStatus } from '@mdm/contracts';
import { isoInstant } from './clock.ts';
import { ROLE_TYPES } from './catalogs.ts';
import { createGeoSeed } from './geo-seed.ts';
import type { GeoCountryRecord, GeoCorrespondenceRecord, GeoPlaceRecord, GeoSeedData } from './geo-store.ts';
import { createSeed } from './seed.ts';

/*
 * Registros internos del mock: lo que guardaría el servidor, sin los campos calculados (`isCurrent`) que la
 * lectura deriva con la fecha de hoy. Son mutables a propósito: el mock es un servidor en miniatura. Nunca salen
 * del mock: las lecturas devuelven copias nuevas (`views.ts`).
 */

export interface AuditRecord {
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface IdentifierRecord {
  readonly identifierId: string;
  readonly countryCode: string;
  readonly schemeCode: string;
  readonly value: string;
  readonly isPrimary: boolean;
  readonly validFrom: string;
  validTo: string | null;
}

export interface RoleRecord {
  readonly roleId: string;
  readonly roleTypeCode: string;
  status: RoleStatus;
  readonly validFrom: string;
  validTo: string | null;
}

export interface EstablishmentRecord {
  readonly id: string;
  readonly code: string;
  kindCode: string;
  name: string;
  taxEstablishmentCode: string | null;
  isPrincipal: boolean;
  isActive: boolean;
  isClosed: boolean;
  closedAt: string | null;
  closedBy: string | null;
  address: Address;
}

export interface PartyRecord extends AuditRecord {
  readonly id: string;
  readonly type: PartyType;
  readonly code: string;
  legalName: string;
  tradeName: string | null;
  status: PartyStatus;
  version: number;
  readonly identifiers: IdentifierRecord[];
  readonly roles: RoleRecord[];
  readonly establishments: EstablishmentRecord[];
}

export interface RelationshipRecord extends AuditRecord {
  readonly id: string;
  readonly fromPartyId: string;
  readonly toPartyId: string;
  readonly kindCode: string;
  readonly validFrom: string;
  validTo: string | null;
  status: RelationshipStatus;
  version: number;
}

export interface ExternalReferenceRecord extends AuditRecord {
  readonly id: string;
  readonly systemCode: string;
  readonly systemInstance: string;
  readonly externalObjectType: string;
  readonly externalKey: string;
  readonly mdmObjectType: MdmObjectType;
  readonly mdmObjectId: string;
  readonly partyId: string;
  syncStatus: SyncStatus;
  lastSyncedVersion: number | null;
  version: number;
}

/** Tipo de rol del catálogo (D-046): agregado propio, con su versión. El `code` es la clave y no cambia. */
export interface RoleTypeRecord extends AuditRecord {
  readonly code: string;
  name: string;
  description: string | null;
  unEdifact3035Code: string | null;
  allowedPartyTypes: readonly PartyType[];
  requiresFiscalIdentifier: boolean;
  isActive: boolean;
  version: number;
}

export interface SeedData {
  readonly parties: readonly PartyRecord[];
  readonly relationships: readonly RelationshipRecord[];
  readonly externalReferences: readonly ExternalReferenceRecord[];
  readonly geography?: GeoSeedData;
}

/** Lo que cambia la escritura simulada de otra persona; sin cambios, solo sube la versión. */
export interface ConcurrentChange {
  readonly legalName?: string;
  readonly tradeName?: string | null;
}

/** UUID determinista (versión 4, variante 8) a partir de un número: los datos de ejemplo no cambian entre cargas. */
export function mockUuid(prefix: string, sequence: number): string {
  return `${prefix.padStart(8, '0').slice(0, 8)}-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

/**
 * Almacén en memoria del mock. Cada prueba crea el suyo; la aplicación comparte uno durante la sesión del
 * navegador. `seed: 'empty'` parte sin organizaciones (estado vacío inicial de P-MDM-01).
 */
export class MdmMockStore {
  readonly parties = new Map<string, PartyRecord>();
  readonly relationships = new Map<string, RelationshipRecord>();
  readonly externalReferences = new Map<string, ExternalReferenceRecord>();
  /** Catálogo de tipos de rol, por código. Existe también con `seed: 'empty'`: el vacío es de organizaciones. */
  readonly roleTypes = new Map<string, RoleTypeRecord>();
  readonly geoPlaces = new Map<string, GeoPlaceRecord>();
  readonly geoCountries = new Map<string, GeoCountryRecord>();
  readonly geoCorrespondences = new Map<string, GeoCorrespondenceRecord>();
  readonly codeSchemes = new Map<string, CodeScheme>();
  readonly sources = new Map<string, Source>();
  private sequence = 0;

  constructor(seed: SeedData | 'empty' = createSeed()) {
    for (const type of ROLE_TYPES) this.roleTypes.set(type.code, { ...type });
    const geography = seed === 'empty' ? createGeoSeed() : seed.geography ?? createGeoSeed();
    this.loadGeography(geography);
    if (seed === 'empty') return;
    this.loadParties(seed);
  }

  private loadGeography(geography: GeoSeedData): void {
    for (const place of geography.places) this.geoPlaces.set(place.id, place);
    for (const country of geography.countries) this.geoCountries.set(country.alpha2, country);
    for (const correspondence of geography.correspondences) this.geoCorrespondences.set(correspondence.id, correspondence);
    for (const scheme of geography.schemes) this.codeSchemes.set(scheme.code, { ...scheme });
    for (const source of geography.sources) this.sources.set(source.code, { ...source });
  }

  private loadParties(seed: SeedData): void {
    for (const party of seed.parties) this.parties.set(party.id, party);
    for (const relationship of seed.relationships) this.relationships.set(relationship.id, relationship);
    for (const reference of seed.externalReferences) this.externalReferences.set(reference.id, reference);
  }

  /**
   * Simula que OTRA persona escribe en la organización (US-MDM-013): cambia los nombres indicados y sube la
   * versión del agregado, como cualquier escritura. Quien tenga cargada la versión anterior recibirá `412`.
   * Devuelve la versión nueva, o `null` si la Party no existe.
   */
  simulateConcurrentEdit(partyId: string, change: ConcurrentChange = {}, actor = 'otra.persona'): number | null {
    const party = this.parties.get(partyId);
    if (party === undefined) return null;
    if (change.legalName !== undefined) party.legalName = change.legalName;
    if (change.tradeName !== undefined) party.tradeName = change.tradeName;
    party.version += 1;
    party.updatedAt = isoInstant(Date.now());
    party.updatedBy = actor;
    return party.version;
  }

  /** Id nuevo asignado por el «servidor». */
  newId(): string {
    this.sequence += 1;
    return mockUuid('a0000000', this.sequence);
  }
}
