import type { Party } from '@mdm/contracts';
import type { PartyCache } from '../../../../application/party-writes.ts';

/** Lo que recibe cada diálogo de la ficha. */
export interface PartyDialogProps {
  /** La ficha vigente en la caché. La versión que se envía es la de apertura, no esta (US-MDM-013). */
  readonly party: Party;
  readonly cache: PartyCache;
  /** Cierra el diálogo; la ficha devuelve el foco al disparador. */
  readonly onClose: () => void;
}
