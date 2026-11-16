import { MdmProblemError, type MdmGateway, type StartRelationshipRequest } from '@mdm/contracts';
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

const openRelationships = (code: string, options: Omit<OpenPartyOptions, 'section'> = {}) => openPartySection(code, { ...options, section: 'relaciones' });

type User = Awaited<ReturnType<typeof openRelationships>>['user'];

const NAVIERA = 'NAVIERA-PACIFICO · NAVIERA DEL PACÍFICO S.A.C.';
const CARGA_SUR = 'CARGA-SUR · CARGA SUR E.I.R.L.';

async function relationshipsTable(code: string) {
  return screen.findByRole('table', { name: `Relaciones de ${code}` });
}

async function rowWith(code: string, text: string): Promise<HTMLElement> {
  const table = await relationshipsTable(code);
  let row: HTMLElement | undefined;
  await waitFor(() => {
    row = within(table)
      .getAllByRole('row')
      .find((item) => within(item).queryByText(text) !== null);
    expect(row).toBeDefined();
  });
  if (row === undefined) throw new Error(`Sin fila con ${text}`);
  return row;
}

const BASE = { title: 'Prueba', detail: null, instance: 'prueba-rel', errors: {} } as const;
const overlapError = () => new MdmProblemError({ ...BASE, status: 409, code: 'party_relationship.overlap' }, 'prueba-rel');
const selfReferenceError = () => new MdmProblemError({ ...BASE, status: 422, code: 'party_relationship.self_reference' }, 'prueba-rel');

async function openNew(user: User) {
  await user.click(screen.getByRole('button', { name: 'Nueva relación' }));
  const dialog = await screen.findByRole('dialog', { name: 'Nueva relación' });
  await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Tipo de relación (obligatorio)' })).toHaveFocus());
  return dialog;
}

/** Elige la otra organización con el teclado: escribe, baja a la primera opción y la elige con `Enter`. */
async function pickParty(user: User, dialog: HTMLElement, text: string, option: string) {
  const field = within(dialog).getByRole('combobox', { name: 'Otra organización (obligatorio)' });
  await user.click(field);
  await user.keyboard(text);
  await within(dialog).findByRole('option', { name: option });
  await user.keyboard('{ArrowDown}');
  const active = field.getAttribute('aria-activedescendant');
  expect(active).not.toBeNull();
  const chosen = document.getElementById(active ?? '');
  expect(chosen).toHaveTextContent(option);
  await user.keyboard('{Enter}');
  expect(field).toHaveValue(option);
  expect(field).toHaveAttribute('aria-expanded', 'false');
}

