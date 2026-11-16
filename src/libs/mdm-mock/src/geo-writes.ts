import {
  normalizeGeoCode,
  normalizePlaceName,
  GEO_PRECISIONS,
  SITE_KINDS,
  type AddCodeRequest,
  type CorrectOfficialNameRequest,
  type CreatedResponse,
  type EndValidityRequest,
  type ReasonRequest,
  type RegisterCorrespondenceRequest,
  type RegisterCountryRequest,
  type RegisterPlaceRequest,
  type RegisterSiteRequest,
  type CodeScheme,
  type GeoReferenceInput,
  type LicenseInfo,
  type Source,
  type TerritorialSchemaInput,
  type WriteResult,
} from '@mdm/contracts';
import { addDays, isWithin } from './clock.ts';
import { checkReason, found, optionalText, requireDate, requireOrderedValidity, requireText, type MockContext } from './context.ts';
import { conflict, invalid, notFound, preconditionFailed, unprocessable } from './errors.ts';
import type { GeoCodeRecord, GeoNameRecord, GeoPlaceRecord, GeoCorrespondenceRecord } from './geo-store.ts';
import { findGeoPlace } from './geo-views.ts';
import { MAX_LADDER_LEVELS } from '@mdm/contracts';

function now(context: MockContext): string {
  return context.clock.now();
}

function touch(context: MockContext, record: { updatedAt: string | null; updatedBy: string | null }): void {
  record.updatedAt = now(context);
  record.updatedBy = context.actor;
}

function writable(place: GeoPlaceRecord): void {
  if (place.status === 'Historical') conflict('geo.place.historical');
}

function checkPlaceVersion(context: MockContext, id: string, ifMatch: number): GeoPlaceRecord {
  const place = findGeoPlace(context.store, id);
  if (place.version !== ifMatch) preconditionFailed();
  writable(place);
  return place;
}

function requireSource(context: MockContext, sourceCode: string): string {
  const code = requireText('sourceCode', sourceCode, 20, 'source_code').toUpperCase();
  if (!context.store.sources.has(code)) unprocessable('geo.source.unknown');
  return code;
}

function requireSchema(context: MockContext, countryCode: string) {
  const country = context.store.geoCountries.get(countryCode);
  if (country === undefined) return notFound();
  if (country.schema === null) conflict('geo.country.schema_not_declared');
  return country.schema;
}

function validateTerritorialLevels(input: TerritorialSchemaInput): void {
  const invalidOrder = input.levels.length > MAX_LADDER_LEVELS
    || input.levels.some((level, index) => level.order !== index + 1)
    || input.levels.filter((level) => level.isAddressLevel).length > 1
    || input.levels.some((level) => level.canonicalLabel !== `ADM${level.order}`);
  if (invalidOrder) unprocessable('geo.country.level_order_invalid');
}

function validatePostalPolicy(input: TerritorialSchemaInput): void {
  if (input.usesPostalCode && (input.postalCodePattern === null || input.postalCodePattern.trim() === '')) invalid('postalCodePattern', 'validation.postal_pattern_required');
  if (input.postalCodePattern !== null) {
    try {
      new RegExp(input.postalCodePattern);
    } catch {
      invalid('postalCodePattern', 'validation.pattern_invalid');
    }
  }
}

function validateLevelSchemes(context: MockContext, countryCode: string, input: TerritorialSchemaInput): void {
  for (const level of input.levels) {
    const scheme = context.store.codeSchemes.get(level.canonicalSchemeCode);
    if (!scheme?.isActive) unprocessable('geo.scheme.unknown');
    if (!scheme.appliesTo.includes('AdministrativeDivision') || (scheme.countryCode !== null && scheme.countryCode !== countryCode)) {
      unprocessable('geo.scheme.not_applicable');
    }
    requireText('localLabel', level.localLabel, 100, 'local_label');
  }
}

function checkTerritorialSchema(context: MockContext, countryCode: string, input: TerritorialSchemaInput): TerritorialSchemaInput {
  validateTerritorialLevels(input);
  validatePostalPolicy(input);
  validateLevelSchemes(context, countryCode, input);
  return input;
}

