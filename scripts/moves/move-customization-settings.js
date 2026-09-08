import { MODULE_ID } from "../module-id.js";
import { ENABLE_MOVE_CUSTOMIZATION_SETTING } from "./move-customization.js";

// GM-controlled world toggle for player-level move/part renaming — off by default, fully
// identical to today's behavior (see docs/domains/moves.md).
export function registerMoveCustomizationSettings() {
	game.settings.register(MODULE_ID, ENABLE_MOVE_CUSTOMIZATION_SETTING, {
		name: "Enable Player Level Move Customization",
		hint: "Lets players rename and rewrite the description of their own Playbook Moves and Astir Parts, without touching any mechanical field.",
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});
}
