import { MdmProblemError, type MdmProblem } from '@mdm/contracts';
import { MdmMockStore } from '@mdm/mock';
import { screen } from '@testing-library/react';
import { renderMdm, type MdmRenderOptions } from './mdm-harness.tsx';

/*
 * Utilidades de las pruebas de la ficha (P-MDM-02): abrir una organización de la semilla en una sección y fabricar
 * respuestas de error del contrato. SOLO PARA PRUEBAS.
 */

export function partyIdOf(store: MdmMockStore, code: string): string {
  const party = [...store.parties.values()].find((item) => item.code === code);
  if (party === undefined) throw new Error(`No existe ${code} en la semilla`);
  return party.id;
}

export interface OpenPartyOptions extends Omit<MdmRenderOptions, 'path'> {
  /** `?seccion=`: `roles`, `establecimientos`… */
  readonly section?: string;
}

/** Abre la ficha de `code` (con un almacén propio, o el dado) y espera a que cargue. */
export async function openPartySection(code: string, options: OpenPartyOptions = {}) {
  const store = options.store ?? new MdmMockStore();
  const partyId = partyIdOf(store, code);
  const query = options.section === undefined ? '' : `?seccion=${options.section}`;
  const rendered = renderMdm({ ...options, store, path: `/mdm/organizaciones/${partyId}${query}` });
  await screen.findByRole('heading', { level: 1, name: code });
  return { ...rendered, partyId };
}

/** `403` `auth.forbidden` como lo dará el servidor. */
export function forbiddenError(): MdmProblemError {
  const problem: MdmProblem = { title: 'Prohibido', detail: null, instance: 'prueba-0403', errors: {}, status: 403, code: 'auth.forbidden' };
  return new MdmProblemError(problem, 'prueba-0403');
}
