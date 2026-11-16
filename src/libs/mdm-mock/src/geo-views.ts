import type {
  Country,
  CountrySummary,
  OfficialCode,
  Place,
  PlacePath,
  PlaceRef,
  PlaceSummary,
  PlaceStatus,
  TradeLocationSummary,
  TerritorialSchema,
  LicenseInfo,
} from '@mdm/contracts';
import { isUsableInTradeDocuments } from '@mdm/contracts';
import { isWithin } from './clock.ts';
import { notFound } from './errors.ts';
import type { MdmMockStore } from './store.ts';
import type { GeoPlaceRecord } from './geo-store.ts';

export function findGeoPlace(store: MdmMockStore, id: string): GeoPlaceRecord {
  return store.geoPlaces.get(id) ?? notFound();
}

function parentChain(store: MdmMockStore, place: GeoPlaceRecord): GeoPlaceRecord[] {
  const chain: GeoPlaceRecord[] = [];
  let parentId = place.parentId;
  const visited = new Set([place.id]);
  while (parentId !== null) {
    if (visited.has(parentId) || chain.length >= 6) return notFound();
    visited.add(parentId);
    const parent = findGeoPlace(store, parentId);
    chain.push(parent);
    parentId = parent.parentId;
  }
  return chain.reverse();
}

function statusAt(place: GeoPlaceRecord, asOf: string): PlaceStatus {
  return place.statusHistory.find((item) => isWithin(item.validFrom, item.validTo, asOf))?.status ?? 'Historical';
}

export function isTradeUsable(store: MdmMockStore, place: GeoPlaceRecord, asOf: string): boolean {
  if (place.tradeLocation?.siteCode !== null && place.parentId !== null) {
    const parent = store.geoPlaces.get(place.parentId);
    if (parent?.tradeLocation === null || parent?.tradeLocation === undefined) return false;
    return isUsableInTradeDocuments(statusAt(parent, asOf), parent.tradeLocation.uneceStatus, parent.tradeLocation.functions);
  }
  return place.tradeLocation !== null
    && isUsableInTradeDocuments(statusAt(place, asOf), place.tradeLocation.uneceStatus, place.tradeLocation.functions);
}

function aggregateLicense(place: GeoPlaceRecord): LicenseInfo {
  const licenses = [
    place.license,
    ...place.names.map((item) => item.license),
    ...place.codes.map((item) => item.license),
    ...(place.geoReference === null ? [] : [place.geoReference.license]),
  ];
  const rank = { InternalOnly: 0, RedistributableWithAttribution: 1, Redistributable: 2 } as const;
  const selected = licenses.toSorted((a, b) => rank[a.redistribution] - rank[b.redistribution])[0];
  return selected === undefined ? { ...place.license } : { ...selected };
}

function nameAt(place: GeoPlaceRecord, asOf: string): string {
  const name = place.names.find((item) => item.kind === 'Official' && isWithin(item.validFrom, item.validTo, asOf));
  return name?.name ?? place.officialName;
}

function codeAt(place: GeoPlaceRecord, asOf: string): OfficialCode | null {
  if (place.canonicalCode === null) return null;
  return place.codes.find((item) => item.schemeCode === place.canonicalCode?.schemeCode && item.value === place.canonicalCode.value && isWithin(item.validFrom, item.validTo, asOf)) ?? null;
}

export function toPlacePath(store: MdmMockStore, place: GeoPlaceRecord, today: string, asOf = today): PlacePath {
  const ancestors = parentChain(store, place);
  const trail = [...ancestors, place];
  const path = trail
    .map((item) => item.canonicalCode?.value ?? (item.type === 'Country' ? item.countryCode : item.id))
    .join('/');
  const displayPath = trail.map((item) => nameAt(item, asOf)).reverse().join(' › ');
  return {
    id: place.id,
    type: place.type,
    status: statusAt(place, asOf),
    countryCode: place.countryCode,
    level: place.level,
    levelLabel: place.levelLabel,
    officialName: nameAt(place, asOf),
    canonicalCode: codeAt(place, asOf) === null || place.canonicalCode === null ? null : { ...place.canonicalCode },
    parentId: place.parentId,
    path,
    displayPath,
    ancestors: ancestors.map((item): PlaceRef => ({
      id: item.id,
      type: item.type,
      level: item.level,
      officialName: nameAt(item, asOf),
      canonicalCode: item.canonicalCode === null ? null : { ...item.canonicalCode },
      status: statusAt(item, asOf),
    })),
    validFrom: place.validFrom,
    validTo: place.validTo,
    isCurrent: isWithin(place.validFrom, place.validTo, asOf),
    version: place.version,
  };
}

