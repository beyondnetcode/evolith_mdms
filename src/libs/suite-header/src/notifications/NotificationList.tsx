import { destinationPath, type Notification } from '@suite/contracts';
import { EmptyState, InlineNotice, LoadingBar, Button, Skeleton } from '@sil/ui';
import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLeaveGuard } from '../LeaveGuardContext.tsx';
import { groupByDate } from './group-by-date.ts';
import { hasFilters, newComparedToList, useNotificationActions, useNotificationList, type ListFilters } from './notification-queries.ts';
import { NotificationItem, linkIdOf } from './NotificationItem.tsx';
import { useHeaderNotifications } from '../SuiteHeaderContext.tsx';
import { NOTIFICATION_TEXTS, loadedText, showNewText } from './notification-texts.ts';

interface Props {
  /** En la hoja: las 10 más recientes y botón de icono por fila. En la pantalla: 20 por página y botón de texto. */
  readonly variant: 'sheet' | 'page';
  readonly filters: ListFilters;
  /** Falso mientras la hoja está cerrada: no se lee nada. */
  readonly active: boolean;
  /** Tras abrir una notificación (la hoja se cierra). */
  readonly onOpen?: () => void;
  readonly onClearFilters?: () => void;
  readonly onShowAll?: () => void;
}

const LIMIT = { sheet: 10, page: 20 } as const;

/**
 * Región de la lista (anexo A1 §10.3 y §10.5): carga, vacío (tres motivos), error con «Reintentar» y la
 * lista agrupada por fecha. Cada estado es una variante, no un puñado de banderas (ADR-0109 P-FE-01).
 */
export function NotificationList({ variant, filters, active, onOpen, onClearFilters, onShowAll }: Props) {
  const query = useNotificationList(filters, LIMIT[variant], active);
  const { recent, announce } = useHeaderNotifications();
  const { markOneRead } = useNotificationActions();
  const navigate = useNavigate();
  const { request } = useLeaveGuard();
  // Un día fijo al montar: la agrupación por fecha no necesita reloj en cada render.
  const [nowMs] = useState(() => Date.now());

  // En la pantalla el título es `h1` y cada fecha un `h2`; en la hoja el título es `h2` y las fechas, `h3`.
  const Heading = variant === 'page' ? 'h2' : 'h3';
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.data === undefined) {
    if (query.isError) {
      return (
        <InlineNotice
          severity="error"
          announce
          actions={
            <Button variant="text-inherit" onClick={() => void query.refetch()}>
              Reintentar
            </Button>
          }
        >
          {NOTIFICATION_TEXTS.error}
        </InlineNotice>
      );
    }
    return <Loading />;
  }

  if (items.length === 0) {
    return (
      <Empty
        filters={filters}
        onClearFilters={onClearFilters}
        onShowAll={onShowAll}
        newOnes={newComparedToList(recent, items, filters).length}
        onShowNew={() => void query.refetch()}
      />
    );
  }

  const newOnes = newComparedToList(recent, items, filters);

  function open(notification: Notification): void {
    const path = destinationPath(notification.destination);
    // Con cambios sin guardar aparece primero «¿Salir sin guardar?» y la hoja sigue abierta (anexo A1 §10.3.1).
    request(() => {
      if (!notification.read) markOneRead.mutate(notification.id);
      onOpen?.();
      if (path !== null) void navigate(path);
    });
  }

  function mark(notification: Notification): void {
    // El botón desaparece al marcar: el foco pasa a su enlace antes, nunca al `body` (anexo A1 §10.6).
    document.getElementById(linkIdOf(notification.id))?.focus();
    markOneRead.mutate(notification.id);
  }

  async function loadMore(): Promise<void> {
    const before = items.length;
    const result = await query.fetchNextPage();
    const after = result.data?.pages.flatMap((page) => page.items) ?? [];
    const firstNew = after[before];
    // Con «Cargar anteriores» el foco va a la primera fila nueva y la región en vivo lo dice.
    if (firstNew !== undefined) {
      requestAnimationFrame(() => document.getElementById(linkIdOf(firstNew.id))?.focus());
      announce(loadedText(after.length - before));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {newOnes.length > 0 && (
        <Button onClick={() => void query.refetch()} className="self-start">
          {showNewText(newOnes.length)}
        </Button>
      )}
      {groupByDate(items, nowMs).map((group) => (
        <Fragment key={group.key}>
          <Heading className="px-6 pt-2 text-label-large text-on-surface-variant">{group.label}</Heading>
          <ul className="flex flex-col">
            {group.items.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} onOpen={open} onMarkRead={mark} iconOnly={variant === 'sheet'} />
            ))}
          </ul>
        </Fragment>
      ))}
      {variant === 'page' && query.hasNextPage && (
        <Button
          variant="outlined"
          onClick={() => {
            if (!query.isFetchingNextPage) void loadMore();
          }}
          aria-disabled={query.isFetchingNextPage}
          className="mx-4 mt-2"
        >
          {NOTIFICATION_TEXTS.loadPrevious}
        </Button>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-3">
      <LoadingBar subject="tus notificaciones" />
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-start gap-3 px-6 py-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface EmptyProps {
  readonly filters: ListFilters;
  readonly onClearFilters: (() => void) | undefined;
  readonly onShowAll: (() => void) | undefined;
  readonly newOnes: number;
  readonly onShowNew: () => void;
}

/** Tres vacíos distintos (anexo A1 §10.5): ninguna, sin no leídas con «No leídas» activo, y el filtro no coincide. */
function Empty({ filters, onClearFilters, onShowAll, newOnes, onShowNew }: EmptyProps) {
  const unreadOnly = filters.unreadOnly && filters.types.length === 0;
  const show = newOnes > 0 && (
    <Button onClick={onShowNew} className="mx-6 self-start">
      {showNewText(newOnes)}
    </Button>
  );
  if (!hasFilters(filters)) {
    return (
      <>
        {show}
        <EmptyState icon="notifications" placement="sheet" title={NOTIFICATION_TEXTS.empty.title} className="px-6">
          {NOTIFICATION_TEXTS.empty.supportText}
        </EmptyState>
      </>
    );
  }
  if (unreadOnly) {
    return (
      <>
        {show}
        <EmptyState
          icon="check_circle"
          placement="sheet"
          announce
          title={NOTIFICATION_TEXTS.noUnread}
          className="px-6"
          action={onShowAll !== undefined && <Button variant="tonal" onClick={onShowAll}>{NOTIFICATION_TEXTS.showAllRead}</Button>}
        />
      </>
    );
  }
  return (
    <>
      {show}
      <EmptyState
        icon="search"
        placement="sheet"
        announce
        title={NOTIFICATION_TEXTS.noMatches}
        className="px-6"
        action={onClearFilters !== undefined && <Button variant="tonal" onClick={onClearFilters}>{NOTIFICATION_TEXTS.clearFilters}</Button>}
      />
    </>
  );
}
