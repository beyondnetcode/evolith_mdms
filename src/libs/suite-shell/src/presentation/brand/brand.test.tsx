import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WIDTHS } from '@sil/ui/testing';
import { renderSuite } from '../../testing/suite-harness.tsx';

const SIGNATURE = '© Organización S.A. · RUC 20100412447 · Operador Logístico Aduanero desde 1978';

describe('identidad de marca en S-01 (anexo A1 §11.6, M-01, M-03, M-04, M-08, M-09, M-10)', () => {
  it('el panel lleva el logotipo (activo provisional declarado) con nombre «ORG», el nombre de la suite y el lema oficial', () => {
    renderSuite({ session: null, path: '/acceso', width: WIDTHS.expanded });
    const logo = screen.getByRole('img', { name: 'Suite' });
    expect(logo).toHaveAttribute('data-source', 'marca-local');
    expect(logo.closest('aside')).not.toBeNull();
    expect(screen.getByText('Operador Logístico Aduanero desde 1978')).toBeInTheDocument();
  });

  // R-01: el panel es sereno: como máximo cuatro bloques de contenido y UN motivo decorativo oculto a los lectores de pantalla.
  it('el panel es sereno: logotipo, nombre, descriptor y lema, sobre brand sólido y con un único motivo decorativo', () => {
    const { container } = renderSuite({ session: null, path: '/acceso', width: WIDTHS.expanded });
    const panel = container.querySelector('aside');
    expect(panel).not.toBeNull();
    expect(panel?.className).toContain('bg-brand');
    expect(panel?.getAttribute('style')).toBeNull();
    expect(within(panel!).getByText('Suite')).toBeInTheDocument();
    expect(within(panel!).getByText('Accede a tus sistemas de operación logística.')).toBeInTheDocument();
    expect(within(panel!).getByText('Operador Logístico Aduanero desde 1978')).toBeInTheDocument();
    // El motivo es una ruta de cinco hitos, sin retícula ni cajas.
    const motifs = panel!.querySelectorAll(':scope > div[aria-hidden="true"]');
    expect(motifs).toHaveLength(1);
    expect(motifs[0]?.querySelectorAll('circle')).toHaveLength(5);
    expect(motifs[0]?.querySelectorAll('rect, line')).toHaveLength(0);
    expect(motifs[0]?.className).toContain('opacity-16');
  });

  it('título y apoyo sin jerga; pie institucional literal; título de pestaña único', () => {
    renderSuite({ session: null, path: '/acceso' });
    expect(screen.getByRole('heading', { level: 1, name: 'Inicia sesión' })).toBeInTheDocument();
    expect(screen.getByText('Elige tu inquilino y usa tu usuario.')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(SIGNATURE);
    expect(document.title).toBe('Iniciar sesión · Suite');
  });

  it('el aviso de prototipo baja a una línea body-small, sin caja (R-02)', () => {
    renderSuite({ session: null, path: '/acceso' });
    const notice = screen.getByText(/^Prototipo: los usuarios y las claves son de prueba/);
    expect(notice.className).toContain('text-body-small');
    expect(notice.closest('div[class*="bg-primary-container"]')).toBeNull();
    expect(notice.closest('div[role="status"]')).toBeNull();
  });

  it('«Tema» y «Ayuda» siguen accesibles en la banda de marca de compact y medium', () => {
    for (const width of [WIDTHS.compact, WIDTHS.medium]) {
      const { unmount } = renderSuite({ session: null, path: '/acceso', width });
      expect(screen.getByRole('button', { name: /^Tema: / }).className).toContain('text-on-brand');
      expect(screen.getByRole('button', { name: 'Ayuda' }).className).toContain('focus-visible:outline-on-brand');
      unmount();
    }
  });

  it('en expanded «Tema» y «Ayuda» van sobre la superficie, no sobre brand', () => {
    renderSuite({ session: null, path: '/acceso', width: WIDTHS.expanded });
    expect(screen.getByRole('button', { name: 'Ayuda' }).className).not.toContain('text-on-brand');
  });
});

describe('identidad de marca en S-02 y en la barra (M-05, M-06, M-07, M-08)', () => {
  // R-05: el saludo vive sobre `surface`, sin banda de marca; `brand` no aparece en S-02 fuera del isotipo de la barra.
  it('el saludo es el h1 sobre surface, con el inquilino, la sede y el perfil debajo, y no hay banda ni superficie brand en S-02', async () => {
    const { container } = renderSuite({ user: 'rosa.medina', path: '/' });
    const title = await screen.findByRole('heading', { level: 1, name: 'Hola, Rosa' });
    expect(title.closest('[class*="bg-brand"]')).toBeNull();
    expect(container.querySelector('main [class*="bg-brand"]')).toBeNull();
    expect(title.parentElement).toHaveTextContent('Analista de datos maestros · Callao');
    // D-030: el inquilino y la sede de trabajo, que antes iban en la banda de bienvenida, van bajo el saludo.
    expect(title.parentElement).toHaveTextContent('Organización S.A. (ORG) · Sede Callao');
    expect(screen.queryByText('Elige el sistema con el que vas a trabajar.')).not.toBeInTheDocument();
    expect(title.className).toContain('text-display-small-emphasized');
  });

  it('cada sistema lleva un icono distinto y ninguno cita «Fase 1» ni «UMS» en sus textos', async () => {
    renderSuite({ user: 'carlos.vega', path: '/' });
    const available = await screen.findByRole('list', { name: 'Sistemas de la suite' });
    const unavailable = screen.getByRole('list', { name: 'Aún no disponibles en este prototipo' });
    const icons = [
      ...[...available.querySelectorAll('li span[aria-hidden="true"] svg path')].map((p) => p.getAttribute('d')),
      ...[...unavailable.querySelectorAll('li > svg path')].map((p) => p.getAttribute('d')),
    ];
    expect(icons).toHaveLength(5);
    expect(new Set(icons).size).toBe(5);
    expect(available.textContent).not.toContain('Fase 1');
    expect(unavailable.textContent).not.toContain('Fase 1');
    expect(screen.getByRole('contentinfo')).toHaveTextContent(SIGNATURE);
  });

  it('los sistemas no disponibles son elementos de lista sin tarjeta, sin borde, sin relleno y sin estado de interacción', async () => {
    renderSuite({ user: 'ana.perez', path: '/' });
    const list = await screen.findByRole('list', { name: 'Aún no disponibles en este prototipo' });
    const cns = within(list).getAllByRole('listitem')[0];
    expect(cns?.className).not.toMatch(/(?<![\w-])(bg-|border|state-layer|rounded)/);
    expect(cns?.querySelector('.rounded-sm')).toBeNull();
    // Apagada: sin borde ni elevación y con el texto atenuado.
    expect(cns?.className).not.toMatch(/(^|\s)(border|shadow-\S+)(\s|$)/);
    expect(cns?.className).toContain('text-on-surface-variant');
  });

  // Ajuste al integrar con el rediseño (UI-07, UI-SIL-001 §3.6): la tarjeta se lee como interactiva por el relleno, la
  // capa de estado y la flecha final; la elevación es primero tono, así que no lleva sombra.
  it('la tarjeta disponible se lee como interactiva: rellena, con estado y una flecha, sin sombra', async () => {
    renderSuite({ user: 'carlos.vega', path: '/' });
    const mdm = await screen.findByRole('link', { name: /^MDM/ });
    expect(mdm.className).toContain('bg-surface-container-highest');
    expect(mdm.className).not.toMatch(/(?<![\w-])shadow-/);
    expect(mdm.className).toContain('state-layer');
    expect(mdm.lastElementChild?.tagName.toLowerCase()).toBe('svg');
  });

  it('la tarjeta de lo disponible es RELLENA (surface-container-highest) y nunca lleva relleno y borde a la vez', async () => {
    renderSuite({ user: 'carlos.vega', path: '/' });
    const mdm = await screen.findByRole('link', { name: /^MDM/ });
    expect(mdm.className).toContain('bg-surface-container-highest');
    expect(mdm.className).not.toMatch(/(?<![\w-])border/);
    expect(mdm.className).toContain('state-layer');
  });

  it('la marca de la barra es un enlace «Suite, inicio» a S-02 con el isotipo decorativo', async () => {
    renderSuite({ user: 'carlos.vega', path: '/' });
    await screen.findByRole('list', { name: 'Sistemas de la suite' });
    const link = screen.getByRole('link', { name: 'Suite, inicio' });
    expect(link).toHaveAttribute('href', '/');
    expect(link.querySelector('[data-shape="isotype"]')).toHaveAttribute('aria-hidden', 'true');
  });
});
