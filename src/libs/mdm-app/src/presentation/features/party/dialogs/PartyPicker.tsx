import { isTerminalPartyStatus, type PartySummary } from '@mdm/contracts';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useMdmGateway } from '../../../../application/gateway-context.ts';
import { mdmQueries } from '../../../../application/queries.ts';
import { useMdmSession } from '../../../../application/session-context.ts';
import { AsyncCombobox, type ComboboxResults } from '../../../common/AsyncCombobox.tsx';
import { RELATIONSHIP_TEXTS as T } from '../texts.ts';

/** Caracteres mínimos para buscar y espera tras la última tecla, para no lanzar una búsqueda por letra. */
const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

function useDebounced(value: string): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return settled;
}

/** La organización elegida: su id viaja en R-02; el texto es lo que se ve. */
export interface PickedParty {
  readonly id: string;
  readonly label: string;
}

interface Props {
  readonly fieldId: string;
  /** La de la ficha: no se ofrece (`INV-PTY-12`). */
  readonly excludeId: string;
  readonly picked: PickedParty | null;
  readonly onPick: (party: PickedParty | null) => void;
  readonly error: string | undefined;
  readonly readOnly: boolean;
}

export function partyOptionLabel(party: Pick<PartySummary, 'code' | 'legalName' | 'status'>): string {
  return party.status === 'Suspended' ? T.suspendedOption(party.code, party.legalName) : `${party.code} · ${party.legalName}`;
}

/**
 * «Otra organización» de D-MDM-06 (US-MDM-011, SU-MDM-08): se busca en el servidor (P-01) por código, nombres o RUC,
 * nunca escribiendo su id. Solo se ofrecen organizaciones activas o suspendidas y nunca la de la ficha. Escribir
 * después de elegir descarta la elección.
 */
export function PartyPicker({ fieldId, excludeId, picked, onPick, error, readOnly }: Props) {
  const gateway = useMdmGateway();
  const { role } = useMdmSession();
  const [text, setText] = useState(picked?.label ?? '');
  const settled = useDebounced(text.trim());
  const searching = picked === null && settled.length >= MIN_CHARS;
  const search = useQuery({ ...mdmQueries.partySearch(gateway, role, settled), enabled: searching });
  const typing = picked === null && text.trim() !== settled;

  const results: ComboboxResults = !searching
    ? { kind: typing && text.trim().length >= MIN_CHARS ? 'loading' : 'idle' }
    : typing || search.isPending
      ? { kind: 'loading' }
      : search.isError
        ? { kind: 'error' }
        : {
            kind: 'ready',
            options: search.data.items
              .filter((party) => party.id !== excludeId && !isTerminalPartyStatus(party.status))
              .map((party) => ({ id: party.id, label: partyOptionLabel(party) })),
          };

  return (
    <AsyncCombobox
      label={T.otherParty}
      fieldId={fieldId}
      required
      help={T.otherPartyHelp}
      error={error}
      text={text}
      onTextChange={(next) => {
        setText(next);
        if (picked !== null) onPick(null);
      }}
      results={results}
      onSelect={(option) => {
        setText(option.label);
        onPick({ id: option.id, label: option.label });
      }}
      onRetry={() => void search.refetch()}
      emptyText={T.noMatches}
      countText={T.matches}
      readOnly={readOnly}
    />
  );
}
