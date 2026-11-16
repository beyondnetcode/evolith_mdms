import type { PartyStatus } from '@mdm/contracts';
import type { MdmIconName } from './MdmIcon.tsx';
import { StatusTag, type TagTone } from './StatusTag.tsx';

/** Estado de la Party (UI-MDM-001 §2.1): tono + icono + texto, en femenino («la organización»). */
export const PARTY_STATUS_DISPLAY: Readonly<Record<PartyStatus, { readonly text: string; readonly tone: TagTone; readonly icon: MdmIconName }>> = {
  Active: { text: 'Activa', tone: 'ready', icon: 'check_circle' },
  Suspended: { text: 'Suspendida', tone: 'attention', icon: 'pause' },
  Archived: { text: 'Archivada', tone: 'outline', icon: 'inventory_2' },
  Merged: { text: 'Fusionada', tone: 'outline', icon: 'merge' },
};

export function PartyStatusTag({ status, size }: { readonly status: PartyStatus; readonly size?: 'compact' | 'regular' }) {
  const display = PARTY_STATUS_DISPLAY[status];
  return <StatusTag tone={display.tone} icon={display.icon} text={display.text} {...(size === undefined ? {} : { size })} />;
}
