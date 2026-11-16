/**
 * ESLint v10, configuración plana (ADR-0109 §2.12): typescript-eslint en modo estricto con
 * información de tipos, reglas de hooks de React y accesibilidad estática (jsx-a11y). Es el
 * analizador de `nodejs` declarado en DECISIONS.md (D-024) y lo invoca `scripts/verify-local.sh`.
 * El análisis estático no acredita la accesibilidad (ADR-0110 §2.8): se complementa con axe en
 * Playwright y con pruebas manuales.
 */
import js from '@eslint/js';
import nx from '@nx/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/test-results/**', '**/playwright-report/**', '.nx/**'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  reactHooks.configs.flat.recommended,
  jsxA11y.flatConfigs.strict,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Umbrales propios de TypeScript (G-146): los de ADR-0056 D4 están pensados para métodos de C#.
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      // Contrato de dominio: `any` prohibido; `as` y los comentarios de supresión, justificados.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': 'allow-with-description', minimumDescriptionLength: 20 }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/array-type': ['error', { default: 'array-simple', readonly: 'array-simple' }],
      'no-console': ['error', { allow: ['error', 'warn'] }],
      eqeqeq: ['error', 'always'],
      'react-hooks/exhaustive-deps': 'error',
      'jsx-a11y/label-has-associated-control': ['error', { assert: 'either', depth: 3 }],
    },
  },
  {
    // Fronteras de módulo (D-026, D-044): MDM no importa la suite, y la suite
    // nunca importa un sistema; cada uno solo la API común (`scope:suite-api`) y lo compartido. El anfitrión
    // (`type:app`) compone todo.
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@nx': nx },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: false,
          allow: [],
          depConstraints: [
            { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['*'] },
            { sourceTag: 'scope:suite', onlyDependOnLibsWithTags: ['scope:suite', 'scope:suite-api', 'scope:shared'] },
            { sourceTag: 'scope:mdm', onlyDependOnLibsWithTags: ['scope:mdm', 'scope:suite-api', 'scope:shared'] },
            { sourceTag: 'scope:suite-api', onlyDependOnLibsWithTags: ['scope:suite-api', 'scope:shared'] },
            { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
          ],
        },
      ],
    },
  },
  {
    // Clean Architecture (D-025): las dependencias apuntan hacia dentro. El dominio no conoce ninguna otra capa
    // ni React; la aplicación no conoce la infraestructura ni la presentación; la presentación no conoce la
    // infraestructura (se la inyectan los proveedores que cablea la raíz de composición de cada lib).
    files: ['libs/*/src/domain/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: '(^|/)(application|infrastructure|presentation)/', message: 'El dominio no depende de otras capas (D-025).' },
            { regex: '^react(-dom)?($|/)', message: 'El dominio es TypeScript puro: sin React (D-025).' },
          ],
        },
      ],
    },
  },
  {
    files: ['libs/*/src/application/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ regex: '(^|/)(infrastructure|presentation)/', message: 'La aplicación no depende de la infraestructura ni de la presentación (D-025).' }] },
      ],
    },
  },
  {
    files: ['libs/*/src/presentation/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ regex: '(^|/)infrastructure/', message: 'La presentación recibe la infraestructura inyectada por la raíz de composición (D-025).' }] },
      ],
    },
  },
  {
    // En componentes, cada condicional de JSX cuenta: se admite un poco más (G-146).
    files: ['**/*.tsx'],
    rules: { complexity: ['error', 15] },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/testing/**', 'apps/sil-web/e2e/**'],
    rules: {
      // En las pruebas se admiten bucles de casos y objetos de aproximación.
      'max-params': 'off',
      complexity: 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['**/*.mjs', '**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // Scripts de línea de comandos: escribir en la consola es su salida.
    files: ['**/scripts/**'],
    rules: { 'no-console': 'off' },
  },
);
