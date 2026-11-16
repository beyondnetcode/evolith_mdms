import { destinationPath, notificationText, type Notification } from '@suite/contracts';
import { Button, IconButton, Icon, joinClasses } from '@sil/ui';
import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router';
import { shortTime } from './group-by-date.ts';
import { SEVERITY_STYLE, NOTIFICATION_TEXTS, TYPE_LABEL } from './notification-texts.ts';

interface Props {
  readonly notification: Notification;
  /** Activar la fila: marca leída, cierra la hoja si estaba abierta y abre el destino. */
  readonly onOpen: (notification: Notification) => void;
  readonly onMarkRead: (notification: Notification) => void;
  /** En la hoja no hay ancho para un botón de texto: va un botón de icono con el mismo nombre. */
  readonly iconOnly: boolean;
}

/** Identificador del enlace de una fila: el foco vuelve a él al marcarla como leída (nunca al `body`). */
export function linkIdOf(id: string): string {
  return `notificacion-${id}`;
}

/**
 * Elemento de lista de tres líneas, de al menos 72 dp (anexo A1 §10.3.1). Toda la fila es el objetivo.
 * No leída: punto de 8 dp, título con grosor 500 y el texto oculto «No leída.»; leída: sin punto y grosor
 * 400. Se distingue por forma, grosor y texto, no por color (WCAG 1.4.1). «Marcar como leída» va DESPUÉS del
 * enlace en el orden de foco y su nombre contiene la etiqueta visible (WCAG 2.5.3).
 */
export function NotificationItem({ notification, onOpen, onMarkRead, iconOnly }: Props) {
  const { title, detail } = notificationText(notification);
  const severity = SEVERITY_STYLE[notification.severity];
  const path = destinationPath(notification.destination);
  const isUnread = !notification.read;

  const content: ReactNode = (
    <>
      {isUnread && <span aria-hidden="true" className="absolute top-1/2 left-2 size-2 -translate-y-1/2 rounded-full bg-primary" />}
      <span aria-hidden="true" className={joinClasses('inline-flex size-10 shrink-0 items-center justify-center rounded-full', severity.classes)}>
        <Icon name={severity.icon} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        {/* Tres líneas (R-26): sobretítulo con el tipo, encabezado con el identificador SIN truncar y apoyo de dos líneas. */}
        <span className="text-label-medium text-on-surface-variant">
          {isUnread && <span className="sr-only">{NOTIFICATION_TEXTS.unread} </span>}
          {TYPE_LABEL[notification.type]}
        </span>
        <span className={joinClasses('break-words tabular-nums', isUnread ? 'text-body-large-emphasized' : 'text-body-large')}>
          <span className="sr-only">{title}</span>
          <span className="sr-only">. </span>
          <span aria-hidden="true">{notification.params.operationId}</span>
        </span>
        <span className="line-clamp-2 text-body-medium text-on-surface-variant">{detail}</span>
      </span>
      <time dateTime={notification.createdAt} className="shrink-0 pt-1 text-label-small text-on-surface-variant tabular-nums">
        {shortTime(notification.createdAt)}
      </time>
    </>
  );
  // En la pantalla completa de `compact` el botón de texto baja a su propia línea: en 412 dp no cabe junto al texto.
  const classes = joinClasses(
    'state-layer relative flex min-h-18 min-w-0 items-start gap-3 py-3 pr-2 pl-6 text-on-surface',
    iconOnly ? 'flex-1' : 'basis-full medium:flex-1 medium:basis-0',
  );

  function open(event: MouseEvent<HTMLAnchorElement>): void {
    // Un clic con modificador (abrir en otra pestaña) conserva el comportamiento nativo del enlace.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onOpen(notification);
  }

  return (
    <li className={joinClasses('flex items-center', !iconOnly && 'flex-wrap')}>
      {path === null ? (
        // Un destino que no tiene la forma de una solicitud no se enlaza (sin redirector abierto).
        <div id={linkIdOf(notification.id)} tabIndex={-1} className={classes}>
          {content}
        </div>
      ) : (
        <Link id={linkIdOf(notification.id)} to={path} onClick={open} className={classes}>
          {content}
        </Link>
      )}
      {isUnread &&
        (iconOnly ? (
          <IconButton aria-label={`${NOTIFICATION_TEXTS.markRead}: ${title}`} onClick={() => onMarkRead(notification)}>
            <Icon name="check" />
          </IconButton>
        ) : (
          <Button aria-label={`${NOTIFICATION_TEXTS.markRead}: ${title}`} onClick={() => onMarkRead(notification)} className="mr-2 mb-1 ml-auto medium:mb-0">
            {NOTIFICATION_TEXTS.markRead}
          </Button>
        ))}
    </li>
  );
}
