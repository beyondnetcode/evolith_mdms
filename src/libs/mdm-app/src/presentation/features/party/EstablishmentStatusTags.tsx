import type { Establishment } from '@mdm/contracts';
import { establishmentState } from '../../../domain/establishment-form.ts';
import { StatusTag } from '../../common/StatusTag.tsx';
import { ESTABLISHMENT_TEXTS as T } from './texts.ts';

/**
 * Estado del establecimiento y, si lo es, «Principal» como segunda etiqueta (UI-MDM-001 §2.3): activo (`ready`),
 * inactivo (`quiet`) o cerrado el {fecha} (`outline`); principal (`quiet`, `star`), salvo cerrado: al cerrarlo la
 * organización queda sin principal (UX-MDM-001 §6.2). En una `span` sin rol.
 */
interface Props {
  readonly establishment: Pick<Establishment, 'isActive' | 'isClosed' | 'isPrincipal' | 'closedAt'>;
  /** Sobre la fila seleccionada de la lista-detalle (DV-04). */
  readonly onSelected?: boolean;
}

export function EstablishmentStatusTags({ establishment, onSelected = false }: Props) {
  const state = establishmentState(establishment);
  return (
    <span className="flex flex-wrap items-center gap-2">
      {state.kind === 'active' && <StatusTag tone="ready" icon="check_circle" text={T.active} />}
      {state.kind === 'inactive' && <StatusTag tone="quiet" icon="pause" text={T.inactive} />}
      {state.kind === 'closed' && <StatusTag tone="outline" icon="cancel" text={T.closedOn(state.closedAt)} onSelected={onSelected} />}
      {establishment.isPrincipal && !establishment.isClosed && <StatusTag tone="quiet" icon="star" text={T.principal} />}
    </span>
  );
}
