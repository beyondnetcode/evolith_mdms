import type { MdmRole } from '@mdm/contracts';
import { WIDTHS } from '@sil/ui/testing';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderMdm } from '../../testing/mdm-harness.tsx';

function rail(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Navegación de MDM' });
}

describe('Marco de MDM: el mismo riel que SIL (UI-MDM-001 §3.1, G-584)', () => {
  it.each([
    '/mdm/geografia',
    '/mdm/geografia/paises/PE',
    '/mdm/geografia/lugares/90000000-0000-4000-8000-000000000004',
  ])('incluye Geografía en el riel y la marca activa en %s', async (path) => {
    renderMdm({ path });
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(within(rail()).getByRole('link', { name: 'Geografía' })).toHaveAttribute('aria-current', 'page');
  });

  it.each(['/mdm/organizaciones', '/mdm/organizaciones/nueva', '/mdm/organizaciones/00000000-0000-4000-8000-000000000000'])(
    'expanded: riel de 224 dp con «Organizaciones» activo en %s',
    async (path) => {
      renderMdm({ path });
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(rail().parentElement?.className).toContain('w-56');
      expect(within(rail()).getByRole('link', { name: 'Organizaciones' })).toHaveAttribute('aria-current', 'page');
    },
  );

  it('la cabecera es la de la suite: conmutador, marca, «MDM», rol y sede, campana, ayuda y cuenta', async () => {
    renderMdm({ width: WIDTHS.medium });
    await screen.findByText('23 organizaciones');
    const header = screen.getByRole('banner');
    expect(header.className).toContain('bg-surface-container');
    expect(within(header).getByText('MDM')).toBeInTheDocument();
    expect(within(header).getByText('Analista de datos maestros · Analista de datos maestros · Callao')).toBeInTheDocument();
    const order = [...header.querySelectorAll('a, button')].map((control) => control.getAttribute('aria-label') ?? control.textContent);
    expect(order.slice(0, 2)).toEqual(['Ir al portal', 'Suite, inicio']);
    expect(order.at(-2)).toBe('Ayuda');
    expect(order.at(-1)).toMatch(/^Cuenta de /);
  });

  it.each<MdmRole>(['ANALISTA_DATOS_MAESTROS', 'RESPONSABLE_MDM'])('%s: el FAB «Nueva organización» está arriba del riel y es el único', async (role) => {
    renderMdm({ role });
    await screen.findByText('23 organizaciones');
    const fab = within(rail()).getByRole('link', { name: 'Nueva organización' });
    expect(fab).toHaveAttribute('href', '/mdm/organizaciones/nueva');
    expect(screen.getAllByRole('link', { name: 'Nueva organización' })).toEqual([fab]);
  });

  it.each<MdmRole>(['CONSULTOR', 'INTEGRADOR_ERP'])('%s: sin FAB, ni en el riel ni en la pantalla (SU-MDM-02)', async (role) => {
    renderMdm({ role });
    await screen.findByText('23 organizaciones');
    expect(within(rail()).getByRole('link', { name: 'Organizaciones' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nueva organización' })).not.toBeInTheDocument();
  });

  it('medium: riel contraído con el FAB de solo icono', async () => {
    renderMdm({ width: WIDTHS.medium });
    await screen.findByText('23 organizaciones');
    expect(rail().parentElement?.className).toContain('w-24');
    expect(within(rail()).getByRole('link', { name: 'Nueva organización' })).not.toHaveTextContent('Nueva organización');
  });

  it('compact: menú que abre el cajón y el FAB flotante solo en la lista', async () => {
    const { user } = renderMdm({ width: WIDTHS.compact });
    await screen.findByText('23 organizaciones');
    expect(screen.queryByRole('navigation', { name: 'Navegación de MDM' })).not.toBeInTheDocument();
    const fab = screen.getByRole('link', { name: 'Nueva organización' });
    expect(fab.className).toContain('fixed');
    await user.click(fab);
    expect(await screen.findByRole('heading', { level: 1, name: 'Nueva organización' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nueva organización' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Abrir menú de navegación' }));
    expect(within(screen.getByRole('dialog', { name: 'Navegación de MDM' })).getByRole('link', { name: 'Organizaciones' })).toHaveAttribute('aria-current', 'page');
  });
});
