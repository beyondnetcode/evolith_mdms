import type { PartyRole } from '@mdm/contracts';
import { ActionMenu, Switch, formatCivilDate, joinClasses, useWindowSizeClass } from '@sil/ui';
import { useState } from 'react';
import { compareRoles, isHistoricalRole, roleRowCommands, type RoleRowCommand } from '../../../domain/role-state.ts';
import type { RoleNames } from '../../common/field-messages.ts';
import { SectionToolbar, type SectionAction } from '../../common/SectionToolbar.tsx';
import { SECTION_TABLE } from '../../common/table-styles.ts';
import { RoleStatusTag } from './RoleStatusTag.tsx';
import { hasEnabledItem, rowMenuItems, type Availability } from './row-menu.ts';
import { ROLE_TEXTS as T } from './texts.ts';

interface Props {
  readonly code: string;
  readonly roles: readonly PartyRole[];
  readonly roleNames: RoleNames;
  readonly today: string;
  /** «Asignar rol»: `null` si no se ofrece (sin permiso o solo lectura). */
  readonly assign: SectionAction | null;
  readonly availability: Availability;
  readonly onCommand: (command: RoleRowCommand, role: PartyRole) => void;
}

/** Selector del botón del menú de una fila: el foco vuelve a él al cerrar un diálogo o tras una acción de un clic. */
export function roleMenuSelector(roleId: string): string {
  return `[data-role-menu="${roleId}"] button[aria-haspopup="menu"]`;
}

const LABELS: Readonly<Record<RoleRowCommand, string>> = { suspendRole: T.suspend, activateRole: T.activate, terminateRole: T.terminate };

/** «Cliente (CUSTOMER)»: nombre del catálogo y código; sin catálogo, el código. */
export function roleTypeLabel(role: Pick<PartyRole, 'roleTypeCode'>, roleNames: RoleNames): string {
  return T.typeName(roleNames[role.roleTypeCode] ?? role.roleTypeCode, role.roleTypeCode);
}

function RowMenu({ role, roleNames, availability, onCommand }: { readonly role: PartyRole } & Pick<Props, 'roleNames' | 'availability' | 'onCommand'>) {
  const items = rowMenuItems(roleRowCommands(role), availability, LABELS, (command) => onCommand(command, role));
  // Un rol terminado no tiene menú (terminal); tampoco uno cuyas órdenes están todas bloqueadas u ocultas.
  if (!hasEnabledItem(items)) return null;
  return (
    <div data-role-menu={role.roleId}>
      <ActionMenu label={T.moreActions(roleNames[role.roleTypeCode] ?? role.roleTypeCode)} items={items} />
    </div>
  );
}

function validity(role: PartyRole): { readonly from: string; readonly to: string } {
  return { from: formatCivilDate(role.validFrom), to: role.validTo === null ? T.open : formatCivilDate(role.validTo) };
}

function RolesTable({ code, items, ...row }: { readonly items: readonly PartyRole[] } & Pick<Props, 'code' | 'roleNames' | 'today' | 'availability' | 'onCommand'>) {
  return (
    <div className={SECTION_TABLE.frame}>
      <table className={SECTION_TABLE.table}>
        <caption className="sr-only">{`Roles de ${code}`}</caption>
        <thead>
          <tr>
            {[T.type, T.status, T.from, T.to].map((heading) => (
              <th key={heading} scope="col" className={SECTION_TABLE.headerCell}>
                {heading}
              </th>
            ))}
            <th scope="col" className={SECTION_TABLE.headerCell}>
              <span className="sr-only">{T.rowActions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((role) => {
            const dates = validity(role);
            return (
              <tr key={role.roleId} className={SECTION_TABLE.row}>
                <td className={SECTION_TABLE.cell}>{roleTypeLabel(role, row.roleNames)}</td>
                <td className={SECTION_TABLE.cell}>
                  <RoleStatusTag role={role} today={row.today} />
                </td>
                <td className={joinClasses(SECTION_TABLE.cell, 'tabular-nums')}>{dates.from}</td>
                <td className={joinClasses(SECTION_TABLE.cell, 'tabular-nums')}>{dates.to}</td>
                <td className={SECTION_TABLE.actionsCell}>
                  <RowMenu role={role} roleNames={row.roleNames} availability={row.availability} onCommand={row.onCommand} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RoleCards({ items, ...row }: { readonly items: readonly PartyRole[] } & Pick<Props, 'roleNames' | 'today' | 'availability' | 'onCommand'>) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((role) => {
        const dates = validity(role);
        return (
          <li key={role.roleId} className="flex items-start gap-2 rounded-md border border-outline-variant p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-title-medium">{roleTypeLabel(role, row.roleNames)}</span>
              <RoleStatusTag role={role} today={row.today} />
              <span className="text-body-medium text-on-surface-variant tabular-nums">{`${T.from} ${dates.from} – ${dates.to}`}</span>
            </div>
            <RowMenu role={role} roleNames={row.roleNames} availability={row.availability} onCommand={row.onCommand} />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Sección «Roles» (US-MDM-007 y 008; UX-MDM-001 §5.4; UI-MDM-001 §2.2 y §3.3): tabla desde `medium`, tarjetas en
 * `compact`. Estado derivado de la vigencia. Por defecto oculta los históricos —terminados y vencidos— con
 * «Mostrar históricos» (apagado). «Asignar rol» (D-MDM-04) y, por fila, suspender, reactivar y «Terminar» (D-MDM-10).
 */
export function RolesPanel({ code, roles, roleNames, today, assign, availability, onCommand }: Props) {
  const compact = useWindowSizeClass() === 'compact';
  const [showHistorical, setShowHistorical] = useState(false);
  const items = roles.filter((role) => showHistorical || !isHistoricalRole(role, today)).toSorted(compareRoles(today));
  const hasHistorical = roles.some((role) => isHistoricalRole(role, today));
  const row = { roleNames, today, availability, onCommand };
  return (
    <div className="flex flex-col gap-4">
      <SectionToolbar
        action={assign}
        filter={<Switch label={T.showHistorical} description={T.showHistoricalHelp} active={showHistorical} onChange={setShowHistorical} />}
      />
      {items.length > 0 && (compact ? <RoleCards items={items} {...row} /> : <RolesTable code={code} items={items} {...row} />)}
      {roles.length === 0 && <p className="text-body-medium text-on-surface-variant">{T.none}</p>}
      {roles.length > 0 && items.length === 0 && <p className="text-body-medium text-on-surface-variant">{T.noneVisible}</p>}
      {showHistorical && !hasHistorical && roles.length > 0 && (
        <p role="status" className="text-body-medium text-on-surface-variant">
          {T.noHistorical}
        </p>
      )}
    </div>
  );
}
