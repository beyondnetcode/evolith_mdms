import type {
  AddIdentifierRequest,
  CatalogPage,
  AddCodeRequest,
  CodeSchemeFilter,
  CorrectOfficialNameRequest,
  CorrespondenceQuery,
  CountryFilter,
  CreateRoleTypeRequest,
  CreatedResponse,
  EndValidityRequest,
  Establishment,
  EstablishmentInput,
  EstablishmentKind,
  EstablishmentStatusFilter,
  ExternalReferencePage,
  ExternalReferenceQuery,
  IdentifierScheme,
  IdentifierSchemeFilter,
  LinkExternalReferenceRequest,
  MdmGateway,
  MdmRole,
  OpenEstablishmentRequest,
  Party,
  PartyPage,
  PartyQuery,
  PartyRelationshipPage,
  PartyRoleType,
  Place,
  PlacePage,
  PlaceQuery,
  PlaceResolution,
  ReadOptions,
  ReasonRequest,
  RegisterPartyRequest,
  RelationshipKind,
  RelationshipQuery,
  RegisterCountryRequest,
  RenamePartyRequest,
  RoleInput,
  RoleTypeCreatedResponse,
  RoleTypeFilter,
  RoleTypeInput,
  RegisterCorrespondenceRequest,
  RegisterPlaceRequest,
  RegisterSiteRequest,
  ResolveQuery,
  StartRelationshipRequest,
  TerritorialSchema,
  TerritorialSchemaInput,
  TradeLocationList,
  TradeLocationPage,
  TradeLocationQuery,
  WriteResult,
} from '@mdm/contracts';
import { isGranted, type MockWriteOperation } from './authorization.ts';
import { ESTABLISHMENT_KINDS, IDENTIFIER_SCHEMES, RELATIONSHIP_KINDS } from './catalogs.ts';
import { systemClock, type MockClock } from './clock.ts';
import { findParty, type MockContext } from './context.ts';
import { forbidden, serverError } from './errors.ts';
import * as geoQueries from './geo-queries.ts';
import * as geoWrites from './geo-writes.ts';
import * as establishments from './establishment-writes.ts';
import * as links from './link-writes.ts';
import * as parties from './party-writes.ts';
import * as queries from './queries.ts';
import * as roleTypes from './role-type-writes.ts';
import * as roles from './role-writes.ts';
import { MdmMockStore } from './store.ts';
import { toParty } from './views.ts';

/** Simulaciones de red (`?sim=`): `vacio` deja el maestro sin organizaciones y `error` falla cada llamada con `500`. */
export type MdmSimulationMode = 'normal' | 'vacio' | 'error';

export interface MockMdmGatewayOptions {
  readonly store?: MdmMockStore;
  /** Latencia simulada de cada llamada, en milisegundos. */
  readonly latencyMs?: number;
  readonly mode?: MdmSimulationMode;
  readonly clock?: MockClock;
  /** Quién escribe (el `sub` del portador): queda en la auditoría. */
  readonly actor?: string;
  /**
   * Rol de MDM del portador. Con rol, las escrituras que la matriz supuesta no le concede responden `403`
   * `auth.forbidden` (`authorization.ts`); sin rol, como el contrato vigente, no se comprueba.
   */
  readonly role?: MdmRole | null;
}

function wait(milliseconds: number, signal: AbortSignal | undefined): Promise<void> {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason instanceof Error ? signal.reason : new DOMException('Cancelada', 'AbortError'));
      },
      { once: true },
    );
  });
}

const EMPTY_PAGE: PartyPage = { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 };

/**
 * `MdmGateway` en memoria: un servidor en miniatura que cumple las invariantes `INV-PTY-02` a `INV-PTY-13`, el
 * orden de evaluación y los códigos de error de API-MDM-002, con concurrencia optimista por versión (`412`).
 * Desaparece al conectar la API: solo `mdm-app/infrastructure` lo conoce.
 */
export class MockMdmGateway implements MdmGateway {
  readonly store: MdmMockStore;
  private readonly context: MockContext;
  private readonly latencyMs: number;
  private readonly mode: MdmSimulationMode;
  private readonly role: MdmRole | null;

