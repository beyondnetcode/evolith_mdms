import type { MdmGateway } from '@mdm/contracts';
import { mockUuid } from '@mdm/mock';
import { WIDTHS } from '@sil/ui/testing';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderMdm } from '../../../testing/mdm-harness.tsx';

/** Códigos de la tabla de resultados, en orden. */
async function resultCodes(): Promise<string[]> {
  const table = await screen.findByRole('table', { name: /^Organizaciones, \d+ resultados?$/ });
  return within(table)
    .getAllByRole('link')
    .map((link) => link.textContent);
}

function rowOf(code: string): HTMLElement {
  const row = screen.getByRole('link', { name: code }).closest('tr');
  if (row === null) throw new Error(`Sin fila para ${code}`);
  return row;
}

describe('P-MDM-01 Organizaciones', () => {
  it('lista las organizaciones por código, de 20 en 20, con su estado en texto y el código como enlace a la ficha', async () => {
    renderMdm();
    expect(screen.getByRole('heading', { level: 1, name: 'Organizaciones' })).toBeInTheDocument();
    expect(await screen.findByText('23 organizaciones')).toBeInTheDocument();
    const codes = await resultCodes();
    expect(codes).toHaveLength(20);
    expect(codes[0]).toBe('ACME');
    expect(codes).not.toContain('IMPORTADORA-ORIENTE');
    expect(within(rowOf('ACME')).getByText('Activa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ACME' })).toHaveAttribute('href', expect.stringMatching(/^\/mdm\/organizaciones\/[0-9a-f-]{36}$/));
    expect(screen.getByRole('columnheader', { name: /Código/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(document.title).toBe('Organizaciones · MDM · Suite');
  });

  it('busca por texto al pulsar Intro y muestra la suspendida con su etiqueta', async () => {
    const { user } = renderMdm();
    await screen.findByText('23 organizaciones');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar por código, razón social o nombre comercial' }), 'translima{Enter}');
    expect(await screen.findByText('1 organización')).toBeInTheDocument();
    expect(await resultCodes()).toEqual(['TRANSLIM']);
    expect(within(rowOf('TRANSLIM')).getByText('Suspendida')).toBeInTheDocument();
  });

  it('filtra por rol vigente: un rol vencido no cuenta', async () => {
    const { user } = renderMdm();
    await screen.findByText('23 organizaciones');
    const roleFilter = screen.getByLabelText('Rol vigente');
    await within(roleFilter).findByRole('option', { name: 'Transportista' });
    await user.selectOptions(roleFilter, 'Transportista');
    expect(await screen.findByText('4 organizaciones')).toBeInTheDocument();
    expect(await resultCodes()).toEqual(['CARGA-SUR', 'COURIER-RAPIDO', 'TRANSLIM', 'TRANSPORTES-ANDINOS']);
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument();
  });

  it('filtra por estado: las archivadas solo aparecen si se piden', async () => {
    const { user } = renderMdm();
    await screen.findByText('23 organizaciones');
    await user.selectOptions(screen.getByLabelText('Estado'), 'Archivada');
    expect(await screen.findByText('1 organización')).toBeInTheDocument();
    expect(await resultCodes()).toEqual(['IMPORTADORA-ORIENTE']);
    expect(within(rowOf('IMPORTADORA-ORIENTE')).getByText('Archivada')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(await screen.findByText('23 organizaciones')).toBeInTheDocument();
  });

  it('la búsqueda por identificador incompleta no se envía y dice qué falta; completa encuentra también la archivada', async () => {
    const calls = vi.fn();
    const decorateGateway = (base: MdmGateway): MdmGateway => ({
      ...base,
      listParties: (query, options) => {
        calls(query);
        return base.listParties(query, options);
      },
    });
    const { user } = renderMdm({ decorateGateway });
    await screen.findByText('23 organizaciones');
    const toggle = screen.getByRole('button', { name: 'Buscar por identificador' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const before = calls.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    const value = screen.getByRole('textbox', { name: 'Valor' });
    expect(value).toHaveAttribute('aria-invalid', 'true');
    expect(value).toHaveAccessibleDescription('Indica también el valor para buscar por identificador.');
    expect(value).toHaveFocus();
    expect(calls.mock.calls.length).toBe(before);
    await user.type(value, '20471471471');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await resultCodes()).toEqual(['IMPORTADORA-ORIENTE']);
    expect(calls).toHaveBeenLastCalledWith(expect.objectContaining({ identifier: { countryCode: 'PE', schemeCode: 'PE-RUC', value: '20471471471' } }));
  });

  it('vacío por texto: lo dice con el texto buscado y ofrece buscar por identificador', async () => {
    const { user } = renderMdm({ path: '/mdm/organizaciones?q=zzz' });
    expect(await screen.findByText('Ninguna organización coincide con «zzz».')).toBeInTheDocument();
    expect(screen.getByText('Prueba con el identificador: es la búsqueda más segura.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const [toggle, emptyAction] = screen.getAllByRole('button', { name: 'Buscar por identificador' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    if (emptyAction === undefined) throw new Error('El vacío ofrece buscar por identificador');
    await user.click(emptyAction);
    expect(screen.getByRole('textbox', { name: 'Valor' })).toBeInTheDocument();
  });

  it('vacío por identificador: lleva el identificador al alta (WCAG 3.3.7)', async () => {
    renderMdm({ path: '/mdm/organizaciones?pais=PE&esquema=PE-RUC&valor=20101010105' });
    expect(await screen.findByText('No hay ninguna organización con PE-RUC 20101010105, ni vigente ni vencido.')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Nueva organización' });
    expect(links.map((link) => link.getAttribute('href'))).toContain('/mdm/organizaciones/nueva?pais=PE&esquema=PE-RUC&valor=20101010105');
  });

  it('vacío inicial: el maestro sin organizaciones', async () => {
    renderMdm({ settings: { mode: 'vacio' } });
    expect(await screen.findByText('Aún no hay organizaciones registradas.')).toBeInTheDocument();
    expect(screen.getByText('0 organizaciones')).toBeInTheDocument();
  });

  it('error: aviso con «Reintentar» y nunca una lista parcial', async () => {
    renderMdm({ settings: { mode: 'error' } });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar las organizaciones.');
    expect(within(alert).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('una respuesta fuera de contrato falla cerrado: se muestra el error, no datos a medias', async () => {
    const decorateGateway = (base: MdmGateway): MdmGateway => ({
      ...base,
      listParties: async (query, options) => {
        const page = await base.listParties(query, options);
        // Aserción justificada: la prueba rompe a propósito el contrato de la respuesta.
        return { ...page, items: [{ ...page.items[0], status: 'Borrada' }] } as unknown as typeof page;
      },
    });
    renderMdm({ decorateGateway });
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar las organizaciones.');
    expect(screen.queryByRole('link', { name: 'ACME' })).not.toBeInTheDocument();
  });

  it('ordena por código descendente y pagina', async () => {
    const { user } = renderMdm();
    await screen.findByText('23 organizaciones');
    await user.click(screen.getByRole('button', { name: /^Código/ }));
    await waitFor(() => expect(screen.getByRole('columnheader', { name: /Código/ })).toHaveAttribute('aria-sort', 'descending'));
    expect((await resultCodes())[0]).toBe('TRANSPORTES-ANDINOS');
    await user.click(screen.getByRole('button', { name: /^Código/ }));
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await waitFor(async () => expect(await resultCodes()).toEqual(['TEXTILES-INCA', 'TRANSLIM', 'TRANSPORTES-ANDINOS']));
    expect(screen.getByText('21–23 de 23')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
  });

  it('compact: lista de tarjetas con «Cargar más», sin tabla', async () => {
    const { user } = renderMdm({ width: WIDTHS.compact });
    expect(await screen.findByText('23 organizaciones')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const list = screen.getAllByRole('list').find((element) => within(element).queryByRole('link', { name: 'ACME' }) !== null);
    if (list === undefined) throw new Error('Sin lista de organizaciones');
    expect(within(list).getAllByRole('listitem')).toHaveLength(20);
    await user.click(screen.getByRole('button', { name: 'Cargar más' }));
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(23));
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();
  });

  it('la acción «Nueva organización» solo se ofrece a quien puede registrar (supuesto SU-MDM-02)', async () => {
    renderMdm({ role: 'CONSULTOR' });
    await screen.findByText('23 organizaciones');
    expect(screen.queryByRole('link', { name: 'Nueva organización' })).not.toBeInTheDocument();
  });

  it('abre la ficha desde el código y vuelve a la lista', async () => {
    const { user } = renderMdm({ path: '/mdm/organizaciones?q=ORG' });
    await user.click(await screen.findByRole('link', { name: 'ORG' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'ORG' })).toBeInTheDocument();
    expect(screen.getAllByText('ORG S.A.').length).toBeGreaterThan(0);
    expect(screen.getByText('PE-RUC 20100412447')).toBeInTheDocument();
    // El enlace de vuelta de la ficha, no el destino del riel.
    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'Organizaciones' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Organizaciones' })).toBeInTheDocument();
  });
});

describe('P-MDM-02 y rutas de MDM', () => {
  it('una organización inexistente es «no encontrada» con vuelta a Organizaciones', async () => {
    renderMdm({ path: '/mdm/organizaciones/00000000-0000-4000-8000-000000000000' });
    expect(await screen.findByText('No encontramos la organización. Puede que el enlace esté mal.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Organizaciones' })).toHaveAttribute('href', '/mdm/organizaciones');
  });

  it('una organización archivada se lee con su aviso de solo lectura', async () => {
    // IMPORTADORA-ORIENTE: la archivada de los datos de ejemplo.
    renderMdm({ path: `/mdm/organizaciones/${mockUuid('b0000000', 24)}` });
    expect(await screen.findByRole('heading', { level: 1, name: 'IMPORTADORA-ORIENTE' })).toBeInTheDocument();
    expect(screen.getByText(/^Organización archivada el \d{2}\/\d{2}\/\d{4}\. Se muestra en solo lectura\.$/)).toBeInTheDocument();
  });

  it('/mdm lleva a Organizaciones y una dirección desconocida es el 404 de MDM', async () => {
    const first = renderMdm({ path: '/mdm' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Organizaciones' })).toBeInTheDocument();
    first.unmount();
    renderMdm({ path: '/mdm/otra-cosa' });
    expect(await screen.findByText('La dirección que abriste no existe en MDM.')).toBeInTheDocument();
  });
});
