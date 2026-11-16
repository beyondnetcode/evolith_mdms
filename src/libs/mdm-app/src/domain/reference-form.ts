import type { Establishment, ExternalKeyFilter, ExternalReference, LinkExternalReferenceRequest, MdmObjectType } from '@mdm/contracts';
import { checkText, type FieldIssue } from './field-rules.ts';

/**
 * Borrador de D-MDM-07 «Vincular referencia externa» (US-MDM-012; UX-MDM-001 §4.5 y §5.6). Sistema, instancia y tipo
 * de objeto son texto libre: no tienen catálogo (SU-MDM-07, G-564).
 */
export interface ReferenceDraft {
  /** `'PARTY'` o el id de un establecimiento no cerrado. */
  readonly target: string;
  readonly systemCode: string;
  readonly systemInstance: string;
  readonly externalObjectType: string;
  readonly externalKey: string;
}

export const PARTY_TARGET = 'PARTY';

export type ReferenceTextField = 'systemCode' | 'systemInstance' | 'externalObjectType' | 'externalKey';
export const REFERENCE_TEXT_FIELDS: readonly ReferenceTextField[] = ['systemCode', 'systemInstance', 'externalObjectType', 'externalKey'];

/** Longitudes del OpenAPI (`LinkExternalReferenceRequest`). */
export const REFERENCE_LIMITS: Readonly<Record<ReferenceTextField, number>> = { systemCode: 50, systemInstance: 50, externalObjectType: 50, externalKey: 100 };

export function emptyReferenceDraft(): ReferenceDraft {
  return { target: PARTY_TARGET, systemCode: '', systemInstance: '', externalObjectType: '', externalKey: '' };
}

/** Todos obligatorios (X-02). */
export function validateReferenceDraft(draft: ReferenceDraft): Partial<Record<ReferenceTextField, FieldIssue>> {
  const found = REFERENCE_TEXT_FIELDS.map((field) => [field, checkText(draft[field], { required: true, max: REFERENCE_LIMITS[field] })] as const);
  return Object.fromEntries(found.filter(([, issue]) => issue !== null));
}

/** Objetos a los que se puede vincular: la organización y sus establecimientos no cerrados (`INV-PTY-10`). */
export function linkableEstablishments(establishments: readonly Establishment[]): readonly Establishment[] {
  return establishments.filter((item) => !item.isClosed);
}

function targetOf(draft: ReferenceDraft, partyId: string): { readonly mdmObjectType: MdmObjectType; readonly mdmObjectId: string } {
  return draft.target === PARTY_TARGET ? { mdmObjectType: 'PARTY', mdmObjectId: partyId } : { mdmObjectType: 'ESTABLISHMENT', mdmObjectId: draft.target };
}

/** La clave completa, recortada: la que se envía y con la que se busca la dueña tras un duplicado. */
export function externalKeyOf(draft: ReferenceDraft): ExternalKeyFilter {
  return {
    systemCode: draft.systemCode.trim(),
    systemInstance: draft.systemInstance.trim(),
    externalObjectType: draft.externalObjectType.trim(),
    externalKey: draft.externalKey.trim(),
  };
}

/** Cuerpo de X-02. */
export function toLinkRequest(draft: ReferenceDraft, partyId: string): LinkExternalReferenceRequest {
  return { ...externalKeyOf(draft), ...targetOf(draft, partyId) };
}

/** Una referencia desvinculada es terminal: sin acciones (US-MDM-012). */
export function canUnlink(reference: Pick<ExternalReference, 'syncStatus'>): boolean {
  return reference.syncStatus !== 'Unlinked';
}

/** Vinculadas (no desvinculadas): las que cuentan como prerrequisito al cerrar un establecimiento (D-MDM-09). */
export function linkedCount(references: ReadonlyArray<Pick<ExternalReference, 'syncStatus'>>): number {
  return references.filter(canUnlink).length;
}
