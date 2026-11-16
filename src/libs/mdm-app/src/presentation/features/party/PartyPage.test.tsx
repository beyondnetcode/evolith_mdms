import { MdmProblemError, type MdmGateway, type MdmProblem } from '@mdm/contracts';
import { MdmMockStore, ORG_PARTY_ID } from '@mdm/mock';
import { WIDTHS } from '@sil/ui/testing';
import { screen, waitFor, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { installDialogPolyfill } from '../../../testing/dialog-polyfill.ts';
import { renderMdm, type MdmRenderOptions } from '../../../testing/mdm-harness.tsx';
import { overrideGateway } from '../../../testing/override-gateway.ts';

let polyfill: ReturnType<typeof installDialogPolyfill>;
beforeAll(() => {
  polyfill = installDialogPolyfill();
});
afterAll(() => {
  polyfill.uninstall();
});

function idOf(store: MdmMockStore, code: string): string {
  const party = [...store.parties.values()].find((item) => item.code === code);
  if (party === undefined) throw new Error(`No existe ${code} en la semilla`);
  return party.id;
}

/** Abre la ficha de `code` y espera a que cargue. */
async function openParty(code: string, options: Omit<MdmRenderOptions, 'path' | 'store'> = {}) {
  const store = new MdmMockStore();
  const rendered = renderMdm({ ...options, store, path: `/mdm/organizaciones/${idOf(store, code)}` });
  expect(await screen.findByRole('heading', { level: 1, name: code })).toBeInTheDocument();
  return { ...rendered, partyId: idOf(store, code) };
}

async function openAction(user: ReturnType<typeof renderMdm>['user'], name: string) {
  await user.click(screen.getByRole('button', { name: 'Acciones' }));
  await user.click(screen.getByRole('menuitem', { name }));
}

function forbidden(): MdmProblemError {
  const problem: MdmProblem = { title: 'Prohibido', detail: null, instance: 'prueba-0403', errors: {}, status: 403, code: 'auth.forbidden' };
  return new MdmProblemError(problem, 'prueba-0403');
}

describe('P-MDM-02 Ficha (US-MDM-002)', () => {
  it('muestra cabecera, estado con texto y las siete secciones (SU-MDM-09)', async () => {
    await openParty('ACME', { role: 'CONSULTOR' });
    expect(document.title).toBe('ACME · MDM · Suite');
    expect(screen.getAllByText('ACME PERÚ S.A.C.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Activa').length).toBeGreaterThan(0);
    expect(screen.getByText('PE-RUC 20601234565')).toBeInTheDocument();
    const tabs = within(screen.getByRole('tablist', { name: 'Secciones de la organización' })).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Datos generales',
      'Identificadores (1)',
      'Roles (2)',
      'Establecimientos (0)',
      'Relaciones',
      'Referencias externas',
      'Historial',
    ]);
    const panel = screen.getByRole('tabpanel', { name: 'Datos generales' });
    expect(within(panel).getByText('Razón social')).toBeInTheDocument();
    // El consultor solo lee: no hay menú de acciones.
    expect(screen.queryByRole('button', { name: 'Acciones' })).not.toBeInTheDocument();
  });

  it('Identificadores: tabla con estado y primario, sin editar ni borrar; las flechas cambian de pestaña', async () => {
    const { user } = await openParty('ORG', { role: 'RESPONSABLE_MDM' });
    await user.click(screen.getByRole('tab', { name: 'Datos generales' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Identificadores (1)' })).toHaveAttribute('aria-selected', 'true');
    const table = screen.getByRole('table', { name: 'Identificadores de ORG' });
    const row = within(table).getAllByRole('row')[1];
    if (row === undefined) throw new Error('Sin filas');
    expect(within(row).getByText('20100412447')).toBeInTheDocument();
    expect(within(row).getByText('Vigente')).toBeInTheDocument();
    expect(within(row).getByText('Primario')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Más acciones del identificador PE-RUC 20100412447' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Vencer']);
  });

  it('archivada: solo lectura total, con su aviso y sin acciones (INV-PTY-11)', async () => {
    const { user } = await openParty('IMPORTADORA-ORIENTE', { role: 'RESPONSABLE_MDM' });
    expect(screen.getByText(/^Organización archivada el \d{2}\/\d{2}\/\d{4}\. Se muestra en solo lectura\.$/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acciones' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Identificadores/ }));
    expect(screen.queryByRole('button', { name: 'Agregar identificador' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Más acciones del identificador/ })).not.toBeInTheDocument();
  });

  it('acciones según rol (matriz supuesta): el analista solo edita nombres; el responsable también suspende y archiva', async () => {
    const { user, unmount } = await openParty('ACME', { role: 'ANALISTA_DATOS_MAESTROS' });
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Editar nombres']);
    unmount();
    const owner = await openParty('ACME', { role: 'RESPONSABLE_MDM' });
    await owner.user.click(screen.getByRole('button', { name: 'Acciones' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Editar nombres', 'Suspender', 'Archivar']);
  });

  it('suspendida: aviso con «Activar»; activar es de un clic y confirma con snackbar', async () => {
    const { user } = await openParty('TRANSLIM', { role: 'RESPONSABLE_MDM' });
    expect(screen.getByText('Organización suspendida.')).toBeInTheDocument();
    expect(screen.getByText('No se pueden asignar ni reactivar roles, ni abrir ni reactivar establecimientos.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Activar' }));
    expect(await screen.findByText('TRANSLIM activada.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Organización suspendida.')).not.toBeInTheDocument());
  });
});

describe('D-MDM-01 Editar nombres (US-MDM-004)', () => {
  it('guarda los nombres con la versión cargada, avisa y devuelve el foco a «Acciones»', async () => {
    const rename = vi.fn<(version: number) => void>();
    const decorateGateway = (base: MdmGateway) =>
      overrideGateway(base, {
        renameParty: (partyId, request, ifMatch) => {
          rename(ifMatch);
          return base.renameParty(partyId, request, ifMatch);
        },
      });
    const { user, store, partyId } = await openParty('ACME', { decorateGateway });
    const version = store.parties.get(partyId)?.version;
    await openAction(user, 'Editar nombres');
    const dialog = screen.getByRole('dialog', { name: 'Editar nombres' });
    const legalName = within(dialog).getByRole('textbox', { name: 'Razón social (obligatorio)' });
    expect(legalName).toHaveFocus();
    // Código, tipo e identificadores a la vista, no editables.
    expect(within(dialog).getByText('PE-RUC 20601234565')).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox', { name: /Código/ })).not.toBeInTheDocument();
    const tradeName = within(dialog).getByRole('textbox', { name: 'Nombre comercial' });
    await user.clear(tradeName);
    await user.type(tradeName, 'Acme Perú');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Nombres actualizados.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Editar nombres' })).not.toBeInTheDocument();
    expect(rename).toHaveBeenCalledWith(version);
    expect(await screen.findByText('· Acme Perú')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Acciones' })).toHaveFocus());
  });

  it('valida la razón social: resumen enfocado y error en el campo, sin enviar', async () => {
    const { user } = await openParty('ACME');
    await openAction(user, 'Editar nombres');
    const dialog = screen.getByRole('dialog', { name: 'Editar nombres' });
    await user.clear(within(dialog).getByRole('textbox', { name: 'Razón social (obligatorio)' }));
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(await within(dialog).findByRole('link', { name: 'Escribe la razón social.' })).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Razón social (obligatorio)' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('accesibilidad: Escape sin cambios cierra y devuelve el foco; con cambios pide confirmación y no cierra', async () => {
    const { user } = await openParty('ACME');
    await openAction(user, 'Editar nombres');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Editar nombres' })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Acciones' })).toHaveFocus());

    await openAction(user, 'Editar nombres');
    const dialog = screen.getByRole('dialog', { name: 'Editar nombres' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nombre comercial' }), ' y más');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Editar nombres' })).toBeInTheDocument();
    expect(within(dialog).getByText('¿Descartar los cambios sin guardar?')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Seguir editando' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Acciones' })).toHaveFocus());
  });

  it('403 del servidor: el diálogo no se cierra y explica que no hay permiso', async () => {
    const decorateGateway = (base: MdmGateway) => overrideGateway(base, { renameParty: () => Promise.reject(forbidden()) });
    const { user } = await openParty('ACME', { decorateGateway });
    await openAction(user, 'Editar nombres');
    const dialog = screen.getByRole('dialog', { name: 'Editar nombres' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nombre comercial' }), 'X');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No tienes permiso para esta acción.');
  });
});

