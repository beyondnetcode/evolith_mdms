import { hasProblemCode, type Establishment, type ExternalReference, type MdmGateway, type Party, type PartyIdentifier, type PartyRelationship, type PartyRole } from '@mdm/contracts';
import { LoadError, LoadingBar, Skeleton, Tabs, panelId, tabId, useDocumentTitle, type MenuItem } from '@sil/ui';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useMdmGateway } from '../../../application/gateway-context.ts';
import { usePartyCache, type PartyCache } from '../../../application/party-writes.ts';
import { mdmQueries } from '../../../application/queries.ts';
import { useMdmSession } from '../../../application/session-context.ts';
import { limaToday } from '../../../domain/field-rules.ts';
import type { EstablishmentRowCommand } from '../../../domain/establishment-form.ts';
import { availableCommands, commandAvailability, type PartyCommand } from '../../../domain/party-policy.ts';
import type { RoleRowCommand } from '../../../domain/role-state.ts';
import { BackLink } from '../../common/BackLink.tsx';
import { useDialogHost, type FocusTarget } from '../../common/dialogs/use-dialog-host.ts';
import type { RoleNames } from '../../common/field-messages.ts';
import { NotFound } from '../../common/NotFound.tsx';
import type { SectionAction } from '../../common/SectionToolbar.tsx';
import { MDM_TITLE_SUFFIX, ORGANIZATIONS_PATH } from '../../mdm-roots.ts';
import { AddIdentifierDialog } from './dialogs/AddIdentifierDialog.tsx';
import { ArchiveDialog } from './dialogs/ArchiveDialog.tsx';
import { AssignRoleDialog } from './dialogs/AssignRoleDialog.tsx';
import { CloseEstablishmentDialog } from './dialogs/CloseEstablishmentDialog.tsx';
import { EndRelationshipDialog } from './dialogs/EndRelationshipDialog.tsx';
import { EstablishmentDialog } from './dialogs/EstablishmentDialog.tsx';
import { ExpireIdentifierDialog } from './dialogs/ExpireIdentifierDialog.tsx';
import { LinkReferenceDialog } from './dialogs/LinkReferenceDialog.tsx';
import { NewRelationshipDialog } from './dialogs/NewRelationshipDialog.tsx';
import { RenameDialog } from './dialogs/RenameDialog.tsx';
import { SuspendDialog } from './dialogs/SuspendDialog.tsx';
import { TerminateRoleDialog } from './dialogs/TerminateRoleDialog.tsx';
import { UnlinkReferenceDialog } from './dialogs/UnlinkReferenceDialog.tsx';
import { EstablishmentsPanel, establishmentMenuSelector } from './EstablishmentsPanel.tsx';
import { ExternalReferencesPanel, referenceMenuSelector } from './ExternalReferencesPanel.tsx';
import { GeneralDataPanel } from './GeneralDataPanel.tsx';
import { HistoryPanel } from './HistoryPanel.tsx';
import { IdentifiersPanel, identifierMenuSelector } from './IdentifiersPanel.tsx';
import { PARTY_MENU_BUTTON, PartyHeader } from './PartyHeader.tsx';
import { PartyStateNotice } from './PartyStateNotice.tsx';
import { QuickActionNotice, useQuickAction, type QuickActionRunner } from './QuickAction.tsx';
import { RelationshipsPanel, relationshipMenuSelector } from './RelationshipsPanel.tsx';
import { RolesPanel, roleMenuSelector } from './RolesPanel.tsx';
import type { Availability } from './row-menu.ts';
import {
  BLOCKED_TEXTS,
  ESTABLISHMENT_TEXTS as E,
  PARTY_TEXTS as T,
  REFERENCE_TEXTS as X,
  RELATIONSHIP_TEXTS as L,
  ROLE_TEXTS as R,
  SECTION_TEXTS as S,
} from './texts.ts';

