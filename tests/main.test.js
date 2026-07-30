import { describe, expect, it, vi } from "vitest";
import { MODULE_ID, registerInitHook } from "../scripts/main.js";

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
});
