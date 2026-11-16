import { MdmProblemError, type MdmGateway, type MdmProblem } from '@mdm/contracts';
import { MdmMockStore } from '@mdm/mock';
import { WIDTHS } from '@sil/ui/testing';
import { screen, waitFor, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { installDialogPolyfill } from '../../../testing/dialog-polyfill.ts';
import { renderMdm, type MdmRenderOptions } from '../../../testing/mdm-harness.tsx';
import { overrideGateway } from '../../../testing/override-gateway.ts';
import { forbiddenError } from '../../../testing/party-fixtures.ts';

let polyfill: ReturnType<typeof installDialogPolyfill>;
beforeAll(() => {
  polyfill = installDialogPolyfill();
});
afterAll(() => {
  polyfill.uninstall();
});

async function openCatalog(options: Omit<MdmRenderOptions, 'path'> = {}) {
  const rendered = renderMdm({ ...options, path: '/mdm/tipos-de-rol' });
  await screen.findByRole('heading', { level: 1, name: 'Tipos de rol' });
  await screen.findByText(/\d+ tipos de rol/);
  return rendered;
}

function table(): HTMLElement {
  return screen.getByRole('table', { name: /^Tipos de rol/ });
}

function rowOf(code: string): HTMLElement {
  const row = within(table())
    .getAllByRole('row')
    .find((item) => within(item).queryByText(code, { exact: true }) !== null);
  if (row === undefined) throw new Error(`Sin fila para ${code}`);
  return row;
}

function problem(status: 409 | 422, code: 'party_role_type.code_duplicate' | 'party_role_type.code_invalid'): MdmProblemError {
  const body = { title: 'Rechazado', detail: null, instance: 'prueba', errors: {} };
  // Aserción justificada: el par estado-código se elige del contrato en cada llamada.
  return new MdmProblemError({ ...body, status, code } as MdmProblem, 'prueba');
}

type User = Awaited<ReturnType<typeof openCatalog>>['user'];

async function openRowAction(user: User, name: string, action: 'Editar' | 'Desactivar' | 'Reactivar') {
  await user.click(screen.getByRole('button', { name: `Más acciones del tipo de rol ${name}` }));
  await user.click(await screen.findByRole('menuitem', { name: action }));
}

async function openCreate(user: User) {
  await user.click(screen.getByRole('button', { name: 'Nuevo tipo de rol' }));
  const dialog = await screen.findByRole('dialog', { name: 'Nuevo tipo de rol' });
  await waitFor(() => expect(within(dialog).getByRole('textbox', { name: 'Código (obligatorio)' })).toHaveFocus());
  return dialog;
}

describe('P-MDM-04 Tipos de rol: consulta (US-MDM-014, D-046)', () => {
  it('el riel lleva «Tipos de rol»; la tabla muestra el catálogo con estado en texto; el consultor no tiene botones ni menús', async () => {
    await openCatalog({ role: 'CONSULTOR' });
    const rail = screen.getByRole('navigation', { name: 'Navegación de MDM' });
    expect(within(rail).getByRole('link', { name: 'Tipos de rol' })).toHaveAttribute('aria-current', 'page');
    expect(within(table()).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Código',
      'Nombre',
      'UN/EDIFACT 3035',
      'Tipos de parte',
      'Exige identificador fiscal',
      'Estado',
    ]);
    const consignee = rowOf('CONSIGNEE');
    expect(within(consignee).getByText('Consignatario')).toBeInTheDocument();
    expect(within(consignee).getByText('CN')).toBeInTheDocument();
    expect(within(consignee).getByText('Organización, persona')).toBeInTheDocument();
    expect(within(consignee).getByText('Activo')).toBeInTheDocument();
    expect(within(rowOf('INTERNAL_COMPANY')).getByText('Sí')).toBeInTheDocument();
    expect(within(rowOf('INTERNAL_COMPANY')).getByText('Sin código')).toBeInTheDocument();
    expect(within(rowOf('FREIGHT_FORWARDER')).getByText('Agente de carga internacional')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo tipo de rol' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Más acciones del tipo de rol/ })).not.toBeInTheDocument();
  });

  it('por defecto solo los activos; «Mostrar inactivos» incluye los desactivados', async () => {
    const store = new MdmMockStore();
    const carrier = store.roleTypes.get('CARRIER');
    if (carrier !== undefined) carrier.isActive = false;
    const { user } = await openCatalog({ store, role: 'CONSULTOR' });
    expect(screen.getByText('12 tipos de rol')).toBeInTheDocument();
    expect(within(table()).queryByText('CARRIER')).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Mostrar inactivos' }));
    expect(screen.getByText('13 tipos de rol')).toBeInTheDocument();
    expect(within(rowOf('CARRIER')).getByText('Inactivo')).toBeInTheDocument();
  });

  it('compact: tarjetas en lugar de tabla', async () => {
    await openCatalog({ width: WIDTHS.compact });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const card = within(screen.getByRole('list', { name: 'Tipos de rol' }))
      .getAllByRole('listitem')
      .find((item) => within(item).queryByText('WAREHOUSE_KEEPER') !== null);
    expect(card).toBeDefined();
    if (card !== undefined) expect(within(card).getByText('Depositario')).toBeInTheDocument();
  });
});

describe('P-MDM-04: alta', () => {
  it('normaliza el código, crea el tipo, avisa y devuelve el foco a «Nuevo tipo de rol»', async () => {
    const { user, store } = await openCatalog();
    const dialog = await openCreate(user);
    const code = within(dialog).getByRole('textbox', { name: 'Código (obligatorio)' });
    await user.type(code, 'operador portuario');
    expect(within(dialog).getByText('Se guardará como OPERADOR_PORTUARIO. No se puede cambiar después.')).toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox', { name: 'Nombre (obligatorio)' }), 'Operador portuario');
    expect(code).toHaveValue('OPERADOR_PORTUARIO');
    await user.type(within(dialog).getByRole('textbox', { name: 'Código UN/EDIFACT 3035 (opcional)' }), 'pw');
    expect(within(dialog).getByRole('textbox', { name: 'Código UN/EDIFACT 3035 (opcional)' })).toHaveValue('PW');
    await user.click(within(dialog).getByRole('button', { name: 'Crear' }));

    expect(await screen.findByText('Tipo de rol OPERADOR_PORTUARIO creado.')).toBeInTheDocument();
    expect(store.roleTypes.get('OPERADOR_PORTUARIO')).toMatchObject({ name: 'Operador portuario', unEdifact3035Code: 'PW', allowedPartyTypes: ['ORGANIZATION'], version: 1 });
    expect(await within(table()).findByText('OPERADOR_PORTUARIO')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nuevo tipo de rol' })).toHaveFocus());
  });

  it('valida antes de enviar: obligatorios, formato del código, código ya usado, EDIFACT y tipos de parte', async () => {
    const create = vi.fn();
    const decorateGateway = (base: MdmGateway) => overrideGateway(base, { createRoleType: (request) => (create(), base.createRoleType(request)) });
    const { user } = await openCatalog({ decorateGateway });
    const dialog = await openCreate(user);
    await user.click(within(dialog).getByRole('button', { name: 'Crear' }));
    expect(await within(dialog).findByRole('link', { name: 'Escribe un código.' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Escribe el nombre.' })).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: 'Código (obligatorio)' }), 'carrier');
    await user.type(within(dialog).getByRole('textbox', { name: 'Nombre (obligatorio)' }), 'Otro');
    await user.type(within(dialog).getByRole('textbox', { name: 'Código UN/EDIFACT 3035 (opcional)' }), 'c');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Organización' }));
    await user.click(within(dialog).getByRole('button', { name: 'Crear' }));
    expect(await within(dialog).findByRole('link', { name: 'Ya existe un tipo de rol con este código, aunque esté desactivado. Usa otro código.' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'El código UN/EDIFACT 3035 son dos letras, por ejemplo CN.' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Elige al menos un tipo de parte.' })).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('409 party_role_type.code_duplicate del servidor (otra persona lo creó): error en el código, borrador intacto', async () => {
    const store = new MdmMockStore();
    const { user } = await openCatalog({ store });
    const dialog = await openCreate(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Código (obligatorio)' }), 'OPERADOR');
    await user.type(within(dialog).getByRole('textbox', { name: 'Nombre (obligatorio)' }), 'Operador');
    const existing = store.roleTypes.get('CARRIER');
    if (existing !== undefined) store.roleTypes.set('OPERADOR', { ...existing, code: 'OPERADOR', isActive: false });
    await user.click(within(dialog).getByRole('button', { name: 'Crear' }));
    expect(await within(dialog).findByRole('link', { name: 'Ya existe un tipo de rol con este código, aunque esté desactivado. Usa otro código.' })).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Código (obligatorio)' })).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog).getByRole('textbox', { name: 'Nombre (obligatorio)' })).toHaveValue('Operador');
  });

  it('422 party_role_type.code_invalid del servidor: error en el código', async () => {
    const decorateGateway = (base: MdmGateway) => overrideGateway(base, { createRoleType: () => Promise.reject(problem(422, 'party_role_type.code_invalid')) });
    const { user } = await openCatalog({ decorateGateway });
    const dialog = await openCreate(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Código (obligatorio)' }), 'OPERADOR');
    await user.type(within(dialog).getByRole('textbox', { name: 'Nombre (obligatorio)' }), 'Operador');
    await user.click(within(dialog).getByRole('button', { name: 'Crear' }));
    expect(await within(dialog).findByRole('link', { name: /^El código empieza por una letra/ })).toBeInTheDocument();
  });

  it('403 del servidor: aviso sin campo y nada guardado', async () => {
    const decorateGateway = (base: MdmGateway) => overrideGateway(base, { createRoleType: () => Promise.reject(forbiddenError()) });
    const { user, store } = await openCatalog({ decorateGateway });
    const dialog = await openCreate(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Código (obligatorio)' }), 'OPERADOR');
    await user.type(within(dialog).getByRole('textbox', { name: 'Nombre (obligatorio)' }), 'Operador');
    await user.click(within(dialog).getByRole('button', { name: 'Crear' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No tienes permiso para esta acción.');
    expect(store.roleTypes.has('OPERADOR')).toBe(false);
  });
});

describe('P-MDM-04: edición', () => {
  it('el código no se edita; guarda con la versión del tipo y devuelve el foco al menú de la fila', async () => {
    const change = vi.fn<(version: number) => void>();
    const decorateGateway = (base: MdmGateway) =>
      overrideGateway(base, {
        changeRoleType: (code, request, ifMatch) => {
          change(ifMatch);
          return base.changeRoleType(code, request, ifMatch);
        },
      });
    const { user } = await openCatalog({ decorateGateway, role: 'RESPONSABLE_MDM' });
    await openRowAction(user, 'Transportista', 'Editar');
    const dialog = await screen.findByRole('dialog', { name: 'Editar el tipo de rol Transportista' });
    expect(within(dialog).queryByRole('textbox', { name: 'Código (obligatorio)' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('Código: CARRIER. No se puede cambiar.')).toBeInTheDocument();
    const name = within(dialog).getByRole('textbox', { name: 'Nombre (obligatorio)' });
    await waitFor(() => expect(name).toHaveFocus());
    await user.clear(name);
    await user.type(name, 'Transportista terrestre');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Cambios guardados.')).toBeInTheDocument();
    expect(change).toHaveBeenCalledWith(1);
    expect(await within(rowOf('CARRIER')).findByText('Transportista terrestre')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Más acciones del tipo de rol Transportista terrestre' })).toHaveFocus());
  });

  it('412: conserva el borrador, «Recargar y revisar» y guarda sobre la versión nueva', async () => {
    const store = new MdmMockStore();
    const { user } = await openCatalog({ store });
    await openRowAction(user, 'Transportista', 'Editar');
    const dialog = await screen.findByRole('dialog', { name: 'Editar el tipo de rol Transportista' });
    const name = within(dialog).getByRole('textbox', { name: 'Nombre (obligatorio)' });
    await user.clear(name);
    await user.type(name, 'Transportista de carga');
    // Otra persona editó el tipo mientras tanto.
    const carrier = store.roleTypes.get('CARRIER');
    if (carrier !== undefined) carrier.version += 1;
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Otra persona cambió este tipo de rol mientras editabas. Tus cambios siguen aquí.');
    await user.click(within(alert).getByRole('button', { name: 'Recargar y revisar' }));
    await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument());
    expect(name).toHaveValue('Transportista de carga');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Cambios guardados.')).toBeInTheDocument();
    expect(store.roleTypes.get('CARRIER')).toMatchObject({ name: 'Transportista de carga', version: 3 });
  });
});

describe('P-MDM-04: desactivar y reactivar', () => {
  it('desactivar explica que los roles existentes se conservan; reactivar lo devuelve al catálogo', async () => {
    const { user, store } = await openCatalog();
    await openRowAction(user, 'Exportador', 'Desactivar');
    const confirm = await screen.findByRole('dialog', { name: '¿Desactivar el tipo de rol Exportador?' });
    expect(within(confirm).getByText(/Los roles que ya lo usan se conservan con su vigencia/)).toBeInTheDocument();
    await waitFor(() => expect(within(confirm).getByRole('button', { name: 'Cancelar' })).toHaveFocus());
    await user.click(within(confirm).getByRole('button', { name: 'Desactivar' }));

    expect(await screen.findByText('Tipo de rol Exportador desactivado.')).toBeInTheDocument();
    expect(store.roleTypes.get('EXPORTER')).toMatchObject({ isActive: false, version: 2 });
    await waitFor(() => expect(within(table()).queryByText('EXPORTER')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Tipos de rol' })).toHaveFocus());

    await user.click(screen.getByRole('switch', { name: 'Mostrar inactivos' }));
    expect(within(rowOf('EXPORTER')).getByText('Inactivo')).toBeInTheDocument();
    await openRowAction(user, 'Exportador', 'Reactivar');
    const reactivate = await screen.findByRole('dialog', { name: '¿Reactivar el tipo de rol Exportador?' });
    await user.click(within(reactivate).getByRole('button', { name: 'Reactivar' }));
    expect(await screen.findByText('Tipo de rol Exportador reactivado.')).toBeInTheDocument();
    expect(await within(rowOf('EXPORTER')).findByText('Activo')).toBeInTheDocument();
  });

  it('409 party_role_type.already_inactive (otra persona ya lo desactivó): aviso con «Recargar»', async () => {
    const decorateGateway = (base: MdmGateway) =>
      overrideGateway(base, {
        deactivateRoleType: () => {
          const body = { title: 'Conflicto', detail: null, instance: 'prueba', errors: {} };
          return Promise.reject(new MdmProblemError({ ...body, status: 409, code: 'party_role_type.already_inactive' }, 'prueba'));
        },
      });
    const { user } = await openCatalog({ decorateGateway });
    await openRowAction(user, 'Importador', 'Desactivar');
    const confirm = await screen.findByRole('dialog', { name: '¿Desactivar el tipo de rol Importador?' });
    await user.click(within(confirm).getByRole('button', { name: 'Desactivar' }));
    const alert = await within(confirm).findByRole('alert');
    expect(alert).toHaveTextContent('Este tipo de rol ya estaba desactivado. Otra persona lo cambió hace poco.');
    expect(within(alert).getByRole('button', { name: 'Recargar' })).toBeInTheDocument();
  });

  it('412 al desactivar: aviso de conflicto sin desactivar', async () => {
    const store = new MdmMockStore();
    const { user } = await openCatalog({ store });
    await openRowAction(user, 'Importador', 'Desactivar');
    const confirm = await screen.findByRole('dialog', { name: '¿Desactivar el tipo de rol Importador?' });
    const importer = store.roleTypes.get('IMPORTER');
    if (importer !== undefined) importer.version += 1;
    await user.click(within(confirm).getByRole('button', { name: 'Desactivar' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent('Otra persona cambió este tipo de rol mientras lo veías.');
    expect(store.roleTypes.get('IMPORTER')?.isActive).toBe(true);
  });

  it('el tipo nuevo se ofrece en «Asignar rol» de la ficha', async () => {
    const { user, store } = await openCatalog();
    const dialog = await openCreate(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Código (obligatorio)' }), 'OPERADOR_PORTUARIO');
    await user.type(within(dialog).getByRole('textbox', { name: 'Nombre (obligatorio)' }), 'Operador portuario');
    await user.click(within(dialog).getByRole('button', { name: 'Crear' }));
    await screen.findByText('Tipo de rol OPERADOR_PORTUARIO creado.');
    expect(store.roleTypes.get('OPERADOR_PORTUARIO')?.isActive).toBe(true);

    await user.click(within(screen.getByRole('navigation', { name: 'Navegación de MDM' })).getByRole('link', { name: 'Organizaciones' }));
    await user.click(await screen.findByRole('link', { name: 'ACME' }));
    await user.click(await screen.findByRole('tab', { name: /^Roles/ }));
    await user.click(await screen.findByRole('button', { name: 'Asignar rol' }));
    const assign = await screen.findByRole('dialog', { name: 'Asignar rol' });
    const type = within(assign).getByRole('combobox', { name: 'Tipo de rol (obligatorio)' });
    expect(within(type).getByRole('option', { name: 'Operador portuario (OPERADOR_PORTUARIO)' })).toBeInTheDocument();
  });
});
