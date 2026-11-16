import type { PartyIdentifier } from '@mdm/contracts';
import { StatusTag } from '../../common/StatusTag.tsx';
import { IDENTIFIER_TEXTS as T } from './texts.ts';

/**
 * Estado del identificador (UI-MDM-001 §2.5): vigente (`ready`), vencido el {fecha} (`outline`) o, si su vigencia
 * aún no empieza, vigente desde {fecha} (`quiet`). La vigencia la calcula el servidor (`isCurrent`).
 */
export function IdentifierStatusTag({ identifier }: { readonly identifier: PartyIdentifier }) {
  if (identifier.isCurrent) return <StatusTag tone="ready" icon="check_circle" text={T.current} />;
  if (identifier.validTo !== null) return <StatusTag tone="outline" icon="cancel" text={T.expiredOn(identifier.validTo)} />;
  return <StatusTag tone="quiet" icon="schedule" text={T.startsOn(identifier.validFrom)} />;
}

/** Segunda etiqueta «Primario» (`quiet`, `star`). */
export function PrimaryTag() {
  return <StatusTag tone="quiet" icon="star" text={T.primary} />;
}
