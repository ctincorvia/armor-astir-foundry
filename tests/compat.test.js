import { afterEach, describe, expect, it, vi } from "vitest";
import {
	chatRenderHook,
	generation,
	getRoute,
	loadTemplates,
	readTextFromFile,
	renderTemplate,
	saveDataToFile,
	toJQuery
} from "../scripts/compat.js";

// Every test here stubs its own shape for foundry/game/jQuery rather than relying on
// tests/setup.js's shared stubs, so unstubAllGlobals must restore those shared stubs afterward.
afterEach(() => {
	vi.unstubAllGlobals();
});

describe("renderTemplate/loadTemplates/readTextFromFile/saveDataToFile", () => {
	it("calls the namespaced foundry.applications.handlebars.renderTemplate when present, not the bare global", () => {
		const namespaced = vi.fn().mockReturnValue("namespaced-result");
		const bareGlobal = vi.fn().mockReturnValue("bare-result");
		vi.stubGlobal("foundry", { applications: { handlebars: { renderTemplate: namespaced } } });
		vi.stubGlobal("renderTemplate", bareGlobal);

		const result = renderTemplate("template.hbs", { a: 1 });

		expect(namespaced).toHaveBeenCalledWith("template.hbs", { a: 1 });
		expect(bareGlobal).not.toHaveBeenCalled();
		expect(result).toBe("namespaced-result");
	});

	it("falls back to the bare global renderTemplate when the namespaced path resolves to undefined (v12)", () => {
		const bareGlobal = vi.fn().mockReturnValue("bare-result");
		vi.stubGlobal("foundry", { applications: { handlebars: {} } });
		vi.stubGlobal("renderTemplate", bareGlobal);

		const result = renderTemplate("template.hbs");

		expect(bareGlobal).toHaveBeenCalledWith("template.hbs");
		expect(result).toBe("bare-result");
	});

	it("falls back to the bare global renderTemplate without throwing when an intermediate hop is missing (foundry stubbed with no .applications)", () => {
		const bareGlobal = vi.fn().mockReturnValue("bare-result");
		vi.stubGlobal("foundry", {});
		vi.stubGlobal("renderTemplate", bareGlobal);

		let result;
		expect(() => {
			result = renderTemplate("template.hbs");
		}).not.toThrow();

		expect(bareGlobal).toHaveBeenCalledWith("template.hbs");
		expect(result).toBe("bare-result");
	});

	it("falls back to the bare global renderTemplate without throwing when an intermediate hop is explicitly null", () => {
		const bareGlobal = vi.fn().mockReturnValue("bare-result");
		vi.stubGlobal("foundry", { applications: null });
		vi.stubGlobal("renderTemplate", bareGlobal);

		expect(() => renderTemplate("template.hbs")).not.toThrow();
		expect(bareGlobal).toHaveBeenCalledWith("template.hbs");
	});

	it("calls the namespaced foundry.applications.handlebars.loadTemplates when present, not the bare global", () => {
		const namespaced = vi.fn().mockReturnValue("namespaced-result");
		const bareGlobal = vi.fn().mockReturnValue("bare-result");
		vi.stubGlobal("foundry", { applications: { handlebars: { loadTemplates: namespaced } } });
		vi.stubGlobal("loadTemplates", bareGlobal);

		const result = loadTemplates(["a.hbs"]);

		expect(namespaced).toHaveBeenCalledWith(["a.hbs"]);
		expect(bareGlobal).not.toHaveBeenCalled();
		expect(result).toBe("namespaced-result");
	});

	it("falls back to the bare global loadTemplates when the namespace is missing", () => {
		const bareGlobal = vi.fn().mockReturnValue("bare-result");
		vi.stubGlobal("foundry", {});
		vi.stubGlobal("loadTemplates", bareGlobal);

		const result = loadTemplates(["a.hbs"]);

		expect(bareGlobal).toHaveBeenCalledWith(["a.hbs"]);
		expect(result).toBe("bare-result");
	});

	it("calls the namespaced foundry.utils.readTextFromFile when present, not the bare global", () => {
		const namespaced = vi.fn().mockReturnValue("namespaced-result");
		const bareGlobal = vi.fn().mockReturnValue("bare-result");
		vi.stubGlobal("foundry", { utils: { readTextFromFile: namespaced } });
		vi.stubGlobal("readTextFromFile", bareGlobal);

		const result = readTextFromFile("file");

		expect(namespaced).toHaveBeenCalledWith("file");
		expect(bareGlobal).not.toHaveBeenCalled();
		expect(result).toBe("namespaced-result");
	});

	it("falls back to the bare global readTextFromFile when foundry.utils has no readTextFromFile", () => {
		const bareGlobal = vi.fn().mockReturnValue("bare-result");
		vi.stubGlobal("foundry", { utils: {} });
		vi.stubGlobal("readTextFromFile", bareGlobal);

		const result = readTextFromFile("file");

		expect(bareGlobal).toHaveBeenCalledWith("file");
		expect(result).toBe("bare-result");
	});

	it("calls the namespaced foundry.utils.saveDataToFile when present, not the bare global", () => {
		const namespaced = vi.fn().mockReturnValue("namespaced-result");
		const bareGlobal = vi.fn().mockReturnValue("bare-result");
		vi.stubGlobal("foundry", { utils: { saveDataToFile: namespaced } });
		vi.stubGlobal("saveDataToFile", bareGlobal);

		const result = saveDataToFile("data", "text/json", "file.json");

		expect(namespaced).toHaveBeenCalledWith("data", "text/json", "file.json");
		expect(bareGlobal).not.toHaveBeenCalled();
		expect(result).toBe("namespaced-result");
	});

	it("falls back to the bare global saveDataToFile when foundry.utils has no saveDataToFile", () => {
		const bareGlobal = vi.fn().mockReturnValue("bare-result");
		vi.stubGlobal("foundry", { utils: {} });
		vi.stubGlobal("saveDataToFile", bareGlobal);

		const result = saveDataToFile("data", "text/json", "file.json");

		expect(bareGlobal).toHaveBeenCalledWith("data", "text/json", "file.json");
		expect(result).toBe("bare-result");
	});

	it("calls the namespaced foundry.utils.getRoute when present, not the bare global", () => {
		const namespaced = vi.fn().mockReturnValue("namespaced-result");
		const bareGlobal = vi.fn().mockReturnValue("bare-result");
		vi.stubGlobal("foundry", { utils: { getRoute: namespaced } });
		vi.stubGlobal("getRoute", bareGlobal);

		const result = getRoute("modules/armor-astir/docs/custom-moves.md");

		expect(namespaced).toHaveBeenCalledWith("modules/armor-astir/docs/custom-moves.md");
		expect(bareGlobal).not.toHaveBeenCalled();
		expect(result).toBe("namespaced-result");
	});

	it("falls back to the bare global getRoute when foundry.utils has no getRoute", () => {
		const bareGlobal = vi.fn().mockReturnValue("bare-result");
		vi.stubGlobal("foundry", { utils: {} });
		vi.stubGlobal("getRoute", bareGlobal);

		const result = getRoute("modules/armor-astir/docs/custom-moves.md");

		expect(bareGlobal).toHaveBeenCalledWith("modules/armor-astir/docs/custom-moves.md");
		expect(result).toBe("bare-result");
	});
});

