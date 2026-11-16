import type { PartyIdentifier } from '@mdm/contracts';
import { ActionMenu, Button, Switch, formatCivilDate, joinClasses, useWindowSizeClass } from '@sil/ui';
import { useState } from 'react';
import { isExpired } from '../../../domain/party-policy.ts';
import { SECTION_TABLE } from '../../common/table-styles.ts';
import { IdentifierStatusTag, PrimaryTag } from './IdentifierStatusTag.tsx';
import { IDENTIFIER_TEXTS as T } from './texts.ts';

interface Props {
  readonly code: string;
  readonly identifiers: readonly PartyIdentifier[];
  readonly today: string;
  /** `null` si la persona no puede agregar (o la organización es de solo lectura): el botón no se pinta. */
  readonly onAdd: ((trigger: HTMLElement) => void) | null;
  /** `null` si la persona no puede vencer: las filas no tienen menú. */
  readonly onExpire: ((identifier: PartyIdentifier) => void) | null;
}

const HEADER_CELL = SECTION_TABLE.headerCell;
const CELL = SECTION_TABLE.cell;

/** Selector del contenedor del menú de una fila: el foco vuelve a su botón al cerrar el diálogo. */
export function identifierMenuSelector(identifierId: string): string {
  return `[data-identifier-menu="${identifierId}"] button`;
}

/** Primario vigente primero; después, los más recientes. */
function byRelevance(a: PartyIdentifier, b: PartyIdentifier): number {
  const primary = Number(b.isPrimary && b.isCurrent) - Number(a.isPrimary && a.isCurrent);
  return primary !== 0 ? primary : b.validFrom.localeCompare(a.validFrom);
}

function RowMenu({ identifier, today, onExpire }: { readonly identifier: PartyIdentifier; readonly today: string; readonly onExpire: Props['onExpire'] }) {
  // Sin editar ni borrar: solo vencer, y nunca uno ya vencido (US-MDM-006).
  if (onExpire === null || isExpired(identifier, today)) return null;
  return (
    <div data-identifier-menu={identifier.identifierId}>
      <ActionMenu
        label={T.moreActions(identifier.schemeCode, identifier.value)}
        items={[
          {
            id: 'expire',
            label: T.expire,
            onSelect: () => onExpire(identifier),
          },
        ]}
      />
    </div>
  );
}

function IdentifiersTable({
  code,
  items,
  today,
  onExpire,
}: {
  readonly code: string;
  readonly items: readonly PartyIdentifier[];
  readonly today: string;
  readonly onExpire: Props['onExpire'];
}) {
  return (
    <div className={SECTION_TABLE.frame}>
      <table className={SECTION_TABLE.table}>
        <caption className="sr-only">{`Identificadores de ${code}`}</caption>
        <thead>
          <tr>
            {[T.country, T.scheme, T.value, T.primary, T.from, T.to, T.status].map((heading) => (
              <th key={heading} scope="col" className={HEADER_CELL}>
                {heading}
              </th>
            ))}
            <th scope="col" className={HEADER_CELL}>
              <span className="sr-only">{T.rowActions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((identifier) => (
            <tr key={identifier.identifierId} className={SECTION_TABLE.row}>
              <td className={CELL}>{identifier.countryCode}</td>
              <td className={CELL}>{identifier.schemeCode}</td>
              <td className={joinClasses(CELL, 'tabular-nums')}>{identifier.value}</td>
              <td className={CELL}>{identifier.isPrimary ? <PrimaryTag /> : <span className="text-on-surface-variant">—</span>}</td>
              <td className={joinClasses(CELL, 'tabular-nums')}>{formatCivilDate(identifier.validFrom)}</td>
              <td className={joinClasses(CELL, 'tabular-nums')}>{identifier.validTo === null ? T.open : formatCivilDate(identifier.validTo)}</td>
              <td className={CELL}>
                <IdentifierStatusTag identifier={identifier} />
              </td>
              <td className={SECTION_TABLE.actionsCell}>
                <RowMenu identifier={identifier} today={today} onExpire={onExpire} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IdentifierCards({
  items,
  today,
  onExpire,
}: {
  readonly items: readonly PartyIdentifier[];
  readonly today: string;
  readonly onExpire: Props['onExpire'];
}) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((identifier) => (
        <li key={identifier.identifierId} className="flex items-start gap-2 rounded-md border border-outline-variant p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-title-medium tabular-nums">{`${identifier.schemeCode} ${identifier.value}`}</span>
            <span className="flex flex-wrap gap-2">
              <IdentifierStatusTag identifier={identifier} />
              {identifier.isPrimary && <PrimaryTag />}
            </span>
            <span className="text-body-medium text-on-surface-variant tabular-nums">
              {`${identifier.countryCode} · ${formatCivilDate(identifier.validFrom)} – ${identifier.validTo === null ? T.open : formatCivilDate(identifier.validTo)}`}
            </span>
          </div>
          <RowMenu identifier={identifier} today={today} onExpire={onExpire} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Sección «Identificadores» (UX-MDM-001 §5.4; UI-MDM-001 §3.3): tabla desde `medium`, tarjetas en `compact`. Por
 * defecto oculta los vencidos («Mostrar vencidos», apagado). Se agrega o se vence; nunca se edita ni se borra.
 */
export function IdentifiersPanel({ code, identifiers, today, onAdd, onExpire }: Props) {
  const compact = useWindowSizeClass() === 'compact';
  const [showExpired, setShowExpired] = useState(false);
  const items = identifiers.filter((identifier) => showExpired || !isExpired(identifier, today)).toSorted(byRelevance);
  const hasExpired = identifiers.some((identifier) => isExpired(identifier, today));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Switch label={T.showExpired} description={T.showExpiredHelp} active={showExpired} onChange={setShowExpired} className="min-w-64 flex-1" />
        {onAdd !== null && (
          <Button variant="tonal" onClick={(event) => onAdd(event.currentTarget)}>
            {T.add}
          </Button>
        )}
      </div>
      {items.length > 0 &&
        (compact ? (
          <IdentifierCards items={items} today={today} onExpire={onExpire} />
        ) : (
          <IdentifiersTable code={code} items={items} today={today} onExpire={onExpire} />
        ))}
      {items.length === 0 && <p className="text-body-medium text-on-surface-variant">{T.none}</p>}
      {showExpired && !hasExpired && (
        <p role="status" className="text-body-medium text-on-surface-variant">
          {T.noExpired}
        </p>
      )}
    </div>
  );
}
