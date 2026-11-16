import { catalogOf, parseEstablishmentKind, parseIdentifierScheme, parsePartyRoleType, parseRelationshipKind } from './catalogs.ts';
import { parseCreatedResponse, parseRoleTypeCreatedResponse, parseWriteResult, type MdmGateway } from './gateway.ts';
import { array, type Parser } from './parse.ts';
import { parseEstablishment, parseParty, parsePartyPage } from './party.ts';
import { MdmContractError } from './problem.ts';
import { parseExternalReferencePage, parsePartyRelationshipPage } from './relationships.ts';
import {
  parseCodeScheme,
  parseCountry,
  parseCountryList,
  parseCorrespondencePage,
  parsePlace,
  parsePlacePage,
  parsePlaceResolution,
  parseSource,
  parseTerritorialSchema,
  parseTradeLocationList,
  parseTradeLocationPage,
} from './geography.ts';

let sequence = 0;

function correlation(): string {
  sequence += 1;
  return `mdm-contrato-${String(sequence).padStart(4, '0')}`;
}

/** Valida la respuesta de una operación; si no cumple el contrato, falla cerrado con `MdmContractError`. */
async function checked<T>(operation: string, parser: Parser<T>, response: Promise<unknown>): Promise<T> {
  const result = parser(await response, '$');
  if (!result.ok) throw new MdmContractError(operation, `${result.path}: se esperaba ${result.expected}`, correlation());
  return result.value;
}

const created = parseCreatedResponse;
const written = parseWriteResult;

/**
 * Frontera validada (ADR-0109 P-FE-06): envuelve cualquier implementación de `MdmGateway` —el mock hoy, el
 * cliente HTTP mañana— y comprueba en tiempo de ejecución cada respuesta antes de que llegue a la interfaz.
 * Los errores del servidor pasan tal cual: ya son `MdmProblemError` validados por quien los produce.
 */
