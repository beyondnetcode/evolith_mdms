import { DEFAULT_TENANT_CODE, defaultTenantOf, safeReturnPath, type SignInTenant } from '@suite/contracts';
import { ActionMenu, InlineNotice, LoadingBar, Button, IconButton, ModalDialog, SelectField, TextField, Icon, useSnackbar, useDocumentTitle } from '@sil/ui';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { startTransition, useActionState, useEffect, useRef, useState, type RefObject, type SubmitEvent } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useSuite } from '../session/SuiteContext.tsx';
import { suiteQueries } from '../../application/suite-queries.ts';
import { useSuiteServices } from '../../application/suite-services.ts';
import { SignInFrame } from '../layout/SignInFrame.tsx';
import { SUITE_TEXTS } from '../suite-texts.ts';
import { SUITE_TITLE } from '../suite-title.ts';

/** El resultado del último envío: cada estado es una variante, no un puñado de banderas (ADR-0109 P-FE-01). */
type State =
  | { readonly type: 'initial' }
  | { readonly type: 'invalid'; readonly missingTenant: boolean; readonly missingUser: boolean; readonly missingPassword: boolean }
  | { readonly type: 'invalid-credentials' }
  | { readonly type: 'locked' }
  | { readonly type: 'ums-unavailable'; readonly correlation: string };

function SignInNotices({ state, onRetry }: { readonly state: State; readonly onRetry: () => void }) {
  switch (state.type) {
    case 'initial':
      return null;
    case 'invalid': {
      const count = Number(state.missingTenant) + Number(state.missingUser) + Number(state.missingPassword);
      return (
        <InlineNotice severity="error" announce title={`No se inició sesión. Corrige ${count} ${count === 1 ? 'campo' : 'campos'}:`}>
          <ul className="list-disc pl-5">
            {state.missingTenant && (
              <li>
                <a href={`#${TENANT_ID}`} onClick={(e) => goToField(e, TENANT_ID)} className="inline-flex min-h-12 items-center underline">
                  {SUITE_TEXTS.signIn.missingTenant}
                </a>
              </li>
            )}
            {state.missingUser && (
              <li>
                <a href={`#${USER_ID}`} onClick={(e) => goToField(e, USER_ID)} className="inline-flex min-h-12 items-center underline">
                  {SUITE_TEXTS.signIn.missingUser}
                </a>
              </li>
            )}
            {state.missingPassword && (
              <li>
                <a href={`#${PASSWORD_ID}`} onClick={(e) => goToField(e, PASSWORD_ID)} className="inline-flex min-h-12 items-center underline">
                  {SUITE_TEXTS.signIn.missingPassword}
                </a>
              </li>
            )}
          </ul>
        </InlineNotice>
      );
    }
    case 'invalid-credentials':
      return (
        <InlineNotice severity="error" announce>
          {SUITE_TEXTS.signIn.credentials}
        </InlineNotice>
      );
    case 'locked':
      return (
        <InlineNotice severity="error" announce>
          {SUITE_TEXTS.signIn.locked}
        </InlineNotice>
      );
    case 'ums-unavailable':
      return (
        <InlineNotice
          severity="error"
          announce
          actions={
            <Button variant="text-inherit" onClick={onRetry}>
              Reintentar
            </Button>
          }
        >
          No se puede verificar tu identidad. Intenta de nuevo en unos minutos. Si el problema continúa, comunica este código a soporte:{' '}
          {state.correlation}.
        </InlineNotice>
      );
  }
}

function SignInHeading({ title, expired }: { readonly title: RefObject<HTMLHeadingElement | null>; readonly expired: boolean }) {
  return (
    <>
      <div>
        <h1 ref={title} tabIndex={-1} className="text-title-large-emphasized outline-none medium:text-headline-small-emphasized">
          {SUITE_TEXTS.signIn.title}
        </h1>
        <p className="mt-1 text-body-medium text-on-surface-variant">{SUITE_TEXTS.signIn.supportText}</p>
      </div>
      {expired && (
        <InlineNotice severity="info" announce>
          {SUITE_TEXTS.signIn.expired}
        </InlineNotice>
      )}
    </>
  );
}

