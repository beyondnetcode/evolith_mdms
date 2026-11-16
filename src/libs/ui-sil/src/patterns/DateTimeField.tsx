import { useState } from 'react';
import { DateField } from '../DateField.tsx';
import { TimeField } from '../TimeField.tsx';
import { displayDate } from '../dates.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const isIsoDate = (value: string): boolean => ISO_DATE.test(value);

interface DateTimeFieldProps {
  /** Nombre del dato, para la leyenda del grupo: «Cut-off». */
  readonly title: string;
  readonly dateName: string;
  readonly timeName: string;
  readonly dateLabel: string;
  readonly timeLabel: string;
  /** Prefijo de los ids: el campo de fecha queda en `{prefijo}-{dateName}`, el de hora en `{prefijo}-{timeName}`. */
  readonly prefix: string;
  readonly date: string;
  readonly time: string;
  readonly dateError?: string | undefined;
  readonly timeError?: string | undefined;
  readonly help?: string | undefined;
  /**
   * Lo más temprano que ofrecen los selectores (p. ej. ahora, en Lima): el calendario no deja elegir días
   * anteriores a `date` y, si la fecha elegida es ese día, la esfera no deja elegir horas anteriores a `time`.
   * Lo escrito a mano se marca como error al momento, y el validador lo vuelve a revisar al enviar.
   *
   * Sin `time`, el mínimo es solo de fecha (modificar y reactivar: hoy menos siete días): la hora no se limita
   * y la fecha con que empieza el campo —la ya guardada— no se marca aunque sea anterior.
   */
  readonly min?: { readonly date: string; readonly time?: string } | undefined;
  /**
   * Lo más tarde que admite el campo (p. ej. el cut-off para el llenado): si la fecha y la hora elegidas, ya
   * completas, son posteriores, se marca `maxMessage` al momento. Con `max` incompleto no se revisa nada.
   */
  readonly max?: { readonly date: string; readonly time: string } | undefined;
  readonly maxMessage?: string | undefined;
  /** Avisa de cada cambio de fecha u hora, para que otro campo (p. ej. el llenado) use este como tope. */
  readonly onChange?: ((value: { readonly date: string; readonly time: string }) => void) | undefined;
  /** Texto de apoyo de la hora; por defecto, la zona horaria de la operación. */
  readonly timeHelp?: string;
}

type Min = DateTimeFieldProps['min'];

/**
 * Errores que se marcan al momento, sin esperar al envío: una fecha anterior al mínimo o, si la fecha es la del
 * mínimo, una hora anterior a la suya. Con un mínimo solo de fecha, la fecha con que empezó el campo no se marca.
 */
function liveErrors(min: Min, initialDate: string, chosenDate: string, chosenTime: string): { readonly minTime: string | undefined; readonly date: string | undefined; readonly time: string | undefined } {
  if (min === undefined) return { minTime: undefined, date: undefined, time: undefined };
  const dateOnly = min.time === undefined;
  const minTime = chosenDate === min.date ? min.time : undefined;
  const pastDate = isIsoDate(chosenDate) && chosenDate < min.date && !(dateOnly && chosenDate === initialDate);
  const pastTime = minTime !== undefined && TIME.test(chosenTime) && chosenTime < minTime;
  const dateMessage = dateOnly ? `No puede ser anterior al ${displayDate(min.date)}.` : 'No puede ser anterior a hoy.';
  return {
    minTime,
    date: pastDate ? dateMessage : undefined,
    time: pastTime ? `No puede ser anterior a la hora actual (${minTime}, hora de Lima).` : undefined,
  };
}

/** `true` si la fecha y la hora elegidas, ambas completas, son posteriores al tope. */
function afterMax(max: DateTimeFieldProps['max'], chosenDate: string, chosenTime: string): boolean {
  if (max === undefined || !isIsoDate(max.date) || !TIME.test(max.time)) return false;
  if (!isIsoDate(chosenDate) || !TIME.test(chosenTime)) return false;
  return `${chosenDate}T${chosenTime}` > `${max.date}T${max.time}`;
}

/**
 * Composición de M3 (D-021): fecha y hora de un mismo dato con el selector de fecha y el de hora lado a lado
 * (US-SIL-001: «Selector de fecha y hora»). Se informan las dos o ninguna; la hora es la de Lima (UTC-5).
 */
export function DateTimeField(props: DateTimeFieldProps) {
  const { title, dateName, timeName, dateLabel, timeLabel, prefix, date, time, dateError, timeError, help, min, max, maxMessage, onChange, timeHelp = 'Hora de Lima.' } = props;
  // La fecha elegida decide si la hora tiene mínimo: solo cuando es el primer día admitido.
  const [chosenDate, setChosenDate] = useState(date);
  const [chosenTime, setChosenTime] = useState(time);
  // Lo escrito a mano (o una hora elegida antes de cambiar la fecha a hoy) se marca al momento, sin esperar
  // al envío; el error del validador, si lo hay, tiene prioridad.
  const live = liveErrors(min, date, chosenDate, chosenTime);
  const { minTime } = live;
  const liveDateError = live.date ?? (afterMax(max, chosenDate, chosenTime) ? maxMessage : undefined);
  const liveTimeError = live.time;
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="sr-only">{title}</legend>
      <div className="grid grid-date-time gap-2">
        <DateField
          fieldId={`${prefix}-${dateName}`}
          name={dateName}
          value={chosenDate}
          onValueChange={(next) => {
            setChosenDate(next);
            onChange?.({ date: next, time: chosenTime });
          }}
          min={min?.date}
          label={dateLabel}
          error={dateError ?? liveDateError}
          help={help}
        />
        <TimeField
          fieldId={`${prefix}-${timeName}`}
          name={timeName}
          value={chosenTime}
          onValueChange={(next) => {
            setChosenTime(next);
            onChange?.({ date: chosenDate, time: next });
          }}
          min={minTime}
          label={timeLabel}
          error={timeError ?? liveTimeError}
          help={timeHelp}
        />
      </div>
    </fieldset>
  );
}
