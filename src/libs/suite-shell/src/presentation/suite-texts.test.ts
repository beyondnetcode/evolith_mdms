import { BRAND_TEXTS, HEADER_TEXTS, NOTIFICATION_TEXTS, sitePickerTexts } from '@suite/header';
import { describe, expect, it } from 'vitest';
import { NOT_FOUND_TEXTS, SUITE_TEXTS, noSystemAccessTexts } from './suite-texts.ts';

/** Todas las cadenas visibles de la suite (S-01, S-02, S-03, cabecera y marca), aplanadas. */
function flatten(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(flatten);
  return [];
}

const TEXTS: readonly string[] = [
  ...flatten(SUITE_TEXTS),
  ...flatten(BRAND_TEXTS),
  ...flatten(HEADER_TEXTS),
  ...flatten(NOTIFICATION_TEXTS),
  ...flatten(sitePickerTexts('SIL')),
  ...flatten(noSystemAccessTexts('SIL')),
  ...flatten(NOT_FOUND_TEXTS),
];

/** La US-SIL-004 (escenarios 3 y 4) fija el texto exacto de los bloqueos, que nombra a UMS: la historia prevalece sobre M-10. */
const STORY_LITERALS = new Set<string>(Object.values(noSystemAccessTexts('SIL').body));

describe('copy sin jerga (M-10)', () => {
  it('ninguna cadena de las pantallas de la suite contiene «UMS» ni «Fase 1», salvo los bloqueos que la US-SIL-004 dicta literalmente', () => {
    for (const text of TEXTS.filter((t) => !STORY_LITERALS.has(t))) {
      expect(text, text).not.toMatch(/\bUMS\b|Fase 1/);
    }
  });
});
