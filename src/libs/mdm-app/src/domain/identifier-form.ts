import { normalizeIdentifierValue, type AddIdentifierRequest, type IdentifierScheme, type PartyIdentifier } from '@mdm/contracts';
import { checkDate, checkIdentifierValue, type FieldIssue } from './field-rules.ts';

/** Borrador de D-MDM-02 «Agregar identificador» (US-MDM-006). */
export interface IdentifierDraft {
  readonly countryCode: string;
  readonly schemeCode: string;
  readonly value: string;
  readonly validFrom: string;
  readonly isPrimary: boolean;
  readonly replacesPrimary: boolean;
}

export type IdentifierDraftField = 'countryCode' | 'schemeCode' | 'value' | 'validFrom' | 'isPrimary';
export const IDENTIFIER_DRAFT_FIELDS: readonly IdentifierDraftField[] = ['countryCode', 'schemeCode', 'value', 'validFrom', 'isPrimary'];

export function emptyIdentifierDraft(today: string): IdentifierDraft {
  return {
    countryCode: 'PE',
    schemeCode: 'PE-RUC',
    value: '',
    validFrom: today,
    isPrimary: false,
    replacesPrimary: false,
  };
}

/** Problemas locales: obligatorios, patrón del esquema, dígito del RUC y fecha. */
export function validateIdentifierDraft(draft: IdentifierDraft, schemes: readonly IdentifierScheme[]): Partial<Record<IdentifierDraftField, FieldIssue>> {
  const scheme = schemes.find((item) => item.code === draft.schemeCode && item.countryCode === draft.countryCode);
  const found: Array<readonly [IdentifierDraftField, FieldIssue | null]> = [
    ['countryCode', draft.countryCode === '' ? { kind: 'required' } : null],
    ['schemeCode', scheme === undefined ? { kind: 'required' } : null],
    ['value', checkIdentifierValue(draft.value, scheme)],
    ['validFrom', checkDate(draft.validFrom, { required: false, notBefore: null })],
  ];
  return Object.fromEntries(found.filter(([, issue]) => issue !== null));
}

/** Cuerpo de P-09. «Reemplaza» solo viaja con «Es primario» (`validation.replaces_primary_requires_primary`). */
export function toAddIdentifierRequest(draft: IdentifierDraft): AddIdentifierRequest {
  return {
    countryCode: draft.countryCode,
    schemeCode: draft.schemeCode,
    value: normalizeIdentifierValue(draft.value),
    validFrom: draft.validFrom === '' ? null : draft.validFrom,
    isPrimary: draft.isPrimary,
    replacesPrimary: draft.isPrimary && draft.replacesPrimary,
  };
}

/** D-MDM-03: «Vence el» (vacío es hoy) no puede ser anterior al «desde» del identificador (P-10). */
export function checkExpiryDate(value: string, identifier: Pick<PartyIdentifier, 'validFrom'>): FieldIssue | null {
  return checkDate(value, { required: false, notBefore: identifier.validFrom });
}
