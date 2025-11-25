// @ts-check
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");
const wkConfig = require("@wk/eslint-config");

module.exports = tseslint.config(
  {
    extends: [...wkConfig]
  },
  {
    ignores: ["dist/**", "node_modules/**", "**/coverage/**"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "tsconfig.json", // Specify the path to your TypeScript configuration
        createDefaultProgram: true, // Allow ESLint to create a default program if no project is found
      }
    },
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-case-declarations": "off",
      "no-prototype-builtins": "off",
      "require-jsdoc": "off",
      "max-lines-per-function": "off",
      "@angular-eslint/no-host-metadata-property": "off",
      "jsdoc/require-jsdoc": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@angular-eslint/prefer-inject": "off",
      "@typescript-eslint/no-empty-function": "off",
      "import/no-unresolved": "off",
      "complexity": "off",
      "no-constant-condition": "off",
    },
  },
  {
    files: ["**/*.html"],
    rules: {
      "@angular-eslint/template/label-has-associated-control": 0
    },
  },
  {
    files: ["**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off"
    },
  }
);
