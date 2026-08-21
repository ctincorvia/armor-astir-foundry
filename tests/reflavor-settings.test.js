import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MODULE_ID } from "../scripts/main.js";
import { registerReflavorSettings, applyStoredReflavor } from "../scripts/reflavor/reflavor-settings.js";
import { ReflavorConfig } from "../scripts/reflavor/reflavor-config.js";
import { ALL_MOVES } from "../scripts/moves/all-moves.js";
import { resetToBaseline } from "../scripts/reflavor/reflavor-apply.js";

const findMove = (key) => ALL_MOVES.find((move) => move.key === key);

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	resetToBaseline();
});

describe("registerReflavorSettings", () => {
	it("registers the world-scoped, GM-only-configurable reflavorData setting", () => {
		registerReflavorSettings();

		expect(game.settings.register).toHaveBeenCalledWith(MODULE_ID, "reflavorData", {
			scope: "world",
			config: false,
			type: String,
			default: ""
		});
	});

	it("registers the restricted Reflavor menu pointing at ReflavorConfig", () => {
		registerReflavorSettings();

		expect(game.settings.registerMenu).toHaveBeenCalledWith(MODULE_ID, "reflavorMenu", {
			name: "Reflavor",
			label: "Configure Reflavor",
			hint: "Upload a JSON file to reskin move/equipment names and descriptions.",
			icon: "fas fa-masks-theater",
			type: ReflavorConfig,
			restricted: true
		});
	});
});

describe("applyStoredReflavor", () => {
	it("does nothing when the stored setting is empty", () => {
		vi.spyOn(game.settings, "get").mockReturnValue("");

		applyStoredReflavor();

		expect(findMove("exchange-blows").name).toBe("Exchange Blows");
	});

	it("applies a valid stored reflavor", () => {
		vi.spyOn(game.settings, "get").mockReturnValue(JSON.stringify({
			moves: { "exchange-blows": { name: "Trade Fire" } }
		}));

		applyStoredReflavor();

		expect(findMove("exchange-blows").name).toBe("Trade Fire");
	});

	it("logs a warning and does not throw for a stored value that fails validation", () => {
		vi.spyOn(game.settings, "get").mockReturnValue("{ not valid json");
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		expect(() => applyStoredReflavor()).not.toThrow();

		expect(warnSpy).toHaveBeenCalled();
		expect(findMove("exchange-blows").name).toBe("Exchange Blows");
	});
});
