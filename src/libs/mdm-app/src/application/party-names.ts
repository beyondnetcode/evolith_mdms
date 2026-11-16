import { useQueries } from '@tanstack/react-query';
import { useMdmGateway } from './gateway-context.ts';
import { mdmQueries } from './queries.ts';
import { useMdmSession } from './session-context.ts';

/** Nombre de otra organización, como unión discriminada: se está leyendo, se leyó o no se pudo leer. */
export type PartyName =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly code: string; readonly legalName: string }
  | { readonly kind: 'unavailable' };

/**
 * Nombres de las otras organizaciones de las relaciones. R-01 devuelve solo ids: cada nombre cuesta un P-03 por
 * organización distinta (SUPUESTO SU-MDM-14, N + 1 peticiones, G-566). Se comparte la caché de la ficha
 * (`mdmQueries.party`), así que una organización ya abierta no se vuelve a pedir y cada id se pide una sola vez.
 */
export function usePartyNames(partyIds: readonly string[]): ReadonlyMap<string, PartyName> {
  const gateway = useMdmGateway();
  const { role } = useMdmSession();
  const unique = [...new Set(partyIds)];
  return useQueries({
    queries: unique.map((id) => ({ ...mdmQueries.party(gateway, role, id), staleTime: 60_000 })),
    combine: (results) =>
      new Map(
        results.map((result, index): [string, PartyName] => [
          unique[index] ?? '',
          result.data !== undefined
            ? { kind: 'ready', code: result.data.code, legalName: result.data.legalName }
            : result.isError
              ? { kind: 'unavailable' }
              : { kind: 'loading' },
        ]),
      ),
  });
}
