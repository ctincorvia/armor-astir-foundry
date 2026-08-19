import { registerPlaybookActorSheet, registerMoveChatListeners } from "./playbook/playbook-actor-sheet.js";
import { registerPlaybookActorCreation } from "./actor-creation.js";
import { registerCarrierActorSheet } from "./world-actors/carrier-actor-sheet.js";
import { registerAuthorityActorSheet } from "./world-actors/authority-actor-sheet.js";
import { registerCauseActorSheet } from "./world-actors/cause-actor-sheet.js";
import { registerNpcActorSheet } from "./world-actors/npc-actor-sheet.js";

export const MODULE_ID = "armor-astir";

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

export function registerInitHook() {
	Hooks.once("init", () => {
		console.log(`${MODULE_ID} | Initialized`);
		loadTemplates([...PLAYBOOK_SHEET_PARTIALS, ...AUTHORITY_SHEET_PARTIALS]);
	});
}

registerInitHook();
registerPlaybookActorSheet();
registerPlaybookActorCreation();
registerMoveChatListeners();
registerCarrierActorSheet();
registerAuthorityActorSheet();
registerCauseActorSheet();
registerNpcActorSheet();