  constructor(options: MockMdmGatewayOptions = {}) {
    this.store = options.store ?? new MdmMockStore();
    this.context = { store: this.store, clock: options.clock ?? systemClock, actor: options.actor ?? 'usuario.mock' };
    this.latencyMs = options.latencyMs ?? 0;
    this.mode = options.mode ?? 'normal';
    this.role = options.role ?? null;
  }

  /** Latencia y simulación de fallo; después, la operación en sí (síncrona sobre el almacén). */
  private async run<T>(operation: () => T, options?: ReadOptions): Promise<T> {
    await wait(this.latencyMs, options?.signal);
    if (this.mode === 'error') serverError();
    return operation();
  }

  /** Escritura: además, la autorización (`403`), que el contrato evalúa justo tras la autenticación. */
  private write<T>(id: MockWriteOperation, operation: () => T): Promise<T> {
    return this.run(() => {
      if (!isGranted(this.role, id)) forbidden();
      return operation();
    });
  }

  listCountries(filter: CountryFilter, options?: ReadOptions) {
    return this.run(() => geoQueries.listCountries(this.context, filter), options);
  }

  getCountry(countryCode: string, options?: ReadOptions) {
    return this.run(() => geoQueries.getCountry(this.context, countryCode), options);
  }

  registerCountry(request: RegisterCountryRequest) {
    return this.write('CO-02', () => geoWrites.registerCountry(this.context, request));
  }

  getTerritorialSchema(countryCode: string, options?: ReadOptions): Promise<TerritorialSchema> {
    return this.run(() => geoQueries.getTerritorialSchema(this.context, countryCode), options);
  }

  declareTerritorialSchema(countryCode: string, input: TerritorialSchemaInput) {
    return this.write('CO-06', () => geoWrites.declareTerritorialSchema(this.context, countryCode, input));
  }

  changeTerritorialSchema(countryCode: string, input: TerritorialSchemaInput, ifMatch: number) {
    return this.write('CO-06', () => geoWrites.changeTerritorialSchema(this.context, countryCode, input, ifMatch));
  }

  searchPlaces(query: PlaceQuery, options?: ReadOptions): Promise<PlacePage> {
    return this.run(() => geoQueries.searchPlaces(this.context, query), options);
  }

  resolvePlace(query: ResolveQuery, options?: ReadOptions): Promise<PlaceResolution> {
    return this.run(() => geoQueries.resolvePlace(this.context, query), options);
  }

  getPlace(placeId: string, options?: ReadOptions): Promise<Place> {
    return this.run(() => geoQueries.getPlace(this.context, placeId), options);
  }

  registerPlace(request: RegisterPlaceRequest) {
    return this.write('PL-03', () => geoWrites.registerPlace(this.context, request));
  }

  correctOfficialName(placeId: string, request: CorrectOfficialNameRequest, ifMatch: number) {
    return this.write('PL-05', () => geoWrites.correctOfficialName(this.context, placeId, request, ifMatch));
  }

  deactivatePlace(placeId: string, request: ReasonRequest, ifMatch: number) {
    return this.write('PL-09', () => geoWrites.deactivatePlace(this.context, placeId, request, ifMatch));
  }

  reactivatePlace(placeId: string, request: ReasonRequest, ifMatch: number) {
    return this.write('PL-10', () => geoWrites.reactivatePlace(this.context, placeId, request, ifMatch));
  }

  addPlaceCode(placeId: string, request: AddCodeRequest, ifMatch: number) {
    return this.write('CD-02', () => geoWrites.addPlaceCode(this.context, placeId, request, ifMatch));
  }

  expirePlaceCode(placeId: string, codeId: string, request: EndValidityRequest, ifMatch: number) {
    return this.write('CD-03', () => geoWrites.expirePlaceCode(this.context, { placeId, codeId, request, ifMatch }));
  }

  listCorrespondences(query: CorrespondenceQuery, options?: ReadOptions) {
    return this.run(() => geoQueries.listCorrespondences(this.context, query), options);
  }

  registerCorrespondence(request: RegisterCorrespondenceRequest) {
    return this.write('CR-02', () => geoWrites.registerCorrespondence(this.context, request));
  }

  expireCorrespondence(correspondenceId: string, request: EndValidityRequest, ifMatch: number) {
    return this.write('CR-04', () => geoWrites.expireCorrespondence(this.context, correspondenceId, request, ifMatch));
  }