/** Las siete secciones de UX-MDM-001 §5.4 (SU-MDM-09). La sección vive en la dirección (`?seccion=`). */
const SECTIONS = ['datos', 'identificadores', 'roles', 'establecimientos', 'relaciones', 'referencias', 'historial'] as const;
type Section = (typeof SECTIONS)[number];

function sectionOf(value: string | null): Section {
  return SECTIONS.find((section) => section === value) ?? 'datos';
}

type OpenDialog =
  | { readonly kind: 'rename' }
  | { readonly kind: 'suspend' }
  | { readonly kind: 'archive' }
  | { readonly kind: 'addIdentifier' }
  | { readonly kind: 'expireIdentifier'; readonly identifier: PartyIdentifier }
  | { readonly kind: 'assignRole' }
  | { readonly kind: 'terminateRole'; readonly role: PartyRole }
  | { readonly kind: 'openEstablishment' }
  | { readonly kind: 'editEstablishment'; readonly establishment: Establishment }
  | { readonly kind: 'closeEstablishment'; readonly establishment: Establishment }
  | { readonly kind: 'startRelationship' }
  | { readonly kind: 'endRelationship'; readonly relationship: PartyRelationship }
  | { readonly kind: 'linkReference' }
  | { readonly kind: 'unlinkReference'; readonly reference: ExternalReference };

const DIALOG_COMMAND: Readonly<Record<OpenDialog['kind'], PartyCommand>> = {
  rename: 'rename',
  suspend: 'suspend',
  archive: 'archive',
  addIdentifier: 'addIdentifier',
  expireIdentifier: 'expireIdentifier',
  assignRole: 'assignRole',
  terminateRole: 'terminateRole',
  openEstablishment: 'openEstablishment',
  editEstablishment: 'editEstablishment',
  closeEstablishment: 'closeEstablishment',
  startRelationship: 'startRelationship',
  endRelationship: 'endRelationship',
  linkReference: 'linkReference',
  unlinkReference: 'unlinkReference',
};

function menuItems(commands: ReadonlySet<PartyCommand>, open: (dialog: OpenDialog) => void, activate: () => void): MenuItem[] {
  const items: Array<MenuItem | null> = [
    commands.has('rename')
      ? {
          id: 'rename',
          label: T.rename,
          onSelect: () => open({ kind: 'rename' }),
        }
      : null,
    commands.has('suspend')
      ? {
          id: 'suspend',
          label: T.suspend,
          onSelect: () => open({ kind: 'suspend' }),
        }
      : null,
    commands.has('activate') ? { id: 'activate', label: T.activate, onSelect: activate } : null,
    commands.has('archive')
      ? {
          id: 'archive',
          label: T.archive,
          onSelect: () => open({ kind: 'archive' }),
        }
      : null,
  ];
  return items.filter((item): item is MenuItem => item !== null);
}

function PartyDialog({
  dialog,
  party,
  cache,
  roleNames,
  onClose,
}: {
  readonly dialog: OpenDialog;
  readonly party: Party;
  readonly cache: PartyCache;
  readonly roleNames: RoleNames;
  readonly onClose: () => void;
}) {
  const props = { party, cache, onClose };
  switch (dialog.kind) {
    case 'rename':
      return <RenameDialog {...props} />;
    case 'suspend':
      return <SuspendDialog {...props} />;
    case 'archive':
      return <ArchiveDialog {...props} />;
    case 'addIdentifier':
      return <AddIdentifierDialog {...props} />;
    case 'expireIdentifier':
      return <ExpireIdentifierDialog {...props} identifier={dialog.identifier} />;
    case 'assignRole':
      return <AssignRoleDialog {...props} />;
    case 'terminateRole':
      return <TerminateRoleDialog {...props} role={dialog.role} roleNames={roleNames} />;
    case 'openEstablishment':
      return <EstablishmentDialog {...props} mode={{ kind: 'open' }} />;
    case 'editEstablishment':
      return <EstablishmentDialog {...props} mode={{ kind: 'edit', establishment: dialog.establishment }} />;
    case 'closeEstablishment':
      return <CloseEstablishmentDialog {...props} establishment={dialog.establishment} />;
    case 'startRelationship':
      return <NewRelationshipDialog {...props} />;
    case 'endRelationship':
      return <EndRelationshipDialog {...props} relationship={dialog.relationship} />;
    case 'linkReference':
      return <LinkReferenceDialog {...props} />;
    case 'unlinkReference':
      return <UnlinkReferenceDialog {...props} reference={dialog.reference} />;
  }
}

