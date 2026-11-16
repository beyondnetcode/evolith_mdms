import type { Party } from '@mdm/contracts';
import { ActionMenu, type MenuItem } from '@sil/ui';
import { currentPrimary } from '../../../domain/party-policy.ts';
import type { RoleNames } from '../../common/field-messages.ts';
import { PartyStatusTag } from '../../common/PartyStatusTag.tsx';
import { PARTY_TEXTS as T } from './texts.ts';

interface Props {
  readonly party: Party;
  readonly roleNames: RoleNames;
  /** Acciones de la organización ya filtradas por estado y rol; vacía, no hay menú. */
  readonly actions: readonly MenuItem[];
}

/** Botón del menú «Acciones»: el foco vuelve a él al cerrar un diálogo abierto desde el menú. */
export const PARTY_MENU_BUTTON = '[data-party-menu] button[aria-haspopup="menu"]';

/**
 * Cabecera de P-MDM-02 (UX-MDM-001 §5.4; UI-MDM-001 §3.3): `h1` con el código, nombres, estado con texto, el
 * identificador primario vigente y los roles vigentes. Las acciones van en un menú «Acciones»; en una organización
 * archivada o fusionada no hay menú (solo lectura, `INV-PTY-11`).
 */
export function PartyHeader({ party, roleNames, actions }: Props) {
  const primary = currentPrimary(party.identifiers);
  const roles = party.roles.filter((role) => role.isCurrent).map((role) => roleNames[role.roleTypeCode] ?? role.roleTypeCode);
  return (
    <header className="flex items-start gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="text-headline-small break-words">{party.code}</h1>
        <p className="text-body-large">
          {party.legalName}
          {party.tradeName !== null && <span className="text-on-surface-variant"> · {party.tradeName}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-medium text-on-surface-variant">
          <PartyStatusTag status={party.status} size="regular" />
          <span className="tabular-nums">{primary === undefined ? T.noPrimary : `${primary.schemeCode} ${primary.value}`}</span>
          <span>{roles.length === 0 ? T.noRoles : T.roles(roles.join(', '))}</span>
        </div>
      </div>
      {actions.length > 0 && (
        <div data-party-menu="">
          <ActionMenu label={T.actions} items={actions} />
        </div>
      )}
    </header>
  );
}
