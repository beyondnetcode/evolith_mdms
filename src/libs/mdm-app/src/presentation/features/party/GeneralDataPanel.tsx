import type { Party } from '@mdm/contracts';
import { formatDateTime } from '@sil/ui';
import type { ReactNode } from 'react';
import { PartyStatusTag } from '../../common/PartyStatusTag.tsx';
import { GENERAL_TEXTS as T } from './texts.ts';

function Field({ term, children }: { readonly term: string; readonly children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-body-small text-on-surface-variant">{term}</dt>
      <dd className="text-body-large break-words">{children}</dd>
    </div>
  );
}

/**
 * Sección «Datos generales» (UX-MDM-001 §5.4; UI-MDM-001 §3.3): pares etiqueta-valor, en dos columnas desde
 * `expanded`, con la auditoría (fecha, hora y usuario). Solo lectura: se edita con «Editar nombres».
 */
export function GeneralDataPanel({ party }: { readonly party: Party }) {
  return (
    <dl className="grid max-w-210 gap-4 expanded:grid-cols-2">
      <Field term={T.type}>{T.organization}</Field>
      <Field term={T.code}>{party.code}</Field>
      <Field term={T.legalName}>{party.legalName}</Field>
      <Field term={T.tradeName}>{party.tradeName ?? '—'}</Field>
      <Field term={T.status}>
        <PartyStatusTag status={party.status} />
      </Field>
      <Field term={T.created}>
        <span className="text-body-small tabular-nums">{T.audit(formatDateTime(party.createdAt), party.createdBy)}</span>
      </Field>
      <Field term={T.updated}>
        <span className="text-body-small tabular-nums">
          {party.updatedAt === null ? '—' : T.audit(formatDateTime(party.updatedAt), party.updatedBy ?? '—')}
        </span>
      </Field>
    </dl>
  );
}