function countryCodeRecord(
  context: MockContext,
  input: {
    readonly countryCode: string;
    readonly schemeCode: string;
    readonly value: string;
    readonly sourceCode: string;
    readonly sourceVersion: string | null;
    readonly validFrom: string;
    readonly canonical: boolean;
  },
): GeoCodeRecord {
  const scheme = context.store.codeSchemes.get(input.schemeCode);
  if (!scheme?.isActive || !scheme.appliesTo.includes('Country') ||
    (scheme.countryCode !== null && scheme.countryCode !== input.countryCode)) {
    unprocessable('geo.scheme.not_applicable');
  }
  const value = normalizedCode(scheme, input.value);
  if ([...context.store.geoPlaces.values()].some((place) =>
    place.codes.some((code) => code.schemeCode === scheme.code && code.value === value))) {
    conflict('geo.code.duplicate');
  }
  const source = context.store.sources.get(input.sourceCode);
  if (source === undefined) unprocessable('geo.source.unknown');
  return {
    codeId: context.store.newId(),
    schemeCode: scheme.code,
    value,
    authority: scheme.authority,
    isCanonical: input.canonical,
    validFrom: input.validFrom,
    validTo: null,
    isCurrent: true,
    source: { code: input.sourceCode, version: input.sourceVersion },
    license: { redistribution: source.redistribution, attributionText: source.attributionText },
  };
}

export function registerCountry(context: MockContext, request: RegisterCountryRequest): CreatedResponse {
  const alpha2 = request.alpha2.trim().toUpperCase();
  const alpha3 = request.alpha3.trim().toUpperCase();
  const numeric = request.numeric.trim();
  if (!/^[A-Z]{2}$/.test(alpha2)) invalid('alpha2', 'validation.country_code_invalid');
  if (!/^[A-Z]{3}$/.test(alpha3)) invalid('alpha3', 'validation.country_code_invalid');
  if (!/^[0-9]{3}$/.test(numeric)) invalid('numeric', 'validation.code_invalid');
  const officialName = requireText('officialName', request.officialName, 200, 'place_name');
  const englishName = optionalText('englishName', request.englishName, 200, 'place_name');
  const sourceCode = requireSource(context, request.sourceCode);
  const sourceVersion = optionalText('sourceVersion', request.sourceVersion, 50, 'source_version');
  const validFrom = requireDate('validFrom', request.validFrom, context.clock.today());
  if (context.store.geoCountries.has(alpha2)) conflict('geo.code.duplicate');
  const codes = [
    countryCodeRecord(context, { countryCode: alpha2, schemeCode: 'ISO-3166-1-A2', value: alpha2, sourceCode, sourceVersion, validFrom, canonical: true }),
    countryCodeRecord(context, { countryCode: alpha2, schemeCode: 'ISO-3166-1-A3', value: alpha3, sourceCode, sourceVersion, validFrom, canonical: false }),
    countryCodeRecord(context, { countryCode: alpha2, schemeCode: 'ISO-3166-1-N', value: numeric, sourceCode, sourceVersion, validFrom, canonical: false }),
  ];
  const source = context.store.sources.get(sourceCode);
  if (source === undefined) unprocessable('geo.source.unknown');
  const license: LicenseInfo = { redistribution: source.redistribution, attributionText: source.attributionText };
  const id = context.store.newId();
  const names: GeoNameRecord[] = [{
    nameId: context.store.newId(),
    name: officialName,
    languageCode: 'es',
    kind: 'Official',
    isPreferred: true,
    validFrom,
    validTo: null,
    isCurrent: true,
    source: { code: sourceCode, version: sourceVersion },
    license,
  }];
  if (englishName !== null) {
    names.push({
      nameId: context.store.newId(),
      name: englishName,
      languageCode: 'en',
      kind: 'InternationalTrade',
      isPreferred: false,
      validFrom,
      validTo: null,
      isCurrent: true,
      source: { code: sourceCode, version: sourceVersion },
      license,
    });
  }
  const place: GeoPlaceRecord = {
    id,
    type: 'Country',
    status: 'Active',
    statusHistory: [{ status: 'Active', validFrom, validTo: null }],
    countryCode: alpha2,
    level: 0,
    levelLabel: null,
    officialName,
    canonicalCode: { schemeCode: 'ISO-3166-1-A2', value: alpha2 },
    parentId: null,
    validFrom,
    validTo: null,
    version: 1,
    names,
    codes,
    geoReference: null,
    tradeLocation: null,
    successions: [],
    license,
    createdAt: now(context),
    createdBy: context.actor,
    updatedAt: null,
    updatedBy: null,
  };
  context.store.geoPlaces.set(id, place);
  context.store.geoCountries.set(alpha2, { alpha2, alpha3, numeric, englishName, placeId: id, schema: null });
  return { id, version: 1 };
}

