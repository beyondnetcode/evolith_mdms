import { profilesSummary, type SystemCard, type SystemCode } from '@suite/contracts';
import { Icon, Tag, joinClasses, type IconName } from '@sil/ui';
import { Link } from 'react-router';
import { SUITE_TEXTS } from '../suite-texts.ts';
import { useSystems } from '../systems/SystemsContext.tsx';

/**
 * Un icono PROPIO por sistema (anexo A1 §11.6, M-07): el lanzador deja de repetir la misma cuadrícula. Es una
 * asociación visual provisional (G-195: sin manual de marca ni iconografía por sistema); el significado
 * nunca va solo en el icono, siempre con la sigla y el nombre canónico.
 */
export const SYSTEM_ICON: Readonly<Record<SystemCode, IconName>> = {
  CMS: 'description',
  CNS: 'inventory_2',
  DT: 'warehouse',
  MDM: 'storage',
  SIL: 'local_shipping',
  UMS: 'group',
  YMS: 'local_parking',
};

interface Props {
  readonly card: SystemCard;
}

const CARD =
  'state-layer relative flex min-h-24 w-full cursor-pointer flex-row items-center gap-4 rounded-md bg-surface-container-highest p-4 text-left text-on-surface ' +
  'medium:min-h-32 medium:flex-col medium:items-start medium:gap-3';

function AvailableContent({ card }: { readonly card: SystemCard }) {
  const systems = useSystems();
  return (
    <>
      <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
        <Icon name={SYSTEM_ICON[card.code]} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-title-large">{card.code}</span>
        <span className="text-body-medium">{card.name}</span>
        <span className="flex items-center gap-1 text-body-small text-on-surface-variant">
          <Icon name="group" className="size-4.5" />
          {profilesSummary(card.profiles, systems)}
        </span>
      </span>
      <Icon name="arrow_forward" className="text-primary medium:absolute medium:top-4 medium:right-4" />
    </>
  );
}

/**
 * Tarjeta de un sistema DISPONIBLE (R-07 del anexo A1 §12, UI-07): tarjeta RELLENA (`surface-container-highest`,
 * sin borde: nunca relleno y borde a la vez), disco de icono, sigla, nombre canónico, perfil con icono y flecha final.
 * Es un enlace real y toda la tarjeta es el único objetivo: sin selector de sede, el sistema se abre con el rol y la
 * sede de UMS (D-028, US-SIL-004). SIN etiqueta «Disponible»: el grupo «Tus sistemas» ya lo dice.
 */
export function SystemCardView({ card }: Props) {
  return (
    <Link to={card.path ?? '/'} className={CARD}>
      <AvailableContent card={card} />
    </Link>
  );
}

/**
 * Sistema NO disponible (R-06, UI-07): un elemento de lista de 56 dp SIN tarjeta, sin borde y sin relleno, todo en
 * `on-surface-variant`. Es información, no un control: no recibe foco ni `aria-disabled`. Solo «En mantenimiento»
 * lleva etiqueta de atención y su razón; el grupo ya dice «Aún no disponibles en este prototipo».
 */
export function SystemListItem({ card }: { readonly card: SystemCard }) {
  const maintenance = card.availability === 'EN_MANTENIMIENTO';
  return (
    <li className={joinClasses('flex min-h-14 items-center gap-4 py-2 text-on-surface-variant')}>
      <Icon name={SYSTEM_ICON[card.code]} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-title-small">{card.code}</span>
        <span className="text-body-small">{card.name}</span>
        {maintenance && <span className="text-body-small">{SUITE_TEXTS.home.maintenance}</span>}
      </span>
      {maintenance && (
        <Tag tone="attention" icon="build" size="compact">
          En mantenimiento
        </Tag>
      )}
    </li>
  );
}
