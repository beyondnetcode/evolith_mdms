import type { PartyIdentifier } from '@mdm/contracts';
import { DateField, TextAreaField, formatCivilDate, useSnackbar } from '@sil/ui';
import { useId, useRef, useState } from 'react';
import { useMdmGateway } from '../../../../application/gateway-context.ts';
import { attemptWrite, useLoadedVersion } from '../../../../application/party-writes.ts';
import { limaToday } from '../../../../domain/field-rules.ts';
import { checkExpiryDate } from '../../../../domain/identifier-form.ts';
import { ConfirmDialog } from '../../../common/dialogs/ConfirmDialog.tsx';
import { useSubmitAction, type SubmitResult } from '../../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../../common/dialogs/WriteNotice.tsx';
import { fieldMessage } from '../../../common/field-messages.ts';
import { logProblem } from '../../../common/problem-text.ts';
import { IDENTIFIER_TEXTS as I, DIALOG_TEXTS as T } from '../texts.ts';
import type { PartyDialogProps } from './party-dialog.ts';

const REASON_MAX = 500;

interface Props extends PartyDialogProps {
  readonly identifier: PartyIdentifier;
}

/**
 * D-MDM-03 «Vencer identificador» (US-MDM-006; UX-MDM-001 §5.6 y §6.2): confirmación con «Vence el» (por defecto,
 * hoy; no anterior a su «desde») y motivo opcional, porque P-10 los recibe. El identificador no se edita ni se
 * borra. `primary_required`, `fiscal_required` y `already_expired` van en el aviso del diálogo, que no se cierra.
 */
export function ExpireIdentifierDialog({ party, identifier, cache, onClose }: Props) {
  const gateway = useMdmGateway();
  const snackbar = useSnackbar();
  const dateId = useId();
  const loaded = useLoadedVersion(party.version, cache);
  const [validTo, setValidTo] = useState(() => limaToday());
  const [reason, setReason] = useState('');
  const [dateError, setDateError] = useState<string | undefined>(undefined);
  const saved = useRef(false);

  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    if (saved.current) return { kind: 'idle' };
    const issue = checkExpiryDate(validTo, identifier);
    setDateError(issue === null ? undefined : fieldMessage('expireDate', issue));
    if (issue !== null) {
      document.getElementById(dateId)?.focus();
      return { kind: 'invalid' };
    }
    const request = {
      validTo: validTo === '' ? null : validTo,
      reason: reason.trim() === '' ? null : reason.trim().slice(0, REASON_MAX),
    };
    const outcome = await attemptWrite(() => gateway.expireIdentifier(party.id, identifier.identifierId, request, loaded.version));
    if (outcome.kind === 'saved') {
      saved.current = true;
      await cache.afterWrite();
      snackbar.show({ text: T.expired });
      onClose();
      return { kind: 'idle' };
    }
    if (outcome.kind === 'conflict') return { kind: 'conflict' };
    logProblem('P-10', outcome.error);
    return { kind: 'failed', error: outcome.error };
  });

  async function reload(): Promise<void> {
    if ((await loaded.reload()) !== null) submit.dismiss();
  }

  return (
    <ConfirmDialog
      title={T.expireTitle(identifier.schemeCode, identifier.value)}
      confirmLabel={T.expireConfirm}
      tone="danger"
      onSubmit={submit.submit}
      pending={submit.pending}
      onCancel={onClose}
      notice={<WriteNotice state={submit.state} onReload={() => void reload()} onDiscard={onClose} reloading={loaded.reloading} />}
    >
      <p className="text-body-large text-on-surface tabular-nums">{`${identifier.schemeCode} ${identifier.value} · ${I.from.toLocaleLowerCase('es')} ${formatCivilDate(identifier.validFrom)}`}</p>
      <p>{T.expireBody}</p>
      <DateField
        fieldId={dateId}
        label={T.expireDate}
        value={validTo}
        error={dateError}
        onValueChange={(value) => {
          setValidTo(value);
          setDateError(undefined);
        }}
      />
      <TextAreaField
        label={T.reason}
        value={reason}
        max={REASON_MAX}
        currentValue={reason}
        readOnly={submit.pending}
        onChange={(event) => setReason(event.target.value)}
      />
    </ConfirmDialog>
  );
}
