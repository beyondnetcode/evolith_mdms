import { currentGrantedProfile, profileLabel, profilesInSite, siteText, type Site, type SystemCard } from '@suite/contracts';
import { EmptyState, Icon, InlineNotice, LoadingBar, Skeleton, LoadError, useDocumentTitle, useSnackbar } from '@sil/ui';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useFocusOnTitle } from '../use-focus-on-title.ts';
import { suiteQueries } from '../../application/suite-queries.ts';
import { useSuiteSession, useSuite } from '../session/SuiteContext.tsx';
import { InstitutionalFooter } from '../brand/InstitutionalFooter.tsx';
import { SystemCardView, SystemListItem } from '../components/SystemCardView.tsx';
import { WorkContext, workContextLine } from '../components/WorkContext.tsx';
import { SUITE_TEXTS } from '../suite-texts.ts';
import { SUITE_TITLE } from '../suite-title.ts';
import { useSystems } from '../systems/SystemsContext.tsx';

const GRID = 'grid grid-cols-1 gap-4 medium:grid-cols-2 expanded:grid-cols-3 large:grid-cols-4';

/** S-02 — Inicio de la suite: el lanzador con los sistemas que la sesión concede (anexo A1 §3). */
export function SuiteHomePage() {
  useDocumentTitle(null, SUITE_TITLE);
  const title = useFocusOnTitle();
  const session = useSuiteSession();
  const { gateway, settings, chooseSite } = useSuite();
  const { show } = useSnackbar();
  const query = useQuery(suiteQueries.systems(gateway, session));
  const systems = useSystems();
  // El perfil vigente que el saludo muestra es el del primer sistema registrado que la sesión concede.
  const current = systems.map((system) => currentGrantedProfile(session, system)).find((profile) => profile !== null) ?? null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-300 flex-1 flex-col gap-8 px-4 py-8 medium:px-6 medium:py-12">
        {/* R-05: el saludo vive sobre `surface`, sin banda de marca; la marca está en el isotipo de la barra, el panel de S-01 y el pie. */}
        <header className="flex flex-col gap-1">
          <h1 ref={title} tabIndex={-1} className="text-headline-small-emphasized outline-none medium:text-display-small-emphasized">
            {`Hola, ${session.user.firstName}`}
          </h1>
          {/* Inquilino y sede de trabajo de la sesión (D-030): lo que UMS publica como `context.tenant` y `context.branch`. */}
          <p className="flex items-center gap-2 text-body-large text-on-surface-variant">
            <Icon name="warehouse" className="size-5" />
            {workContextLine(session)}
          </p>
          {current !== null && (
            <p className="flex items-center gap-2 text-body-large text-on-surface-variant">
              <Icon name="group" className="size-5" />
              {profileLabel(current, systems)}
            </p>
          )}
        </header>

        {settings.suite.umsDown && (
          <InlineNotice severity="warning" announce>
            {SUITE_TEXTS.home.umsDown}
          </InlineNotice>
        )}

        {/* La sede de trabajo solo filtra el lanzador (D-030); el rol y la sede de cada sistema siguen viniendo de UMS y
            cada tarjeta enlaza directo, sin selector de sede por sistema (D-028, US-SIL-004). */}
        <WorkContext
          session={session}
          onChooseSite={(site) => {
            chooseSite(site);
            show({ text: SUITE_TEXTS.home.siteChanged(site === null ? 'todas las sedes' : `Sede ${siteText(site)}`) });
          }}
        />

        <Launcher query={query} site={session.currentSite} />

        {/* R-08: un solo pie informativo (la hora de Lima y el aviso de prototipo en una línea) y la firma debajo. */}
        <p className="text-body-small text-on-surface-variant">
          {SUITE_TEXTS.home.hours} {SUITE_TEXTS.home.prototype}
        </p>
        <InstitutionalFooter />
      </div>
    </div>
  );
}

/** Las tarjetas de la sede de trabajo: cada una con los perfiles que valen en ella; sin ninguno, fuera (D-030). */
function cardsInSite(cards: readonly SystemCard[], site: Site | null): SystemCard[] {
  return cards.map((card) => ({ ...card, profiles: profilesInSite(card.profiles, site) })).filter((card) => card.profiles.length > 0);
}

interface LauncherProps {
  readonly query: UseQueryResult<readonly SystemCard[]>;
  /** La sede de trabajo de la sesión (`null`: todas). */
  readonly site: Site | null;
}

/** Orden alfabético y estable por nombre canónico dentro de cada grupo (R-06; el orden de ADR-0245 D2.4 como referencia). */
const byName = (a: SystemCard, b: SystemCard): number => a.name.localeCompare(b.name, 'es');

/**
 * La región del lanzador: carga, error de lectura, vacío o los dos grupos (R-06): «Tus sistemas» con tarjetas
 * enlazables y, debajo, «Aún no disponibles en este prototipo» como lista sin bordes. Cada estado se representa.
 * Solo lista los sistemas con algún perfil que valga en la sede de trabajo.
 */
function Launcher({ query, site }: LauncherProps) {
  if (query.isError) {
    return <LoadError subject="tus sistemas" error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        <LoadingBar subject="tus sistemas" />
        <div className={GRID}>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-24 medium:h-32" />
          ))}
        </div>
      </div>
    );
  }
  const cards = cardsInSite(query.data, site);
  if (cards.length === 0) {
    return (
      <EmptyState icon="apps" title={SUITE_TEXTS.home.emptyTitle} announce>
        {SUITE_TEXTS.home.empty}
      </EmptyState>
    );
  }
  const available = cards.filter((card) => card.availability === 'DISPONIBLE' && card.path !== undefined).toSorted(byName);
  const unavailable = cards.filter((card) => !available.includes(card)).toSorted(byName);
  return (
    <div className="flex flex-col gap-8">
      {available.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-title-large">{SUITE_TEXTS.home.available}</h2>
          <ul aria-label="Sistemas de la suite" className={GRID}>
            {available.map((card) => (
              <li key={card.code} className="flex">
                <SystemCardView card={card} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {unavailable.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-title-medium text-on-surface-variant">{SUITE_TEXTS.home.unavailable}</h2>
          <ul aria-label={SUITE_TEXTS.home.unavailable}>
            {unavailable.map((card) => (
              <SystemListItem key={card.code} card={card} />
            ))}
          </ul>
        </section>
      )}
      <p className="text-body-medium text-on-surface-variant">{SUITE_TEXTS.home.missing}</p>
    </div>
  );
}
