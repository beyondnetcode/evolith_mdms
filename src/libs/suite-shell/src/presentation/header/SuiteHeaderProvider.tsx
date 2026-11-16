import { currentProfileOf, notificationText, type SuiteSession } from '@suite/contracts';
import { SuiteHeaderContext, arrivalText, type HeaderNotifications, type SuiteHeader } from '@suite/header';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { RECENT_NOTIFICATIONS, notificationsPollMs } from '../../application/notification-polling.ts';
import { useSuite } from '../session/SuiteContext.tsx';

/**
 * Implementación de la cabecera común (ADR-0245) para la suite: la persona de la sesión, «Cerrar sesión» y las
 * notificaciones (anexo A1 §10): la cuenta de no leídas de la campana, el sondeo de llegadas y la ÚNICA región en
 * vivo, presente en el DOM desde la carga y vacía hasta que hay algo que decir (WCAG 4.1.3). Va bajo la guarda de
 * sesión y por encima de la suite y de los sistemas montados: la campana está en las cabeceras de todos. Como cada
 * sistema monta su propia caché de servidor, el cliente de consultas de las notificaciones es el de la suite y se
 * entrega en el contexto.
 */
export function SuiteHeaderProvider({ children }: { readonly children: ReactNode }) {
  const { session } = useSuite();
  if (session === null) return children;
  return <WithSession session={session}>{children}</WithSession>;
}

function WithSession({ session, children }: { readonly session: SuiteSession; readonly children: ReactNode }) {
  const { gateway, expired, settings } = useSuite();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [announcement, setAnnouncement] = useState({ text: '', n: 0 });
  const knownIds = useRef(new Map<string, ReadonlySet<string>>());

  const profile = currentProfileOf(session, 'SIL');
  const queryRoot = useMemo(() => ['suite', 'notificaciones', session.sessionId, profile?.profileId ?? ''] as const, [session.sessionId, profile?.profileId]);
  const active = !expired;
  const pollMs = notificationsPollMs(settings);

  const announce = useCallback((text: string) => setAnnouncement((previous) => ({ text, n: previous.n + 1 })), []);

  const counter = useQuery(
    {
      queryKey: [...queryRoot, 'contador'],
      queryFn: () => gateway.countUnread(session),
      enabled: active,
      refetchInterval: pollMs,
      staleTime: 0,
    },
    queryClient,
  );

  const recent = useQuery(
    {
      queryKey: [...queryRoot, 'recientes'],
      queryFn: async () => {
        const page = await gateway.listNotifications(session, { limit: RECENT_NOTIFICATIONS });
        const key = queryRoot.join('|');
        const previousOnes = knownIds.current.get(key);
        // La primera lectura solo fija lo ya conocido: la carga inicial no se anuncia (la cuenta ya está en el nombre de la campana).
        if (previousOnes !== undefined) {
          const newOnes = page.items.filter((n) => !previousOnes.has(n.id) && !n.read);
          if (newOnes.length > 0) announce(arrivalText(newOnes.map((n) => notificationText(n).title)));
        }
        knownIds.current.set(key, new Set([...(previousOnes ?? []), ...page.items.map((n) => n.id)]));
        return page;
      },
      enabled: active,
      refetchInterval: pollMs,
      staleTime: 0,
    },
    queryClient,
  );

  const notifications = useMemo<HeaderNotifications>(
    () => ({
      queryClient,
      queryRoot,
      profile,
      unreadCount: counter.data?.unread ?? null,
      recent: recent.data?.items ?? [],
      list: (filter) => gateway.listNotifications(session, filter),
      markRead: (id) => gateway.markRead(session, id),
      markAllRead: () => gateway.markAllRead(session),
      announce,
    }),
    [queryClient, queryRoot, profile, counter.data, recent.data, gateway, session, announce],
  );

  const header = useMemo<SuiteHeader>(
    () => ({
      user: session.user,
      // S-01 vacía la sesión y anuncia el cierre: ver `SignInPage`.
      signOut: () => void navigate('/acceso', { replace: true, state: { exit: 'user' } }),
      notifications,
    }),
    [session.user, navigate, notifications],
  );

  return (
    <SuiteHeaderContext value={header}>
      {children}
      {/* Región en vivo única: cortés, sin `assertive` (una notificación no interrumpe). El `key` repite el anuncio idéntico. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        <span key={announcement.n}>{announcement.text}</span>
      </div>
    </SuiteHeaderContext>
  );
}