describe('Concurrencia (US-MDM-013, D-MDM-14)', () => {
  it('ante 412 conserva el borrador, recarga con el valor actual a la vista y guarda sobre la versión nueva', async () => {
    const { user, store, partyId } = await openParty('ACME');
    await openAction(user, 'Editar nombres');
    const dialog = screen.getByRole('dialog', { name: 'Editar nombres' });
    // Otra persona cambia la organización mientras se edita.
    store.simulateConcurrentEdit(partyId, { tradeName: 'Acme Corp' });
    const tradeName = within(dialog).getByRole('textbox', { name: 'Nombre comercial' });
    await user.clear(tradeName);
    await user.type(tradeName, 'Acme Mío');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Otra persona cambió esta organización mientras editabas. Tus cambios siguen aquí.');
    expect(tradeName).toHaveValue('Acme Mío');
    expect(store.parties.get(partyId)?.tradeName).toBe('Acme Corp');

    await user.click(within(alert).getByRole('button', { name: 'Recargar y revisar' }));
    await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument());
    expect(tradeName).toHaveValue('Acme Mío');
    expect(tradeName).toHaveAccessibleDescription('Valor actual: Acme Corp');

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Nombres actualizados.')).toBeInTheDocument();
    expect(store.parties.get(partyId)?.tradeName).toBe('Acme Mío');
  });

  it('«Descartar mis cambios» recarga y deja el formulario con los datos nuevos', async () => {
    const { user, store, partyId } = await openParty('ACME');
    await openAction(user, 'Editar nombres');
    const dialog = screen.getByRole('dialog', { name: 'Editar nombres' });
    store.simulateConcurrentEdit(partyId, { legalName: 'ACME PERÚ S.A.' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nombre comercial' }), ' 2');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Descartar mis cambios' }));
    await waitFor(() => expect(within(dialog).getByRole('textbox', { name: 'Razón social (obligatorio)' })).toHaveValue('ACME PERÚ S.A.'));
    expect(within(dialog).getByRole('textbox', { name: 'Nombre comercial' })).toHaveValue('Acme');
  });

  it('la versión es la de toda la organización: un cambio en otra parte también da 412 al suspender', async () => {
    const { user, store, partyId } = await openParty('ACME', { role: 'RESPONSABLE_MDM' });
    await openAction(user, 'Suspender');
    const dialog = screen.getByRole('dialog', { name: '¿Suspender ACME?' });
    store.simulateConcurrentEdit(partyId);
    await user.click(within(dialog).getByRole('button', { name: 'Suspender' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Otra persona cambió esta organización mientras editabas.');
    await user.click(within(alert).getByRole('button', { name: 'Recargar y revisar' }));
    await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument());
    await user.click(within(dialog).getByRole('button', { name: 'Suspender' }));
    expect(await screen.findByText('Organización suspendida.')).toBeInTheDocument();
  });
});

