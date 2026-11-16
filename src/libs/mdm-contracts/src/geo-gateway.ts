import type {
  AddCodeRequest,
  CodeSchemeFilter,
  CorrectOfficialNameRequest,
  CorrespondenceQuery,
  CountryFilter,
  PlaceQuery,
  RegisterCorrespondenceRequest,
  RegisterCountryRequest,
  RegisterPlaceRequest,
  RegisterSiteRequest,
  ResolveQuery,
  TradeLocationQuery,
} from './geo-requests.ts';
import type {
  CodeScheme,
  CorrespondencePage,
  Country,
  CountryList,
  Place,
  PlacePage,
  PlaceResolution,
  Source,
  TerritorialSchema,
  TerritorialSchemaInput,
  TradeLocationList,
  TradeLocationPage,
} from './geography.ts';
import type { CatalogPage } from './catalogs.ts';
import type { CreatedResponse, ExpectedVersion, ReadOptions, WriteResult } from './gateway.ts';
import type { EndValidityRequest, ReasonRequest } from './requests.ts';

/**
 * Puerto de datos de la geografía (API-MDM-003, rutas bajo `/api/v1/geo`): un método por operación que usa la
 * interfaz en esta etapa. Lo implementa `@mdm/mock`; mañana, el cliente HTTP. Errores: `MdmProblemError` con el
 * `status` y el `code` `geo.*` del contrato. Cada agregado escribe con su propia versión (§2.1): la del lugar para
 * el lugar, sus nombres, sus códigos y sus lugares propios hijos no; la de la escalera para la escalera; la de la
 * correspondencia para la correspondencia.
 *
 * Fuera de esta etapa (sin método todavía): sucesiones, zonas postales, importaciones, nombres alternativos
 * (PL-06 a PL-08), reubicar (PL-12), punto de referencia (PL-13), edición de país (CO-04), alta de UN/LOCODE
 * (TL-02, TL-04), esquemas y fuentes (SC-02 a SC-06, SL-02 a SL-04) e historial (PL-11).
 */
export interface GeoGateway {
  // Países y política territorial (CO-01 a CO-03, CO-05 y CO-06).
  listCountries(filter: CountryFilter, options?: ReadOptions): Promise<CountryList>;
  getCountry(countryCode: string, options?: ReadOptions): Promise<Country>;
  registerCountry(request: RegisterCountryRequest): Promise<CreatedResponse>;
  /** `404` `geo.country.schema_not_declared` si el país aún no declaró su escalera. */
  getTerritorialSchema(countryCode: string, options?: ReadOptions): Promise<TerritorialSchema>;
  /** Primera declaración (`If-None-Match: *`): `412` si ya estaba declarada. */
  declareTerritorialSchema(countryCode: string, input: TerritorialSchemaInput): Promise<WriteResult>;
  /** Cambio con la versión de la escalera, no la del lugar país. */
  changeTerritorialSchema(countryCode: string, input: TerritorialSchemaInput, ifMatch: ExpectedVersion): Promise<WriteResult>;

  // Lugares (PL-01 a PL-05, PL-09, PL-10).
  searchPlaces(query: PlaceQuery, options?: ReadOptions): Promise<PlacePage>;
  resolvePlace(query: ResolveQuery, options?: ReadOptions): Promise<PlaceResolution>;
  /** Vista `full`. */
  getPlace(placeId: string, options?: ReadOptions): Promise<Place>;
  registerPlace(request: RegisterPlaceRequest): Promise<CreatedResponse>;
  correctOfficialName(placeId: string, request: CorrectOfficialNameRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;
  deactivatePlace(placeId: string, request: ReasonRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;
  reactivatePlace(placeId: string, request: ReasonRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;

  // Códigos oficiales del lugar (CD-02, CD-03). La lectura va en la ficha `full`.
  addPlaceCode(placeId: string, request: AddCodeRequest, ifMatch: ExpectedVersion): Promise<CreatedResponse>;
  expirePlaceCode(placeId: string, codeId: string, request: EndValidityRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;

  // Correspondencias (CR-01, CR-02, CR-04): agregado propio.
  listCorrespondences(query: CorrespondenceQuery, options?: ReadOptions): Promise<CorrespondencePage>;
  registerCorrespondence(request: RegisterCorrespondenceRequest): Promise<CreatedResponse>;
  expireCorrespondence(correspondenceId: string, request: EndValidityRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;

  // Comercio exterior y lugares propios (TL-01, TL-05, TL-06).
  searchTradeLocations(query: TradeLocationQuery, options?: ReadOptions): Promise<TradeLocationPage>;
  listSites(placeId: string, options?: ReadOptions): Promise<TradeLocationList>;
  /** Crea otro agregado: lee el padre sin escribirlo, sin `If-Match`. */
  registerSite(placeId: string, request: RegisterSiteRequest): Promise<CreatedResponse>;

  // Catálogos (SC-01, SL-01).
  listCodeSchemes(filter: CodeSchemeFilter, options?: ReadOptions): Promise<CatalogPage<CodeScheme>>;
  listSources(options?: ReadOptions): Promise<CatalogPage<Source>>;
}
