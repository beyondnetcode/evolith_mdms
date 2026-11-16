import type { ExternalReference, PartyRelationship } from '@mdm/contracts';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useMdmGateway } from './gateway-context.ts';
import { mdmQueries } from './queries.ts';
import { useMdmSession } from './session-context.ts';

/**
 * Caché de relaciones y referencias externas de una ficha. Son agregados propios (API-MDM-002 §2.1): escribirlas no
 * cambia la versión de ninguna Party, así que tras escribir no se recarga la ficha, solo sus listas.
 */
export interface LinkCache {
  /**
   * Tras iniciar o terminar una relación: se refrescan las relaciones de todas las fichas en caché, porque la
   * relación aparece también en la de la otra organización (y en su historial).
   */
  readonly afterRelationshipWrite: () => Promise<void>;
  /** Tras vincular o desvincular: las referencias de la organización y de sus establecimientos. */
  readonly afterReferenceWrite: () => Promise<void>;
  /** Lectura fresca de una relación de la ficha (R-01, sin caché): `null` si ya no está o no se pudo leer. */
  readonly readRelationship: (relationshipId: string) => Promise<PartyRelationship | null>;
  /** Lectura fresca de una referencia de la organización (X-01, sin caché). */
  readonly readReference: (referenceId: string) => Promise<ExternalReference | null>;
}

function isSection(key: QueryKey, role: string, section: string): boolean {
  return key[0] === 'mdm' && key[1] === role && key[2] === 'party' && key[4] === section;
}

export function useLinkCache(partyId: string): LinkCache {
  const queryClient = useQueryClient();
  const gateway = useMdmGateway();
  const { role } = useMdmSession();
  return useMemo(() => {
    const relationships = mdmQueries.relationships(gateway, role, partyId, false);
    const references = mdmQueries.partyReferences(gateway, role, partyId);
    return {
      afterRelationshipWrite: () => queryClient.invalidateQueries({ predicate: (query) => isSection(query.queryKey, role, 'relationships') }),
      afterReferenceWrite: () => queryClient.invalidateQueries({ queryKey: ['mdm', role, 'party', partyId, 'external-references'] }),
      readRelationship: async (relationshipId) => {
        try {
          const page = await queryClient.query({ ...relationships, staleTime: 0 });
          return page.items.find((item) => item.id === relationshipId) ?? null;
        } catch {
          return null;
        }
      },
      readReference: async (referenceId) => {
        try {
          const page = await queryClient.query({ ...references, staleTime: 0 });
          return page.items.find((item) => item.id === referenceId) ?? null;
        } catch {
          return null;
        }
      },
    };
  }, [queryClient, gateway, role, partyId]);
}

export interface LinkVersion {
  /** La que viaja en `If-Match`. */
  readonly version: number;
  readonly reloading: boolean;
  /** Vuelve a leer el elemento y adopta su versión. `false` si ya no está o no se pudo leer. */
  readonly reload: () => Promise<boolean>;
}

/**
 * Versión con la que se abrió la confirmación de una relación o una referencia: la suya, no la de la Party
 * (`If-Match`, API-MDM-002 §2.1). No sigue a la caché: si cambió, el servidor responde `412` (US-MDM-013).
 */
export function useLinkVersion(initial: number, read: () => Promise<{ readonly version: number } | null>): LinkVersion {
  const [version, setVersion] = useState(initial);
  const [reloading, setReloading] = useState(false);
  const reload = useCallback(async () => {
    setReloading(true);
    try {
      const fresh = await read();
      if (fresh !== null) setVersion(fresh.version);
      return fresh !== null;
    } finally {
      setReloading(false);
    }
  }, [read]);
  return { version, reloading, reload };
}