/** Acción primaria de una sección según su disponibilidad: oculta, disponible o bloqueada con su motivo. */
function sectionAction(command: PartyCommand, label: string, availability: Availability, onSelect: (trigger: HTMLElement) => void): SectionAction | null {
  const state = availability(command);
  switch (state.kind) {
    case 'hidden':
      return null;
    case 'blocked':
      return { kind: 'blocked', label, reason: BLOCKED_TEXTS[state.reason] };
    case 'available':
      return { kind: 'available', label, onSelect };
  }
}

/** Antes de una acción de un clic lanzada desde un menú: el foco vuelve a su botón (el elemento del menú desaparece). */
function focusTrigger(selector: string): void {
  document.querySelector<HTMLElement>(selector)?.focus();
}

/** Lo que necesita una acción de un clic sobre una parte de la ficha. */
interface QuickTarget {
  readonly runner: QuickActionRunner;
  readonly gateway: MdmGateway;
  readonly party: Party;
}

function runRoleQuickAction({ runner, gateway, party }: QuickTarget, role: PartyRole, name: string, activate: boolean) {
  focusTrigger(roleMenuSelector(role.roleId));
  runner.run(
    activate
      ? {
          operation: 'P-14',
          write: () => gateway.activateRole(party.id, role.roleId, { reason: null }, party.version),
          success: R.activatedOk(name),
          context: { notFoundSubject: 'el rol' },
        }
      : {
          operation: 'P-13',
          write: () => gateway.suspendRole(party.id, role.roleId, { reason: null }, party.version),
          success: R.suspendedOk(name),
          context: { notFoundSubject: 'el rol' },
        },
  );
}

function runEstablishmentQuickAction({ runner, gateway, party }: QuickTarget, establishment: Establishment, reactivate: boolean) {
  runner.run(
    reactivate
      ? {
          operation: 'P-21',
          write: () => gateway.reactivateEstablishment(party.id, establishment.id, { reason: null }, party.version),
          success: E.reactivatedOk(establishment.code),
          context: { notFoundSubject: 'el establecimiento' },
        }
      : {
          operation: 'P-20',
          write: () => gateway.deactivateEstablishment(party.id, establishment.id, { reason: null }, party.version),
          success: E.deactivatedOk(establishment.code),
          context: { notFoundSubject: 'el establecimiento' },
        },
  );
}

const SECTION_HEADINGS: Readonly<Record<Section, (code: string) => string>> = {
  datos: S.generalHeading,
  identificadores: S.identifiersHeading,
  roles: S.rolesHeading,
  establecimientos: S.establishmentsHeading,
  relaciones: S.relationshipsHeading,
  referencias: S.referencesHeading,
  historial: S.historyHeading,
};