describe('Relaciones: lista (US-MDM-011, UX-MDM-001 §5.4)', () => {
  it('en los dos extremos, con el sentido en texto, la otra organización enlazada y «Solo vigentes» encendido', async () => {
    const { user } = await openRelationships('ORG', { role: 'CONSULTOR' });
    expect(screen.getByRole('heading', { level: 2, name: 'Relaciones de ORG' })).toBeInTheDocument();
    const current = await rowWith('ORG', 'Es agente de');
    expect(await within(current).findByRole('link', { name: NAVIERA })).toHaveAttribute('href', expect.stringMatching(/^\/mdm\/organizaciones\/b0000000-/));
    expect(within(current).getByText('Agente de (AGENT_OF)')).toBeInTheDocument();
    expect(within(current).getByText('Vigente')).toBeInTheDocument();
    expect(within(await relationshipsTable('ORG')).queryByText('Terminada')).not.toBeInTheDocument();
    // El consultor solo lee.
    expect(screen.queryByRole('button', { name: 'Nueva relación' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Más acciones de la relación/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Solo vigentes' }));
    const ended = await rowWith('ORG', 'Es representada de');
    expect(await within(ended).findByRole('link', { name: CARGA_SUR })).toBeInTheDocument();
    expect(within(ended).getByText('Terminada')).toBeInTheDocument();
    expect(within(ended).getByText('30/06/2025')).toBeInTheDocument();
  });

  it('sin relaciones vigentes: estado vacío de §6.4; en compact, tarjetas', async () => {
    await openRelationships('ACME', { width: WIDTHS.compact });
    expect(await screen.findByText('No hay relaciones vigentes con otras organizaciones.')).toBeInTheDocument();
    // La acción primaria sigue a la vista, al inicio.
    expect(screen.getByRole('button', { name: 'Nueva relación' })).toBeInTheDocument();
  });

  it('un error al leer se queda en la sección, con «Reintentar»', async () => {
    let fail = true;
    const decorateGateway = (base: MdmGateway) =>
      overrideGateway(base, { listRelationships: (...args) => (fail ? Promise.reject(new Error('caída')) : base.listRelationships(...args)) });
    const { user } = await openRelationships('ORG', { decorateGateway });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('las relaciones');
    expect(screen.getByRole('heading', { level: 1, name: 'ORG' })).toBeInTheDocument();
    fail = false;
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await rowWith('ORG', 'Es agente de')).toBeInTheDocument();
  });

  it('archivada: solo lectura, sin «Nueva relación» ni menús (INV-PTY-11)', async () => {
    await openRelationships('IMPORTADORA-ORIENTE', { role: 'RESPONSABLE_MDM' });
    expect(await screen.findByText('No hay relaciones vigentes con otras organizaciones.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva relación' })).not.toBeInTheDocument();
  });
});

describe('D-MDM-06 Nueva relación (US-MDM-011)', () => {
  it('registra con tipo, sentido y la otra organización elegida con el buscador; snackbar y fila nueva', async () => {
    const started = vi.fn<(request: StartRelationshipRequest) => void>();
    const decorateGateway = (base: MdmGateway) =>
      overrideGateway(base, {
        startRelationship: (request) => {
          started(request);
          return base.startRelationship(request);
        },
      });
    const { user, store } = await openRelationships('ORG', { decorateGateway });
    const dialog = await openNew(user);
    expect(within(dialog).getByText('Elige primero el tipo de relación.')).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Tipo de relación (obligatorio)' }), 'Matriz de (PARENT_OF)');
    const sides = within(dialog).getByRole('group', { name: 'Sentido' });
    expect(within(sides).getByRole('radio', { name: 'ORG es matriz de la otra organización' })).toBeChecked();
    await user.click(within(sides).getByRole('radio', { name: 'ORG es filial de la otra organización' }));
    await pickParty(user, dialog, 'acme', 'ACME · ACME PERÚ S.A.C.');
    expect(within(dialog).getByText('ORG es filial de ACME · ACME PERÚ S.A.C.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Registrar' }));

    expect(await screen.findByText('Relación registrada.')).toBeInTheDocument();
    expect(started).toHaveBeenCalledWith(expect.objectContaining({ fromPartyId: partyIdOf(store, 'ACME'), toPartyId: ORG_PARTY_ID, kindCode: 'PARENT_OF', validTo: null }));
    const row = await rowWith('ORG', 'Es filial de');
    expect(await within(row).findByRole('link', { name: 'ACME · ACME PERÚ S.A.C.' })).toBeInTheDocument();
    // La relación es su propio agregado: la versión de ORG no cambia (API-MDM-002 §2.1).
    expect(store.parties.get(ORG_PARTY_ID)?.version).toBe(7);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nueva relación' })).toHaveFocus());
  });

  it('sin tipo ni organización: resumen de errores y nada se envía; la propia organización no se ofrece', async () => {
    const started = vi.fn();
    const decorateGateway = (base: MdmGateway) => overrideGateway(base, { startRelationship: (request) => (started(), base.startRelationship(request)) });
    const { user } = await openRelationships('ORG', { decorateGateway });
    const dialog = await openNew(user);
    await user.click(within(dialog).getByRole('button', { name: 'Registrar' }));
    expect(await within(dialog).findByRole('link', { name: 'Elige el tipo de relación.' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Elige la otra organización.' })).toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: 'Otra organización (obligatorio)' })).toHaveAttribute('aria-invalid', 'true');
    expect(started).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('combobox', { name: 'Otra organización (obligatorio)' }));
    await user.keyboard('organizacion');
    expect(await within(dialog).findByText('Ninguna organización coincide. Solo se pueden elegir organizaciones activas o suspendidas.', { selector: '[role="status"]' })).toBeInTheDocument();
  });

  it('solape con una relación cargada del mismo tipo y sentido: aviso en vivo y error en la vigencia, sin enviar', async () => {
    const started = vi.fn();
    const decorateGateway = (base: MdmGateway) => overrideGateway(base, { startRelationship: (request) => (started(), base.startRelationship(request)) });
    const { user } = await openRelationships('ORG', { decorateGateway });
    const dialog = await openNew(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Tipo de relación (obligatorio)' }), 'Agente de (AGENT_OF)');
    await pickParty(user, dialog, 'naviera', NAVIERA);
    expect(await within(dialog).findByText('Ya hay una relación de este tipo y sentido con esa organización en fechas que se cruzan.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Registrar' }));
    expect(
      await within(dialog).findByRole('link', { name: 'Ya existe una relación «Agente de» entre estas organizaciones en esas fechas. Cambia las fechas o termina la relación existente.' }),
    ).toBeInTheDocument();
    expect(started).not.toHaveBeenCalled();
  });

  it('409 party_relationship.overlap y 422 self_reference del servidor van en su campo', async () => {
    let next: MdmProblemError = overlapError();
    const decorateGateway = (base: MdmGateway) => overrideGateway(base, { startRelationship: () => Promise.reject(next) });
    const { user } = await openRelationships('ORG', { decorateGateway });
    const dialog = await openNew(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Tipo de relación (obligatorio)' }), 'Matriz de (PARENT_OF)');
    await pickParty(user, dialog, 'acme', 'ACME · ACME PERÚ S.A.C.');
    await user.click(within(dialog).getByRole('button', { name: 'Registrar' }));
    expect(await within(dialog).findByRole('link', { name: /^Ya existe una relación «Matriz de» entre estas organizaciones/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Hasta (opcional)' })).toHaveAttribute('aria-invalid', 'true');

    next = selfReferenceError();
    await user.click(within(dialog).getByRole('button', { name: 'Registrar' }));
    expect(await within(dialog).findByRole('link', { name: 'Una organización no puede relacionarse consigo misma. Elige otra organización.' })).toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: 'Otra organización (obligatorio)' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('403 del servidor: el formulario no se cierra y explica que no hay permiso', async () => {
    const decorateGateway = (base: MdmGateway) => overrideGateway(base, { startRelationship: () => Promise.reject(forbiddenError()) });
    const { user } = await openRelationships('ORG', { decorateGateway });
    const dialog = await openNew(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Tipo de relación (obligatorio)' }), 'Matriz de (PARENT_OF)');
    await pickParty(user, dialog, 'acme', 'ACME · ACME PERÚ S.A.C.');
    await user.click(within(dialog).getByRole('button', { name: 'Registrar' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No tienes permiso para esta acción.');
    expect(screen.getByRole('dialog', { name: 'Nueva relación' })).toBeInTheDocument();
  });
});

describe('D-MDM-11 Terminar relación (US-MDM-011)', () => {
  async function openEnd(user: User) {
    await user.click(await screen.findByRole('button', { name: `Más acciones de la relación con ${NAVIERA}` }));
    await user.click(screen.getByRole('menuitem', { name: 'Terminar' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Terminar la relación?' });
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    return dialog;
  }

  it('termina con fecha y motivo, con la versión de la relación; queda «Terminada» y el foco vuelve a la sección', async () => {
    const ended = vi.fn<(version: number, reason: string | null) => void>();
    const decorateGateway = (base: MdmGateway) =>
      overrideGateway(base, {
        endRelationship: (id, request, ifMatch) => {
          ended(ifMatch, request.reason);
          return base.endRelationship(id, request, ifMatch);
        },
      });
    const { user, store } = await openRelationships('ORG', { decorateGateway });
    await rowWith('ORG', NAVIERA);
    const dialog = await openEnd(user);
    expect(dialog).toHaveTextContent('ORG dejará de ser agente de NAVIERA-PACIFICO · NAVIERA DEL PACÍFICO S.A.C. desde el día siguiente a la fecha de término. No se puede deshacer.');
    await user.type(within(dialog).getByRole('textbox', { name: 'Motivo (opcional)' }), 'Fin del contrato');
    await user.click(within(dialog).getByRole('button', { name: 'Terminar relación' }));
    expect(await screen.findByText('Relación terminada.')).toBeInTheDocument();
    expect(ended).toHaveBeenCalledWith(1, 'Fin del contrato');
    expect(store.parties.get(ORG_PARTY_ID)?.version).toBe(7);
    // Con «Solo vigentes», la terminada deja de verse: el foco va al encabezado de la sección.
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Relaciones de ORG' })).toHaveFocus());
  });

  it('412 de la relación (su propia versión): aviso con «Recargar y revisar»; tras recargar, termina', async () => {
    const store = new MdmMockStore();
    const { user } = await openRelationships('ORG', { store });
    await rowWith('ORG', NAVIERA);
    const dialog = await openEnd(user);
    const relationship = [...store.relationships.values()].find((item) => item.fromPartyId === ORG_PARTY_ID);
    if (relationship === undefined) throw new Error('Semilla inesperada');
    relationship.version += 1;
    await user.click(within(dialog).getByRole('button', { name: 'Terminar relación' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Otra persona cambió esta relación mientras la revisabas.');
    await user.click(within(alert).getByRole('button', { name: 'Recargar y revisar' }));
    await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument());
    await user.click(within(dialog).getByRole('button', { name: 'Terminar relación' }));
    expect(await screen.findByText('Relación terminada.')).toBeInTheDocument();
  });

  it('409 already_ended y 403: aviso en el diálogo, que no se cierra', async () => {
    const store = new MdmMockStore();
    let forbid = false;
    const decorateGateway = (base: MdmGateway) => overrideGateway(base, { endRelationship: (...args) => (forbid ? Promise.reject(forbiddenError()) : base.endRelationship(...args)) });
    const { user } = await openRelationships('ORG', { store, decorateGateway });
    await rowWith('ORG', NAVIERA);
    let dialog = await openEnd(user);
    const relationship = [...store.relationships.values()].find((item) => item.fromPartyId === ORG_PARTY_ID);
    if (relationship !== undefined) relationship.status = 'Ended';
    await user.click(within(dialog).getByRole('button', { name: 'Terminar relación' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Esta relación ya estaba terminada.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    if (relationship !== undefined) relationship.status = 'Active';
    forbid = true;
    dialog = await openEnd(user);
    await user.click(within(dialog).getByRole('button', { name: 'Terminar relación' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No tienes permiso para esta acción.');
  });
});
