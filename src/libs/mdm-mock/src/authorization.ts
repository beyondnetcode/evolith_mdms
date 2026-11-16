import type { MdmRole } from '@mdm/contracts';

/**
 * Autorización del mock por operación de escritura. SUPUESTO (UX-MDM-001 §2.2, SU-MDM-02, G-314, G-536): el
 * contrato aún no tiene autorización —basta un portador válido— y reserva `403` `auth.forbidden` en cada
 * operación del OpenAPI. El mock aplica la matriz rol × acción supuesta para que la interfaz pinte el `403` que
 * dará el servidor: ocultar una acción en la interfaz no es control de acceso (ADR-0165 P-SEC-01). Sin rol (las
 * pruebas del propio mock) se comporta como el contrato de hoy y no comprueba nada.
 */
export const MOCK_WRITE_OPERATIONS = [
  'P-02',
  'P-04',
  'P-05',
  'P-06',
  'P-07',
  'P-09',
  'P-10',
  'P-12',
  'P-13',
  'P-14',
  'P-15',
  'P-18',
  'P-19',
  'P-20',
  'P-21',
  'P-22',
  'R-02',
  'R-04',
  'X-02',
  'X-04',
  'C-05',
  'C-06',
  'C-07',
  'C-08',
  'CO-02',
  'CO-06',
  'PL-03',
  'PL-05',
  'PL-09',
  'PL-10',
  'CD-02',
  'CD-03',
  'CR-02',
  'CR-04',
  'TL-05',
] as const;
export type MockWriteOperation = (typeof MOCK_WRITE_OPERATIONS)[number];

const ANALYST_AND_OWNER: readonly MdmRole[] = ['ANALISTA_DATOS_MAESTROS', 'RESPONSABLE_MDM'];
const OWNER: readonly MdmRole[] = ['RESPONSABLE_MDM'];
const INTEGRATOR: readonly MdmRole[] = ['INTEGRADOR_ERP'];
const GEO_MAINTAINERS: readonly MdmRole[] = ['ANALISTA_DATOS_MAESTROS', 'RESPONSABLE_MDM', 'RESPONSABLE_GEOGRAFIA'];
const GEO_APPROVERS: readonly MdmRole[] = ['ANALISTA_DATOS_MAESTROS', 'RESPONSABLE_MDM', 'RESPONSABLE_GEOGRAFIA'];

const GRANTS: Readonly<Record<MockWriteOperation, readonly MdmRole[]>> = {
  'P-02': ANALYST_AND_OWNER,
  'P-04': ANALYST_AND_OWNER,
  'P-05': OWNER,
  'P-06': OWNER,
  'P-07': OWNER,
  'P-09': ANALYST_AND_OWNER,
  'P-10': OWNER,
  'P-12': ANALYST_AND_OWNER,
  'P-13': ANALYST_AND_OWNER,
  'P-14': ANALYST_AND_OWNER,
  'P-15': OWNER,
  'P-18': ANALYST_AND_OWNER,
  'P-19': ANALYST_AND_OWNER,
  'P-20': ANALYST_AND_OWNER,
  'P-21': ANALYST_AND_OWNER,
  'P-22': OWNER,
  'R-02': ANALYST_AND_OWNER,
  'R-04': ANALYST_AND_OWNER,
  'X-02': INTEGRATOR,
  'X-04': INTEGRATOR,
  // Mantenimiento del catálogo de tipos de rol (D-046): SUPUESTO hasta que UMS conceda el permiso (G-555, G-560).
  'C-05': ANALYST_AND_OWNER,
  'C-06': ANALYST_AND_OWNER,
  'C-07': ANALYST_AND_OWNER,
  'C-08': ANALYST_AND_OWNER,
  'CO-02': GEO_APPROVERS,
  'CO-06': GEO_APPROVERS,
  'PL-03': GEO_MAINTAINERS,
  'PL-05': GEO_MAINTAINERS,
  'PL-09': GEO_MAINTAINERS,
  'PL-10': GEO_MAINTAINERS,
  'CD-02': GEO_MAINTAINERS,
  'CD-03': GEO_APPROVERS,
  'CR-02': GEO_MAINTAINERS,
  'CR-04': GEO_MAINTAINERS,
  'TL-05': GEO_MAINTAINERS,
};

/** ¿Puede el rol ejecutar la operación? Sin rol no se comprueba (contrato vigente, §8). */
export function isGranted(role: MdmRole | null, operation: MockWriteOperation): boolean {
  return role === null || GRANTS[operation].includes(role);
}
