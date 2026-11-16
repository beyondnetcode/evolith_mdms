import type { MdmRole } from '@mdm/contracts';
import { createContext, use } from 'react';
import { can, type MdmAction } from '../domain/permissions.ts';

/** Lo que MDM sabe de la sesión de la suite: el rol vigente y quién lo ejerce. */
export interface MdmSession {
  readonly role: MdmRole;
  readonly displayName: string;
  /** Solo para no ofrecer lo que no se puede hacer: el servidor decide (SU-MDM-02). */
  readonly can: (action: MdmAction) => boolean;
}

export function createMdmSession(role: MdmRole, displayName: string): MdmSession {
  return { role, displayName, can: (action) => can(role, action) };
}

export const MdmSessionContext = createContext<MdmSession | null>(null);

export function useMdmSession(): MdmSession {
  const session = use(MdmSessionContext);
  if (session === null) throw new Error('useMdmSession requiere el contexto de sesión de MDM');
  return session;
}
