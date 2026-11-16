import { isNotificationType, profileLabel, visibleTypesFor, type NotificationType } from '@suite/contracts';
import { Button, IconButton, FilterChip, Icon, ActionMenu, joinClasses, useWindowSizeClass, useDocumentTitle } from '@sil/ui';
import type { RefObject } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useFocusOnTitle } from '../use-focus-on-title.ts';
import { SuiteFrame } from '../layout/SuiteFrame.tsx';
import {
  NO_FILTERS,
  NOTIFICATION_TEXTS,
  NotificationList,
  TYPE_LABEL,
  hasFilters,
  unreadText,
  useHeaderNotifications,
  useNotificationActions,
  type ListFilters,
} from '@suite/header';
import { useSystems } from '../systems/SystemsContext.tsx';
import { SUITE_TITLE } from '../suite-title.ts';

/** Filtros de la URL: frontera validada, un valor desconocido se descarta (ADR-0109 P-FE-06). */
function readFilters(searchParams: URLSearchParams, allowed: readonly NotificationType[]): ListFilters {
  const types = (searchParams.get('tipo') ?? '')
    .split(',')
    .filter(isNotificationType)
    .filter((type) => allowed.includes(type));
  return { unreadOnly: searchParams.get('noLeidas') === '1', types: [...new Set(types)] };
}

function toSearchParams(filters: ListFilters): URLSearchParams {
  const searchParams = new URLSearchParams();
  if (filters.unreadOnly) searchParams.set('noLeidas', '1');
  if (filters.types.length > 0) searchParams.set('tipo', filters.types.join(','));
  return searchParams;
}

/**
 * Pantalla completa «Notificaciones» (anexo A1 §10.3): es de la suite, no de SIL. Bajo la cabecera de la
 * suite desde `medium`; en `compact` es una pantalla propia con «Volver», el título y «Más». Los filtros
 * viven en la dirección (vista compartible y «Atrás» coherente).
 */
export function NotificationsPage() {
  useDocumentTitle('Notificaciones', SUITE_TITLE);
  const title = useFocusOnTitle();
  const { profile } = useHeaderNotifications();
  const compact = useWindowSizeClass() === 'compact';
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const visible = profile === null ? [] : visibleTypesFor(profile.role);
  const filters = readFilters(searchParams, visible);

  function apply(next: ListFilters): void {
    setSearchParams(toSearchParams(next), { replace: true });
  }
  // «Volver» regresa a donde estaba; si se llegó directo a esta dirección, al inicio de la suite.
  function back(): void {
    if (location.key === 'default') void navigate('/');
    else void navigate(-1);
  }

  return (
    <SuiteFrame withAccount withoutHeader={compact} back={back}>
      {compact && <CompactBar title={title} onBack={back} />}
      <div className="mx-auto flex w-full max-w-200 flex-col gap-4 px-4 py-6 medium:px-6">
        <Heading title={title} compact={compact} />
        <Filters filters={filters} visible={visible} apply={apply} />
        <NotificationList
          variant="page"
          filters={filters}
          active
          onClearFilters={() => apply(NO_FILTERS)}
          onShowAll={() => apply({ ...filters, unreadOnly: false })}
        />
        <p className="px-2 text-body-small text-on-surface-variant">{NOTIFICATION_TEXTS.footer}</p>
      </div>
    </SuiteFrame>
  );
}

function useMarkAllRead(title: RefObject<HTMLHeadingElement | null>) {
  const { markAllRead } = useNotificationActions();
  // El botón desaparece al marcar todas: el foco pasa al título, nunca al `body`.
  return () => markAllRead.mutate(undefined, { onSuccess: () => title.current?.focus() });
}

function Heading({ title, compact }: { readonly title: RefObject<HTMLHeadingElement | null>; readonly compact: boolean }) {
  const { profile, unreadCount } = useHeaderNotifications();
  const systems = useSystems();
  const markAllRead = useMarkAllRead(title);
  const supportText =
    profile === null
      ? 'Las horas son de Lima (UTC-5).'
      : `Avisos de SIL para tu perfil: ${profileLabel(profile, systems)}. Las horas son de Lima (UTC-5).`;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 basis-96">
        {!compact && (
          <h1 ref={title} tabIndex={-1} className="text-headline-small outline-none">
            {NOTIFICATION_TEXTS.title}
          </h1>
        )}
        <p className="mt-1 text-body-medium text-on-surface-variant">{supportText}</p>
        {compact && unreadCount !== null && <p className="text-body-small text-on-surface-variant">{unreadText(unreadCount)}</p>}
      </div>
      {/* «Solo si hay no leídas»: no se dibuja deshabilitado, no hay nada que explicar. */}
      {!compact && unreadCount !== null && unreadCount > 0 && (
        <Button variant="outlined" onClick={markAllRead}>
          {NOTIFICATION_TEXTS.markAllRead}
        </Button>
      )}
    </div>
  );
}

function CompactBar({ title, onBack }: { readonly title: RefObject<HTMLHeadingElement | null>; readonly onBack: () => void }) {
  const { unreadCount } = useHeaderNotifications();
  const markAllRead = useMarkAllRead(title);
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-1 bg-surface px-2">
      <IconButton aria-label={NOTIFICATION_TEXTS.back} onClick={onBack}>
        <Icon name="arrow_back" />
      </IconButton>
      <h1 ref={title} tabIndex={-1} className="min-w-0 flex-1 truncate text-title-large outline-none">
        {NOTIFICATION_TEXTS.title}
      </h1>
      <ActionMenu
        label={NOTIFICATION_TEXTS.more}
        items={unreadCount !== null && unreadCount > 0 ? [{ id: 'marcar-todas', label: NOTIFICATION_TEXTS.markAllRead, onSelect: markAllRead }] : []}
      />
    </header>
  );
}

interface FiltersProps {
  readonly filters: ListFilters;
  readonly visible: readonly NotificationType[];
  readonly apply: (filters: ListFilters) => void;
}

/** «No leídas» (alterna), «Tipo» (menú con casillas) y «Quitar filtros». Sin búsqueda por texto: ningún requisito la pide. */
function Filters({ filters, visible, apply }: FiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={filters.unreadOnly}
        onClick={() => apply({ ...filters, unreadOnly: !filters.unreadOnly })}
        className={joinClasses(
          'state-layer target-48 inline-flex h-8 cursor-pointer items-center gap-2 rounded-sm text-label-large whitespace-nowrap',
          filters.unreadOnly ? 'bg-secondary-container pr-4 pl-2 text-on-secondary-container' : 'border border-outline px-4 text-on-surface-variant',
        )}
      >
        {filters.unreadOnly && <Icon name="check" className="size-4.5" />}
        {NOTIFICATION_TEXTS.unreadFilter}
      </button>
      <FilterChip
        label={NOTIFICATION_TEXTS.typeFilter}
        options={visible.map((type) => ({ value: type, label: TYPE_LABEL[type] }))}
        selection={filters.types}
        onChange={(types) => apply({ ...filters, types })}
      />
      {hasFilters(filters) && (
        <Button onClick={() => apply(NO_FILTERS)}>
          {NOTIFICATION_TEXTS.clearFilters}
        </Button>
      )}
    </div>
  );
}
