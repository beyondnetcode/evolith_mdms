import type { Party } from '@mdm/contracts';
import { Button, InlineNotice } from '@sil/ui';
import { PARTY_TEXTS as T } from './texts.ts';

interface Props {
  readonly party: Party;
  /** Solo si la persona puede activarla. */
  readonly onActivate: (() => void) | null;
  readonly activating: boolean;
}

/**
 * Aviso persistente del estado (UX-MDM-001 §5.4; UI-MDM-001 §2.5): suspendida (`warning`, con «Activar» si la
 * persona puede) o archivada y fusionada en solo lectura (`neutral`; DV-03). Sin región en vivo: está al cargar.
 */
export function PartyStateNotice({ party, onActivate, activating }: Props) {
  if (party.status === 'Suspended') {
    return (
      <InlineNotice
        severity="warning"
        title={T.suspendedTitle}
        actions={
          onActivate === null ? undefined : (
            <Button variant="text-inherit" onClick={onActivate} aria-disabled={activating ? true : undefined} aria-busy={activating}>
              {T.activate}
            </Button>
          )
        }
      >
        {T.suspendedBody}
      </InlineNotice>
    );
  }
  if (party.status === 'Archived') return <InlineNotice severity="neutral">{T.archived(party.updatedAt ?? party.createdAt)}</InlineNotice>;
  if (party.status === 'Merged') return <InlineNotice severity="neutral">{T.merged}</InlineNotice>;
  return null;
}