describe('D-MDM-13 Suspender y D-MDM-08 Archivar (US-MDM-005)', () => {
  it('suspender: foco inicial en «Cancelar», Escape cierra y devuelve el foco; confirmar suspende', async () => {
    const { user } = await openParty('ACME', { role: 'RESPONSABLE_MDM' });
    await openAction(user, 'Suspender');
    const dialog = screen.getByRole('dialog', { name: '¿Suspender ACME?' });
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(within(dialog).getByText(/Podrás activarla de nuevo\./)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Acciones' })).toHaveFocus());

    await openAction(user, 'Suspender');
    await user.click(within(screen.getByRole('dialog', { name: '¿Suspender ACME?' })).getByRole('button', { name: 'Suspender' }));
    expect(await screen.findByText('Organización suspendida.')).toBeInTheDocument();
    expect(screen.getAllByText('Suspendida').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Editar nombres', 'Activar', 'Archivar']);
  });

  it('archivar: confirmación terminal que dice lo que no termina; queda en solo lectura', async () => {
    const { user } = await openParty('ORG', { role: 'RESPONSABLE_MDM' });
    await openAction(user, 'Archivar');
    const dialog = screen.getByRole('dialog', { name: '¿Archivar ORG?' });
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(dialog).toHaveTextContent(
      'La organización quedará en solo lectura y no se podrá reactivar. Sus 1 roles vigentes y 2 establecimientos activos no se terminan ni se cierran.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Archivar' }));
    expect(await screen.findByText('ORG archivada.')).toBeInTheDocument();
    expect(await screen.findByText(/Se muestra en solo lectura\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acciones' })).not.toBeInTheDocument();
  });
});

describe('Identificadores: D-MDM-02 agregar y D-MDM-03 vencer (US-MDM-006)', () => {
  async function openIdentifiers(code: string, options: Omit<MdmRenderOptions, 'path' | 'store'> = {}) {
    const rendered = await openParty(code, options);
    await rendered.user.click(screen.getByRole('tab', { name: /Identificadores/ }));
    return rendered;
  }

  it('agrega un identificador no primario: foco en el primer campo y snackbar', async () => {
    const { user } = await openIdentifiers('ACME');
    await user.click(screen.getByRole('button', { name: 'Agregar identificador' }));
    const dialog = screen.getByRole('dialog', { name: 'Agregar identificador' });
    await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'País (obligatorio)' })).toHaveFocus());
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Esquema (obligatorio)' }), 'Partida registral (SUNARP) (PE-PARTIDA)');
    await user.type(within(dialog).getByRole('textbox', { name: 'Valor (obligatorio)' }), '12345678');
    await user.click(within(dialog).getByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText('Identificador agregado.')).toBeInTheDocument();
    expect(await screen.findByText('12345678')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Agregar identificador' })).toHaveFocus());
  });

  it('valida el RUC antes de enviar y pinta el duplicado del servidor (409) en el campo valor', async () => {
    const { user } = await openIdentifiers('ACME');
    await user.click(screen.getByRole('button', { name: 'Agregar identificador' }));
    const dialog = screen.getByRole('dialog', { name: 'Agregar identificador' });
    const value = within(dialog).getByRole('textbox', { name: 'Valor (obligatorio)' });
    await user.type(value, '20601234568');
    await user.click(within(dialog).getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(value).toHaveAccessibleDescription('El RUC no es válido: revisa el último dígito.'));
    await user.clear(value);
    await user.type(value, '20512345671');
    await user.click(within(dialog).getByRole('button', { name: 'Agregar' }));
    await waitFor(() =>
      expect(value).toHaveAccessibleDescription('Este identificador ya pertenece a otra organización: TRANSLIM · TRANSPORTES LIMA S.A. (suspendida).'),
    );
  });

  it('primario sin reemplazo: 409 propone marcar «Reemplaza al primario actual»; con él, el anterior vence el día previo', async () => {
    const { user, store, partyId } = await openIdentifiers('ACME');
    await user.click(screen.getByRole('button', { name: 'Agregar identificador' }));
    const dialog = screen.getByRole('dialog', { name: 'Agregar identificador' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Valor (obligatorio)' }), '20101010105');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Es primario' }));
    const replace = within(dialog).getByRole('checkbox', { name: 'Reemplaza al primario actual' });
    expect(replace).toHaveAccessibleDescription(/El primario vigente es PE-RUC 20601234565\./);
    await user.click(within(dialog).getByRole('button', { name: 'Agregar' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('checkbox', { name: 'Es primario' })).toHaveAccessibleDescription(
        'Ya hay un identificador primario vigente (PE-RUC 20601234565). Marca «Reemplaza al primario actual» o desmarca «Es primario».',
      ),
    );
    await user.click(replace);
    await user.click(within(dialog).getByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText(/^Identificador agregado\. El anterior quedó vencido el \d{2}\/\d{2}\/\d{4}\.$/)).toBeInTheDocument();
    const primary = store.parties.get(partyId)?.identifiers.find((identifier) => identifier.value === '20601234565');
    expect(primary?.validTo).not.toBeNull();
  });

  it('vencer: el primario sin sucesor es 409 en el aviso; otro identificador vence con fecha y motivo', async () => {
    const store = new MdmMockStore();
    store.parties.get(ORG_PARTY_ID)?.identifiers.push({
      identifierId: 'c0000000-0000-4000-8000-000000000099',
      countryCode: 'PE',
      schemeCode: 'PE-PARTIDA',
      value: '11223344',
      isPrimary: false,
      validFrom: '2020-01-01',
      validTo: null,
    });
    const { user } = renderMdm({ store, role: 'RESPONSABLE_MDM', path: `/mdm/organizaciones/${ORG_PARTY_ID}?seccion=identificadores` });
    await screen.findByRole('heading', { level: 1, name: 'ORG' });

    await user.click(screen.getByRole('button', { name: 'Más acciones del identificador PE-RUC 20100412447' }));
    await user.click(screen.getByRole('menuitem', { name: 'Vencer' }));
    let dialog = screen.getByRole('dialog', { name: '¿Vencer el identificador PE-RUC 20100412447?' });
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Vencer' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No puedes vencer el identificador primario sin otro que lo reemplace.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Más acciones del identificador PE-RUC 20100412447' })).toHaveFocus());

    await user.click(screen.getByRole('button', { name: 'Más acciones del identificador PE-PARTIDA 11223344' }));
    await user.click(screen.getByRole('menuitem', { name: 'Vencer' }));
    dialog = screen.getByRole('dialog', { name: '¿Vencer el identificador PE-PARTIDA 11223344?' });
    const date = within(dialog).getByRole('textbox', { name: 'Vence el' });
    await user.clear(date);
    await user.type(date, '01012019');
    await user.click(within(dialog).getByRole('button', { name: 'Vencer' }));
    expect(date).toHaveAccessibleDescription('La fecha de vencimiento no puede ser anterior al 01/01/2020.');
    await user.clear(date);
    await user.type(date, '31122025');
    await user.type(within(dialog).getByRole('textbox', { name: 'Motivo (opcional)' }), 'Partida reemplazada');
    await user.click(within(dialog).getByRole('button', { name: 'Vencer' }));
    expect(await screen.findByText('Identificador vencido.')).toBeInTheDocument();
    // Vencido, se oculta; el foco va al encabezado de la sección porque su fila ya no está.
    await waitFor(() => expect(screen.queryByText('11223344')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Identificadores de ORG' })).toHaveFocus());
    await user.click(screen.getByRole('switch', { name: 'Mostrar vencidos' }));
    expect(screen.getByText('Vencido el 31/12/2025')).toBeInTheDocument();
  });

  it('412 al agregar: el valor escrito se conserva y tras recargar se guarda con la versión nueva', async () => {
    const { user, store, partyId } = await openIdentifiers('ACME');
    await user.click(screen.getByRole('button', { name: 'Agregar identificador' }));
    const dialog = screen.getByRole('dialog', { name: 'Agregar identificador' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Esquema (obligatorio)' }), 'Partida registral (SUNARP) (PE-PARTIDA)');
    await user.type(within(dialog).getByRole('textbox', { name: 'Valor (obligatorio)' }), '87654321');
    store.simulateConcurrentEdit(partyId);
    await user.click(within(dialog).getByRole('button', { name: 'Agregar' }));
    const alert = await within(dialog).findByRole('alert');
    expect(within(dialog).getByRole('textbox', { name: 'Valor (obligatorio)' })).toHaveValue('87654321');
    expect(within(dialog).getByRole('combobox', { name: 'Esquema (obligatorio)' })).toHaveValue('PE-PARTIDA');
    await user.click(within(alert).getByRole('button', { name: 'Recargar y revisar' }));
    await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument());
    await user.click(within(dialog).getByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText('Identificador agregado.')).toBeInTheDocument();
  });

  it('en compact, tarjetas y formulario a pantalla completa con «Cerrar»', async () => {
    const { user } = await openIdentifiers('ACME', { width: WIDTHS.compact });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('PE-RUC 20601234565', { selector: 'span.text-title-medium' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Agregar identificador' }));
    const dialog = screen.getByRole('dialog', { name: 'Agregar identificador' });
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Agregar identificador' })).not.toBeInTheDocument());
  });
});
