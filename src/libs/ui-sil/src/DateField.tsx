/* eslint-disable complexity, jsx-a11y/no-noninteractive-element-interactions -- selector de fecha de M3: un solo componente con el campo, el calendario y los dos modos (acoplado y modal) */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { IconButton, Button } from './Button.tsx';
import { ModalDialog } from './ModalDialog.tsx';
import { Icon } from './Icon.tsx';
import {
  toIsoDate,
  dayOfWeek,
  daysOfMonth,
  todayInLima,
  parseTypedDate,
  readIsoDate,
  sameDay,
  displayDate,
  addDays,
  addMonths,
  type CivilDay,
} from './dates.ts';
import { joinClasses } from './join-classes.ts';
import { useWindowSizeClass } from './use-window-size-class.ts';
import { useDisclosure } from './use-disclosure.ts';

const MONTH_NAME = new Intl.DateTimeFormat('es-PE', { month: 'long', timeZone: 'UTC' });
const SHORT_DAY_NAME = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const LONG_DAY_NAME = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function monthText(date: CivilDay): string {
  return `${MONTH_NAME.format(new Date(Date.UTC(date.year, date.month - 1, 1)))} de ${date.year}`;
}

interface CalendarProps {
  readonly selected: CivilDay | null;
  readonly initial: CivilDay;
  readonly onChoose: (date: CivilDay) => void;
  readonly label: string;
  /** Primer día que se puede elegir (`AAAA-MM-DD`); los anteriores se ven atenuados y no se eligen. */
  readonly min?: string | undefined;
}

/**
 * Rejilla de un mes (selector de fecha de M3). Una sola celda está en el orden de tabulación; las
 * flechas se mueven por días y semanas, `RePág` y `AvPág` por meses. Cada día se lee entero: «martes,
 * 13 de octubre de 2026».
 */
