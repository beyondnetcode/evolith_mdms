import { array, boolean, civilDate, failure, integer, nullable, object, oneOf, success, text, uuid, type Parser } from './parse.ts';
import { auditShape, pageInfoShape, pageOf, type Audit, type PageInfo } from './party.ts';

/**
 * Lecturas de la geografía de la suite (API-MDM-003 §4 y §5; OpenAPI `components/schemas`). Lo opcional del
 * contrato se expresa con `null` explícito, como en Party: el cliente HTTP lo rellena al leer y las claves de caché
 * son estables. Los literales se conservan tal cual los publica el contrato (D-025): `Active`, `UBIGEO-INEI`.
 */

export const PLACE_TYPES = ['Country', 'AdministrativeDivision', 'Locality', 'TradeLocation'] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

/** `Inactive` es propuesta del contrato (G-621); `Historical`, solo por sucesión. */
export const PLACE_STATUSES = ['Active', 'Inactive', 'Historical'] as const;
export type PlaceStatus = (typeof PLACE_STATUSES)[number];

export const CANONICAL_LABELS = ['ADM1', 'ADM2', 'ADM3', 'ADM4', 'ADM5', 'ADM6'] as const;
export type CanonicalLabel = (typeof CANONICAL_LABELS)[number];

export const NAME_KINDS = ['Official', 'Alternative', 'InternationalTrade', 'Transliterated', 'Short', 'Historical'] as const;
export type NameKind = (typeof NAME_KINDS)[number];

export const PREFIX_RULES = ['None', 'CountryAlpha2', 'ParentValue'] as const;
export type PrefixRule = (typeof PREFIX_RULES)[number];

export const CORRESPONDENCE_KINDS = ['Equivalent', 'PartOf', 'Overlaps'] as const;
export type CorrespondenceKind = (typeof CORRESPONDENCE_KINDS)[number];

export const SUCCESSION_TYPES = ['Creation', 'Split', 'Merge', 'Rename', 'Recoding', 'Reassignment'] as const;
export type SuccessionType = (typeof SUCCESSION_TYPES)[number];

export const SUCCESSION_STATUSES = ['Proposed', 'Approved', 'Applied', 'Rejected'] as const;
export type SuccessionStatus = (typeof SUCCESSION_STATUSES)[number];

export const PARTICIPANT_ROLES = ['Predecessor', 'Successor', 'Subject'] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

/** Funciones UNECE (dígito: `SEAPORT` 1 … `SPECIAL_ECONOMIC_ZONE` A, `NOT_OFFICIAL` 0, `BORDER_CROSSING` B legado). */
export const TRADE_FUNCTIONS = [
  'SEAPORT',
  'RAIL',
  'ROAD',
  'AIRPORT',
  'POSTAL',
  'MULTIMODAL',
  'FIXED_TRANSPORT',
  'INLAND_WATERWAY',
  'SPECIAL_ECONOMIC_ZONE',
  'NOT_OFFICIAL',
  'BORDER_CROSSING',
] as const;
export type TradeFunction = (typeof TRADE_FUNCTIONS)[number];

export const UNECE_STATUSES = ['AM', 'RL', 'RQ', 'XX', 'AA', 'AC', 'AF', 'AI', 'AS', 'AQ', 'RN'] as const;
export type UneceStatus = (typeof UNECE_STATUSES)[number];

export const SITE_KINDS = ['Terminal', 'TemporaryWarehouse', 'ContainerYard', 'Plant', 'Other'] as const;
export type SiteKind = (typeof SITE_KINDS)[number];

export const GEO_PRECISIONS = ['Exact', 'Address', 'Locality', 'Area'] as const;
export type GeoPrecision = (typeof GEO_PRECISIONS)[number];

export const REDISTRIBUTIONS = ['InternalOnly', 'Redistributable', 'RedistributableWithAttribution'] as const;
export type Redistribution = (typeof REDISTRIBUTIONS)[number];

