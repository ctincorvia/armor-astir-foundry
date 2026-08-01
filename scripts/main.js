import { registerPlaybookActorSheet, registerMoveChatListeners } from "./playbook-actor-sheet.js";
import { registerPlaybookActorCreation } from "./actor-creation.js";

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
