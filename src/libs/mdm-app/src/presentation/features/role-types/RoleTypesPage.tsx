import type { PartyRoleType } from '@mdm/contracts';
import { ActionMenu, LoadError, LoadingBar, Skeleton, Switch, joinClasses, useDocumentTitle, useWindowSizeClass, type MenuItem } from '@sil/ui';
import type { WindowSizeClass } from '@sil/ui-tokens';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { useMdmGateway } from '../../../application/gateway-context.ts';
import { mdmQueries } from '../../../application/queries.ts';
import { useRoleTypeCache, type RoleTypeCache } from '../../../application/role-type-writes.ts';
import { useMdmSession } from '../../../application/session-context.ts';
import { useDialogHost, type FocusTarget } from '../../common/dialogs/use-dialog-host.ts';
import { SectionToolbar } from '../../common/SectionToolbar.tsx';
import { SECTION_TABLE } from '../../common/table-styles.ts';
import { TableFrame } from '../../common/TableFrame.tsx';
import { MDM_TITLE_SUFFIX } from '../../mdm-roots.ts';
import { RoleTypeDialog } from './RoleTypeDialog.tsx';
import { RoleTypeStatusTag } from './RoleTypeStatusTag.tsx';
import { ToggleRoleTypeDialog } from './ToggleRoleTypeDialog.tsx';
import { ROLE_TYPE_COLUMNS as C, ROLE_TYPE_TEXTS as T, partyTypesText } from './texts.ts';

/** El diálogo abierto de la pantalla: uno a la vez. */
type OpenDialog =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly type: PartyRoleType }
  | { readonly kind: 'toggle'; readonly type: PartyRoleType; readonly action: 'deactivate' | 'activate' };

type RowCommand = 'edit' | 'deactivate' | 'activate';

/** Selector del botón del menú de una fila: el foco vuelve a él al cerrar un diálogo. */
function menuSelector(code: string): string {
  return `[data-role-type-menu="${code}"] button[aria-haspopup="menu"]`;
}

interface RowProps {
  /** `null` si la persona solo consulta: sin menú por fila. */
  readonly onCommand: ((command: RowCommand, type: PartyRoleType) => void) | null;
}

function RowMenu({ type, onCommand }: { readonly type: PartyRoleType } & RowProps) {
  if (onCommand === null) return null;
  const items: MenuItem[] = [
    { id: 'edit', label: T.edit, onSelect: () => onCommand('edit', type) },
    type.isActive
      ? { id: 'deactivate', label: T.deactivate, onSelect: () => onCommand('deactivate', type) }
      : { id: 'activate', label: T.activate, onSelect: () => onCommand('activate', type) },
  ];
  return (
    <div data-role-type-menu={type.code}>
      <ActionMenu label={T.moreActions(type.name)} items={items} />
    </div>
  );
}

function Edifact({ type }: { readonly type: PartyRoleType }) {
  if (type.unEdifact3035Code !== null) return <span className="tabular-nums">{type.unEdifact3035Code}</span>;
  return (
    <span className="text-on-surface-variant">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{T.noCode}</span>
    </span>
  );
}

/**
 * Tabla de P-MDM-04 (UI-MDM-001 §3.7): completa desde `expanded`; en `medium`, reducida (código con nombre debajo,
 * tipos de parte, estado). Composición con tokens: M3 no tiene tabla (G-136).
 */
