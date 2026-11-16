import { hasProblemCode, type IdentifierScheme, type MdmGateway } from '@mdm/contracts';
import { DateField, LoadError, LoadingBar, SelectField, TextField, useSnackbar } from '@sil/ui';
import { useQuery } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { useMdmGateway } from '../../../../application/gateway-context.ts';
import { attemptWrite, findIdentifierOwner, useLoadedVersion } from '../../../../application/party-writes.ts';
import { mdmQueries } from '../../../../application/queries.ts';
import { limaToday, previousDay } from '../../../../domain/field-rules.ts';
import {
  IDENTIFIER_DRAFT_FIELDS,
  emptyIdentifierDraft,
  toAddIdentifierRequest,
  validateIdentifierDraft,
  type IdentifierDraft,
  type IdentifierDraftField,
} from '../../../../domain/identifier-form.ts';
import { currentPrimary } from '../../../../domain/party-policy.ts';
import { Checkbox } from '../../../common/Checkbox.tsx';
import { ErrorSummary } from '../../../common/ErrorSummary.tsx';
import { fieldMessage, type FieldKind } from '../../../common/field-messages.ts';
import { FormSheet } from '../../../common/dialogs/FormSheet.tsx';
import { useSubmitAction, type SubmitResult } from '../../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../../common/dialogs/WriteNotice.tsx';
import { countryOptions, duplicateText, findScheme, identifierProblemField, identifierProblemText, schemeOptions } from '../../../common/identifier-display.ts';
import { logProblem, problemSentence } from '../../../common/problem-text.ts';
import { serverFieldIssue } from '../../../common/server-fields.ts';
import { IDENTIFIER_TEXTS as I, DIALOG_TEXTS as T } from '../texts.ts';
import type { PartyDialogProps } from './party-dialog.ts';

type Errors = Partial<Record<IdentifierDraftField, string>>;

const KIND: Readonly<Record<IdentifierDraftField, FieldKind>> = {
  countryCode: 'countryCode',
  schemeCode: 'schemeCode',
  value: 'value',
  validFrom: 'date',
  isPrimary: 'value',
};

function localErrors(draft: IdentifierDraft, schemes: readonly IdentifierScheme[]): Errors {
  const issues = validateIdentifierDraft(draft, schemes);
  return Object.fromEntries(
    IDENTIFIER_DRAFT_FIELDS.flatMap((field) => (issues[field] === undefined ? [] : [[field, fieldMessage(KIND[field], issues[field])]])),
  );
}

interface Rejection {
  readonly gateway: MdmGateway;
  readonly draft: IdentifierDraft;
  readonly schemes: readonly IdentifierScheme[];
  readonly currentPrimaryText: string | undefined;
}

/** Error del servidor → campo y mensaje (UX-MDM-001 §6.1, «Dónde»); `null` si va en el aviso del formulario. */
async function rejectionErrors(error: unknown, { gateway, draft, schemes, currentPrimaryText }: Rejection): Promise<Errors | null> {
  const field = identifierProblemField(error);
  if (field !== null)
    return {
      [field]: identifierProblemText(error, findScheme(schemes, draft.countryCode, draft.schemeCode), draft.countryCode),
    };
  if (hasProblemCode(error, 'party.identifier.duplicate')) {
    const request = toAddIdentifierRequest(draft);
    return {
      value: duplicateText(await findIdentifierOwner(gateway, request)),
    };
  }
  if (hasProblemCode(error, 'party.identifier.primary_exists')) {
    return {
      isPrimary: problemSentence(error, currentPrimaryText === undefined ? {} : { currentPrimary: currentPrimaryText }),
    };
  }
  const invalid = serverFieldIssue(error);
  const named = IDENTIFIER_DRAFT_FIELDS.find((item) => item === invalid?.field);
  return invalid === null || named === undefined ? null : { [named]: fieldMessage(KIND[named], invalid.issue) };
}

interface FormProps extends PartyDialogProps {
  readonly schemes: readonly IdentifierScheme[];
}

/**
 * D-MDM-02 «Agregar identificador» (US-MDM-006; UX-MDM-001 §5.6). «Reemplaza al primario actual» aparece solo con
 * «Es primario» y un primario vigente, con su valor a la vista (o si el servidor responde que ya hay uno,
 * `primary_exists`, que propone marcarlo). Al reemplazar, el anterior vence el día previo (G-570).
 */
