import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIN_WIDTH_DP, windowSizeClass, isDesktop } from './index.ts';

describe('clases de ventana', () => {
  it('clasifica por el ancho en dp', () => {
    expect(windowSizeClass(412)).toBe('compact');
    expect(windowSizeClass(599)).toBe('compact');
    expect(windowSizeClass(600)).toBe('medium');
    expect(windowSizeClass(839)).toBe('medium');
    expect(windowSizeClass(840)).toBe('expanded');
    expect(windowSizeClass(1200)).toBe('large');
    expect(windowSizeClass(1920)).toBe('extra-large');
    expect(isDesktop('medium')).toBe(false);
    expect(isDesktop('large')).toBe(true);
  });

  it('coincide con los --breakpoint-* generados desde tokens/global/window.json', () => {
    const css = readFileSync(resolve(import.meta.dirname, 'theme-map.generated.css'), 'utf8');
    for (const [sizeClass, dp] of Object.entries(MIN_WIDTH_DP)) {
      if (sizeClass === 'compact') continue;
      const match = new RegExp(`--breakpoint-${sizeClass}:\\s*([\\d.]+)rem`).exec(css);
      expect(Number(match?.[1]) * 16, sizeClass).toBe(dp);
    }
  });
});
