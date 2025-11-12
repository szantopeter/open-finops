// Lightweight local ESLint config used for pre-push to avoid building the full
// TypeScript Program (which is memory heavy). This config intentionally omits
// `parserOptions.project` and only provides fast, syntax/style-focused rules.
module.exports = [
  {
    files: ["**/*.ts"],
    languageOptions: {
      // Provide the parser module object so ESLint can call parseForESLint
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
        // Intentionally do NOT set `project` here — this keeps eslint non-type-aware
      }
    },
    // Provide plugin module objects where necessary
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin')
    },
    rules: {
      // Basic style/safety rules that are cheap to run
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
      indent: ['error', 2],
      'comma-dangle': ['error', 'never'],
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always'],
      'no-multi-spaces': 'error'
    }
  }
];