/** Códigos de esquema de la carga inicial que la interfaz nombra (API-MDM-003 §3.9). */
export const GEO_SCHEMES = {
  isoAlpha2: 'ISO-3166-1-A2',
  isoAlpha3: 'ISO-3166-1-A3',
  isoNumeric: 'ISO-3166-1-N',
  iso2: 'ISO-3166-2',
  ubigeoInei: 'UBIGEO-INEI',
  ubigeoReniec: 'UBIGEO-RENIEC',
  ubigeoSunat: 'UBIGEO-SUNAT',
  unLocode: 'UN-LOCODE',
  organizacionSite: 'ORG-SITE',
} as const;

// --- Piezas comunes ---

export interface CodeRef {
  readonly schemeCode: string;
  readonly value: string;
}

export interface SourceRef {
  readonly code: string;
  readonly version: string | null;
}

export interface LicenseInfo {
  readonly redistribution: Redistribution;
  readonly attributionText: string | null;
}

/** Vista mínima de un antepasado, sucesor o lugar asociado. */
export interface PlaceRef {
  readonly id: string;
  readonly type: PlaceType;
  readonly level: number | null;
  readonly officialName: string;
  readonly canonicalCode: CodeRef | null;
  readonly status: PlaceStatus;
}

export interface GeoReference {
  readonly latitude: number;
  readonly longitude: number;
  readonly precision: GeoPrecision;
  readonly source: SourceRef;
  readonly license: LicenseInfo;
}

export interface PlaceNameItem {
  readonly nameId: string;
  readonly name: string;
  readonly languageCode: string;
  readonly kind: NameKind;
  readonly isPreferred: boolean;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly isCurrent: boolean;
  readonly source: SourceRef;
  readonly license: LicenseInfo;
}

export interface OfficialCode {
  readonly codeId: string;
  readonly schemeCode: string;
  readonly value: string;
  readonly authority: string;
  /** Es el código canónico del lugar (el esquema del nivel de la escalera, o el del tipo de lugar). */
  readonly isCanonical: boolean;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly isCurrent: boolean;
  readonly source: SourceRef;
  readonly license: LicenseInfo;
}

export interface TradeLocationInfo {
  /** Nulo en un lugar propio `ORG-SITE`. */
  readonly unLocode: string | null;
  readonly siteCode: string | null;
  readonly siteKind: SiteKind | null;
  readonly functions: readonly TradeFunction[];
  readonly uneceStatus: UneceStatus | null;
  readonly uneceStatusDate: string | null;
  readonly iataCode: string | null;
  /** Derivado por el servidor (RN-GEO-08); los lugares propios heredan el de su padre. */
  readonly usableInTradeDocuments: boolean;
  readonly siteCount: number;
}

export interface SuccessionRef {
  readonly successionId: string;
  readonly type: SuccessionType;
  readonly status: SuccessionStatus;
  readonly role: ParticipantRole;
  readonly effectiveOn: string;
}

// --- Lugares ---

/** Elemento de PL-01 (vista `minimal` con la ruta legible, que distingue homónimos: RN-GEO-06). */
export interface PlaceSummary {
  readonly id: string;
  readonly type: PlaceType;
  readonly status: PlaceStatus;
  readonly countryCode: string;
  readonly level: number | null;
  readonly officialName: string;
  /** Nombre alternativo que coincidió con la búsqueda, si no es el oficial. */
  readonly matchedName: string | null;
  readonly canonicalCode: CodeRef | null;
  readonly parentId: string | null;
  readonly path: string;
  /** De la hoja a la raíz: «Miraflores › Lima › Lima › Perú». */
  readonly displayPath: string;
  /** Esquemas omitidos por licencia para un cliente de distribución externa (G-623). */
  readonly redactedSchemes: readonly string[];
  readonly version: number;
}

export interface PlacePage extends PageInfo {
  readonly items: readonly PlaceSummary[];
}

