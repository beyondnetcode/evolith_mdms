import { IconButton, Icon, useWindowSizeClass } from '@sil/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useLeaveGuard } from '../LeaveGuardContext.tsx';
import { NotificationsSheet } from './NotificationsSheet.tsx';
import { useHeaderNotifications } from '../SuiteHeaderContext.tsx';
import { bellName } from './notification-texts.ts';

/**
 * Campana «Notificaciones» de la cabecera de la suite y de SIL (anexo A1 §10.3): siempre presente, siempre
 * en la misma posición (marca, [sistema y perfil], Notificaciones, Ayuda, avatar; WCAG 3.2.6). Su nombre
 * accesible lleva la cuenta y se actualiza al cambiar; la insignia visual es decorativa para el lector de
 * pantalla, así no se lee dos veces. Sin insignia con 0 y «99+» desde 100. En `compact` abre la pantalla
 * completa (un panel taparía la tarea); desde `medium`, la hoja lateral.
 */
export function NotificationsButton() {
  const { unreadCount } = useHeaderNotifications();
  const sizeClass = useWindowSizeClass();
  const navigate = useNavigate();
  const { request } = useLeaveGuard();
  const [sheetOpen, setSheetOpen] = useState(false);
  const compact = sizeClass === 'compact';

  return (
    <>
      <span className="relative inline-flex">
        <IconButton
          aria-label={bellName(unreadCount)}
          aria-haspopup={compact ? undefined : 'dialog'}
          onClick={() => {
            if (compact) request(() => void navigate('/notificaciones'));
            else setSheetOpen(true);
          }}
        >
          <Icon name="notifications" />
        </IconButton>
        {unreadCount === null ? (
          // Sin cifra o desconocida (UI-14): punto de 6 dp. El nombre accesible del botón ya dice «Notificaciones».
          <span aria-hidden="true" className="pointer-events-none absolute top-2 right-2 size-1.5 rounded-full bg-error" />
        ) : (
          unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-label-small text-on-error"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )
        )}
      </span>
      {!compact && <NotificationsSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} />}
    </>
  );
}