interface TestUsersProps {
  readonly tenant: string;
  readonly disabled: boolean;
  readonly onUse: (id: string) => void;
}

/**
 * «Usuarios de prueba» del inquilino elegido (D-029) en un menú de M3 con botón delineado (R-03): divulgación
 * progresiva, la lista no está en el DOM hasta abrir el menú. Cada inquilino tiene su variante de los casos de
 * prueba. Elegir uno rellena los campos. Es ANDAMIAJE del prototipo: no pasa al portal real (SU-59).
 */
function TestUsers({ tenant, disabled, onUse }: TestUsersProps) {
  const { testUsers } = useSuiteServices();
  const own = testUsers.filter((candidate) => candidate.tenant === tenant);
  return (
    <div className="flex flex-col items-start gap-2">
      {own.length === 0 ? (
        <p className="text-body-medium text-on-surface-variant">{SUITE_TEXTS.signIn.testUsersNeedTenant}</p>
      ) : (
        <ActionMenu
          label="Usuarios de prueba"
          triggerText="Usuarios de prueba"
          busy={disabled}
          items={own.map((candidate) => ({
            id: candidate.id,
            label: `Usar a ${candidate.name}`,
            description: candidate.description,
            onSelect: () => onUse(candidate.id),
          }))}
        />
      )}
      <p className="text-body-small text-on-surface-variant">{SUITE_TEXTS.signIn.prototype}</p>
    </div>
  );
}

/** «¿Necesitas ayuda para ingresar?» abre un diálogo básico con la frase del administrador de accesos (R-02). */
function SignInHelp() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button className="self-center" onClick={() => setIsOpen(true)}>
        {SUITE_TEXTS.signIn.helpButton}
      </Button>
      <ModalDialog
        title={SUITE_TEXTS.signIn.helpTitle}
        open={isOpen}
        onClose={() => setIsOpen(false)}
        actions={<Button onClick={() => setIsOpen(false)}>Entendido</Button>}
      >
        <p className="text-body-medium text-on-surface-variant">{SUITE_TEXTS.signIn.signInHelp}</p>
      </ModalDialog>
    </>
  );
}

const TENANT_ID = 'acceso-inquilino';
const USER_ID = 'acceso-usuario';
const PASSWORD_ID = 'acceso-clave';

