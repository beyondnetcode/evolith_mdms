import type { PartyRoleType } from '@mdm/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useMdmGateway } from './gateway-context.ts';
import { ROLE_TYPES_KEY, mdmQueries } from './queries.ts';

/**
 * Caché de servidor del catálogo de tipos de rol (C-02, D-046). Cada tipo es su propio agregado con su versión: tras
 * escribir se invalidan todas las lecturas del catálogo (P-MDM-04, los selectores de «Asignar rol» y el alta, y los
 * nombres de la ficha), no las organizaciones.
 */
export interface RoleTypeCache {
  /** Vuelve a leer el catálogo sin caché y devuelve el tipo, o `null` si ya no existe o no se pudo leer. */
  readonly reload: (code: string) => Promise<PartyRoleType | null>;
  readonly afterWrite: () => Promise<void>;
}

export function useRoleTypeCache(): RoleTypeCache {
  const queryClient = useQueryClient();
  const gateway = useMdmGateway();
  return useMemo(
    () => ({
      reload: async (code: string) => {
        try {
          const catalog = await queryClient.query({ ...mdmQueries.roleTypeCatalog(gateway), staleTime: 0 });
          return catalog.items.find((type) => type.code === code) ?? null;
        } catch {
          return null;
        }
      },
      afterWrite: () => queryClient.invalidateQueries({ queryKey: ROLE_TYPES_KEY }),
    }),
    [queryClient, gateway],
  );
}

export interface LoadedRoleType {
  /** Versión con la que se abrió el formulario: la que viaja en `If-Match`. */
  readonly version: number;
  readonly reloading: boolean;
  /** «Recargar y revisar»: lee el tipo nuevo y adopta su versión, sin tocar el borrador. */
  readonly reload: () => Promise<PartyRoleType | null>;
}

/** Versión cargada de un tipo de rol abierto en un formulario: no sigue a la caché (el servidor responde `412`). */
export function useLoadedRoleType(type: PartyRoleType, cache: RoleTypeCache): LoadedRoleType {
  const [version, setVersion] = useState(type.version);
  const [reloading, setReloading] = useState(false);
  const reload = useCallback(async () => {
    setReloading(true);
    try {
      const fresh = await cache.reload(type.code);
      if (fresh !== null) setVersion(fresh.version);
      return fresh;
    } finally {
      setReloading(false);
    }
  }, [cache, type.code]);
  return { version, reloading, reload };
}
