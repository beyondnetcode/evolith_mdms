/**
 * Roles de MDM en la sesión de la suite. SUPUESTO (UX-MDM-001 §2.1, SU-MDM-01 y SU-MDM-02, G-560): las cuatro
 * personas de uso se infieren del contrato; no hay PRD que las respalde. Los códigos se escriben como los de SIL
 * (`JEFATURA`) porque los publica la sesión, y son lo único que MDM interpreta del perfil. `RESPONSABLE_GEOGRAFIA` es el
 * responsable del catálogo geográfico de D-048 (API-MDM-003 §8.2, rol SUPUESTO hasta que UMS lo publique, G-622).
 */
export const MDM_ROLES = ['ANALISTA_DATOS_MAESTROS', 'RESPONSABLE_MDM', 'INTEGRADOR_ERP', 'CONSULTOR', 'RESPONSABLE_GEOGRAFIA'] as const;
export type MdmRole = (typeof MDM_ROLES)[number];

export const MDM_ROLE_LABEL: Readonly<Record<MdmRole, string>> = {
  ANALISTA_DATOS_MAESTROS: 'Analista de datos maestros',
  RESPONSABLE_MDM: 'Responsable de MDM',
  INTEGRADOR_ERP: 'Integrador del ERP',
  CONSULTOR: 'Consultor',
  RESPONSABLE_GEOGRAFIA: 'Responsable del catálogo geográfico',
};

export function isMdmRole(value: unknown): value is MdmRole {
  return typeof value === 'string' && (MDM_ROLES as readonly string[]).includes(value);
}
