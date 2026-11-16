import { hasProblemCode, type IdentifierScheme } from '@mdm/contracts';
import type { OrganizationDraft, OrganizationField, OrganizationIssue } from '../../../domain/organization-form.ts';
import { roleField } from '../../../domain/organization-form.ts';
import { fieldMessage, type FieldKind, type RoleNames } from '../../common/field-messages.ts';
import { findScheme, identifierProblemField, identifierProblemText } from '../../common/identifier-display.ts';
import { problemSentence } from '../../common/problem-text.ts';
import { serverFieldIssue } from '../../common/server-fields.ts';

export type OrganizationErrors = Partial<Record<OrganizationField, string>>;

const ROLE_FIELD = /^role-\d+-(roleTypeCode|validFrom|validTo)$/;
const ROLE_KIND: Readonly<Record<string, FieldKind>> = {
  roleTypeCode: 'roleTypeCode',
  validFrom: 'date',
  validTo: 'validTo',
};
const FIXED_KIND: Readonly<Partial<Record<OrganizationField, FieldKind>>> = {
  code: 'code',
  legalName: 'legalName',
  tradeName: 'tradeName',
  countryCode: 'countryCode',
  schemeCode: 'schemeCode',
  value: 'value',
  validFrom: 'date',
};

/** Clase de mensaje de cada campo del formulario. */
export function kindOf(field: OrganizationField): FieldKind {
  const role = ROLE_FIELD.exec(field);
  return (role === null ? FIXED_KIND[field] : ROLE_KIND[role[1] ?? '']) ?? 'value';
}

export function messagesOf(issues: readonly OrganizationIssue[], roleNames: RoleNames): OrganizationErrors {
  const errors: OrganizationErrors = {};
  for (const { field, issue } of issues) errors[field] ??= fieldMessage(kindOf(field), issue, roleNames);
  return errors;
}

const SERVER_FIELD: Readonly<Record<string, OrganizationField>> = {
  code: 'code',
  legalName: 'legalName',
  tradeName: 'tradeName',
  'primaryIdentifier.countryCode': 'countryCode',
  'primaryIdentifier.schemeCode': 'schemeCode',
  'primaryIdentifier.value': 'value',
  'primaryIdentifier.validFrom': 'validFrom',
};

const SERVER_ROLE_FIELD = /^roles\[(\d+)\]\.(roleTypeCode|validFrom|validTo)$/;

/** Campo del formulario que nombra el `errors` de un `400` (`roles[0].validTo` → la fila de ese rol). */
function formFieldOf(serverField: string, draft: OrganizationDraft): OrganizationField | null {
  const fixed = SERVER_FIELD[serverField];
  if (fixed !== undefined) return fixed;
  const role = SERVER_ROLE_FIELD.exec(serverField);
  const row = role === null ? undefined : draft.roles[Number(role[1])];
  if (row === undefined || role === null) return null;
  return roleField(row.key, role[2] === 'roleTypeCode' ? 'roleTypeCode' : role[2] === 'validFrom' ? 'validFrom' : 'validTo');
}

/**
 * Error del alta → campo y mensaje (UX-MDM-001 §4.2 y §6.1, «Dónde»). `null` si no tiene campo: va en el aviso del
 * formulario. El duplicado se trata aparte (aviso con la organización existente).
 */
export function rejectionErrors(error: unknown, draft: OrganizationDraft, schemes: readonly IdentifierScheme[]): OrganizationErrors | null {
  if (hasProblemCode(error, 'party.code_not_unique')) return { code: problemSentence(error) };
  const identifierField = identifierProblemField(error);
  if (identifierField !== null) {
    return {
      [identifierField]: identifierProblemText(error, findScheme(schemes, draft.countryCode, draft.schemeCode), draft.countryCode),
    };
  }
  const invalid = serverFieldIssue(error);
  const field = invalid === null ? null : formFieldOf(invalid.field, draft);
  return invalid === null || field === null ? null : { [field]: fieldMessage(kindOf(field), invalid.issue) };
}
