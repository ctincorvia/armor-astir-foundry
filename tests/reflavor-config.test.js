import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MODULE_ID } from "../scripts/main.js";
import { ReflavorConfig, REFLAVOR_CONFIG_TEMPLATE } from "../scripts/reflavor/reflavor-config.js";
import { ALL_MOVES } from "../scripts/moves/all-moves.js";
import { EQUIPMENT_CATALOG } from "../scripts/equipment/equipment.js";
import { applyReflavor, resetToBaseline } from "../scripts/reflavor/reflavor-apply.js";
import { applyCustomContent, resetCustomContent } from "../scripts/custom-content/custom-content-apply.js";

const findMove = (key) => ALL_MOVES.find((move) => move.key === key);
const findEquipment = (key) => EQUIPMENT_CATALOG.find((item) => item.key === key);

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
	resetCustomContent();
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
		expect(state.summaryHtml).toContain("1 override parsed.");
		expect(state.summaryHtml).toContain("0 new entries parsed.");
	});

	it("pluralizes the override count in the summary for zero parsed overrides", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		readTextFromFile.mockResolvedValueOnce(JSON.stringify({}));
		await state.fileHandler({ target: { files: [{}] } });

		expect(state.summaryHtml).toContain("0 overrides parsed.");
	});

	it("pluralizes the override count in the summary for multiple parsed overrides", async () => {
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

		expect(state.summaryHtml).toContain("2 overrides parsed.");
	});

	it("counts additions across all three sections and pluralizes for a single new entry", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		readTextFromFile.mockResolvedValueOnce(JSON.stringify({
			additions: {
				equipment: [{ key: "custom:x", name: "X", kind: "gear", description: "..." }]
			}
		}));
		await state.fileHandler({ target: { files: [{}] } });

		expect(state.saveDisabled).toBe(false);
		expect(state.summaryHtml).toContain("0 overrides parsed.");
		expect(state.summaryHtml).toContain("1 new entry parsed.");
	});

	it("counts a moves addition alongside the other sections", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		readTextFromFile.mockResolvedValueOnce(JSON.stringify({
			additions: {
				moves: [{ key: "custom:new-move", name: "New Move", traits: [], description: "..." }]
			}
		}));
		await state.fileHandler({ target: { files: [{}] } });

		expect(state.saveDisabled).toBe(false);
		expect(state.summaryHtml).toContain("1 new entry parsed.");
	});

	it("pluralizes the addition count for multiple new entries across sections", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		readTextFromFile.mockResolvedValueOnce(JSON.stringify({
			additions: {
				equipment: [{ key: "custom:x", name: "X", kind: "gear", description: "..." }],
				astirWeapons: [{ key: "custom:y", name: "Y", description: "...", tags: ["melee"] }]
			}
		}));
		await state.fileHandler({ target: { files: [{}] } });

		expect(state.summaryHtml).toContain("2 new entries parsed.");
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

	it("shows an error and disables Save for an invalid addition, even when overrides are clean", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		readTextFromFile.mockResolvedValueOnce(JSON.stringify({
			moves: { "exchange-blows": { name: "Trade Fire" } },
			additions: { equipment: [{ key: "not-namespaced", name: "X", kind: "gear", description: "..." }] }
		}));
		await state.fileHandler({ target: { files: [{}] } });

		expect(state.saveDisabled).toBe(true);
		expect(state.summaryHtml).toContain("must have a \"key\" starting with \"custom:\"");
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

	it("wires the clear button to reset the catalogs and injected additions, clear the setting, and re-render", async () => {
		applyReflavor({ moves: { "exchange-blows": { name: "Trade Fire" } } });
		applyCustomContent({ equipment: [{ key: "custom:temp", name: "Temp", kind: "gear", description: "..." }] });

		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);
		const renderSpy = vi.spyOn(config, "render").mockImplementation(() => {});

		const event = { preventDefault: vi.fn() };
		await state.clearHandler(event);

		expect(findMove("exchange-blows").name).toBe("Exchange Blows");
		expect(findEquipment("custom:temp")).toBeUndefined();
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

	it("applies pending additions alongside overrides in the same Save", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		const rawText = JSON.stringify({
			additions: { equipment: [{ key: "custom:new-gear", name: "New Gear", kind: "gear", description: "..." }] }
		});
		readTextFromFile.mockResolvedValueOnce(rawText);
		await state.fileHandler({ target: { files: [{}] } });

		await config._updateObject();

		expect(findEquipment("custom:new-gear")).toMatchObject({ name: "New Gear" });
	});

	it("applies a pending moves addition on Save", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		const rawText = JSON.stringify({
			additions: { moves: [{ key: "custom:new-move", name: "New Move", traits: [], description: "..." }] }
		});
		readTextFromFile.mockResolvedValueOnce(rawText);
		await state.fileHandler({ target: { files: [{}] } });

		await config._updateObject();

		expect(findMove("custom:new-move")).toMatchObject({ name: "New Move" });
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

	it("does not apply an upload whose additions failed validation, even though overrides were clean", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		readTextFromFile.mockResolvedValueOnce(JSON.stringify({
			moves: { "exchange-blows": { name: "Trade Fire" } },
			additions: { equipment: [{ key: "not-namespaced", name: "X", kind: "gear", description: "..." }] }
		}));
		await state.fileHandler({ target: { files: [{}] } });

		await config._updateObject();

		expect(findMove("exchange-blows").name).toBe("Exchange Blows");
		expect(game.settings.set).not.toHaveBeenCalled();
	});
});
