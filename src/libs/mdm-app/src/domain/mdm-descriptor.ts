import { MDM_ROLE_LABEL, isMdmRole } from '@mdm/contracts';
import type { SystemDescriptor } from '@suite/contracts';

/**
 * MDM tal como lo ve la suite (D-026, D-044): su sigla y la etiqueta de los roles que MDM conoce. Un perfil con
 * un rol que MDM no conoce no abre MDM (frontera validada).
 */
export const MDM_DESCRIPTOR: SystemDescriptor = {
  code: 'MDM',
  roleLabel: (role) => (isMdmRole(role) ? MDM_ROLE_LABEL[role] : null),
};