function Calendar({ selected, initial, onChoose, label, min }: CalendarProps) {
  const [focus, setFocus] = useState<CivilDay>(selected ?? initial);
  const today = todayInLima();
  const grid = useRef<HTMLDivElement>(null);
  const [moved, setMoved] = useState(false);
  const first: CivilDay = { year: focus.year, month: focus.month, day: 1 };
  const filled = dayOfWeek(first);
  const days = daysOfMonth(focus.year, focus.month);

  // Tras moverse con el teclado, el foco acompaña a la celda activa (el DOM es un sistema externo).
  useEffect(() => {
    if (moved) grid.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, [focus, moved]);

  function onPress(event: KeyboardEvent<HTMLDivElement>): void {
    const steps: Record<string, CivilDay> = {
      ArrowLeft: addDays(focus, -1),
      ArrowRight: addDays(focus, 1),
      ArrowUp: addDays(focus, -7),
      ArrowDown: addDays(focus, 7),
      PageUp: addMonths(focus, -1),
      PageDown: addMonths(focus, 1),
      Home: addDays(focus, -dayOfWeek(focus)),
      End: addDays(focus, 6 - dayOfWeek(focus)),
    };
    const next = steps[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setMoved(true);
    setFocus(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <IconButton aria-label="Mes anterior" onClick={() => setFocus(addMonths(focus, -1))}>
          <Icon name="navigate_before" />
        </IconButton>
        <p aria-live="polite" className="text-title-small capitalize">
          {monthText(focus)}
        </p>
        <IconButton aria-label="Mes siguiente" onClick={() => setFocus(addMonths(focus, 1))}>
          <Icon name="navigate_next" />
        </IconButton>
      </div>
      {/* Cada día es un botón con su fecha completa; el teclado entre días lo resuelve `alPulsar`. */}
      <div ref={grid} role="group" aria-label={`${label}: ${monthText(focus)}`} onKeyDown={onPress} className="grid grid-cols-7 gap-y-1">
        {SHORT_DAY_NAME.map((name, i) => (
          <span key={i} aria-hidden="true" className="flex h-8 items-center justify-center text-body-small text-on-surface-variant">
            {name}
          </span>
        ))}
        {Array.from({ length: filled }, (_, i) => (
          <span key={`v${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day: CivilDay = { year: focus.year, month: focus.month, day: i + 1 };
          const chosen = sameDay(day, selected);
          const focusable = sameDay(day, focus);
          const blocked = min !== undefined && toIsoDate(day) < min;
          return (
            <span key={day.day} className="flex justify-center">
              <button
                type="button"
                tabIndex={focusable ? 0 : -1}
                aria-label={LONG_DAY_NAME.format(new Date(Date.UTC(day.year, day.month - 1, day.day)))}
                aria-pressed={chosen}
                aria-current={sameDay(day, today) ? 'date' : undefined}
                aria-disabled={blocked ? true : undefined}
                onClick={() => {
                  if (!blocked) onChoose(day);
                }}
                className={joinClasses(
                  'state-layer target-48 flex size-10 cursor-pointer items-center justify-center rounded-full text-body-medium tabular-nums',
                  chosen
                    ? 'bg-primary text-on-primary'
                    : blocked
                      ? 'cursor-not-allowed text-on-surface/38'
                      : sameDay(day, today)
                        ? 'border border-primary text-primary'
                        : 'text-on-surface',
                )}
              >
                {day.day}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

interface DateFieldProps {
  readonly label: string;
  readonly name?: string;
  /** `AAAA-MM-DD`, o el texto escrito si aún no es una fecha válida (así el validador lo rechaza con su mensaje). */
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly required?: boolean;
  /** Primer día que ofrece el calendario (`AAAA-MM-DD`); lo escrito a mano lo revisa el validador. */
  readonly min?: string | undefined;
  readonly error?: string | undefined;
  readonly help?: string | undefined;
  readonly fieldId?: string;
  readonly changed?: boolean;
  readonly className?: string;
}

/**
 * Campo de fecha con el selector de fecha de M3 (UX-SIL-001 §3.6): escritura directa en
 * `dd/mm/aaaa` y selector acoplado desde `medium` o modal en `compact`. El valor es una fecha civil
 * `AAAA-MM-DD`, sin zona horaria. El formato lo fija SIL, no el idioma del navegador.
 */
export function DateField({ label, name, value, defaultValue = '', onValueChange, required = false, min, error, help, fieldId, changed = false, className }: DateFieldProps) {
  const autoId = useId();
  const id = fieldId ?? autoId;
  const supportingTextId = `${id}-apoyo`;
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const sizeClass = useWindowSizeClass();
  const modal = sizeClass === 'compact';
  const { open: dockedOpen, toggle, close, pinContainer, pinButton, panelId, onKeyDown } = useDisclosure();
  const [dialog, setDialog] = useState(false);
  const [tentative, setTentative] = useState<CivilDay | null>(null);
  const selected = readIsoDate(current);
  const hasError = error !== undefined && error !== '';

  function change(nextValue: string): void {
    setInternal(nextValue);
    onValueChange?.(nextValue);
  }

  function openPanel(): void {
    if (modal) {
      setTentative(selected);
      setDialog(true);
    } else {
      toggle();
    }
  }

  return (
    <div className={joinClasses('relative flex min-w-0 flex-col gap-1', className)}>
      <div ref={pinContainer} role="presentation" className="relative" onKeyDown={onKeyDown}>
        {name !== undefined && <input type="hidden" name={name} value={current} />}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          maxLength={10}
          aria-required={required}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError || help !== undefined ? supportingTextId : undefined}
          data-changed={changed ? '' : undefined}
          value={displayDate(current)}
          onChange={(event) => change(parseTypedDate(event.target.value))}
          className={
            'peer h-14 w-full rounded-xs border border-outline bg-transparent pr-14 pl-4 text-body-large text-on-surface tabular-nums placeholder:text-on-surface-variant ' +
            'focus:border-2 focus:border-primary focus:outline-none data-changed:border-2 data-changed:border-primary aria-invalid:border-error aria-invalid:focus:border-error'
          }
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute inset-x-3 -top-2 z-10 flex text-body-small text-on-surface-variant peer-focus:text-primary peer-aria-invalid:text-error"
        >
          <span className="pointer-events-auto min-w-0 truncate bg-(--field-background) px-1">
            {label}
            {required && ' (obligatorio)'}
          </span>
        </label>
        <div className="absolute top-1 right-1 z-20">
          <IconButton
            ref={pinButton}
            aria-label={`Elegir fecha de ${label}`}
            aria-haspopup="dialog"
            aria-expanded={modal ? dialog : dockedOpen}
            onClick={openPanel}
          >
            <Icon name="calendar" />
          </IconButton>
        </div>
        {!modal && dockedOpen && (
          <div
            id={panelId}
            role="dialog"
            aria-label={`Selector de fecha de ${label}`}
            className="absolute top-full left-0 z-30 mt-1 w-80 max-w-screen rounded-xl bg-surface-container-high p-3 shadow-level-2"
          >
            <Calendar
              label={label}
              min={min}
              selected={selected}
              initial={todayInLima()}
              onChoose={(date) => {
                change(toIsoDate(date));
                close();
              }}
            />
          </div>
        )}
      </div>
      {hasError ? (
        <p id={supportingTextId} className="flex items-start gap-1 px-4 text-body-small text-error">
          <Icon name="error" className="size-4" />
          <span>{error}</span>
        </p>
      ) : (
        help !== undefined && (
          <p id={supportingTextId} className="px-4 text-body-small text-on-surface-variant">
            {help}
          </p>
        )
      )}
      {modal && (
        <ModalDialog
          title={`Seleccionar fecha de ${label}`}
          open={dialog}
          onClose={() => setDialog(false)}
          actions={
            <>
              <Button onClick={() => setDialog(false)}>Cancelar</Button>
              <Button
                onClick={() => {
                  if (tentative !== null) change(toIsoDate(tentative));
                  setDialog(false);
                }}
              >
                Aceptar
              </Button>
            </>
          }
        >
          {dialog && <Calendar label={label} min={min} selected={tentative} initial={todayInLima()} onChoose={setTentative} />}
          <p className="mt-2 text-body-small text-on-surface-variant" aria-live="polite">
            {tentative === null ? 'Aún no elegiste un día.' : `Elegiste ${displayDate(toIsoDate(tentative))}.`}
          </p>
        </ModalDialog>
      )}
    </div>
  );
}
