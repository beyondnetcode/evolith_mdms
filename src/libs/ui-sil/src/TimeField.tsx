/* eslint-disable complexity -- campo con su selector de esfera: un solo componente por diseño */
import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Button, IconButton } from './Button.tsx';
import { ModalDialog } from './ModalDialog.tsx';
import { isValidTime, parseTypedTime } from './dates.ts';
import { Icon } from './Icon.tsx';
import { joinClasses } from './join-classes.ts';

interface TimeFieldProps {
  readonly label: string;
  readonly name?: string;
  /** `hh:mm` de 24 h, o el texto escrito si aún no es una hora válida. */
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  /** `hh:mm` mínima que ofrece la esfera (p. ej. la hora actual cuando la fecha es hoy); lo escrito lo revisa el validador. */
  readonly min?: string | undefined;
  readonly error?: string | undefined;
  readonly help?: string | undefined;
  readonly fieldId?: string;
  readonly changed?: boolean;
  readonly className?: string;
}

type View = 'hour' | 'minute';

/** Lo que se va eligiendo en el diálogo: la vista activa de la esfera y la hora y el minuto, si ya se eligieron. */
interface Draft {
  readonly view: View;
  readonly hour: number | null;
  readonly minute: number | null;
}

const EMPTY_DRAFT: Draft = { view: 'hour', hour: null, minute: null };
const TURN = 2 * Math.PI;
/** Radios de la esfera, en % del lado: anillo exterior (1-12 y los minutos) e interior (13-23 y 00). */
const OUTER = 40;
const INNER = 26;
/** Por debajo de esta distancia al centro (en %), el puntero elige en el anillo interior. */
const RING_LIMIT = 33;

const two = (n: number): string => String(n).padStart(2, '0');

/** Posición (0 = arriba, en sentido horario, de 0 a `of` − 1) en coordenadas de 0 a 100. */
function pointAt(position: number, of: number, radius: number): { readonly x: number; readonly y: number } {
  const angle = (position / of) * TURN;
  return { x: 50 + radius * Math.sin(angle), y: 50 - radius * Math.cos(angle) };
}

/** Convención de 24 h: anillo exterior 12, 1 … 11 (12 arriba); interior 00, 13 … 23 (00 arriba). */
function hourPoint(hour: number): { readonly x: number; readonly y: number; readonly inner: boolean } {
  const inner = hour === 0 || hour > 12;
  return { ...pointAt(hour % 12, 12, inner ? INNER : OUTER), inner };
}

interface Mark {
  readonly value: number;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly inner: boolean;
}

const HOUR_MARKS: readonly Mark[] = Array.from({ length: 24 }, (_, hour) => ({ value: hour, text: two(hour), ...hourPoint(hour) }));
const MINUTE_MARKS: readonly Mark[] = Array.from({ length: 12 }, (_, i) => ({ value: i * 5, text: two(i * 5), ...pointAt(i, 12, OUTER), inner: false }));

/** El valor bajo el puntero, o `null` si la esfera aún no tiene tamaño (no se ha pintado). */
function valueAtPointer(event: PointerEvent<HTMLDivElement>, view: View): number | null {
  const box = event.currentTarget.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return null;
  const dx = event.clientX - (box.left + box.width / 2);
  const dy = event.clientY - (box.top + box.height / 2);
  const angle = (Math.atan2(dx, -dy) + TURN) % TURN;
  if (view === 'minute') return Math.round((angle / TURN) * 60) % 60;
  const position = Math.round((angle / TURN) * 12) % 12;
  const distance = (Math.hypot(dx, dy) / (box.width / 2)) * 50;
  if (distance < RING_LIMIT) return position === 0 ? 0 : position + 12;
  return position === 0 ? 12 : position;
}

interface ClockDialProps {
  readonly view: View;
  readonly value: number | null;
  readonly isDisabled: (value: number) => boolean;
  readonly onPick: (value: number) => void;
  /** Fin del arrastre o `Intro`: de la hora se pasa a los minutos; en los minutos, se acepta. */
  readonly onDone: () => void;
  readonly describedBy: string;
}

/**
 * Esfera del selector de hora de M3. Es un `slider` operable entero con el teclado (flechas ±1, `RePág`/`AvPág`
 * ±5 en minutos y ±6 en horas, `Inicio`/`Fin`, `Intro` para seguir) y con el puntero: se toca o se arrastra a
 * cualquier valor. Los números son decorativos; el valor lo anuncia `aria-valuetext`.
 */
