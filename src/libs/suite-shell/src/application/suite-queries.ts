import type { SignInTenant, SuiteSession, SuiteGateway, SystemCard } from '@suite/contracts';

/** La clave lleva la sesión: la caché de una persona no debe servirse a otra. */
export const suiteQueries = {
  /** Sin sesión: la lista es la misma para cualquier visitante (en UMS, `Cache-Control: public, max-age=300`). */
  signInTenants: (gateway: SuiteGateway) => ({
    queryKey: ['suite', 'inquilinos-de-ingreso'] as const,
    queryFn: (): Promise<readonly SignInTenant[]> => gateway.listSignInTenants(),
    staleTime: 300_000,
  }),
  systems: (gateway: SuiteGateway, session: SuiteSession) => ({
    queryKey: ['suite', 'sistemas', session.sessionId] as const,
    queryFn: (): Promise<readonly SystemCard[]> => gateway.systemsOf(session),
  }),
};
