import type { PartySummary } from '@mdm/contracts';
import { Icon, formatDate, joinClasses } from '@sil/ui';
import { Link } from 'react-router';
import type { OrganizationSort, OrganizationSortField } from '../../../domain/organization-search.ts';
import { PartyStatusTag } from '../../common/PartyStatusTag.tsx';
import { organizationPath } from '../../mdm-roots.ts';
import { primaryIdentifierText, rolesText, type RoleNames } from './organization-display.ts';
import { COLUMN_TEXTS as C, ORGANIZATIONS_TEXTS as T } from './texts.ts';

interface Props {
  readonly items: readonly PartySummary[];
  readonly totalCount: number;
  /** `reduced` en `medium`: código con razón social debajo, identificador y estado. */
  readonly variant: 'reduced' | 'full';
  readonly sort: OrganizationSort;
  readonly onSort: (field: OrganizationSortField) => void;
  readonly roleNames: RoleNames;
}

const HEADER_CELL = 'h-12 whitespace-nowrap bg-surface-container-low px-3 text-left text-title-small text-on-surface-variant';
const CELL = 'px-3 text-body-medium';

function ariaSort(field: OrganizationSortField, sort: OrganizationSort): 'ascending' | 'descending' | 'none' {
  if (sort.field !== field) return 'none';
  return sort.order === 'asc' ? 'ascending' : 'descending';
}

function SortableHeading({ field, label, sort, onSort }: { readonly field: OrganizationSortField; readonly label: string; readonly sort: OrganizationSort; readonly onSort: (field: OrganizationSortField) => void }) {
  const direction = ariaSort(field, sort);
  return (
    <th scope="col" aria-sort={direction} className={HEADER_CELL}>
      <button type="button" onClick={() => onSort(field)} className="state-layer -mx-2 inline-flex h-12 cursor-pointer items-center gap-1 rounded-xs px-2">
        {label}
        {direction === 'none' ? (
          <span className="size-4.5" aria-hidden="true" />
        ) : (
          <Icon name={direction === 'ascending' ? 'arrow_upward' : 'arrow_downward'} className="size-4.5" />
        )}
      </button>
    </th>
  );
}

/**
 * Tabla de P-MDM-01 (UI-MDM-001 §3.2): composición con tokens (M3 no tiene tabla, G-136). Una línea por fila en
 * `expanded` (48 dp) y dos en `medium` (56 dp). El código es el único enlace y cubre la fila (AC-04); la columna
 * ordenada lleva `aria-sort` (AC-03).
 */
export function OrganizationsTable({ items, totalCount, variant, sort, onSort, roleNames }: Props) {
  const full = variant === 'full';
  return (
    <div className="overflow-x-auto rounded-md border border-outline-variant">
      <table className="w-full border-collapse">
        <caption className="sr-only">{T.caption(totalCount)}</caption>
        <thead>
          <tr>
            <SortableHeading field="code" label={C.code} sort={sort} onSort={onSort} />
            {full && <SortableHeading field="legalName" label={C.legalName} sort={sort} onSort={onSort} />}
            {full && (
              <th scope="col" className={HEADER_CELL}>
                {C.tradeName}
              </th>
            )}
            <th scope="col" className={HEADER_CELL}>
              {C.identifier}
            </th>
            {full && (
              <th scope="col" className={HEADER_CELL}>
                {C.roles}
              </th>
            )}
            <th scope="col" className={HEADER_CELL}>
              {C.status}
            </th>
            {full && <SortableHeading field="updatedAt" label={C.updatedAt} sort={sort} onSort={onSort} />}
          </tr>
        </thead>
        <tbody>
          {items.map((party) => (
            <tr key={party.id} className={joinClasses('row-state border-t border-outline-variant', full ? 'h-12' : 'h-14')}>
              <td className={joinClasses(CELL, 'whitespace-nowrap')}>
                <Link
                  to={organizationPath(party.id)}
                  className="text-body-medium-emphasized text-primary underline-offset-2 -outline-offset-3 after:absolute after:inset-0 hover:underline"
                >
                  {party.code}
                </Link>
                {!full && <span className="block text-body-small text-on-surface-variant">{party.legalName}</span>}
              </td>
              {full && <td className={CELL}>{party.legalName}</td>}
              {full && <td className={joinClasses(CELL, party.tradeName === null && 'text-on-surface-variant')}>{party.tradeName ?? '—'}</td>}
              <td className={joinClasses(CELL, 'whitespace-nowrap tabular-nums', party.primaryIdentifier === null && 'text-on-surface-variant')}>{primaryIdentifierText(party)}</td>
              {full && <td className={joinClasses(CELL, party.currentRoleTypeCodes.length === 0 && 'text-on-surface-variant')}>{rolesText(party, roleNames)}</td>}
              <td className={CELL}>
                <PartyStatusTag status={party.status} />
              </td>
              {full && <td className={joinClasses(CELL, 'whitespace-nowrap tabular-nums')}>{party.updatedAt === null ? '—' : formatDate(party.updatedAt)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
