import { registerPlaybookActorSheet, registerMoveChatListeners } from "./playbook/playbook-actor-sheet.js";
import { registerPlaybookActorCreation } from "./actor-creation.js";
import { registerCarrierActorSheet } from "./world-actors/carrier-actor-sheet.js";
import { registerAuthorityActorSheet } from "./world-actors/authority-actor-sheet.js";
import { registerCauseActorSheet } from "./world-actors/cause-actor-sheet.js";
import { registerNpcActorSheet } from "./world-actors/npc-actor-sheet.js";
import { registerReflavorSettings, applyStoredReflavor } from "./reflavor/reflavor-settings.js";
import { MODULE_ID } from "./module-id.js";

// Re-exported so every pre-existing importer of MODULE_ID from this file keeps working — the
// constant itself lives in its own leaf module so scripts/reflavor/ (the only other code that
// needs it) can import it without an upward dependency back onto this bootstrap file.
export { MODULE_ID };

export const PLAYBOOK_SHEET_PARTIALS = [
	"modules/armor-astir/templates/playbook-sheet/header.hbs",
	"modules/armor-astir/templates/playbook-sheet/status-row.hbs",
	"modules/armor-astir/templates/playbook-sheet/dangers-column.hbs",
	"modules/armor-astir/templates/playbook-sheet/tab-moves.hbs",
	"modules/armor-astir/templates/playbook-sheet/tab-equipment.hbs",
	"modules/armor-astir/templates/playbook-sheet/tab-astir.hbs",
	"modules/armor-astir/templates/playbook-sheet/ardents.hbs",
	"modules/armor-astir/templates/playbook-sheet/tab-social.hbs",
	"modules/armor-astir/templates/playbook-sheet/tab-advancement.hbs",
	"modules/armor-astir/templates/playbook-sheet/tab-downtime.hbs",
	"modules/armor-astir/templates/playbook-sheet/tab-cosmetic.hbs",
	"modules/armor-astir/templates/shared/equipment-card.hbs",
	"modules/armor-astir/templates/shared/notched-slider.hbs"
];

export const AUTHORITY_SHEET_PARTIALS = [
	"modules/armor-astir/templates/authority-sheet/stability.hbs",
	"modules/armor-astir/templates/authority-sheet/divisions.hbs",
	"modules/armor-astir/templates/authority-sheet/pillars.hbs",
	"modules/armor-astir/templates/authority-sheet/assets.hbs",
	"modules/armor-astir/templates/authority-sheet/notable-actors.hbs"
];

export const CAUSE_SHEET_PARTIALS = [
	"modules/armor-astir/templates/cause-sheet/faction-card.hbs"
];

export function registerInitHook() {
	Hooks.once("init", () => {
		console.log(`${MODULE_ID} | Initialized`);
		loadTemplates([...PLAYBOOK_SHEET_PARTIALS, ...AUTHORITY_SHEET_PARTIALS, ...CAUSE_SHEET_PARTIALS]);
		registerReflavorSettings();
	});
}

// Applies the stored reflavor (if any) once actor/collection data is available — settings must be
// registered (init, above) before they can be read, and every catalog needs to be reflavored before
// the first sheet renders. See docs/domains/reflavor.md.
export function registerReadyHook() {
	Hooks.once("ready", () => {
		applyStoredReflavor();
	});
}

registerInitHook();
registerReadyHook();
registerPlaybookActorSheet();
registerPlaybookActorCreation();
registerMoveChatListeners();
registerCarrierActorSheet();
registerAuthorityActorSheet();
registerCauseActorSheet();
registerNpcActorSheet();
