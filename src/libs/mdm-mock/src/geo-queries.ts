import {
  MAX_PAGE_SIZE,
  normalizeGeoCode,
  normalizePlaceName,
  type Country,
  type CountryList,
  type PlacePage,
  type PlaceResolution,
  type TradeLocationList,
  type TradeLocationPage,
} from '@mdm/contracts';
import type { CountryFilter, PlaceQuery, ResolveQuery, TradeLocationQuery, CorrespondenceQuery, CodeSchemeFilter } from '@mdm/contracts';
import { isWithin } from './clock.ts';
import { badRequest, conflict, invalid, notFound, schemaNotDeclared, unprocessable } from './errors.ts';
import type { MockContext } from './context.ts';
import { findGeoPlace, isTradeUsable, toCountry, toCountrySummary, toPlace, toPlacePath, toPlaceSummary, toTradeSummary } from './geo-views.ts';
import type { GeoPlaceRecord } from './geo-store.ts';

function paging(page: number, pageSize: number): void {
  if (!Number.isInteger(page) || page < 1) invalid('page', 'validation.page_invalid');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) invalid('pageSize', 'validation.page_size_invalid');
}

function paginate<T>(items: readonly T[], page: number, pageSize: number) {
  return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: items.length, totalPages: Math.ceil(items.length / pageSize) };
}

function matchedName(place: GeoPlaceRecord, query: PlaceQuery, asOf: string): { matched: boolean; alternative: string | null } {
  if (query.name === null) return { matched: true, alternative: null };
  const needle = normalizePlaceName(query.name.trim());
  const names = place.names.filter((item) => isWithin(item.validFrom, item.validTo, asOf)).map((item) => item.name);
  names.push(toPlacePathName(place, asOf));
  const match = names.find((name) => {
    const normalized = normalizePlaceName(name);
    return query.nameMatch === 'contains'
      ? normalized.includes(needle)
      : normalized.startsWith(needle) || normalized.split(' ').some((word) => word.startsWith(needle));
  });
  return {
    matched: match !== undefined,
    alternative: match !== undefined && normalizePlaceName(match) !== normalizePlaceName(toPlacePathName(place, asOf)) ? match : null,
  };
}

function toPlacePathName(place: GeoPlaceRecord, asOf: string): string {
  return place.names.find((item) => item.kind === 'Official' && isWithin(item.validFrom, item.validTo, asOf))?.name ?? place.officialName;
}

function isAddressLevel(context: MockContext, place: GeoPlaceRecord): boolean {
  return context.store.geoCountries.get(place.countryCode)?.schema?.levels.some((item) => item.order === place.level && item.isAddressLevel) ?? false;
}

function checkDate(field: string, value: string | null): string {
  if (value === null) return 'invalid';
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) ? value : invalid(field, 'validation.date_invalid');
}

function validatePlaceNameQuery(query: PlaceQuery): void {
  if (query.name !== null && (query.name.trim().length < 2 || query.name.trim().length > 100)) invalid('name', 'validation.search_name_length');
  if (query.nameMatch === 'contains' && query.countryCode === null && query.parentId === null) badRequest('validation.search_too_broad');
}

function validatePlaceCodeQuery(query: PlaceQuery): void {
  if (query.code !== null && query.code.trim() === '') invalid('code', 'validation.code_required');
  if (query.scheme !== null && query.scheme.trim() === '') invalid('scheme', 'validation.scheme_required');
  if (query.scheme !== null && query.code === null) invalid('scheme', 'validation.scheme_requires_code');
}

function validatePlacePathQuery(query: PlaceQuery): void {
  if (query.pathPrefix !== null && query.pathPrefix.length > 400) invalid('pathPrefix', 'validation.path_too_long');
  if (query.level !== null && query.countryCode === null) invalid('level', 'validation.level_requires_country');
}

function validatePlaceQuery(query: PlaceQuery): void {
  validatePlaceNameQuery(query);
  validatePlaceCodeQuery(query);
  validatePlacePathQuery(query);
}