/** Ficha en vista `path` (PL-04 por defecto, PL-02): la jerarquía sin servir el árbol. */
export interface PlacePath {
  readonly id: string;
  readonly type: PlaceType;
  readonly status: PlaceStatus;
  readonly countryCode: string;
  /** 0 = país; nulo en lugares de comercio. */
  readonly level: number | null;
  /** Nombre local del nivel según la escalera del país («Distrito»). */
  readonly levelLabel: string | null;
  readonly officialName: string;
  readonly canonicalCode: CodeRef | null;
  readonly parentId: string | null;
  readonly path: string;
  readonly displayPath: string;
  /** De la raíz al padre. */
  readonly ancestors: readonly PlaceRef[];
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly isCurrent: boolean;
  readonly version: number;
}

/** Ficha en vista `full` (PL-04): pantalla de mantenimiento. */
export interface Place extends PlacePath, Audit {
  readonly names: readonly PlaceNameItem[];
  readonly codes: readonly OfficialCode[];
  readonly geoReference: GeoReference | null;
  readonly tradeLocation: TradeLocationInfo | null;
  readonly successions: readonly SuccessionRef[];
  readonly childCount: number;
  /** La licencia más restrictiva de los datos del lugar. */
  readonly license: LicenseInfo;
  readonly redactedSchemes: readonly string[];
}

/** PL-02: el lugar de un código exacto, aunque esté vencido o el lugar sea histórico. */
export interface PlaceResolution {
  readonly place: PlacePath;
  readonly resolution: {
    readonly matchedCode: OfficialCode;
    readonly placeStatus: PlaceStatus;
    readonly successors: readonly PlaceRef[];
  };
}

// --- Países ---

export interface CountrySummary {
  /** El país es también un lugar (`Country`): su ficha es la de PL-04. */
  readonly placeId: string;
  readonly alpha2: string;
  readonly alpha3: string;
  readonly numeric: string;
  readonly officialName: string;
  readonly englishName: string | null;
  readonly status: PlaceStatus;
  readonly levelCount: number;
  readonly version: number;
}

export interface CountryList {
  readonly items: readonly CountrySummary[];
}

export interface TerritorialSchemaSummary {
  readonly declared: boolean;
  readonly levelCount: number;
  readonly usesPostalCode: boolean | null;
  readonly version: number | null;
}

export interface Country extends CountrySummary, Audit {
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly codes: readonly OfficialCode[];
  readonly territorialSchema: TerritorialSchemaSummary;
}

/** Nivel de la escalera tal como se declara (CO-06). */
export interface TerritorialLevelInput {
  readonly order: number;
  readonly canonicalLabel: CanonicalLabel;
  readonly localLabel: string;
  readonly canonicalSchemeCode: string;
  readonly isAddressLevel: boolean;
}

/** Nivel leído (CO-05): con los lugares que ya tiene, que impiden quitarlo o moverlo. */
export interface TerritorialLevel extends TerritorialLevelInput {
  readonly placeCount: number;
}

export interface TerritorialSchemaInput {
  readonly levels: readonly TerritorialLevelInput[];
  readonly usesPostalCode: boolean;
  /** Obligatorio si `usesPostalCode`. */
  readonly postalCodePattern: string | null;
}

/** Política territorial del país: agregado propio con su versión (no sube la del lugar país). */
export interface TerritorialSchema extends Audit {
  readonly countryCode: string;
  readonly levels: readonly TerritorialLevel[];
  readonly usesPostalCode: boolean;
  readonly postalCodePattern: string | null;
  readonly version: number;
}

// --- Correspondencias ---

export interface Correspondence extends Audit {
  readonly id: string;
  readonly from: CodeRef;
  readonly to: CodeRef;
  readonly kind: CorrespondenceKind;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly isCurrent: boolean;
  readonly note: string | null;
  readonly source: SourceRef;
  readonly version: number;
}

export interface CorrespondencePage extends PageInfo {
  readonly items: readonly Correspondence[];
}

// --- Comercio exterior ---

export interface TradeLocationSummary extends PlaceSummary {
  readonly tradeLocation: TradeLocationInfo;
}

export interface TradeLocationPage extends PageInfo {
  readonly items: readonly TradeLocationSummary[];
}

