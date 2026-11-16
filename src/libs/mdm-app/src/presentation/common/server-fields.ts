import { problemFrom } from '@mdm/contracts';
import type { FieldIssue } from '../../domain/field-rules.ts';

/** Campo del cuerpo que nombra un `400` `validation.failed` y su problema, si se reconoce. */
export interface ServerFieldIssue {
  /** Nombre del campo en el contrato (`legalName`, `primaryIdentifier.value`, `roles[0].validTo`). */
  readonly field: string;
  readonly issue: FieldIssue;
}

/**
 * `400` `validation.failed` (API-MDM-002 §2): un solo campo con sus códigos `validation.*`. Los códigos concretos
 * no los fija el contrato (los del mock son supuestos): se reconocen por su forma. Lo que no se reconoce cae al
 * aviso genérico «Revisa los campos marcados.».
 */
export function serverFieldIssue(error: unknown): ServerFieldIssue | null {
  const problem = problemFrom(error);
  if (problem?.code !== 'validation.failed') return null;
  const [entry] = Object.entries(problem.errors);
  if (entry === undefined) return null;
  const [field, codes] = entry;
  const code = codes[0] ?? '';
  if (code.endsWith('_required')) return { field, issue: { kind: 'required' } };
  if (code.endsWith('_too_long')) return { field, issue: { kind: 'too_long' } };
  if (code === 'validation.date_invalid') return { field, issue: { kind: 'date_invalid' } };
  // `validation.tax_establishment_code_invalid`, `validation.ubigeo_invalid`, `validation.country_code_invalid`.
  if (code.endsWith('_invalid')) return { field, issue: { kind: 'format' } };
  return null;
}