function ClockDial({ view, value, isDisabled, onPick, onDone, describedBy }: ClockDialProps) {
  const [dragging, setDragging] = useState(false);
  const size = view === 'hour' ? 24 : 60;
  const marks = view === 'hour' ? HOUR_MARKS : MINUTE_MARKS;
  const hand = value === null ? null : view === 'hour' ? hourPoint(value) : { ...pointAt(value, 60, OUTER), inner: false };

  function pick(event: PointerEvent<HTMLDivElement>): void {
    const next = valueAtPointer(event, view);
    if (next !== null && !isDisabled(next)) onPick(next);
  }

  /** El siguiente valor habilitado en la dirección del paso, dando la vuelta a la esfera. */
  function move(from: number, step: number): number | null {
    for (let i = 1; i <= size; i += 1) {
      const candidate = (((from + step * i) % size) + size) % size;
      if (!isDisabled(candidate)) return candidate;
    }
    return null;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (value !== null) onDone();
      return;
    }
    const big = view === 'hour' ? 6 : 5;
    const steps: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: big, PageDown: -big };
    let next: number | null;
    if (event.key === 'Home') next = move(-1, 1);
    else if (event.key === 'End') next = move(size, -1);
    else {
      const step = steps[event.key];
      if (step === undefined) return;
      next = move(value ?? (step > 0 ? -1 : 0), step);
    }
    event.preventDefault();
    if (next !== null) onPick(next);
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      data-autofocus=""
      aria-label={view === 'hour' ? 'Hora' : 'Minutos'}
      aria-describedby={describedBy}
      aria-valuemin={0}
      aria-valuemax={size - 1}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value === null ? 'Sin elegir' : `${two(value)} ${view === 'hour' ? 'horas' : 'minutos'}`}
      onPointerDown={(event) => {
        // Arrastrar fuera de la esfera sigue moviendo la aguja. jsdom no implementa la captura del puntero.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- no existe en todos los entornos (jsdom)
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDragging(true);
        pick(event);
      }}
      onPointerMove={(event) => {
        if (dragging) pick(event);
      }}
      onPointerUp={() => {
        if (!dragging) return;
        setDragging(false);
        if (value !== null) onDone();
      }}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={onKeyDown}
      className="relative size-64 shrink-0 cursor-pointer touch-none rounded-full bg-surface-container-highest select-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <svg aria-hidden="true" viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full">
        <circle cx={50} cy={50} r={1.5} className="fill-primary" />
        {hand !== null && (
          <>
            <line x1={50} y1={50} x2={hand.x} y2={hand.y} strokeWidth={0.8} className="stroke-primary" />
            <circle cx={hand.x} cy={hand.y} r={hand.inner ? 6 : 7.5} className="fill-primary" />
          </>
        )}
      </svg>
      {marks.map((mark) => (
        <span
          key={mark.value}
          aria-hidden="true"
          style={{ left: `${mark.x}%`, top: `${mark.y}%` }}
          className={joinClasses(
            'pointer-events-none absolute flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center tabular-nums',
            mark.inner ? 'text-body-medium' : 'text-body-large',
            mark.value === value ? 'text-on-primary' : isDisabled(mark.value) ? 'text-on-surface/38' : mark.inner ? 'text-on-surface-variant' : 'text-on-surface',
          )}
        >
          {mark.text}
        </span>
      ))}
    </div>
  );
}

function segmentClass(active: boolean): string {
  return joinClasses(
    'state-layer flex h-20 w-24 cursor-pointer items-center justify-center rounded-sm text-display-medium tabular-nums',
    active ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-on-surface',
  );
}

/**
 * Campo de hora con el selector de hora de M3 (UX-SIL-001 §3.6): se escribe en `hh:mm` de 24 h, o se abre un
 * diálogo con la esfera de reloj. Primero se elige la hora (anillo exterior 1-12, interior 13-23 y 00) y la
 * esfera pasa sola a los minutos (marcas cada 5; se puede tocar o arrastrar a cualquier minuto). La cabecera
 * `HH:MM` vuelve a la hora o a los minutos. La esfera es un `slider` operable con el teclado.
 */
