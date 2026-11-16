import { mdmModule } from '@mdm/app';
import type { SystemModule } from '@suite/contracts';

/**
 * Sistemas que este anfitrión monta. MDM es el único sistema de este repositorio.
 * Con Module Federation, cada entrada pasa a ser un remote.
 */
export const SYSTEM_REGISTRY: readonly SystemModule[] = [mdmModule];