function PartyDetail({ party, roleNames }: { readonly party: Party; readonly roleNames: RoleNames }) {
  const session = useMdmSession();
  const gateway = useMdmGateway();
  const cache = usePartyCache(party.id);
  const [params, setParams] = useSearchParams();
  const section = sectionOf(params.get('seccion'));
  const sectionHeading = useRef<HTMLHeadingElement>(null);
  const fallback = useCallback<FocusTarget>(() => sectionHeading.current, []);
  const host = useDialogHost<OpenDialog>(fallback, party.version);
  const activation = useQuickAction(cache);
  const rowAction = useQuickAction(cache);
  const commands = availableCommands(party.status, session.can);
  const availability: Availability = (command) => commandAvailability(command, party.status, session.can);
  const menuButton: FocusTarget = () => document.querySelector<HTMLElement>(PARTY_MENU_BUTTON);
  const activate = (): void =>
    activation.run({
      operation: 'P-06',
      write: () => gateway.activateParty(party.id, { reason: null }, party.version),
      success: T.activated(party.code),
      context: { partyStatus: 'Active' },
    });
  const items = menuItems(commands, (dialog) => host.open(dialog, menuButton), () => {
    focusTrigger(PARTY_MENU_BUTTON);
    activate();
  });
  // Si el estado cambió (p. ej. tras recargar) y la orden ya no está disponible, el diálogo se cierra.
  const allowed = host.dialog === null || commands.has(DIALOG_COMMAND[host.dialog.kind]);
  const { close } = host;
  useEffect(() => {
    if (!allowed) close();
  }, [allowed, close]);

  const today = limaToday();
  const onRoleCommand = (command: RoleRowCommand, role: PartyRole): void => {
    const name = roleNames[role.roleTypeCode] ?? role.roleTypeCode;
    if (command === 'terminateRole') {
      host.open({ kind: 'terminateRole', role }, () => document.querySelector<HTMLElement>(roleMenuSelector(role.roleId)));
      return;
    }
    runRoleQuickAction({ runner: rowAction, gateway, party }, role, name, command === 'activateRole');
  };
  const onEstablishmentCommand = (command: EstablishmentRowCommand, establishment: Establishment): void => {
    const trigger = () => document.querySelector<HTMLElement>(establishmentMenuSelector(establishment.id));
    switch (command) {
      case 'editEstablishment':
        host.open({ kind: 'editEstablishment', establishment }, trigger);
        return;
      case 'closeEstablishment':
        host.open({ kind: 'closeEstablishment', establishment }, trigger);
        return;
      case 'deactivateEstablishment':
      case 'reactivateEstablishment':
        runEstablishmentQuickAction({ runner: rowAction, gateway, party }, establishment, command === 'reactivateEstablishment');
    }
  };

  const baseId = `mdm-ficha-${party.id}`;
  return (
    <>
      <PartyHeader party={party} roleNames={roleNames} actions={items} />
      <PartyStateNotice party={party} onActivate={commands.has('activate') ? activate : null} activating={activation.pending} />
      <QuickActionNotice
        state={activation.state}
        onReload={() => {
          activation.dismiss();
          void cache.reload();
        }}
      />
      <div className="flex flex-col gap-4">
        <Tabs
          label={T.sections}
          baseId={baseId}
          value={section}
          onChange={(id) => {
            rowAction.dismiss();
            setParams({ seccion: sectionOf(id) }, { replace: true });
          }}
          items={[
            { id: 'datos', label: S.general },
            { id: 'identificadores', label: S.identifiers, count: party.identifiers.length },
            { id: 'roles', label: S.roles, count: party.roles.length },
            { id: 'establecimientos', label: S.establishments, count: party.establishments.length },
            // Relaciones y referencias se cargan al abrir su pestaña (UX-MDM-001 §5.4): sin contador.
            { id: 'relaciones', label: S.relationships },
            { id: 'referencias', label: S.references },
            { id: 'historial', label: S.history },
          ]}
        />
        <div role="tabpanel" id={panelId(baseId)} aria-labelledby={tabId(baseId, section)} className="flex flex-col gap-4">
          <h2 ref={sectionHeading} tabIndex={-1} className="sr-only">
            {SECTION_HEADINGS[section](party.code)}
          </h2>
          <QuickActionNotice
            state={rowAction.state}
            onReload={() => {
              rowAction.dismiss();
              void cache.reload();
            }}
          />
          {section === 'datos' && <GeneralDataPanel party={party} />}
          {section === 'identificadores' && (
            <IdentifiersPanel
              code={party.code}
              identifiers={party.identifiers}
              today={today}
              onAdd={commands.has('addIdentifier') ? (trigger) => host.open({ kind: 'addIdentifier' }, () => trigger) : null}
              onExpire={
                commands.has('expireIdentifier')
                  ? (identifier) =>
                      host.open({ kind: 'expireIdentifier', identifier }, () =>
                        document.querySelector<HTMLElement>(identifierMenuSelector(identifier.identifierId)),
                      )
                  : null
              }
            />
          )}
          {section === 'roles' && (
            <RolesPanel
              code={party.code}
              roles={party.roles}
              roleNames={roleNames}
              today={today}
              assign={sectionAction('assignRole', R.assign, availability, (trigger) => host.open({ kind: 'assignRole' }, () => trigger))}
              availability={availability}
              onCommand={onRoleCommand}
            />
          )}
          {section === 'establecimientos' && (
            <EstablishmentsPanel
              partyId={party.id}
              code={party.code}
              open={sectionAction('openEstablishment', E.open, availability, (trigger) => host.open({ kind: 'openEstablishment' }, () => trigger))}
              availability={availability}
              onCommand={onEstablishmentCommand}
              focusFallback={fallback}
            />
          )}
          {section === 'relaciones' && (
            <RelationshipsPanel
              partyId={party.id}
              code={party.code}
              today={today}
              start={sectionAction('startRelationship', L.start, availability, (trigger) => host.open({ kind: 'startRelationship' }, () => trigger))}
              canEnd={commands.has('endRelationship')}
              onEnd={(relationship) =>
                host.open({ kind: 'endRelationship', relationship }, () => document.querySelector<HTMLElement>(relationshipMenuSelector(relationship.id)))
              }
            />
          )}
          {section === 'referencias' && (
            <ExternalReferencesPanel
              partyId={party.id}
              code={party.code}
              establishments={party.establishments}
              link={sectionAction('linkReference', X.link, availability, (trigger) => host.open({ kind: 'linkReference' }, () => trigger))}
              canUnlink={commands.has('unlinkReference')}
              onUnlink={(reference) => host.open({ kind: 'unlinkReference', reference }, () => document.querySelector<HTMLElement>(referenceMenuSelector(reference.id)))}
            />
          )}
          {section === 'historial' && <HistoryPanel party={party} roleNames={roleNames} today={today} />}
        </div>
      </div>
      {host.dialog !== null && allowed && <PartyDialog dialog={host.dialog} party={party} cache={cache} roleNames={roleNames} onClose={host.close} />}
    </>
  );
}