export interface TradeLocationList {
  readonly items: readonly TradeLocationSummary[];
}

// --- Catálogos ---

export interface CodeScheme {
  readonly code: string;
  readonly name: string;
  readonly authority: string;
  readonly description: string | null;
  /** Nulo = global. */
  readonly countryCode: string | null;
  readonly appliesTo: readonly PlaceType[];
  readonly valuePattern: string;
  readonly maxLength: number;
  readonly prefixRule: PrefixRule;
  readonly isCanonical: boolean;
  readonly defaultSourceCode: string;
  readonly isActive: boolean;
  readonly codeCount: number;
  readonly version: number;
}

export interface Source {
  readonly code: string;
  readonly authority: string;
  readonly licenseName: string;
  readonly licenseUrl: string | null;
  readonly attributionText: string | null;
  readonly redistribution: Redistribution;
  readonly confirmedOn: string | null;
  readonly evidenceRef: string | null;
  readonly version: number;
}

// --- Validadores de runtime (ADR-0109 P-FE-06) ---

const version = integer(1);
const countryCode = text({ pattern: /^[A-Z]{2}$/ });
const schemeCode = text({ pattern: /^[A-Z][A-Z0-9-]{1,29}$/ });
const sourceCode = text({ pattern: /^[A-Z][A-Z0-9_]{1,19}$/ });
const codeValue = text({ min: 1, max: 35 });
const placeName = text({ min: 1, max: 200 });
const placePath = text({ max: 400, pattern: /^[A-Z0-9-]+(\/[A-Z0-9-]+)*$/ });
const languageCode = text({ max: 8, pattern: /^[a-z]{2,3}(-[A-Z]{2})?$/ });
const level = nullable(integer(0, 6));

/** Número finito en un intervalo cerrado (coordenadas WGS 84). */
function between(min: number, max: number): Parser<number> {
  return (input, path) => (typeof input === 'number' && Number.isFinite(input) && input >= min && input <= max ? success(input) : failure(path, `número de ${min} a ${max}`));
}

/** Lista sin repetidos (`uniqueItems`). */
function uniqueArray<T>(parser: Parser<T>): Parser<readonly T[]> {
  const list = array(parser);
  return (input, path) => {
    const result = list(input, path);
    if (!result.ok) return result;
    return new Set(result.value).size === result.value.length ? result : failure(path, 'lista sin repetidos');
  };
}

export const parseCodeRef: Parser<CodeRef> = object<CodeRef>({ schemeCode, value: codeValue });
const parseSourceRef = object<SourceRef>({ code: sourceCode, version: nullable(text({ max: 50 })) });
const parseLicense = object<LicenseInfo>({ redistribution: oneOf(REDISTRIBUTIONS), attributionText: nullable(text({ max: 500 })) });

export const parsePlaceRef: Parser<PlaceRef> = object<PlaceRef>({
  id: uuid,
  type: oneOf(PLACE_TYPES),
  level,
  officialName: placeName,
  canonicalCode: nullable(parseCodeRef),
  status: oneOf(PLACE_STATUSES),
});

const parseGeoReference = object<GeoReference>({
  latitude: between(-90, 90),
  longitude: between(-180, 180),
  precision: oneOf(GEO_PRECISIONS),
  source: parseSourceRef,
  license: parseLicense,
});

const parsePlaceName = object<PlaceNameItem>({
  nameId: uuid,
  name: placeName,
  languageCode,
  kind: oneOf(NAME_KINDS),
  isPreferred: boolean,
  validFrom: civilDate,
  validTo: nullable(civilDate),
  isCurrent: boolean,
  source: parseSourceRef,
  license: parseLicense,
});

export const parseOfficialCode: Parser<OfficialCode> = object<OfficialCode>({
  codeId: uuid,
  schemeCode,
  value: codeValue,
  authority: text({ max: 100 }),
  isCanonical: boolean,
  validFrom: civilDate,
  validTo: nullable(civilDate),
  isCurrent: boolean,
  source: parseSourceRef,
  license: parseLicense,
});

