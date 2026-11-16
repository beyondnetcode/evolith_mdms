import { StatusTag } from '../../common/StatusTag.tsx';
import { ROLE_TYPE_TEXTS as T } from './texts.ts';

/**
 * Estado del tipo de rol (UI-MDM-001 §3.7): activo (`ready`, icono de verificación en `success`) o inactivo (`quiet`,
 * pausa), como el establecimiento. El estado se lee por el texto; el icono es decorativo y el color no es lo único.
 */
export function RoleTypeStatusTag({ isActive }: { readonly isActive: boolean }) {
  return isActive ? <StatusTag tone="ready" icon="check_circle" text={T.active} /> : <StatusTag tone="quiet" icon="pause" text={T.inactive} />;
}
