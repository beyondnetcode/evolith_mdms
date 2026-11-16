import { MdmProblemError, type LinkExternalReferenceRequest, type MdmGateway } from '@mdm/contracts';
import { MdmMockStore, ORG_PARTY_ID } from '@mdm/mock';
import { WIDTHS } from '@sil/ui/testing';
import { screen, waitFor, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { installDialogPolyfill } from '../../../testing/dialog-polyfill.ts';
import { overrideGateway } from '../../../testing/override-gateway.ts';
import { forbiddenError, openPartySection, type OpenPartyOptions } from '../../../testing/party-fixtures.ts';

let polyfill: ReturnType<typeof installDialogPolyfill>;
beforeAll(() => {
  polyfill = installDialogPolyfill();
});
afterAll(() => {
  polyfill.uninstall();
});

const openReferences = (code: string, options: Omit<OpenPartyOptions, 'section'> = {}) =>
  openPartySection(code, { role: 'INTEGRADOR_ERP', ...options, section: 'referencias' });

type User = Awaited<ReturnType<typeof openReferences>>['user'];

async function rowWithKey(code: string, key: string): Promise<HTMLElement> {
  const table = await screen.findByRole('table', { name: `Referencias externas de ${code}` });
  const row = within(table)
    .getAllByRole('row')
    .find((item) => within(item).queryByText(key) !== null);
  if (row === undefined) throw new Error(`Sin fila para ${key}`);
  return row;
}

async function openLink(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Vincular' }));
  const dialog = await screen.findByRole('dialog', { name: 'Vincular referencia externa' });
  await waitFor(() => expect(within(dialog).getByRole('radio', { name: 'La organización (ORG)' })).toHaveFocus());
  return dialog;
}

async function fillKey(user: User, dialog: HTMLElement, key: { system: string; instance: string; type: string; value: string }) {
  await user.type(within(dialog).getByRole('textbox', { name: 'Sistema (obligatorio)' }), key.system);
  await user.type(within(dialog).getByRole('textbox', { name: 'Instancia (obligatorio)' }), key.instance);
  await user.type(within(dialog).getByRole('textbox', { name: 'Tipo de objeto (obligatorio)' }), key.type);
  await user.type(within(dialog).getByRole('textbox', { name: 'Clave (obligatorio)' }), key.value);
}

describe('Referencias externas: lista (US-MDM-012, UI-MDM-001 §2.4)', () => {
  it('las de la organización y sus establecimientos, con estado en color, icono y texto', async () => {
    await openReferences('ORG', { role: 'CONSULTOR' });
    expect(screen.getByRole('heading', { level: 2, name: 'Referencias externas de ORG' })).toBeInTheDocument();
    const party = await rowWithKey('ORG', '1000');
    expect(within(party).getByText('Organización ORG')).toBeInTheDocument();
    expect(within(party).getByText('Vinculada')).toBeInTheDocument();
    expect(within(party).getByText('7')).toBeInTheDocument();
    const branch = await rowWithKey('ORG', '1000-02');
    expect(within(branch).getByText('Establecimiento PIURA')).toBeInTheDocument();
    expect(within(branch).getByText('Pendiente de sincronizar')).toBeInTheDocument();
    expect(within(branch).getByText('—')).toBeInTheDocument();
    // El consultor solo lee: ni «Vincular» ni menús (las referencias son del integrador, SU-MDM-02).
    expect(screen.queryByRole('button', { name: 'Vincular' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Más acciones de la clave/ })).not.toBeInTheDocument();
  });

  it('el analista tampoco vincula; sin referencias, el vacío de §6.4; en compact, tarjetas', async () => {
    await openReferences('ACME', { role: 'ANALISTA_DATOS_MAESTROS', width: WIDTHS.compact });
    expect(await screen.findByText('Esta organización aún no tiene claves del ERP.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vincular' })).not.toBeInTheDocument();
  });

  it('SyncFailed se marca como error y Unlinked queda sin menú (terminal)', async () => {
    const store = new MdmMockStore();
    const [linked, pending] = store.externalReferences.values();
    if (linked === undefined || pending === undefined) throw new Error('Semilla inesperada');
    linked.syncStatus = 'Unlinked';
    pending.syncStatus = 'SyncFailed';
    await openReferences('ORG', { store });
    expect(within(await rowWithKey('ORG', '1000')).getByText('Desvinculada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Más acciones de la clave 1000' })).not.toBeInTheDocument();
    expect(within(await rowWithKey('ORG', '1000-02')).getByText('Falló la sincronización')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Más acciones de la clave 1000-02' })).toBeInTheDocument();
  });

  it('el detalle de cada establecimiento muestra sus referencias (UX-MDM-001 §5.4)', async () => {
    const { user } = await openPartySection('ORG', { role: 'CONSULTOR', section: 'establecimientos' });
    const list = await screen.findByRole('list', { name: 'Establecimientos de ORG' });
    let detail = screen.getByRole('region', { name: 'Establecimiento CALLAO' });
    expect(await within(detail).findByText('Sin claves del ERP.')).toBeInTheDocument();
    await user.click(within(list).getByRole('button', { name: /PIURA/ }));
    detail = screen.getByRole('region', { name: 'Establecimiento PIURA' });
    expect(await within(detail).findByText('ERP / PRD-100 / BRANCH / 1000-02')).toBeInTheDocument();
    expect(within(detail).getByText('Pendiente de sincronizar')).toBeInTheDocument();
  });
});

