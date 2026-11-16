import type { Country, MdmGateway, PlacePage, PlaceQuery, RegisterPlaceRequest, TerritorialSchema } from '@mdm/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderMdm } from '../../../testing/mdm-harness.tsx';

const COUNTRY_ID = '90000000-0000-4000-8000-000000000001';
const PLACE_ID = '90000000-0000-4000-8000-000000000004';

const COUNTRY: Country = {
  placeId: COUNTRY_ID,
  alpha2: 'PE',
  alpha3: 'PER',
  numeric: '604',
  officialName: 'Perú',
  englishName: 'Peru',
  status: 'Active',
  levelCount: 3,
  version: 1,
  createdAt: '2024-03-01T14:00:00.000+00:00',
  createdBy: 'carga-inicial',
  updatedAt: null,
  updatedBy: null,
  validFrom: '1821-07-28',
  validTo: null,
  codes: [],
  territorialSchema: { declared: true, levelCount: 3, usesPostalCode: true, version: 1 },
};

const SCHEMA: TerritorialSchema = {
  countryCode: 'PE',
  levels: [
    { order: 1, canonicalLabel: 'ADM1', localLabel: 'Departamento', canonicalSchemeCode: 'UBIGEO-INEI', isAddressLevel: false, placeCount: 25 },
    { order: 2, canonicalLabel: 'ADM2', localLabel: 'Provincia', canonicalSchemeCode: 'UBIGEO-INEI', isAddressLevel: false, placeCount: 196 },
    { order: 3, canonicalLabel: 'ADM3', localLabel: 'Distrito', canonicalSchemeCode: 'UBIGEO-INEI', isAddressLevel: true, placeCount: 1891 },
  ],
  usesPostalCode: true,
  postalCodePattern: '^[0-9]{5}$',
  version: 1,
  createdAt: '2024-03-01T14:00:00.000+00:00',
  createdBy: 'carga-inicial',
  updatedAt: null,
  updatedBy: null,
};

const PLACE_PAGE: PlacePage = {
  page: 1,
  pageSize: 20,
  totalCount: 1,
  totalPages: 1,
  items: [
    {
      id: PLACE_ID,
      type: 'AdministrativeDivision',
      status: 'Active',
      countryCode: 'PE',
      level: 3,
      officialName: 'Miraflores',
      matchedName: null,
      canonicalCode: { schemeCode: 'UBIGEO-INEI', value: '150122' },
      parentId: COUNTRY_ID,
      path: 'PE/1501/150122',
      displayPath: 'Miraflores › Lima › Perú',
      redactedSchemes: [],
      version: 1,
    },
  ],
};

