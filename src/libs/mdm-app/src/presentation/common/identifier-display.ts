import { problemFrom, type IdentifierScheme, type PartySummary } from '@mdm/contracts';
import type { SelectOption } from '@sil/ui';
import { schemeHint } from './field-messages.ts';
import { PARTY_STATUS_DISPLAY } from './PartyStatusTag.tsx';
import { problemSentence } from './problem-text.ts';

/** Nombre visible de los países de los esquemas del catálogo; lo desconocido se muestra con su código. */
export const COUNTRY_NAME: Readonly<Record<string, string>> = {
  PE: 'Perú',
  CL: 'Chile',
  EC: 'Ecuador',
};

export function countryName(code: string): string {
  return COUNTRY_NAME[code] ?? code;
}

/** Países con algún esquema en el catálogo. */
export function countryOptions(schemes: readonly IdentifierScheme[]): SelectOption[] {
  return [...new Set(schemes.map((scheme) => scheme.countryCode))].map((code) => ({ id: code, name: countryName(code) }));
}

/** Esquemas del país elegido (elegir país filtra sin enviar nada, WCAG 3.2.2). */
export function schemeOptions(schemes: readonly IdentifierScheme[], countryCode: string): SelectOption[] {
  return schemes
    .filter((scheme) => scheme.countryCode === countryCode)
    .map((scheme) => ({
      id: scheme.code,
      name: `${scheme.name} (${scheme.code})`,
    }));
}

export function findScheme(schemes: readonly IdentifierScheme[], countryCode: string, schemeCode: string): IdentifierScheme | undefined {
  return schemes.find((scheme) => scheme.code === schemeCode && scheme.countryCode === countryCode);
}

/** Campo al que pertenece un error `422` del identificador (UX-MDM-001 §6.1, columna «Dónde»). */
export function identifierProblemField(error: unknown): 'schemeCode' | 'value' | null {
  switch (problemFrom(error)?.code) {
    case 'party.identifier.scheme_unknown':
    case 'party.identifier.scheme_not_allowed':
      return 'schemeCode';
    case 'party.identifier.invalid_format':
    case 'party.identifier.check_digit_invalid':
      return 'value';
    default:
      return null;
  }
}

/** Mensaje de un error `422` del identificador, con el país y la pista del esquema elegidos. */
export function identifierProblemText(error: unknown, scheme: IdentifierScheme | undefined, country: string): string {
  return problemSentence(error, {
    countryName: countryName(country),
    ...(scheme === undefined
      ? {}
      : {
          scheme: {
            name: scheme.name,
            hint: schemeHint(scheme.code, scheme.name),
          },
        }),
  });
}

/**
 * `409` `party.identifier.duplicate` (UX-MDM-001 §6.1): «Este identificador ya pertenece a otra organización:
 * {código} · {razón social} ({estado}).». Sin la organización encontrada, la forma sin datos.
 */
export function duplicateText(owner: PartySummary | null): string {
  if (owner === null) return 'Este identificador ya pertenece a otra organización.';
  return `Este identificador ya pertenece a otra organización: ${owner.code} · ${owner.legalName} (${PARTY_STATUS_DISPLAY[owner.status].text.toLocaleLowerCase('es')}).`;
}
