import { useEffect, useState } from 'react';

/**
 * «Ahora» que se refresca cada `everyMs` (por defecto, 30 s): el reloj es un sistema externo y se lee en un
 * efecto, no en el render. Sirve a las marcas relativas («hoy 09:40», «actualizado hace 2 min»).
 */
export function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