  searchTradeLocations(query: TradeLocationQuery, options?: ReadOptions): Promise<TradeLocationPage> {
    return this.run(() => geoQueries.searchTradeLocations(this.context, query), options);
  }

  listSites(placeId: string, options?: ReadOptions): Promise<TradeLocationList> {
    return this.run(() => geoQueries.listSites(this.context, placeId), options);
  }

  registerSite(placeId: string, request: RegisterSiteRequest) {
    return this.write('TL-05', () => geoWrites.registerSite(this.context, placeId, request));
  }

  listCodeSchemes(filter: CodeSchemeFilter, options?: ReadOptions) {
    return this.run(() => geoQueries.listCodeSchemes(this.context, filter), options);
  }

  listSources(options?: ReadOptions) {
    return this.run(() => geoQueries.listSources(this.context), options);
  }

  listParties(query: PartyQuery, options?: ReadOptions): Promise<PartyPage> {
    return this.run(() => (this.mode === 'vacio' ? { ...EMPTY_PAGE, pageSize: query.pageSize } : queries.listParties(this.context, query)), options);
  }

  getParty(partyId: string, options?: ReadOptions): Promise<Party> {
    return this.run(() => toParty(findParty(this.context, partyId), this.context.clock.today()), options);
  }

  registerParty(request: RegisterPartyRequest): Promise<CreatedResponse> {
    return this.write('P-02', () => parties.registerParty(this.context, request));
  }

  renameParty(partyId: string, request: RenamePartyRequest, ifMatch: number): Promise<WriteResult> {
    return this.write('P-04', () => parties.renameParty(this.context, partyId, request, ifMatch));
  }

  suspendParty(partyId: string, request: ReasonRequest, ifMatch: number): Promise<WriteResult> {
    return this.write('P-05', () => parties.suspendParty(this.context, partyId, request, ifMatch));
  }

  activateParty(partyId: string, request: ReasonRequest, ifMatch: number): Promise<WriteResult> {
    return this.write('P-06', () => parties.activateParty(this.context, partyId, request, ifMatch));
  }

  archiveParty(partyId: string, ifMatch: number): Promise<WriteResult> {
    return this.write('P-07', () => parties.archiveParty(this.context, partyId, ifMatch));
  }

  addIdentifier(partyId: string, request: AddIdentifierRequest, ifMatch: number): Promise<CreatedResponse> {
    return this.write('P-09', () => parties.addIdentifier(this.context, partyId, request, ifMatch));
  }

  expireIdentifier(partyId: string, identifierId: string, request: EndValidityRequest, ifMatch: number): Promise<WriteResult> {
    return this.write('P-10', () => parties.expireIdentifier(this.context, { partyId, id: identifierId }, request, ifMatch));
  }

  assignRole(partyId: string, request: RoleInput, ifMatch: number): Promise<CreatedResponse> {
    return this.write('P-12', () => roles.assignRole(this.context, partyId, request, ifMatch));
  }

  suspendRole(partyId: string, roleId: string, request: ReasonRequest, ifMatch: number): Promise<WriteResult> {
    return this.write('P-13', () => roles.suspendRole(this.context, { partyId, id: roleId }, request, ifMatch));
  }

  activateRole(partyId: string, roleId: string, request: ReasonRequest, ifMatch: number): Promise<WriteResult> {
    return this.write('P-14', () => roles.activateRole(this.context, { partyId, id: roleId }, request, ifMatch));
  }

  terminateRole(partyId: string, roleId: string, request: EndValidityRequest, ifMatch: number): Promise<WriteResult> {
    return this.write('P-15', () => roles.terminateRole(this.context, { partyId, id: roleId }, request, ifMatch));
  }

  listEstablishments(partyId: string, status: EstablishmentStatusFilter | null, options?: ReadOptions): Promise<readonly Establishment[]> {
    return this.run(() => queries.listEstablishments(this.context, partyId, status), options);
  }

  openEstablishment(partyId: string, request: OpenEstablishmentRequest, ifMatch: number): Promise<CreatedResponse> {
    return this.write('P-18', () => establishments.openEstablishment(this.context, partyId, request, ifMatch));
  }

