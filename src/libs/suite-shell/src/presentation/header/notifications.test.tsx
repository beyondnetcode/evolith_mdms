import type { Notification, SuiteGateway } from '@suite/contracts';
import { act, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WIDTHS } from '@sil/ui/testing';
import { renderSuite } from '../../testing/suite-harness.tsx';

/** Región en vivo de las notificaciones: la única con rol `status` y sin botones. */
function liveRegion(): HTMLElement {
  const region = screen.getAllByRole('status').find((r) => r.classList.contains('sr-only') && r.getAttribute('aria-atomic') === 'true');
  if (region === undefined) throw new Error('Falta la región en vivo de las notificaciones');
  return region;
}

/** «Hoy» es el 15/10/2026 a las 12:00 de Lima: las fechas de los grupos son las de siempre. */
function fixClock(): void {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-15T12:00:00-05:00'));
}
const ANA_GROUPS = ['Hoy', 'Ayer', '13/10/2026', '09/10/2026'];

describe('campana de la cabecera (anexo A1 §10.3)', () => {
  beforeEach(fixClock);

  it('lleva la cuenta en su nombre accesible y la insignia visual es decorativa', async () => {
    renderSuite({ path: '/', user: 'ana.perez' });
    const button = await screen.findByRole('button', { name: 'Notificaciones, 3 sin leer' });
    const badge = screen.getByText('3');
    expect(badge).toHaveAttribute('aria-hidden', 'true');
    expect(badge.parentElement?.contains(button)).toBe(true);
  });

  it('está siempre presente: sin notificaciones dice «ninguna sin leer» y no dibuja insignia', async () => {
    renderSuite({ path: '/', user: 'diego.salas' });
    const button = await screen.findByRole('button', { name: 'Notificaciones, ninguna sin leer' });
    expect(button.parentElement?.parentElement?.textContent).toBe('');
  });

  it('«99+» desde 100', async () => {
    const many = (base: SuiteGateway): SuiteGateway => ({ ...base, countUnread: () => Promise.resolve({ unread: 100 }) });
    renderSuite({ path: '/', user: 'ana.perez', decorateSuiteGateway: many });
    expect(await screen.findByText('99+')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notificaciones, 100 sin leer' })).toBeInTheDocument();
  });

  // UI-14: sin cifra o con la cuenta aún desconocida, un punto de 6 dp; con cifra, la insignia con tope «99+».
  it('con la cuenta aún desconocida dibuja un punto de 6 dp, decorativo, y el nombre sigue siendo «Notificaciones»', async () => {
    const pending = (base: SuiteGateway): SuiteGateway => ({ ...base, countUnread: () => new Promise(() => undefined) });
    renderSuite({ path: '/', user: 'ana.perez', decorateSuiteGateway: pending });
    const button = await screen.findByRole('button', { name: 'Notificaciones' });
    const dot = button.parentElement?.parentElement?.querySelector('span[aria-hidden="true"]');
    expect(dot).toHaveClass('size-1.5', 'rounded-full', 'bg-error');
    expect(dot?.textContent).toBe('');
  });

  it('sin SIL (Diego) no se revela SIL: no hay notificaciones ni apoyo con perfil', async () => {
    const { user } = renderSuite({ path: '/', user: 'diego.salas' });
    await user.click(await screen.findByRole('button', { name: /^Notificaciones/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Notificaciones' });
    expect(await within(sheet).findByText('No tienes notificaciones.')).toBeInTheDocument();
    expect(within(sheet).getByText('Aquí aparecerán los avisos de SIL cuando lleguen.')).toBeInTheDocument();
  });
});

describe('elemento de tres líneas (R-26 del anexo A1 §12)', () => {
  beforeEach(fixClock);

  it('lleva sobretítulo con el tipo, encabezado con el identificador SIN truncar, apoyo de dos líneas y la hora', async () => {
    renderSuite({ path: '/notificaciones', user: 'ana.perez' });
    await screen.findByRole('heading', { level: 1, name: 'Notificaciones' });
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    const first = screen.getAllByRole('listitem')[0]!;
    const link = within(first).getByRole('link');
    const lines = [...link.querySelectorAll(':scope > span.flex > span')];
    // Sobretítulo (tipo), encabezado (identificador) y apoyo.
    expect(lines.map((line) => line.className)).toEqual([
      expect.stringContaining('text-label-medium'),
      expect.stringContaining('tabular-nums'),
      expect.stringContaining('line-clamp-2'),
    ]);
    expect(lines[0]?.textContent).toMatch(/Entrega fallida|Solicitud observada|Crédito habilitado|Orden emitida|Crédito en Rojo|Nueva versión de la orden/);
    expect(lines[1]?.querySelector('[aria-hidden="true"]')?.textContent).toMatch(/^OP-CAL-26-\d{6}$/);
    expect(lines[1]?.className).not.toContain('truncate');
    expect(link.querySelector('time')).not.toBeNull();
    // El nombre accesible conserva el título completo de siempre.
    expect(link).toHaveAccessibleName(/(Solicitud|Crédito|Nueva versión|Orden|Entrega)/);
  });
});

describe('pantalla completa (/notificaciones)', () => {
  beforeEach(fixClock);

  async function open(options: Parameters<typeof renderSuite>[0] = { path: '/notificaciones', user: 'ana.perez' }) {
    const app = renderSuite(options);
    const title = await screen.findByRole('heading', { level: 1, name: 'Notificaciones' });
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    return { ...app, title };
  }

  it('título, apoyo con el perfil, grupos por fecha con h2, pie y botón «Marcar todas» (solo con no leídas)', async () => {
    await open();
    expect(screen.getByText('Avisos de SIL para tu perfil: Customer Service · Callao. Las horas son de Lima (UTC-5).')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(ANA_GROUPS);
    expect(screen.getByText('Se muestran las notificaciones de los últimos 90 días.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar todas como leídas' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Marcar como leída: / })[0]).toHaveTextContent('Marcar como leída');
  });

  it('«No leídas» filtra en la dirección y «Quitar filtros» la limpia; «Tipo» solo ofrece los tipos del rol', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'No leídas' }));
    expect(screen.getByRole('button', { name: 'No leídas' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3));
    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(8));
    await user.click(screen.getByRole('button', { name: 'Tipo' }));
    const types = screen.getAllByRole('checkbox').map((c) => c.closest('label')?.textContent);
    expect(types).toHaveLength(6);
  });

  it('el filtro de tipo de un rol solo ofrece sus tipos (Jefatura: dos)', async () => {
    const { user } = await open({ path: '/notificaciones', user: 'carlos.vega' });
    await user.click(screen.getByRole('button', { name: 'Tipo' }));
    expect(screen.getAllByRole('checkbox').map((c) => c.closest('label')?.textContent)).toEqual(['Solicitud observada', 'Crédito en Rojo']);
  });

  it('un filtro que no coincide dice por qué y ofrece quitarlo; «No leídas» sin pendientes ofrece «Ver todas»', async () => {
    const { user } = await open({ path: '/notificaciones?tipo=CREDITO_VERDE&noLeidas=1', user: 'luis.rojas' });
    // El crédito en Verde de Luis ya está leído: con «No leídas» no hay coincidencias.
    expect(await screen.findByText('Ninguna notificación coincide con los filtros.')).toBeInTheDocument();
    // «Quitar filtros» está en la barra de filtros y en el estado vacío (anexo A1 §10.5).
    await user.click(screen.getAllByRole('button', { name: 'Quitar filtros' })[1]!);
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(5));
    await user.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }));
    await user.click(await screen.findByRole('button', { name: 'No leídas' }));
    expect(await screen.findByText('No tienes notificaciones sin leer.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver todas' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(5));
  });

  it('un valor desconocido en la dirección se descarta', async () => {
    await open({ path: '/notificaciones?tipo=TAREA,ENTREGA_FALLIDA&noLeidas=2', user: 'ana.perez' });
    expect(screen.getByRole('button', { name: 'No leídas' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /^Tipo: Entrega fallida/ })).toBeInTheDocument();
  });

  it('en compact: barra con «Volver», título y «Más» con «Marcar todas»; el botón por fila baja a su línea', async () => {
    const { user } = await open({ path: '/notificaciones', user: 'ana.perez', width: WIDTHS.compact });
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar todas como leídas' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Más' }));
    await user.click(screen.getByRole('menuitem', { name: 'Marcar todas como leídas' }));
    expect(await screen.findByText('Marcaste 3 notificaciones como leídas.')).toBeInTheDocument();
    // El menú «Más» desaparece (no hay no leídas) y el foco pasa al título.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Notificaciones' })).toHaveFocus());
    expect(screen.queryByRole('button', { name: 'Más' })).not.toBeInTheDocument();
  });

  it('«Cargar anteriores»: 20 por página, foco en la primera fila nueva y la región en vivo lo dice', async () => {
    const generate = (n: number): Notification[] =>
      Array.from({ length: n }, (_, i) => ({
        version: 1,
        id: `nt-x-${String(i).padStart(2, '0')}`,
        system: 'SIL',
        type: 'CREDITO_VERDE',
        severity: 'EXITO',
        createdAt: new Date(Date.now() - i * 3_600_000).toISOString(),
        read: true,
        params: { operationId: 'OP-CAL-26-000405' },
        destination: { screen: 'P-04', operationId: 'OP-CAL-26-000405' },
      }));
    const list = generate(45);
    const decorate = (base: SuiteGateway): SuiteGateway => ({
      ...base,
      listNotifications: (_session, filter = {}) => {
        const limit = filter.limit ?? 20;
        const home = filter.cursor === undefined ? 0 : list.findIndex((n) => n.id === filter.cursor) + 1;
        const items = list.slice(home, home + limit);
        return Promise.resolve({ items, nextCursor: home + limit < list.length ? (items.at(-1)?.id ?? null) : null, unread: 0 });
      },
    });
    const { user } = renderSuite({ path: '/notificaciones', user: 'ana.perez', decorateSuiteGateway: decorate });
    await screen.findByRole('heading', { level: 1, name: 'Notificaciones' });
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Crédito habilitado/ })).toHaveLength(20));
    await user.click(screen.getByRole('button', { name: 'Cargar anteriores' }));
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Crédito habilitado/ })).toHaveLength(40));
    await waitFor(() => expect(liveRegion()).toHaveTextContent('Se cargaron 20 notificaciones más'));
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Crédito habilitado/ })[20]).toHaveFocus());
  });
});

