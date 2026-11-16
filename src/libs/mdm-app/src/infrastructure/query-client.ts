import { QueryClient } from '@tanstack/react-query';

export function createMdmQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // El mock es determinista: reintentar solo retrasaría ver el estado de error.
        // Con la API real se configurará el reintento con espera exponencial (ADR-0109).
        retry: false,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
      },
    },
  });
}
