import type { ComponentPropsWithRef } from 'react';

/**
 * Botón relleno de error para la acción de una confirmación terminal (UI-MDM-001 §3.5: `bg-error text-on-error`,
 * 6,46:1 en claro y 7,72:1 en oscuro). `Button` de `ui-sil` no tiene esta variante y sus clases no se pueden
 * sobrescribir sin conflicto de utilidades (G-580): mismas medidas que el botón relleno de M3.
 */
export function DangerButton({ type = 'button', className, ...rest }: ComponentPropsWithRef<'button'>) {
  return (
    <button
      type={type}
      className={[
        'state-layer target-48 inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-error px-6 text-label-large whitespace-nowrap text-on-error',
        'aria-disabled:cursor-not-allowed',
        className ?? '',
      ].join(' ')}
      {...rest}
    />
  );
}
