import type { CodeRef, CorrespondenceKind, GeoPrecision, PlaceStatus, PlaceType, SiteKind, TerritorialSchemaInput, TradeFunction, UneceStatus } from './geography.ts';
import type { SortOrder } from './vocabulary.ts';

/**
 * Consultas y cuerpos de escritura de la geografía (API-MDM-003 §4 y §5). Como en Party, lo opcional es `null`
 * explícito: el cliente HTTP omite el parámetro y las claves de caché son estables.
 */

export const PLACE_SORT_FIELDS = ['name', 'path', 'updatedAt'] as const;
export type PlaceSortField = (typeof PLACE_SORT_FIELDS)[number];

/** PL-01 (§4.1). */
export interface PlaceQuery {
  /** Texto de 2 a 100 caracteres; se normaliza sin tildes ni mayúsculas en el servidor. */
  readonly name: string | null;
  readonly nameMatch: 'prefix' | 'contains';
  /** Con `code`: código exacto de ese esquema. Sin él, `code` busca en todos. */
  readonly scheme: string | null;
  readonly code: string | null;
  readonly pathPrefix: string | null;
  /** Hijos directos. */
  readonly parentId: string | null;
  readonly countryCode: string | null;
  readonly type: PlaceType | null;
  /** Orden en la escalera; solo con `countryCode`. */
  readonly level: number | null;
  /** Ausente: `Active` e `Inactive`. */
  readonly statuses: readonly PlaceStatus[] | null;
  readonly usableForAddresses: boolean;
  /** Catálogo tal como era ese día. */
  readonly asOf: string | null;
  readonly sortBy: PlaceSortField;
  readonly sortOrder: SortOrder;
  readonly page: number;
  readonly pageSize: number;
}

/** Consulta vacía: cada pantalla cambia solo lo que filtra. */
export const EMPTY_PLACE_QUERY: PlaceQuery = {
  name: null,
  nameMatch: 'prefix',
  scheme: null,
  code: null,
  pathPrefix: null,
  parentId: null,
  countryCode: null,
  type: null,
  level: null,
  statuses: null,
  usableForAddresses: false,
  asOf: null,
  sortBy: 'name',
  sortOrder: 'asc',
  page: 1,
  pageSize: 20,
};

/** PL-02 (§4.2). */
export interface ResolveQuery {
  readonly scheme: string | null;
  readonly value: string;
  readonly asOf: string | null;
}

/** CO-01. */
export interface CountryFilter {
  readonly status: PlaceStatus | null;
  readonly search: string | null;
}

/** CO-02 (§5.1). */
export interface RegisterCountryRequest {
  readonly alpha2: string;
  readonly alpha3: string;
  readonly numeric: string;
  readonly officialName: string;
  readonly englishName: string | null;
  readonly validFrom: string | null;
  readonly sourceCode: string;
  readonly sourceVersion: string | null;
}

/** PL-03 (§5.2). Las localidades se registran manualmente bajo un país o una división. */
export interface RegisterPlaceRequest {
  readonly type: 'AdministrativeDivision' | 'Locality';
  readonly parentId: string;
  /** Nulo para localidades sin UBIGEO propio. */
  readonly canonicalCode: CodeRef | null;
  readonly officialName: string;
  /** Por defecto, `es`. */
  readonly languageCode: string | null;
  /** Por defecto, hoy. */
  readonly validFrom: string | null;
  readonly sourceCode: string;
  readonly sourceVersion: string | null;
}

/** PL-05 (§5.4): el motivo es obligatorio. */
export interface CorrectOfficialNameRequest {
  readonly languageCode: string;
  readonly officialName: string;
  readonly reason: string;
}

/** CD-02 (§5.4). */
export interface AddCodeRequest {
  readonly schemeCode: string;
  readonly value: string;
  readonly validFrom: string | null;
  readonly sourceCode: string;
  readonly sourceVersion: string | null;
}

/** CR-01. */
export interface CorrespondenceQuery {
  /** Con `value`: el código en cualquiera de los dos extremos. */
  readonly scheme: string | null;
  readonly value: string | null;
  readonly kind: CorrespondenceKind | null;
  readonly currentOnly: boolean;
  readonly page: number;
  readonly pageSize: number;
}

/** CR-02. */
export interface RegisterCorrespondenceRequest {
  readonly from: CodeRef;
  readonly to: CodeRef;
  readonly kind: CorrespondenceKind;
  readonly validFrom: string | null;
  readonly note: string | null;
  readonly sourceCode: string;
}

/** TL-01. */
export interface TradeLocationQuery {
  readonly countryCode: string | null;
  /** Prefijo del UN/LOCODE. */
  readonly unLocode: string | null;
  readonly name: string | null;
  /** Vacía: cualquier función. */
  readonly functions: readonly TradeFunction[];
  readonly uneceStatus: UneceStatus | null;
  readonly usableInTradeDocuments: boolean | null;
  readonly includeSites: boolean;
  readonly asOf: string | null;
  readonly page: number;
  readonly pageSize: number;
}

export interface GeoReferenceInput {
  readonly latitude: number;
  readonly longitude: number;
  readonly precision: GeoPrecision;
  readonly sourceCode: string;
  readonly sourceVersion: string | null;
}

/** TL-05 (§5.5): el código empieza por el UN/LOCODE del padre (RN-GEO-09). */
export interface RegisterSiteRequest {
  readonly siteCode: string;
  readonly officialName: string;
  readonly siteKind: SiteKind;
  readonly geoReference: GeoReferenceInput | null;
}

/** SC-01. */
export interface CodeSchemeFilter {
  readonly countryCode: string | null;
  readonly appliesTo: PlaceType | null;
  readonly includeInactive: boolean;
}

export type { TerritorialSchemaInput };
