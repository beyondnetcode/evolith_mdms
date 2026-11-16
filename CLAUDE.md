# Reglas del núcleo Organización — organizacion-unilog

Vinculantes en toda sesión de este repositorio, para agentes y humanos.

Este repositorio es un **satélite** de [`organizacion_arch`](https://github.com/organizacion-peru/organizacion_arch). No define el estándar: lo **consume**, versionado, desde el plugin `organizacion-core`. Los subagentes del plugin llevan sus reglas incrustadas; este archivo existe para que también la **sesión principal** las vea, porque el satélite no tiene `.harness/` ni el generador que las expondría de otro modo.

- Este repositorio **no contiene `.harness/`** (S-16). El estándar —reglas, scripts, subagentes— lo provee el plugin `organizacion-core`, no una copia local. No puedes editarlo desde aquí: un hook `PreToolUse` deniega la escritura y el CI la rechaza. Para cambiar una regla o añadir un validador, **propón el cambio en `organizacion_arch`** (ver [CONTRIBUTING.md](./CONTRIBUTING.md), sección «Contribuir al núcleo»).
- La evidencia precede a la afirmación (SD-05). Si no puedes enlazar la prueba, registra el pendiente en [`GAPS.md`](./GAPS.md) en vez de afirmarlo.
- Fail fast documental (SD-06): si un enlace relativo, un ancla o un bloque Mermaid no resuelve, falla la tarea y reporta la anomalía. No la asumas resuelta.
- Todo hallazgo — gap, oportunidad, riesgo o deuda — se registra en [`GAPS.md`](./GAPS.md) con su dimensión de madurez, criticidad y complejidad (SD-07).
- Toda la documentación se mantiene exclusivamente en español (SD-08). No generes pares bilingües ni archivos `.en.md`.
- Toda decisión técnica referencia un ADR **aceptado** de `organizacion_arch`. Si no existe, créalo allí primero (S-06). Nunca se resuelve inventando la decisión aquí.

## Dónde está la regulación completa

La regulación la provee el plugin. Desde una sesión de Claude Code, `${CLAUDE_PLUGIN_ROOT}` apunta a la versión instalada:

- [`${CLAUDE_PLUGIN_ROOT}/rules/global-rules.md`](${CLAUDE_PLUGIN_ROOT}/rules/global-rules.md)
- [`${CLAUDE_PLUGIN_ROOT}/rules/spec-driven-rules.md`](${CLAUDE_PLUGIN_ROOT}/rules/spec-driven-rules.md)
- [`${CLAUDE_PLUGIN_ROOT}/rules/agent-rulesets.md`](${CLAUDE_PLUGIN_ROOT}/rules/agent-rulesets.md)
- [`${CLAUDE_PLUGIN_ROOT}/rules/satellite-repo-rules.md`](${CLAUDE_PLUGIN_ROOT}/rules/satellite-repo-rules.md)
- [`${CLAUDE_PLUGIN_ROOT}/rules/terminology-glossary.md`](${CLAUDE_PLUGIN_ROOT}/rules/terminology-glossary.md)

La gobernanza viva de **este** satélite:

- [`DECISIONS.md`](./DECISIONS.md)
- [`GAPS.md`](./GAPS.md)
- [`MADUREZ.md`](./MADUREZ.md)
- [`CONTRIBUTING.md`](./CONTRIBUTING.md)

## Validadores disponibles

Los validadores viven en el plugin, no en este repositorio. Localiza la versión que el cliente declara instalada y ejecútalos desde la raíz del satélite:

```bash
# La copia instalada la declara el cliente en installed_plugins.json: se lee
# de ahí, no del número mayor del caché, que nunca se recoge (ADR-0169 §2.6).
ORG_CORE=$(node -e '
  const { resolve } = require("path");
  const registro = process.env.HOME + "/.claude/plugins/installed_plugins.json";
  let entradas = [];
  try { entradas = require(registro).plugins?.["organizacion-core@organizacion"] ?? []; } catch {}
  const aqui = process.cwd();
  const entrada = entradas.find((e) => e.projectPath && resolve(e.projectPath) === aqui)
    ?? entradas.find((e) => e.scope === "user")
    ?? entradas[0];
  if (!entrada?.installPath) {
    console.error("organizacion-core no está instalado; ejecuta: claude plugin enable organizacion-core@organizacion");
    process.exit(1);
  }
  console.log(entrada.installPath);
')

node "$ORG_CORE/scripts/validate-estructura-satelite.mjs"   # .harness/ no existe; taxonomía y base intactas
node "$ORG_CORE/scripts/validate-satellite-base.mjs"        # artefactos base del satélite
node "$ORG_CORE/scripts/validate-docs.mjs"                  # encoding, enlaces, trazabilidad
node "$ORG_CORE/scripts/validate-gaps.mjs" --fix            # registro de gaps (S-20)
node "$ORG_CORE/scripts/validate-madurez.mjs"              # medición de madurez (S-19)
node "$ORG_CORE/scripts/validate-correspondencia.mjs"      # cada casilla < 5 tiene su gap
node "$ORG_CORE/scripts/validate-trazabilidad.mjs"        # decisiones ↔ ADRs de organizacion_arch
node "$ORG_CORE/scripts/validate-triaje.mjs"             # el triaje de herencia no miente
```

Con Claude Code, el barrido completo en un paso: `/organizacion-core:validar-gobernanza`.

## El CLI `organizacion` (comodidad de operador, no puerta)

La interfaz humana del estándar tiene dos piezas (ADR-0236, `Aceptado`): la **porcelana del plugin** —`node "$ORG_CORE/scripts/organizacion.mjs" donde|version`, disponible desde `organizacion-core-1.91.0` sin instalar nada— y el **producto** [`organizacion-cli`](https://github.com/organizacion-peru/organizacion-cli), que añade `validar --perfil` y `puertas` con veredicto agregado (necesita plugin ≥ 1.94.0), `referencia`, `nuevo` e `init`; se instala con clon + `npm ci` + `npm run build` + `npm link` (ver su README). **Ninguna de las dos sustituye a las invocaciones de arriba**: son comodidad; las puertas siguen siendo los scripts cableados en el hook y el CI, y si el CLI desaparece ninguna deja de ejercerse.

---

<p align="center">
  <strong>© Organización S.A.</strong> · RUC 20100412447 · Operador Logístico Aduanero desde 1978
</p>
