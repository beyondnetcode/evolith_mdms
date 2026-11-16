import { hasProblemCode, type RelationshipKind } from '@mdm/contracts';
import { DateField, InlineNotice, LoadError, LoadingBar, SelectField, useSnackbar } from '@sil/ui';
import { useQuery } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { useMdmGateway } from '../../../../application/gateway-context.ts';
import { useLinkCache } from '../../../../application/link-writes.ts';
import { attemptWrite } from '../../../../application/party-writes.ts';
import { mdmQueries } from '../../../../application/queries.ts';
import { useMdmSession } from '../../../../application/session-context.ts';
import { limaToday } from '../../../../domain/field-rules.ts';
import {
  RELATIONSHIP_DRAFT_FIELDS,
  emptyRelationshipDraft,
  findLoadedRelationshipOverlap,
  toStartRelationshipRequest,
  validateRelationshipDraft,
  type RelationshipDraft,
  type RelationshipDraftField,
} from '../../../../domain/relationship-form.ts';
import type { RelationshipSide } from '../../../../domain/relationship-state.ts';
import { ErrorSummary } from '../../../common/ErrorSummary.tsx';
import { fieldMessage, type FieldKind } from '../../../common/field-messages.ts';
import { FormSheet } from '../../../common/dialogs/FormSheet.tsx';
import { useSubmitAction, type SubmitResult } from '../../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../../common/dialogs/WriteNotice.tsx';
import { logProblem, problemSentence } from '../../../common/problem-text.ts';
import { RadioGroup } from '../../../common/RadioGroup.tsx';
import { serverFieldIssue } from '../../../common/server-fields.ts';
import { RELATIONSHIP_TEXTS as T } from '../texts.ts';
import type { PartyDialogProps } from './party-dialog.ts';
import { PartyPicker, type PickedParty } from './PartyPicker.tsx';

type Errors = Partial<Record<RelationshipDraftField, string>>;

const KIND: Readonly<Record<RelationshipDraftField, FieldKind>> = { kindCode: 'relationshipKind', otherPartyId: 'otherParty', validFrom: 'date', validTo: 'validTo' };

/** Campos del cuerpo de R-02 que nombra un `400` → campo del formulario. */
const SERVER_FIELD: Readonly<Record<string, RelationshipDraftField>> = {
  kindCode: 'kindCode',
  fromPartyId: 'otherPartyId',
  toPartyId: 'otherPartyId',
  validFrom: 'validFrom',
  validTo: 'validTo',
};

/** Error del servidor → campo y mensaje (UX-MDM-001 §6.1, «Dónde»); `null` si va en el aviso del formulario. */
function rejectionErrors(error: unknown, kindName: string | undefined): Errors | null {
  const otherParty = ['party_relationship.self_reference', 'party_relationship.party_not_found', 'party_relationship.party_not_active'] as const;
  if (otherParty.some((code) => hasProblemCode(error, code))) return { otherPartyId: problemSentence(error) };
  if (hasProblemCode(error, 'party_relationship.kind_unknown')) return { kindCode: problemSentence(error) };
  if (hasProblemCode(error, 'party_relationship.overlap')) {
    return { validTo: problemSentence(error, kindName === undefined ? {} : { relationshipKindName: `«${kindName}»` }) };
  }
  const invalid = serverFieldIssue(error);
  const named = invalid === null ? undefined : SERVER_FIELD[invalid.field];
  return invalid === null || named === undefined ? null : { [named]: fieldMessage(KIND[named], invalid.issue) };
}

interface FormProps extends PartyDialogProps {
  readonly kinds: readonly RelationshipKind[];
}

function sideOptions(code: string, kind: RelationshipKind | undefined) {
  if (kind === undefined) return [];
  return [
    { value: 'from' as const, label: T.sideOption(code, kind.fromLabel) },
    { value: 'to' as const, label: T.sideOption(code, kind.toLabel) },
  ];
}

/**
 * D-MDM-06 «Nueva relación» (US-MDM-011; UX-MDM-001 §5.6; UI-MDM-001 §3.5): tipo (C-04), sentido en texto según el
 * tipo («ACME es matriz de…»), la otra organización con el buscador sobre P-01 (SU-MDM-08), «Desde» (por defecto hoy)
 * y «Hasta» opcional. La otra organización es obligatoria y distinta de la actual: la UI lo impide antes de enviar
 * (`INV-PTY-12`). R-02 no lleva `If-Match`: la relación es un agregado nuevo y no cambia la versión de la Party.
 */
