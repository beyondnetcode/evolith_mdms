import { hasProblemCode, type ExternalReference, type MdmGateway, type MdmRole } from '@mdm/contracts';
import { InlineNotice, TextField, buttonStyles, useSnackbar } from '@sil/ui';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useMdmGateway } from '../../../../application/gateway-context.ts';
import { useLinkCache } from '../../../../application/link-writes.ts';
import { attemptWrite } from '../../../../application/party-writes.ts';
import { mdmQueries } from '../../../../application/queries.ts';
import { useMdmSession } from '../../../../application/session-context.ts';
import {
  PARTY_TARGET,
  REFERENCE_LIMITS,
  REFERENCE_TEXT_FIELDS,
  emptyReferenceDraft,
  externalKeyOf,
  linkableEstablishments,
  toLinkRequest,
  validateReferenceDraft,
  type ReferenceDraft,
  type ReferenceTextField,
} from '../../../../domain/reference-form.ts';
import { ErrorSummary } from '../../../common/ErrorSummary.tsx';
import { fieldMessage } from '../../../common/field-messages.ts';
import { FormSheet } from '../../../common/dialogs/FormSheet.tsx';
import { useSubmitAction, type SubmitResult } from '../../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../../common/dialogs/WriteNotice.tsx';
import { logProblem, problemSentence } from '../../../common/problem-text.ts';
import { RadioGroup } from '../../../common/RadioGroup.tsx';
import { serverFieldIssue } from '../../../common/server-fields.ts';
import { organizationPath } from '../../../mdm-roots.ts';
import { REFERENCE_TEXTS as T } from '../texts.ts';
import type { PartyDialogProps } from './party-dialog.ts';

type Errors = Partial<Record<ReferenceTextField, string>>;

const HELP: Readonly<Record<ReferenceTextField, string | undefined>> = {
  systemCode: T.systemCodeHelp,
  systemInstance: T.systemInstanceHelp,
  externalObjectType: T.externalObjectTypeHelp,
  externalKey: undefined,
};

const LABEL: Readonly<Record<ReferenceTextField, string>> = {
  systemCode: T.systemCode,
  systemInstance: T.systemInstance,
  externalObjectType: T.externalObjectType,
  externalKey: T.externalKey,
};

/** Dueña de una clave duplicada: dónde está vinculada, como unión discriminada. */
type KeyOwner = { readonly kind: 'none' } | { readonly kind: 'unknown' } | { readonly kind: 'found'; readonly reference: ExternalReference; readonly code: string | null };

/**
 * «Ver a qué está vinculada» (UX-MDM-001 §4.5 y §5.6): el `409` `external_reference.key_duplicate` no dice a qué
 * objeto apunta la clave, así que se busca con X-01 por la clave completa (también las desvinculadas) y se nombra la
 * organización dueña con P-03. Si algo falla, el aviso cae a su forma sin datos.
 */
async function findKeyOwner(queryClient: QueryClient, gateway: MdmGateway, role: MdmRole, draft: ReferenceDraft): Promise<KeyOwner> {
  try {
    const page = await queryClient.query(mdmQueries.referenceByKey(gateway, role, externalKeyOf(draft)));
    const reference = page.items[0];
    if (reference === undefined) return { kind: 'unknown' };
    const owner = await queryClient.query(mdmQueries.party(gateway, role, reference.partyId)).catch(() => null);
    return { kind: 'found', reference, code: owner?.code ?? null };
  } catch {
    return { kind: 'unknown' };
  }
}

function ownerText(owner: KeyOwner): string | null {
  if (owner.kind === 'none') return null;
  if (owner.kind === 'unknown' || owner.code === null) return T.ownerUnknown;
  return owner.reference.mdmObjectType === 'PARTY' ? T.ownerParty(owner.code) : T.ownerEstablishment(owner.code);
}

/** Error del servidor → campo y mensaje (UX-MDM-001 §6.1, «Dónde»); `null` si va en el aviso del formulario. */
function rejectionErrors(error: unknown, draft: ReferenceDraft): Errors | null {
  if (hasProblemCode(error, 'external_reference.key_duplicate')) {
    const key = externalKeyOf(draft);
    return { externalKey: problemSentence(error, { externalKey: { key: key.externalKey, system: key.systemCode } }) };
  }
  const invalid = serverFieldIssue(error);
  const named = REFERENCE_TEXT_FIELDS.find((field) => field === invalid?.field);
  return invalid === null || named === undefined ? null : { [named]: fieldMessage(named, invalid.issue) };
}

/**
 * D-MDM-07 «Vincular referencia externa» (US-MDM-012; UX-MDM-001 §4.5 y §5.6; UI-MDM-001 §3.5): objeto (la organización
 * o uno de sus establecimientos no cerrados, en un grupo de radio), sistema, instancia, tipo de objeto y clave, todos
 * obligatorios y en texto libre (SU-MDM-07, G-564). X-02 no lleva `If-Match`: la referencia es un agregado nuevo.
 * Si la clave ya está vinculada a otro objeto (`INV-PTY-13`), el error va en «Clave» y se ofrece ver a qué.
 */
