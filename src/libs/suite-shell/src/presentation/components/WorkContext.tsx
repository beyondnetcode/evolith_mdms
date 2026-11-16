import { ALL_SITES, canChooseSite, isSite, siteText, sitesOf, type SuiteSession } from '@suite/contracts';
import { SelectField } from '@sil/ui';
import { SUITE_TEXTS } from '../suite-texts.ts';

const SITE_ID = 'sede-de-trabajo';

interface Props {
  readonly session: SuiteSession;
  readonly onChooseSite: (site: SuiteSession['currentSite']) => void;
}

/**
 * «Tu contexto de trabajo» de S-02 (D-030): la sede de trabajo, solo si la persona tiene perfiles en más de una.
 * «Todas las sedes» es trabajar sin fijarla. El inquilino y la sede se leen bajo el saludo (`workContextLine`), con lo
 * que UMS publica: `context.tenant` y `context.branch`.
 */
export function WorkContext({ session, onChooseSite }: Props) {
  if (!canChooseSite(session)) return null;
  return (
    <section aria-labelledby="contexto-de-trabajo" className="flex flex-col gap-3 rounded-md border border-outline-variant p-4">
      <h2 id="contexto-de-trabajo" className="text-title-small">
        {SUITE_TEXTS.home.context}
      </h2>
      <SelectField
        fieldId={SITE_ID}
        label={SUITE_TEXTS.home.site}
        className="medium:max-w-80"
        emptyText={ALL_SITES}
        options={sitesOf(session).map((site) => ({ id: site, name: site }))}
        value={session.currentSite ?? ''}
        onChange={(e) => onChooseSite(isSite(e.target.value) ? e.target.value : null)}
        help={session.currentSite === null ? SUITE_TEXTS.home.allSitesHelp : SUITE_TEXTS.home.siteHelp}
      />
    </section>
  );
}

/** «Organización S.A. (ORG) · Sede Callao», o «… · Todas las sedes»: la línea bajo el saludo de S-02 (D-030). */
export function workContextLine(session: SuiteSession): string {
  const site = session.currentSite ?? (canChooseSite(session) ? null : (sitesOf(session)[0] ?? null));
  return `${session.tenant.name} (${session.tenant.code}) · ${site === null ? siteText(null) : `Sede ${site}`}`;
}
