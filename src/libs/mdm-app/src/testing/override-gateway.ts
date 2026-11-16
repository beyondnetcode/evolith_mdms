import type { MdmGateway } from '@mdm/contracts';

function isOverridden(overrides: Partial<MdmGateway>, property: string | symbol): property is keyof MdmGateway {
  return typeof property === 'string' && Object.hasOwn(overrides, property);
}

/**
 * Sustituye operaciones concretas del gateway en una prueba y deja el resto intactas. No sirve `{ ...base }`: el
 * mock es una clase y sus métodos viven en el prototipo, que la propagación no copia.
 */
export function overrideGateway(base: MdmGateway, overrides: Partial<MdmGateway>): MdmGateway {
  return new Proxy(base, {
    get: (target, property, receiver): unknown => (isOverridden(overrides, property) ? overrides[property] : Reflect.get(target, property, receiver)),
  });
}
