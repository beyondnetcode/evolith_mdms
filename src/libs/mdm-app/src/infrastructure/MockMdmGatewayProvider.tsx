import { withResponseValidation, type MdmGateway } from '@mdm/contracts';
import { MdmMockStore, MockMdmGateway, type MdmSimulationMode } from '@mdm/mock';
import type { NetworkMode, NetworkSettings } from '@suite/contracts';
import { createContext, use, useMemo, type ReactNode } from 'react';
import { MdmGatewayContext } from '../application/gateway-context.ts';
import { useMdmSession } from '../application/session-context.ts';

/*
 * ÚNICO punto de MDM que conoce `@mdm/mock`. Al conectar la API de Party se sustituye este proveedor por uno que
 * entregue un cliente HTTP que implemente `MdmGateway`, y esta dependencia desaparece. La validación de las
 * respuestas en la frontera (`withResponseValidation`) se queda: también envolverá al cliente HTTP.
 */
const globalStore = new MdmMockStore();

/** Costura de pruebas: un almacén propio y un gateway decorado, sin que cada prueba comparta estado. */
export interface MdmTestData {
  readonly store?: MdmMockStore;
  /** Sustituye partes del gateway (p. ej. para forzar un fallo solo al listar). */
  readonly decorateGateway?: (base: MdmGateway) => MdmGateway;
}

export const MdmTestDataContext = createContext<MdmTestData | null>(null);

/** Los modos de red de la suite que MDM simula; el resto se comporta como `normal`. */
function simulationOf(mode: NetworkMode): MdmSimulationMode {
  return mode === 'vacio' || mode === 'error' ? mode : 'normal';
}

interface Props {
  readonly children: ReactNode;
  readonly settings: NetworkSettings;
  /** Quién escribe: queda en la auditoría del mock. */
  readonly actor: string;
}

export function MockMdmGatewayProvider({ children, settings, actor }: Props) {
  const testData = use(MdmTestDataContext);
  const store = testData?.store ?? globalStore;
  const decorate = testData?.decorateGateway;
  // El mock aplica la matriz supuesta y responde `403` como lo hará el servidor (SU-MDM-02).
  const { role } = useMdmSession();
  const value = useMemo(() => {
    const mock = new MockMdmGateway({ store, latencyMs: settings.latencyMs, mode: simulationOf(settings.mode), actor, role });
    return withResponseValidation(decorate === undefined ? mock : decorate(mock));
  }, [store, decorate, settings.latencyMs, settings.mode, actor, role]);
  return <MdmGatewayContext value={value}>{children}</MdmGatewayContext>;
}
