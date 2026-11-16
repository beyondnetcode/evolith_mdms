import type { MdmGateway } from '@mdm/contracts';
import { MdmMockStore, ORG_PARTY_ID } from '@mdm/mock';
import { WIDTHS } from '@sil/ui/testing';
import { screen, waitFor, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { installDialogPolyfill } from '../../../testing/dialog-polyfill.ts';
import { overrideGateway } from '../../../testing/override-gateway.ts';
import { forbiddenError, openPartySection, partyIdOf, type OpenPartyOptions } from '../../../testing/party-fixtures.ts';

let polyfill: ReturnType<typeof installDialogPolyfill>;
beforeAll(() => {
  polyfill = installDialogPolyfill();
});
afterAll(() => {
  polyfill.uninstall();
});

const openEstablishments = (code: string, options: Omit<OpenPartyOptions, 'section'> = {}) => openPartySection(code, { ...options, section: 'establecimientos' });

type User = Awaited<ReturnType<typeof openEstablishments>>['user'];

const ADDRESS = { line1: 'Av. Prueba 1', line2: null, ubigeo: null, department: null, province: null, district: null, postalCode: null, countryCode: 'PE', reference: null };

/** Establecimiento de prueba en el almacén, sin pasar por el «servidor» (no cambia la versión). */
function addEstablishment(store: MdmMockStore, code: string, fields: { readonly id: string; readonly isActive?: boolean; readonly isPrincipal?: boolean }) {
  store.parties.get(partyIdOf(store, code))?.establishments.push({
    id: fields.id,
    code: 'ANEXO',
    kindCode: 'BRANCH',
    name: 'Anexo de prueba',
    taxEstablishmentCode: null,
    isPrincipal: fields.isPrincipal ?? false,
    isActive: fields.isActive ?? true,
    isClosed: false,
    closedAt: null,
    closedBy: null,
    address: ADDRESS,
  });
}

async function openForm(user: User) {
  await user.click(screen.getByRole('button', { name: 'Abrir establecimiento' }));
  const dialog = await screen.findByRole('dialog', { name: 'Abrir establecimiento' });
  await waitFor(() => expect(within(dialog).getByRole('textbox', { name: 'Código (obligatorio)' })).toHaveFocus());
  return dialog;
}

async function fillRequired(user: User, dialog: HTMLElement, code: string) {
  await user.type(within(dialog).getByRole('textbox', { name: 'Código (obligatorio)' }), code);
  await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Tipo (obligatorio)' }), 'Planta');
  await user.type(within(dialog).getByRole('textbox', { name: 'Nombre (obligatorio)' }), 'Planta Lurín');
  await user.type(within(dialog).getByRole('textbox', { name: 'Dirección (obligatorio)' }), 'Av. Industrial 100');
}

async function chooseAction(user: User, code: string, action: string) {
  await user.click(await screen.findByRole('button', { name: `Más acciones del establecimiento ${code}` }));
  await user.click(screen.getByRole('menuitem', { name: action }));
}

describe('Establecimientos: lista-detalle y filtro (US-MDM-009, US-MDM-010)', () => {
  it('en expanded, lista con el elegido marcado y su detalle como región con nombre', async () => {
    const { user } = await openEstablishments('ORG', { role: 'CONSULTOR' });
    const list = await screen.findByRole('list', { name: 'Establecimientos de ORG' });
    const [callao, piura] = within(list).getAllByRole('button');
    expect(callao).toHaveAttribute('aria-current', 'true');
    expect(callao).toHaveTextContent('CALLAO · Sede Callao');
    expect(callao).toHaveTextContent('Sede · 0001');
    let detail = screen.getByRole('region', { name: 'Establecimiento CALLAO' });
    expect(within(detail).getByText('Activo')).toBeInTheDocument();
    expect(within(detail).getByText('Principal')).toBeInTheDocument();
    expect(within(detail).getByText('Av. Néstor Gambetta 0000, Callao, Callao, Callao, PE')).toBeInTheDocument();
    // El consultor solo lee.
    expect(screen.queryByRole('button', { name: 'Abrir establecimiento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Más acciones del establecimiento/ })).not.toBeInTheDocument();

    if (piura === undefined) throw new Error('Sin PIURA');
    await user.click(piura);
    expect(piura).toHaveAttribute('aria-current', 'true');
    detail = screen.getByRole('region', { name: 'Establecimiento PIURA' });
    expect(within(detail).getByText('0002')).toBeInTheDocument();
  });

  it('pestañas secundarias: activos por defecto, inactivos vacíos y todos; las flechas cambian el filtro', async () => {
    const { user } = await openEstablishments('ORG');
    const filters = screen.getByRole('tablist', { name: 'Filtrar establecimientos por estado' });
    expect(within(filters).getByRole('tab', { name: 'Activos' })).toHaveAttribute('aria-selected', 'true');
    await user.click(within(filters).getByRole('tab', { name: 'Inactivos' }));
    expect(await screen.findByText('No hay establecimientos inactivos.')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(within(filters).getByRole('tab', { name: 'Cerrados' })).toHaveFocus();
    expect(await screen.findByText('No hay establecimientos cerrados.')).toBeInTheDocument();
    await user.keyboard('{End}');
    expect(await screen.findByRole('list', { name: 'Establecimientos de ORG' })).toBeInTheDocument();
  });

  it('en compact, tarjetas con la dirección y sin lista-detalle', async () => {
    await openEstablishments('ORG', { width: WIDTHS.compact });
    expect(await screen.findByText('CALLAO · Sede Callao', { selector: 'span.text-title-medium' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Establecimiento/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Más acciones del establecimiento PIURA' })).toBeInTheDocument();
  });
});

describe('D-MDM-05 Abrir y editar establecimiento (US-MDM-009)', () => {
  it('abre con la versión cargada: sin almacén en el tipo, snackbar y aparece en la lista', async () => {
    const open = vi.fn<(version: number) => void>();
    const decorateGateway = (base: MdmGateway) =>
      overrideGateway(base, {
        openEstablishment: (partyId, request, ifMatch) => {
          open(ifMatch);
          return base.openEstablishment(partyId, request, ifMatch);
        },
      });
    const { user, store } = await openEstablishments('ORG', { decorateGateway });
    const version = store.parties.get(ORG_PARTY_ID)?.version;
    const dialog = await openForm(user);
    const kind = within(dialog).getByRole('combobox', { name: 'Tipo (obligatorio)' });
    expect(within(kind).queryByRole('option', { name: 'Almacén' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'Dirección' })).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'País (obligatorio)' })).toHaveValue('PE');
    await fillRequired(user, dialog, 'lurin');
    await user.type(within(dialog).getByRole('textbox', { name: 'Anexo SUNAT (opcional)' }), '0003');
    await user.click(within(dialog).getByRole('button', { name: 'Abrir' }));

    expect(await screen.findByText('Establecimiento abierto.')).toBeInTheDocument();
    expect(open).toHaveBeenCalledWith(version);
    expect(await screen.findByRole('button', { name: /LURIN · Planta Lurín/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir establecimiento' })).toHaveFocus());
  });

  it('valida antes de enviar: obligatorios, código ya usado en la ficha y anexo de 4 dígitos', async () => {
    const { user } = await openEstablishments('ORG');
    const dialog = await openForm(user);
    await user.click(within(dialog).getByRole('button', { name: 'Abrir' }));
    expect(await within(dialog).findByRole('link', { name: 'Escribe el nombre del establecimiento.' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Escribe la dirección.' })).toBeInTheDocument();
    await fillRequired(user, dialog, 'callao');
    await user.type(within(dialog).getByRole('textbox', { name: 'Anexo SUNAT (opcional)' }), '12');
    await user.click(within(dialog).getByRole('button', { name: 'Abrir' }));
    await waitFor(() => expect(within(dialog).getByRole('textbox', { name: 'Código (obligatorio)' })).toHaveAccessibleDescription('Ya usaste este código en esta organización.'));
    expect(within(dialog).getByRole('textbox', { name: 'Anexo SUNAT (opcional)' })).toHaveAccessibleDescription('El anexo tiene 4 dígitos, por ejemplo 0001.');
  });

  it('principal duplicado: aviso al marcar y 409 establishment.principal_exists en el campo, nombrando al actual', async () => {
    const { user } = await openEstablishments('ORG');
    const dialog = await openForm(user);
    await fillRequired(user, dialog, 'lurin');
    const principal = within(dialog).getByRole('checkbox', { name: 'Principal' });
    await user.click(principal);
    expect(principal).toHaveAccessibleDescription('El principal actual es CALLAO. Si guardas, el servidor lo rechazará; quita antes su marca.');
    await user.click(within(dialog).getByRole('button', { name: 'Abrir' }));
    await waitFor(() =>
      expect(principal).toHaveAccessibleDescription(
        'El principal actual es CALLAO · Sede Callao. Solo puede haber uno activo. Desmarca «Principal» o quita la marca al actual primero.',
      ),
    );
    expect(principal).toHaveAttribute('aria-invalid', 'true');
  });

  it('409 establishment.code_not_unique con un código que la ficha no conocía: error en el campo código', async () => {
    const store = new MdmMockStore();
    const { user } = await openEstablishments('ORG', { store });
    const dialog = await openForm(user);
    addEstablishment(store, 'ORG', { id: 'e0000000-0000-4000-8000-000000000501', isActive: false });
    await fillRequired(user, dialog, 'anexo');
    await user.click(within(dialog).getByRole('button', { name: 'Abrir' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('textbox', { name: 'Código (obligatorio)' })).toHaveAccessibleDescription(
        'Ya hay un establecimiento con este código en la organización, aunque esté cerrado. Usa otro código.',
      ),
    );
  });

  it('412: conserva lo escrito y abre sobre la versión nueva tras «Recargar y revisar»', async () => {
    const { user, store } = await openEstablishments('ORG');
    const dialog = await openForm(user);
    await fillRequired(user, dialog, 'lurin');
    store.simulateConcurrentEdit(ORG_PARTY_ID);
    await user.click(within(dialog).getByRole('button', { name: 'Abrir' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Otra persona cambió esta organización mientras editabas. Tus cambios siguen aquí.');
    expect(within(dialog).getByRole('textbox', { name: 'Nombre (obligatorio)' })).toHaveValue('Planta Lurín');
    await user.click(within(alert).getByRole('button', { name: 'Recargar y revisar' }));
    await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument());
    await user.click(within(dialog).getByRole('button', { name: 'Abrir' }));
    expect(await screen.findByText('Establecimiento abierto.')).toBeInTheDocument();
  });

  it('403 del servidor: el formulario no se cierra y explica que no hay permiso', async () => {
    const decorateGateway = (base: MdmGateway) => overrideGateway(base, { openEstablishment: () => Promise.reject(forbiddenError()) });
    const { user } = await openEstablishments('ORG', { decorateGateway });
    const dialog = await openForm(user);
    await fillRequired(user, dialog, 'lurin');
    await user.click(within(dialog).getByRole('button', { name: 'Abrir' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No tienes permiso para esta acción.');
  });

  it('editar: el código es inmutable; guarda y devuelve el foco al menú; Escape sin cambios cierra', async () => {
    const { user, store } = await openEstablishments('ORG');
    await chooseAction(user, 'CALLAO', 'Editar');
    let dialog = screen.getByRole('dialog', { name: 'Editar el establecimiento CALLAO' });
    expect(within(dialog).getByText('Código CALLAO (no se puede cambiar)')).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox', { name: 'Código (obligatorio)' })).not.toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Tipo (obligatorio)' })).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Más acciones del establecimiento CALLAO' })).toHaveFocus());

    await chooseAction(user, 'CALLAO', 'Editar');
    dialog = screen.getByRole('dialog', { name: 'Editar el establecimiento CALLAO' });
    const name = within(dialog).getByRole('textbox', { name: 'Nombre (obligatorio)' });
    await user.clear(name);
    await user.type(name, 'Sede Callao Norte');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Cambios guardados.')).toBeInTheDocument();
    expect(store.parties.get(ORG_PARTY_ID)?.establishments.find((item) => item.code === 'CALLAO')?.name).toBe('Sede Callao Norte');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Más acciones del establecimiento CALLAO' })).toHaveFocus());
  });
});

describe('Desactivar, reactivar y D-MDM-09 cerrar (US-MDM-010)', () => {
  it('desactivar y reactivar son de un clic; con el filtro «Activos» el foco va al encabezado de la sección', async () => {
    const { user } = await openEstablishments('ORG');
    await user.click(await screen.findByRole('button', { name: /PIURA · Sede Piura/ }));
    // El analista no cierra (matriz supuesta).
    await user.click(screen.getByRole('button', { name: 'Más acciones del establecimiento PIURA' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Editar', 'Desactivar']);
    await user.click(screen.getByRole('menuitem', { name: 'Desactivar' }));
    expect(await screen.findByText('Establecimiento PIURA desactivado.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: /PIURA · Sede Piura/ })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Establecimientos de ORG' })).toHaveFocus());

    await user.click(screen.getByRole('tab', { name: 'Inactivos' }));
    const detail = await screen.findByRole('region', { name: 'Establecimiento PIURA' });
    expect(within(detail).getByText('Inactivo')).toBeInTheDocument();
    await chooseAction(user, 'PIURA', 'Reactivar');
    expect(await screen.findByText('Establecimiento PIURA reactivado.')).toBeInTheDocument();
  });

  it('cerrar: confirmación terminal que dice que es definitivo; foco en «Cancelar»; Escape devuelve el foco', async () => {
    const store = new MdmMockStore();
    const callao = store.parties.get(ORG_PARTY_ID)?.establishments.find((item) => item.code === 'CALLAO');
    const [reference] = store.externalReferences.values();
    if (callao === undefined || reference === undefined) throw new Error('Semilla inesperada');
    store.externalReferences.set('a1000000-0000-4000-8000-000000000099', {
      ...reference,
      id: 'a1000000-0000-4000-8000-000000000099',
      externalKey: 'CALLAO-1',
      mdmObjectType: 'ESTABLISHMENT',
      mdmObjectId: callao.id,
    });
    const { user } = await openEstablishments('ORG', { store, role: 'RESPONSABLE_MDM' });
    await chooseAction(user, 'CALLAO', 'Cerrar');
    let dialog = screen.getByRole('dialog', { name: '¿Cerrar el establecimiento CALLAO?' });
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(dialog).toHaveTextContent('El cierre es definitivo: no se puede reabrir y el código CALLAO no podrá volver a usarse en esta organización.');
    expect(dialog).toHaveTextContent('Es el establecimiento principal; la organización quedará sin principal.');
    expect(await within(dialog).findByText('Tiene 1 referencia externa vinculada.')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Más acciones del establecimiento CALLAO' })).toHaveFocus());

    await chooseAction(user, 'CALLAO', 'Cerrar');
    dialog = screen.getByRole('dialog', { name: '¿Cerrar el establecimiento CALLAO?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar establecimiento' }));
    expect(await screen.findByText('Establecimiento CALLAO cerrado.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Establecimientos de ORG' })).toHaveFocus());
    await user.click(screen.getByRole('tab', { name: 'Cerrados' }));
    const detail = await screen.findByRole('region', { name: 'Establecimiento CALLAO' });
    expect(within(detail).getByText(/^Cerrado el \d{2}\/\d{2}\/\d{4}$/)).toBeInTheDocument();
    expect(within(detail).queryByText('Principal')).not.toBeInTheDocument();
    expect(within(detail).queryByRole('button', { name: /Más acciones/ })).not.toBeInTheDocument();
  });

  it('412 al cerrar: aviso en el diálogo, que no se cierra; tras recargar, cierra', async () => {
    const { user, store } = await openEstablishments('ORG', { role: 'RESPONSABLE_MDM' });
    await chooseAction(user, 'CALLAO', 'Cerrar');
    const dialog = screen.getByRole('dialog', { name: '¿Cerrar el establecimiento CALLAO?' });
    store.simulateConcurrentEdit(ORG_PARTY_ID);
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar establecimiento' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Otra persona cambió esta organización mientras editabas.');
    await user.click(within(alert).getByRole('button', { name: 'Recargar y revisar' }));
    await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument());
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar establecimiento' }));
    expect(await screen.findByText('Establecimiento CALLAO cerrado.')).toBeInTheDocument();
  });

  it('403 al desactivar: aviso en la sección', async () => {
    const decorateGateway = (base: MdmGateway) => overrideGateway(base, { deactivateEstablishment: () => Promise.reject(forbiddenError()) });
    const { user } = await openEstablishments('ORG', { decorateGateway });
    await chooseAction(user, 'CALLAO', 'Desactivar');
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para esta acción.');
  });
});

describe('Organización suspendida o archivada (contrato §6.2, INV-PTY-11)', () => {
  it('suspendida: «Abrir» y «Reactivar» deshabilitados con su explicación; editar y cerrar siguen', async () => {
    const store = new MdmMockStore();
    addEstablishment(store, 'TRANSLIM', { id: 'e0000000-0000-4000-8000-000000000601', isActive: false });
    const { user } = await openEstablishments('TRANSLIM', { store, role: 'RESPONSABLE_MDM' });
    const open = screen.getByRole('button', { name: 'Abrir establecimiento' });
    expect(open).toHaveAttribute('aria-disabled', 'true');
    expect(open).toHaveAccessibleDescription('No disponible mientras la organización esté suspendida.');
    await user.click(open);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Inactivos' }));
    await user.click(await screen.findByRole('button', { name: 'Más acciones del establecimiento ANEXO' }));
    expect(screen.getByRole('menuitem', { name: /^Reactivar/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'Editar' })).not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('menuitem', { name: 'Cerrar' })).not.toHaveAttribute('aria-disabled');
  });

  it('archivada: solo lectura, sin «Abrir» ni menús', async () => {
    const store = new MdmMockStore();
    addEstablishment(store, 'IMPORTADORA-ORIENTE', { id: 'e0000000-0000-4000-8000-000000000701' });
    await openEstablishments('IMPORTADORA-ORIENTE', { store, role: 'RESPONSABLE_MDM' });
    expect(await screen.findByRole('region', { name: 'Establecimiento ANEXO' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir establecimiento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Más acciones del establecimiento/ })).not.toBeInTheDocument();
  });
});
