import type { MdmRole } from '@mdm/contracts';

/**
 * Matriz rol × acción de UX-MDM-001 §2.2. SUPUESTO (SU-MDM-02, G-560, G-314, G-536): expresa la intención de
 * diseño y solo sirve para no ofrecer lo que no se puede hacer. Ocultar una acción NO es control de acceso: el
 * servidor decide y la interfaz pinta su `403` (ADR-0165 P-SEC-01).
 */
export const MDM_ACTIONS = [
  'organization.register',
  'organization.rename',
  'organization.suspend',
  'organization.archive',
  'identifier.add',
  'identifier.expire',
  'role.assign',
  'role.terminate',
  'establishment.maintain',
  'establishment.close',
  'relationship.maintain',
  'externalReference.maintain',
  'roleType.maintain',
  'geography.maintain',
  'geography.approve',
] as const;
export type MdmAction = (typeof MDM_ACTIONS)[number];

const ANALYST_AND_OWNER: readonly MdmRole[] = ['ANALISTA_DATOS_MAESTROS', 'RESPONSABLE_MDM'];
const OWNER: readonly MdmRole[] = ['RESPONSABLE_MDM'];

const GRANTS: Readonly<Record<MdmAction, readonly MdmRole[]>> = {
  'organization.register': ANALYST_AND_OWNER,
  'organization.rename': ANALYST_AND_OWNER,
  'organization.suspend': OWNER,
  'organization.archive': OWNER,
  'identifier.add': ANALYST_AND_OWNER,
  'identifier.expire': OWNER,
  'role.assign': ANALYST_AND_OWNER,
  'role.terminate': OWNER,
  'establishment.maintain': ANALYST_AND_OWNER,
  'establishment.close': OWNER,
  'relationship.maintain': ANALYST_AND_OWNER,
  'externalReference.maintain': ['INTEGRADOR_ERP'],
  // Alta, edición, desactivación y reactivación de tipos de rol (C-05 a C-08, D-046). SUPUESTO hasta que UMS
  // conceda el permiso (G-555, G-560).
  'roleType.maintain': ANALYST_AND_OWNER,
  // La correspondencia ANALISTA_DATOS_MAESTROS → ANALISTA_MDM y estos permisos siguen pendientes de ratificación (G-622).
  'geography.maintain': ['ANALISTA_DATOS_MAESTROS', 'RESPONSABLE_MDM', 'RESPONSABLE_GEOGRAFIA'],
  // Permiso provisional para que el analista mantenga el árbol geográfico manual; G-622 sigue abierto.
  'geography.approve': ['ANALISTA_DATOS_MAESTROS', 'RESPONSABLE_MDM', 'RESPONSABLE_GEOGRAFIA'],
};

/** Buscar y ver la ficha es de todos los roles: no figura en la matriz. */
export function can(role: MdmRole, action: MdmAction): boolean {
  return GRANTS[action].includes(role);
}