function matchesStatus(place: GeoPlaceRecord, query: PlaceQuery, asOf: string): boolean {
  const status = place.statusHistory.find((item) => isWithin(item.validFrom, item.validTo, asOf))?.status ?? 'Historical';
  return query.statuses === null ? status !== 'Historical' : query.statuses.includes(status);
}

function matchesCode(place: GeoPlaceRecord, query: PlaceQuery, codeValue: string | null, asOf: string): boolean {
  if (codeValue === null) return true;
  return place.codes.some((item) =>
    (query.scheme === null || item.schemeCode === query.scheme)
    && normalizeGeoCode(item.value) === codeValue
    && isWithin(item.validFrom, item.validTo, asOf));
}

function matchesPath(context: MockContext, place: GeoPlaceRecord, query: PlaceQuery, asOf: string): boolean {
  if (query.pathPrefix === null) return true;
  return toPlacePath(context.store, place, context.clock.today(), asOf).path.startsWith(query.pathPrefix);
}

function matchesPlaceAvailability(context: MockContext, place: GeoPlaceRecord, query: PlaceQuery, asOf: string): boolean {
  if (!isWithin(place.validFrom, place.validTo, asOf)) return false;
  if (!query.usableForAddresses) return true;
  const status = place.statusHistory.find((item) => isWithin(item.validFrom, item.validTo, asOf))?.status ?? 'Historical';
  return status === 'Active' && isAddressLevel(context, place);
}

function matchesPlaceCodeAndPath(input: {
  readonly context: MockContext;
  readonly place: GeoPlaceRecord;
  readonly query: PlaceQuery;
  readonly codeValue: string | null;
  readonly asOf: string;
}): boolean {
  return matchesPath(input.context, input.place, input.query, input.asOf)
    && matchesCode(input.place, input.query, input.codeValue, input.asOf);
}

function matchesPlace(
  input: {
    readonly context: MockContext;
    readonly place: GeoPlaceRecord;
    readonly query: PlaceQuery;
    readonly codeValue: string | null;
    readonly asOf: string;
  },
): string | null | undefined {
  const { context, place, query, asOf } = input;
  if (!matchesStatus(place, query, asOf)) return undefined;
  if (!matchesPlaceScope(place, query)) return undefined;
  if (!matchesPlaceAvailability(context, place, query, asOf)) return undefined;
  if (!matchesPlaceCodeAndPath(input)) return undefined;
  if (query.name === null) return null;
  const nameMatch = matchedName(place, query, asOf);
  return nameMatch.matched ? nameMatch.alternative : undefined;
}

function matchesPlaceScope(place: GeoPlaceRecord, query: PlaceQuery): boolean {
  if (query.countryCode !== null && place.countryCode !== query.countryCode) return false;
  if (query.type !== null && place.type !== query.type) return false;
  if (query.level !== null && place.level !== query.level) return false;
  if (query.parentId !== null && place.parentId !== query.parentId) return false;
  return true;
}

export function listCountries(context: MockContext, filter: CountryFilter): CountryList {
  const search = filter.search?.trim().toLocaleLowerCase('es') ?? null;
  if (filter.search !== null && filter.search.trim().length > 200) invalid('search', 'validation.search_too_long');
  const items = [...context.store.geoCountries.keys()]
    .map((code) => toCountrySummary(context.store, code, context.clock.today()))
    .filter((country) => filter.status === null || country.status === filter.status)
    .filter((country) => search === null || `${country.alpha2} ${country.alpha3} ${country.officialName} ${country.englishName ?? ''}`.toLocaleLowerCase('es').includes(search))
    .toSorted((a, b) => a.officialName.localeCompare(b.officialName, 'es') || a.alpha2.localeCompare(b.alpha2));
  return { items };
}

export function getCountry(context: MockContext, countryCode: string): Country {
  return toCountry(context.store, countryCode, context.clock.today());
}

