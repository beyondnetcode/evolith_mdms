import type { SyncStatus } from '@mdm/contracts';
import type { MdmIconName } from './MdmIcon.tsx';
import { StatusTag, type TagTone } from './StatusTag.tsx';

/**
 * Estado de sincronización de una referencia externa (UI-MDM-001 §2.4): color, icono y texto. `SyncFailed` no lleva
 * causa ni reintento: el contrato no los expone (SU-MDM-17, G-568).
 */
export const SYNC_STATUS_DISPLAY: Readonly<Record<SyncStatus, { readonly tone: TagTone; readonly icon: MdmIconName; readonly text: string }>> = {
  Linked: { tone: 'ready', icon: 'link', text: 'Vinculada' },
  PendingSync: { tone: 'progress', icon: 'sync', text: 'Pendiente de sincronizar' },
  SyncFailed: { tone: 'block', icon: 'sync_problem', text: 'Falló la sincronización' },
  Unlinked: { tone: 'outline', icon: 'link_off', text: 'Desvinculada' },
};

export function SyncStatusTag({ syncStatus }: { readonly syncStatus: SyncStatus }) {
  const display = SYNC_STATUS_DISPLAY[syncStatus];
  return <StatusTag tone={display.tone} icon={display.icon} text={display.text} />;
}
