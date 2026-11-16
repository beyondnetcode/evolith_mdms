import type { PartyRelationship } from '@mdm/contracts';
import { DateField, TextAreaField, formatCivilDate, useSnackbar } from '@sil/ui';
import { useCallback, useId, useRef, useState } from 'react';
import { useMdmGateway } from '../../../../application/gateway-context.ts';
import { useLinkCache, useLinkVersion } from '../../../../application/link-writes.ts';
import { usePartyNames } from '../../../../application/party-names.ts';
import { attemptWrite } from '../../../../application/party-writes.ts';
import { limaToday } from '../../../../domain/field-rules.ts';
import { viewFrom } from '../../../../domain/relationship-state.ts';
import { checkTerminationDate, defaultTerminationDate } from '../../../../domain/role-state.ts';
import { ConfirmDialog } from '../../../common/dialogs/ConfirmDialog.tsx';
import { useSubmitAction, type SubmitResult } from '../../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../../common/dialogs/WriteNotice.tsx';
import { fieldMessage } from '../../../common/field-messages.ts';
import { logProblem } from '../../../common/problem-text.ts';
import { partyNameText, useRelationshipKinds } from '../RelationshipsPanel.tsx';
import { RELATIONSHIP_TEXTS as T } from '../texts.ts';
import type { PartyDialogProps } from './party-dialog.ts';

const REASON_MAX = 500;

interface Props extends PartyDialogProps {
  readonly relationship: PartyRelationship;
}

/**
 * D-MDM-11 «Terminar relación» (US-MDM-011; UX-MDM-001 §5.6 y §6.2): confirmación terminal con las dos organizaciones
 * y el tipo, «Termina el» (por defecto hoy, dentro de su vigencia) y motivo opcional, porque R-04 los recibe. Envía la
 * versión de la relación, no la de la Party: es su propio agregado; un `412` es de la relación (US-MDM-013). Terminar
 * no cambia la versión de ninguna de las dos organizaciones. Foco inicial en «Cancelar».
 */
export function EndRelationshipDialog({ party, relationship, onClose }: Props) {
  const gateway = useMdmGateway();
  const snackbar = useSnackbar();
  const links = useLinkCache(party.id);
  const dateId = useId();
  const today = limaToday();
  const kinds = useRelationshipKinds();
  const { otherPartyId } = viewFrom(relationship, party.id);
  const other = partyNameText(usePartyNames([otherPartyId]).get(otherPartyId));
  const read = useCallback(() => links.readRelationship(relationship.id), [links, relationship.id]);
  const loaded = useLinkVersion(relationship.version, read);
  const [validTo, setValidTo] = useState(() => defaultTerminationDate(relationship, today));
  const [reason, setReason] = useState('');
  const [dateError, setDateError] = useState<string | undefined>(undefined);
  const saved = useRef(false);
  const kind = kinds.get(relationship.kindCode);
  const names = relationship.fromPartyId === party.id ? { from: party.code, to: other } : { from: other, to: party.code };

  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    if (saved.current) return { kind: 'idle' };
    const issue = checkTerminationDate(validTo, relationship, today);
    setDateError(issue === null ? undefined : fieldMessage('terminationDate', issue));
    if (issue !== null) {
      document.getElementById(dateId)?.focus();
      return { kind: 'invalid' };
    }
    const request = { validTo: validTo === '' ? today : validTo, reason: reason.trim() === '' ? null : reason.trim().slice(0, REASON_MAX) };
    const outcome = await attemptWrite(() => gateway.endRelationship(relationship.id, request, loaded.version));
    if (outcome.kind === 'saved') {
      saved.current = true;
      await links.afterRelationshipWrite();
      snackbar.show({ text: T.endedOk });
      onClose();
      return { kind: 'idle' };
    }
    if (outcome.kind === 'conflict') return { kind: 'conflict' };
    logProblem('R-04', outcome.error);
    return { kind: 'failed', error: outcome.error };
  });

  async function reload(): Promise<void> {
    if (await loaded.reload()) submit.dismiss();
  }

  return (
    <ConfirmDialog
      title={T.endTitle}
      confirmLabel={T.endConfirm}
      tone="danger"
      onSubmit={submit.submit}
      pending={submit.pending}
      onCancel={onClose}
      notice={
        <WriteNotice
          state={submit.state}
          onReload={() => void reload()}
          onDiscard={onClose}
          reloading={loaded.reloading}
          context={{ notFoundSubject: 'la relación' }}
          conflictText={T.conflict}
        />
      }
    >
      <p className="text-body-large text-on-surface">{`${names.from} → ${names.to} · ${kind === undefined ? relationship.kindCode : T.kindName(kind.name, kind.code)}`}</p>
      <p className="tabular-nums">{`${T.from} ${formatCivilDate(relationship.validFrom)} – ${relationship.validTo === null ? T.open : formatCivilDate(relationship.validTo)}`}</p>
      <p>{T.endBody(names.from, kind?.fromLabel ?? relationship.kindCode, names.to)}</p>
      <DateField
        fieldId={dateId}
        label={T.endDate}
        value={validTo}
        error={dateError}
        onValueChange={(value) => {
          setValidTo(value);
          setDateError(undefined);
        }}
      />
      <TextAreaField label={T.reason} value={reason} max={REASON_MAX} currentValue={reason} readOnly={submit.pending} onChange={(event) => setReason(event.target.value)} />
    </ConfirmDialog>
  );
}