  changeEstablishment(partyId: string, establishmentId: string, request: EstablishmentInput, ifMatch: number): Promise<WriteResult> {
    return this.write('P-19', () => establishments.changeEstablishment(this.context, { partyId, id: establishmentId }, request, ifMatch));
  }

  deactivateEstablishment(partyId: string, establishmentId: string, request: ReasonRequest, ifMatch: number): Promise<WriteResult> {
    return this.write('P-20', () => establishments.deactivateEstablishment(this.context, { partyId, id: establishmentId }, request, ifMatch));
  }

  reactivateEstablishment(partyId: string, establishmentId: string, request: ReasonRequest, ifMatch: number): Promise<WriteResult> {
    return this.write('P-21', () => establishments.reactivateEstablishment(this.context, { partyId, id: establishmentId }, request, ifMatch));
  }

  closeEstablishment(partyId: string, establishmentId: string, ifMatch: number): Promise<WriteResult> {
    return this.write('P-22', () => establishments.closeEstablishment(this.context, { partyId, id: establishmentId }, ifMatch));
  }

  listRelationships(query: RelationshipQuery, options?: ReadOptions): Promise<PartyRelationshipPage> {
    return this.run(() => queries.listRelationships(this.context, query), options);
  }

  startRelationship(request: StartRelationshipRequest): Promise<CreatedResponse> {
    return this.write('R-02', () => links.startRelationship(this.context, request));
  }

  endRelationship(relationshipId: string, request: EndValidityRequest, ifMatch: number): Promise<WriteResult> {
    return this.write('R-04', () => links.endRelationship(this.context, relationshipId, request, ifMatch));
  }

  listExternalReferences(query: ExternalReferenceQuery, options?: ReadOptions): Promise<ExternalReferencePage> {
    return this.run(() => queries.listExternalReferences(this.context, query), options);
  }

  linkExternalReference(request: LinkExternalReferenceRequest): Promise<CreatedResponse> {
    return this.write('X-02', () => links.linkExternalReference(this.context, request));
  }

  unlinkExternalReference(externalReferenceId: string, ifMatch: number): Promise<WriteResult> {
    return this.write('X-04', () => links.unlinkExternalReference(this.context, externalReferenceId, ifMatch));
  }

  listIdentifierSchemes(filter: IdentifierSchemeFilter, options?: ReadOptions): Promise<CatalogPage<IdentifierScheme>> {
    return this.run(
      () => ({
        items: IDENTIFIER_SCHEMES.filter(
          (scheme) =>
            (filter.includeInactive || scheme.isActive) &&
            (filter.countryCode === null || scheme.countryCode === filter.countryCode) &&
            (filter.partyType === null || scheme.allowedPartyTypes.includes(filter.partyType)),
        ),
      }),
      options,
    );
  }

  listRoleTypes(filter: RoleTypeFilter, options?: ReadOptions): Promise<CatalogPage<PartyRoleType>> {
    return this.run(() => ({ items: roleTypes.listRoleTypes(this.context, filter) }), options);
  }

  createRoleType(request: CreateRoleTypeRequest): Promise<RoleTypeCreatedResponse> {
    return this.write('C-05', () => roleTypes.createRoleType(this.context, request));
  }

  changeRoleType(code: string, request: RoleTypeInput, ifMatch: number): Promise<WriteResult> {
    return this.write('C-06', () => roleTypes.changeRoleType(this.context, code, request, ifMatch));
  }

  deactivateRoleType(code: string, request: ReasonRequest, ifMatch: number): Promise<WriteResult> {
    return this.write('C-07', () => roleTypes.deactivateRoleType(this.context, code, request, ifMatch));
  }

  activateRoleType(code: string, request: ReasonRequest, ifMatch: number): Promise<WriteResult> {
    return this.write('C-08', () => roleTypes.activateRoleType(this.context, code, request, ifMatch));
  }

  listEstablishmentKinds(options?: ReadOptions): Promise<CatalogPage<EstablishmentKind>> {
    return this.run(() => ({ items: ESTABLISHMENT_KINDS.filter((kind) => kind.isActive) }), options);
  }

  listRelationshipKinds(options?: ReadOptions): Promise<CatalogPage<RelationshipKind>> {
    return this.run(() => ({ items: RELATIONSHIP_KINDS.filter((kind) => kind.isActive) }), options);
  }
}