export function LinkReferenceDialog({ party, onClose }: PartyDialogProps) {
  const gateway = useMdmGateway();
  const { role } = useMdmSession();
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  const links = useLinkCache(party.id);
  const formId = useId();
  const [initial] = useState(emptyReferenceDraft);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [owner, setOwner] = useState<KeyOwner>({ kind: 'none' });
  const saved = useRef(false);
  const establishments = linkableEstablishments(party.establishments);
  const targetEstablishment = establishments.some((item) => item.id === draft.target);

  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    if (saved.current) return { kind: 'idle' };
    setOwner({ kind: 'none' });
    const issues = validateReferenceDraft(draft);
    const found: Errors = Object.fromEntries(REFERENCE_TEXT_FIELDS.flatMap((field) => (issues[field] === undefined ? [] : [[field, fieldMessage(field, issues[field])]])));
    setErrors(found);
    if (Object.keys(found).length > 0) return { kind: 'invalid' };
    const outcome = await attemptWrite(() => gateway.linkExternalReference(toLinkRequest(draft, party.id)));
    if (outcome.kind === 'saved') {
      saved.current = true;
      await links.afterReferenceWrite();
      snackbar.show({ text: T.linked });
      onClose();
      return { kind: 'idle' };
    }
    // X-02 no lleva `If-Match`: un `412` no es posible; si llegara, se trata como error sin campo.
    const error = outcome.kind === 'conflict' ? new Error('412 inesperado en X-02') : outcome.error;
    const mapped = rejectionErrors(error, draft);
    if (mapped !== null) {
      if (mapped.externalKey !== undefined && hasProblemCode(error, 'external_reference.key_duplicate')) setOwner(await findKeyOwner(queryClient, gateway, role, draft));
      setErrors(mapped);
      return { kind: 'invalid' };
    }
    logProblem('X-02', error);
    return { kind: 'failed', error };
  });

  function change(next: Partial<ReferenceDraft>, field: ReferenceTextField | 'target'): void {
    setDraft((previous) => ({ ...previous, ...next }));
    setErrors((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => key !== field)));
    if (field === 'externalKey' || field === 'systemCode' || field === 'systemInstance' || field === 'externalObjectType') setOwner({ kind: 'none' });
  }

  const id = (field: ReferenceTextField | 'target') => `${formId}-${field}`;
  const summary = REFERENCE_TEXT_FIELDS.flatMap((field) => {
    const message = errors[field];
    return message === undefined ? [] : [{ fieldId: id(field), message }];
  });
  const dirty = (['target', ...REFERENCE_TEXT_FIELDS] as const).some((key) => initial[key] !== draft[key]);
  const ownerMessage = ownerText(owner);

  return (
    <FormSheet
      title={T.linkTitle}
      formId={formId}
      submitLabel={T.linkSubmit}
      onSubmit={submit.submit}
      pending={submit.pending}
      dirty={dirty}
      onClose={onClose}
      notices={
        <>
          <WriteNotice state={submit.state} context={{ referenceTarget: targetEstablishment ? 'ESTABLISHMENT' : 'PARTY' }} />
          <ErrorSummary errors={submit.state.kind === 'invalid' ? summary : []} attempt={submit.state.kind === 'invalid' ? submit.state.attempt : 0} />
          {ownerMessage !== null && (
            <InlineNotice
              severity="neutral"
              title={ownerMessage}
              actions={
                owner.kind === 'found' ? (
                  <Link to={`${organizationPath(owner.reference.partyId)}?seccion=referencias`} className={buttonStyles('text-inherit')}>
                    {T.seeOwner}
                  </Link>
                ) : undefined
              }
            />
          )}
        </>
      }
    >
      <RadioGroup
        legend={T.target}
        help={T.targetHelp}
        fieldId={id('target')}
        initialFocus
        options={[
          { value: PARTY_TARGET, label: T.targetParty(party.code) },
          ...establishments.map((item) => ({ value: item.id, label: T.targetEstablishment(item.code, item.name) })),
        ]}
        value={draft.target}
        readOnly={submit.pending}
        onChange={(target) => change({ target }, 'target')}
      />
      {REFERENCE_TEXT_FIELDS.map((field) => (
        <TextField
          key={field}
          fieldId={id(field)}
          label={LABEL[field]}
          required
          maxLength={REFERENCE_LIMITS[field]}
          {...(HELP[field] === undefined ? {} : { help: HELP[field] })}
          value={draft[field]}
          error={errors[field]}
          readOnly={submit.pending}
          onChange={(event) => change({ [field]: event.target.value }, field)}
        />
      ))}
    </FormSheet>
  );
}
