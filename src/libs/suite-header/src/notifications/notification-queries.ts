import type { NotificationFilter, Notification, NotificationPage, NotificationType } from '@suite/contracts';
import { useSnackbar } from '@sil/ui';
import { useInfiniteQuery, useMutation, type InfiniteData } from '@tanstack/react-query';
import { useHeaderNotifications } from '../SuiteHeaderContext.tsx';
import { NOTIFICATION_TEXTS, markedText, oneMarkedText } from './notification-texts.ts';

/** Filtros de la lista: los aplica el servicio, de modo que los totales son ciertos (anexo A1 §10.3). */
export interface ListFilters {
  readonly unreadOnly: boolean;
  readonly types: readonly NotificationType[];
}

export const NO_FILTERS: ListFilters = { unreadOnly: false, types: [] };

export function hasFilters(filters: ListFilters): boolean {
  return filters.unreadOnly || filters.types.length > 0;
}

/** El cursor de la primera página es el texto vacío: «sin cursor». */
type Pages = InfiniteData<NotificationPage, string>;

/**
 * La lista (de 20 en 20 en la pantalla; las 10 más recientes en la hoja). Se vuelve a leer al abrirla, pero
 * no por sí sola: la lista no se mueve bajo el cursor (CLS) y las llegadas se ofrecen con «Mostrar {n} nuevas».
 */
export function useNotificationList(filters: ListFilters, limit: number, active: boolean) {
  const { queryClient, queryRoot: root, list } = useHeaderNotifications();
  return useInfiniteQuery(
    {
      queryKey: [...root, 'lista', limit, filters.unreadOnly, [...filters.types].toSorted().join(',')],
      initialPageParam: '',
      queryFn: ({ pageParam }) => {
        const filter: NotificationFilter = {
          limit,
          ...(filters.unreadOnly ? { unreadOnly: true } : {}),
          ...(filters.types.length > 0 ? { types: filters.types } : {}),
          ...(pageParam === '' ? {} : { cursor: pageParam }),
        };
        return list(filter);
      },
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      enabled: active,
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      staleTime: Infinity,
    },
    queryClient,
  );
}

/** Ids de las notificaciones recientes que aún no están en la lista y que los filtros dejarían ver. */
export function newComparedToList(recent: readonly Notification[], shown: readonly Notification[], filters: ListFilters): Notification[] {
  const ids = new Set(shown.map((n) => n.id));
  return recent.filter(
    (n) =>
      !ids.has(n.id) &&
      (!filters.unreadOnly || !n.read) &&
      (filters.types.length === 0 || filters.types.includes(n.type)),
  );
}

function withRead(data: Pages | undefined, ids: ReadonlySet<string> | 'all'): Pages | undefined {
  if (data === undefined) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((n): Notification => (ids === 'all' || ids.has(n.id) ? { ...n, read: true } : n)),
    })),
  };
}

/**
 * Marcar como leída, una o todas. Es optimista: la fila cambia al instante y, si falla, VUELVE a no
 * leída con el aviso del anexo (§10.5). La cuenta de la campana sale de la respuesta del servicio.
 */
export function useNotificationActions() {
  const notifications = useHeaderNotifications();
  const { queryClient, queryRoot: root, announce } = notifications;
  const { show } = useSnackbar();

  const markOneRead = useMutation(
    {
      mutationFn: async (id: string) => {
        const result = await notifications.markRead(id);
        if (result.type === 'error') throw new Error(`No se pudo marcar: ${result.correlation}`);
        return result;
      },
      onMutate: async (id) => {
        await queryClient.cancelQueries({ queryKey: [...root, 'lista'] });
        const previousOnes = queryClient.getQueriesData<Pages>({ queryKey: [...root, 'lista'] });
        const previousCount = queryClient.getQueryData<{ unread: number }>([...root, 'contador']);
        queryClient.setQueriesData<Pages>({ queryKey: [...root, 'lista'] }, (data) => withRead(data, new Set([id])));
        if (previousCount !== undefined) queryClient.setQueryData([...root, 'contador'], { unread: Math.max(previousCount.unread - 1, 0) });
        return { previousOnes, previousCount };
      },
      onError: (_error, _id, context) => {
        for (const [key, data] of context?.previousOnes ?? []) queryClient.setQueryData(key, data);
        if (context?.previousCount !== undefined) queryClient.setQueryData([...root, 'contador'], context.previousCount);
        show({ text: NOTIFICATION_TEXTS.markReadError });
      },
      onSuccess: (result) => {
        if (result.type === 'ok') {
          queryClient.setQueryData([...root, 'contador'], { unread: result.unread });
          announce(oneMarkedText(result.unread));
        } else {
          // La notificación ya no existe (salió de la ventana): se vuelve a leer lo que muestra la campana.
          void queryClient.invalidateQueries({ queryKey: root });
        }
      },
    },
    queryClient,
  );

  const markAllRead = useMutation(
    {
      mutationFn: async () => {
        const result = await notifications.markAllRead();
        if (result.type === 'error') throw new Error(`No se pudo marcar: ${result.correlation}`);
        return result;
      },
      onSuccess: (result) => {
        queryClient.setQueriesData<Pages>({ queryKey: [...root, 'lista'] }, (data) => withRead(data, 'all'));
        queryClient.setQueryData([...root, 'contador'], { unread: 0 });
        show({ text: markedText(result.markedCount) });
      },
      onError: () => {
        show({ text: NOTIFICATION_TEXTS.markAllReadError });
      },
    },
    queryClient,
  );

  return { markOneRead, markAllRead };
}
