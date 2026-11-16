import { Button, InlineNotice } from '@sil/ui';

interface Props {
  readonly onReload: () => void;
  readonly onDiscard: () => void;
  /** Mientras se recarga la ficha. */
  readonly busy?: boolean;
  /** Texto del aviso: por defecto, el de la organización (§6.1); la relación y la referencia tienen versión propia. */
  readonly text?: string;
}

export const VERSION_CONFLICT_TEXT = 'Otra persona cambió esta organización mientras editabas. Tus cambios siguen aquí.';

/**
 * D-MDM-14 «La organización cambió» (UX-MDM-001 §4.6 y §6.1; UI-MDM-001 §3.5): no es un diálogo, sino un aviso de
 * error que se anuncia (`role="alert"`) dentro del formulario abierto. El borrador se conserva: la recuperación es
 * manual, la interfaz no fusiona cambios (SU-MDM-06, G-563).
 */
export function VersionConflictNotice({ onReload, onDiscard, busy = false, text = VERSION_CONFLICT_TEXT }: Props) {
  return (
    <InlineNotice
      severity="error"
      announce
      title={text}
      actions={
        <>
          <Button variant="text-inherit" onClick={onReload} disabled={busy} aria-busy={busy}>
            Recargar y revisar
          </Button>
          <Button variant="text-inherit" onClick={onDiscard} disabled={busy}>
            Descartar mis cambios
          </Button>
        </>
      }
    />
  );
}
