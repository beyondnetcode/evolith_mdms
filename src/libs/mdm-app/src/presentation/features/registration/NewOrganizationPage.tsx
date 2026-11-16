import { hasProblemCode, normalizeCode, type IdentifierScheme, type PartyRoleType, type PartySummary } from '@mdm/contracts';
import { Button, LoadError, LoadingBar, useDocumentTitle, useSnackbar, useWindowSizeClass } from '@sil/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMdmGateway } from '../../../application/gateway-context.ts';
import { attemptWrite, findIdentifierOwner } from '../../../application/party-writes.ts';
import { assignableRoleTypes, mdmQueries } from '../../../application/queries.ts';
import { useMdmSession } from '../../../application/session-context.ts';
import { limaToday } from '../../../domain/field-rules.ts';
import {
  emptyDraft,
  isDraftTouched,
  prefilledIdentifier,
  roleField,
  toRegisterRequest,
  validateOrganization,
  type OrganizationDraft,
  type OrganizationField,
  type RoleDraft,
} from '../../../domain/organization-form.ts';
import { BackLink } from '../../common/BackLink.tsx';
import { ConfirmDialog } from '../../common/dialogs/ConfirmDialog.tsx';
import { useSubmitAction, type SubmitResult } from '../../common/dialogs/use-submit-action.ts';
import { WriteNotice } from '../../common/dialogs/WriteNotice.tsx';
import { ErrorSummary } from '../../common/ErrorSummary.tsx';
import type { RoleNames } from '../../common/field-messages.ts';
import { logProblem } from '../../common/problem-text.ts';
import { MDM_TITLE_SUFFIX, ORGANIZATIONS_PATH, organizationPath } from '../../mdm-roots.ts';
import { DataFields, DuplicateNotice, IdentifierFields, RolesFields } from './OrganizationFields.tsx';
import { messagesOf, rejectionErrors, type OrganizationErrors } from './organization-errors.ts';
import { REGISTRATION_TEXTS as T } from './texts.ts';

/** «Registrar»: botón relleno (único de la vista) con progreso mientras se envía, sin perder el foco. */
function SubmitButton({ disabled, pending }: { readonly disabled: boolean; readonly pending: boolean }) {
  return (
    <Button type="submit" variant="filled" aria-disabled={pending || disabled ? true : undefined} aria-busy={pending}>
      {pending ? T.submitting : T.submit}
    </Button>
  );
}

interface FormProps {
  readonly schemes: readonly IdentifierScheme[];
  readonly roleTypes: readonly PartyRoleType[];
  /** Catálogos aún no disponibles: «Registrar» deshabilitado (UX-MDM-001 §5.5). */
  readonly ready: boolean;
}

/** Orden de los campos en pantalla: el del resumen de errores. */
function fieldOrder(draft: OrganizationDraft): OrganizationField[] {
  const fixed: OrganizationField[] = ['code', 'legalName', 'tradeName', 'countryCode', 'schemeCode', 'value', 'validFrom'];
  return [...fixed, ...draft.roles.flatMap((role) => [roleField(role.key, 'roleTypeCode'), roleField(role.key, 'validFrom'), roleField(role.key, 'validTo')])];
}

