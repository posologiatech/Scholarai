import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // i18n: prefer the central dictionary (src/i18n/translations.ts + useLanguage().t())
      // over inline `locale === "pt" ? ... : ...` ternaries, which don't scale past pt/en.
      // Warn-only: thousands of pre-existing occurrences predate this rule and are being
      // migrated incrementally, not blocked on.
      "no-restricted-syntax": [
        "warn",
        {
          selector: "ConditionalExpression[test.type='BinaryExpression'][test.left.name=/^(locale|language)$/][test.right.value=/^(pt|en)$/]",
          message: "Avoid inline locale ternaries — add a key to src/i18n/translations.ts and use t() instead, so new languages don't require touching every component.",
        },
      ],
    },
  },
);
