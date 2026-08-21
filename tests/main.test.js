import { describe, expect, it, vi } from "vitest";
import {
	MODULE_ID,
	PLAYBOOK_SHEET_PARTIALS,
	AUTHORITY_SHEET_PARTIALS,
	CAUSE_SHEET_PARTIALS,
	registerInitHook,
	registerReadyHook
} from "../scripts/main.js";

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
		expect([...PLAYBOOK_SHEET_PARTIALS, ...AUTHORITY_SHEET_PARTIALS, ...CAUSE_SHEET_PARTIALS]).toHaveLength(19);
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
});