function schemaSnapshot(context: MockContext, countryCode: string, input: TerritorialSchemaInput, version: number) {
  const audit = version === 1 ? { createdAt: now(context), createdBy: context.actor, updatedAt: null, updatedBy: null } : {
    createdAt: context.store.geoCountries.get(countryCode)?.schema?.createdAt ?? now(context),
    createdBy: context.store.geoCountries.get(countryCode)?.schema?.createdBy ?? context.actor,
    updatedAt: now(context),
    updatedBy: context.actor,
  };
  return {
    countryCode,
    levels: input.levels.map((level) => ({
      ...level,
      localLabel: level.localLabel.trim(),
      placeCount: [...context.store.geoPlaces.values()].filter((place) => place.countryCode === countryCode && place.level === level.order).length,
    })),
    usesPostalCode: input.usesPostalCode,
    postalCodePattern: input.usesPostalCode ? input.postalCodePattern : null,
    version,
    ...audit,
  };
}

export function declareTerritorialSchema(context: MockContext, countryCode: string, input: TerritorialSchemaInput): WriteResult {
  const country = context.store.geoCountries.get(countryCode);
  if (country === undefined) return notFound();
  if (country.schema !== null) preconditionFailed();
  const checked = checkTerritorialSchema(context, countryCode, input);
  country.schema = schemaSnapshot(context, countryCode, checked, 1);
  return { version: 1 };
}

export function changeTerritorialSchema(context: MockContext, countryCode: string, input: TerritorialSchemaInput, ifMatch: number): WriteResult {
  const country = context.store.geoCountries.get(countryCode);
  if (country === undefined) return notFound();
  const current = country.schema;
  if (current === null) return notFound();
  if (current.version !== ifMatch) preconditionFailed();
  const checked = checkTerritorialSchema(context, countryCode, input);
  for (const level of current.levels) {
    const hasPlaces = [...context.store.geoPlaces.values()].some((place) => place.countryCode === countryCode && place.level === level.order);
    const retainsLevel = checked.levels.some((replacement) => replacement.order === level.order && replacement.canonicalLabel === level.canonicalLabel);
    if (hasPlaces && !retainsLevel) conflict('geo.country.level_in_use');
  }
  country.schema = schemaSnapshot(context, countryCode, checked, current.version + 1);
  return { version: country.schema.version };
}

interface CodeValidation {
  readonly place: GeoPlaceRecord;
  readonly schemeCode: string;
  readonly valueInput: string;
  readonly sourceCode: string;
}

interface CodePrefixValidation {
  readonly place: GeoPlaceRecord;
  readonly schemeCode: string;
  readonly prefixRule: string;
  readonly value: string;
}

function activeScheme(context: MockContext, place: GeoPlaceRecord, schemeCode: string) {
  const scheme = context.store.codeSchemes.get(schemeCode);
  if (!scheme?.isActive) unprocessable('geo.scheme.unknown');
  if (!scheme.appliesTo.includes(place.type) || (scheme.countryCode !== null && scheme.countryCode !== place.countryCode)) unprocessable('geo.scheme.not_applicable');
  return scheme;
}

function normalizedCode(scheme: { readonly maxLength: number; readonly valuePattern: string }, valueInput: string): string {
  const value = normalizeGeoCode(requireText('value', valueInput, scheme.maxLength, 'code'));
  let pattern: RegExp;
  try {
    pattern = new RegExp(scheme.valuePattern);
  } catch {
    unprocessable('geo.code.invalid_format');
  }
  if (!pattern.test(value)) unprocessable('geo.code.invalid_format');
  return value;
}

function validateParentCode(value: string, parentValue: string | undefined): void {
  if (parentValue !== undefined && !value.startsWith(parentValue)) unprocessable('geo.code.hierarchy_mismatch');
}

