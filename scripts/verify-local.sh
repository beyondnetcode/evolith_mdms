#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Pipeline de calidad y SEGURIDAD LOCAL-FIRST de organizacion-unilog (MDM).
#
# Misma convención que organizacion-ums (D-018 allí, D-006 aquí; ADR-0106): todos los
# controles corren en la máquina del desarrollador. El CI de servidor solo corre
# los validadores del estándar (gobernanza.yml); build, pruebas, secretos y
# dependencias son LOCALES y estos gates son la verificación que bloquea.
#
# Uso:
#   scripts/verify-local.sh fast     # solución completa + build (rápido)
#   scripts/verify-local.sh prepush  # lo que corre .husky/pre-push (paso 9)
#   scripts/verify-local.sh full     # prepush + E2E de navegador (Playwright) del frontend
#   scripts/verify-local.sh <gate>   # uno: secrets|deps|solucion|build|tests-dotnet|coverage|node|e2e
#
# Requisitos locales: dotnet (SDK 10), node 24, gitleaks. Para el gate `e2e`: los navegadores de
# Playwright (`cd src && npx playwright install chromium`).
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
FAILED=0
WEB="src/apps/sil-web"

# Soluciones .NET: una por app, descubiertas como src/apps/<app>/*.slnx. Cada gate .NET las recorre
# todas una sola vez; una app nueva entra en las puertas sin tocar este script.
# Cada app declara el suelo de cada proyecto de prueba en src/apps/<app>/suelos-pruebas.txt.
SOLUCIONES=()
while IFS= read -r sln; do SOLUCIONES+=("$sln"); done < <(find src/apps -mindepth 2 -maxdepth 2 -name '*.slnx' | sort)

# Sin solución .NET no hay nada que compilar, probar ni medir: los gates .NET lo dicen y pasan
# en vacío, en vez de fallar por una ruta que no existe.
sin_solucion() {
  [ "${#SOLUCIONES[@]}" -gt 0 ] && return 1
  echo "  sin soluciones .NET en src/apps/*/*.slnx: se omite."
}

run() { # run <nombre> <cmd...>
  local name="$1"; shift
  printf '\n\033[1m▶ %s\033[0m\n' "$name"
  if "$@"; then printf '\033[32m[OK] %s\033[0m\n' "$name"; else printf '\033[31m[X] %s FALLO\033[0m\n' "$name"; FAILED=1; fi
}

# Ningún Directory.Build.targets ajeno al árbol puede redefinir la ejecución de
# pruebas desde el entorno (vector medido en organizacion-ums el 2026-09-07).
MSBUILD_SIN_GANCHOS="-p:ImportDirectoryBuildTargets=false -p:CustomBeforeDirectoryBuildTargets= -p:CustomAfterDirectoryBuildTargets="

# ── Gates individuales ───────────────────────────────────────────────────────

gate_secrets_full() {   # todo el árbol de trabajo; el rango empujado lo cubre el paso 9.a del hook
  command -v gitleaks >/dev/null || { echo "gitleaks no instalado (brew install gitleaks)"; return 1; }
  gitleaks dir . --no-banner --config .gitleaks.toml --redact
}

# El feed corporativo de NuGet (GitHub Packages) exige credencial (NuGet.Config, S-43: no se versiona).
# Si no viene por variable de entorno, se toma en memoria de la sesión de `gh`, que necesita el scope
# read:packages; nunca se escribe en disco ni se imprime.
credencial_nuget() {
  [ -n "${NuGetPackageSourceCredentials_shells:-}" ] && return 0
  command -v gh >/dev/null || return 0
  local usuario token
  usuario="$(gh api user --jq .login 2>/dev/null)" || return 0
  token="$(gh auth token 2>/dev/null)" || return 0
  [ -n "$usuario" ] && [ -n "$token" ] && export NuGetPackageSourceCredentials_shells="Username=${usuario};Password=${token}"
  return 0
}

