import { DEFAULT_PAGE_SIZE, problemFrom, type IdentifierFilter, type MdmGateway, type Party, type PartySummary } from '@mdm/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useMdmGateway } from './gateway-context.ts';
import { mdmQueries } from './queries.ts';
import { useMdmSession } from './session-context.ts';

/**
 * Resultado de una escritura, como unión discriminada: guardada, conflicto de versión (`412`, US-MDM-013) o
 * rechazada por otro motivo (el error del contrato, para explicarlo).
 */
export type WriteOutcome<T> =
  { readonly kind: 'saved'; readonly value: T } | { readonly kind: 'conflict' } | { readonly kind: 'rejected'; readonly error: unknown };

/** Ejecuta la escritura y clasifica su resultado sin lanzar. */
export async function attemptWrite<T>(write: () => Promise<T>): Promise<WriteOutcome<T>> {
  try {
    return { kind: 'saved', value: await write() };
  } catch (error: unknown) {
    return problemFrom(error)?.status === 412 ? { kind: 'conflict' } : { kind: 'rejected', error };
  }
}

export interface PartyCache {
  /** Vuelve a leer la ficha (P-03) del servidor, sin caché: la versión nueva es el `ETag` de lo siguiente. */
  readonly reload: () => Promise<Party>;
  /**
   * Tras una escritura correcta: el `204` trae el `ETag` nuevo pero no los datos derivados (`isCurrent`), así que se
   * recarga la ficha (UX-MDM-001 §5.4) y se marca el listado como desactualizado.
   */
  readonly afterWrite: () => Promise<void>;
}

/** Caché de servidor de una ficha: lectura fresca y refresco tras escribir. */
export function usePartyCache(partyId: string): PartyCache {
  const queryClient = useQueryClient();
  const gateway = useMdmGateway();
  const { role } = useMdmSession();
  return useMemo(() => {
    const party = mdmQueries.party(gateway, role, partyId);
    return {
      reload: () => queryClient.query({ ...party, staleTime: 0 }),
      afterWrite: async () => {
        await Promise.all([queryClient.invalidateQueries({ queryKey: party.queryKey }), queryClient.invalidateQueries({ queryKey: ['mdm', role, 'parties'] })]);
      },
    };
  }, [queryClient, gateway, role, partyId]);
}

export interface LoadedVersion {
  /** Versión con la que se abrió el formulario: la que viaja en `If-Match` (API-MDM-002 §2.1). */
  readonly version: number;
  readonly reloading: boolean;
  /**
   * «Recargar y revisar» (D-MDM-14): lee la ficha nueva y adopta su versión, sin tocar el borrador. Devuelve la
   * ficha, o `null` si no se pudo leer (la versión no cambia y se puede reintentar).
   */
  readonly reload: () => Promise<Party | null>;
}

/**
 * Versión cargada de un formulario abierto. No sigue a la caché: si la ficha se refresca de fondo mientras se
 * edita, el formulario conserva la versión con la que se abrió y el servidor responde `412` (US-MDM-013).
 */
export function useLoadedVersion(initial: number, cache: PartyCache): LoadedVersion {
  const [version, setVersion] = useState(initial);
  const [reloading, setReloading] = useState(false);
  const reload = useCallback(async () => {
    setReloading(true);
    try {
      const fresh = await cache.reload();
      setVersion(fresh.version);
      return fresh;
    } catch {
      return null;
    } finally {
      setReloading(false);
    }
  }, [cache]);
  return { version, reloading, reload };
}

/**
 * Dueño de un identificador (UX-MDM-001 §4.2, G-562): el `409` `party.identifier.duplicate` no devuelve el id de la
 * organización existente, así que se busca con P-01 por identificador exacto, que encuentra también las archivadas
 * y fusionadas. Si la búsqueda falla, `null`: el aviso cae a su forma sin datos.
 */
export async function findIdentifierOwner(gateway: MdmGateway, { countryCode, schemeCode, value }: IdentifierFilter): Promise<PartySummary | null> {
  try {
    const page = await gateway.listParties({
      search: null,
      roleTypeCode: null,
      status: null,
      type: null,
      identifier: { countryCode, schemeCode, value },
      sortBy: 'code',
      sortOrder: 'asc',
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
    return page.items[0] ?? null;
  } catch {
    return null;
  }
}
