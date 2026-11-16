import type { MdmGateway } from '@mdm/contracts';
import { MdmMockStore } from '@mdm/mock';
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

const openRoles = (code: string, options: Omit<OpenPartyOptions, 'section'> = {}) => openPartySection(code, { ...options, section: 'roles' });

function rolesTable(code: string) {
  return screen.getByRole('table', { name: `Roles de ${code}` });
}

function rowOf(code: string, typeLabel: string): HTMLElement {
  const row = within(rolesTable(code))
    .getAllByRole('row')
    .find((item) => within(item).queryByText(typeLabel) !== null);
  if (row === undefined) throw new Error(`Sin fila para ${typeLabel}`);
  return row;
}

async function openAssign(user: Awaited<ReturnType<typeof openRoles>>['user']) {
  await user.click(screen.getByRole('button', { name: 'Asignar rol' }));
  const dialog = await screen.findByRole('dialog', { name: 'Asignar rol' });
  await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Tipo de rol (obligatorio)' })).toHaveFocus());
  return dialog;
}

describe('Roles: lista y estado derivado (US-MDM-007, UI-MDM-001 §2.2)', () => {
  it('tabla con tipo, estado con texto y vigencia; los históricos se ocultan por defecto', async () => {
    const { user } = await openRoles('AGROEXPORT-NORTE', { role: 'CONSULTOR' });
    expect(screen.getByRole('heading', { level: 2, name: 'Roles de AGROEXPORT-NORTE' })).toBeInTheDocument();
    expect(within(rowOf('AGROEXPORT-NORTE', 'Cliente (CUSTOMER)')).getByText('Vigente')).toBeInTheDocument();
    expect(within(rolesTable('AGROEXPORT-NORTE')).queryByText('Transportista (CARRIER)')).not.toBeInTheDocument();
    // El consultor solo lee: sin «Asignar rol» ni menús por fila.
    expect(screen.queryByRole('button', { name: 'Asignar rol' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Más acciones del rol/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Mostrar históricos' }));
    expect(within(rowOf('AGROEXPORT-NORTE', 'Transportista (CARRIER)')).getByText('Fuera de vigencia · venció el 31/12/2025')).toBeInTheDocument();
  });

  it('un rol futuro se muestra «Fuera de vigencia · empieza el …»', async () => {
    await openRoles('ACME');
    expect(within(rowOf('ACME', 'Proveedor (SUPPLIER)')).getByText('Fuera de vigencia · empieza el 01/01/2099')).toBeInTheDocument();
  });

  it('en compact, tarjetas en lugar de tabla', async () => {
    await openRoles('ACME', { width: WIDTHS.compact });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Cliente (CUSTOMER)', { selector: 'span.text-title-medium' })).toBeInTheDocument();
  });

  it('archivada: solo lectura, sin «Asignar rol» ni menús (INV-PTY-11)', async () => {
    await openRoles('IMPORTADORA-ORIENTE', { role: 'RESPONSABLE_MDM' });
    expect(screen.getByText('Vigente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Asignar rol' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Más acciones del rol/ })).not.toBeInTheDocument();
  });
});

describe('D-MDM-04 Asignar rol (US-MDM-007)', () => {
  it('asigna con la versión cargada, avisa con snackbar y devuelve el foco a «Asignar rol»', async () => {
    const assign = vi.fn<(version: number) => void>();
    const decorateGateway = (base: MdmGateway) =>
      overrideGateway(base, {
        assignRole: (partyId, request, ifMatch) => {
          assign(ifMatch);
          return base.assignRole(partyId, request, ifMatch);
        },
      });
    const { user, store, partyId } = await openRoles('ACME', { decorateGateway });
    const version = store.parties.get(partyId)?.version;
    const dialog = await openAssign(user);
    // Los papeles logísticos de la carga inicial (D-046) se ofrecen; los desactivados no (prueba siguiente).
    const type = within(dialog).getByRole('combobox', { name: 'Tipo de rol (obligatorio)' });
    expect(within(type).getByRole('option', { name: 'Agente de carga internacional (FREIGHT_FORWARDER)' })).toBeInTheDocument();
    await user.selectOptions(type, 'Transportista (CARRIER)');
    await user.click(within(dialog).getByRole('button', { name: 'Asignar' }));

    expect(await screen.findByText('Rol asignado.')).toBeInTheDocument();
    expect(assign).toHaveBeenCalledWith(version);
    expect(await within(rowOf('ACME', 'Transportista (CARRIER)')).findByText('Vigente')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Asignar rol' })).toHaveFocus());
  });

  it('un tipo desactivado no se ofrece y los roles existentes de ese tipo conservan su nombre (D-046)', async () => {
    const store = new MdmMockStore();
    const customer = store.roleTypes.get('CUSTOMER');
    const shipping = store.roleTypes.get('SHIPPING_AGENT');
    if (customer === undefined || shipping === undefined) throw new Error('Faltan tipos en la carga inicial');
    customer.isActive = false;
    shipping.isActive = false;
    const { user } = await openRoles('ACME', { store });
    expect(within(rowOf('ACME', 'Cliente (CUSTOMER)')).getByText('Vigente')).toBeInTheDocument();
    const dialog = await openAssign(user);
    const type = within(dialog).getByRole('combobox', { name: 'Tipo de rol (obligatorio)' });
    expect(within(type).queryByRole('option', { name: /CUSTOMER/ })).not.toBeInTheDocument();
    expect(within(type).queryByRole('option', { name: /SHIPPING_AGENT/ })).not.toBeInTheDocument();
    expect(within(type).getByRole('option', { name: 'Consignatario (CONSIGNEE)' })).toBeInTheDocument();
  });

  it('409 party_role_type.inactive (otra persona lo desactivó con el diálogo abierto): error en el tipo', async () => {
    const store = new MdmMockStore();
    const { user } = await openRoles('ACME', { store });
    const dialog = await openAssign(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Tipo de rol (obligatorio)' }), 'Importador (IMPORTER)');
    const importer = store.roleTypes.get('IMPORTER');
    if (importer !== undefined) importer.isActive = false;
    await user.click(within(dialog).getByRole('button', { name: 'Asignar' }));
    expect(await within(dialog).findByRole('link', { name: 'Este tipo de rol está desactivado: ya no se asigna a roles nuevos. Elige otro tipo.' })).toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: 'Tipo de rol (obligatorio)' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('solape con un rol cargado: aviso en vivo y error en la vigencia, sin enviar', async () => {
    const assign = vi.fn();
    const decorateGateway = (base: MdmGateway) => overrideGateway(base, { assignRole: (...args) => (assign(), base.assignRole(...args)) });
    const { user } = await openRoles('ACME', { decorateGateway });
    const dialog = await openAssign(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Tipo de rol (obligatorio)' }), 'Cliente (CUSTOMER)');
    expect(within(dialog).getByText('Las fechas se cruzan con un rol que ya tiene.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Asignar' }));
    expect(await within(dialog).findByRole('link', { name: 'Se cruza con el rol Cliente del 01/03/2024 al sin fin.' })).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Hasta (opcional)' })).toHaveAttribute('aria-invalid', 'true');
    expect(assign).not.toHaveBeenCalled();
  });

  it('409 party.role.overlap del servidor con la ficha desactualizada: aviso genérico con «Recargar»; tras recargar lo señala', async () => {
    const store = new MdmMockStore();
    const { user } = await openRoles('ACME', { store });
    const dialog = await openAssign(user);
    // Otra persona asignó «Transportista» sin que esta ficha lo sepa (misma versión: no es 412, es 409).
    store.parties.get(partyIdOf(store, 'ACME'))?.roles.push({ roleId: 'd0000000-0000-4000-8000-000000000777', roleTypeCode: 'CARRIER', status: 'Active', validFrom: '2024-01-01', validTo: null });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Tipo de rol (obligatorio)' }), 'Transportista (CARRIER)');
    await user.click(within(dialog).getByRole('button', { name: 'Asignar' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Ya tiene ese rol en fechas que se cruzan.');
    expect(alert).toHaveTextContent('Cambia las fechas o termina el otro rol.');
    await user.click(within(alert).getByRole('button', { name: 'Recargar' }));
    await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument());
    await user.click(within(dialog).getByRole('button', { name: 'Asignar' }));
    expect(await within(dialog).findByRole('link', { name: 'Se cruza con el rol Transportista del 01/01/2024 al sin fin.' })).toBeInTheDocument();
  });

  it('INTERNAL_COMPANY sin identificador fiscal vigente: 409 en el aviso del formulario', async () => {
    const store = new MdmMockStore();
    const ruc = store.parties.get(partyIdOf(store, 'ACME'))?.identifiers[0];
    if (ruc !== undefined) ruc.validTo = '2024-12-31';
    const { user } = await openRoles('ACME', { store });
    const dialog = await openAssign(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Tipo de rol (obligatorio)' }), 'Empresa del grupo (INTERNAL_COMPANY)');
    await user.click(within(dialog).getByRole('button', { name: 'Asignar' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Para ser empresa del grupo, la organización necesita un identificador fiscal vigente.Agrega un identificador fiscal y vuelve a asignar el rol.',
    );
  });

  it('412: conserva el borrador, «Recargar y revisar» y asigna sobre la versión nueva', async () => {
    const { user, store, partyId } = await openRoles('ACME');
    const dialog = await openAssign(user);
    const type = within(dialog).getByRole('combobox', { name: 'Tipo de rol (obligatorio)' });
    await user.selectOptions(type, 'Agente de aduanas (CUSTOMS_BROKER)');
    store.simulateConcurrentEdit(partyId);
    await user.click(within(dialog).getByRole('button', { name: 'Asignar' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Otra persona cambió esta organización mientras editabas. Tus cambios siguen aquí.');
    expect(type).toHaveValue('CUSTOMS_BROKER');
    await user.click(within(alert).getByRole('button', { name: 'Recargar y revisar' }));
    await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument());
    await user.click(within(dialog).getByRole('button', { name: 'Asignar' }));
    expect(await screen.findByText('Rol asignado.')).toBeInTheDocument();
  });

  it('403 del servidor: el formulario no se cierra y explica que no hay permiso', async () => {
    const decorateGateway = (base: MdmGateway) => overrideGateway(base, { assignRole: () => Promise.reject(forbiddenError()) });
    const { user } = await openRoles('ACME', { decorateGateway });
    const dialog = await openAssign(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Tipo de rol (obligatorio)' }), 'Transportista (CARRIER)');
    await user.click(within(dialog).getByRole('button', { name: 'Asignar' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No tienes permiso para esta acción.');
    expect(screen.getByRole('dialog', { name: 'Asignar rol' })).toBeInTheDocument();
  });

  it('accesibilidad: Escape sin cambios cierra y devuelve el foco; con cambios pide confirmación', async () => {
    const { user } = await openRoles('ACME');
    await openAssign(user);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Asignar rol' })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Asignar rol' })).toHaveFocus());

    const dialog = await openAssign(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Tipo de rol (obligatorio)' }), 'Transportista (CARRIER)');
    await user.keyboard('{Escape}');
    expect(within(dialog).getByText('¿Descartar los cambios sin guardar?')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Seguir editando' })).toHaveFocus();
  });
});

describe('Suspender, reactivar y D-MDM-10 terminar rol (US-MDM-008)', () => {
  it('suspender y reactivar son de un clic, con snackbar y el foco en el menú de la fila', async () => {
    const { user } = await openRoles('ACME');
    await user.click(screen.getByRole('button', { name: 'Más acciones del rol Cliente' }));
    // El analista no termina roles (matriz supuesta): solo suspender.
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Suspender']);
    await user.click(screen.getByRole('menuitem', { name: 'Suspender' }));
    expect(await screen.findByText('Rol Cliente suspendido.')).toBeInTheDocument();
    expect(await within(rowOf('ACME', 'Cliente (CUSTOMER)')).findByText('Suspendido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Más acciones del rol Cliente' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Más acciones del rol Cliente' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reactivar' }));
    expect(await screen.findByText('Rol Cliente reactivado.')).toBeInTheDocument();
    expect(await within(rowOf('ACME', 'Cliente (CUSTOMER)')).findByText('Vigente')).toBeInTheDocument();
  });

  it('412 en una acción de un clic: aviso en la sección con «Recargar»', async () => {
    const { user, store, partyId } = await openRoles('ACME');
    store.simulateConcurrentEdit(partyId);
    await user.click(screen.getByRole('button', { name: 'Más acciones del rol Cliente' }));
    await user.click(screen.getByRole('menuitem', { name: 'Suspender' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Otra persona cambió esta organización mientras editabas.');
    await user.click(within(alert).getByRole('button', { name: 'Recargar' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('terminar: confirmación terminal, foco en «Cancelar», Escape devuelve el foco; valida la fecha y termina', async () => {
    const { user, store, partyId } = await openRoles('ACME', { role: 'RESPONSABLE_MDM' });
    const menu = () => screen.getByRole('button', { name: 'Más acciones del rol Cliente' });
    await user.click(menu());
    await user.click(screen.getByRole('menuitem', { name: 'Terminar' }));
    let dialog = screen.getByRole('dialog', { name: '¿Terminar el rol Cliente?' });
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(dialog).toHaveTextContent('Vigencia actual: del 01/03/2024 sin fecha de fin');
    expect(dialog).toHaveTextContent('no se podrá reactivar');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(menu()).toHaveFocus());

    await user.click(menu());
    await user.click(screen.getByRole('menuitem', { name: 'Terminar' }));
    dialog = screen.getByRole('dialog', { name: '¿Terminar el rol Cliente?' });
    const date = within(dialog).getByRole('textbox', { name: 'Termina el' });
    await user.clear(date);
    await user.type(date, '01012024');
    await user.click(within(dialog).getByRole('button', { name: 'Terminar rol' }));
    expect(date).toHaveAccessibleDescription('La fecha de término no puede ser anterior al 01/03/2024.');
    await user.clear(date);
    await user.type(date, '30092026');
    await user.type(within(dialog).getByRole('textbox', { name: 'Motivo (opcional)' }), 'Fin del contrato');
    await user.click(within(dialog).getByRole('button', { name: 'Terminar rol' }));
    expect(await screen.findByText('Rol Cliente terminado el 30/09/2026.')).toBeInTheDocument();
    expect(store.parties.get(partyId)?.roles.find((item) => item.roleTypeCode === 'CUSTOMER')).toMatchObject({ status: 'Terminated', validTo: '2026-09-30' });
    // Terminado, es histórico y se oculta: el foco va al encabezado de la sección.
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Roles de ACME' })).toHaveFocus());
    await user.click(screen.getByRole('switch', { name: 'Mostrar históricos' }));
    const row = rowOf('ACME', 'Cliente (CUSTOMER)');
    expect(within(row).getByText('Terminado')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /Más acciones/ })).not.toBeInTheDocument();
  });

  it('403 al terminar: el diálogo no se cierra', async () => {
    const decorateGateway = (base: MdmGateway) => overrideGateway(base, { terminateRole: () => Promise.reject(forbiddenError()) });
    const { user } = await openRoles('ACME', { role: 'RESPONSABLE_MDM', decorateGateway });
    await user.click(screen.getByRole('button', { name: 'Más acciones del rol Cliente' }));
    await user.click(screen.getByRole('menuitem', { name: 'Terminar' }));
    const dialog = screen.getByRole('dialog', { name: '¿Terminar el rol Cliente?' });
    await user.click(within(dialog).getByRole('button', { name: 'Terminar rol' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No tienes permiso para esta acción.');
  });
});

describe('Organización suspendida (contrato §6.2, UX-MDM-001 §5.4)', () => {
  it('«Asignar rol» y «Reactivar» quedan deshabilitados con su explicación visible; suspender y terminar siguen', async () => {
    const store = new MdmMockStore();
    const translim = store.parties.get(partyIdOf(store, 'TRANSLIM'));
    translim?.roles.push({ roleId: 'd0000000-0000-4000-8000-000000000555', roleTypeCode: 'SUPPLIER', status: 'Suspended', validFrom: '2024-03-01', validTo: null });
    const { user } = await openRoles('TRANSLIM', { store, role: 'RESPONSABLE_MDM' });
    const assign = screen.getByRole('button', { name: 'Asignar rol' });
    expect(assign).toHaveAttribute('aria-disabled', 'true');
    expect(assign).toHaveAccessibleDescription('No disponible mientras la organización esté suspendida.');
    await user.click(assign);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Más acciones del rol Proveedor' }));
    // `ActionMenu` incluye el motivo en el nombre del elemento deshabilitado.
    const reactivate = screen.getByRole('menuitem', { name: /^Reactivar/ });
    expect(reactivate).toHaveAttribute('aria-disabled', 'true');
    expect(reactivate).toHaveAccessibleDescription('No disponible mientras la organización esté suspendida.');
    expect(screen.getByRole('menuitem', { name: 'Terminar' })).not.toHaveAttribute('aria-disabled');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Más acciones del rol Transportista' }));
    await user.click(screen.getByRole('menuitem', { name: 'Suspender' }));
    expect(await screen.findByText('Rol Transportista suspendido.')).toBeInTheDocument();
  });
});
