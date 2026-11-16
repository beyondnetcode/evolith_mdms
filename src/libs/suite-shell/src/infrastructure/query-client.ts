import { QueryClient } from '@tanstack/react-query';

/** Caché de servidor de la suite (lanzador y notificaciones). Cada sistema montado tiene la suya. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // El mock es determinista: reintentar solo retrasaría ver el estado de error.
        // Con el BFF real se configurará el reintento con espera exponencial (ADR-0109).
        retry: false,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
      },
    },
  });
}
