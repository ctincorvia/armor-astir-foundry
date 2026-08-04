import { registerPlaybookActorSheet, registerMoveChatListeners } from "./playbook/playbook-actor-sheet.js";
import { registerPlaybookActorCreation } from "./actor-creation.js";
import { registerCarrierActorSheet } from "./world-actors/carrier-actor-sheet.js";
import { registerAuthorityActorSheet } from "./world-actors/authority-actor-sheet.js";
import { registerCauseActorSheet } from "./world-actors/cause-actor-sheet.js";

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
