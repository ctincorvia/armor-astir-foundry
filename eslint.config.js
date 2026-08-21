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
				...globals.es2021,
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
		files: ["tests/**/*.js"],
		languageOptions: {
			globals: {
				...globals.node
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
