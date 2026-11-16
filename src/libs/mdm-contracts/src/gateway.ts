import type { CatalogPage, EstablishmentKind, IdentifierScheme, PartyRoleType, RelationshipKind } from './catalogs.ts';
import { integer, object, uuid, type Parser } from './parse.ts';
import { catalogCode, type Establishment, type Party, type PartyPage } from './party.ts';
import type { GeoGateway } from './geo-gateway.ts';
import type { ExternalReferencePage, PartyRelationshipPage } from './relationships.ts';
import type {
  AddIdentifierRequest,
  CreateRoleTypeRequest,
  EndValidityRequest,
  EstablishmentInput,
  ExternalReferenceQuery,
  IdentifierSchemeFilter,
  LinkExternalReferenceRequest,
  OpenEstablishmentRequest,
  PartyQuery,
  ReasonRequest,
  RegisterPartyRequest,
  RelationshipQuery,
  RenamePartyRequest,
  RoleInput,
  RoleTypeFilter,
  RoleTypeInput,
  StartRelationshipRequest,
} from './requests.ts';
import type { EstablishmentStatusFilter } from './vocabulary.ts';

export interface ReadOptions {
  readonly signal?: AbortSignal;
}

/**
 * Versión que se envía en `If-Match` (API-MDM-002 §2.1): la del agregado que se escribe. Para la Party y sus
 * identificadores, roles y establecimientos es `Party.version`; para una relación, una referencia externa o un tipo
 * de rol, la suya.
 */
export type ExpectedVersion = number;

/** `201`: id del recurso creado y versión vigente del agregado que lo contiene (su nuevo `ETag`). */
export interface CreatedResponse {
  readonly id: string;
  readonly version: number;
}

/** `204` con el `ETag` nuevo del agregado. */
export interface WriteResult {
  readonly version: number;
}

/** `201` de C-05: el tipo de rol se identifica por su código (normalizado) y nace con versión 1. */
export interface RoleTypeCreatedResponse {
  readonly code: string;
  readonly version: number;
}

export const parseRoleTypeCreatedResponse: Parser<RoleTypeCreatedResponse> = object<RoleTypeCreatedResponse>({ code: catalogCode, version: integer(1) });
export const parseCreatedResponse: Parser<CreatedResponse> = object<CreatedResponse>({ id: uuid, version: integer(1) });
export const parseWriteResult: Parser<WriteResult> = object<WriteResult>({ version: integer(1) });

/**
 * Puerto de datos de MDM: un método por operación del contrato de Party que usa la interfaz. Hoy lo implementa
 * `@mdm/mock`; mañana, un cliente HTTP de la API. Todo error del contrato se lanza como `MdmProblemError` con su
 * `status` y `code`; la falta de respuesta, como `MdmNetworkError`. Una ruta con un id inexistente es `404`
 * `common.not_found`. Incluye la geografía de la suite (`GeoGateway`, API-MDM-003): un solo puerto para MDM.
 */
export interface MdmGateway extends GeoGateway {
  // Party (P-01 a P-07)
  listParties(query: PartyQuery, options?: ReadOptions): Promise<PartyPage>;
  getParty(partyId: string, options?: ReadOptions): Promise<Party>;
  registerParty(request: RegisterPartyRequest): Promise<CreatedResponse>;
  renameParty(partyId: string, request: RenamePartyRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;
  suspendParty(partyId: string, request: ReasonRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;
  activateParty(partyId: string, request: ReasonRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;
  /** Archiva (terminal). */
  archiveParty(partyId: string, ifMatch: ExpectedVersion): Promise<WriteResult>;

  // Identificadores (P-09, P-10). La lectura va en la ficha (P-03).
  addIdentifier(partyId: string, request: AddIdentifierRequest, ifMatch: ExpectedVersion): Promise<CreatedResponse>;
  expireIdentifier(partyId: string, identifierId: string, request: EndValidityRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;

  // Roles (P-12 a P-15). La lectura va en la ficha (P-03).
  assignRole(partyId: string, request: RoleInput, ifMatch: ExpectedVersion): Promise<CreatedResponse>;
  suspendRole(partyId: string, roleId: string, request: ReasonRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;
  activateRole(partyId: string, roleId: string, request: ReasonRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;
  terminateRole(partyId: string, roleId: string, request: EndValidityRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;

  // Establecimientos (P-16 a P-22)
  listEstablishments(partyId: string, status: EstablishmentStatusFilter | null, options?: ReadOptions): Promise<readonly Establishment[]>;
  openEstablishment(partyId: string, request: OpenEstablishmentRequest, ifMatch: ExpectedVersion): Promise<CreatedResponse>;
  changeEstablishment(partyId: string, establishmentId: string, request: EstablishmentInput, ifMatch: ExpectedVersion): Promise<WriteResult>;
  deactivateEstablishment(partyId: string, establishmentId: string, request: ReasonRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;
  reactivateEstablishment(partyId: string, establishmentId: string, request: ReasonRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;
  /** Cierra (terminal). */
  closeEstablishment(partyId: string, establishmentId: string, ifMatch: ExpectedVersion): Promise<WriteResult>;

  // Relaciones (R-01, R-02, R-04): agregado propio, con su versión.
  listRelationships(query: RelationshipQuery, options?: ReadOptions): Promise<PartyRelationshipPage>;
  startRelationship(request: StartRelationshipRequest): Promise<CreatedResponse>;
  endRelationship(relationshipId: string, request: EndValidityRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;

  // Referencias externas (X-01, X-02, X-04): agregado propio, con su versión.
  listExternalReferences(query: ExternalReferenceQuery, options?: ReadOptions): Promise<ExternalReferencePage>;
  linkExternalReference(request: LinkExternalReferenceRequest): Promise<CreatedResponse>;
  /** Desvincula (terminal). */
  unlinkExternalReference(externalReferenceId: string, ifMatch: ExpectedVersion): Promise<WriteResult>;

  // Catálogos (C-01 a C-04): lectura.
  listIdentifierSchemes(filter: IdentifierSchemeFilter, options?: ReadOptions): Promise<CatalogPage<IdentifierScheme>>;
  listRoleTypes(filter: RoleTypeFilter, options?: ReadOptions): Promise<CatalogPage<PartyRoleType>>;
  listEstablishmentKinds(options?: ReadOptions): Promise<CatalogPage<EstablishmentKind>>;
  listRelationshipKinds(options?: ReadOptions): Promise<CatalogPage<RelationshipKind>>;

  // Tipos de rol (C-05 a C-08, D-046): versión propia por tipo; la ruta lleva su código.
  createRoleType(request: CreateRoleTypeRequest): Promise<RoleTypeCreatedResponse>;
  changeRoleType(code: string, request: RoleTypeInput, ifMatch: ExpectedVersion): Promise<WriteResult>;
  /** Desactiva: no se asigna a roles nuevos; los existentes se conservan. */
  deactivateRoleType(code: string, request: ReasonRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;
  activateRoleType(code: string, request: ReasonRequest, ifMatch: ExpectedVersion): Promise<WriteResult>;
}