describe('P-GEO-01 Explorador geográfico', () => {
  it('no ofrece el alta a roles sin mantenimiento geográfico', async () => {
    renderMdm({ path: '/mdm/geografia', role: 'CONSULTOR' });
    await screen.findByRole('heading', { level: 1, name: 'Geografía' });
    expect(screen.queryByRole('button', { name: 'Nuevo lugar' })).not.toBeInTheDocument();
  });

  it('registra un país sin escalera y permite declarar su árbol después', async () => {
    const { user } = renderMdm({ path: '/mdm/geografia', role: 'RESPONSABLE_MDM' });

    await user.click(await screen.findByRole('button', { name: 'Nuevo país' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre oficial (obligatorio)' }), 'Fiyi');
    await user.type(screen.getByRole('textbox', { name: 'ISO alfa-2 (obligatorio)' }), 'FJ');
    await user.type(screen.getByRole('textbox', { name: 'ISO alfa-3 (obligatorio)' }), 'FJI');
    await user.type(screen.getByRole('textbox', { name: 'ISO numérico (obligatorio)' }), '242');
    await user.click(screen.getByRole('button', { name: 'Registrar país' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Fiyi' })).toBeInTheDocument();
    expect(screen.getByText('Este país aún no tiene una escalera territorial declarada.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Definir escalera territorial' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre local (obligatorio)' }), 'División');
    await user.click(screen.getByRole('button', { name: 'Declarar escalera' }));

    expect(await screen.findByText(/1\. División/)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Volver a Geografía' }));
    await user.click(await screen.findByRole('button', { name: 'Nuevo lugar' }));
    await user.type(screen.getByRole('textbox', { name: 'Buscar país o división' }), 'Fiyi');
    await user.click(screen.getByRole('button', { name: 'Buscar lugares superiores' }));
    const parent = screen.getByRole('combobox', { name: 'Lugar superior (obligatorio)' });
    await waitFor(() => expect(parent.querySelectorAll('option')).toHaveLength(2));
    await user.selectOptions(parent, within(parent).getByRole('option', { name: 'Fiyi · FJ' }));
    expect(screen.getByRole('textbox', { name: 'Nivel territorial' })).toHaveValue('División');
    await user.type(screen.getByRole('textbox', { name: 'Nombre oficial (obligatorio)' }), 'División Central');
    await user.type(screen.getByRole('textbox', { name: /Código canónico/ }), 'FJ-C');
    await user.click(screen.getByRole('button', { name: 'Registrar lugar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'División Central' })).toBeInTheDocument();
    expect(screen.getByText('División Central › Fiyi')).toBeInTheDocument();
  });

  it('permite al analista registrar países para mantener el árbol manualmente', async () => {
    renderMdm({ path: '/mdm/geografia', role: 'ANALISTA_DATOS_MAESTROS' });
    await screen.findByRole('heading', { level: 1, name: 'Geografía' });
    expect(screen.getByRole('button', { name: 'Nuevo país' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo lugar' })).toBeInTheDocument();
  });

  it('registra una localidad manual debajo de una división sin crear un UBIGEO', async () => {
    const requests: RegisterPlaceRequest[] = [];
    const decorateGateway = (base: MdmGateway): MdmGateway => ({
      ...base,
      searchPlaces: (query, options) => query.name === 'Miraflores'
        ? Promise.resolve(PLACE_PAGE)
        : base.searchPlaces(query, options),
      registerPlace: (request) => {
        requests.push(request);
        return base.registerPlace(request);
      },
    });
    const { user } = renderMdm({ path: '/mdm/geografia', role: 'ANALISTA_DATOS_MAESTROS', decorateGateway });

    await user.click(await screen.findByRole('button', { name: 'Nuevo lugar' }));
    await user.type(screen.getByRole('textbox', { name: 'Buscar país o división' }), 'Miraflores');
    await user.click(screen.getByRole('button', { name: 'Buscar lugares superiores' }));
    const parent = screen.getByRole('combobox', { name: 'Lugar superior (obligatorio)' });
    await waitFor(() => expect(parent.querySelectorAll('option')).toHaveLength(2));
    await user.selectOptions(parent, within(parent).getByRole('option', { name: /Miraflores/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo de ubicación (obligatorio)' }), 'Locality');
    await user.type(screen.getByRole('textbox', { name: 'Nombre oficial (obligatorio)' }), 'Centro poblado de prueba');
    const submit = screen.getByRole('button', { name: 'Registrar lugar' });
    await waitFor(() => expect(submit).not.toHaveAttribute('aria-disabled', 'true'));
    await user.click(submit);

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ type: 'Locality', canonicalCode: null, sourceCode: 'ORG' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Centro poblado de prueba' })).toBeInTheDocument();
    expect(screen.getByText('Centro poblado de prueba › Miraflores › Lima › Lima › Perú')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('muestra países y lugares, busca al enviar y aplica el país seleccionado al contrato', async () => {
    const calls: PlaceQuery[] = [];
    const decorateGateway = (base: MdmGateway): MdmGateway => ({
      ...base,
      listCountries: () => Promise.resolve({
        items: [{ placeId: COUNTRY_ID, alpha2: 'PE', alpha3: 'PER', numeric: '604', officialName: 'Perú', englishName: 'Peru', status: 'Active', levelCount: 3, version: 1 }],
      }),
      searchPlaces: (query) => {
        calls.push(query);
        return Promise.resolve(PLACE_PAGE);
      },
    });
    const { user } = renderMdm({ path: '/mdm/geografia', decorateGateway });

    expect(await screen.findByRole('heading', { level: 1, name: 'Geografía' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Miraflores' })).toHaveAttribute('href', `/mdm/geografia/lugares/${PLACE_ID}`);
    expect(screen.getByRole('link', { name: 'Perú (PE)' })).toHaveAttribute('href', '/mdm/geografia/paises/PE');

    const country = screen.getByRole('combobox', { name: 'País' });
    await user.selectOptions(country, 'PE');
    await waitFor(() => expect(calls.at(-1)?.countryCode).toBe('PE'));

    const search = screen.getByRole('searchbox', { name: 'Buscar por nombre' });
    await user.type(search, 'Lima{Enter}');
    await waitFor(() => {
      expect(calls.at(-1)?.name).toBe('Lima');
      expect(calls.at(-1)?.countryCode).toBe('PE');
    });
    await user.type(screen.getByRole('searchbox', { name: 'Buscar por código oficial' }), '150122{Enter}');
    await waitFor(() => {
      expect(calls.at(-1)?.code).toBe('150122');
      expect(calls.at(-1)?.name).toBeNull();
    });
  });

  it('no envía un nombre de un solo carácter al servicio', async () => {
    const searchPlaces = vi.fn(() => Promise.resolve(PLACE_PAGE));
    const decorateGateway = (base: MdmGateway): MdmGateway => ({ ...base, searchPlaces });
    const { user } = renderMdm({ path: '/mdm/geografia', decorateGateway });
    await screen.findByRole('link', { name: 'Miraflores' });
    const before = searchPlaces.mock.calls.length;
    await user.type(screen.getByRole('searchbox', { name: 'Buscar por nombre' }), 'L{Enter}');
    expect(screen.getByText('Escribe al menos dos caracteres para buscar por nombre.')).toHaveAttribute('role', 'status');
    expect(searchPlaces.mock.calls.length).toBe(before);
  });

  it('muestra códigos del país y su escalera territorial declarada', async () => {
    const decorateGateway = (base: MdmGateway): MdmGateway => ({
      ...base,
      getCountry: () => Promise.resolve(COUNTRY),
      getTerritorialSchema: () => Promise.resolve(SCHEMA),
    });
    renderMdm({ path: '/mdm/geografia/paises/PE', decorateGateway });

    expect(await screen.findByRole('heading', { level: 1, name: 'Perú' })).toBeInTheDocument();
    expect(screen.getByText('PER')).toBeInTheDocument();
    expect(await screen.findByText(/Departamento/)).toBeInTheDocument();
    expect(screen.getByText(/Distrito/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver lugares de Perú' })).toHaveAttribute('href', '/mdm/geografia?pais=PE');
  });

  it('registra una división bajo un padre vigente y abre la ficha creada', async () => {
    const { user } = renderMdm({ path: '/mdm/geografia', role: 'ANALISTA_DATOS_MAESTROS' });

    await user.click(await screen.findByRole('button', { name: 'Nuevo lugar' }));
    await user.type(screen.getByRole('textbox', { name: 'Buscar país o división' }), 'Lima');
    await user.click(screen.getByRole('button', { name: 'Buscar lugares superiores' }));
    const parent = screen.getByRole('combobox', { name: 'Lugar superior (obligatorio)' });
    await waitFor(() => expect(parent.querySelectorAll('option').length).toBeGreaterThan(1));
    await user.selectOptions(parent, '90000000-0000-4000-8000-000000000002');
    expect(screen.getByRole('textbox', { name: 'Nivel territorial' })).toHaveValue('Provincia');

    await user.type(screen.getByRole('textbox', { name: 'Nombre oficial (obligatorio)' }), 'Huaral');
    await user.type(screen.getByRole('textbox', { name: /Código canónico/ }), '1506');
    await user.click(screen.getByRole('button', { name: 'Registrar lugar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Huaral' })).toBeInTheDocument();
    expect(screen.getByText('Huaral › Lima › Perú')).toBeInTheDocument();
  });
});
