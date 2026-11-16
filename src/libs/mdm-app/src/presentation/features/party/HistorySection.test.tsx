import type { MdmGateway } from '@mdm/contracts';
import { MdmMockStore, ORG_PARTY_ID } from '@mdm/mock';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { overrideGateway } from '../../../testing/override-gateway.ts';
import { openPartySection } from '../../../testing/party-fixtures.ts';

describe('Historial derivado (UX-MDM-001 §5.4; SU-MDM-11, G-565)', () => {
  it('avisa de que no es completo y lista alta, última actualización y lo terminado, lo más reciente primero', async () => {
    const store = new MdmMockStore();
    const organizacion = store.parties.get(ORG_PARTY_ID);
    const piura = organizacion?.establishments.find((item) => item.code === 'PIURA');
    if (organizacion === undefined || piura === undefined) throw new Error('Semilla inesperada');
    Object.assign(piura, { isClosed: true, isActive: false, closedAt: '2026-01-15T15:00:00.000+00:00', closedBy: 'aarroyo' });
    organizacion.roles.push({ roleId: 'd0000000-0000-4000-8000-000000000555', roleTypeCode: 'CUSTOMER', status: 'Terminated', validFrom: '2024-01-01', validTo: '2025-12-31' });
    await openPartySection('ORG', { store, section: 'historial' });
    expect(screen.getByRole('heading', { level: 2, name: 'Historial de ORG' })).toBeInTheDocument();
    expect(screen.getByText('El historial completo no está disponible.')).toBeInTheDocument();
    expect(screen.getByText(/No constan los cambios de nombre, las suspensiones ni las reactivaciones\./)).toBeInTheDocument();

    const timeline = await screen.findByRole('list', { name: 'Historial de ORG' });
    const items = within(timeline)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(items).toHaveLength(5);
    expect(items[0]).toMatch(/^Última actualización de la organización \(sin detalle de qué cambió\).*por aarroyo$/);
    expect(items[1]).toMatch(/^Establecimiento PIURA cerrado.*por aarroyo$/);
    expect(items[2]).toBe('Rol Cliente terminadoVigente hasta el 31/12/2025');
    expect(items[3]).toMatch(/^Relación terminada: es representada de CARGA-SUR · CARGA SUR E\.I\.R\.L\.Vigente hasta el 30\/06\/2025$/);
    expect(items[4]).toMatch(/^Alta de la organización.*por carga-inicial$/);
  });

  it('una referencia desvinculada aparece con su objeto; no se inventan eventos de lo vigente', async () => {
    const store = new MdmMockStore();
    const [reference] = store.externalReferences.values();
    if (reference === undefined) throw new Error('Semilla inesperada');
    Object.assign(reference, { syncStatus: 'Unlinked', updatedAt: '2026-10-01T14:00:00.000+00:00', updatedBy: 'integrador-erp' });
    await openPartySection('ORG', { store, section: 'historial' });
    const timeline = await screen.findByRole('list', { name: 'Historial de ORG' });
    expect(within(timeline).getByText('Referencia externa ERP / PRD-100 / COMPANY / 1000 desvinculada (Organización ORG)')).toBeInTheDocument();
    // La referencia pendiente de Piura y la relación vigente con la naviera no son eventos.
    expect(within(timeline).queryByText(/1000-02/)).not.toBeInTheDocument();
    expect(within(timeline).queryByText(/NAVIERA/)).not.toBeInTheDocument();
  });

  it('solo el alta: el texto de §6.4', async () => {
    await openPartySection('ANDINA-FOODS', { section: 'historial' });
    expect(await screen.findByText(/^Solo consta el alta del \d{2}\/\d{2}\/\d{4} por carga-inicial\.$/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Historial de ANDINA-FOODS' })).not.toBeInTheDocument();
  });

  it('si no se pueden leer las relaciones, no presenta una línea de tiempo parcial como completa', async () => {
    const decorateGateway = (base: MdmGateway) => overrideGateway(base, { listRelationships: () => Promise.reject(new Error('caída')) });
    await openPartySection('ORG', { section: 'historial', decorateGateway });
    expect(await screen.findByRole('alert')).toHaveTextContent('el historial');
    expect(screen.queryByRole('list', { name: 'Historial de ORG' })).not.toBeInTheDocument();
  });
});