function readText(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

/** Quién pidió salir, leído del estado de la navegación (frontera: no se confía en su forma). */
function readExit(state: unknown): 'user' | 'expired' | null {
  if (typeof state !== 'object' || state === null || !('exit' in state)) return null;
  return state.exit === 'user' || state.exit === 'expired' ? state.exit : null;
}

type SignIn = ReturnType<typeof useSuite>['signIn'];

/** Valida los campos y pide la sesión. Se conservan inquilino y usuario (WCAG 3.3.7); la contraseña se vacía por seguridad. */
async function processSubmit(data: FormData, signIn: SignIn, clearPassword: () => void): Promise<State> {
  const tenant = readText(data, 'tenant');
  const user = readText(data, 'user').trim();
  const password = readText(data, 'password');
  if (tenant === '' || user === '' || password === '')
    return { type: 'invalid', missingTenant: tenant === '', missingUser: user === '', missingPassword: password === '' };
  const result = await signIn(tenant, user, password);
  if (result.type === 'invalid-credentials' || result.type === 'locked') clearPassword();
  return result.type === 'ok' ? { type: 'initial' } : result;
}

/** El inquilino sale del estado, no del `<select>`: deshabilitado mientras carga la lista, no viajaría en el formulario. */
function sendForm(event: SubmitEvent<HTMLFormElement>, tenant: string, submit: (data: FormData) => void): void {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  data.set('tenant', tenant);
  startTransition(() => submit(data));
}

function goToField(event: { preventDefault: () => void }, id: string): void {
  event.preventDefault();
  document.getElementById(id)?.focus();
}

interface TenantFieldProps {
  readonly tenants: UseQueryResult<readonly SignInTenant[]>;
  readonly value: string;
  readonly onChoose: (code: string) => void;
  /** Los errores del último envío, o `null`. */
  readonly errors: Extract<State, { type: 'invalid' }> | null;
}

/**
 * Campo «Inquilino» (D-029): las opciones son la tabla de inquilinos que publica el gateway, con el nombre visible
 * y su código. Si la lista no carga, lo avisa con «Reintentar»; el inicio de sesión sigue pidiéndolo.
 */
function TenantField({ tenants, value, onChoose, errors }: TenantFieldProps) {
  return (
    <>
      {tenants.isError && (
        <InlineNotice
          severity="error"
          actions={
            <Button variant="text-inherit" onClick={() => void tenants.refetch()}>
              Reintentar
            </Button>
          }
        >
          {SUITE_TEXTS.signIn.tenantsUnavailable}
        </InlineNotice>
      )}
      <SelectField
        fieldId={TENANT_ID}
        name="tenant"
        label="Inquilino"
        required
        options={(tenants.data ?? []).map((t) => ({ id: t.code, name: `${t.name} (${t.code})` }))}
        emptyText={tenants.isPending ? 'Cargando inquilinos…' : 'Seleccionar'}
        value={value}
        onChange={(e) => onChoose(e.target.value)}
        disabled={tenants.isPending}
        error={errors?.missingTenant === true ? SUITE_TEXTS.signIn.missingTenant : undefined}
      />
    </>
  );
}

/**
 * La tabla de inquilinos y el elegido. Mientras la persona no elija, el de por defecto de la lista; mientras la
 * lista carga, ORG (ADR-0156 §2.8), para que enviar pronto no tropiece con un campo que aún no tiene opciones.
 */
function useTenantChoice() {
  const { gateway } = useSuite();
  const tenants = useQuery(suiteQueries.signInTenants(gateway));
  const [chosen, choose] = useState<string | null>(null);
  const fallback = tenants.data === undefined ? DEFAULT_TENANT_CODE : defaultTenantOf(tenants.data);
  return { tenants, tenant: chosen ?? fallback, choose };
}

/** S-01 — Inicio de sesión de la suite (mock): inquilino, usuario y contraseña (anexo A1 §2, D-029). */
export function SignInPage() {
  useDocumentTitle('Iniciar sesión', SUITE_TITLE);
  const { session, signIn, signOut } = useSuite();
  const { tenants, tenant, choose } = useTenantChoice();
  const { testPassword } = useSuiteServices();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { show } = useSnackbar();
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const notice = useRef<HTMLDivElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const [submitFocusRequest, setSubmitFocusRequest] = useState(0);

  const back = safeReturnPath(searchParams.get('volver'));
  const expired = searchParams.get('motivo') === 'expirada';
  // El cierre de sesión se ejecuta AQUÍ, no en quien lo pide: S-01 queda fuera de la guarda, que si no
  // redirigiría con su propio `volver` y perdería el aviso (carrera entre navegar y vaciar la sesión).
  const exit = readExit(location.state);
  const signedOut = exit === 'user';

  const [state, submit, pending] = useActionState(
    (_previous: State, data: FormData) => processSubmit(data, signIn, () => startTransition(() => setPassword(''))),
    { type: 'initial' },
  );

  // El foco inicial va al usuario, o al título si se llega con un aviso de sesión terminada; tras un
  // error, al aviso (WCAG 3.3.1). El DOM es un sistema externo.
  useEffect(() => {
    if (expired || signedOut) title.current?.focus({ preventScroll: true });
    else document.getElementById(USER_ID)?.focus({ preventScroll: true });
    // Solo al montar la pantalla: el foco no debe volver al usuario en cada cambio de estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- justificación: es un foco de entrada, no depende de los avisos.
  }, []);
  useEffect(() => {
    if (state.type !== 'initial') notice.current?.focus();
  }, [state]);
  // Tras «Usar a…» el foco va a «Iniciar sesión». Se mueve en un efecto, después de que el menú se cierre: al
  // cerrarse, el menú quita la inercia del resto de la página y devuelve el foco a su botón (P-UX-08).
  useEffect(() => {
    if (submitFocusRequest > 0) submitButton.current?.focus();
  }, [submitFocusRequest]);

  // Cerrar la sesión pedida desde la cabecera: se vacía, se anuncia «Cerraste sesión en la suite.» una
  // sola vez y se limpia del historial para que no reaparezca (WCAG 4.1.3).
  useEffect(() => {
    if (exit === null) return;
    signOut();
    if (exit === 'user') show({ text: SUITE_TEXTS.signedOut });
    void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [exit, signOut, show, navigate, location.pathname, location.search]);

  // Con sesión vigente se sale de S-01: a la dirección pedida válida o a S-02.
  if (session !== null && exit === null) return <Navigate to={back ?? '/'} replace />;

  const errors = state.type === 'invalid' ? state : null;

  return (
    <SignInFrame>
      <div className="flex flex-1 justify-center py-8 medium:py-12 expanded:items-center">
        <div className="relative flex w-full max-w-120 flex-col gap-6 overflow-hidden medium:rounded-md medium:border medium:border-outline-variant medium:p-8 expanded:max-w-100 expanded:border-0 expanded:p-0">
          {pending && (
            <div className="absolute inset-x-0 top-0">
              <LoadingBar subject="el inicio de sesión" />
            </div>
          )}
          <div role="status" className="sr-only">
            {pending ? 'Iniciando sesión' : ''}
          </div>
          <SignInHeading title={title} expired={expired} />

          <div ref={notice} tabIndex={-1} className="flex flex-col gap-3 outline-none">
            <SignInNotices state={state} onRetry={() => form.current?.requestSubmit()} />
          </div>

          {/* `onSubmit` y no `action`: React vacía el formulario tras una acción y el `<select>` controlado
              perdería el inquilino elegido. Los campos son controlados, así que no hay nada que vaciar. */}
          <form ref={form} onSubmit={(e) => sendForm(e, tenant, submit)} noValidate className="flex flex-col gap-6">
            <TenantField tenants={tenants} value={tenant} onChoose={choose} errors={errors} />
            <TextField
              fieldId={USER_ID}
              name="user"
              label="Usuario"
              required
              value={user}
              onChange={(e) => setUser(e.target.value)}
              readOnly={pending}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              error={errors?.missingUser === true ? SUITE_TEXTS.signIn.missingUser : undefined}
            />
            <TextField
              fieldId={PASSWORD_ID}
              name="password"
              label="Contraseña"
              required
              type={passwordVisible ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              readOnly={pending}
              autoComplete="current-password"
              error={errors?.missingPassword === true ? SUITE_TEXTS.signIn.missingPassword : undefined}
              finalAction={
                <IconButton
                  aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={passwordVisible}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                >
                  <Icon name={passwordVisible ? 'visibility_off' : 'visibility'} />
                </IconButton>
              }
            />
            <div className="flex flex-col gap-1">
              <Button
                ref={submitButton}
                type="submit"
                variant="filled"
                aria-disabled={pending}
                onClick={(e) => pending && e.preventDefault()}
              >
                {pending ? 'Iniciando sesión…' : 'Iniciar sesión'}
              </Button>
              <SignInHelp />
            </div>
          </form>

          <TestUsers
            tenant={tenant}
            disabled={pending}
            onUse={(id) => {
              setUser(id);
              setPassword(testPassword());
              setPasswordVisible(false);
              setSubmitFocusRequest((request) => request + 1);
            }}
          />
        </div>
      </div>
    </SignInFrame>
  );
}
