/** Une clases condicionales sin dependencias: ignora los valores falsos. */
export function joinClasses(...classes: ReadonlyArray<string | false | null | undefined>): string {
  return classes.filter((sizeClass): sizeClass is string => typeof sizeClass === 'string' && sizeClass !== '').join(' ');
}
