import { MDM_ROLE_LABEL } from '@mdm/contracts';
import { SystemFrame, type SystemDestination, type SystemPrimaryAction } from '@suite/header';
import type { ReactNode } from 'react';
import { useMdmSession } from '../../application/session-context.ts';
import { ORGANIZATIONS_TEXTS } from '../features/organizations/texts.ts';
import { ROLE_TYPE_TEXTS } from '../features/role-types/texts.ts';
import { GEOGRAPHY_PATH, NEW_ORGANIZATION_PATH, ORGANIZATIONS_PATH, ROLE_TYPES_PATH } from '../mdm-roots.ts';

/**
 * Destinos de MDM: «Organizaciones» (P-MDM-01), activo también en la ficha y en el alta, y «Tipos de rol» (P-MDM-04,
 * D-046), el catálogo que se mantiene desde MDM. Los dos se ven para todos los roles: consultar es de todos.
 */
const DESTINATIONS: readonly SystemDestination[] = [
  { path: ORGANIZATIONS_PATH, label: ORGANIZATIONS_TEXTS.title, icon: 'group' },
  { path: ROLE_TYPES_PATH, label: ROLE_TYPE_TEXTS.title, icon: 'list_alt' },
  { path: GEOGRAPHY_PATH, label: 'Geografía', icon: 'public' },
];

const NEW_ORGANIZATION: SystemPrimaryAction = { path: NEW_ORGANIZATION_PATH, label: ORGANIZATIONS_TEXTS.newOrganization, icon: 'add' };

/**
 * Marco de MDM (UI-MDM-001 §3.1): el mismo marco común que SIL (`SystemFrame` de `@suite/header`, ADR-0245 D4.1),
 * con la cabecera de la suite y el riel de MDM (G-584). El FAB «Nueva organización» lo pinta el riel y solo para
 * quien puede registrar según la matriz de UX-MDM-001 §2.2 (analista y responsable; SU-MDM-02). Sin pie
 * institucional: pantallas densas, como SIL.
 */
export function MdmShell({ site, children }: { readonly site: string; readonly children: ReactNode }) {
  const session = useMdmSession();
  return (
    <SystemFrame
      systemName="MDM"
      destinations={DESTINATIONS}
      primaryAction={session.can('organization.register') ? NEW_ORGANIZATION : undefined}
      signIn={{ fullName: session.displayName, roleLabel: MDM_ROLE_LABEL[session.role], site }}
    >
      <div className="mx-auto w-full max-w-400">{children}</div>
    </SystemFrame>
  );
}
