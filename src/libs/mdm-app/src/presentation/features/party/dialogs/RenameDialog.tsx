import type { Party } from '@mdm/contracts';
import { TextField, useSnackbar } from '@sil/ui';
import { useId, useRef, useState } from 'react';
import { useMdmGateway } from '../../../../application/gateway-context.ts';
import { attemptWrite, useLoadedVersion } from '../../../../application/party-writes.ts';
import { checkText, type FieldIssue } from '../../../../domain/field-rules.ts';
import { NAME_MAX } from '../../../../domain/organization-form.ts';
import { ErrorSummary } from '../../../common/ErrorSummary.tsx';
import { fieldMessage } from '../../../common/field-messages.ts';
import { FormSheet } from '../../../common/dialogs/FormSheet.tsx';
import { useSubmitAction } from '../../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../../common/dialogs/WriteNotice.tsx';
import { logProblem } from '../../../common/problem-text.ts';
import { serverFieldIssue } from '../../../common/server-fields.ts';
import { GENERAL_TEXTS as G, DIALOG_TEXTS as T } from '../texts.ts';
import type { PartyDialogProps } from './party-dialog.ts';

type NameField = 'legalName' | 'tradeName';
interface Names {
  readonly legalName: string;
  readonly tradeName: string;
}

const FIELDS: readonly NameField[] = ['legalName', 'tradeName'];

function namesOf(party: Party): Names {
  return { legalName: party.legalName, tradeName: party.tradeName ?? '' };
}

function issuesOf(names: Names): Partial<Record<NameField, FieldIssue>> {
  const legalName = checkText(names.legalName, {
    required: true,
    max: NAME_MAX,
  });
  const tradeName = checkText(names.tradeName, {
    required: false,
    max: NAME_MAX,
  });
  return {
    ...(legalName === null ? {} : { legalName }),
    ...(tradeName === null ? {} : { tradeName }),
  };
}

function messagesOf(issues: Partial<Record<NameField, FieldIssue>>): Partial<Record<NameField, string>> {
  return Object.fromEntries(FIELDS.flatMap((field) => (issues[field] === undefined ? [] : [[field, fieldMessage(field, issues[field])]])));
}

function isNameField(field: string): field is NameField {
  return field === 'legalName' || field === 'tradeName';
}

/**
 * D-MDM-01 «Editar nombres» (US-MDM-004 y 013; UX-MDM-001 §5.6): razón social y nombre comercial; código, tipo e
 * identificadores a la vista, no editables. Envía la versión con la que se abrió (`If-Match`): ante `412` el
 * borrador se queda y D-MDM-14 permite recargar la ficha, que muestra el valor actual junto a cada campo cambiado.
 */
export function RenameDialog({ party, cache, onClose }: PartyDialogProps) {
  const gateway = useMdmGateway();
  const snackbar = useSnackbar();
  const formId = useId();
  const loaded = useLoadedVersion(party.version, cache);
  const [draft, setDraft] = useState<Names>(() => namesOf(party));
  const [base, setBase] = useState<Names>(() => namesOf(party));
  /** Valores del servidor tras «Recargar y revisar», para ponerlos a la vista del borrador. */
  const [reloaded, setReloaded] = useState<Names | null>(null);
  const [errors, setErrors] = useState<Partial<Record<NameField, string>>>({});
  const saved = useRef(false);

  const submit = useSubmitAction(async () => {
    if (saved.current) return { kind: 'idle' };
    const found = messagesOf(issuesOf(draft));
    setErrors(found);
    if (Object.keys(found).length > 0) return { kind: 'invalid' };
    const request = {
      legalName: draft.legalName.trim(),
      tradeName: draft.tradeName.trim() === '' ? null : draft.tradeName.trim(),
    };
    const outcome = await attemptWrite(() => gateway.renameParty(party.id, request, loaded.version));
    if (outcome.kind === 'saved') {
      saved.current = true;
      await cache.afterWrite();
      snackbar.show({ text: T.renamed });
      onClose();
      return { kind: 'idle' };
    }
    if (outcome.kind === 'conflict') return { kind: 'conflict' };
    const field = serverFieldIssue(outcome.error);
    if (field !== null && isNameField(field.field)) {
      setErrors({ [field.field]: fieldMessage(field.field, field.issue) });
      return { kind: 'invalid' };
    }
    logProblem('P-04', outcome.error);
    return { kind: 'failed', error: outcome.error };
  });

  async function reload(keepDraft: boolean): Promise<void> {
    const fresh = await loaded.reload();
    if (fresh === null) return;
    const names = namesOf(fresh);
    setBase(names);
    setReloaded(keepDraft ? names : null);
    if (!keepDraft) setDraft(names);
    submit.dismiss();
  }

  function change(field: NameField, value: string): void {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  function blur(field: NameField): void {
    const issue = issuesOf(draft)[field];
    if (issue !== undefined)
      setErrors((previous) => ({
        ...previous,
        [field]: fieldMessage(field, issue),
      }));
  }

  function currentValueHelp(field: NameField): string | undefined {
    return reloaded !== null && reloaded[field] !== draft[field] ? T.currentValue(reloaded[field]) : undefined;
  }

  const summary = FIELDS.flatMap((field) => {
    const message = errors[field];
    return message === undefined ? [] : [{ fieldId: `${formId}-${field}`, message }];
  });

  return (
    <FormSheet
      title={T.renameTitle}
      formId={formId}
      submitLabel={T.save}
      onSubmit={submit.submit}
      pending={submit.pending}
      dirty={draft.legalName !== base.legalName || draft.tradeName !== base.tradeName}
      onClose={onClose}
      notices={
        <>
          <WriteNotice state={submit.state} onReload={() => void reload(true)} onDiscard={() => void reload(false)} reloading={loaded.reloading} />
          <ErrorSummary errors={submit.state.kind === 'invalid' ? summary : []} attempt={submit.state.kind === 'invalid' ? submit.state.attempt : 0} />
        </>
      }
    >
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-body-small text-on-surface-variant">{G.code}</dt>
          <dd className="text-body-large">{party.code}</dd>
        </div>
        <div>
          <dt className="text-body-small text-on-surface-variant">{G.type}</dt>
          <dd className="text-body-large">{G.organization}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-body-small text-on-surface-variant">{T.identifiers}</dt>
          <dd className="text-body-large tabular-nums">
            {party.identifiers
              .filter((identifier) => identifier.isCurrent)
              .map((identifier) => `${identifier.schemeCode} ${identifier.value}`)
              .join(', ') || '—'}
          </dd>
        </div>
      </dl>
      <TextField
        fieldId={`${formId}-legalName`}
        data-autofocus=""
        label={G.legalName}
        required
        value={draft.legalName}
        maxLength={NAME_MAX}
        readOnly={submit.pending}
        error={errors.legalName}
        help={currentValueHelp('legalName')}
        changed={currentValueHelp('legalName') !== undefined}
        onChange={(event) => change('legalName', event.target.value)}
        onBlur={() => blur('legalName')}
      />
      <TextField
        fieldId={`${formId}-tradeName`}
        label={G.tradeName}
        value={draft.tradeName}
        maxLength={NAME_MAX}
        readOnly={submit.pending}
        error={errors.tradeName}
        help={currentValueHelp('tradeName')}
        changed={currentValueHelp('tradeName') !== undefined}
        onChange={(event) => change('tradeName', event.target.value)}
        onBlur={() => blur('tradeName')}
      />
    </FormSheet>
  );
}
