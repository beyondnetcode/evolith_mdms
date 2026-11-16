#!/usr/bin/env bash
# =============================================================================
# coverage-dotnet.sh — cobertura de la capa de negocio (Domain + Application) de una app .NET.
#
# Misma convención que organizacion-ums: coverlet CLI (instrumentación estática, compatible con
# macOS/arm64) + ReportGenerator para el informe combinado. Sirve a toda app de src/apps
# con una solución <Prefijo>.slnx y proyectos <Prefijo>.Domain(.Test) y <Prefijo>.Application(.Test).
#
# Uso:
#   scripts/coverage-dotnet.sh src/apps/<app>         Ejecuta pruebas y genera el informe HTML
#   scripts/coverage-dotnet.sh src/apps/<app> --ci    Igual, y falla si la cobertura de líneas < UMBRAL (80 %)
#
# Herramientas: src/dotnet-tools.json (dotnet tool restore). Salida: src/apps/<app>/coverage/report/index.html
# =============================================================================
set -euo pipefail

[ $# -ge 1 ] || { echo "uso: $0 <dir-de-la-app> [--ci]" >&2; exit 2; }
APP_DIR="$(cd "$1" && pwd)"
shift
SLN="$(find "$APP_DIR" -maxdepth 1 -name '*.slnx' | head -1)"
[ -n "$SLN" ] || { echo "✘ sin solución .slnx en $APP_DIR" >&2; exit 1; }
PREFIJO="$(basename "$SLN" .slnx)"   # p. ej. Organización.Sil
COVERAGE_DIR="$APP_DIR/coverage"
REPORT_DIR="$COVERAGE_DIR/report"
UMBRAL=80
CI_MODE=false
for arg in "$@"; do [[ "$arg" == "--ci" ]] && CI_MODE=true; done

cd "$APP_DIR"   # dotnet tool run busca el manifiesto hacia arriba: src/dotnet-tools.json
dotnet tool restore >/dev/null
rm -rf "$COVERAGE_DIR" && mkdir -p "$COVERAGE_DIR"

cubrir() { # cubrir <Proyecto.Test> <salida> <include...>
  local proyecto="$1" salida="$2"; shift 2
  local csproj="$APP_DIR/$proyecto/$proyecto.csproj"
  local dll="$APP_DIR/$proyecto/bin/Release/net10.0/$proyecto.dll"
  local includes=()
  for i in "$@"; do includes+=(--include "$i"); done
  dotnet build "$csproj" --configuration Release --nologo -v q
  dotnet tool run coverlet "$dll" \
    --target dotnet \
    --targetargs "test --project \"$csproj\" --configuration Release --no-build" \
    --format cobertura \
    --output "$COVERAGE_DIR/$salida.cobertura.xml" \
    "${includes[@]}" \
    --verbosity Minimal
}

cubrir "$PREFIJO.Domain.Test"      domain      "[$PREFIJO.Domain]*"
cubrir "$PREFIJO.Application.Test" application "[$PREFIJO.Domain]*" "[$PREFIJO.Application]*"

dotnet tool run reportgenerator \
  "-reports:$COVERAGE_DIR/domain.cobertura.xml;$COVERAGE_DIR/application.cobertura.xml" \
  "-targetdir:$REPORT_DIR" \
  "-reporttypes:Html;Cobertura" \
  "-assemblyfilters:+$PREFIJO.Domain;+$PREFIJO.Application" \
  "-title:$PREFIJO — cobertura de la capa de negocio" >/dev/null

echo "Informe → $REPORT_DIR/index.html"

if $CI_MODE; then
  TASA=$(grep -oE 'line-rate="[0-9.]+"' "$REPORT_DIR/Cobertura.xml" | head -1 | grep -oE '[0-9.]+')
  PCT=$(awk -v t="$TASA" 'BEGIN { printf "%.1f", t * 100 }')
  if awk -v p="$PCT" -v u="$UMBRAL" 'BEGIN { exit !(p < u) }'; then
    echo "✘ $PREFIJO: cobertura combinada ${PCT} % < ${UMBRAL} %." >&2
    exit 1
  fi
  echo "✔ $PREFIJO: cobertura combinada ${PCT} % ≥ ${UMBRAL} %."
fi