function RoleTypesTable({ items, full, onCommand }: { readonly items: readonly PartyRoleType[]; readonly full: boolean } & RowProps) {
  const headings = full ? [C.code, C.name, C.edifact, C.partyTypes, C.fiscal, C.status] : [C.code, C.partyTypes, C.status];
  return (
    <TableFrame label={T.caption(items.length)}>
      <table className={SECTION_TABLE.table}>
        <caption className="sr-only">{T.caption(items.length)}</caption>
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col" className={SECTION_TABLE.headerCell}>
                {heading}
              </th>
            ))}
            {onCommand !== null && (
              <th scope="col" className={SECTION_TABLE.headerCell}>
                <span className="sr-only">{T.rowActions}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((type) => (
            <tr key={type.code} className={joinClasses(SECTION_TABLE.row, !full && 'h-14')}>
              <td className={joinClasses(SECTION_TABLE.cell, 'whitespace-nowrap')}>
                <span className="text-body-medium-emphasized">{type.code}</span>
                {!full && <span className="block text-body-small text-on-surface-variant">{type.name}</span>}
              </td>
              {full && (
                <td className={SECTION_TABLE.cell}>
                  {type.name}
                  {type.description !== null && <span className="block text-body-small text-on-surface-variant">{type.description}</span>}
                </td>
              )}
              {full && (
                <td className={SECTION_TABLE.cell}>
                  <Edifact type={type} />
                </td>
              )}
              <td className={SECTION_TABLE.cell}>{partyTypesText(type.allowedPartyTypes)}</td>
              {full && <td className={SECTION_TABLE.cell}>{type.requiresFiscalIdentifier ? T.yes : T.no}</td>}
              <td className={SECTION_TABLE.cell}>
                <RoleTypeStatusTag isActive={type.isActive} />
              </td>
              {onCommand !== null && (
                <td className={SECTION_TABLE.actionsCell}>
                  <RowMenu type={type} onCommand={onCommand} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

/** Tarjetas de P-MDM-04 en `compact`: sin tablas a 320 px (WCAG 1.4.10). */
function RoleTypeCards({ items, onCommand }: { readonly items: readonly PartyRoleType[] } & RowProps) {
  return (
    <ul aria-label={T.title} className="flex flex-col gap-2">
      {items.map((type) => (
        <li key={type.code} className="flex items-start gap-2 rounded-md border border-outline-variant p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-title-medium break-words">{type.name}</span>
            <span className="text-body-medium break-all">{type.code}</span>
            {type.description !== null && <span className="text-body-medium text-on-surface-variant">{type.description}</span>}
            <dl className="flex flex-col text-body-medium">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-on-surface-variant">{C.edifact}</dt>
                <dd>
                  <Edifact type={type} />
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-on-surface-variant">{C.partyTypes}</dt>
                <dd>{partyTypesText(type.allowedPartyTypes)}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-on-surface-variant">{C.fiscal}</dt>
                <dd>{type.requiresFiscalIdentifier ? T.yes : T.no}</dd>
              </div>
            </dl>
            <span>
              <RoleTypeStatusTag isActive={type.isActive} />
            </span>
          </div>
          <RowMenu type={type} onCommand={onCommand} />
        </li>
      ))}
    </ul>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

function Results({ items, sizeClass, onCommand }: { readonly items: readonly PartyRoleType[]; readonly sizeClass: WindowSizeClass } & RowProps) {
  if (sizeClass === 'compact') return <RoleTypeCards items={items} onCommand={onCommand} />;
  return <RoleTypesTable items={items} full={sizeClass !== 'medium'} onCommand={onCommand} />;
}

interface ContentProps extends RowProps {
  readonly loaded: boolean;
  readonly all: readonly PartyRoleType[];
  readonly items: readonly PartyRoleType[];
  readonly sizeClass: WindowSizeClass;
}

/** Exactamente uno de cargando, vacío o la lista (tabla o tarjetas según el tamaño). */
function CatalogContent({ loaded, all, items, sizeClass, onCommand }: ContentProps) {
  if (!loaded) return <ResultsSkeleton />;
  if (items.length === 0) return <p className="text-body-medium text-on-surface-variant">{all.length === 0 ? T.noneAtAll : T.none}</p>;
  return <Results items={items} sizeClass={sizeClass} onCommand={onCommand} />;
}

interface DialogProps {
  readonly dialog: OpenDialog;
  readonly takenCodes: readonly string[];
  readonly cache: RoleTypeCache;
  readonly onClose: () => void;
}

function Dialog({ dialog, takenCodes, cache, onClose }: DialogProps) {
  switch (dialog.kind) {
    case 'create':
      return <RoleTypeDialog type={null} takenCodes={takenCodes} cache={cache} onClose={onClose} />;
    case 'edit':
      return <RoleTypeDialog type={dialog.type} takenCodes={takenCodes} cache={cache} onClose={onClose} />;
    case 'toggle':
      return <ToggleRoleTypeDialog type={dialog.type} action={dialog.action} cache={cache} onClose={onClose} />;
  }
}

/**
 * P-MDM-04 «Tipos de rol» (US-MDM-014, D-046; UX-MDM-001 §5.7; UI-MDM-001 §3.7): el catálogo `PartyRoleType` con
 * código, nombre, código UN/EDIFACT 3035, tipos de parte, «exige identificador fiscal» y estado; por defecto solo los
 * activos, con «Mostrar inactivos». Quien administra (analista y responsable, SUPUESTO) da de alta, edita, desactiva y
 * reactiva; el resto consulta, sin botones ni menús. El servidor decide igualmente (`403`).
 */
export function RoleTypesPage() {
  useDocumentTitle(T.title, MDM_TITLE_SUFFIX);
  const gateway = useMdmGateway();
  const session = useMdmSession();
  const sizeClass = useWindowSizeClass();
  const cache = useRoleTypeCache();
  const catalog = useQuery(mdmQueries.roleTypeCatalog(gateway));
  const [showInactive, setShowInactive] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const fallback = useCallback<FocusTarget>(() => heading.current, []);
  const all = catalog.data?.items ?? [];
  const host = useDialogHost<OpenDialog>(fallback, catalog.dataUpdatedAt);
  const canMaintain = session.can('roleType.maintain');
  const items = all.filter((type) => showInactive || type.isActive);

  const onCommand = canMaintain
    ? (command: RowCommand, type: PartyRoleType) => {
        const returnFocus: FocusTarget = () => document.querySelector<HTMLElement>(menuSelector(type.code));
        host.open(command === 'edit' ? { kind: 'edit', type } : { kind: 'toggle', type, action: command }, returnFocus);
      }
    : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 ref={heading} tabIndex={-1} className="pt-2 text-headline-small outline-none">
        {T.title}
      </h1>
      <p className="max-w-prose text-body-medium text-on-surface-variant">{T.intro}</p>
      <div className="h-1">{catalog.isFetching && <LoadingBar subject={T.loading} />}</div>

      <SectionToolbar
        filter={<Switch label={T.showInactive} description={T.showInactiveHelp} active={showInactive} onChange={setShowInactive} />}
        action={
          canMaintain
            ? {
                kind: 'available',
                label: T.newRoleType,
                onSelect: (trigger) => host.open({ kind: 'create' }, () => (trigger.isConnected ? trigger : null)),
              }
            : null
        }
      />

      <p role="status" className="text-body-medium text-on-surface-variant">
        {catalog.data === undefined ? '' : T.count(items.length)}
      </p>

      {catalog.isError ? (
        <LoadError subject={T.loading} error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : (
        <CatalogContent loaded={catalog.data !== undefined} all={all} items={items} sizeClass={sizeClass} onCommand={onCommand} />
      )}

      {host.dialog !== null && <Dialog dialog={host.dialog} takenCodes={all.map((type) => type.code)} cache={cache} onClose={host.close} />}
    </div>
  );
}
