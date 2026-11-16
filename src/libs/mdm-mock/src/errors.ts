import { MdmProblemError, type BadRequestCode, type ConflictCode, type MdmProblem, type UnprocessableCode } from '@mdm/contracts';

/*
 * Respuestas de error del mock con la forma exacta del contrato (Problem Details con `code`). El `instance`
 * hace de código de correlación, como lo hará el servidor.
 */

let sequence = 0;

function correlation(): string {
  sequence += 1;
  return `mock-mdm-${String(sequence).padStart(5, '0')}`;
}

/** Campos comunes de cada respuesta de error: sin detalle técnico y con su correlación. */
function common(title: string) {
  return { title, detail: null, instance: correlation(), errors: {} };
}

function raise(problem: MdmProblem): never {
  throw new MdmProblemError(problem, problem.instance ?? 'mock-mdm');
}

export function conflict(code: ConflictCode): never {
  return raise({ ...common('Conflicto con el estado actual'), status: 409, code });
}

export function unprocessable(code: UnprocessableCode): never {
  return raise({ ...common('Valor no admisible'), status: 422, code });
}

/** `400` `validation.failed` con un solo campo, el de la primera regla rota (contrato §2). */
export function invalid(field: string, rule: string): never {
  return raise({ ...common('Revisa los campos'), status: 400, code: 'validation.failed', errors: { [field]: [rule] } });
}

export function badRequest(code: Exclude<BadRequestCode, 'validation.failed'>): never {
  return raise({ ...common('Petición inválida'), status: 400, code });
}

export function notFound(): never {
  return raise({ ...common('No encontrado'), status: 404, code: 'common.not_found' });
}

export function schemaNotDeclared(): never {
  return raise({ ...common('Escalera territorial no declarada'), status: 404, code: 'geo.country.schema_not_declared' });
}

/** `403` reservado por el contrato (§8): el mock lo aplica con la matriz supuesta (`authorization.ts`). */
export function forbidden(): never {
  return raise({ ...common('Prohibido'), status: 403, code: 'auth.forbidden' });
}

export function preconditionFailed(): never {
  return raise({ ...common('La versión cambió'), status: 412, code: 'precondition.failed' });
}

export function serverError(): never {
  return raise({ ...common('Error inesperado'), status: 500, code: 'server.unexpected_error' });
}