function validateUbigeoLength(schemeCode: string, value: string, parentValue: string | undefined): void {
  if (schemeCode === 'UBIGEO-INEI' && parentValue !== undefined && value.length !== parentValue.length + 2) unprocessable('geo.code.hierarchy_mismatch');
}

function validateParentPrefix(context: MockContext, input: CodePrefixValidation): void {
  if (input.prefixRule !== 'ParentValue' || input.place.parentId === null) return;
  const parent = findGeoPlace(context.store, input.place.parentId);
  const parentValue = parent.tradeLocation?.unLocode ?? parent.canonicalCode?.value;
  validateParentCode(input.value, parentValue);
  validateUbigeoLength(input.schemeCode, input.value, parentValue);
}

function validateCodePrefix(context: MockContext, input: CodePrefixValidation): void {
  if (input.prefixRule === 'CountryAlpha2' && !input.value.startsWith(input.place.countryCode)) unprocessable('geo.code.country_mismatch');
  validateParentPrefix(context, input);
}

function validateCode(context: MockContext, input: CodeValidation) {
  const scheme = activeScheme(context, input.place, input.schemeCode);
  const value = normalizedCode(scheme, input.valueInput);
  validateCodePrefix(context, { place: input.place, schemeCode: input.schemeCode, prefixRule: scheme.prefixRule, value });
  if (!context.store.sources.has(input.sourceCode)) unprocessable('geo.source.unknown');
  return { scheme, value };
}

function isCanonicalCode(context: MockContext, place: GeoPlaceRecord, schemeCode: string): boolean {
  if (place.type === 'Country') return schemeCode === 'ISO-3166-1-A2';
  if (place.type === 'AdministrativeDivision') {
    return context.store.geoCountries.get(place.countryCode)?.schema?.levels.some(
      (level) => level.order === place.level && level.canonicalSchemeCode === schemeCode,
    ) ?? false;
  }
  if (place.type === 'Locality') return false;
  return place.tradeLocation?.siteCode === null ? schemeCode === 'UN-LOCODE' : schemeCode === 'ORG-SITE';
}

interface NewPlaceData {
  readonly parent: GeoPlaceRecord;
  readonly level: number | null;
  readonly levelLabel: string;
  readonly code: { readonly scheme: { readonly code: string; readonly authority: string }; readonly value: string } | null;
}

function activePlaceParent(context: MockContext, parentId: string): GeoPlaceRecord {
  const parent = context.store.geoPlaces.get(parentId);
  if (parent === undefined) unprocessable('geo.place.parent_not_found');
  if (parent.status === 'Historical') conflict('geo.place.historical');
  if (parent.status === 'Inactive') conflict('geo.place.parent_inactive');
  if (parent.type !== 'Country' && parent.type !== 'AdministrativeDivision' && parent.type !== 'Locality') {
    unprocessable('geo.place.parent_level_invalid');
  }
  return parent;
}

function prepareAdministrativeDivision(
  context: MockContext,
  request: RegisterPlaceRequest,
  sourceCode: string,
  parent: GeoPlaceRecord,
): NewPlaceData {
  if (request.canonicalCode === null) unprocessable('geo.scheme.unknown');
  if (parent.type === 'Locality') unprocessable('geo.place.parent_level_invalid');
  const schema = requireSchema(context, parent.countryCode);
  const level = (parent.level ?? 0) + 1;
  const levelDefinition = schema.levels.find((item) => item.order === level);
  if (levelDefinition?.canonicalSchemeCode !== request.canonicalCode.schemeCode) unprocessable('geo.place.parent_level_invalid');
  const code = validateCode(context, {
    place: { ...parent, type: 'AdministrativeDivision', level, parentId: parent.id },
    schemeCode: request.canonicalCode.schemeCode,
    valueInput: request.canonicalCode.value,
    sourceCode,
  });
  if ([...context.store.geoPlaces.values()].some((item) => item.codes.some((entry) => entry.schemeCode === code.scheme.code && entry.value === code.value))) conflict('geo.code.duplicate');
  return { parent, level, levelLabel: levelDefinition.localLabel, code };
}

