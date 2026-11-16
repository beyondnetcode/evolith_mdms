import type { PartyRole } from '@mdm/contracts';
import { roleDisplayState } from '../../../domain/role-state.ts';
import { StatusTag } from '../../common/StatusTag.tsx';
import { ROLE_TEXTS as T } from './texts.ts';

/**
 * Estado visible del rol (UI-MDM-001 §2.2): vigente (`ready`), fuera de vigencia con su fecha (`quiet`: el texto
 * distingue futuro de vencido, SU-UI-MDM-02), suspendido (`attention`) o terminado (`outline`). La derivación es
 * `roleDisplayState`, en `domain/`.
 */
export function RoleStatusTag({ role, today }: { readonly role: Pick<PartyRole, 'status' | 'isCurrent' | 'validFrom' | 'validTo'>; readonly today: string }) {
  const state = roleDisplayState(role, today);
  switch (state.kind) {
    case 'current':
      return <StatusTag tone="ready" icon="check_circle" text={T.current} />;
    case 'future':
      return <StatusTag tone="quiet" icon="schedule" text={T.future(state.startsOn)} />;
    case 'expired':
      return <StatusTag tone="quiet" icon="schedule" text={T.expired(state.endedOn)} />;
    case 'suspended':
      return <StatusTag tone="attention" icon="pause" text={T.suspended} />;
    case 'terminated':
      return <StatusTag tone="outline" icon="cancel" text={T.terminated} />;
  }
}