export function toPlace(store: MdmMockStore, place: GeoPlaceRecord, today: string): Place {
  const path = toPlacePath(store, place, today);
  const siteCount = [...store.geoPlaces.values()].filter((child) => child.parentId === place.id && child.tradeLocation?.siteCode !== null).length;
  const tradeLocation = place.tradeLocation === null ? null : {
    ...place.tradeLocation,
    functions: [...place.tradeLocation.functions],
    siteCount,
    usableInTradeDocuments: isTradeUsable(store, place, today),
  };
  return {
    ...path,
    ...{
      createdAt: place.createdAt,
      createdBy: place.createdBy,
      updatedAt: place.updatedAt,
      updatedBy: place.updatedBy,
    },
    names: place.names.map((item) => ({ ...item, source: { ...item.source }, license: { ...item.license }, isCurrent: isWithin(item.validFrom, item.validTo, today) })),
    codes: place.codes.map((item) => ({ ...item, source: { ...item.source }, license: { ...item.license }, isCurrent: isWithin(item.validFrom, item.validTo, today) })),
    geoReference: place.geoReference === null ? null : { ...place.geoReference, source: { ...place.geoReference.source }, license: { ...place.geoReference.license } },
    tradeLocation,
    successions: place.successions.map((item) => ({ ...item })),
    childCount: [...store.geoPlaces.values()].filter((child) => child.parentId === place.id).length,
    license: aggregateLicense(place),
    redactedSchemes: [],
  };
}

export interface PlaceSummaryOptions {
  readonly asOf?: string;
  readonly matchedName?: string | null;
}

export function toPlaceSummary(store: MdmMockStore, place: GeoPlaceRecord, today: string, options: PlaceSummaryOptions = {}): PlaceSummary {
  const asOf = options.asOf ?? today;
  const view = toPlacePath(store, place, today, asOf);
  return {
    id: view.id,
    type: view.type,
    status: view.status,
    countryCode: view.countryCode,
    level: view.level,
    officialName: view.officialName,
    matchedName: options.matchedName ?? null,
    canonicalCode: view.canonicalCode === null ? null : { ...view.canonicalCode },
    parentId: view.parentId,
    path: view.path,
    displayPath: view.displayPath,
    redactedSchemes: [],
    version: view.version,
  };
}

export function toTradeSummary(store: MdmMockStore, place: GeoPlaceRecord, today: string): TradeLocationSummary {
  if (place.tradeLocation === null) return notFound();
  const siteCount = [...store.geoPlaces.values()].filter((child) => child.parentId === place.id && child.tradeLocation?.siteCode !== null).length;
  return {
    ...toPlaceSummary(store, place, today),
    tradeLocation: { ...place.tradeLocation, functions: [...place.tradeLocation.functions], siteCount, usableInTradeDocuments: isTradeUsable(store, place, today) },
  };
}

export function toCountrySummary(store: MdmMockStore, countryCode: string, today: string): CountrySummary {
  const country = store.geoCountries.get(countryCode);
  if (country === undefined) return notFound();
  const place = findGeoPlace(store, country.placeId);
  return {
    placeId: place.id,
    alpha2: country.alpha2,
    alpha3: country.alpha3,
    numeric: country.numeric,
    officialName: place.officialName,
    englishName: country.englishName,
    status: statusAt(place, today),
    levelCount: country.schema?.levels.length ?? 0,
    version: place.version,
  };
}

export function toCountry(store: MdmMockStore, countryCode: string, today: string): Country {
  const country = store.geoCountries.get(countryCode);
  if (country === undefined) return notFound();
  const place = findGeoPlace(store, country.placeId);
  const summary = toCountrySummary(store, countryCode, today);
  const schema: TerritorialSchema | null = country.schema;
  return {
    ...summary,
    createdAt: place.createdAt,
    createdBy: place.createdBy,
    updatedAt: place.updatedAt,
    updatedBy: place.updatedBy,
    validFrom: place.validFrom,
    validTo: place.validTo,
    codes: place.codes.map((item) => ({ ...item, source: { ...item.source }, license: { ...item.license }, isCurrent: isWithin(item.validFrom, item.validTo, today) })),
    territorialSchema: {
      declared: schema !== null,
      levelCount: schema?.levels.length ?? 0,
      usesPostalCode: schema?.usesPostalCode ?? null,
      version: schema?.version ?? null,
    },
  };
}