function prepareNewPlace(context: MockContext, request: RegisterPlaceRequest, sourceCode: string): NewPlaceData {
  const parent = activePlaceParent(context, request.parentId);
  if (request.type === 'Locality') {
    if (request.canonicalCode !== null) unprocessable('geo.scheme.not_applicable');
    return { parent, level: null, levelLabel: 'Localidad', code: null };
  }
  return prepareAdministrativeDivision(context, request, sourceCode, parent);
}

function requireLanguage(languageCode: string | null): string {
  const language = languageCode ?? 'es';
  if (!/^[a-z]{2,3}(-[A-Z]{2})?$/.test(language)) invalid('languageCode', 'validation.language_code_invalid');
  return language;
}

export function registerPlace(context: MockContext, request: RegisterPlaceRequest): CreatedResponse {
  const officialName = requireText('officialName', request.officialName, 200, 'place_name');
  const sourceCode = requireSource(context, request.sourceCode);
  const sourceVersion = optionalText('sourceVersion', request.sourceVersion, 50, 'source_version');
  const validFrom = requireDate('validFrom', request.validFrom, context.clock.today());
  const languageCode = requireLanguage(request.languageCode);
  const { parent, level, levelLabel, code } = prepareNewPlace(context, request, sourceCode);
  const id = context.store.newId();
  const source = { code: sourceCode, version: sourceVersion };
  const license = { redistribution: context.store.sources.get(sourceCode)?.redistribution ?? 'InternalOnly', attributionText: context.store.sources.get(sourceCode)?.attributionText ?? null };
  const officialCode = code === null ? null : {
    codeId: context.store.newId(), schemeCode: code.scheme.code, value: code.value, authority: code.scheme.authority, isCanonical: true,
    validFrom, validTo: null, isCurrent: true, source, license,
  };
  const name = {
    nameId: context.store.newId(), name: officialName, languageCode, kind: 'Official' as const, isPreferred: true,
    validFrom, validTo: null, isCurrent: true, source, license,
  };
  const place: GeoPlaceRecord = {
    id, type: request.type, status: 'Active', statusHistory: [{ status: 'Active', validFrom, validTo: null }],
    countryCode: parent.countryCode, level, levelLabel, officialName,
    canonicalCode: code === null ? null : { schemeCode: code.scheme.code, value: code.value }, parentId: parent.id,
    validFrom, validTo: null, version: 1, names: [name], codes: officialCode === null ? [] : [officialCode], geoReference: null, tradeLocation: null, successions: [],
    license, createdAt: now(context), createdBy: context.actor, updatedAt: null, updatedBy: null,
  };
  context.store.geoPlaces.set(id, place);
  return { id, version: 1 };
}

export function correctOfficialName(context: MockContext, placeId: string, request: CorrectOfficialNameRequest, ifMatch: number): WriteResult {
  const place = checkPlaceVersion(context, placeId, ifMatch);
  const name = requireText('officialName', request.officialName, 200, 'place_name');
  const language = requireText('languageCode', request.languageCode, 8, 'language_code');
  if (!/^[a-z]{2,3}(-[A-Z]{2})?$/.test(language)) invalid('languageCode', 'validation.language_code_invalid');
  requireText('reason', request.reason, 500, 'reason');
  const today = context.clock.today();
  const normalized = normalizePlaceName(name);
  if (place.names.some((item) => item.languageCode === language && item.kind === 'Official' && isWithin(item.validFrom, item.validTo, today) && normalizePlaceName(item.name) === normalized)) conflict('geo.name.duplicate');
  const previous = place.names.find((item) => item.languageCode === language && item.kind === 'Official' && isWithin(item.validFrom, item.validTo, today));
  const source = previous?.source ?? { code: 'ORG', version: null };
  const license = previous?.license ?? place.license;
  if (previous) {
    previous.validTo = addDays(today, -1);
    previous.isCurrent = false;
  }
  place.names.push({
    nameId: context.store.newId(), name, languageCode: language, kind: 'Official', isPreferred: true, validFrom: today, validTo: null, isCurrent: true,
    source: { ...source }, license: { ...license },
  });
  place.officialName = name;
  place.version += 1;
  touch(context, place);
  return { version: place.version };
}

