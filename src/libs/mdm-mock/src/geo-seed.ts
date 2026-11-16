import type { CodeScheme, Source } from '@mdm/contracts';
import type { GeoCodeRecord, GeoNameRecord, GeoPlaceRecord, GeoSeedData } from './geo-store.ts';

const LOADED_AT = '2024-03-01T14:00:00.000+00:00';
const ACTOR = 'carga-inicial';

function id(prefix: string, sequence: number): string {
  return `${prefix}-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

const ISO: Source = {
  code: 'ISO',
  authority: 'International Organization for Standardization',
  licenseName: 'Uso interno',
  licenseUrl: null,
  attributionText: null,
  redistribution: 'InternalOnly',
  confirmedOn: null,
  evidenceRef: null,
  version: 1,
};
const INEI: Source = {
  code: 'INEI',
  authority: 'Instituto Nacional de Estadística e Informática',
  licenseName: 'Uso interno',
  licenseUrl: null,
  attributionText: null,
  redistribution: 'InternalOnly',
  confirmedOn: null,
  evidenceRef: null,
  version: 1,
};
const UNECE: Source = {
  code: 'UNECE',
  authority: 'United Nations Economic Commission for Europe',
  licenseName: 'Uso interno',
  licenseUrl: null,
  attributionText: null,
  redistribution: 'InternalOnly',
  confirmedOn: null,
  evidenceRef: null,
  version: 1,
};
const ORG: Source = {
  code: 'ORG',
  authority: 'Organización S.A.',
  licenseName: 'Dato propio',
  licenseUrl: null,
  attributionText: null,
  redistribution: 'Redistributable',
  confirmedOn: '2024-03-01',
  evidenceRef: 'registro-propio',
  version: 1,
};

const SCHEMES: readonly CodeScheme[] = [
  { code: 'ISO-3166-1-A2', name: 'ISO 3166-1 alfa-2', authority: ISO.authority, description: null, countryCode: null, appliesTo: ['Country'], valuePattern: '^[A-Z]{2}$', maxLength: 2, prefixRule: 'None', isCanonical: true, defaultSourceCode: 'ISO', isActive: true, codeCount: 1, version: 1 },
  { code: 'ISO-3166-1-A3', name: 'ISO 3166-1 alfa-3', authority: ISO.authority, description: null, countryCode: null, appliesTo: ['Country'], valuePattern: '^[A-Z]{3}$', maxLength: 3, prefixRule: 'None', isCanonical: false, defaultSourceCode: 'ISO', isActive: true, codeCount: 1, version: 1 },
  { code: 'ISO-3166-1-N', name: 'ISO 3166-1 numérico', authority: ISO.authority, description: null, countryCode: null, appliesTo: ['Country'], valuePattern: '^[0-9]{3}$', maxLength: 3, prefixRule: 'None', isCanonical: false, defaultSourceCode: 'ISO', isActive: true, codeCount: 1, version: 1 },
  { code: 'ISO-3166-2', name: 'ISO 3166-2', authority: ISO.authority, description: null, countryCode: null, appliesTo: ['AdministrativeDivision'], valuePattern: '^[A-Z]{2}-[A-Z0-9]{1,3}$', maxLength: 6, prefixRule: 'CountryAlpha2', isCanonical: true, defaultSourceCode: 'ISO', isActive: true, codeCount: 0, version: 1 },
  { code: 'UBIGEO-INEI', name: 'Ubigeo INEI', authority: INEI.authority, description: null, countryCode: 'PE', appliesTo: ['AdministrativeDivision'], valuePattern: '^[0-9]{2,6}$', maxLength: 6, prefixRule: 'ParentValue', isCanonical: true, defaultSourceCode: 'INEI', isActive: true, codeCount: 6, version: 1 },
  { code: 'UBIGEO-RENIEC', name: 'Ubigeo RENIEC', authority: 'Registro Nacional de Identificación y Estado Civil', description: null, countryCode: 'PE', appliesTo: ['AdministrativeDivision'], valuePattern: '^[0-9]{2}([0-9]{2}){0,2}$', maxLength: 6, prefixRule: 'ParentValue', isCanonical: false, defaultSourceCode: 'RENIEC', isActive: true, codeCount: 0, version: 1 },
  { code: 'UBIGEO-SUNAT', name: 'Ubigeo SUNAT', authority: 'Superintendencia Nacional de Aduanas y de Administración Tributaria', description: null, countryCode: 'PE', appliesTo: ['AdministrativeDivision'], valuePattern: '^[0-9]{6}$', maxLength: 6, prefixRule: 'None', isCanonical: false, defaultSourceCode: 'SUNAT', isActive: true, codeCount: 0, version: 1 },
  { code: 'UN-LOCODE', name: 'UN/LOCODE', authority: UNECE.authority, description: null, countryCode: null, appliesTo: ['TradeLocation'], valuePattern: '^[A-Z]{2}[A-Z2-9]{3}$', maxLength: 5, prefixRule: 'CountryAlpha2', isCanonical: true, defaultSourceCode: 'UNECE', isActive: true, codeCount: 1, version: 1 },
  { code: 'ORG-SITE', name: 'Lugar propio Organización', authority: 'Organización S.A.', description: null, countryCode: null, appliesTo: ['TradeLocation'], valuePattern: '^[A-Z]{2}[A-Z2-9]{3}-[A-Z0-9]{1,10}$', maxLength: 16, prefixRule: 'ParentValue', isCanonical: true, defaultSourceCode: 'ORG', isActive: true, codeCount: 1, version: 1 },
];

function code(sequence: number, fields: { schemeCode: string; value: string; sourceCode: string; authority: string; canonical: boolean }): GeoCodeRecord {
  return {
    codeId: id('a1000000', sequence),
    schemeCode: fields.schemeCode,
    value: fields.value,
    authority: fields.authority,
    isCanonical: fields.canonical,
    validFrom: '2024-03-01',
    validTo: null,
    isCurrent: true,
    source: { code: fields.sourceCode, version: 'carga-inicial' },
    license: { redistribution: fields.sourceCode === 'ORG' ? 'Redistributable' : 'InternalOnly', attributionText: null },
  };
}

function name(sequence: number, value: string, languageCode: string, sourceCode: string): GeoNameRecord {
  return {
    nameId: id('a2000000', sequence),
    name: value,
    languageCode,
    kind: 'Official',
    isPreferred: true,
    validFrom: '2024-03-01',
    validTo: null,
    isCurrent: true,
    source: { code: sourceCode, version: 'carga-inicial' },
    license: { redistribution: sourceCode === 'ORG' ? 'Redistributable' : 'InternalOnly', attributionText: null },
  };
}

function place(
  sequence: number,
  fields: Pick<GeoPlaceRecord, 'type' | 'countryCode' | 'level' | 'levelLabel' | 'officialName' | 'canonicalCode' | 'parentId' | 'tradeLocation'>,
  codes: readonly GeoCodeRecord[],
): GeoPlaceRecord {
  return {
    id: id('90000000', sequence),
    ...fields,
    status: 'Active',
    statusHistory: [{ status: 'Active', validFrom: '1821-07-28', validTo: null }],
    validFrom: '1821-07-28',
    validTo: null,
    version: 1,
    names: [name(sequence, fields.officialName, 'es', codes[0]?.source.code ?? 'INEI')],
    codes: [...codes],
    geoReference: null,
    successions: [],
    license: { redistribution: codes.every((item) => item.license.redistribution !== 'InternalOnly') ? 'Redistributable' : 'InternalOnly', attributionText: null },
    createdAt: LOADED_AT,
    createdBy: ACTOR,
    updatedAt: null,
    updatedBy: null,
  };
}

export function createGeoSeed(): GeoSeedData {
  const peruId = id('90000000', 1);
  const limaDepartmentId = id('90000000', 2);
  const limaProvinceId = id('90000000', 3);
  const callaoId = id('90000000', 5);
  const portId = id('90000000', 6);
  const peruCodes = [
    code(1, { schemeCode: 'ISO-3166-1-A2', value: 'PE', sourceCode: 'ISO', authority: ISO.authority, canonical: true }),
    code(2, { schemeCode: 'ISO-3166-1-A3', value: 'PER', sourceCode: 'ISO', authority: ISO.authority, canonical: false }),
    code(3, { schemeCode: 'ISO-3166-1-N', value: '604', sourceCode: 'ISO', authority: ISO.authority, canonical: false }),
  ];
  const places = [
    place(1, { type: 'Country', countryCode: 'PE', level: 0, levelLabel: null, officialName: 'Perú', canonicalCode: { schemeCode: 'ISO-3166-1-A2', value: 'PE' }, parentId: null, tradeLocation: null }, peruCodes),
    place(2, { type: 'AdministrativeDivision', countryCode: 'PE', level: 1, levelLabel: 'Departamento', officialName: 'Lima', canonicalCode: { schemeCode: 'UBIGEO-INEI', value: '15' }, parentId: peruId, tradeLocation: null }, [code(4, { schemeCode: 'UBIGEO-INEI', value: '15', sourceCode: 'INEI', authority: INEI.authority, canonical: true })]),
    place(3, { type: 'AdministrativeDivision', countryCode: 'PE', level: 2, levelLabel: 'Provincia', officialName: 'Lima', canonicalCode: { schemeCode: 'UBIGEO-INEI', value: '1501' }, parentId: limaDepartmentId, tradeLocation: null }, [code(5, { schemeCode: 'UBIGEO-INEI', value: '1501', sourceCode: 'INEI', authority: INEI.authority, canonical: true })]),
    place(4, { type: 'AdministrativeDivision', countryCode: 'PE', level: 3, levelLabel: 'Distrito', officialName: 'Miraflores', canonicalCode: { schemeCode: 'UBIGEO-INEI', value: '150122' }, parentId: limaProvinceId, tradeLocation: null }, [code(6, { schemeCode: 'UBIGEO-INEI', value: '150122', sourceCode: 'INEI', authority: INEI.authority, canonical: true })]),
    place(5, { type: 'AdministrativeDivision', countryCode: 'PE', level: 1, levelLabel: 'Provincia Constitucional', officialName: 'Callao', canonicalCode: { schemeCode: 'UBIGEO-INEI', value: '07' }, parentId: peruId, tradeLocation: null }, [code(7, { schemeCode: 'UBIGEO-INEI', value: '07', sourceCode: 'INEI', authority: INEI.authority, canonical: true })]),
    place(6, {
      type: 'TradeLocation',
      countryCode: 'PE',
      level: null,
      levelLabel: null,
      officialName: 'Puerto del Callao',
      canonicalCode: { schemeCode: 'UN-LOCODE', value: 'PECLL' },
      parentId: callaoId,
      tradeLocation: { unLocode: 'PECLL', siteCode: null, siteKind: null, functions: ['SEAPORT'], uneceStatus: 'AA', uneceStatusDate: '2024-03-01', iataCode: null, usableInTradeDocuments: true, siteCount: 1 },
    }, [code(8, { schemeCode: 'UN-LOCODE', value: 'PECLL', sourceCode: 'UNECE', authority: UNECE.authority, canonical: true })]),
    place(7, {
      type: 'TradeLocation',
      countryCode: 'PE',
      level: null,
      levelLabel: null,
      officialName: 'Terminal de demostración',
      canonicalCode: { schemeCode: 'ORG-SITE', value: 'PECLL-DT01' },
      parentId: portId,
      tradeLocation: { unLocode: null, siteCode: 'PECLL-DT01', siteKind: 'Terminal', functions: [], uneceStatus: null, uneceStatusDate: null, iataCode: null, usableInTradeDocuments: true, siteCount: 0 },
    }, [code(9, { schemeCode: 'ORG-SITE', value: 'PECLL-DT01', sourceCode: 'ORG', authority: 'Organización S.A.', canonical: true })]),
  ];
  const schema = {
    countryCode: 'PE',
    levels: [
      { order: 1, canonicalLabel: 'ADM1' as const, localLabel: 'Departamento', canonicalSchemeCode: 'UBIGEO-INEI', isAddressLevel: false, placeCount: 2 },
      { order: 2, canonicalLabel: 'ADM2' as const, localLabel: 'Provincia', canonicalSchemeCode: 'UBIGEO-INEI', isAddressLevel: false, placeCount: 1 },
      { order: 3, canonicalLabel: 'ADM3' as const, localLabel: 'Distrito', canonicalSchemeCode: 'UBIGEO-INEI', isAddressLevel: true, placeCount: 1 },
    ],
    usesPostalCode: true,
    postalCodePattern: '^[0-9]{5}$',
    version: 1,
    createdAt: LOADED_AT,
    createdBy: ACTOR,
    updatedAt: null,
    updatedBy: null,
  };
  return {
    places,
    countries: [{ alpha2: 'PE', alpha3: 'PER', numeric: '604', englishName: 'Peru', placeId: peruId, schema }],
    schemes: SCHEMES,
    sources: [
      ISO,
      INEI,
      { code: 'RENIEC', authority: 'Registro Nacional de Identificación y Estado Civil', licenseName: 'Uso interno', licenseUrl: null, attributionText: null, redistribution: 'InternalOnly', confirmedOn: null, evidenceRef: null, version: 1 },
      { code: 'SUNAT', authority: 'Superintendencia Nacional de Aduanas y de Administración Tributaria', licenseName: 'Uso interno', licenseUrl: null, attributionText: null, redistribution: 'InternalOnly', confirmedOn: null, evidenceRef: null, version: 1 },
      { code: 'SERPOST', authority: 'Servicios Postales del Perú', licenseName: 'Uso interno', licenseUrl: null, attributionText: null, redistribution: 'InternalOnly', confirmedOn: null, evidenceRef: null, version: 1 },
      UNECE,
      ORG,
    ],
    correspondences: [],
  };
}
