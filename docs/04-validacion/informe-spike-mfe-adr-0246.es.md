# Informe del spike de des-riesgo de ADR-0246 — composición de la suite con Module Federation

> **Artefacto:** informe de spike (evidencia de D10 de ADR-0246)
> **Fase:** 4 — Validación y QA
> **Estado:** Borrador — evidencia del spike, sin efecto normativo
> **Fecha:** 2026-10-17 (primera ejecución, §1–§7) y 2026-10-17 (segunda ejecución de D10.3, §8)
> **Rama:** `spike/mfe-module-federation` (desde `develop` en `95ae407`); **no** se fusiona a `develop` mientras ADR-0246 no se acepte ([G-241](../../GAPS.md))
> **ADR evaluado:** ADR-0246 «Composición de la suite con microfrontends» (`Borrador`, rama local `feature/adr-composicion-suite-microfrontends` de `organizacion_arch`, sin publicar). No vincula (SD-03): este informe es la evidencia que su D10 exige **antes** de aceptarlo, no una decisión.
> **Autoría:** aarroyo (agente `organizacion-dev-frontend`)
>
> **Dónde está el código del spike (2026-10-24):** no está en `develop`. Module Federation espera un ADR aceptado ([D-026](../../DECISIONS.md#decisiones-locales)) y el spike no cumplió el criterio 9 ([G-245](../../GAPS.md)). El código se conserva en la etiqueta [`archivo/spike-mfe-module-federation`](https://github.com/organizacion-peru/organizacion-unilog/tree/archivo/spike-mfe-module-federation).

---

## 1. Resumen

| # | Criterio de salida (D10) | Resultado |
| :--- | :--- | :--- |
| 1 | `@module-federation/vite` construye anfitrión y remotes con Vite 8 y Nx 23, en desarrollo y producción | **Cumple** |
| 2 | Una sola instancia de React, Router, Query, sistema de diseño, tokens y contrato | **Cumple** |
| 3 | Enlace directo, atrás y adelante y cambio de sistema sin recarga completa | **Cumple** |
| 4 | Traspaso de D5.3 con cookie por sistema acotada por `Path` | **No evaluable**: no existe BFF ([G-124](../../GAPS.md)) |
| 5 | 404, tiempo agotado, excepción de render y contrato incompatible con respaldo, sin afectar al resto | **Cumple** |
| 6 | CSP estricta sin `unsafe-eval` ni `unsafe-inline` con el runtime de federación | **Cumple** |
| 7 | Integridad del punto de entrada verificable; remote alterado que no se ejecuta | **Cumple para el punto de entrada**, con una limitación: los demás chunks del remote no se verifican (§3.7) |
| 8 | Sin fugas de estilo, tema propagado, sin preflight duplicado | **Cumple** (duplicación de utilidades medida en §3.8) |
| 9 | LCP e INP ≤ +10 % y JavaScript transferido ≤ +15 % frente a la SPA única | **No cumple**: JavaScript +71,7 %; LCP +2,5 % sin limitación pero +63,2 % con red 4G y CPU × 4; INP igual |
| 10 | Volver a publicar el remote de prueba sin recompilar el anfitrión, cambiando solo el manifiesto | **Cumple** |

**Recomendación: ajustar ADR-0246 antes de aceptarlo** (§6). El mecanismo funciona con las versiones del stack y sin debilitar la seguridad del cliente, pero el presupuesto de rendimiento del criterio 9 no se cumple y el criterio 4 no se puede evaluar sin BFF. Por la regla de salida negativa de D10, ninguno de los dos justifica todavía retirarlo: el 9 tiene remedios identificados y el 4 depende de una pieza que no existe.

> **Segunda ejecución (§8).** Repetidos los criterios 9 y 7 tras los remedios de D10.5 (ADR-0246 v1.1.1): el **7 cumple** (los chunks internos los controla el almacén verificado en el borde) y el **9 sigue sin cumplirse** (JavaScript +41,2 % comprimido; LCP +36,2 % con red 4G y CPU × 4, +22,7 % con HTTP/2). §8.6 da las cifras para la elección (a), (b) o (c) de D10.3.

---

## 2. Qué se construyó

| Pieza | Qué es |
| :--- | :--- |
| `src/apps/suite-web` | **Anfitrión** (SCM): `@suite/shell` y `@suite/header`, lanzador, notificaciones, tema, 404 y «sin acceso». Lee el **manifiesto por entorno** (`/mfe-manifest.json`, mismo origen) y monta cada sistema bajo sus raíces de ruta, con frontera de error, `Suspense`, tiempo límite (`AbortSignal.timeout`), verificación SRI del punto de entrada, validación del `SystemModule` y respaldo con «Reintentar». No importa ningún sistema: lo impide la etiqueta Nx `scope:suite-host` en `@nx/enforce-module-boundaries` |
| `src/apps/sil-web` | **Remote de SIL**: expone `./Entry` (el `silModule` de `@sil/app` con la versión del contrato incrustada al compilar) y su CSS acotado. Conserva su **arranque autónomo** (`index.html`, D6.6) para desarrollo y E2E aislado |
| `src/apps/demo-remote` | **Remote de prueba** (segundo sistema, sigla `DT`, raíz `/deposito-temporal`, rol `Consulta`) con build y publicación propios por versión |
| `src/tools/federation` | Dependencias compartidas comunes, descriptor del remote, publicación **inmutable por versión** con huella `sha384` y composición del manifiesto |
| `src/apps/suite-web/edge` | **Borde local**: un solo origen para anfitrión, `/remotes/<sistema>/<versión>/` y manifiesto, con la CSP estricta como cabecera. Representa el borde de ADR-0152 (`Borrador`); no es de producción |
| `src/apps/suite-web/e2e` | Copia de la suite E2E de la SPA contra la composición y `composition.spec.ts` con los criterios |

Dependencias nuevas, fijadas exactas: `@module-federation/vite` **1.23.1** (publicada el 2026-10-02, quince días antes del spike; no hizo falta probar 1.23.2) y `@module-federation/runtime` **2.9.2** (su dependencia, declarada explícitamente porque el anfitrión la importa). `npm audit`: 0 vulnerabilidades; ninguno de los 11 paquetes añadidos tiene `install` ni `postinstall`.

Las URLs y el comportamiento para el usuario son los de la SPA única: `/acceso`, `/`, `/notificaciones`, `/solicitudes/**` y `/servicios-planificados`.

---

## 3. Criterios, uno por uno

### 3.1 Criterio 1 — Build con Vite 8 y Nx 23 · Cumple

- Vite 8.3.4 (Rolldown), Nx 23.3.0 y `@module-federation/vite` 1.23.1 construyen los tres proyectos (`npx nx run-many -t build -p suite-web sil-web demo-remote`).
- **Reproducible con `npm ci`:** tras `npm ci`, dos builds seguidos sin caché de Nx dan el mismo árbol (huella SHA-256 de cada `dist`): `suite-web` `8694033bfd1b59e4`, `sil-web` `2b1f666bf5279d06`, `demo-remote` `33dec4983a41e96c`.
- **Desarrollo:** `npm run dev:suite` levanta el anfitrión (4200) y los remotes con el servidor de desarrollo de Vite (4201 y 4202); la composición y los arranques autónomos funcionan (comprobado con navegador en las cuatro direcciones). No hace falta construir los remotes para desarrollar.
- Condiciones que el spike tuvo que resolver (§4): las librerías compartidas como espacios de trabajo npm con `peerDependencies`, y una caché de dependencias de Vite por aplicación.

### 3.2 Criterio 2 — Una sola instancia · Cumple

Prueba `composition.spec.ts` › «un solo renderizador de React, todos los compartidos servidos por el anfitrión y sin copias en la red», con SIL y DT montados en la misma página:

- **Un renderizador de React** registrado en el gancho de DevTools (`inject` llamado una vez).
- En el ámbito de compartidos de la federación (`__FEDERATION__.__SHARE__`), las instancias `suite`, `sil` y `dt` resuelven `react`, `react-dom`, `react-router`, `@tanstack/react-query`, `@sil/ui`, `@sil/ui-tokens`, `@suite/contracts` y `@suite/header` con **una sola versión, provista por `suite`**.
- **Red:** ningún archivo de `/remotes/` es una copia de respaldo (`__prebuild__`) de un compartido.

El spike encontró y corrigió dos formas reales de romper este criterio sin que el build avise (§4, problemas 1 y 2).

### 3.3 Criterio 3 — Navegación · Cumple

`composition.spec.ts` › «ruta profunda del remote, atrás y adelante, y paso SIL → suite → DT → SIL en el mismo documento»: entra directo a `/solicitudes/OP-CAL-26-000401/resumen`, va al lanzador, vuelve y avanza con el historial, pasa a DT y a su ruta profunda `/deposito-temporal/detalle`, y vuelve a SIL. Una marca puesta en `window` sobrevive y hay una sola entrada `navigation`: no hubo recarga. Además, «enlace directo a una ruta profunda del remote de prueba» y «sin perfil en el sistema no se descarga su remote» (sesión sin DT: «Sin acceso a DT» y ninguna petición a `/remotes/dt/`).

### 3.4 Criterio 4 — Sesión con cookie por sistema · No evaluable

No existe BFF: la sesión del prototipo es un mock en `sessionStorage` ([G-124](../../GAPS.md)). No se simula. Lo que el spike sí deja preparado: un solo origen (el borde ya enruta por prefijo y añadir `/api/<sistema>/` es una regla más) y CSP con `connect-src 'self'`. **Queda:** BFF de desarrollo por sistema que emita su cookie `HttpOnly; Secure; SameSite=Lax; Path=/api/<sistema>`; el 401 que provoca la navegación de nivel superior a `{bffBase}/auth/inicio?volver=…`; y la prueba de composición que compruebe que la cookie de SIL no viaja al BFF de DT y que el retorno vuelve a la ruta pedida. Requiere `bffBase` en el contrato, que el `SystemModule` del satélite aún no tiene.

### 3.5 Criterio 5 — Aislamiento de fallos · Cumple

Una prueba por fallo en `composition.spec.ts`, todas con el respaldo «Depósito Temporal no está disponible en este momento», «Reintentar», «Volver al portal» y código de correlación `MF-XXXXXXXX`; tras cada una, el lanzador y SIL siguen funcionando:

| Prueba | Cómo se provoca | Causa registrada |
| :--- | :--- | :--- |
| «punto de entrada con 404» | La red responde 404 al `remoteEntry.js` | `carga` |
| «tiempo agotado y «Reintentar» que vuelve a cargar» | Manifiesto con 1000 ms y entrada retrasada 3 s; al reintentar carga | `tiempo` |
| «excepción de render del remote» | `/deposito-temporal/fallo` lanza al renderizar | `render` |
| «contrato incompatible declarado por el módulo» | Remote compilado con el contrato 2.0.0 (publicado como `dt@2.0.0`) | `contrato` |
| «contrato incompatible declarado en el manifiesto: no se descarga nada» | `contractRange: ^2.0.0`; cero peticiones a `/remotes/dt/` | `contrato` |
| «sin manifiesto la suite sigue sin sistemas» | El manifiesto responde 503: lanzador operativo, rutas de sistema en 404 de la suite | — |

**Valor inicial del tiempo límite (D6.2):** 8000 ms por remote (campo `loadTimeoutMs` del manifiesto, configurable por entorno) y 5000 ms para el manifiesto.

### 3.6 Criterio 6 — CSP estricta · Cumple

El borde aplica `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`. Prueba «la cabecera no admite unsafe-inline ni unsafe-eval y la composición no produce violaciones»: recorre lanzador, ficha de SIL con el menú de cuenta y DT, sin ningún evento `securitypolicyviolation` ni mensaje de CSP en la consola. Las 511 pruebas E2E de la composición corren con esa cabecera.

Por qué funciona: con remotes `type: 'module'` el runtime carga el punto de entrada con `import()` nativo (`new Function` solo se usa si se define `FEDERATION_ALLOW_NEW_FUNCTION`), el anfitrión no inyecta script en línea en `index.html` y los remotes añaden su CSS con `<link rel="stylesheet">`, no con `<style>`.

### 3.7 Criterio 7 — Integridad · Cumple para el punto de entrada

Mecanismo: la publicación calcula `sha384` de `remoteEntry.js` y la deja en el manifiesto; antes de que la federación lo importe, el anfitrión lo precarga con `<link rel="modulepreload" integrity>`. Si la huella no coincide, el navegador rechaza el módulo y el anfitrión no llega a registrarlo. Sin huella en el manifiesto, fuera de desarrollo, no se carga. Además, el almacén es **inmutable por versión**: `publish-remote.mjs` se niega a republicar una versión con otro contenido.

Pruebas: «un punto de entrada alterado no se ejecuta» (se añade `globalThis.__remoteAlterado = true` al archivo servido: respaldo, causa `integridad` y la variable sigue sin definir), «el punto de entrada íntegro se descarga UNA vez» (lo que se verifica es lo que se ejecuta: el `import()` reutiliza el módulo precargado) y «sin huella en el manifiesto no se ejecuta».

**Limitación medida:** la huella cubre el punto de entrada, no los chunks que este importa. Con el chunk `DemoEntry-*.js` alterado en la red, el código añadido **se ejecuta** (prueba manual con Playwright, 2026-10-17). La protección de los chunks es indirecta: sus nombres llevan hash de contenido y el punto de entrada verificado fija esos nombres, de modo que alterarlos exige escribir en el almacén inmutable. Cubrirlos con SRI exigiría un mapa de integridad por archivo (y precargar todos los chunks) o mapas de importación con `integrity`, que con CSP estricta no se pueden insertar en línea. Se registra como hallazgo (§7).

### 3.8 Criterio 8 — Estilos · Cumple

Contrato aplicado (D7): el anfitrión es el único que emite preflight, la fuente y las variables de tokens (`theme(static)`, para que existan aunque el anfitrión no use la utilidad); cada remote emite solo utilidades, dentro de `@layer utilities` y de `@scope ([data-system='<remote>'])`, el contenedor con el que el anfitrión monta cada sistema. Por proximidad de ámbito, dentro de un sistema sus utilidades ganan a las del anfitrión sin depender del orden de carga, y fuera de él no aplican.

Pruebas:

- «los remotes no emiten preflight, fuentes ni tokens, y todas sus reglas van acotadas con @scope»: en las hojas de `/remotes/` hay 0 reglas de preflight, 0 `@font-face`, 0 definiciones de `--md-sys-*` y 0 reglas fuera de `@scope` (salvo la capa `properties` de Tailwind, ver hallazgo); el anfitrión tiene exactamente un preflight.
- «el CSS de los remotes no altera el lanzador de la suite»: los estilos computados de los 400 primeros elementos del lanzador son idénticos antes y después de cargar las hojas de SIL y DT.
- «el tema elegido en la cabecera de un sistema llega a los demás por las variables»: «Oscuro» elegido en el menú de cuenta dentro de SIL cambia el color del título de SIL y del de DT al valor de `--md-sys-color-on-surface` oscuro.

**Duplicación (D7.4)**, medida con `tools/federation/measure-first-access.mjs`: el CSS de SIL ocupa 32,9 kB (5,8 kB gzip), con 440 selectores de clase de los que 325 (74 %) ya emite el anfitrión; el de DT, 24,1 kB (4,6 kB gzip), con 306 selectores y 304 repetidos (99 %). La repetición es el coste del aislamiento: cada remote debe escanear también las librerías compartidas que pinta (`@sil/ui`, `@suite/header`), porque si no, dentro de su ámbito una utilidad base del remote ganaría a la variante (`medium:`) que solo emite el anfitrión. D10 no fija umbral para esta cifra.

### 3.9 Criterio 9 — Rendimiento · No cumple

**Método** (`tools/federation/measure-first-access.mjs`, laboratorio, no RUM): primer acceso a SIL abriendo `/solicitudes` con la sesión sembrada, cada corrida en un contexto nuevo con caché vacía, mediana de 5. La SPA de referencia es `apps/sil-web` construido en `develop` (`95ae407`) en un `git worktree`, servida por el mismo borde local. JavaScript = suma de `encodedBodySize` de los `.js` (el borde no comprime) y, aparte, esa suma comprimida con gzip 9. LCP = última entrada `largest-contentful-paint`. INP aproximado = mayor duración de las entradas `event` con `interactionId` en tres clics de pestañas (la API no registra menos de 16 ms). Dos perfiles: sin limitación, y red 9 Mbps / 40 ms con CPU × 4 por CDP.

| Perfil · aplicación | JS (sin comprimir) | JS (gzip estimado) | Archivos JS | LCP (ms) | INP aprox. (ms) |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Sin limitación · SPA única (`develop`) | 492,3 kB | 155,0 kB | 7 | 648 | ≤ 16 |
| Sin limitación · suite compuesta | 845,4 kB | 267,8 kB | 31 | 664 | ≤ 16 |
| 4G rápida + CPU × 4 · SPA única (`develop`) | 492,3 kB | 155,0 kB | 7 | 1164 | ≤ 16 |
| 4G rápida + CPU × 4 · suite compuesta | 845,4 kB | 267,8 kB | 31 | 1900 | ≤ 16 |

Diferencias: **JavaScript +71,7 %** (gzip +72,8 %) frente al umbral de +15 %; **LCP +2,5 %** sin limitación (dentro del +10 %) y **+63,2 %** con red y CPU limitadas; INP sin diferencia medible.

**Dónde está el sobrecoste** (anfitrión ≈ 700 kB frente a 492 kB de toda la SPA):

1. **Los compartidos no se podan.** Un `singleton` se publica entero porque un remote puede pedir cualquier export: `react-router` ocupa 198 kB en el anfitrión (incluye el código de servidor y RSC) y `@tanstack/react-query` 52 kB, frente a la versión podada de la SPA. Es el coste dominante.
2. **El runtime de federación** en el anfitrión: ~65 kB de runtime, ~20 kB de su propio `remoteEntry`, ~13 kB de arranque y mapas de compartidos, y ~21 kB del `remoteEntry` de cada remote.
3. **La cadena en serie** (HTML → anfitrión → manifiesto → punto de entrada → chunks del remote) es lo que convierte los bytes en LCP cuando la red es lenta.

**Lo que ya se aplicó:** el build de producción de cada remote no lleva copias de respaldo de los compartidos (`import: false`) ni su runtime (`experiments.externalRuntime`, el anfitrión publica el suyo): bajó la composición de 1006 kB a 845 kB. **Lo que se probó y no sirve:** la poda de compartidos `runtime-infer` en el anfitrión descarga la versión podada **y** la completa (941 kB). **Remedios no probados:** poda `server-calc` con un servicio de despliegue que una los exports usados por todos los remotes; precargar manifiesto y punto de entrada del sistema de la URL inicial para romper la cadena; y redefinir el criterio por lo que importa a la suite —el coste del **segundo** sistema, que en la composición es solo su código (pasar de SIL a DT descarga 41,1 kB de JavaScript y 24,1 kB de CSS), frente a la opción B, que vuelve a descargar React, Router y la cabecera en cada SPA—.

### 3.10 Criterio 10 — Republicar sin recompilar el anfitrión · Cumple

Prueba «el mismo anfitrión monta la 1.0.0 o la 1.1.0 según el manifiesto» (los recursos del anfitrión son idénticos en ambas cargas) y registro de dos despliegues reales del 2026-10-17, sin tocar `apps/suite-web/dist`:

```text
== Despliegue 1
anfitrión dist: 8694033bfd1b59e4
"entry": "/remotes/dt/1.0.0/remoteEntry.js"
Versión del remote: 1.0.0
== Despliegue 2: nueva versión del remote de prueba, sin tocar el anfitrión
Publicado dt@1.2.0 en dist-store/remotes/dt/1.2.0 (sha384-GNar/5bBzt1oGWqf3iTFrTkQ1ndcdfi2ncbQ0JPD9BvXH6VmdwdxLy20jJlCWdoM)
Manifiesto local → dist-store/manifests/local.json: sil@1.0.0, dt@1.2.0
anfitrión dist: 8694033bfd1b59e4
"entry": "/remotes/dt/1.2.0/remoteEntry.js"
Versión del remote: 1.2.0
== Reversión: solo el manifiesto
Manifiesto local → dist-store/manifests/local.json: sil@1.0.0, dt@1.0.0
Versión del remote: 1.0.0
== Republicar la misma versión con otro contenido
La versión dt@1.2.0 ya está publicada con otro contenido: publica una versión nueva.
exit 1
```

Los remotes se construyen con rutas relativas (`base: './'`): el mismo artefacto sirve desde cualquier versión del almacén y en cualquier entorno (D8.5).

---

## 4. Decisiones tomadas en el spike y problemas encontrados

**Decisiones** (del spike, no normativas; ADR-0246 las debería recoger o descartar):

1. **Manifiesto publicado aparte, compuesto con fragmentos de cada remote** (D9 dejaba abierto si se deriva del registro de sistemas lanzables). Cada build de remote emite `mf-system.json` (sigla, raíces, etiquetas de rol, rango de contrato); la publicación añade ruta, versión y huella; `compose-manifest.mjs` arma el manifiesto del entorno. El lanzador sigue saliendo del catálogo del portal (mock).
2. **El manifiesto lleva `routeRoots` y `roleLabels`**, además de lo que lista D9: sin ellos el anfitrión no puede enrutar ni nombrar perfiles sin descargar el remote. Al cargarlo, valida que el `SystemModule` declare las mismas raíces.
3. **La versión de contrato del remote se incrusta al compilar.** `@suite/contracts` es `singleton`: en ejecución su constante es la del anfitrión.
4. **Integridad por `modulepreload` con `integrity`** y reintento con otra URL (`?intento=n`), porque el navegador recuerda el módulo fallido toda la página.
5. **Build de remote sin respaldos ni runtime propio**; el arranque autónomo (D6.6) solo existe con `vite serve`. Servirlo en producción como contingencia (opción de D6.6) exigiría un segundo build: queda como hallazgo.
6. **CSS acotado con `@scope`** sobre `[data-system]` y tokens emitidos solo por el anfitrión con `theme(static)`.
7. **El remote de prueba es `DT`** (sigla existente en `SYSTEM_CODES`), sin cambiar el catálogo del mock: el lanzador sigue mostrando DT como «Aún no disponible» y al remote se llega por dirección. Así la suite E2E de la SPA pasa sin cambios.

**Problemas** (todos resueltos salvo indicación):

1. **Con alias de Vite no se comparte.** Las librerías del espacio de trabajo resueltas por alias saltan la federación (el plugin solo avisa en el build): cada remote llevaba su `@suite/header` y la cabecera de SIL no encontraba su contexto. Solución: espacios de trabajo npm (`workspaces`) con `package.json` y versión propios.
2. **Carrera de inicialización entre compartidos.** Sin `peerDependencies` en esos `package.json`, la federación no ordena su inicialización y `@sil/ui` leía `@sil/ui-tokens` sin inicializar: **25 de 64** arranques en paralelo fallaban en blanco. Con `peerDependencies`, 0 de 128. Ningún build ni prueba unitaria lo detecta; lo detectó la E2E (10 fallos intermitentes en la primera corrida).
3. Un `React.lazy` no puede resolver a otro `lazy` (error #306): el `Entry` del remote se envuelve en una función.
4. Dos servidores de desarrollo federados no pueden compartir `node_modules/.vite`: `cacheDir` por aplicación.
5. Rolldown fusiona chunks de forma que los envoltorios `loadShare` arrastraban código de otros compartidos (p. ej. React Query dentro del de `@sil/ui`); resuelto en los remotes con `import: false`, no en el anfitrión.
6. **Ritmo de publicación del plugin:** de 1.23.1 a 1.23.5 hubo cinco versiones en once días, casi todas con correcciones de compartición. Fijar la versión exacta es imprescindible y cada subida necesita la prueba de composición (pendiente, §7).
7. **Sin recarga en caliente entre federados** en desarrollo (`remoteHmr` desactivado): un cambio en un remote se ve recargando. Sin resolver.

---

## 5. Puertas de calidad y cómo reproducirlo

| Puerta | Comando (desde `src/`) | Resultado (2026-10-17) |
| :--- | :--- | :--- |
| Tipos, lint y unitarias | `npx nx run-many -t typecheck lint test` | 12 proyectos en verde; Vitest 56 archivos, **658 pruebas** |
| Builds | `npx nx run-many -t build -p suite-web sil-web demo-remote` | En verde, reproducible tras `npm ci` |
| E2E de composición | `npx nx run suite-web:e2e` | **511 pasan, 5 omitidas** (las 493 + 5 de la SPA y 18 de `composition.spec.ts`) |
| E2E aislado de SIL | `npx nx run sil-web:e2e` | **493 pasan, 5 omitidas** (línea base de la SPA: 493 y 5) |
| Auditoría de dependencias | `npm audit --omit=dev` | 0 vulnerabilidades |

Intermitencias observadas en las corridas finales, no reproducidas al repetir: una prueba unitaria bajo carga al correr `typecheck`, `lint` y `test` en paralelo (tres corridas siguientes en verde) y, en la primera corrida del E2E aislado tras `npm ci`, la de G-155 en `compact` (con la caché de Vite vacía, el servidor de desarrollo reoptimiza dependencias durante la prueba; la corrida completa siguiente dio 493 y 5, y la prueba repetida cinco veces pasa).

Puertos: anfitrión 4200 y remotes 4201 (SIL) y 4202 (DT) en desarrollo (`npm run dev:suite`); SIL autónomo en 4201 (`npm run dev:sil-web`); borde local 4300 (`npm run preview:suite`). Detalle en el [README del anfitrión](https://github.com/organizacion-peru/organizacion-unilog/blob/archivo/spike-mfe-module-federation/src/apps/suite-web/README.md).

---

## 6. Recomendación al Architecture Board

**Ajustar ADR-0246 y repetir el criterio 9 antes de aceptarlo.** Concretamente:

1. **Criterio 9:** aplicar y medir la poda `server-calc` de `react-router` y `@tanstack/react-query` y la precarga del sistema de la URL inicial; si aun así no baja del +15 %, el Board debería fijar el presupuesto sobre el coste del segundo sistema y sobre gzip, o asumir explícitamente el sobrecoste del primer acceso a cambio del despliegue independiente.
2. **Criterio 4:** condicionar la aceptación a un BFF de desarrollo de SIL ([G-124](../../GAPS.md)) y su prueba de cookie por `Path`.
3. **Enmiendas al texto:** D3 debe exigir que todo compartido sea un **paquete** con versión y `peerDependencies` (no un alias); D2, que el remote incruste la versión del contrato al compilar; D9, que el manifiesto lleve raíces y etiquetas de rol y que la integridad cubra los chunks o se declare el almacén inmutable como control; D7, el contenedor `[data-system]` y `@scope` como mecanismo y la duplicación medida; D6.6, que la contingencia autónoma en producción exige un build propio.

Mientras tanto, la rama del spike no se fusiona: `develop` sigue con la SPA modular de [D-026](../../DECISIONS.md#decisiones-locales).

---

## 7. Hallazgos para registrar en GAPS.md

No se editó [GAPS.md](../../GAPS.md) en el spike; estos son los hallazgos a registrar (SD-07):

| # | Hallazgo | Dimensión | Criticidad | Complejidad |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Criterio 9 no cumplido: +71,7 % de JavaScript y +63,2 % de LCP con red y CPU limitadas; remedios en §3.9 | SDLC-Validacion | Alta | Alta |
| 2 | Criterio 4 no evaluable sin BFF; depende de G-124 y de añadir `bffBase` al contrato | Arq-Seguridad | Alta | Alta |
| 3 | La SRI cubre solo el punto de entrada; un chunk alterado se ejecuta. Decidir mapa de integridad por archivo o almacén inmutable como control | Arq-Seguridad | Media | Media |
| 4 | Enmiendas a ADR-0246 (D2, D3, D6.6, D7, D9) que el spike evidencia (§6.3) | SDLC-Diseno | Media | Baja |
| 5 | Ritmo de publicación de `@module-federation/vite` (5 versiones en 11 días, correcciones de compartición): política de subida con prueba de composición obligatoria | Arq-Operacion | Media | Baja |
| 6 | Las librerías compartidas pasan a ser paquetes (`workspaces`, versión, `peerDependencies`); al separar repositorios habrá que publicarlas en un registro privado con su versión semántica | SDLC-Construccion | Media | Media |
| 7 | Sin manifiesto, las rutas de sistema muestran el 404 de la suite y no «<Sistema> no está disponible»: decidir con diseño | SDLC-Diseno | Baja | Baja |
| 8 | Sin recarga en caliente entre federados en desarrollo | SDLC-Construccion | Baja | Media |
| 9 | Tailwind emite en cada remote la capa `properties` con un selector universal (`*, ::before, ::after`) fuera de `@scope`; hoy es inocua (mismos valores iniciales) pero contradice D7.3 | SDLC-Diseno | Baja | Baja |
| 10 | El borde local es un sustituto del borde de ADR-0152 (`Borrador`); el enrutado por prefijo, la CSP y la caché inmutable deben pasar al borde real | Arq-Operacion | Media | Media |

---

## 8. Segunda ejecución (2026-10-17)

Repetición de D10.3 de ADR-0246 v1.1.1 (`Aceptado`, sin activar): **solo los criterios 9 y 7**, con los remedios de D10.5 aplicados en orden y medidos uno a uno, y el resto de criterios como regresión. Misma rama (`spike/mfe-module-federation`, con `develop` fusionado en `4b8619d`). Se ejecutó dentro del plazo confirmado (vence el 2026-11-06), antes incluso de la fecha de inicio prevista (2026-10-19).

### 8.1 Qué se aplicó

| # | Remedio | Cómo | Commit |
| :--- | :--- | :--- | :--- |
| R1 | Poda de compartidos calculada al desplegar | Cada build de remote declara en su fragmento (`sharedExports`) los exports de `react-router` y `@tanstack/react-query` que usa: análisis estático del grafo de módulos desde su `./Entry`, sin recorrer las librerías compartidas (`tools/federation/shared-usage.ts`). Al desplegar, `shared-union.mjs` une los de los remotes del entorno; el anfitrión se construye con esa unión más lo que usa él (`SUITE_SHARED_UNION`) y publica cada paquete con un módulo que solo reexporta esos nombres. Emite `shared-exports.json` y lo incrusta como constante | `424c2a7` |
| R2 | Precarga del sistema de la URL inicial | `index.html` precarga `/mfe-manifest.json` (`<link rel="preload" as="fetch">`, URL fija); el borde responde a una ruta de sistema con `Link: <entrada>; rel=modulepreload; integrity="sha384-…"`, derivado del manifiesto. Sin script en línea | `9489249` |
| R3 | Compresión en el borde | Brotli 11 (gzip 9 si el navegador no acepta `br`) para HTML, JS, CSS, JSON y SVG, comprimido una vez por archivo, como un CDN | `9489249` |
| O1 | Precarga de los chunks de arranque del remote | La publicación calcula el cierre estático del punto de entrada, de su módulo expuesto y de su `Entry` perezoso (no las rutas perezosas del sistema) y lo guarda en el libro del almacén; el borde lo anuncia con `Link` junto al punto de entrada | `48b3195` |
| O2 | Runtime sin _snapshot_ | `disableSnapshot: true` en el anfitrión: no usa remotes por `mf-manifest.json` | `48b3195` |
| O3 | HTTP/2 en el borde | Con certificado, el borde local habla HTTP/2 sobre TLS, como el borde real (ADR-0152); sin él, HTTP/1.1 como en el primer spike y en las E2E | `48b3195` |
| C7 | Chunks internos controlados por el almacén | La publicación registra la huella `sha384` de **cada** archivo en un libro fuera de la carpeta del remote (`dist-store/ledger/<remote>/<versión>.json`) y deja el almacén en solo lectura; el borde sirve un archivo de `/remotes/` solo si coincide con el libro, responde 404 a lo que no está en él y 405 a cualquier escritura | `28a5b17` |

**Lo que se probó y no se aplicó.** La poda `server-calc` del propio plugin exige un servicio de despliegue que reescriba el _snapshot_ de cada remote y, si el artefacto podado no cubre lo que pide un consumidor, **carga el paquete entero**: para un `singleton` eso son dos instancias de Router o Query en la página. Por eso R1 es un mecanismo propio que **rechaza** el remote en lugar de degradar. Podar `@sil/ui` con el mismo mecanismo no compensa: SIL usa casi toda su superficie. Partir el chunk del anfitrión (lanzador y notificaciones perezosos) ahorraría pocos kB comprimidos y añadiría un salto en cascada al primer acceso al lanzador.

### 8.2 Medidas por remedio

Método de D10.4 sin cambios: `tools/federation/measure-first-access.mjs` (ampliada para informar bytes transferidos y descomprimidos, coste de cambio de sistema y opción B), laboratorio, primer acceso a `/solicitudes` con sesión sembrada, contexto nuevo con caché vacía por corrida, **mediana de 5**. Referencia: `apps/sil-web` construido desde `develop` (`55eebd6`) en un `git worktree` aparte, servido por **el mismo borde** con los mismos parámetros que la composición en cada fila. «JS transferido» es `encodedBodySize`: sin compresión en el borde coincide con el descomprimido; con R3 es la cifra comprimida a la que se aplica el umbral (D10.4 punto 4). INP: la API no registra menos de 16 ms y todas las medianas quedan en ese suelo (≤ 16 ms en referencia y composición, sin diferencia medible).

| Paso (acumulado) | Borde | JS transferido SPA → suite | Δ JS | JS descomprimido Δ | LCP sin limitación SPA → suite (Δ) | LCP 4G + CPU × 4 SPA → suite (Δ) |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: |
| R0 — reproducción del primer spike | HTTP/1.1, sin compresión | 492,3 → 845,4 kB | +71,7 % | +71,7 % | 648 → 652 ms (+0,6 %) | 1172 → 1900 ms (+62,1 %) |
| + R1 poda | HTTP/1.1, sin compresión | 492,3 → 679,6 kB | **+38,0 %** | +38,0 % | 648 → 648 ms (0,0 %) | 1184 → 1804 ms (+52,4 %) |
| + R2 precarga del punto de entrada | HTTP/1.1, sin compresión | 492,3 → 679,6 kB | +38,0 % | +38,0 % | 644 → 668 ms (+3,7 %) | 1164 → 1720 ms (+47,8 %) |
| + R3 compresión Brotli | HTTP/1.1, Brotli | 135,1 → 191,9 kB | **+42,0 %** | +38,0 % | 648 → 648 ms (0,0 %) | 896 → 1400 ms (+56,3 %) |
| + O1 precarga de chunks | HTTP/1.1, Brotli | 135,1 → 191,9 kB | +42,0 % | +38,0 % | 624 → 644 ms (+3,2 %) | 900 → 1220 ms (+35,6 %) |
| + O2 runtime sin _snapshot_ | HTTP/1.1, Brotli | 135,1 → 190,8 kB | **+41,2 %** | +37,1 % | 648 → 668 ms (+3,1 %) | 896 → 1220 ms (**+36,2 %**) |
| + O3 borde HTTP/2 (ambas) | HTTP/2, Brotli | 135,1 → 190,8 kB | +41,2 % | +37,1 % | 652 → 668 ms (+2,5 %) | 900 → 1104 ms (**+22,7 %**) |

Umbrales de D10: JavaScript ≤ +15 % (comprimido) y LCP e INP ≤ +10 %, en los dos perfiles. La estimación gzip 9 de la herramienta, comparable con el primer spike, queda en +39,8 % en la última fila. El número de archivos JS del primer acceso no cambia (7 en la SPA, 31 en la suite).

**Contribución de cada remedio.** R1 es el único que recorta bytes de forma sustancial: `react-router` pasa de 197,7 a 39,1 kB en el anfitrión y React Query de 51,8 a 39,0 kB (−166 kB sin comprimir). R3 reduce los bytes de las dos aplicaciones, pero proporcionalmente más los de la SPA, por eso la diferencia relativa sube de +38,0 % a +42,0 %. R2 y O1 no cambian bytes: rompen la cadena en serie (el manifiesto, el punto de entrada y sus once chunks de arranque se piden con el HTML) y bajan el LCP limitado de +56,3 % a +35,6 %. O2 recorta 1,1 kB. O3 no es un remedio de la composición sino del banco de medida: con HTTP/1.1 los 31 archivos compiten por seis conexiones, y el borde real hablaría HTTP/2.

**Por qué el JavaScript no puede bajar del +15 % con este mecanismo.** En la última fila, el pegamento de la federación del primer acceso —runtime del anfitrión (16,1 kB comprimidos), su `remoteEntry` (7,0 kB), `hostInit`, mapas de compartidos, `pendingShares` y envoltorios `loadShare`, más el `remoteEntry` de SIL (6,3 kB) y sus envoltorios— suma **41,4 kB comprimidos**. El margen que permite el umbral es 20,3 kB (15 % de 135,1 kB). Aunque el resto de la composición pesara exactamente lo mismo que la SPA, quedaría en ≈ +30 %. Con `@module-federation/vite` 1.23.1 el criterio de JavaScript es inalcanzable sin cambiar de runtime.

**Reproducción.** Composición: `npx nx run suite-web:stage` y `node apps/suite-web/edge/edge-server.mjs [--compress none] [--preload none|entry|chunks] [--tls-cert … --tls-key …]`; referencia: el mismo borde con `--host-dist <dist de la SPA de develop> --manifest <inexistente>` en el puerto 4400; medida: `node tools/federation/measure-first-access.mjs --spa … --composed … --option-b … [--insecure]`. La fila R0 se tomó con `4b8619d`; R1 con `424c2a7`; el resto con el código final y los parámetros de borde de la tabla (para R1 + R2: `--compress none --preload entry` y el anfitrión sin `disableSnapshot`).

### 8.3 Criterio 9 · No cumple

| Perfil | JavaScript (umbral +15 %) | LCP (umbral +10 %) | INP (umbral +10 %) |
| :--- | :--- | :--- | :--- |
| Sin limitación | +41,2 % · **no cumple** | +3,1 % (HTTP/1.1) / +2,5 % (HTTP/2) · cumple | sin diferencia · cumple |
| 4G rápida + CPU × 4 (manda, D10.4) | +41,2 % · **no cumple** | +36,2 % (HTTP/1.1) / +22,7 % (HTTP/2) · **no cumple** | sin diferencia · cumple |

Los remedios de D10.5 reducen el sobrecoste a la mitad o más (JavaScript de +71,7 % a +41,2 %; LCP limitado de +62,1 % a +36,2 %, o +22,7 % con HTTP/2), pero no lo bajan de los umbrales. Rige la elección de D10.3 al vencer el plazo.

### 8.4 Criterio 7 · Cumple

| Amenaza | Control | Prueba (`composition.spec.ts`) | Resultado |
| :--- | :--- | :--- | :--- |
| Punto de entrada alterado (en el almacén o en la red) | SRI del manifiesto: `<link rel="modulepreload" integrity>` del anfitrión y `Link` del borde con `integrity` | «un punto de entrada alterado no se ejecuta» y «un punto de entrada alterado y precargado por el borde tampoco se ejecuta» | No se ejecuta; causa `integridad` |
| Chunk interno alterado en el almacén | Libro del almacén verificado por el borde (D9 seguridad 2, «almacén inmutable») | «un chunk alterado en el almacén no se sirve ni se ejecuta (almacén verificado en el borde)»: se reescribe `DemoEntry-*.js` de `dt@1.0.1` saltándose el solo lectura | El borde responde **500** a ese chunk y registra `[seguridad] almacen-alterado remote=dt version=1.0.1 archivo=…`; la variable inyectada no existe; respaldo de D6 y el resto de la suite sigue |
| Escritura o archivo ajeno a través del borde | Borde de solo lectura y libro como lista cerrada | «el borde no admite escrituras ni sirve archivos fuera del libro del almacén» | `PUT`/`DELETE` → 405; archivo o versión fuera del libro → 404 |
| Republicar una versión con otro contenido | Publicación de una sola escritura | Registro de §3.10 y `publish-remote.mjs` | Rechazado (exit 1) |

**Condiciones.** El control vive en el borde local y en un almacén local en solo lectura: en un entorno real lo debe imponer el **almacenamiento** (bloqueo de objetos de una sola escritura, con el libro en un dominio de escritura distinto del del remote) y el borde real debe verificar al llenar su caché. Eso es [G-254](../../GAPS.md) y G-530 del núcleo; mientras no se cierre, ADR-0246 no se activa (D9). Una alteración **después** del borde, en la red, no la detecta este control: la cubre TLS en el mismo origen. Se mantiene descartado el mapa de integridad por archivo en el navegador (D9): obligaría a precargar todos los chunks y a mapas de importación en línea.

### 8.5 Regresión de los demás criterios

| Criterio | Resultado | Evidencia |
| :--- | :--- | :--- |
| 1 · Build | Sin regresión | `npx nx run-many -t build -p suite-web sil-web demo-remote`: en verde. El anfitrión podado es reproducible: misma huella (`6c00c3b5c3c27842`) al reconstruirlo con la misma unión |
| 2 · Una instancia | Sin regresión | Prueba de §3.2 en verde con el anfitrión podado: `react-router` y React Query siguen con una sola versión, provista por `suite` |
| 3 · Navegación | Sin regresión, con un matiz | Pruebas de §3.3 en verde. «Sin perfil en el sistema no se descarga su remote» pasa a «**no se ejecuta**» en la navegación directa: el borde anuncia el punto de entrada y los chunks de arranque antes de que el anfitrión sepa si hay perfil. Llegando por la suite, sigue sin descargarse nada (prueba nueva) |
| 5 · Fallos | Sin regresión | Las seis pruebas de §3.5 en verde; «contrato incompatible declarado en el manifiesto» exige ahora «no se ejecuta», por la misma razón |
| 6 · CSP | Sin regresión | La cabecera no cambia; prueba nueva: el `index.html` solo tiene `<script src>` del mismo origen y la precarga del manifiesto es un `<link>` |
| 8 · Estilos | Sin regresión | Pruebas de §3.8 en verde; CSS de SIL 32,9 kB (5,0 kB Brotli) con 74 % de selectores repetidos, de DT 24,1 kB (3,9 kB Brotli) con 99 %: igual que en el primer spike |
| 10 · Republicar sin recompilar | Sin regresión | Registro de despliegue de §8.6 y prueba «republicar un remote que no amplía la unión monta con el mismo anfitrión» |
| 4 · Sesión | No evaluable | Igual que en §3.4 (D10.2) |

**R1 y D8.5.** Registro de despliegue (2026-10-17) con el anfitrión podado:

```text
== Entorno local: sil@1.0.0, dt@1.0.0 (anfitrión podado con su unión)
anfitrión dist: 6c00c3b5c3c27842
== Despliegue 1: dt@1.2.0, mismo código (no amplía la unión), sin tocar el anfitrión
Publicado dt@1.2.0 en dist-store/remotes/dt/1.2.0 (sha384-GNar/5bBzt1oGWqf3iTFrTkQ1ndcdfi2ncbQ0JPD9BvXH6VmdwdxLy20jJlCWdoM; 24 archivos en el libro)
Unión de exports compartidos → ../../../../../tmp/union-1.2.0.json: react-router 13, @tanstack/react-query 8
unión idéntica a la del anfitrión desplegado: no hay que republicarlo
Manifiesto local → dist-store/manifests/local.json: sil@1.0.0, dt@1.2.0
exit 0
anfitrión dist: 6c00c3b5c3c27842
== Despliegue 2: dt@1.3.0 usa react-router#useHref (amplía la unión)
El anfitrión desplegado no publica exports que piden los remotes; vuelve a publicarlo con la unión ampliada (shared-union.mjs):
- dt@1.3.0: react-router#useHref
exit 1
-- se republica el anfitrión con la unión ampliada
Unión de exports compartidos → dist-store/shared-union/local.json: react-router 14, @tanstack/react-query 8
anfitrión dist: 996bd5367ed5bce9
Manifiesto local → dist-store/manifests/local.json: sil@1.0.0, dt@1.3.0
exit 0
== Reversión del entorno al estado inicial
anfitrión dist: 6c00c3b5c3c27842
```

En el navegador, un remote que pide un export fuera de lo publicado no se monta (causa `contrato`, nada del remote se ejecuta) y tampoco uno que no declara sus exports cuando el anfitrión poda (falla cerrado): pruebas «un remote que usa un export compartido fuera de la unión no se monta ni se ejecuta» y «con el anfitrión podado, un remote que no declara sus exports compartidos no se monta», más las unitarias de `remote-loader.test.ts` y `federation.test.ts`.

### 8.6 Cifras para la elección de D10.3

Si el propietario no cambia el mecanismo, el criterio 9 no se cumplirá antes del 2026-11-06. Datos para elegir:

| Dato | Valor medido | Lectura |
| :--- | :--- | :--- |
| Sobrecoste del **primer** acceso a SIL, JavaScript | +55,7 kB comprimidos (135,1 → 190,8 kB, +41,2 %) | Suelo estructural ≈ 41,4 kB: el pegamento de la federación |
| Sobrecoste del primer acceso, LCP con 4G + CPU × 4 | +324 ms con HTTP/1.1 (896 → 1220 ms) y +204 ms con HTTP/2 (900 → 1104 ms) | Valores absolutos por debajo del objetivo de LCP < 2,5 s de ADR-0109 (P-FE-09), en laboratorio |
| Sobrecoste del primer acceso, sin limitación | LCP +2,5 % a +3,1 %; INP sin diferencia | Dentro del umbral |
| **Coste de pasar de SIL a DT dentro de la suite** | 13,2 kB de JS comprimido (41,1 kB sin comprimir) y 3,9 kB de CSS | Solo el código del segundo sistema |
| Coste del mismo paso con la **opción B** (DT como SPA propia: `apps/demo-remote` construido sin federación) | 92,8 kB de JS comprimido (340,6 kB sin comprimir) y 6,8 kB de CSS, más una recarga completa | Vuelve a descargar React, Router, Query, sistema de diseño y cabecera |
| Ahorro por cambio de sistema frente a la opción B | 79,6 kB de JS comprimido (−86 %) por cada sistema adicional visitado | El sobrecoste del primer acceso (+55,7 kB) se recupera en el **primer** cambio a otro sistema |

Para (a), un presupuesto sobre el coste del segundo sistema que el mecanismo cumple con holgura sería, por ejemplo, «el cambio a otro sistema no descarga más del 25 % del JavaScript que descargaría como SPA propia» (medido: 14 %), conservando para el primer acceso los objetivos absolutos de ADR-0109. Para (b), la cifra que se asumiría es **+41 % de JavaScript comprimido y +0,2 a +0,3 s de LCP** en el primer acceso con red 4G y CPU × 4. La elección y su registro en `DECISIONS.md` corresponden al propietario; este informe no la toma.

### 8.7 Puertas de calidad (2026-10-17)

| Puerta | Comando (desde `src/`) | Resultado |
| :--- | :--- | :--- |
| Tipos, lint y unitarias | `npx nx run-many -t typecheck lint test` | 12 proyectos en verde; Vitest 57 archivos, **664 pruebas** (6 nuevas). En la primera corrida falló por carga `AcceptancePage.test.tsx` de `sil-app` (no tocado); tres corridas aisladas y la corrida completa siguiente, en verde |
| Builds | `npx nx run-many -t build -p suite-web sil-web demo-remote` | En verde |
| E2E de composición | `npx nx run suite-web:e2e` | **523 pasan, 5 omitidas** (511 de la línea base + 12 nuevas de los criterios 7 y 9) |
| E2E aislado de SIL | `npx nx run sil-web:e2e` | **493 pasan, 5 omitidas** (línea base) |
| Auditoría de dependencias | `npm audit --omit=dev` | 0 vulnerabilidades; sin dependencias nuevas |

Los artefactos de build (`dist/`, `dist-store/` y los módulos podados generados en `node_modules/.federation-pruned/`) no se versionan.

### 8.8 Desviaciones respecto de D10.5

1. **R1 no usa el `server-calc` del plugin** sino un equivalente propio (§8.1): el del plugin degrada a cargar el paquete entero, que en un `singleton` rompe el criterio 2. Depende de un detalle interno de `@module-federation/vite` 1.23.1 (el módulo podado vive bajo `node_modules/<paquete>/` para que el plugin no lo convierta en un `loadShare` de sí mismo).
2. **R2 se amplió con O1**: además del punto de entrada, el borde precarga sus chunks de arranque. Ambos sin `integrity` en los chunks, que controla el almacén (§8.4).
3. **«No se descarga nada» pasa a «no se ejecuta»** en la navegación directa a un sistema sin perfil o con contrato o exports incompatibles: el borde no conoce el perfil (sin BFF, [G-124](../../GAPS.md)) ni lo que decidirá el anfitrión.
4. **Criterio 7 por verificación en el borde**, no en el navegador: es el control que D9 eligió (almacén inmutable), llevado a una verificación por archivo con un libro fuera de la carpeta del remote.
5. **HTTP/2 como medida adicional**: la tabla da las dos; la comparable con el primer spike es la de HTTP/1.1.

### 8.9 Hallazgos de la segunda ejecución

No se editó [GAPS.md](../../GAPS.md) en esta ejecución; estos son los hallazgos a registrar (SD-07):

| # | Hallazgo | Dimensión | Criticidad | Complejidad |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Criterio 9 sigue sin cumplirse tras R1–R3 y O1–O3 (JS +41,2 % comprimido; LCP limitado +36,2 % / +22,7 % con HTTP/2). El JS es inalcanzable con este runtime (pegamento ≈ 41,4 kB frente a un margen de 20,3 kB). Decisión (a)/(b)/(c) de D10.3 antes del 2026-11-06 (actualiza G-245) | SDLC-Validacion | Alta | Baja |
| 2 | Con la poda, el artefacto del anfitrión depende de la unión de exports del entorno: para promoverlo sin recompilar, la unión debe calcularse sobre todas las versiones vivas de todos los entornos, y un remote que la amplía exige publicar antes el anfitrión (expand). D8.5 debe recogerlo | Arq-Operacion | Media | Media |
| 3 | La precarga del borde descarga (sin ejecutar) el punto de entrada y los chunks de arranque de un sistema aunque el usuario no tenga perfil: contradice la letra de D9 «sin perfil no se descarga nada». Enmendar a «no se ejecuta» o condicionar la precarga a la sesión cuando exista BFF | SDLC-Diseno | Media | Baja |
| 4 | La poda R1 depende de un detalle interno de `@module-federation/vite` 1.23.1 y de un análisis estático de usos (`import * as` o `import()` de un paquete podable desactivan su poda); cada subida del plugin debe pasar la prueba de composición (refuerza G-249) | Arq-Operacion | Media | Baja |
| 5 | El control de chunks (criterio 7) está en el borde y el almacén locales: el borde real debe verificar contra el libro al llenar su caché y el almacenamiento debe ser de una sola escritura con el libro en otro dominio de escritura (G-254 local, G-530 del núcleo) | Arq-Seguridad | Media | Media |
| 6 | D10.4 no fija el protocolo del borde de medida: con HTTP/2 el LCP limitado pasa de +36,2 % a +22,7 %. Fijarlo (el del borde real) | SDLC-Validacion | Media | Baja |
| 7 | `tools/federation` no tiene objetivos propios de lint ni de tipos en Nx: sus `.ts` se comprueban solo a través de los `tsconfig` de las aplicaciones que los importan y `eslint tools/` falla | SDLC-Construccion | Baja | Baja |
| 8 | Prueba unitaria intermitente bajo carga (`AcceptancePage.test.tsx` de `sil-app`) al correr tipos, lint y pruebas en paralelo; ya observada en el primer spike | SDLC-Validacion | Baja | Baja |

---

<p align="center">
  <strong>© Organización S.A.</strong> · RUC 20100412447 · Operador Logístico Aduanero desde 1978
</p>