export function deactivatePlace(context: MockContext, placeId: string, request: ReasonRequest, ifMatch: number): WriteResult {
  const place = checkPlaceVersion(context, placeId, ifMatch);
  checkReason(request.reason);
  if (place.status === 'Inactive') conflict('geo.place.already_inactive');
  if ([...context.store.geoPlaces.values()].some((child) => child.parentId === placeId && child.status === 'Active')) conflict('geo.place.has_children');
  const today = context.clock.today();
  const current = place.statusHistory.at(-1);
  if (current?.validTo === null) current.validTo = addDays(today, -1);
  place.status = 'Inactive';
  place.statusHistory.push({ status: 'Inactive', validFrom: today, validTo: null });
  place.version += 1;
  touch(context, place);
  return { version: place.version };
}

export function reactivatePlace(context: MockContext, placeId: string, request: ReasonRequest, ifMatch: number): WriteResult {
  const place = checkPlaceVersion(context, placeId, ifMatch);
  checkReason(request.reason);
  if (place.status === 'Active') conflict('geo.place.already_active');
  const today = context.clock.today();
  const current = place.statusHistory.at(-1);
  if (current?.validTo === null) current.validTo = addDays(today, -1);
  place.status = 'Active';
  place.statusHistory.push({ status: 'Active', validFrom: today, validTo: null });
  place.version += 1;
  touch(context, place);
  return { version: place.version };
}

export function addPlaceCode(context: MockContext, placeId: string, request: AddCodeRequest, ifMatch: number): CreatedResponse {
  const place = checkPlaceVersion(context, placeId, ifMatch);
  const schemeCode = requireText('schemeCode', request.schemeCode, 30, 'scheme_code').toUpperCase();
  const sourceCode = requireSource(context, request.sourceCode);
  const sourceVersion = optionalText('sourceVersion', request.sourceVersion, 50, 'source_version');
  const validFrom = requireDate('validFrom', request.validFrom, context.clock.today());
  const code = validateCode(context, { place, schemeCode, valueInput: request.value, sourceCode });
  if ([...context.store.geoPlaces.values()].some((item) => item.codes.some((entry) => entry.schemeCode === schemeCode && entry.value === code.value))) conflict('geo.code.duplicate');
  if (place.codes.some((entry) => entry.schemeCode === schemeCode && entry.validTo === null)) conflict('geo.code.current_exists');
  const id = context.store.newId();
  const source = { code: sourceCode, version: sourceVersion };
  const license = { redistribution: context.store.sources.get(sourceCode)?.redistribution ?? 'InternalOnly', attributionText: context.store.sources.get(sourceCode)?.attributionText ?? null };
  place.codes.push({
    codeId: id,
    schemeCode,
    value: code.value,
    authority: code.scheme.authority,
    isCanonical: isCanonicalCode(context, place, schemeCode),
    validFrom,
    validTo: null,
    isCurrent: true,
    source,
    license,
  });
  place.version += 1;
  touch(context, place);
  return { id, version: place.version };
}

export interface ExpirePlaceCodeInput {
  readonly placeId: string;
  readonly codeId: string;
  readonly request: EndValidityRequest;
  readonly ifMatch: number;
}

export function expirePlaceCode(context: MockContext, input: ExpirePlaceCodeInput): WriteResult {
  const place = findGeoPlace(context.store, input.placeId);
  const code = place.codes.find((item) => item.codeId === input.codeId);
  if (code === undefined) return notFound();
  if (place.version !== input.ifMatch) preconditionFailed();
  writable(place);
  const validTo = input.request.validTo === null ? context.clock.today() : requireDate('validTo', input.request.validTo, context.clock.today());
  requireOrderedValidity(code.validFrom, validTo);
  if (code.validTo !== null) conflict('geo.code.already_expired');
  if (code.isCanonical && place.status === 'Active') {
    const another = place.codes.some((item) => item.codeId !== input.codeId && item.isCanonical && item.validTo === null);
    if (!another) conflict('geo.code.canonical_required');
  }
  code.validTo = validTo;
  place.version += 1;
  touch(context, place);
  return { version: place.version };
}

function resolveCode(context: MockContext, ref: { readonly schemeCode: string; readonly value: string }) {
  const scheme = context.store.codeSchemes.get(ref.schemeCode);
  if (!scheme?.isActive) unprocessable('geo.scheme.unknown');
  const value = normalizeGeoCode(ref.value);
  if (!new RegExp(scheme.valuePattern).test(value)) unprocessable('geo.code.invalid_format');
  const exists = [...context.store.geoPlaces.values()].some((place) => place.codes.some((code) => code.schemeCode === ref.schemeCode && code.value === value));
  if (!exists) unprocessable('geo.correspondence.code_unknown');
  return { schemeCode: ref.schemeCode, value };
}