export function getTerritorialSchema(context: MockContext, countryCode: string) {
  const country = context.store.geoCountries.get(countryCode);
  if (country === undefined) return notFound();
  if (country.schema === null) return schemaNotDeclared();
  return {
    ...country.schema,
    levels: country.schema.levels.map((level) => ({
      ...level,
      placeCount: [...context.store.geoPlaces.values()].filter((place) => place.countryCode === countryCode && place.level === level.order).length,
    })),
  };
}

export function searchPlaces(context: MockContext, query: PlaceQuery): PlacePage {
  paging(query.page, query.pageSize);
  validatePlaceQuery(query);
  const asOf = query.asOf === null ? context.clock.today() : checkDate('asOf', query.asOf);
  const codeValue = query.code === null ? null : normalizeGeoCode(query.code);
  const items = [...context.store.geoPlaces.values()]
    .map((place) => ({ place, matchedName: matchesPlace({ context, place, query, codeValue, asOf }) }))
    .filter((item): item is { place: GeoPlaceRecord; matchedName: string | null } => item.matchedName !== undefined);
  const direction = query.sortOrder === 'asc' ? 1 : -1;
  const key = (item: { place: GeoPlaceRecord }): string => {
    switch (query.sortBy) {
      case 'path': return toPlacePath(context.store, item.place, context.clock.today(), asOf).path;
      case 'updatedAt': return item.place.updatedAt ?? item.place.createdAt;
      default: return normalizePlaceName(item.place.officialName);
    }
  };
  items.sort((a, b) => direction * key(a).localeCompare(key(b), 'es') || a.place.id.localeCompare(b.place.id));
  return paginate(
    items.map(({ place, matchedName }) => toPlaceSummary(context.store, place, context.clock.today(), { asOf, matchedName })),
    query.page,
    query.pageSize,
  );
}

export function resolvePlace(context: MockContext, query: ResolveQuery): PlaceResolution {
  const value = normalizeGeoCode(query.value);
  if (value.length === 0) invalid('value', 'validation.code_required');
  const asOf = query.asOf === null ? context.clock.today() : checkDate('asOf', query.asOf);
  const matches = [...context.store.geoPlaces.values()].flatMap((place) =>
    place.codes
      .filter((code) => code.value === value && code.validFrom <= asOf && (query.scheme === null || code.schemeCode === query.scheme))
      .map((code) => ({ place, code })),
  );
  const distinct = new Map(matches.map((match) => [match.place.id, match]));
  if (distinct.size === 0) return notFound();
  if (distinct.size > 1) conflict('geo.code.ambiguous');
  const match = [...distinct.values()][0];
  if (match === undefined) return notFound();
  const { place, code } = match;
  return {
    place: toPlacePath(context.store, place, context.clock.today(), asOf),
    resolution: {
      matchedCode: { ...code, isCurrent: isWithin(code.validFrom, code.validTo, asOf) },
      placeStatus: place.statusHistory.find((item) => isWithin(item.validFrom, item.validTo, asOf))?.status ?? 'Historical',
      successors: [],
    },
  };
}

export function getPlace(context: MockContext, placeId: string) {
  return toPlace(context.store, findGeoPlace(context.store, placeId), context.clock.today());
}

export function listCorrespondences(context: MockContext, query: CorrespondenceQuery) {
  paging(query.page, query.pageSize);
  const asOf = context.clock.today();
  const items = [...context.store.geoCorrespondences.values()]
    .map((record) => ({
      ...record,
      from: { ...record.from },
      to: { ...record.to },
      source: { ...record.source },
      createdAt: record.createdAt,
      createdBy: record.createdBy,
      updatedAt: record.updatedAt,
      updatedBy: record.updatedBy,
      isCurrent: isWithin(record.validFrom, record.validTo, asOf),
    }))
    .filter((item) => query.kind === null || item.kind === query.kind)
    .filter((item) => !query.currentOnly || item.isCurrent)
    .filter((item) => {
      if (query.value === null) return true;
      const value = normalizeGeoCode(query.value);
      return [item.from, item.to].some((ref) => (query.scheme === null || ref.schemeCode === query.scheme) && normalizeGeoCode(ref.value) === value);
    })
    .filter((item) => query.value !== null || query.scheme === null || [item.from.schemeCode, item.to.schemeCode].includes(query.scheme));
  return paginate(items, query.page, query.pageSize);
}

