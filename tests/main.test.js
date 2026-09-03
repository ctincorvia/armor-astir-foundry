import { afterEach, describe, expect, it, vi } from "vitest";
import {
	MODULE_ID,
	PLAYBOOK_SHEET_PARTIALS,
	AUTHORITY_SHEET_PARTIALS,
	CAUSE_SHEET_PARTIALS,
	registerInitHook,
	registerReadyHook
} from "../scripts/main.js";
import { ALL_MOVES } from "../scripts/moves/all-moves.js";
import { EQUIPMENT_CATALOG } from "../scripts/equipment/equipment.js";
import { resetToBaseline } from "../scripts/reflavor/reflavor-apply.js";
import { resetCustomContent } from "../scripts/custom-content/custom-content-apply.js";

const findMove = (key) => ALL_MOVES.find((move) => move.key === key);
const findEquipment = (key) => EQUIPMENT_CATALOG.find((item) => item.key === key);

afterEach(() => {
	resetToBaseline();
	resetCustomContent();
});

describe("registerInitHook", () => {
	it("registers an init hook", () => {
		registerInitHook();

		expect(Hooks.once).toHaveBeenCalledWith("init", expect.any(Function));
	});

	it("logs the module id when the hook fires", () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		registerInitHook();
		const callback = Hooks.once.mock.calls.at(-1)[1];
		callback();

		expect(logSpy).toHaveBeenCalledWith(`${MODULE_ID} | Initialized`);
		logSpy.mockRestore();
	});

	it("preloads the playbook, authority, and cause sheet partials when the hook fires", () => {
		registerInitHook();
		const callback = Hooks.once.mock.calls.at(-1)[1];
		callback();

		expect(loadTemplates).toHaveBeenCalledWith([...PLAYBOOK_SHEET_PARTIALS, ...AUTHORITY_SHEET_PARTIALS, ...CAUSE_SHEET_PARTIALS]);
		expect([...PLAYBOOK_SHEET_PARTIALS, ...AUTHORITY_SHEET_PARTIALS, ...CAUSE_SHEET_PARTIALS]).toHaveLength(20);
	});

	it("registers the reflavor world setting and GM-only menu when the hook fires", () => {
		registerInitHook();
		const callback = Hooks.once.mock.calls.at(-1)[1];
		callback();

		expect(game.settings.register).toHaveBeenCalledWith(MODULE_ID, "reflavorData", expect.any(Object));
		expect(game.settings.registerMenu).toHaveBeenCalledWith(MODULE_ID, "reflavorMenu", expect.any(Object));
	});
});

describe("registerReadyHook", () => {
	it("registers a ready hook", () => {
		registerReadyHook();

		expect(Hooks.once).toHaveBeenCalledWith("ready", expect.any(Function));
	});

	it("applies the stored reflavor when the hook fires", () => {
		const getSpy = vi.spyOn(game.settings, "get").mockReturnValue("");

		registerReadyHook();
		const callback = Hooks.once.mock.calls.at(-1)[1];

		expect(() => callback()).not.toThrow();
		expect(getSpy).toHaveBeenCalled();
	});

	it("applies both stored reflavor overrides and stored custom content additions when the hook fires", () => {
		vi.spyOn(game.settings, "get").mockReturnValue(JSON.stringify({
			moves: { "exchange-blows": { name: "Trade Fire" } },
			additions: { equipment: [{ key: "custom:ready-hook-gear", name: "Ready Hook Gear", kind: "gear", description: "..." }] }
		}));

		registerReadyHook();
		const callback = Hooks.once.mock.calls.at(-1)[1];
		callback();

		expect(findMove("exchange-blows").name).toBe("Trade Fire");
		expect(findEquipment("custom:ready-hook-gear")).toMatchObject({ name: "Ready Hook Gear" });
	});
});
