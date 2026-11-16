import { Button } from './Button.tsx';
import { InlineNotice } from './InlineNotice.tsx';

interface Props {
  /** Qué no se pudo cargar: «las solicitudes», «la solicitud». */
  readonly subject: string;
  readonly error: unknown;
  readonly onRetry: () => void;
}

/**
 * Código de correlación de un error de lectura, si lo trae: los errores de los gateways de la suite y de
 * SIL lo exponen en `correlation`. Se lee por su forma, sin conocer las clases: esta librería no depende
 * de ningún contrato (D-026).
 */
export function correlationOf(error: unknown): string | null {
  if (!(error instanceof Error) || !('correlation' in error)) return null;
  return typeof error.correlation === 'string' ? error.correlation : null;
}

/**
 * Error de lectura en la región afectada, no en toda la página. Falla cerrado: mensaje genérico
 * y, si existe, el código de correlación para soporte; nunca el detalle técnico (P-SEC-04).
 */
export function LoadError({ subject, error, onRetry }: Props) {
  const correlation = correlationOf(error);
  return (
    <InlineNotice
      severity="error"
      announce
      title={`No pudimos cargar ${subject}. Revisa tu conexión e inténtalo de nuevo.`}
      actions={
        <Button variant="text-inherit" onClick={onRetry}>
          Reintentar
        </Button>
      }
    >
      {correlation !== null && <>Si el problema continúa, comunica este código a soporte: {correlation}.</>}
    </InlineNotice>
  );
}
