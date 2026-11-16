import type { MdmGateway } from '@mdm/contracts';
import { createContext, use } from 'react';

/** Puerto de datos de MDM para la presentación: lo provee la infraestructura (hoy, el mock; mañana, la API). */
export const MdmGatewayContext = createContext<MdmGateway | null>(null);

export function useMdmGateway(): MdmGateway {
  const gateway = use(MdmGatewayContext);
  if (gateway === null) throw new Error('useMdmGateway requiere un proveedor de gateway');
  return gateway;
}
