import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MODULE_ID } from "../scripts/main.js";
import { ReflavorConfig, REFLAVOR_CONFIG_TEMPLATE } from "../scripts/reflavor/reflavor-config.js";
import { ALL_MOVES } from "../scripts/moves/all-moves.js";
import { applyReflavor, resetToBaseline } from "../scripts/reflavor/reflavor-apply.js";

const findMove = (key) => ALL_MOVES.find((move) => move.key === key);

// Fakes the jQuery `html.find(selector)` chain activateListeners uses — one fake element per
// selector, each capturing whatever handler/value it was given so a test can invoke it directly and
// assert what state.js recorded. Mirrors fakeEquipmentRenderHtml's shape (tests/equipment-editor.test.js).
function fakeReflavorHtml() {
	const state = {
		fileHandler: null,
		downloadHandler: null,
		clearHandler: null,
		summaryHtml: "",
		saveDisabled: undefined
	};

	state.html = {
		find: (selector) => {
			if (selector === "[name='reflavor-file']") {
				return { on: (event, handler) => { if (event === "change") state.fileHandler = handler; } };
			}
			if (selector === "[data-reflavor-summary]") {
				return { html: (value) => { state.summaryHtml = value; } };
			}
			if (selector === "[data-reflavor-save]") {
				return { prop: (name, value) => { if (name === "disabled") state.saveDisabled = value; } };
			}
			if (selector === "[data-reflavor-download]") {
				return { on: (event, handler) => { if (event === "click") state.downloadHandler = handler; } };
			}
			if (selector === "[data-reflavor-clear]") {
				return { on: (event, handler) => { if (event === "click") state.clearHandler = handler; } };
			}
			throw new Error(`Unexpected selector: ${selector}`);
		}
	};

	return state;
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	resetToBaseline();
});

describe("ReflavorConfig.defaultOptions", () => {
	it("merges the reflavor-specific options onto the FormApplication base", () => {
		expect(ReflavorConfig.defaultOptions).toMatchObject({
			id: "armor-astir-reflavor-config",
			title: "Armor Astir — Reflavor",
			template: REFLAVOR_CONFIG_TEMPLATE,
			classes: ["armor-astir"],
			width: 480
		});
	});
});

describe("ReflavorConfig#getData", () => {
	it("returns empty warnings/errors before any file has been picked", () => {
		expect(new ReflavorConfig().getData()).toEqual({ warnings: [], errors: [] });
	});
});

describe("ReflavorConfig#activateListeners", () => {
	it("does nothing on a change event with no file selected", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		await state.fileHandler({ target: { files: [] } });

		expect(state.summaryHtml).toBe("");
		expect(state.saveDisabled).toBeUndefined();
	});

	it("validates a picked file, shows a clean-parse summary, and enables Save", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		readTextFromFile.mockResolvedValueOnce(JSON.stringify({ moves: { "exchange-blows": { name: "Trade Fire" } } }));
		await state.fileHandler({ target: { files: [{}] } });

		expect(state.saveDisabled).toBe(false);
		expect(state.summaryHtml).toContain("1 entry parsed.");
	});

	it("pluralizes the entry count in the summary for zero parsed entries", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		readTextFromFile.mockResolvedValueOnce(JSON.stringify({}));
		await state.fileHandler({ target: { files: [{}] } });

		expect(state.summaryHtml).toContain("0 entries parsed.");
	});

	it("pluralizes the entry count in the summary for multiple parsed entries", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		readTextFromFile.mockResolvedValueOnce(JSON.stringify({
			moves: {
				"exchange-blows": { name: "A" },
				"read-the-room": { name: "B" }
			}
		}));
		await state.fileHandler({ target: { files: [{}] } });

		expect(state.summaryHtml).toContain("2 entries parsed.");
	});

	it("shows warnings for a file that parses cleanly but references unknown content", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		readTextFromFile.mockResolvedValueOnce(JSON.stringify({ moves: { "no-such-move": { name: "X" } } }));
		await state.fileHandler({ target: { files: [{}] } });

		expect(state.saveDisabled).toBe(false);
		expect(state.summaryHtml).toContain("Warning: Unknown moves key \"no-such-move\" was ignored.");
	});

	it("shows an error and disables Save for a malformed file", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		readTextFromFile.mockResolvedValueOnce("{ not valid json");
		await state.fileHandler({ target: { files: [{}] } });

		expect(state.saveDisabled).toBe(true);
		expect(state.summaryHtml).toContain("Error: Malformed JSON");
	});

	it("wires the download button to downloadReflavorTemplate", () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		const event = { preventDefault: vi.fn() };
		state.downloadHandler(event);

		expect(event.preventDefault).toHaveBeenCalled();
		expect(saveDataToFile).toHaveBeenCalled();
	});

	it("wires the clear button to reset the catalogs, clear the setting, and re-render", async () => {
		applyReflavor({ moves: { "exchange-blows": { name: "Trade Fire" } } });

		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);
		const renderSpy = vi.spyOn(config, "render").mockImplementation(() => {});

		const event = { preventDefault: vi.fn() };
		await state.clearHandler(event);

		expect(findMove("exchange-blows").name).toBe("Exchange Blows");
		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", "");
		expect(renderSpy).toHaveBeenCalled();
	});
});

describe("ReflavorConfig#_updateObject", () => {
	it("does nothing when there is no pending validated override", async () => {
		await new ReflavorConfig()._updateObject();
		expect(game.settings.set).not.toHaveBeenCalled();
	});

	it("applies the pending overrides and persists the raw uploaded text", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		const rawText = JSON.stringify({ moves: { "exchange-blows": { name: "Trade Fire" } } });
		readTextFromFile.mockResolvedValueOnce(rawText);
		await state.fileHandler({ target: { files: [{}] } });

		await config._updateObject();

		expect(findMove("exchange-blows").name).toBe("Trade Fire");
		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", rawText);
	});

	it("does not apply or persist a file that failed validation", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		readTextFromFile.mockResolvedValueOnce("{ not valid json");
		await state.fileHandler({ target: { files: [{}] } });

		await config._updateObject();

		expect(findMove("exchange-blows").name).toBe("Exchange Blows");
		expect(game.settings.set).not.toHaveBeenCalled();
	});
});