export function TimeField({ label, name, value, defaultValue = '', onValueChange, min, error, help, fieldId, changed = false, className }: TimeFieldProps) {
  const autoId = useId();
  const id = fieldId ?? autoId;
  const supportingTextId = `${id}-apoyo`;
  const instructionsId = `${id}-instrucciones`;
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const hasError = error !== undefined && error !== '';
  const [minHour, minMinute] = min !== undefined && isValidTime(min) ? min.split(':').map(Number) : [];
  const hourDisabled = (hour: number): boolean => minHour !== undefined && hour < minHour;
  const minuteDisabled = (hour: number | null, minute: number): boolean =>
    minHour !== undefined && minMinute !== undefined && hour !== null && (hour < minHour || (hour === minHour && minute < minMinute));
  const complete = draft.hour !== null && draft.minute !== null && !hourDisabled(draft.hour) && !minuteDisabled(draft.hour, draft.minute);

  function change(nextValue: string): void {
    setInternal(nextValue);
    onValueChange?.(nextValue);
  }

  function openPanel(): void {
    const [h, m] = isValidTime(current) ? current.split(':').map(Number) : [];
    setDraft({ view: 'hour', hour: h ?? null, minute: m ?? null });
    setOpen(true);
  }

  function accept(): void {
    if (!complete) return;
    change(`${two(draft.hour)}:${two(draft.minute)}`);
    setOpen(false);
  }

  const pickHour = (hour: number): void =>
    // Un minuto que con la hora nueva queda antes del mínimo se descarta.
    setDraft((d) => ({ ...d, hour, minute: d.minute !== null && minuteDisabled(hour, d.minute) ? null : d.minute }));

  return (
    <div className={joinClasses('relative flex min-w-0 flex-col gap-1', className)}>
      <div className="relative">
        {name !== undefined && <input type="hidden" name={name} value={current} />}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="hh:mm"
          maxLength={5}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError || help !== undefined ? supportingTextId : undefined}
          data-changed={changed ? '' : undefined}
          value={current}
          onChange={(event) => change(parseTypedTime(event.target.value))}
          className={
            'peer h-14 w-full rounded-xs border border-outline bg-transparent pr-14 pl-4 text-body-large text-on-surface tabular-nums placeholder:text-on-surface-variant ' +
            'focus:border-2 focus:border-primary focus:outline-none data-changed:border-2 data-changed:border-primary aria-invalid:border-error aria-invalid:focus:border-error'
          }
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute inset-x-3 -top-2 z-10 flex text-body-small text-on-surface-variant peer-focus:text-primary peer-aria-invalid:text-error"
        >
          <span className="pointer-events-auto min-w-0 truncate bg-(--field-background) px-1">{label}</span>
        </label>
        <div className="absolute top-1 right-1 z-20">
          <IconButton aria-label={`Elegir hora de ${label}`} aria-haspopup="dialog" aria-expanded={open} onClick={openPanel}>
            <Icon name="schedule" />
          </IconButton>
        </div>
      </div>
      {hasError ? (
        <p id={supportingTextId} className="flex items-start gap-1 px-4 text-body-small text-error">
          <Icon name="error" className="size-4" />
          <span>{error}</span>
        </p>
      ) : (
        <p id={supportingTextId} className="px-4 text-body-small text-on-surface-variant">
          {help ?? 'Hora de Lima, de 00:00 a 23:59.'}
        </p>
      )}
      <ModalDialog
        title={`Seleccionar hora de ${label}`}
        open={open}
        onClose={() => setOpen(false)}
        actions={
          <>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              aria-disabled={!complete}
              onClick={(event) => {
                if (!complete) {
                  event.preventDefault();
                  return;
                }
                accept();
              }}
            >
              Aceptar
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-4">
          <div role="group" aria-label="Hora elegida, formato de 24 horas" className="flex items-center gap-1">
            <button
              type="button"
              aria-pressed={draft.view === 'hour'}
              aria-label={`Hora ${draft.hour === null ? 'sin elegir' : two(draft.hour)}`}
              onClick={() => setDraft((d) => ({ ...d, view: 'hour' }))}
              className={segmentClass(draft.view === 'hour')}
            >
              {draft.hour === null ? '--' : two(draft.hour)}
            </button>
            <span aria-hidden="true" className="text-display-medium">
              :
            </span>
            <button
              type="button"
              aria-pressed={draft.view === 'minute'}
              aria-label={`Minutos ${draft.minute === null ? 'sin elegir' : two(draft.minute)}`}
              onClick={() => setDraft((d) => ({ ...d, view: 'minute' }))}
              className={segmentClass(draft.view === 'minute')}
            >
              {draft.minute === null ? '--' : two(draft.minute)}
            </button>
          </div>
          {open && (
            <ClockDial
              view={draft.view}
              value={draft.view === 'hour' ? draft.hour : draft.minute}
              isDisabled={draft.view === 'hour' ? hourDisabled : (minute) => minuteDisabled(draft.hour, minute)}
              onPick={draft.view === 'hour' ? pickHour : (minute) => setDraft((d) => ({ ...d, minute }))}
              onDone={draft.view === 'hour' ? () => setDraft((d) => ({ ...d, view: 'minute' })) : accept}
              describedBy={instructionsId}
            />
          )}
          <p id={instructionsId} aria-live="polite" className="max-w-64 text-center text-body-small text-on-surface-variant">
            {draft.view === 'hour'
              ? 'Elige la hora: anillo exterior de 1 a 12, interior de 13 a 00. Con el teclado, flechas e Intro.'
              : 'Elige los minutos: toca o arrastra a cualquier minuto. Con el teclado, flechas e Intro para aceptar.'}
          </p>
        </div>
      </ModalDialog>
    </div>
  );
}