export function withResponseValidation(base: MdmGateway): MdmGateway {
  return {
    listCountries: (filter, options) => checked('CO-01', parseCountryList, base.listCountries(filter, options)),
    getCountry: (countryCode, options) => checked('CO-03', parseCountry, base.getCountry(countryCode, options)),
    registerCountry: (request) => checked('CO-02', created, base.registerCountry(request)),
    getTerritorialSchema: (countryCode, options) =>
      checked('CO-05', parseTerritorialSchema, base.getTerritorialSchema(countryCode, options)),
    declareTerritorialSchema: (countryCode, input) =>
      checked('CO-06', written, base.declareTerritorialSchema(countryCode, input)),
    changeTerritorialSchema: (countryCode, input, ifMatch) =>
      checked('CO-06', written, base.changeTerritorialSchema(countryCode, input, ifMatch)),
    searchPlaces: (query, options) => checked('PL-01', parsePlacePage, base.searchPlaces(query, options)),
    resolvePlace: (query, options) => checked('PL-02', parsePlaceResolution, base.resolvePlace(query, options)),
    getPlace: (placeId, options) => checked('PL-04', parsePlace, base.getPlace(placeId, options)),
    registerPlace: (request) => checked('PL-03', created, base.registerPlace(request)),
    correctOfficialName: (placeId, request, ifMatch) =>
      checked('PL-05', written, base.correctOfficialName(placeId, request, ifMatch)),
    deactivatePlace: (placeId, request, ifMatch) =>
      checked('PL-09', written, base.deactivatePlace(placeId, request, ifMatch)),
    reactivatePlace: (placeId, request, ifMatch) =>
      checked('PL-10', written, base.reactivatePlace(placeId, request, ifMatch)),
    addPlaceCode: (placeId, request, ifMatch) =>
      checked('CD-02', created, base.addPlaceCode(placeId, request, ifMatch)),
    expirePlaceCode: (placeId, codeId, request, ifMatch) =>
      checked('CD-03', written, base.expirePlaceCode(placeId, codeId, request, ifMatch)),
    listCorrespondences: (query, options) =>
      checked('CR-01', parseCorrespondencePage, base.listCorrespondences(query, options)),
    registerCorrespondence: (request) =>
      checked('CR-02', created, base.registerCorrespondence(request)),
    expireCorrespondence: (correspondenceId, request, ifMatch) =>
      checked('CR-04', written, base.expireCorrespondence(correspondenceId, request, ifMatch)),
    searchTradeLocations: (query, options) =>
      checked('TL-01', parseTradeLocationPage, base.searchTradeLocations(query, options)),
    listSites: (placeId, options) => checked('TL-06', parseTradeLocationList, base.listSites(placeId, options)),
    registerSite: (placeId, request) => checked('TL-05', created, base.registerSite(placeId, request)),
    listCodeSchemes: (filter, options) =>
      checked('SC-01', catalogOf(parseCodeScheme), base.listCodeSchemes(filter, options)),
    listSources: (options) => checked('SL-01', catalogOf(parseSource), base.listSources(options)),
    listParties: (query, options) => checked('P-01', parsePartyPage, base.listParties(query, options)),
    getParty: (partyId, options) => checked('P-03', parseParty, base.getParty(partyId, options)),
    registerParty: (request) => checked('P-02', created, base.registerParty(request)),
    renameParty: (partyId, request, ifMatch) => checked('P-04', written, base.renameParty(partyId, request, ifMatch)),
    suspendParty: (partyId, request, ifMatch) => checked('P-05', written, base.suspendParty(partyId, request, ifMatch)),
    activateParty: (partyId, request, ifMatch) => checked('P-06', written, base.activateParty(partyId, request, ifMatch)),
    archiveParty: (partyId, ifMatch) => checked('P-07', written, base.archiveParty(partyId, ifMatch)),
    addIdentifier: (partyId, request, ifMatch) => checked('P-09', created, base.addIdentifier(partyId, request, ifMatch)),
    expireIdentifier: (partyId, identifierId, request, ifMatch) =>
      checked('P-10', written, base.expireIdentifier(partyId, identifierId, request, ifMatch)),
    assignRole: (partyId, request, ifMatch) => checked('P-12', created, base.assignRole(partyId, request, ifMatch)),
    suspendRole: (partyId, roleId, request, ifMatch) => checked('P-13', written, base.suspendRole(partyId, roleId, request, ifMatch)),
    activateRole: (partyId, roleId, request, ifMatch) => checked('P-14', written, base.activateRole(partyId, roleId, request, ifMatch)),
    terminateRole: (partyId, roleId, request, ifMatch) => checked('P-15', written, base.terminateRole(partyId, roleId, request, ifMatch)),
    listEstablishments: (partyId, status, options) => checked('P-16', array(parseEstablishment), base.listEstablishments(partyId, status, options)),
    openEstablishment: (partyId, request, ifMatch) => checked('P-18', created, base.openEstablishment(partyId, request, ifMatch)),
    changeEstablishment: (partyId, establishmentId, request, ifMatch) =>
      checked('P-19', written, base.changeEstablishment(partyId, establishmentId, request, ifMatch)),
    deactivateEstablishment: (partyId, establishmentId, request, ifMatch) =>
      checked('P-20', written, base.deactivateEstablishment(partyId, establishmentId, request, ifMatch)),
    reactivateEstablishment: (partyId, establishmentId, request, ifMatch) =>
      checked('P-21', written, base.reactivateEstablishment(partyId, establishmentId, request, ifMatch)),
    closeEstablishment: (partyId, establishmentId, ifMatch) => checked('P-22', written, base.closeEstablishment(partyId, establishmentId, ifMatch)),
    listRelationships: (query, options) => checked('R-01', parsePartyRelationshipPage, base.listRelationships(query, options)),
    startRelationship: (request) => checked('R-02', created, base.startRelationship(request)),
    endRelationship: (relationshipId, request, ifMatch) => checked('R-04', written, base.endRelationship(relationshipId, request, ifMatch)),
    listExternalReferences: (query, options) => checked('X-01', parseExternalReferencePage, base.listExternalReferences(query, options)),
    linkExternalReference: (request) => checked('X-02', created, base.linkExternalReference(request)),
    unlinkExternalReference: (externalReferenceId, ifMatch) => checked('X-04', written, base.unlinkExternalReference(externalReferenceId, ifMatch)),
    listIdentifierSchemes: (filter, options) => checked('C-01', catalogOf(parseIdentifierScheme), base.listIdentifierSchemes(filter, options)),
    listRoleTypes: (filter, options) => checked('C-02', catalogOf(parsePartyRoleType), base.listRoleTypes(filter, options)),
    listEstablishmentKinds: (options) => checked('C-03', catalogOf(parseEstablishmentKind), base.listEstablishmentKinds(options)),
    listRelationshipKinds: (options) => checked('C-04', catalogOf(parseRelationshipKind), base.listRelationshipKinds(options)),
    createRoleType: (request) => checked('C-05', parseRoleTypeCreatedResponse, base.createRoleType(request)),
    changeRoleType: (code, request, ifMatch) => checked('C-06', written, base.changeRoleType(code, request, ifMatch)),
    deactivateRoleType: (code, request, ifMatch) => checked('C-07', written, base.deactivateRoleType(code, request, ifMatch)),
    activateRoleType: (code, request, ifMatch) => checked('C-08', written, base.activateRoleType(code, request, ifMatch)),
  };
}
