import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import globals from "globals";

export default [
	js.configs.recommended,
	{
		ignores: ["coverage/", "node_modules/"]
	},
	{
		files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
		plugins: {
			"@stylistic": stylistic
		},
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			globals: {
				...globals.browser,
				...globals.es2021
			}
		},
		rules: {
			"@stylistic/indent": ["warn", "tab", { SwitchCase: 1 }],
			"@stylistic/quotes": ["warn", "double", { avoidEscape: true }],
			"@stylistic/semi": ["warn", "always"],
			"@stylistic/comma-dangle": ["warn", "never"],
			"@stylistic/eol-last": ["error", "always"],
			"@stylistic/no-trailing-spaces": "warn",
			"@stylistic/no-multiple-empty-lines": ["warn", { max: 1 }],
			"@stylistic/object-curly-spacing": ["warn", "always"],
			"@stylistic/space-before-function-paren": [
				"warn",
				{ anonymous: "always", named: "never", asyncArrow: "always" }
			],
			"no-unused-vars": ["warn", { args: "none" }]
		}
	},
	{
		// renderTemplate/loadTemplates/readTextFromFile/saveDataToFile are deliberately absent here
		// (unlike the tests block below) — they must be imported from scripts/compat.js instead of
		// referenced as bare globals, so a missed call site fails no-undef rather than silently
		// working on v12 and breaking once v15 drops the bare-global fallback (see
		// docs/domains/compatibility.md).
		files: ["scripts/**/*.js"],
		languageOptions: {
			globals: {
				// Foundry VTT globals
				game: "readonly",
				Hooks: "readonly",
				CONFIG: "readonly",
				CONST: "readonly",
				ui: "readonly",
				canvas: "readonly",
				foundry: "readonly",
				Application: "readonly",
				FormApplication: "readonly",
				ActorSheet: "readonly",
				Actor: "readonly",
				Actors: "readonly",
				Roll: "readonly",
				ChatMessage: "readonly",
				Dialog: "readonly"
			}
		}
	},
	{
		files: ["tests/**/*.js"],
		languageOptions: {
			globals: {
				...globals.node,
				// Foundry VTT globals — the full v12 list, including the four template/file-IO
				// globals the scripts/**/*.js block above deliberately excludes: tests legitimately
				// reference the bare-global stubs tests/setup.js installs.
				game: "readonly",
				Hooks: "readonly",
				CONFIG: "readonly",
				CONST: "readonly",
				ui: "readonly",
				canvas: "readonly",
				foundry: "readonly",
				Application: "readonly",
				FormApplication: "readonly",
				ActorSheet: "readonly",
				Actor: "readonly",
				Actors: "readonly",
				Item: "readonly",
				Roll: "readonly",
				ChatMessage: "readonly",
				Dialog: "readonly",
				loadTemplates: "readonly",
				renderTemplate: "readonly",
				mergeObject: "readonly",
				fromUuidSync: "readonly",
				readTextFromFile: "readonly",
				saveDataToFile: "readonly"
			}
		}
	},
	{
		files: ["tools/**/*.mjs"],
		languageOptions: {
			globals: {
				...globals.node
			}
		}
	}
];
