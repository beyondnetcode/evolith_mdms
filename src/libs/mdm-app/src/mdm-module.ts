import type { SystemModule } from '@suite/contracts';
import { lazy } from 'react';
import { MDM_DESCRIPTOR } from './domain/mdm-descriptor.ts';
import { MDM_ROUTE_ROOTS } from './presentation/mdm-roots.ts';

/**
 * MDM como sistema montable (D-026, D-044). `Entry` se carga con `React.lazy(import())`, en su propio chunk: es la
 * frontera que se convertirá en el remote de Module Federation (G-241).
 */
export const mdmModule: SystemModule = {
  ...MDM_DESCRIPTOR,
  routeRoots: MDM_ROUTE_ROOTS,
  Entry: lazy(() => import('./mdm-entry.tsx')),
};