function NewRelationshipForm({ party, onClose, kinds }: FormProps) {
  const gateway = useMdmGateway();
  const { role } = useMdmSession();
  const snackbar = useSnackbar();
  const links = useLinkCache(party.id);
  const formId = useId();
  const today = limaToday();
  const loaded = useQuery(mdmQueries.relationships(gateway, role, party.id, false));
  const [initial] = useState(() => emptyRelationshipDraft(today));
  const [draft, setDraft] = useState(initial);
  const [picked, setPicked] = useState<PickedParty | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const saved = useRef(false);
  const kind = kinds.find((item) => item.code === draft.kindCode);
  const clash = findLoadedRelationshipOverlap(draft, party.id, loaded.data?.items ?? [], today);

  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    if (saved.current) return { kind: 'idle' };
    const issues = validateRelationshipDraft(draft, party, today);
    const found: Errors = Object.fromEntries(RELATIONSHIP_DRAFT_FIELDS.flatMap((field) => (issues[field] === undefined ? [] : [[field, fieldMessage(KIND[field], issues[field])]])));
    if (found.validTo === undefined && clash !== null) found.validTo = T.overlapField(kind?.name ?? clash.kindCode);
    setErrors(found);
    if (Object.keys(found).length > 0) return { kind: 'invalid' };
    const outcome = await attemptWrite(() => gateway.startRelationship(toStartRelationshipRequest(draft, party.id)));
    if (outcome.kind === 'saved') {
      saved.current = true;
      await links.afterRelationshipWrite();
      snackbar.show({ text: T.started });
      onClose();
      return { kind: 'idle' };
    }
    // R-02 no lleva `If-Match`: un `412` no es posible; si llegara, se trata como error sin campo.
    const error = outcome.kind === 'conflict' ? new Error('412 inesperado en R-02') : outcome.error;
    const mapped = rejectionErrors(error, kind?.name);
    if (mapped !== null) {
      setErrors(mapped);
      return { kind: 'invalid' };
    }
    logProblem('R-02', error);
    return { kind: 'failed', error };
  });

  function change(next: Partial<RelationshipDraft>, field: RelationshipDraftField): void {
    setDraft((previous) => ({ ...previous, ...next }));
    // Cambiar tipo, sentido, organización o fechas puede resolver el solape señalado en «Hasta».
    setErrors((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => key !== field && key !== 'validTo')));
  }

  const id = (field: RelationshipDraftField) => `${formId}-${field}`;
  const summary = RELATIONSHIP_DRAFT_FIELDS.flatMap((field) => {
    const message = errors[field];
    return message === undefined ? [] : [{ fieldId: id(field), message }];
  });
  const dirty = picked !== null || (['kindCode', 'side', 'validFrom', 'validTo'] as const).some((key) => initial[key] !== draft[key]);
  const label = kind === undefined ? undefined : draft.side === 'from' ? kind.fromLabel : kind.toLabel;

  return (
    <FormSheet
      title={T.startTitle}
      formId={formId}
      submitLabel={T.startSubmit}
      onSubmit={submit.submit}
      pending={submit.pending}
      dirty={dirty}
      onClose={onClose}
      notices={
        <>
          <WriteNotice state={submit.state} />
          <ErrorSummary errors={submit.state.kind === 'invalid' ? summary : []} attempt={submit.state.kind === 'invalid' ? submit.state.attempt : 0} />
        </>
      }
    >
      <SelectField
        fieldId={id('kindCode')}
        data-autofocus=""
        label={T.kindField}
        required
        options={kinds.map((item) => ({ id: item.code, name: T.kindName(item.name, item.code) }))}
        value={draft.kindCode}
        error={errors.kindCode}
        onChange={(event) => change({ kindCode: event.target.value }, 'kindCode')}
      />
      {kind === undefined ? (
        <p className="text-body-medium text-on-surface-variant">{T.chooseKindFirst}</p>
      ) : (
        <RadioGroup<RelationshipSide>
          legend={T.side}
          help={T.sideHelp}
          options={sideOptions(party.code, kind)}
          value={draft.side}
          readOnly={submit.pending}
          onChange={(side) => change({ side }, 'kindCode')}
        />
      )}
      <PartyPicker
        fieldId={id('otherPartyId')}
        excludeId={party.id}
        picked={picked}
        onPick={(next) => {
          setPicked(next);
          change({ otherPartyId: next?.id ?? '' }, 'otherPartyId');
        }}
        error={errors.otherPartyId}
        readOnly={submit.pending}
      />
      {label !== undefined && <p className="text-body-medium text-on-surface">{T.sentencePreview(party.code, label, picked?.label ?? null)}</p>}
      <DateField
        fieldId={id('validFrom')}
        label={T.validFrom}
        help={T.validFromHelp}
        value={draft.validFrom}
        error={errors.validFrom}
        onValueChange={(value) => change({ validFrom: value }, 'validFrom')}
      />
      <DateField
        fieldId={id('validTo')}
        label={T.validTo}
        help={T.validToHelp}
        value={draft.validTo}
        error={errors.validTo}
        onValueChange={(value) => change({ validTo: value }, 'validTo')}
      />
      {/* Solape con las relaciones cargadas: aparece al elegir tipo, sentido, organización y fechas (WCAG 4.1.3). */}
      <div aria-live="polite">{clash !== null && <InlineNotice severity="warning" title={T.overlapWarning} />}</div>
    </FormSheet>
  );
}

/** Carga los tipos de relación (C-04) antes de abrir el formulario: sin catálogo no se puede elegir ni enviar. */
export function NewRelationshipDialog(props: PartyDialogProps) {
  const gateway = useMdmGateway();
  const kinds = useQuery(mdmQueries.relationshipKinds(gateway));
  if (kinds.data !== undefined) return <NewRelationshipForm {...props} kinds={kinds.data.items.filter((kind) => kind.isActive)} />;
  return (
    <FormSheet
      title={T.startTitle}
      formId="mdm-relacion-cargando"
      submitLabel={T.startSubmit}
      onSubmit={(event) => event.preventDefault()}
      pending={false}
      disabled
      dirty={false}
      onClose={props.onClose}
    >
      {kinds.isError ? (
        <LoadError subject="los tipos de relación" error={kinds.error} onRetry={() => void kinds.refetch()} />
      ) : (
        <LoadingBar subject="los tipos de relación" />
      )}
    </FormSheet>
  );
}