describe("generation", () => {
	it("returns game.release.generation when present", () => {
		vi.stubGlobal("game", { release: { generation: 13 } });

		expect(generation()).toBe(13);
	});

	it("falls back to 12 when game.release is absent", () => {
		vi.stubGlobal("game", {});

		expect(generation()).toBe(12);
	});
});

describe("chatRenderHook", () => {
	it("returns renderChatMessage at generation 12", () => {
		vi.stubGlobal("game", { release: { generation: 12 } });

		expect(chatRenderHook()).toBe("renderChatMessage");
	});

	it("returns renderChatMessageHTML at generation 13", () => {
		vi.stubGlobal("game", { release: { generation: 13 } });

		expect(chatRenderHook()).toBe("renderChatMessageHTML");
	});

	it("returns renderChatMessageHTML at generation 14", () => {
		vi.stubGlobal("game", { release: { generation: 14 } });

		expect(chatRenderHook()).toBe("renderChatMessageHTML");
	});
});

describe("toJQuery", () => {
	it("passes a non-HTMLElement value straight through", () => {
		// A plain jQuery-like fake, matching how the rest of this test suite fakes jQuery objects
		// (see tests/move-chat-listeners.test.js's fakeChatHtml) rather than a real jQuery instance.
		const fakeJqueryLikeObject = { find: vi.fn(), on: vi.fn() };

		expect(toJQuery(fakeJqueryLikeObject)).toBe(fakeJqueryLikeObject);
	});

	it("wraps an HTMLElement with globalThis.jQuery when present", () => {
		const element = document.createElement("div");
		const wrapped = { find: vi.fn() };
		const jq = vi.fn().mockReturnValue(wrapped);
		vi.stubGlobal("jQuery", jq);

		const result = toJQuery(element);

		expect(jq).toHaveBeenCalledWith(element);
		expect(result).toBe(wrapped);
	});

	it("returns the element itself when no jQuery global is present", () => {
		vi.stubGlobal("jQuery", undefined);
		const element = document.createElement("div");

		expect(toJQuery(element)).toBe(element);
	});
});
