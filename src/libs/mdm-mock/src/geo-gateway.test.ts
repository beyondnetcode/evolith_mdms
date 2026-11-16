import { describe, expect, it } from 'vitest';
import {
  EMPTY_PLACE_QUERY,
  type CorrespondenceQuery,
  type PlaceQuery,
  type TradeLocationQuery,
} from '@mdm/contracts';
import { fixedClock } from './clock.ts';
import { MockMdmGateway } from './mock-gateway.ts';
import { MdmMockStore } from './store.ts';

const PROVINCE_ID = '90000000-0000-4000-8000-000000000003';
const PORT_ID = '90000000-0000-4000-8000-000000000006';

function gateway(store = new MdmMockStore()) {
  return new MockMdmGateway({ store, clock: fixedClock('2026-10-26'), actor: 'geo.test' });
}

function placeQuery(overrides: Partial<PlaceQuery> = {}): PlaceQuery {
  return { ...EMPTY_PLACE_QUERY, ...overrides };
}

describe('MockMdmGateway — geografía', () => {
  it('lee países, ficha, escalera y resolución con jerarquía completa', async () => {
    const mock = gateway();
    const countries = await mock.listCountries({ status: null, search: null });
    expect(countries.items).toHaveLength(1);
    expect((await mock.getCountry('PE')).territorialSchema).toMatchObject({ declared: true, levelCount: 3 });
    expect((await mock.getTerritorialSchema('PE')).levels[2]).toMatchObject({ localLabel: 'Distrito', placeCount: 1 });
    const place = await mock.getPlace('90000000-0000-4000-8000-000000000004');
    expect(place.displayPath).toBe('Miraflores › Lima › Lima › Perú');
    expect(place.path).toBe('PE/15/1501/150122');
    const resolved = await mock.resolvePlace({ scheme: 'UBIGEO-INEI', value: '1501', asOf: null });
    expect(resolved.place.id).toBe(PROVINCE_ID);
    expect(resolved.resolution.matchedCode.isCurrent).toBe(true);
  });

  it('filtra, normaliza y pagina búsquedas; limita los barridos amplios', async () => {
    const mock = gateway();
    const page = await mock.searchPlaces(placeQuery({ name: 'lima', countryCode: 'PE', page: 1, pageSize: 1 }));
    expect(page.totalCount).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.totalPages).toBe(2);
    expect(page.items[0]?.officialName).toBe('Lima');
    await expect(mock.searchPlaces(placeQuery({ name: 'ima', nameMatch: 'contains' }))).rejects.toMatchObject({
      problem: { code: 'validation.search_too_broad', status: 400 },
    });
    await expect(mock.searchPlaces(placeQuery({ page: 0 }))).rejects.toMatchObject({
      problem: { code: 'validation.failed', status: 400 },
    });
  });

  it('devuelve errores contractuales para recursos, escalera y resolución ambiguos o ausentes', async () => {
    const mock = gateway();
    await expect(mock.getCountry('XX')).rejects.toMatchObject({ problem: { code: 'common.not_found', status: 404 } });
    await expect(mock.resolvePlace({ scheme: null, value: 'no-existe', asOf: null })).rejects.toMatchObject({
      problem: { code: 'common.not_found', status: 404 },
    });
    mock.store.geoCountries.get('PE')!.schema = null;
    await expect(mock.getTerritorialSchema('PE')).rejects.toMatchObject({
      problem: { code: 'geo.country.schema_not_declared', status: 404 },
    });
  });

  it('registra cualquier país con escalera opcional y permite construir su árbol después', async () => {
    const mock = new MockMdmGateway({
      store: new MdmMockStore(),
      clock: fixedClock('2026-10-26'),
      actor: 'geo.responsable',
      role: 'RESPONSABLE_MDM',
    });
    const country = await mock.registerCountry({
      alpha2: 'FJ',
      alpha3: 'FJI',
      numeric: '242',
      officialName: 'Fiyi',
      englishName: 'Fiji',
      validFrom: null,
      sourceCode: 'ISO',
      sourceVersion: 'demo',
    });
    expect((await mock.getCountry('FJ')).territorialSchema).toMatchObject({
      declared: false,
      levelCount: 0,
    });
    expect(await mock.getPlace(country.id)).toMatchObject({
      type: 'Country',
      canonicalCode: { schemeCode: 'ISO-3166-1-A2', value: 'FJ' },
    });
    await mock.declareTerritorialSchema('FJ', {
      levels: [{
        order: 1,
        canonicalLabel: 'ADM1',
        localLabel: 'División',
        canonicalSchemeCode: 'ISO-3166-2',
        isAddressLevel: true,
      }],
      usesPostalCode: false,
      postalCodePattern: null,
    });
    const division = await mock.registerPlace({
      type: 'AdministrativeDivision',
      parentId: country.id,
      canonicalCode: { schemeCode: 'ISO-3166-2', value: 'FJ-C' },
      officialName: 'División Central',
      languageCode: 'es',
      validFrom: null,
      sourceCode: 'ISO',
      sourceVersion: 'demo',
    });
    expect(await mock.getPlace(division.id)).toMatchObject({
      levelLabel: 'División',
      displayPath: 'División Central › Fiyi',
    });
    await expect(mock.registerCountry({
      alpha2: 'FJ',
      alpha3: 'FJI',
      numeric: '242',
      officialName: 'Fiyi repetido',
      englishName: null,
      validFrom: null,
      sourceCode: 'ISO',
      sourceVersion: null,
    })).rejects.toMatchObject({ problem: { code: 'geo.code.duplicate', status: 409 } });
  });

  it('permite al analista registrar países para mantener el árbol geográfico', async () => {
    const analyst = new MockMdmGateway({
      store: new MdmMockStore(),
      clock: fixedClock('2026-10-26'),
      role: 'ANALISTA_DATOS_MAESTROS',
    });
    const created = await analyst.registerCountry({
      alpha2: 'FJ',
      alpha3: 'FJI',
      numeric: '242',
      officialName: 'Fiyi',
      englishName: null,
      validFrom: null,
      sourceCode: 'ISO',
      sourceVersion: null,
    });
    expect((await analyst.getCountry('FJ')).placeId).toBe(created.id);
  });

  it('registra una localidad manual sin inventar UBIGEO', async () => {
    const mock = gateway();
    const created = await mock.registerPlace({
      type: 'Locality',
      parentId: '90000000-0000-4000-8000-000000000004',
      canonicalCode: null,
      officialName: 'Asentamiento de prueba',
      languageCode: 'es',
      validFrom: null,
      sourceCode: 'ORG',
      sourceVersion: null,
    });
    expect(await mock.getPlace(created.id)).toMatchObject({
      type: 'Locality',
      levelLabel: 'Localidad',
      canonicalCode: null,
      displayPath: 'Asentamiento de prueba › Miraflores › Lima › Lima › Perú',
    });
  });

  it('aplica If-Match, incrementa versión y conserva auditoría en escrituras del lugar', async () => {
    let today = '2026-10-25';
    const mock = new MockMdmGateway({
      store: new MdmMockStore(),
      clock: { today: () => today, now: () => `${today}T15:00:00.000+00:00` },
      actor: 'geo.test',
      role: 'ANALISTA_DATOS_MAESTROS',
    });
    const request = {
      type: 'AdministrativeDivision',
      parentId: PROVINCE_ID,
      canonicalCode: { schemeCode: 'UBIGEO-INEI', value: '150101' },
      officialName: 'San Borja',
      languageCode: null,
      validFrom: null,
      sourceCode: 'INEI',
      sourceVersion: 'demo',
    } as const;
    const created = await mock.registerPlace(request);
    expect(created.version).toBe(1);
    today = '2026-10-26';
    const nameChanged = await mock.correctOfficialName(created.id, {
      languageCode: 'es',
      officialName: 'San Borja corregido',
      reason: 'Corrección de demostración',
    }, created.version);
    expect(nameChanged.version).toBe(2);
    const record = await mock.getPlace(created.id);
    expect(record).toMatchObject({ version: 2, officialName: 'San Borja corregido', updatedBy: 'geo.test' });
    await expect(mock.deactivatePlace(created.id, { reason: 'Baja' }, 1)).rejects.toMatchObject({
      problem: { code: 'precondition.failed', status: 412 },
    });
    const inactive = await mock.deactivatePlace(created.id, { reason: 'Baja' }, 2);
    expect(inactive.version).toBe(3);
    const active = await mock.reactivatePlace(created.id, { reason: 'Reactivación' }, 3);
    expect(active.version).toBe(4);
    const historicalName = await mock.searchPlaces(placeQuery({ name: 'San Borja', countryCode: 'PE', asOf: '2026-10-25' }));
    expect(historicalName.items.some((item) => item.id === created.id)).toBe(true);

    const consultant = new MockMdmGateway({ store: new MdmMockStore(), clock: fixedClock('2026-10-26'), role: 'CONSULTOR' });
    await expect(consultant.registerPlace(request)).rejects.toMatchObject({
      problem: { status: 403, code: 'auth.forbidden' },
    });
  });

  it('mantiene la versión independiente de la escalera y protege niveles ya utilizados', async () => {
    const mock = gateway();
    const schema = {
      levels: [
        { order: 1, canonicalLabel: 'ADM1' as const, localLabel: 'Departamento', canonicalSchemeCode: 'UBIGEO-INEI', isAddressLevel: false },
        { order: 2, canonicalLabel: 'ADM2' as const, localLabel: 'Provincia', canonicalSchemeCode: 'UBIGEO-INEI', isAddressLevel: false },
        { order: 3, canonicalLabel: 'ADM3' as const, localLabel: 'Distrito', canonicalSchemeCode: 'UBIGEO-INEI', isAddressLevel: true },
      ],
      usesPostalCode: true,
      postalCodePattern: '^[0-9]{5}$',
    };
    await expect(mock.changeTerritorialSchema('PE', schema, 1)).resolves.toEqual({ version: 2 });
    expect((await mock.getCountry('PE')).version).toBe(1);
    await expect(mock.changeTerritorialSchema('PE', schema, 1)).rejects.toMatchObject({
      problem: { code: 'precondition.failed', status: 412 },
    });
    await expect(mock.changeTerritorialSchema('PE', { ...schema, levels: schema.levels.slice(0, 2) }, 2)).rejects.toMatchObject({
      problem: { code: 'geo.country.level_in_use', status: 409 },
    });
  });

  it('conserva identidad del código, expira con versión y no permite alta duplicada', async () => {
    const mock = gateway();
    const placeId = '90000000-0000-4000-8000-000000000004';
    const added = await mock.addPlaceCode(placeId, {
      schemeCode: 'ISO-3166-2', value: 'PE-MIR', validFrom: '2024-03-01', sourceCode: 'ISO', sourceVersion: null,
    }, 1);
    expect(added.version).toBe(2);
    expect((await mock.getPlace(placeId)).codes.find((code) => code.codeId === added.id)?.isCanonical).toBe(false);
    await expect(mock.addPlaceCode(PROVINCE_ID, {
      schemeCode: 'ISO-3166-2', value: 'PE-MIR', validFrom: null, sourceCode: 'ISO', sourceVersion: null,
    }, 1)).rejects.toMatchObject({ problem: { code: 'geo.code.duplicate', status: 409 } });
    await expect(mock.expirePlaceCode(placeId, added.id, { validTo: '2026-10-25', reason: null }, 2)).resolves.toEqual({ version: 3 });
    const resolved = await mock.resolvePlace({ scheme: 'ISO-3166-2', value: 'PE-MIR', asOf: null });
    expect(resolved.resolution.matchedCode.isCurrent).toBe(false);
  });

  it('escribe códigos y correspondencias en sus agregados propios y registra lugares propios sin subir al padre', async () => {
    const mock = gateway();
    const parentBefore = await mock.getPlace(PORT_ID);
    const site = await mock.registerSite(PORT_ID, { siteCode: 'PECLL-DT02', officialName: 'Depósito 2', siteKind: 'TemporaryWarehouse', geoReference: null });
    expect(site.version).toBe(1);
    expect((await mock.getPlace(PORT_ID)).version).toBe(parentBefore.version);
    expect((await mock.getPlace(PORT_ID)).tradeLocation?.siteCount).toBe(2);
    expect((await mock.listSites(PORT_ID)).items.map((item) => item.tradeLocation.siteCode)).toEqual(['PECLL-DT02', 'PECLL-DT01']);

    const correspondence = await mock.registerCorrespondence({
      from: { schemeCode: 'UBIGEO-INEI', value: '15' },
      to: { schemeCode: 'ISO-3166-1-A2', value: 'PE' },
      kind: 'PartOf',
      validFrom: null,
      note: 'Relación de demostración',
      sourceCode: 'INEI',
    });
    expect(correspondence.version).toBe(1);
    const query: CorrespondenceQuery = { scheme: null, value: null, kind: null, currentOnly: true, page: 1, pageSize: 20 };
    expect((await mock.listCorrespondences(query)).totalCount).toBe(1);
    expect((await mock.expireCorrespondence(correspondence.id, { validTo: null, reason: null }, 1)).version).toBe(2);
  });

  it('expone los filtros de comercio y catálogos, y rechaza códigos no admitidos', async () => {
    const mock = gateway();
    const query: TradeLocationQuery = {
      countryCode: 'PE', unLocode: 'PE', name: null, functions: ['SEAPORT'], uneceStatus: 'AA',
      usableInTradeDocuments: true, includeSites: false, asOf: null, page: 1, pageSize: 20,
    };
    const results = await mock.searchTradeLocations(query);
    expect(results.items.map((item) => item.tradeLocation.unLocode)).toEqual(['PECLL']);
    expect((await mock.listCodeSchemes({ countryCode: 'PE', appliesTo: 'AdministrativeDivision', includeInactive: false })).items.map((item) => item.code)).toContain('UBIGEO-INEI');
    expect((await mock.listSources()).items.map((item) => item.code)).toContain('INEI');

    const miraflores = await mock.getPlace('90000000-0000-4000-8000-000000000004');
    await expect(mock.addPlaceCode(miraflores.id, {
      schemeCode: 'UBIGEO-INEI', value: 'texto', validFrom: null, sourceCode: 'INEI', sourceVersion: null,
    }, miraflores.version)).rejects.toMatchObject({ problem: { code: 'geo.code.invalid_format', status: 422 } });
  });
});