function OrganizationForm({ schemes, roleTypes, ready }: FormProps) {
  const gateway = useMdmGateway();
  const { role } = useMdmSession();
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const compact = useWindowSizeClass() === 'compact';
  const formId = useId();
  const today = limaToday();
  const [initial] = useState<OrganizationDraft>(() => ({
    ...emptyDraft(today),
    ...prefilledIdentifier(params),
  }));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<OrganizationErrors>({});
  /** `undefined`: sin duplicado; `null`: duplicado sin la organización encontrada. */
  const [duplicateOwner, setDuplicateOwner] = useState<PartySummary | null | undefined>(undefined);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const nextKey = useRef(1);
  const saved = useRef(false);
  const roleNames: RoleNames = Object.fromEntries(roleTypes.map((type) => [type.code, type.name]));
  const idOf = (field: OrganizationField) => `${formId}-${field}`;

  const submit = useSubmitAction(async (): Promise<SubmitResult> => {
    if (saved.current || !ready) return { kind: 'idle' };
    const found = messagesOf(validateOrganization(draft, schemes, today), roleNames);
    setErrors(found);
    setDuplicateOwner(undefined);
    if (Object.keys(found).length > 0) return { kind: 'invalid' };
    const request = toRegisterRequest(draft);
    const outcome = await attemptWrite(() => gateway.registerParty(request));
    if (outcome.kind === 'saved') {
      saved.current = true;
      await queryClient.invalidateQueries({
        queryKey: ['mdm', role, 'parties'],
      });
      snackbar.show({ text: T.registered(normalizeCode(request.code)) });
      await navigate(organizationPath(outcome.value.id));
      return { kind: 'idle' };
    }
    const error = outcome.kind === 'rejected' ? outcome.error : null;
    if (hasProblemCode(error, 'party.identifier.duplicate')) {
      // El contrato no devuelve la organización existente: se busca por identificador exacto (G-562).
      setDuplicateOwner(await findIdentifierOwner(gateway, request.primaryIdentifier));
      return { kind: 'idle' };
    }
    const mapped = rejectionErrors(error, draft, schemes);
    if (mapped !== null) {
      setErrors(mapped);
      return { kind: 'invalid' };
    }
    logProblem('P-02', error);
    return { kind: 'failed', error };
  });

  function change(next: Partial<OrganizationDraft>, field: OrganizationField): void {
    setDraft((previous) => ({ ...previous, ...next }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  function blur(field: OrganizationField): void {
    const issue = validateOrganization(draft, schemes, today).find((item) => item.field === field);
    if (issue !== undefined)
      setErrors((previous) => ({
        ...previous,
        ...messagesOf([issue], roleNames),
      }));
  }

  function changeRole(key: number, next: Partial<RoleDraft>, field: OrganizationField): void {
    change(
      {
        roles: draft.roles.map((item) => (item.key === key ? { ...item, ...next } : item)),
      },
      field,
    );
  }

  function addRole(): void {
    const key = nextKey.current;
    nextKey.current += 1;
    setDraft((previous) => ({
      ...previous,
      roles: [...previous.roles, { key, roleTypeCode: '', validFrom: today, validTo: '' }],
    }));
    // Tras pintar la fila, el foco va a su primer campo.
    requestAnimationFrame(() => document.getElementById(idOf(roleField(key, 'roleTypeCode')))?.focus());
  }

  function removeRole(key: number): void {
    setDraft((previous) => ({
      ...previous,
      roles: previous.roles.filter((item) => item.key !== key),
    }));
    setErrors((previous) => Object.fromEntries(Object.entries(previous).filter(([field]) => !field.startsWith(`role-${key}-`))));
    document.getElementById(`${formId}-agregar-rol`)?.focus();
  }

  function cancel(): void {
    if (isDraftTouched(draft, initial)) setConfirmingCancel(true);
    else void navigate(ORGANIZATIONS_PATH);
  }

  const fields = {
    draft,
    errors,
    idOf,
    onChange: change,
    onBlur: blur,
    readOnly: submit.pending,
  };
  const summary = fieldOrder(draft).flatMap((field) => {
    const message = errors[field];
    return message === undefined ? [] : [{ fieldId: idOf(field), message }];
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        if (ready) submit.submit(event);
        else event.preventDefault();
      }}
      className={compact ? 'flex max-w-210 flex-col gap-6 pb-24' : 'flex max-w-210 flex-col gap-6 expanded:max-w-none'}
    >
      <WriteNotice state={submit.state} />
      <ErrorSummary errors={submit.state.kind === 'invalid' ? summary : []} attempt={submit.state.kind === 'invalid' ? submit.state.attempt : 0} />
      <div className="grid gap-6 expanded:grid-cols-2">
        <div className="flex flex-col gap-6">
          <DataFields {...fields} />
          <DuplicateNotice
            owner={duplicateOwner}
            onFix={() => {
              setDuplicateOwner(undefined);
              document.getElementById(idOf('value'))?.focus();
            }}
          />
          <IdentifierFields {...fields} schemes={schemes} />
        </div>
        <div>
          <RolesFields
            {...fields}
            roleOptions={assignableRoleTypes(roleTypes).map((type) => ({
              id: type.code,
              name: `${type.name} (${type.code})`,
            }))}
            roleNames={roleNames}
            onAdd={addRole}
            onRemove={removeRole}
            onRoleChange={changeRole}
            addId={`${formId}-agregar-rol`}
          />
        </div>
      </div>
      <div
        className={
          compact
            ? 'fixed inset-x-0 bottom-0 z-20 flex h-20 items-center justify-end gap-2 bg-surface-container px-4'
            : 'flex justify-end gap-2 border-t border-outline-variant pt-4'
        }
      >
        <Button onClick={cancel}>{T.cancel}</Button>
        <SubmitButton disabled={!ready} pending={submit.pending} />
      </div>
      {confirmingCancel && (
        <ConfirmDialog
          title={T.discardTitle}
          confirmLabel={T.discard}
          tone="danger"
          pending={false}
          onSubmit={(event) => {
            event.preventDefault();
            void navigate(ORGANIZATIONS_PATH);
          }}
          onCancel={() => setConfirmingCancel(false)}
        >
          <p>{T.discardBody}</p>
        </ConfirmDialog>
      )}
    </form>
  );
}

/** Catálogos del formulario (C-01 y C-02): sin ellos no se puede validar ni enviar. */
function RegistrationContent() {
  const gateway = useMdmGateway();
  const schemes = useQuery(mdmQueries.identifierSchemes(gateway));
  const roleTypes = useQuery(mdmQueries.roleTypes(gateway));
  const loading = schemes.isPending || roleTypes.isPending;
  return (
    <>
      {loading && <LoadingBar subject={T.catalogsLoading} />}
      {schemes.isError && <LoadError subject={T.schemesSubject} error={schemes.error} onRetry={() => void schemes.refetch()} />}
      {roleTypes.isError && <LoadError subject={T.roleTypesSubject} error={roleTypes.error} onRetry={() => void roleTypes.refetch()} />}
      <OrganizationForm schemes={schemes.data?.items ?? []} roleTypes={roleTypes.data?.items ?? []} ready={schemes.isSuccess && roleTypes.isSuccess} />
    </>
  );
}

/**
 * P-MDM-03 «Nueva organización» (US-MDM-003; UX-MDM-001 §4.2 y §5.5; UI-MDM-001 §3.4): datos, identificador
 * primario y roles iniciales opcionales, con validación local (patrón del esquema y dígito del RUC) y los errores
 * del servidor en su campo. El duplicado de identificador ofrece abrir la organización existente. Sin permiso no se
 * ofrece; si se llega por dirección, se explica.
 */
export function NewOrganizationPage() {
  useDocumentTitle(T.title, MDM_TITLE_SUFFIX);
  const session = useMdmSession();
  const allowed = session.can('organization.register');
  return (
    <div className={allowed ? 'flex flex-col gap-6 py-2' : 'flex max-w-210 flex-col gap-6 py-2'}>
      <BackLink to={ORGANIZATIONS_PATH}>{T.back}</BackLink>
      <h1 className="text-headline-small">{T.title}</h1>
      {allowed ? (
        <>
          <p className="max-w-prose text-body-medium">
            {T.searchFirst}{' '}
            <Link to={ORGANIZATIONS_PATH} className="text-primary underline">
              {T.search}
            </Link>
          </p>
          <RegistrationContent />
        </>
      ) : (
        <>
          <p className="text-body-large">{T.noPermission}</p>
          <Link to={ORGANIZATIONS_PATH} className="w-fit text-label-large text-primary underline">
            {T.backToList}
          </Link>
        </>
      )}
    </div>
  );
}
