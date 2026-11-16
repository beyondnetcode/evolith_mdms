/**
 * Motivo gráfico del panel de marca (R-01 del anexo A1 §12): UNA ruta de cinco hitos que evoca la línea de etapas
 * del producto (de la solicitud a la orden). Sustituye a la retícula, las cajas y la ruta discontinua del primer
 * prototipo: un único elemento decorativo, SVG en línea (no añade solicitudes de red), `on-brand` al 16 % de
 * opacidad sobre `brand` sólido y oculto a los lectores de pantalla. Es geometría genérica propia: no usa
 * imágenes externas ni el logotipo. Al ser decorativo queda exento de 1.4.11.
 */
const MILESTONES: ReadonlyArray<readonly [number, number]> = [
  [20, 64],
  [110, 64],
  [200, 40],
  [290, 40],
  [380, 16],
];

export function BrandMotif() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-12 top-1/4 opacity-16">
      <svg viewBox="0 0 400 80" className="w-full" focusable="false">
        <path d="M 20 64 H 110 L 200 40 H 290 L 380 16" fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-on-brand" />
        {MILESTONES.map(([x, y], index) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={index === MILESTONES.length - 1 ? 8 : 5} className="fill-on-brand" />
        ))}
      </svg>
    </div>
  );
}
