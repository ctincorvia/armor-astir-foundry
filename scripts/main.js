import { registerPlaybookActorSheet, registerMoveChatListeners } from "./playbook-actor-sheet.js";
import { registerPlaybookActorCreation } from "./actor-creation.js";
import { registerCarrierActorSheet } from "./carrier-actor-sheet.js";
import { registerAuthorityActorSheet } from "./authority-actor-sheet.js";
import { registerCauseActorSheet } from "./cause-actor-sheet.js";

export const MODULE_ID = "armor-astir";

export function registerInitHook() {
	Hooks.once("init", () => {
		console.log(`${MODULE_ID} | Initialized`);
	});
}

registerInitHook();
registerPlaybookActorSheet();
registerPlaybookActorCreation();
registerMoveChatListeners();
registerCarrierActorSheet();
registerAuthorityActorSheet();
registerCauseActorSheet();
