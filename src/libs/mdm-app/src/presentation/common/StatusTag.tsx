import { joinClasses } from '@sil/ui';
import { MdmIcon, type MdmIconName } from './MdmIcon.tsx';

/**
 * Tonos de la etiqueta de estado (UI-SIL-001 §4.8, UI-MDM-001 §2). Solo `block`, `attention` y `progress` llevan
 * contenedor de color; lo nominal (`ready`, `quiet`) calla con icono y texto, y lo terminal (`outline`) va
 * delineado. `Tag` no existe aún en `ui-sil` (G-580): es una composición local con los mismos pares de roles.
 */
export type TagTone = 'block' | 'attention' | 'progress' | 'outline' | 'ready' | 'quiet';

const TONES: Readonly<Record<TagTone, { readonly container: string; readonly icon: string }>> = {
  block: { container: 'bg-error-container text-on-error-container', icon: '' },
  attention: { container: 'bg-warning-container text-on-warning-container', icon: '' },
  progress: { container: 'bg-secondary-container text-on-secondary-container', icon: '' },
  outline: { container: 'border border-outline text-on-surface', icon: 'text-on-surface-variant' },
  ready: { container: 'text-on-surface', icon: 'text-success' },
  quiet: { container: 'text-on-surface-variant', icon: '' },
};

interface Props {
  readonly tone: TagTone;
  readonly icon: MdmIconName;
  readonly text: string;
  /** 24 dp en tablas y tarjetas; 32 dp en cabeceras. */
  readonly size?: 'compact' | 'regular';
  /**
   * Sobre la fila seleccionada de una lista-detalle (`secondary-container`): el borde de `outline` pasa a
   * `on-secondary-container`, porque `outline` mide 2,95:1 en oscuro (UI-MDM-001 §2.6, DV-04, G-582).
   */
  readonly onSelected?: boolean;
}

/** Etiqueta no interactiva: sin capa de estado ni foco. El estado se lee por el texto; el icono es decorativo. */
export function StatusTag({ tone, icon, text, size = 'compact', onSelected = false }: Props) {
  const definition = TONES[tone];
  const container = onSelected && tone === 'outline' ? 'border border-on-secondary-container text-on-secondary-container' : definition.container;
  return (
    <span
      className={joinClasses(
        'inline-flex items-center gap-1 rounded-sm px-2 whitespace-nowrap',
        size === 'compact' ? 'h-6 text-label-medium' : 'h-8 text-label-large',
        container,
      )}
    >
      <MdmIcon name={icon} className={joinClasses(size === 'compact' ? 'size-4' : 'size-4.5', definition.icon)} />
      {text}
    </span>
  );
}