export function registerCorrespondence(context: MockContext, request: RegisterCorrespondenceRequest): CreatedResponse {
  const from = resolveCode(context, request.from);
  const to = resolveCode(context, request.to);
  if (from.schemeCode === to.schemeCode && from.value === to.value) unprocessable('geo.correspondence.self_reference');
  const validFrom = requireDate('validFrom', request.validFrom, context.clock.today());
  const note = optionalText('note', request.note, 500, 'note');
  const sourceCode = requireSource(context, request.sourceCode);
  if ([...context.store.geoCorrespondences.values()].some((item) => item.validTo === null && item.from.schemeCode === from.schemeCode && item.from.value === from.value && item.to.schemeCode === to.schemeCode && item.to.value === to.value)) conflict('geo.correspondence.duplicate');
  const id = context.store.newId();
  const record: GeoCorrespondenceRecord = {
    id, from, to, kind: request.kind, validFrom, validTo: null, note,
    source: { code: sourceCode, version: null }, version: 1,
    createdAt: now(context), createdBy: context.actor, updatedAt: null, updatedBy: null,
  };
  context.store.geoCorrespondences.set(id, record);
  return { id, version: 1 };
}

export function expireCorrespondence(context: MockContext, correspondenceId: string, request: EndValidityRequest, ifMatch: number): WriteResult {
  const correspondence = found(context.store.geoCorrespondences.get(correspondenceId));
  if (correspondence.version !== ifMatch) preconditionFailed();
  const validTo = request.validTo === null ? context.clock.today() : requireDate('validTo', request.validTo, context.clock.today());
  requireOrderedValidity(correspondence.validFrom, validTo);
  if (correspondence.validTo !== null) conflict('geo.correspondence.already_expired');
  correspondence.validTo = validTo;
  correspondence.version += 1;
  touch(context, correspondence);
  return { version: correspondence.version };
}

function findSiteParent(context: MockContext, placeId: string): { place: GeoPlaceRecord; unLocode: string } {
  const parent = findGeoPlace(context.store, placeId);
  if (parent.status === 'Historical') conflict('geo.place.historical');
  if (parent.status === 'Inactive') conflict('geo.place.parent_inactive');
  const unLocode = parent.tradeLocation?.unLocode;
  if (unLocode === undefined || unLocode === null) unprocessable('geo.place.parent_level_invalid');
  return { place: parent, unLocode };
}

function validateSiteCode(context: MockContext, unLocode: string, request: RegisterSiteRequest): string {
  const siteCode = normalizeGeoCode(requireText('siteCode', request.siteCode, 16, 'site_code'));
  if (!new RegExp(`^${unLocode}-[A-Z0-9]{1,10}$`).test(siteCode)) unprocessable('geo.code.hierarchy_mismatch');
  if ([...context.store.geoPlaces.values()].some((place) => place.codes.some((code) => code.schemeCode === 'ORG-SITE' && code.value === siteCode))) conflict('geo.code.duplicate');
  return siteCode;
}

function siteCatalog(context: MockContext): { scheme: CodeScheme; source: Source } {
  const scheme = context.store.codeSchemes.get('ORG-SITE');
  if (!scheme?.isActive) unprocessable('geo.scheme.unknown');
  const source = context.store.sources.get('ORG');
  if (source === undefined) unprocessable('geo.source.unknown');
  return { scheme, source };
}

function validateGeoCoordinates(input: GeoReferenceInput): void {
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) || input.latitude < -90 || input.latitude > 90 || input.longitude < -180 || input.longitude > 180) {
    invalid('geoReference', 'validation.coordinate_invalid');
  }
  if (!GEO_PRECISIONS.includes(input.precision)) invalid('geoReference.precision', 'validation.geo_precision_invalid');
}

function validateGeoSource(context: MockContext, input: GeoReferenceInput): void {
  if (input.sourceVersion !== null && input.sourceVersion.length > 50) invalid('geoReference.sourceVersion', 'validation.source_version_too_long');
  if (!context.store.sources.has(input.sourceCode)) unprocessable('geo.source.unknown');
}