function AddIdentifierForm({ party, cache, onClose, schemes }: FormProps) {
  const gateway = useMdmGateway();
  const snackbar = useSnackbar();
  const formId = useId();
  const loaded = useLoadedVersion(party.version, cache);
  const today = limaToday();
  const [initial] = useState(() => emptyIdentifierDraft(today));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [primaryExists, setPrimaryExists] = useState(false);
  const saved = useRef(false);
  const primary = currentPrimary(party.identifiers);
  const primaryText = primary === undefined ? undefined : `${primary.schemeCode} ${primary.value}`;

  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    if (saved.current) return { kind: 'idle' };
    const found = localErrors(draft, schemes);
    setErrors(found);
    if (Object.keys(found).length > 0) return { kind: 'invalid' };
    const request = toAddIdentifierRequest(draft);
    const outcome = await attemptWrite(() => gateway.addIdentifier(party.id, request, loaded.version));
    if (outcome.kind === 'saved') {
      saved.current = true;
      await cache.afterWrite();
      snackbar.show({
        text: request.replacesPrimary ? T.identifierReplaced(previousDay(request.validFrom ?? today)) : T.identifierAdded,
      });
      onClose();
      return { kind: 'idle' };
    }
    if (outcome.kind === 'conflict') return { kind: 'conflict' };
    if (hasProblemCode(outcome.error, 'party.identifier.primary_exists')) setPrimaryExists(true);
    const mapped = await rejectionErrors(outcome.error, {
      gateway,
      draft,
      schemes,
      currentPrimaryText: primaryText,
    });
    if (mapped !== null) {
      setErrors(mapped);
      return { kind: 'invalid' };
    }
    logProblem('P-09', outcome.error);
    return { kind: 'failed', error: outcome.error };
  });

  function change(next: Partial<IdentifierDraft>, field: IdentifierDraftField): void {
    setDraft((previous) => ({ ...previous, ...next }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  function blur(field: IdentifierDraftField): void {
    const message = localErrors(draft, schemes)[field];
    if (message !== undefined) setErrors((previous) => ({ ...previous, [field]: message }));
  }

  async function reload(keepDraft: boolean): Promise<void> {
    const fresh = await loaded.reload();
    if (fresh === null) return;
    if (!keepDraft) setDraft(initial);
    submit.dismiss();
  }

  const offerReplace = draft.isPrimary && (primary !== undefined || primaryExists);
  const id = (field: IdentifierDraftField) => `${formId}-${field}`;
  const summary = IDENTIFIER_DRAFT_FIELDS.flatMap((field) => {
    const message = errors[field];
    return message === undefined ? [] : [{ fieldId: id(field), message }];
  });
  const dirty = (Object.keys(initial) as Array<keyof IdentifierDraft>).some((key) => initial[key] !== draft[key]);

  return (
    <FormSheet
      title={T.addIdentifierTitle}
      formId={formId}
      submitLabel={T.addSubmit}
      onSubmit={submit.submit}
      pending={submit.pending}
      dirty={dirty}
      onClose={onClose}
      notices={
        <>
          <WriteNotice state={submit.state} onReload={() => void reload(true)} onDiscard={() => void reload(false)} reloading={loaded.reloading} />
          <ErrorSummary errors={submit.state.kind === 'invalid' ? summary : []} attempt={submit.state.kind === 'invalid' ? submit.state.attempt : 0} />
        </>
      }
    >
      <SelectField
        fieldId={id('countryCode')}
        data-autofocus=""
        label={I.country}
        required
        options={countryOptions(schemes)}
        value={draft.countryCode}
        error={errors.countryCode}
        onChange={(event) => change({ countryCode: event.target.value, schemeCode: '' }, 'countryCode')}
      />
      <SelectField
        fieldId={id('schemeCode')}
        label={I.scheme}
        required
        options={schemeOptions(schemes, draft.countryCode)}
        value={draft.schemeCode}
        error={errors.schemeCode}
        onChange={(event) => change({ schemeCode: event.target.value }, 'schemeCode')}
      />
      <TextField
        fieldId={id('value')}
        label={I.value}
        required
        value={draft.value}
        maxLength={50}
        autoComplete="off"
        readOnly={submit.pending}
        error={errors.value}
        onChange={(event) => change({ value: event.target.value }, 'value')}
        onBlur={() => blur('value')}
      />
      <DateField
        fieldId={id('validFrom')}
        label={T.validFrom}
        value={draft.validFrom}
        error={errors.validFrom}
        onValueChange={(value) => change({ validFrom: value }, 'validFrom')}
      />
      <Checkbox
        fieldId={id('isPrimary')}
        label={T.isPrimary}
        checked={draft.isPrimary}
        readOnly={submit.pending}
        error={errors.isPrimary}
        onChange={(checked) =>
          change(
            {
              isPrimary: checked,
              replacesPrimary: checked && draft.replacesPrimary,
            },
            'isPrimary',
          )
        }
      />
      {/* Aparece al marcar «Es primario» y se anuncia (WCAG 3.2.2 y 4.1.3). */}
      <div aria-live="polite">
        {offerReplace && (
          <Checkbox
            label={T.replacesPrimary}
            checked={draft.replacesPrimary}
            readOnly={submit.pending}
            description={primaryText === undefined ? undefined : T.replacesPrimaryHelp(primaryText)}
            onChange={(checked) => change({ replacesPrimary: checked }, 'isPrimary')}
          />
        )}
      </div>
    </FormSheet>
  );
}

/** Carga los esquemas (C-01) antes de abrir el formulario: sin catálogo no se puede validar ni enviar. */
export function AddIdentifierDialog(props: PartyDialogProps) {
  const gateway = useMdmGateway();
  const schemes = useQuery(mdmQueries.identifierSchemes(gateway));
  if (schemes.data !== undefined) return <AddIdentifierForm {...props} schemes={schemes.data.items} />;
  return (
    <FormSheet
      title={T.addIdentifierTitle}
      formId="mdm-identificador-cargando"
      submitLabel={T.addSubmit}
      onSubmit={(event) => event.preventDefault()}
      pending={false}
      disabled
      dirty={false}
      onClose={props.onClose}
    >
      {schemes.isError ? (
        <LoadError subject="los esquemas de identificador" error={schemes.error} onRetry={() => void schemes.refetch()} />
      ) : (
        <LoadingBar subject="los esquemas de identificador" />
      )}
    </FormSheet>
  );
}