const parseTradeLocationInfo = object<TradeLocationInfo>({
  unLocode: nullable(text({ pattern: /^[A-Z]{2}[A-Z2-9]{3}$/ })),
  siteCode: nullable(text({ pattern: /^[A-Z]{2}[A-Z2-9]{3}-[A-Z0-9]{1,10}$/ })),
  siteKind: nullable(oneOf(SITE_KINDS)),
  functions: uniqueArray(oneOf(TRADE_FUNCTIONS)),
  uneceStatus: nullable(oneOf(UNECE_STATUSES)),
  uneceStatusDate: nullable(civilDate),
  iataCode: nullable(text({ pattern: /^[A-Z]{3}$/ })),
  usableInTradeDocuments: boolean,
  siteCount: integer(0),
});

const parseSuccessionRef = object<SuccessionRef>({
  successionId: uuid,
  type: oneOf(SUCCESSION_TYPES),
  status: oneOf(SUCCESSION_STATUSES),
  role: oneOf(PARTICIPANT_ROLES),
  effectiveOn: civilDate,
});

const summaryShape = {
  id: uuid,
  type: oneOf(PLACE_TYPES),
  status: oneOf(PLACE_STATUSES),
  countryCode,
  level,
  officialName: placeName,
  matchedName: nullable(text({ max: 200 })),
  canonicalCode: nullable(parseCodeRef),
  parentId: nullable(uuid),
  path: placePath,
  displayPath: text({ max: 1000 }),
  redactedSchemes: array(schemeCode),
  version,
} as const;

export const parsePlaceSummary: Parser<PlaceSummary> = object<PlaceSummary>(summaryShape);
export const parsePlacePage: Parser<PlacePage> = pageOf(object<PlacePage>({ ...pageInfoShape, items: array(parsePlaceSummary) }));

const pathShape = {
  id: uuid,
  type: oneOf(PLACE_TYPES),
  status: oneOf(PLACE_STATUSES),
  countryCode,
  level,
  levelLabel: nullable(text({ max: 100 })),
  officialName: placeName,
  canonicalCode: nullable(parseCodeRef),
  parentId: nullable(uuid),
  path: placePath,
  displayPath: text({ max: 1000 }),
  ancestors: array(parsePlaceRef, 6),
  validFrom: civilDate,
  validTo: nullable(civilDate),
  isCurrent: boolean,
  version,
} as const;

export const parsePlacePath: Parser<PlacePath> = object<PlacePath>(pathShape);

const parsePlaceFields = object<Place>({
  ...pathShape,
  ...auditShape,
  names: array(parsePlaceName),
  codes: array(parseOfficialCode),
  geoReference: nullable(parseGeoReference),
  tradeLocation: nullable(parseTradeLocationInfo),
  successions: array(parseSuccessionRef),
  childCount: integer(0),
  license: parseLicense,
  redactedSchemes: array(schemeCode),
});

/** La ficha `full`. Además de la forma, que el código canónico sea uno de sus códigos. */
export const parsePlace: Parser<Place> = (input, path) => {
  const result = parsePlaceFields(input, path);
  if (!result.ok) return result;
  const { canonicalCode, codes } = result.value;
  const consistent = canonicalCode === null || codes.some((code) => code.schemeCode === canonicalCode.schemeCode && code.value === canonicalCode.value);
  return consistent ? result : failure(`${path}.canonicalCode`, 'uno de los códigos del lugar');
};

export const parsePlaceResolution: Parser<PlaceResolution> = object<PlaceResolution>({
  place: parsePlacePath,
  resolution: object<PlaceResolution['resolution']>({
    matchedCode: parseOfficialCode,
    placeStatus: oneOf(PLACE_STATUSES),
    successors: array(parsePlaceRef),
  }),
});

const countrySummaryShape = {
  placeId: uuid,
  alpha2: countryCode,
  alpha3: text({ pattern: /^[A-Z]{3}$/ }),
  numeric: text({ pattern: /^[0-9]{3}$/ }),
  officialName: placeName,
  englishName: nullable(text({ max: 200 })),
  status: oneOf(PLACE_STATUSES),
  levelCount: integer(0, 6),
  version,
} as const;