gate_deps() {           # vulnerabilidades en dependencias NuGet (directas y transitivas) y npm
  local salida ok=0
  if sin_solucion; then
    :
  else
    credencial_nuget
    local sln
    for sln in "${SOLUCIONES[@]}"; do
      if ! salida="$(dotnet list "$sln" package --vulnerable --include-transitive 2>&1)"; then
        # Un fallo del comando (p. ej. 401 del feed) no es «sin vulnerables»: se muestra y bloquea.
        echo "$salida"; ok=1
      elif echo "$salida" | grep -qiE "has the following vulnerable packages|tiene los siguientes paquetes vulnerables"; then
        echo "$salida"; ok=1
      else
        echo "  NuGet ($(basename "$sln")): sin paquetes vulnerables."
      fi
    done
  fi
  ( cd src && npm audit --omit=dev --audit-level=high ) || ok=1
  return $ok
}

gate_solucion_completa() {   # ningún .csproj fuera de la solución de su app: lo que no está, ninguna puerta lo compila
  local fuera=0 sln app csproj nombre
  sin_solucion && return 0
  for sln in "${SOLUCIONES[@]}"; do
    app="$(dirname "$sln")"
    while IFS= read -r csproj; do
      nombre="$(basename "$csproj")"
      if ! grep -q "$nombre" "$sln"; then
        echo "  ✘ $nombre no está en $(basename "$sln"): ninguna puerta lo compila." >&2
        echo "    Añádelo con: dotnet sln $sln add $csproj" >&2
        fuera=$((fuera + 1))
      fi
    done < <(find "$app" -name '*.csproj' -not -path '*/bin/*' -not -path '*/obj/*')
  done
  [ "$fuera" -eq 0 ]
}

gate_build() {          # build .NET con SonarAnalyzer y TreatWarningsAsErrors (S-37)
  sin_solucion && return 0
  local sln
  for sln in "${SOLUCIONES[@]}"; do
    dotnet build "$sln" --nologo -v q || return 1
  done
}

_dotnet_test_mtp() { # _dotnet_test_mtp <csproj> <suelo>: dotnet test MTP con suelo de pruebas ejecutadas
  # .NET 10 ejecuta MTP de forma nativa: global.json fija `test.runner` y el modo VSTest ya no existe.
  # `env -u TESTINGPLATFORM_EXITCODE_IGNORE`: esa variable vuelve verde cualquier exit code.
  # El suelo viaja como argumento de la plataforma, no desde el entorno. Exit 8 = cero pruebas; 9 = bajo el suelo.
  local csproj="$1" suelo="$2" rc=0
  DOTNET_CLI_UI_LANGUAGE=en env -u TESTINGPLATFORM_EXITCODE_IGNORE \
    dotnet test --project "$csproj" \
      --minimum-expected-tests "$suelo" \
      $MSBUILD_SIN_GANCHOS \
    || rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "  ✘ $csproj: dotnet test falló (rc=$rc). Con «succeeded» y total < $suelo, el rojo es el SUELO; con «total: 0», no descubrió pruebas." >&2
  fi
  return "$rc"
}

gate_tests_dotnet() {   # unitarias + integración en proceso (WebApplicationFactory, sin Docker)
  sin_solucion && return 0
  # El suelo es el recuento medido; se revisa AL ALZA con el recuento, nunca a la baja sin ficha en GAPS.md.
  # Todo proyecto de prueba de la app debe tener suelo: uno sin declarar es una prueba que ninguna puerta corre.
  local sln app suelos csproj proyecto suelo
  for sln in "${SOLUCIONES[@]}"; do
    app="$(dirname "$sln")"; suelos="$app/suelos-pruebas.txt"
    [ -f "$suelos" ] || { echo "  ✘ falta $suelos" >&2; return 1; }
    # Se lista antes de ejecutar: dotnet test no debe heredar la lista por stdin.
    local proyectos=()
    while IFS= read -r csproj; do proyectos+=("$csproj"); done \
      < <(find "$app" -name '*Test.csproj' -not -path '*/bin/*' -not -path '*/obj/*' | sort)
    for csproj in "${proyectos[@]}"; do
      proyecto="$(basename "$csproj" .csproj)"
      suelo="$(awk -v p="$proyecto" '$1 == p { print $2 }' "$suelos")"
      [ -n "$suelo" ] || { echo "  ✘ $proyecto no declara suelo en $suelos" >&2; return 1; }
      _dotnet_test_mtp "$csproj" "$suelo" < /dev/null || return 1
    done
  done
}

