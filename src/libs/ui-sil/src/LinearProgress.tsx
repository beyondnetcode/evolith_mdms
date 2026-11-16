import { joinClasses } from './join-classes.ts';

interface LinearProgressProps {
  readonly value: number;
  readonly max: number;
  /** Nombre accesible del indicador: «Checks de conformidad completos». */
  readonly label: string;
  /** Texto que lo resume, p. ej. «3 de 5». */
  readonly text: string;
  readonly className?: string;
}

/** Indicador lineal determinado de M3: valor conocido, con su equivalente en texto. */
export function LinearProgress({ value, max, label, text, className }: LinearProgressProps) {
  const percentage = max === 0 ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={text}
      className={joinClasses('h-1 w-full overflow-hidden rounded-full bg-secondary-container', className)}
    >
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percentage}%` }} />
    </div>
  );
}
