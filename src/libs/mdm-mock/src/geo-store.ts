import type {
  CodeScheme,
  CorrespondenceKind,
  GeoReference,
  LicenseInfo,
  OfficialCode,
  PlaceNameItem,
  PlaceStatus,
  PlaceType,
  Source,
  SuccessionRef,
  TerritorialSchema,
  TradeFunction,
  TradeLocationInfo,
} from '@mdm/contracts';

export interface GeoNameRecord extends Omit<PlaceNameItem, 'validTo' | 'isCurrent'> {
  validTo: string | null;
  isCurrent: boolean;
}

export interface GeoCodeRecord extends Omit<OfficialCode, 'validTo' | 'isCurrent'> {
  validTo: string | null;
  isCurrent: boolean;
}

export interface GeoAuditRecord {
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface GeoPlaceRecord extends GeoAuditRecord {
  readonly id: string;
  readonly type: PlaceType;
  status: PlaceStatus;
  statusHistory: Array<{ readonly status: PlaceStatus; readonly validFrom: string; validTo: string | null }>;
  readonly countryCode: string;
  readonly level: number | null;
  readonly levelLabel: string | null;
  officialName: string;
  readonly canonicalCode: { readonly schemeCode: string; readonly value: string } | null;
  readonly parentId: string | null;
  readonly validFrom: string;
  validTo: string | null;
  version: number;
  readonly names: GeoNameRecord[];
  readonly codes: GeoCodeRecord[];
  geoReference: GeoReference | null;
  tradeLocation: TradeLocationInfo | null;
  readonly successions: SuccessionRef[];
  readonly license: LicenseInfo;
}

export interface GeoCountryRecord {
  readonly alpha2: string;
  readonly alpha3: string;
  readonly numeric: string;
  englishName: string | null;
  readonly placeId: string;
  schema: TerritorialSchema | null;
}

export interface GeoCorrespondenceRecord extends GeoAuditRecord {
  readonly id: string;
  readonly from: { readonly schemeCode: string; readonly value: string };
  readonly to: { readonly schemeCode: string; readonly value: string };
  readonly kind: CorrespondenceKind;
  readonly validFrom: string;
  validTo: string | null;
  note: string | null;
  readonly source: { readonly code: string; readonly version: string | null };
  version: number;
}

export interface GeoSeedData {
  readonly places: readonly GeoPlaceRecord[];
  readonly countries: readonly GeoCountryRecord[];
  readonly schemes: readonly CodeScheme[];
  readonly sources: readonly Source[];
  readonly correspondences: readonly GeoCorrespondenceRecord[];
}

export function isTradeFunction(value: TradeFunction): boolean {
  return value !== 'BORDER_CROSSING';
}
