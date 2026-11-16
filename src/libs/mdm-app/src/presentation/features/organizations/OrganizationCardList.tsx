import type { PartySummary } from '@mdm/contracts';
import { Link } from 'react-router';
import { PartyStatusTag } from '../../common/PartyStatusTag.tsx';
import { organizationPath } from '../../mdm-roots.ts';
import { primaryIdentifierText, rolesText, type RoleNames } from './organization-display.ts';

interface Props {
  readonly items: readonly PartySummary[];
  readonly roleNames: RoleNames;
}

/**
 * Lista de tarjetas de P-MDM-01 en `compact` (UI-MDM-001 §3.2): sin tablas a 320 px (WCAG 1.4.10). Cada tarjeta es
 * un elemento de la lista con su título como enlace que cubre toda la tarjeta (≥ 88 dp).
 */
export function OrganizationCardList({ items, roleNames }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((party) => (
        <li key={party.id} className="relative flex min-h-22 flex-col gap-1 rounded-md border border-outline-variant p-4 state-layer">
          <Link to={organizationPath(party.id)} className="text-title-medium text-on-surface -outline-offset-3 after:absolute after:inset-0">
            {party.code}
          </Link>
          <span className="text-body-large">{party.legalName}</span>
          <span className="text-body-medium text-on-surface-variant">
            <span className="tabular-nums">{primaryIdentifierText(party)}</span>
            <span aria-hidden="true"> · </span>
            <span className="sr-only">, </span>
            {rolesText(party, roleNames)}
          </span>
          <span>
            <PartyStatusTag status={party.status} />
          </span>
        </li>
      ))}
    </ul>
  );
}