export function searchTradeLocations(context: MockContext, query: TradeLocationQuery): TradeLocationPage {
  paging(query.page, query.pageSize);
  const asOf = query.asOf === null ? context.clock.today() : checkDate('asOf', query.asOf);
  const name = query.name === null ? null : normalizePlaceName(query.name.trim());
  const items = [...context.store.geoPlaces.values()]
    .filter((place) => place.tradeLocation !== null)
    .filter((place) => query.includeSites || place.tradeLocation?.siteCode === null)
    .filter((place) => query.countryCode === null || place.countryCode === query.countryCode)
    .filter((place) => query.unLocode === null || place.tradeLocation?.unLocode?.startsWith(normalizeGeoCode(query.unLocode)) === true)
    .filter((place) => name === null || normalizePlaceName(place.officialName).includes(name))
    .filter((place) => query.functions.length === 0 || query.functions.some((fn) => place.tradeLocation?.functions.includes(fn)))
    .filter((place) => query.uneceStatus === null || place.tradeLocation?.uneceStatus === query.uneceStatus)
    .filter((place) => query.usableInTradeDocuments === null || isTradeUsable(context.store, place, asOf) === query.usableInTradeDocuments)
    .filter((place) => isWithin(place.validFrom, place.validTo, asOf))
    .filter((place) => (place.statusHistory.find((item) => isWithin(item.validFrom, item.validTo, asOf))?.status ?? 'Historical') !== 'Historical')
    .toSorted((a, b) => normalizePlaceName(a.officialName).localeCompare(normalizePlaceName(b.officialName), 'es') || a.id.localeCompare(b.id));
  return paginate(items.map((place) => toTradeSummary(context.store, place, context.clock.today())), query.page, query.pageSize);
}

export function listSites(context: MockContext, placeId: string): TradeLocationList {
  const parent = findGeoPlace(context.store, placeId);
  if (parent.tradeLocation?.unLocode === null || parent.tradeLocation === null) unprocessable('geo.trade_location.not_trade_location');
  const items = [...context.store.geoPlaces.values()]
    .filter((place) => place.parentId === placeId && place.tradeLocation?.siteCode !== null)
    .toSorted((a, b) => a.officialName.localeCompare(b.officialName, 'es') || a.id.localeCompare(b.id))
    .map((place) => toTradeSummary(context.store, place, context.clock.today()));
  return { items };
}

export function listCodeSchemes(context: MockContext, filter: CodeSchemeFilter) {
  return {
    items: [...context.store.codeSchemes.values()]
      .filter((scheme) => filter.includeInactive || scheme.isActive)
      .filter((scheme) => filter.countryCode === null || scheme.countryCode === null || scheme.countryCode === filter.countryCode)
      .filter((scheme) => filter.appliesTo === null || scheme.appliesTo.includes(filter.appliesTo))
      .map((scheme) => ({
        ...scheme,
        appliesTo: [...scheme.appliesTo],
        codeCount: [...context.store.geoPlaces.values()].reduce(
          (count, place) => count + place.codes.filter((code) => code.schemeCode === scheme.code).length,
          0,
        ),
      }))
      .toSorted((a, b) => a.code.localeCompare(b.code)),
  };
}

export function listSources(context: MockContext) {
  return { items: [...context.store.sources.values()].map((source) => ({ ...source })).toSorted((a, b) => a.code.localeCompare(b.code)) };
}