function restrictLicense(first: { redistribution: Source['redistribution']; attributionText: string | null }, second: { redistribution: Source['redistribution']; attributionText: string | null }) {
  if (first.redistribution === 'InternalOnly' || second.redistribution === 'InternalOnly') {
    return first.redistribution === 'InternalOnly' ? first : second;
  }
  if (first.redistribution === 'RedistributableWithAttribution' || second.redistribution === 'RedistributableWithAttribution') {
    return first.redistribution === 'RedistributableWithAttribution' ? first : second;
  }
  return first;
}

function validateGeoReference(context: MockContext, input: GeoReferenceInput | null): void {
  if (input === null) return;
  validateGeoCoordinates(input);
  validateGeoSource(context, input);
}

function buildSite(input: {
  readonly context: MockContext;
  readonly parent: GeoPlaceRecord;
  readonly request: RegisterSiteRequest;
  readonly siteCode: string;
  readonly scheme: CodeScheme;
  readonly source: Source;
  readonly id: string;
  readonly today: string;
  readonly officialName: string;
}): GeoPlaceRecord {
  const { context, parent, request, siteCode, scheme, source, id, today, officialName } = input;
  const codeLicense = { redistribution: source.redistribution, attributionText: source.attributionText };
  const sourceRef = { code: 'ORG', version: null };
  const siteLicense = { ...codeLicense };
  const referenceSource = request.geoReference === null ? null : context.store.sources.get(request.geoReference.sourceCode) ?? null;
  const referenceLicense = referenceSource === null ? null : {
    redistribution: referenceSource.redistribution,
    attributionText: referenceSource.attributionText,
  };
  const placeLicense = referenceLicense === null ? codeLicense : restrictLicense(codeLicense, referenceLicense);
  const geoReference = request.geoReference === null ? null : {
    latitude: request.geoReference.latitude,
    longitude: request.geoReference.longitude,
    precision: request.geoReference.precision,
    source: { code: request.geoReference.sourceCode, version: request.geoReference.sourceVersion },
    license: referenceLicense === null ? { ...codeLicense } : { ...referenceLicense },
  };
  return {
    id, type: 'TradeLocation', status: 'Active', statusHistory: [{ status: 'Active', validFrom: today, validTo: null }],
    countryCode: parent.countryCode, level: null, levelLabel: null, officialName, canonicalCode: { schemeCode: 'ORG-SITE', value: siteCode }, parentId: parent.id,
    validFrom: today, validTo: null, version: 1, names: [{
      nameId: context.store.newId(), name: officialName, languageCode: 'es', kind: 'Official', isPreferred: true, validFrom: today, validTo: null, isCurrent: true,
      source: { ...sourceRef }, license: { ...siteLicense },
    }],
    codes: [{
      codeId: context.store.newId(), schemeCode: 'ORG-SITE', value: siteCode, authority: scheme.authority, isCanonical: true, validFrom: today, validTo: null, isCurrent: true,
      source: { ...sourceRef }, license: { ...siteLicense },
    }],
    geoReference,
    tradeLocation: { unLocode: null, siteCode, siteKind: request.siteKind, functions: [], uneceStatus: null, uneceStatusDate: null, iataCode: null, usableInTradeDocuments: false, siteCount: 0 },
    successions: [], license: { ...placeLicense }, createdAt: now(context), createdBy: context.actor, updatedAt: null, updatedBy: null,
  };
}

export function registerSite(context: MockContext, placeId: string, request: RegisterSiteRequest): CreatedResponse {
  const { place: parent, unLocode } = findSiteParent(context, placeId);
  const siteCode = validateSiteCode(context, unLocode, request);
  if (!SITE_KINDS.includes(request.siteKind)) invalid('siteKind', 'validation.site_kind_invalid');
  validateGeoReference(context, request.geoReference);
  const { scheme, source } = siteCatalog(context);
  const officialName = requireText('officialName', request.officialName, 200, 'place_name');
  const id = context.store.newId();
  const today = context.clock.today();
  const place = buildSite({ context, parent, request, siteCode, scheme, source, id, today, officialName });
  context.store.geoPlaces.set(id, place);
  return { id, version: 1 };
}