gate_coverage() {       # coverage de líneas de Domain + Application, umbral 80 % (coverage-dotnet.sh)
  sin_solucion && return 0
  local sln
  for sln in "${SOLUCIONES[@]}"; do
    bash scripts/coverage-dotnet.sh "$(dirname "$sln")" --ci || return 1
  done
}

# Frontend y librerías Node (D-024, G-145): typecheck estricto, ESLint (typescript-eslint + react-hooks +
# jsx-a11y), pruebas de Vitest y build de producción, todo por Nx. Sin apps Node no hay nada que verificar.
sin_apps_node() {
  [ -d "$WEB" ] && return 1
  echo "  sin apps Node en src/apps: se omite."
}

instalar_node() {   # reproducible: `npm ci` contra el lockfile, sin scripts de instalación (ADR-0165 P-SEC-03)
  local lock="src/package-lock.json" marca="src/node_modules/.package-lock.json"
  if [ -f "$marca" ] && [ ! "$lock" -nt "$marca" ]; then return 0; fi
  ( cd src && npm ci --ignore-scripts )
}

gate_node() {
  sin_apps_node && return 0
  instalar_node || return 1
  # Los proyectos .NET (tag runtime:dotnet) tienen sus propios gates arriba: aquí no se repiten.
  ( cd src && npx nx run-many -t typecheck lint test build --exclude='tag:runtime:dotnet' --output-style=static )
}

gate_e2e() {        # flujos y axe en tres tamaños de ventana; levanta el servidor de desarrollo
  sin_apps_node && return 0
  instalar_node || return 1
  ( cd src && npx playwright test -c apps/sil-web/playwright.config.ts )
}

# ── Orquestación ─────────────────────────────────────────────────────────────
MODE="${1:-full}"
case "$MODE" in
  fast)
    run "solución completa"      gate_solucion_completa
    run "build .NET"             gate_build
    run "frontend (typecheck, lint, pruebas, build)" gate_node
    ;;
  prepush)
    run "secretos (árbol completo)" gate_secrets_full
    run "solución completa"         gate_solucion_completa
    run "dependencias/vulnerab."    gate_deps
    run "build .NET"                gate_build
    run "pruebas .NET"              gate_tests_dotnet
    run "coverage (≥ 80 %)"         gate_coverage
    run "frontend (typecheck, lint, pruebas, build)" gate_node
    ;;
  full)
    run "secretos (árbol completo)" gate_secrets_full
    run "solución completa"         gate_solucion_completa
    run "dependencias/vulnerab."    gate_deps
    run "build .NET"                gate_build
    run "pruebas .NET"              gate_tests_dotnet
    run "coverage"                  gate_coverage
    run "frontend (typecheck, lint, pruebas, build)" gate_node
    run "E2E de navegador (Playwright + axe)" gate_e2e
    ;;
  secrets)      run "secretos" gate_secrets_full ;;
  deps)         run "dependencias" gate_deps ;;
  solucion)     run "solución completa" gate_solucion_completa ;;
  build)        run "build .NET" gate_build ;;
  tests-dotnet) run "pruebas .NET" gate_tests_dotnet ;;
  coverage)     run "coverage" gate_coverage ;;
  node)         run "frontend (typecheck, lint, pruebas, build)" gate_node ;;
  e2e)          run "E2E de navegador (Playwright + axe)" gate_e2e ;;
  *) echo "modo desconocido: $MODE (fast|prepush|full|secrets|deps|solucion|build|tests-dotnet|coverage|node|e2e)"; exit 2 ;;
esac

if [ "$FAILED" -ne 0 ]; then
  printf '\n\033[31m✗ Gates locales con fallos.\033[0m\n'; exit 1
fi
printf '\n\033[32m✔ Todos los gates locales pasaron.\033[0m\n'