describe('D-MDM-07 Vincular referencia externa (US-MDM-012)', () => {
  it('vincula a un establecimiento no cerrado; snackbar y la fila nueva «Vinculada»', async () => {
    const linked = vi.fn<(request: LinkExternalReferenceRequest) => void>();
    const decorateGateway = (base: MdmGateway) =>
      overrideGateway(base, {
        linkExternalReference: (request) => {
          linked(request);
          return base.linkExternalReference(request);
        },
      });
    const { user, store } = await openReferences('ORG', { decorateGateway });
    const dialog = await openLink(user);
    await user.click(within(dialog).getByRole('radio', { name: 'Establecimiento CALLAO · Sede Callao' }));
    await fillKey(user, dialog, { system: 'ERP', instance: 'PRD-100', type: 'BRANCH', value: '1000-01' });
    await user.click(within(dialog).getByRole('button', { name: 'Vincular' }));
    expect(await screen.findByText('Referencia vinculada.')).toBeInTheDocument();
    const callaoId = store.parties.get(ORG_PARTY_ID)?.establishments.find((item) => item.code === 'CALLAO')?.id;
    expect(linked).toHaveBeenCalledWith({
      systemCode: 'ERP',
      systemInstance: 'PRD-100',
      externalObjectType: 'BRANCH',
      externalKey: '1000-01',
      mdmObjectType: 'ESTABLISHMENT',
      mdmObjectId: callaoId,
    });
    const row = await waitFor(() => rowWithKey('ORG', '1000-01'));
    expect(within(row).getByText('Establecimiento CALLAO')).toBeInTheDocument();
    expect(within(row).getByText('Vinculada')).toBeInTheDocument();
    expect(store.parties.get(ORG_PARTY_ID)?.version).toBe(7);
  });

  it('campos obligatorios: resumen de errores, sin enviar; los cerrados no se ofrecen', async () => {
    const store = new MdmMockStore();
    const piura = store.parties.get(ORG_PARTY_ID)?.establishments.find((item) => item.code === 'PIURA');
    if (piura !== undefined) piura.isClosed = true;
    const { user } = await openReferences('ORG', { store });
    const dialog = await openLink(user);
    expect(within(dialog).queryByRole('radio', { name: /PIURA/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Vincular' }));
    for (const message of ['Escribe el sistema.', 'Escribe la instancia.', 'Escribe el tipo de objeto.', 'Escribe la clave.']) {
      expect(await within(dialog).findByRole('link', { name: message })).toBeInTheDocument();
    }
  });

  it('INV-PTY-13: la clave ya vinculada (aunque desvinculada) va en «Clave» y ofrece ver a qué está vinculada', async () => {
    const { user } = await openReferences('ORG');
    const dialog = await openLink(user);
    await fillKey(user, dialog, { system: 'ERP', instance: 'PRD-100', type: 'COMPANY', value: '1000' });
    await user.click(within(dialog).getByRole('button', { name: 'Vincular' }));
    expect(
      await within(dialog).findByRole('link', { name: 'La clave 1000 de ERP ya está vinculada a otro objeto, aunque esté desvinculada.' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Clave (obligatorio)' })).toHaveAttribute('aria-invalid', 'true');
    expect(await within(dialog).findByText('Está vinculada a la organización ORG.')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Ver a qué está vinculada' })).toHaveAttribute('href', `/mdm/organizaciones/${ORG_PARTY_ID}?seccion=referencias`);
  });

  it('409 target_not_active y 403: aviso en el formulario, que no se cierra', async () => {
    let next: MdmProblemError = new MdmProblemError(
      { title: 'Prueba', detail: null, instance: 'prueba', errors: {}, status: 409, code: 'external_reference.target_not_active' },
      'prueba',
    );
    const decorateGateway = (base: MdmGateway) => overrideGateway(base, { linkExternalReference: () => Promise.reject(next) });
    const { user } = await openReferences('ORG', { decorateGateway });
    const dialog = await openLink(user);
    await user.click(within(dialog).getByRole('radio', { name: 'Establecimiento CALLAO · Sede Callao' }));
    await fillKey(user, dialog, { system: 'ERP', instance: 'PRD-100', type: 'BRANCH', value: '1000-01' });
    await user.click(within(dialog).getByRole('button', { name: 'Vincular' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No se puede vincular: el establecimiento está cerrado.');

    next = forbiddenError();
    await user.click(within(dialog).getByRole('button', { name: 'Vincular' }));
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('No tienes permiso para esta acción.'));
    expect(screen.getByRole('dialog', { name: 'Vincular referencia externa' })).toBeInTheDocument();
  });
});

describe('D-MDM-12 Desvincular referencia externa (US-MDM-012)', () => {
  async function openUnlink(user: User, key: string) {
    await user.click(await screen.findByRole('button', { name: `Más acciones de la clave ${key}` }));
    await user.click(screen.getByRole('menuitem', { name: 'Desvincular' }));
    const dialog = await screen.findByRole('dialog', { name: `¿Desvincular la clave ${key}?` });
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    return dialog;
  }

  it('desvincula con la versión de la referencia; queda «Desvinculada», sin menú, y el foco vuelve a la sección', async () => {
    const unlinked = vi.fn<(version: number) => void>();
    const decorateGateway = (base: MdmGateway) =>
      overrideGateway(base, {
        unlinkExternalReference: (id, ifMatch) => {
          unlinked(ifMatch);
          return base.unlinkExternalReference(id, ifMatch);
        },
      });
    const { user } = await openReferences('ORG', { decorateGateway });
    const dialog = await openUnlink(user, '1000');
    expect(dialog).toHaveTextContent('ERP PRD-100 dejará de corresponder a la organización ORG. La clave no podrá vincularse a otro objeto.');
    await user.click(within(dialog).getByRole('button', { name: 'Desvincular' }));
    expect(await screen.findByText('Referencia desvinculada.')).toBeInTheDocument();
    expect(unlinked).toHaveBeenCalledWith(1);
    expect(await within(await rowWithKey('ORG', '1000')).findByText('Desvinculada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Más acciones de la clave 1000' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Referencias externas de ORG' })).toHaveFocus());
  });

  it('412 de la referencia: «Recargar y revisar» y desvincula sobre la versión nueva; 403 se explica', async () => {
    const store = new MdmMockStore();
    let forbid = false;
    const decorateGateway = (base: MdmGateway) =>
      overrideGateway(base, { unlinkExternalReference: (...args) => (forbid ? Promise.reject(forbiddenError()) : base.unlinkExternalReference(...args)) });
    const { user } = await openReferences('ORG', { store, decorateGateway });
    let dialog = await openUnlink(user, '1000-02');
    const [, pending] = store.externalReferences.values();
    if (pending === undefined) throw new Error('Semilla inesperada');
    pending.version += 1;
    await user.click(within(dialog).getByRole('button', { name: 'Desvincular' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Otra persona cambió esta referencia mientras la revisabas.');
    await user.click(within(alert).getByRole('button', { name: 'Recargar y revisar' }));
    await waitFor(() => expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument());

    forbid = true;
    await user.click(within(dialog).getByRole('button', { name: 'Desvincular' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No tienes permiso para esta acción.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    forbid = false;
    dialog = await openUnlink(user, '1000-02');
    await user.click(within(dialog).getByRole('button', { name: 'Desvincular' }));
    expect(await screen.findByText('Referencia desvinculada.')).toBeInTheDocument();
  });
});
