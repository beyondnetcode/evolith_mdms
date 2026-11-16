import type { WriteResult } from '@mdm/contracts';
import type { MockClock } from './clock.ts';
import { conflict, invalid, notFound, preconditionFailed } from './errors.ts';
import type { MdmMockStore, PartyRecord } from './store.ts';

/** Lo que cada operación del mock necesita: el almacén, el reloj y quién escribe (el `sub` del portador). */
export interface MockContext {
  readonly store: MdmMockStore;
  readonly clock: MockClock;
  readonly actor: string;
}

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const COUNTRY = /^[A-Z]{2}$/;

// Reglas de forma (`400`): el contrato solo fija el formato del `code` y un ejemplo; los códigos `validation.*`
// concretos son supuestos del mock.

/** Texto obligatorio tras recortar, con longitud máxima. */
export function requireText(field: string, value: string, max: number, rule: string): string {
  const clean = value.trim();
  if (clean === '') return invalid(field, `validation.${rule}_required`);
  if (clean.length > max) return invalid(field, `validation.${rule}_too_long`);
  return clean;
}

/** Texto opcional: vacío es `null`. */
export function optionalText(field: string, value: string | null, max: number, rule: string): string | null {
  const clean = value?.trim() ?? '';
  if (clean.length > max) return invalid(field, `validation.${rule}_too_long`);
  return clean === '' ? null : clean;
}

export function requireDate(field: string, value: string | null, fallback: string): string {
  if (value === null) return fallback;
  return CIVIL_DATE.test(value) && Number.isFinite(Date.parse(value)) ? value : invalid(field, 'validation.date_invalid');
}

export function optionalDate(field: string, value: string | null): string | null {
  return value === null ? null : requireDate(field, value, value);
}

export function requireCountry(field: string, value: string): string {
  return COUNTRY.test(value) ? value : invalid(field, 'validation.country_code_invalid');
}

/** «Hasta» ≥ «desde». */
export function requireOrderedValidity(from: string, to: string | null, field = 'validTo'): void {
  if (to !== null && to < from) invalid(field, 'validation.valid_to_before_valid_from');
}

export function checkReason(reason: string | null): void {
  if (reason !== null && reason.trim().length > 500) invalid('reason', 'validation.reason_too_long');
}

/** Ruta de un subrecurso de la Party: `/parties/{partyId}/…/{id}`. */
export interface PartyPart {
  readonly partyId: string;
  readonly id: string;
}

/** El elemento de la ruta, o `404`. */
export function found<T>(item: T | undefined): T {
  return item ?? notFound();
}

/** La Party de la ruta, o `404`. */
export function findParty(context: MockContext, partyId: string): PartyRecord {
  return context.store.parties.get(partyId) ?? notFound();
}

/** `INV-PTY-11`: una Party archivada o fusionada no se modifica. */
export function assertWritable(party: PartyRecord): void {
  if (party.status === 'Archived') conflict('party.archived');
  if (party.status === 'Merged') conflict('party.merged');
}

/** Política de estado (contrato §6.2): con la Party suspendida no se asignan ni reactivan roles ni establecimientos. */
export function assertActive(party: PartyRecord): void {
  if (party.status !== 'Active') conflict('party.not_active');
}

/** Pasos de una escritura sobre la Party, en el orden de evaluación del contrato (§2.2). */
export interface PartyWrite<T> {
  /** `404` del subrecurso de la ruta (identificador, rol, establecimiento) y su forma dependiente (`400`). */
  readonly locate?: (party: PartyRecord) => void;
  /** `422`: valores que un catálogo o una regla sin estado no admite. */
  readonly validate?: (party: PartyRecord) => void;
  /** `409` y la mutación. Solo muta si no lanza antes de mutar. */
  readonly apply: (party: PartyRecord) => T;
}

/**
 * Escritura sobre el agregado Party (cualquier subrecurso): `404` → `412` → `422` → `409`. Si tiene éxito,
 * sube la versión de la Party (su `ETag`) y la auditoría.
 */
export function writeParty<T>(context: MockContext, partyId: string, ifMatch: number, write: PartyWrite<T>): { readonly value: T } & WriteResult {
  const party = findParty(context, partyId);
  write.locate?.(party);
  if (party.version !== ifMatch) preconditionFailed();
  write.validate?.(party);
  assertWritable(party);
  const value = write.apply(party);
  party.version += 1;
  party.updatedAt = context.clock.now();
  party.updatedBy = context.actor;
  return { value, version: party.version };
}
