import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MODULE_ID } from "../scripts/main.js";
import { registerReflavorSettings, applyStoredReflavor } from "../scripts/reflavor/reflavor-settings.js";
import { ReflavorConfig } from "../scripts/reflavor/reflavor-config.js";
import { ALL_MOVES } from "../scripts/moves/all-moves.js";
import { EQUIPMENT_CATALOG } from "../scripts/equipment/equipment.js";
import { resetToBaseline } from "../scripts/reflavor/reflavor-apply.js";
import { resetCustomContent } from "../scripts/custom-content/custom-content-apply.js";

const findMove = (key) => ALL_MOVES.find((move) => move.key === key);
const findEquipment = (key) => EQUIPMENT_CATALOG.find((item) => item.key === key);

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	resetToBaseline();
	resetCustomContent();
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
			name: "Reflavor & Custom Content",
			label: "Configure Reflavor & Custom Content",
			hint: "Reskin move/equipment names and descriptions, or add brand-new custom moves, equipment, and Astir Parts/Weapons.",
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

	it("also applies a stored addition alongside a valid stored reflavor", () => {
		vi.spyOn(game.settings, "get").mockReturnValue(JSON.stringify({
			moves: { "exchange-blows": { name: "Trade Fire" } },
			additions: { equipment: [{ key: "custom:new-gear", name: "New Gear", kind: "gear", description: "..." }] }
		}));

		applyStoredReflavor();

		expect(findMove("exchange-blows").name).toBe("Trade Fire");
		expect(findEquipment("custom:new-gear")).toMatchObject({ name: "New Gear" });
	});

	it("still applies the reflavor overrides when the stored additions fail validation", () => {
		vi.spyOn(game.settings, "get").mockReturnValue(JSON.stringify({
			moves: { "exchange-blows": { name: "Trade Fire" } },
			additions: { equipment: [{ key: "not-namespaced", name: "X", kind: "gear", description: "..." }] }
		}));
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		expect(() => applyStoredReflavor()).not.toThrow();

		expect(warnSpy).toHaveBeenCalled();
		expect(findMove("exchange-blows").name).toBe("Trade Fire");
		expect(findEquipment("not-namespaced")).toBeUndefined();
	});
});
