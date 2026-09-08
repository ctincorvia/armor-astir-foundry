import { beforeEach, describe, expect, it, vi } from "vitest";

import { MODULE_ID } from "../scripts/module-id.js";
import { registerMoveCustomizationSettings } from "../scripts/moves/move-customization-settings.js";
import { ENABLE_MOVE_CUSTOMIZATION_SETTING } from "../scripts/moves/move-customization.js";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("registerMoveCustomizationSettings", () => {
	it("registers the world-scoped, GM-configurable move customization setting, off by default", () => {
		registerMoveCustomizationSettings();

		expect(game.settings.register).toHaveBeenCalledWith(MODULE_ID, ENABLE_MOVE_CUSTOMIZATION_SETTING, {
			name: "Enable Player Level Move Customization",
			hint: "Lets players rename and rewrite the description of their own Playbook Moves and Astir Parts, without touching any mechanical field.",
			scope: "world",
			config: true,
			type: Boolean,
			default: false
		});
	});
});