/**
 * P-MDM-02 «Ficha de la organización» (US-MDM-002; UX-MDM-001 §5.4; UI-MDM-001 §3.3): cabecera con estado y
 * acciones según estado y rol, aviso de estado y secciones en pestañas. Archivada o fusionada: solo lectura total
 * (`INV-PTY-11`), sin menú ni acciones por fila; las pestañas siguen navegables.
 */
export function PartyPage() {
  const { partyId = '' } = useParams();
  const gateway = useMdmGateway();
  const session = useMdmSession();
  const party = useQuery(mdmQueries.party(gateway, session.role, partyId));
  const roleTypes = useQuery(mdmQueries.roleTypes(gateway));
  const roleNames: RoleNames = Object.fromEntries((roleTypes.data?.items ?? []).map((type) => [type.code, type.name]));
  useDocumentTitle(party.data === undefined ? 'Ficha de la organización' : party.data.code, MDM_TITLE_SUFFIX);

  if (party.isError && hasProblemCode(party.error, 'common.not_found')) return <NotFound message={T.notFound} />;
  return (
    <div className="flex flex-col gap-6 py-2">
      <BackLink to={ORGANIZATIONS_PATH}>{T.back}</BackLink>
      {party.isPending && (
        <>
          <LoadingBar subject={T.loadingSubject} />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-80" />
        </>
      )}
      {party.isError && <LoadError subject={T.loadingSubject} error={party.error} onRetry={() => void party.refetch()} />}
      {party.data !== undefined && <PartyDetail key={party.data.id} party={party.data} roleNames={roleNames} />}
    </div>
  );
}
