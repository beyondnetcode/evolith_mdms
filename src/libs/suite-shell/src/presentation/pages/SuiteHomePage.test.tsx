import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WIDTHS } from '@sil/ui/testing';
import { MOCK_SESSION_KEY } from '@suite/mock';
import { renderSuite } from '../../testing/suite-harness.tsx';

const NO_SIM = { umsDown: false, maintenance: false, expires: false };

/** R-06: «Tus sistemas» (tarjetas enlazables) y debajo «Aún no disponibles en este prototipo» (lista sin bordes). */
const AVAILABLE_LIST = { name: 'Sistemas de la suite' };
const UNAVAILABLE_LIST = { name: 'Aún no disponibles en este prototipo' };

function codesOf(name: string, selector: string): string[] {
  const list = screen.queryByRole('list', { name });
  return list === null ? [] : within(list).getAllByRole('listitem').map((item) => item.querySelector(selector)?.textContent ?? '');
}

/** Las siglas en el orden en que se ven: primero lo disponible y después lo que aún no lo está. */
function cardNames(): string[] {
  return [...codesOf(AVAILABLE_LIST.name, '.text-title-large'), ...codesOf(UNAVAILABLE_LIST.name, '.text-title-small')];
}

describe('S-02 Inicio de la suite', () => {
  it('Ana ve solo sus sistemas, en orden alfabético por nombre canónico, y ninguno es un enlace', async () => {
    renderSuite({ user: 'ana.perez', path: '/' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' })).toBeInTheDocument();
    // CNS «Sistema de Contenedores», DT «Sistema de Depósito Temporal». Ninguno está en el catálogo lanzable.
    await waitFor(() => expect(cardNames()).toEqual(['CNS', 'DT']));
    expect(screen.queryByRole('heading', { name: 'Tus sistemas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^(CNS|DT)/ })).not.toBeInTheDocument();
  });

  it('los sistemas fuera del alcance son información: sin enlace, sin foco y con su razón escrita', async () => {
    renderSuite({ user: 'ana.perez', path: '/' });
    const list = await screen.findByRole('list', UNAVAILABLE_LIST);
    expect(screen.getByRole('heading', { level: 2, name: 'Aún no disponibles en este prototipo' })).toBeInTheDocument();
    const cns = within(list).getAllByRole('listitem')[0];
    expect(cns).toHaveTextContent('CNS');
    expect(cns).toHaveTextContent('Sistema de Contenedores');
    // La razón la dice el encabezado del grupo: no se repite en cada elemento (H-05 del anexo A1 §12).
    expect(cns).not.toHaveTextContent('Aún no disponible');
    expect(cns).not.toHaveTextContent('Fase 1');
    expect(cns?.querySelector('a, button, [tabindex], [aria-disabled]')).toBeNull();
  });

  it('Carlos ve cinco tarjetas y MDM es el único enlace, con su rol y su sede', async () => {
    renderSuite({ user: 'carlos.vega', path: '/' });
    await screen.findByRole('list', AVAILABLE_LIST);
    // Lo disponible primero (MDM) y, debajo, orden alfabético por nombre canónico: Depósito Temporal, Gestión Comercial, Patios, Usuarios.
    expect(cardNames()).toEqual(['MDM', 'DT', 'CMS', 'YMS', 'UMS']);
    expect(screen.getByRole('link', { name: /^MDM.*Consultor · Piura/ })).toBeInTheDocument();
  });

  it('el usuario sin MDM no ve su tarjeta ni ningún mensaje que diga que existe', async () => {
    renderSuite({ user: 'diego.salas', path: '/' });
    await screen.findByRole('list', UNAVAILABLE_LIST);
    expect(cardNames()).toEqual(['DT']);
    expect(screen.queryByRole('heading', { name: 'Tus sistemas' })).not.toBeInTheDocument();
    expect(screen.queryByText(/MDM/)).not.toBeInTheDocument();
  });

  it('nunca aparecen el TMS ni los sistemas fuera del lanzador', async () => {
    renderSuite({ user: 'carlos.vega', path: '/' });
    await screen.findByRole('list', AVAILABLE_LIST);
    for (const systemCode of ['TMS', 'XMS', 'WMS', 'BMS', 'NMS', 'DAP']) expect(cardNames()).not.toContain(systemCode);
  });

  it('muestra la hora de Lima, el aviso de prototipo y el apoyo sobre los accesos', async () => {
    renderSuite({ user: 'ana.perez', path: '/' });
    await screen.findByRole('list', UNAVAILABLE_LIST);
    // R-08: un solo pie informativo (la hora de Lima y el aviso de prototipo en una línea `body-small`) y el apoyo al final de la lista.
    const note = screen.getByText(/Las horas se muestran en hora de Lima \(UTC-5\)\. Prototipo: esta pantalla simula el portal de la suite/);
    expect(note.className).toContain('text-body-small');
    expect(screen.getByText('¿Te falta algún sistema? Pídelo a tu jefatura o al administrador de accesos.')).toBeInTheDocument();
    expect(screen.queryByText(/Aquí aparecen los sistemas a los que tienes acceso/)).not.toBeInTheDocument();
    expect(document.title).toBe('Suite');
  });

  it('carga: indicador anunciado y marcadores con la forma de las tarjetas', async () => {
    renderSuite({ user: 'ana.perez', path: '/', settings: { latencyMs: 80 } });
    expect(await screen.findByRole('progressbar', { name: 'Cargando tus sistemas' })).toBeInTheDocument();
    await screen.findByRole('list', UNAVAILABLE_LIST);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('vacío: una frase, sin tarjetas ni lanzador vacío', async () => {
    renderSuite({ user: 'ana.perez', path: '/', settings: { mode: 'vacio' } });
    // R-09: disco con icono, titular y explicación; sin tarjetas ni lanzador vacío.
    expect(await screen.findByText('Aún no tienes sistemas asignados')).toBeInTheDocument();
    expect(screen.getByText('Tu usuario no tiene acceso a ningún sistema de la suite. Pídelo a tu jefatura o al administrador de accesos.')).toBeInTheDocument();
    expect(screen.getAllByRole('status').some((region) => region.textContent.includes('Aún no tienes sistemas asignados'))).toBe(true);
    expect(screen.queryByRole('list', AVAILABLE_LIST)).not.toBeInTheDocument();
  });

  it('error de lectura: aviso en la región con «Reintentar» y código de correlación', async () => {
    const { user } = renderSuite({ user: 'ana.perez', path: '/', settings: { mode: 'error' } });
    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('No pudimos cargar tus sistemas. Revisa tu conexión e inténtalo de nuevo.');
    expect(notice).toHaveTextContent(/SUITE-[0-9A-F]{8}/);
    await user.click(within(notice).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('en mantenimiento la tarjeta de MDM deja de ser enlace y explica por qué', async () => {
    renderSuite({ user: 'carlos.vega', path: '/', settings: { suite: { ...NO_SIM, maintenance: true } } });
    const list = await screen.findByRole('list', UNAVAILABLE_LIST);
    expect(screen.queryByRole('link', { name: /^MDM/ })).not.toBeInTheDocument();
    const mdm = within(list).getAllByRole('listitem').find((item) => item.textContent.startsWith('MDM'));
    expect(mdm).toHaveTextContent('En mantenimiento');
    expect(mdm).toHaveTextContent('No está disponible por mantenimiento. Inténtalo más tarde.');
  });

  it('UMS caído con sesión: no expulsa, avisa y deja las tarjetas', async () => {
    renderSuite({ user: 'carlos.vega', path: '/', settings: { suite: { ...NO_SIM, umsDown: true } } });
    expect(await screen.findByRole('list', AVAILABLE_LIST)).toBeInTheDocument();
    expect(
      screen.getByText('No podemos comprobar tus permisos en este momento. Puedes seguir trabajando; si el problema continúa, se te pedirá iniciar sesión.'),
    ).toBeInTheDocument();
  });

  it('la cabecera de la suite tiene marca, «Ayuda» y avatar con el menú de cuenta', async () => {
    const { user } = renderSuite({ user: 'ana.perez', path: '/' });
    await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' });
    expect(screen.getByText('Suite')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ayuda' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cuenta de Ana Pérez' }));
    expect(screen.getByText('ana.perez')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it('con un solo perfil de MDM, la tarjeta abre MDM directo con ese perfil y sede', async () => {
    const { user } = renderSuite({ user: 'rosa.medina', path: '/' });
    await user.click(await screen.findByRole('link', { name: /^MDM/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sistema de prueba' })).toBeInTheDocument();
    expect(screen.getByText('Perfil vigente: Analista de datos maestros · Callao')).toBeInTheDocument();
  });

  it.each(Object.entries(WIDTHS))('la rejilla se pinta en %s', async (_clase, width) => {
    renderSuite({ user: 'carlos.vega', path: '/', width });
    expect(await screen.findByRole('list', { name: 'Sistemas de la suite' })).toBeInTheDocument();
  });
});

describe('S-02 Contexto de trabajo: inquilino y sede (D-030)', () => {
  function context(): HTMLElement {
    return screen.getByRole('region', { name: 'Tu contexto de trabajo' });
  }
  /** El encabezado del saludo (R-05): el h1 y, debajo, el inquilino con la sede de trabajo. */
  async function greeting(): Promise<HTMLElement> {
    const title = await screen.findByRole('heading', { level: 1, name: /^Hola/ });
    const header = title.closest('header');
    if (header === null) throw new Error('Sin encabezado del saludo');
    return header;
  }

  it('con una sola sede el saludo dice inquilino y sede, y no hay nada que elegir', async () => {
    renderSuite({ user: 'ana.perez', path: '/' });
    expect(within(await greeting()).getByText('Organización S.A. (ORG) · Sede Callao')).toBeInTheDocument();
    await screen.findByRole('list', UNAVAILABLE_LIST);
    expect(screen.queryByRole('region', { name: 'Tu contexto de trabajo' })).not.toBeInTheDocument();
  });

  it('el inquilino es el de la cuenta: la variante de UNILOG ve Unilog', async () => {
    renderSuite({ user: 'ricardo.paredes', path: '/' });
    expect(within(await greeting()).getByText('Unilog S.A.C. (UNILOG) · Todas las sedes')).toBeInTheDocument();
  });

  it('solo con perfiles de todas las sedes trabaja en todas, sin elegir', async () => {
    renderSuite({ user: 'diego.salas', path: '/' });
    expect(within(await greeting()).getByText('Organización S.A. (ORG) · Todas las sedes')).toBeInTheDocument();
    await screen.findByRole('list', UNAVAILABLE_LIST);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('con varias sedes se elige: «Todas las sedes» por defecto, y al elegir una se listan sus sistemas', async () => {
    const { user } = renderSuite({ user: 'carlos.vega', path: '/' });
    await screen.findByRole('list', AVAILABLE_LIST);
    const site = within(context()).getByRole('combobox', { name: 'Sede de trabajo' });
    expect(site).toHaveValue('');
    expect(within(site).getAllByRole('option').map((o) => o.textContent)).toEqual(['Todas las sedes', 'Callao', 'Piura']);
    expect(screen.getByText('Ves los sistemas de todas tus sedes; al abrir uno con varias, eliges cuál.')).toBeInTheDocument();
    expect(cardNames()).toContain('MDM');

    // En Callao Carlos no tiene MDM: quedan DT y los sistemas de todas las sedes.
    await user.selectOptions(site, 'Callao');
    expect(await screen.findByText('Ahora trabajas en Sede Callao.')).toBeInTheDocument();
    expect(within(await greeting()).getByText('Organización S.A. (ORG) · Sede Callao')).toBeInTheDocument();
    await waitFor(() => expect(cardNames()).not.toContain('MDM'));
    expect(cardNames()).toEqual(expect.arrayContaining(['DT', 'CMS', 'UMS', 'YMS']));

    await user.selectOptions(within(context()).getByRole('combobox', { name: 'Sede de trabajo' }), 'Piura');
    expect(within(await greeting()).getByText('Organización S.A. (ORG) · Sede Piura')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /^MDM.*Consultor · Piura/ })).toHaveAttribute('href', '/mdm/organizaciones');
    expect(screen.getByText('Los sistemas de abajo se abren con tu perfil de esta sede.')).toBeInTheDocument();
  });

  it('la sede elegida queda en la sesión, y MDM se abre con su perfil', async () => {
    const { user } = renderSuite({ user: 'carlos.vega', path: '/' });
    await screen.findByRole('list', AVAILABLE_LIST);
    await user.selectOptions(within(context()).getByRole('combobox', { name: 'Sede de trabajo' }), 'Piura');
    const stored = JSON.parse(globalThis.sessionStorage.getItem(MOCK_SESSION_KEY) ?? '{}') as Record<string, unknown>;
    expect(stored).toMatchObject({ currentSite: 'Piura', currentProfileBySystem: { MDM: 'carlos.vega:MDM:PIURA' } });
    await user.click(screen.getByRole('link', { name: /^MDM/ }));
    expect(await screen.findByText('Perfil vigente: Consultor · Piura')).toBeInTheDocument();
  });
});

describe('Paso de la suite a MDM con el rol y la sede de la sesión', () => {
  it('la tarjeta de MDM es un enlace directo, sin selector de sede', async () => {
    const { user } = renderSuite({ user: 'carlos.vega', path: '/' });
    await user.click(await screen.findByRole('link', { name: /^MDM/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sistema de prueba' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Perfil vigente: Consultor · Piura')).toBeInTheDocument();
  });

  it('la analista abre MDM desde su tarjeta', async () => {
    const { user } = renderSuite({ user: 'rosa.medina', path: '/' });
    expect(await screen.findByRole('link', { name: /^MDM.*Analista de datos maestros · Callao/ })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /^MDM/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sistema de prueba' })).toBeInTheDocument();
    expect(screen.getByText('Perfil vigente: Analista de datos maestros · Callao')).toBeInTheDocument();
  });
});