export const parseCountrySummary: Parser<CountrySummary> = object<CountrySummary>(countrySummaryShape);
export const parseCountryList: Parser<CountryList> = object<CountryList>({ items: array(parseCountrySummary) });

export const parseCountry: Parser<Country> = object<Country>({
  ...countrySummaryShape,
  ...auditShape,
  validFrom: civilDate,
  validTo: nullable(civilDate),
  codes: array(parseOfficialCode),
  territorialSchema: object<TerritorialSchemaSummary>({
    declared: boolean,
    levelCount: integer(0, 6),
    usesPostalCode: nullable(boolean),
    version: nullable(version),
  }),
});

const parseTerritorialLevel = object<TerritorialLevel>({
  order: integer(1, 6),
  canonicalLabel: oneOf(CANONICAL_LABELS),
  localLabel: text({ min: 1, max: 100 }),
  canonicalSchemeCode: schemeCode,
  isAddressLevel: boolean,
  placeCount: integer(0),
});

/** CO-05. Además de la forma, niveles contiguos desde 1 (`geo.country.level_order_invalid`). */
export const parseTerritorialSchema: Parser<TerritorialSchema> = (input, path) => {
  const result = object<TerritorialSchema>({
    ...auditShape,
    countryCode,
    levels: array(parseTerritorialLevel, 6),
    usesPostalCode: boolean,
    postalCodePattern: nullable(text({ max: 200 })),
    version,
  })(input, path);
  if (!result.ok) return result;
  const contiguous = result.value.levels.every((item, index) => item.order === index + 1);
  return contiguous ? result : failure(`${path}.levels`, 'niveles contiguos desde 1');
};

export const parseCorrespondence: Parser<Correspondence> = object<Correspondence>({
  ...auditShape,
  id: uuid,
  from: parseCodeRef,
  to: parseCodeRef,
  kind: oneOf(CORRESPONDENCE_KINDS),
  validFrom: civilDate,
  validTo: nullable(civilDate),
  isCurrent: boolean,
  note: nullable(text({ max: 500 })),
  source: parseSourceRef,
  version,
});

export const parseCorrespondencePage: Parser<CorrespondencePage> = pageOf(object<CorrespondencePage>({ ...pageInfoShape, items: array(parseCorrespondence) }));

const parseTradeLocationSummary = object<TradeLocationSummary>({ ...summaryShape, tradeLocation: parseTradeLocationInfo });
export const parseTradeLocationPage: Parser<TradeLocationPage> = pageOf(object<TradeLocationPage>({ ...pageInfoShape, items: array(parseTradeLocationSummary) }));
export const parseTradeLocationList: Parser<TradeLocationList> = object<TradeLocationList>({ items: array(parseTradeLocationSummary) });

export const parseCodeScheme: Parser<CodeScheme> = object<CodeScheme>({
  code: schemeCode,
  name: text({ min: 1, max: 200 }),
  authority: text({ min: 1, max: 100 }),
  description: nullable(text({ max: 500 })),
  countryCode: nullable(countryCode),
  appliesTo: uniqueArray(oneOf(PLACE_TYPES)),
  valuePattern: text({ min: 1, max: 200 }),
  maxLength: integer(1, 35),
  prefixRule: oneOf(PREFIX_RULES),
  isCanonical: boolean,
  defaultSourceCode: sourceCode,
  isActive: boolean,
  codeCount: integer(0),
  version,
});

export const parseSource: Parser<Source> = object<Source>({
  code: sourceCode,
  authority: text({ min: 1, max: 100 }),
  licenseName: text({ min: 1, max: 200 }),
  licenseUrl: nullable(text({ max: 400 })),
  attributionText: nullable(text({ max: 500 })),
  redistribution: oneOf(REDISTRIBUTIONS),
  confirmedOn: nullable(civilDate),
  evidenceRef: nullable(text({ max: 400 })),
  version,
});
