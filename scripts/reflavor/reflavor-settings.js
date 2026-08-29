import { MODULE_ID } from "../module-id.js";
import { ReflavorConfig } from "./reflavor-config.js";
import { applyReflavor, validateReflavor } from "./reflavor-apply.js";
import { applyCustomContent, validateCustomContent } from "../custom-content/custom-content-apply.js";

// The raw uploaded JSON text, persisted world-scoped (one reskin per campaign — see
// docs/domains/reflavor.md) and never exposed on the settings sheet directly (config: false) — the
// menu below is the only way to reach it.
export function registerReflavorSettings() {
	game.settings.register(MODULE_ID, "reflavorData", {
		scope: "world",
		config: false,
		type: String,
		default: ""
	});

	// restricted: true is what enforces GM-only — a non-GM player never sees this menu entry at
	// all, and FormApplication's own registerMenu plumbing refuses to even open ReflavorConfig for
	// them (see docs/domains/reflavor.md).
	game.settings.registerMenu(MODULE_ID, "reflavorMenu", {
		name: "Reflavor",
		label: "Configure Reflavor",
		hint: "Upload a JSON file to reskin move/equipment names and descriptions.",
		icon: "fas fa-masks-theater",
		type: ReflavorConfig,
		restricted: true
	});
}

// Applies whatever reflavor was last saved, called once from main.js's ready hook (after init has
// registered the setting above, and before the first sheet renders). A stored value that no longer
// validates (hand-edited, corrupted) is logged and skipped rather than blocking the rest of the
// module from loading.
export function applyStoredReflavor() {
	const stored = game.settings.get(MODULE_ID, "reflavorData");
	if (!stored) return;

	const { overrides, errors } = validateReflavor(stored);
	if (errors.length) {
		console.warn(`${MODULE_ID} | Stored reflavor data failed validation and was not applied.`, errors);
		return;
	}

	applyReflavor(overrides);

	// A sibling top-level key on the same stored JSON (see custom-content-schema.js) — validated and
	// applied independently of the overrides above, so a world with valid overrides but a corrupted
	// "additions" section still gets its reflavor applied rather than losing both to one bad section.
	const additions = overrides?.additions;
	const { errors: additionErrors } = validateCustomContent(additions);
	if (additionErrors.length) {
		console.warn(`${MODULE_ID} | Stored custom content failed validation and was not applied.`, additionErrors);
		return;
	}

	applyCustomContent(additions);
}
