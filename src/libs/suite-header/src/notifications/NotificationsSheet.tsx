import { Button, ModalDialog } from '@sil/ui';
import { useNavigate } from 'react-router';
import { useLeaveGuard } from '../LeaveGuardContext.tsx';
import { NO_FILTERS, useNotificationActions } from './notification-queries.ts';
import { NotificationList } from './NotificationList.tsx';
import { useHeaderNotifications } from '../SuiteHeaderContext.tsx';
import { NOTIFICATION_TEXTS, unreadText } from './notification-texts.ts';

interface Props {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * Hoja lateral modal desde `medium` (anexo A1 §10.3): máx. 400 dp, sin sacar al usuario de la tarea. Al abrir,
 * el foco va al título; queda atrapado, el resto de la página inerte, `Escape` y «Cerrar» cierran y el foco
 * vuelve a la campana (lo resuelve `<dialog>`). Abrirla NO marca nada como leído (SU-41). El contenido solo
 * existe abierto: no se lee nada con la hoja cerrada.
 */
export function NotificationsSheet({ isOpen, onClose }: Props) {
  const { unreadCount } = useHeaderNotifications();
  const navigate = useNavigate();
  const { request } = useLeaveGuard();
  return (
    <ModalDialog
      variant="side-sheet"
      open={isOpen}
      onClose={onClose}
      title={NOTIFICATION_TEXTS.title}
      subtitle={unreadCount === null ? undefined : unreadText(unreadCount)}
      focusTitle
      actions={
        isOpen ? (
          <Button
            className="w-full"
            onClick={() =>
              // «Ver todas» sale de SIL como «Ir al portal»: con cambios sin guardar pide confirmar y la hoja sigue abierta.
              request(() => {
                onClose();
                void navigate('/notificaciones');
              })
            }
          >
            {NOTIFICATION_TEXTS.viewAll}
          </Button>
        ) : undefined
      }
    >
      {isOpen && <Content onClose={onClose} />}
    </ModalDialog>
  );
}

function Content({ onClose }: { readonly onClose: () => void }) {
  const { unreadCount } = useHeaderNotifications();
  const { markAllRead } = useNotificationActions();
  return (
    <div className="-mx-6 flex flex-col gap-1">
      {unreadCount !== null && unreadCount > 0 && (
        <Button className="mx-3 self-start" onClick={() => markAllRead.mutate()}>
          {NOTIFICATION_TEXTS.markAllRead}
        </Button>
      )}
      <NotificationList variant="sheet" filters={NO_FILTERS} active onOpen={onClose} />
    </div>
  );
}