describe('llegadas con la lista abierta (?sim=notif-nueva)', () => {
  beforeEach(fixClock);

  it('la región en vivo anuncia la llegada una sola vez, la insignia sube y la lista no se mueve: «Mostrar 1 nueva»', async () => {
    const now = vi.mocked(Date.now);
    const { user } = renderSuite({
      path: '/notificaciones',
      user: 'ana.perez',
      settings: { suite: { umsDown: false, maintenance: false, expires: false, notifications: 'nueva' } },
    });
    await screen.findByRole('heading', { level: 2, name: 'Hoy' });
    const linksBefore = screen.getAllByRole('link').length;
    // La carga inicial no se anuncia: la cuenta ya está en el nombre de la campana.
    expect(liveRegion().textContent).toBe('');
    // Pasan 15 s y la pestaña recupera el foco: se vuelve a consultar.
    now.mockReturnValue(Date.parse('2026-10-15T12:00:16-05:00'));
    act(() => {
      window.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(liveRegion()).toHaveTextContent('Tienes una notificación nueva: Entrega fallida: contenedor'));
    expect(await screen.findByRole('button', { name: 'Notificaciones, 4 sin leer' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(linksBefore);
    await user.click(await screen.findByRole('button', { name: 'Mostrar 1 nueva' }));
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(linksBefore + 1));
    expect(screen.queryByRole('button', { name: /^Mostrar / })).not.toBeInTheDocument();
  });
});
