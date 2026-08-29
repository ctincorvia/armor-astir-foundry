import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MODULE_ID } from "../scripts/main.js";
import { ReflavorConfig, REFLAVOR_CONFIG_TEMPLATE, currentReflavorState } from "../scripts/reflavor/reflavor-config.js";
import { ALL_MOVES } from "../scripts/moves/all-moves.js";
import { EQUIPMENT_CATALOG } from "../scripts/equipment/equipment.js";
import { applyReflavor, resetToBaseline } from "../scripts/reflavor/reflavor-apply.js";
import { applyCustomContent, resetCustomContent } from "../scripts/custom-content/custom-content-apply.js";

const findMove = (key) => ALL_MOVES.find((move) => move.key === key);
const findEquipment = (key) => EQUIPMENT_CATALOG.find((item) => item.key === key);

// Fakes the jQuery `html.find(selector)` chain activateListeners uses — one fake element per
// selector, each capturing whatever handler/value it was given so a test can invoke it directly and
// assert what state.js recorded. Mirrors fakeEquipmentRenderHtml's shape (tests/equipment-editor.test.js).
// Nested lookup behind a `[data-addition-group="section"]` node's own `.find()` — real activateListeners
// scopes every section-specific addition field through its group container (see reflavor-config.js),
// since equipment/astirWeapons both render a `[data-addition-tags]` input and astirParts/moves both
// render a `[data-addition-traits]` input — reading unscoped would ambiguously match both.
function fakeAdditionGroupField(state, section, nested) {
	const fieldsBySection = {
		equipment: {
			"[data-addition-kind]": () => state.equipmentKindVal,
			"[data-addition-scale]": () => state.equipmentScaleVal,
			"[data-addition-tags]": () => state.equipmentTagsVal
		},
		astirWeapons: {
			"[data-addition-tags]": () => state.astirWeaponsTagsVal
		},
		astirParts: {
			"[data-addition-parttype]": () => state.astirPartsPartTypeVal,
			"[data-addition-traits]": () => state.astirPartsTraitsVal
		},
		moves: {
			"[data-addition-traits]": () => state.movesTraitsVal
		}
	};

	const getter = fieldsBySection[section]?.[nested];
	if (!getter) throw new Error(`Unexpected nested selector "${nested}" for addition group "${section}"`);
	return { val: getter };
}

function fakeReflavorHtml() {
	const state = {
		fileHandler: null,
		downloadHandler: null,
		clearHandler: null,
		summaryHtml: "",
		saveDisabled: undefined,
		removeOverrideHandler: null,
		removeAdditionHandler: null,
		overrideSectionHandler: null,
		overrideSectionVal: "moves",
		overrideKeyHtml: undefined,
		overrideKeyVal: "",
		overridePrimaryLabelText: undefined,
		overridePrimaryVal: "",
		overrideDescriptionVal: "",
		overrideAdvancedVal: "",
		overrideAddHandler: null,
		additionSectionHandler: null,
		additionSectionVal: "equipment",
		additionGroupVisibility: {},
		additionKeyVal: "",
		additionNameVal: "",
		additionDescriptionVal: "",
		additionAdvancedVal: "",
		additionAddHandler: null,
		equipmentKindVal: "gear",
		equipmentScaleVal: "foot",
		equipmentTagsVal: "",
		astirWeaponsTagsVal: "",
		astirPartsPartTypeVal: "Active",
		astirPartsTraitsVal: "",
		movesTraitsVal: ""
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
			if (selector === "[data-remove-override]") {
				return { on: (event, handler) => { if (event === "click") state.removeOverrideHandler = handler; } };
			}
			if (selector === "[data-remove-addition]") {
				return { on: (event, handler) => { if (event === "click") state.removeAdditionHandler = handler; } };
			}
			if (selector === "[data-override-section]") {
				return {
					val: () => state.overrideSectionVal,
					on: (event, handler) => { if (event === "change") state.overrideSectionHandler = handler; }
				};
			}
			if (selector === "[data-override-key]") {
				return {
					val: () => state.overrideKeyVal,
					html: (value) => { state.overrideKeyHtml = value; }
				};
			}
			if (selector === "[data-override-primary-label]") {
				return { text: (value) => { state.overridePrimaryLabelText = value; } };
			}
			if (selector === "[data-override-primary]") {
				return { val: () => state.overridePrimaryVal };
			}
			if (selector === "[data-override-description]") {
				return { val: () => state.overrideDescriptionVal };
			}
			if (selector === "[data-override-advanced]") {
				return { val: () => state.overrideAdvancedVal };
			}
			if (selector === "[data-override-add]") {
				return { on: (event, handler) => { if (event === "click") state.overrideAddHandler = handler; } };
			}
			if (selector === "[data-addition-section]") {
				return {
					val: () => state.additionSectionVal,
					on: (event, handler) => { if (event === "change") state.additionSectionHandler = handler; }
				};
			}
			if (selector === "[data-addition-group]") {
				return { hide: () => { state.additionGroupVisibility = {}; } };
			}
			if (selector.startsWith("[data-addition-group=")) {
				const section = selector.match(/"([^"]+)"/)[1];
				return {
					show: () => { state.additionGroupVisibility[section] = true; },
					find: (nested) => fakeAdditionGroupField(state, section, nested)
				};
			}
			if (selector === "[data-addition-key]") {
				return { val: () => state.additionKeyVal };
			}
			if (selector === "[data-addition-name]") {
				return { val: () => state.additionNameVal };
			}
			if (selector === "[data-addition-description]") {
				return { val: () => state.additionDescriptionVal };
			}
			if (selector === "[data-addition-advanced]") {
				return { val: () => state.additionAdvancedVal };
			}
			if (selector === "[data-addition-add]") {
				return { on: (event, handler) => { if (event === "click") state.additionAddHandler = handler; } };
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
			title: "Armor Astir — Reflavor & Custom Content",
			template: REFLAVOR_CONFIG_TEMPLATE,
			classes: ["armor-astir"],
			width: 560,
			resizable: true
		});
	});
});

describe("ReflavorConfig#getData", () => {
	it("returns empty warnings/errors and no entry rows before any reflavorData is persisted", () => {
		expect(new ReflavorConfig().getData()).toEqual({
			warnings: [],
			errors: [],
			entryError: null,
			overrideRows: [],
			additionRows: [],
			reflavorSectionOptions: [
				{ value: "moves", label: "Moves" },
				{ value: "equipment", label: "Equipment" },
				{ value: "equipmentTags", label: "Equipment Tags" },
				{ value: "astirParts", label: "Astir Parts" },
				{ value: "astirWeapons", label: "Astir Weapons" }
			],
			additionSectionOptions: [
				{ value: "equipment", label: "Equipment" },
				{ value: "astirWeapons", label: "Astir Weapons" },
				{ value: "astirParts", label: "Astir Parts" },
				{ value: "moves", label: "Moves" }
			]
		});
	});

	it("builds an override row per persisted override, reading display text live off the catalog", () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({
			moves: { "exchange-blows": { name: "Trade Fire" } }
		}));

		const { overrideRows } = new ReflavorConfig().getData();

		expect(overrideRows).toEqual([
			{ section: "moves", sectionLabel: "Moves", key: "exchange-blows", display: "Exchange Blows" }
		]);
	});

	it("falls back to the raw key for an override row whose entry no longer resolves", () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({
			moves: { "no-such-move": { name: "X" } }
		}));

		const { overrideRows } = new ReflavorConfig().getData();

		expect(overrideRows).toEqual([
			{ section: "moves", sectionLabel: "Moves", key: "no-such-move", display: "no-such-move" }
		]);
	});

	it("builds an addition row per persisted custom addition", () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({
			additions: { equipment: [{ key: "custom:x", name: "X", kind: "gear", description: "..." }] }
		}));

		const { additionRows } = new ReflavorConfig().getData();

		expect(additionRows).toEqual([
			{ section: "equipment", sectionLabel: "Equipment", key: "custom:x", display: "X" }
		]);
	});

	it("exposes a previously-set entry error", () => {
		const config = new ReflavorConfig();
		config._entryError = "Something went wrong.";

		expect(config.getData().entryError).toBe("Something went wrong.");
	});

	it("skips the additions key when building override rows", () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({
			additions: { equipment: [{ key: "custom:x", name: "X", kind: "gear", description: "..." }] }
		}));

		expect(new ReflavorConfig().getData().overrideRows).toEqual([]);
	});

	it("ignores an unrecognized section name when building override rows", () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({ notASection: { foo: {} } }));
		expect(new ReflavorConfig().getData().overrideRows).toEqual([]);
	});

	it("ignores a non-object section value when building override rows", () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({ moves: "oops" }));
		expect(new ReflavorConfig().getData().overrideRows).toEqual([]);
	});

	it("ignores a null section value when building override rows", () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({ moves: null }));
		expect(new ReflavorConfig().getData().overrideRows).toEqual([]);
	});

	it("falls back to an entry's label when it has no name", () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({ equipmentTags: { melee: { label: "Close Range" } } }));

		expect(new ReflavorConfig().getData().overrideRows).toEqual([
			{ section: "equipmentTags", sectionLabel: "Equipment Tags", key: "melee", display: "Melee" }
		]);
	});

	it("ignores a non-object additions value when building addition rows", () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({ additions: "oops" }));
		expect(new ReflavorConfig().getData().additionRows).toEqual([]);
	});

	it("ignores a non-array addition section value when building addition rows", () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({ additions: { equipment: "oops" } }));
		expect(new ReflavorConfig().getData().additionRows).toEqual([]);
	});

	it("falls back to the raw section name for an addition row under an unrecognized section", () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({
			additions: { bogus: [{ key: "custom:x", name: "X" }] }
		}));

		expect(new ReflavorConfig().getData().additionRows).toEqual([
			{ section: "bogus", sectionLabel: "bogus", key: "custom:x", display: "X" }
		]);
	});
});

describe("currentReflavorState", () => {
	it("returns an empty object when the setting is unset", () => {
		game.settings.get.mockReturnValueOnce(undefined);
		expect(currentReflavorState()).toEqual({});
	});

	it("returns an empty object when the setting is an empty string", () => {
		game.settings.get.mockReturnValueOnce("");
		expect(currentReflavorState()).toEqual({});
	});

	it("returns an empty object for malformed JSON", () => {
		game.settings.get.mockReturnValueOnce("{ not valid json");
		expect(currentReflavorState()).toEqual({});
	});

	it("returns an empty object when the parsed JSON is an array", () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify(["not", "an", "object"]));
		expect(currentReflavorState()).toEqual({});
	});

	it("returns an empty object when the parsed JSON is a bare string", () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify("just a string"));
		expect(currentReflavorState()).toEqual({});
	});

	it("returns an empty object when the parsed JSON is null", () => {
		game.settings.get.mockReturnValueOnce("null");
		expect(currentReflavorState()).toEqual({});
	});

	it("returns the parsed object for valid JSON", () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({ moves: { "exchange-blows": { name: "Trade Fire" } } }));
		expect(currentReflavorState()).toEqual({ moves: { "exchange-blows": { name: "Trade Fire" } } });
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

describe("ReflavorConfig#_persistState", () => {
	it("applies and persists a valid state, clears _entryError, and re-renders", async () => {
		const config = new ReflavorConfig();
		config._entryError = "stale error";
		const renderSpy = vi.spyOn(config, "render").mockImplementation(() => {});

		const state = { moves: { "exchange-blows": { name: "Trade Fire" } } };
		const result = await config._persistState(state);

		expect(result).toBe(true);
		expect(findMove("exchange-blows").name).toBe("Trade Fire");
		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", JSON.stringify(state));
		expect(config._entryError).toBeNull();
		expect(renderSpy).toHaveBeenCalled();
	});

	it("sets _entryError and re-renders without persisting when the state fails validation", async () => {
		const config = new ReflavorConfig();
		const renderSpy = vi.spyOn(config, "render").mockImplementation(() => {});

		const state = { additions: { equipment: [{ key: "custom:missing-fields" }] } };
		const result = await config._persistState(state);

		expect(result).toBe(false);
		expect(config._entryError).toContain("missing required field");
		expect(game.settings.set).not.toHaveBeenCalled();
		expect(renderSpy).toHaveBeenCalled();
	});
});

describe("ReflavorConfig#activateListeners — remove handlers", () => {
	it("deletes a persisted override, prunes the now-empty section, and reverts the catalog to baseline", async () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({ moves: { "exchange-blows": { name: "Trade Fire" } } }));
		applyReflavor({ moves: { "exchange-blows": { name: "Trade Fire" } } });

		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		await state.removeOverrideHandler({ currentTarget: { dataset: { section: "moves", key: "exchange-blows" } } });

		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", JSON.stringify({}));
		expect(findMove("exchange-blows").name).toBe("Exchange Blows");
	});

	it("removes one override key while leaving the rest of its section intact", async () => {
		const persisted = { moves: { "exchange-blows": { name: "A" }, "read-the-room": { name: "B" } } };
		game.settings.get.mockReturnValueOnce(JSON.stringify(persisted));
		applyReflavor(persisted);

		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		await state.removeOverrideHandler({ currentTarget: { dataset: { section: "moves", key: "exchange-blows" } } });

		expect(game.settings.set).toHaveBeenCalledWith(
			MODULE_ID, "reflavorData", JSON.stringify({ moves: { "read-the-room": { name: "B" } } })
		);
	});

	it("does nothing when removing an override for a section that isn't persisted", async () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({}));

		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		await state.removeOverrideHandler({ currentTarget: { dataset: { section: "moves", key: "exchange-blows" } } });

		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", JSON.stringify({}));
	});

	it("deletes a persisted custom addition, prunes the now-empty section and additions key, and retracts it from the catalog", async () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({
			additions: { equipment: [{ key: "custom:temp", name: "Temp", kind: "gear", description: "..." }] }
		}));
		applyCustomContent({ equipment: [{ key: "custom:temp", name: "Temp", kind: "gear", description: "..." }] });

		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		await state.removeAdditionHandler({ currentTarget: { dataset: { section: "equipment", key: "custom:temp" } } });

		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", JSON.stringify({}));
		expect(findEquipment("custom:temp")).toBeUndefined();
	});

	it("removes one addition entry while leaving the rest of its section intact", async () => {
		const persisted = {
			additions: {
				equipment: [
					{ key: "custom:temp", name: "Temp", kind: "gear", description: "..." },
					{ key: "custom:keep", name: "Keep", kind: "gear", description: "..." }
				]
			}
		};
		game.settings.get.mockReturnValueOnce(JSON.stringify(persisted));
		applyCustomContent({
			equipment: [
				{ key: "custom:temp", name: "Temp", kind: "gear", description: "..." },
				{ key: "custom:keep", name: "Keep", kind: "gear", description: "..." }
			]
		});

		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		await state.removeAdditionHandler({ currentTarget: { dataset: { section: "equipment", key: "custom:temp" } } });

		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", JSON.stringify({
			additions: { equipment: [{ key: "custom:keep", name: "Keep", kind: "gear", description: "..." }] }
		}));
	});

	it("does nothing when removing an addition for a section that isn't persisted", async () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({ additions: {} }));

		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		await state.removeAdditionHandler({ currentTarget: { dataset: { section: "equipment", key: "custom:temp" } } });

		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", JSON.stringify({ additions: {} }));
	});
});

describe("ReflavorConfig#activateListeners — override section change", () => {
	it("populates the entry dropdown and the Name label on activation for the default (moves) section", () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		expect(state.overrideKeyHtml).toContain("exchange-blows");
		expect(state.overridePrimaryLabelText).toBe("Name");
	});

	it("relabels the primary field to Label for the equipmentTags section", () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		state.overrideSectionVal = "equipmentTags";
		config.activateListeners(state.html);

		expect(state.overridePrimaryLabelText).toBe("Label");
		expect(state.overrideKeyHtml).toContain("melee");
	});

	it("repopulates the dropdown and relabels via the change handler, not just the upfront call", () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);
		expect(state.overridePrimaryLabelText).toBe("Name");

		state.overrideSectionVal = "equipmentTags";
		state.overrideSectionHandler();

		expect(state.overridePrimaryLabelText).toBe("Label");
		expect(state.overrideKeyHtml).toContain("melee");
	});

	it("clears the dropdown and defaults the label to Name for an unrecognized section", () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		state.overrideSectionVal = "";
		config.activateListeners(state.html);

		expect(state.overrideKeyHtml).toBe("");
		expect(state.overridePrimaryLabelText).toBe("Name");
	});
});

describe("ReflavorConfig#activateListeners — override add", () => {
	it("adds an override using just the primary field and description", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		state.overrideSectionVal = "moves";
		state.overrideKeyVal = "exchange-blows";
		state.overridePrimaryVal = "Trade Fire";
		state.overrideDescriptionVal = "New description.";

		await state.overrideAddHandler();

		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", JSON.stringify({
			moves: { "exchange-blows": { name: "Trade Fire", description: "New description." } }
		}));
		expect(findMove("exchange-blows").name).toBe("Trade Fire");
	});

	it("merges advanced-JSON fields with the primary field, primary winning on conflicts", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		state.overrideSectionVal = "moves";
		state.overrideKeyVal = "exchange-blows";
		state.overridePrimaryVal = "Trade Fire";
		state.overrideAdvancedVal = JSON.stringify({ successOptions: "Custom text." });

		await state.overrideAddHandler();

		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", JSON.stringify({
			moves: { "exchange-blows": { successOptions: "Custom text.", name: "Trade Fire" } }
		}));
	});

	it("merges the new override onto an already-persisted override for the same key", async () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({ moves: { "exchange-blows": { description: "Old." } } }));

		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		state.overrideSectionVal = "moves";
		state.overrideKeyVal = "exchange-blows";
		state.overridePrimaryVal = "Trade Fire";

		await state.overrideAddHandler();

		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", JSON.stringify({
			moves: { "exchange-blows": { description: "Old.", name: "Trade Fire" } }
		}));
	});

	it("sets _entryError without persisting for malformed advanced JSON", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);
		const renderSpy = vi.spyOn(config, "render").mockImplementation(() => {});

		state.overrideSectionVal = "moves";
		state.overrideKeyVal = "exchange-blows";
		state.overrideAdvancedVal = "{ not valid json";

		await state.overrideAddHandler();

		expect(config._entryError).toContain("Advanced fields must be valid JSON");
		expect(game.settings.set).not.toHaveBeenCalled();
		expect(renderSpy).toHaveBeenCalled();
	});

	it("sets _entryError without persisting when nothing was entered to override", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);
		const renderSpy = vi.spyOn(config, "render").mockImplementation(() => {});

		state.overrideSectionVal = "moves";
		state.overrideKeyVal = "exchange-blows";

		await state.overrideAddHandler();

		expect(config._entryError).toBe("Choose a section, an entry, and at least one field to override.");
		expect(game.settings.set).not.toHaveBeenCalled();
		expect(renderSpy).toHaveBeenCalled();
	});

	it("sets _entryError without persisting when no section is chosen, even with a value entered", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		state.overrideSectionVal = "";
		state.overrideKeyVal = "";
		state.overridePrimaryVal = "Something";

		await state.overrideAddHandler();

		expect(config._entryError).toBe("Choose a section, an entry, and at least one field to override.");
		expect(game.settings.set).not.toHaveBeenCalled();
	});

	it("sets _entryError without persisting when no entry is chosen, even with a value entered", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		state.overrideSectionVal = "moves";
		state.overrideKeyVal = "";
		state.overridePrimaryVal = "Something";

		await state.overrideAddHandler();

		expect(config._entryError).toBe("Choose a section, an entry, and at least one field to override.");
		expect(game.settings.set).not.toHaveBeenCalled();
	});
});

describe("ReflavorConfig#activateListeners — addition section change", () => {
	it("shows only the default (equipment) group on activation", () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		expect(state.additionGroupVisibility).toEqual({ equipment: true });
	});

	it("shows only the newly-selected group when the addition section changes", () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		state.additionSectionVal = "astirParts";
		state.additionSectionHandler();

		expect(state.additionGroupVisibility).toEqual({ astirParts: true });
	});
});

describe("ReflavorConfig#activateListeners — addition add", () => {
	it("builds an equipment addition with kind/scale/tags split into an array", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		state.additionSectionVal = "equipment";
		state.additionKeyVal = "custom:new-gear";
		state.additionNameVal = "New Gear";
		state.additionDescriptionVal = "A thing.";
		state.equipmentKindVal = "weapon";
		state.equipmentScaleVal = "foot";
		state.equipmentTagsVal = "melee, concealable";

		await state.additionAddHandler();

		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", JSON.stringify({
			additions: {
				equipment: [{
					key: "custom:new-gear",
					name: "New Gear",
					description: "A thing.",
					kind: "weapon",
					scale: "foot",
					tags: ["melee", "concealable"]
				}]
			}
		}));
		expect(findEquipment("custom:new-gear")).toMatchObject({ name: "New Gear" });
	});

	it("produces an empty tags array, not an array with an empty string, for a blank tags input", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		// Gear (unlike a weapon) has no required range tag, so a blank tags input stays valid —
		// astirWeapons/equipment-as-weapon both mechanically require one of melee/ranged/sniper.
		state.additionSectionVal = "equipment";
		state.additionKeyVal = "custom:new-gear-2";
		state.additionNameVal = "New Gear";
		state.additionDescriptionVal = "A thing.";
		state.equipmentKindVal = "gear";
		state.equipmentScaleVal = "foot";
		state.equipmentTagsVal = "";

		await state.additionAddHandler();

		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", JSON.stringify({
			additions: {
				equipment: [{
					key: "custom:new-gear-2",
					name: "New Gear",
					description: "A thing.",
					kind: "gear",
					scale: "foot",
					tags: []
				}]
			}
		}));
	});

	it("builds an astirParts addition with partType/traits", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		state.additionSectionVal = "astirParts";
		state.additionKeyVal = "custom:new-part";
		state.additionNameVal = "New Part";
		state.additionDescriptionVal = "A thing.";
		state.astirPartsPartTypeVal = "Passive";
		state.astirPartsTraitsVal = "Body, Mind";

		await state.additionAddHandler();

		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", JSON.stringify({
			additions: {
				astirParts: [{
					key: "custom:new-part",
					name: "New Part",
					description: "A thing.",
					partType: "Passive",
					traits: ["Body", "Mind"]
				}]
			}
		}));
	});

	it("builds a moves addition with traits", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		state.additionSectionVal = "moves";
		state.additionKeyVal = "custom:new-move";
		state.additionNameVal = "New Move";
		state.additionDescriptionVal = "A thing.";
		state.movesTraitsVal = "";

		await state.additionAddHandler();

		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", JSON.stringify({
			additions: {
				moves: [{ key: "custom:new-move", name: "New Move", description: "A thing.", traits: [] }]
			}
		}));
		expect(findMove("custom:new-move")).toMatchObject({ name: "New Move" });
	});

	it("builds an astirWeapons addition with tags", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		state.additionSectionVal = "astirWeapons";
		state.additionKeyVal = "custom:new-astir-weapon";
		state.additionNameVal = "New Astir Weapon";
		state.additionDescriptionVal = "A thing.";
		state.astirWeaponsTagsVal = "melee";

		await state.additionAddHandler();

		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", JSON.stringify({
			additions: {
				astirWeapons: [{
					key: "custom:new-astir-weapon",
					name: "New Astir Weapon",
					description: "A thing.",
					tags: ["melee"]
				}]
			}
		}));
	});

	it("sends no section-specific fields for an unrecognized addition section", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		state.additionSectionVal = "bogus";
		state.additionKeyVal = "custom:new-thing";
		state.additionNameVal = "New Thing";
		state.additionDescriptionVal = "A thing.";

		await state.additionAddHandler();

		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", JSON.stringify({
			additions: {
				bogus: [{ key: "custom:new-thing", name: "New Thing", description: "A thing." }]
			}
		}));
	});

	it("updates an existing addition in place when re-adding the same key", async () => {
		game.settings.get.mockReturnValueOnce(JSON.stringify({
			additions: { equipment: [{ key: "custom:new-gear", name: "Old Name", kind: "gear", description: "Old.", tags: [] }] }
		}));

		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);

		state.additionSectionVal = "equipment";
		state.additionKeyVal = "custom:new-gear";
		state.additionNameVal = "New Name";
		state.additionDescriptionVal = "New.";
		state.equipmentKindVal = "gear";
		state.equipmentScaleVal = "foot";
		state.equipmentTagsVal = "";

		await state.additionAddHandler();

		expect(game.settings.set).toHaveBeenCalledWith(MODULE_ID, "reflavorData", JSON.stringify({
			additions: {
				equipment: [{
					key: "custom:new-gear",
					name: "New Name",
					description: "New.",
					kind: "gear",
					scale: "foot",
					tags: []
				}]
			}
		}));
	});

	it("sets _entryError without persisting for malformed advanced JSON on the addition form", async () => {
		const config = new ReflavorConfig();
		const state = fakeReflavorHtml();
		config.activateListeners(state.html);
		const renderSpy = vi.spyOn(config, "render").mockImplementation(() => {});

		state.additionSectionVal = "equipment";
		state.additionAdvancedVal = "{ not valid json";

		await state.additionAddHandler();

		expect(config._entryError).toContain("Advanced fields must be valid JSON");
		expect(game.settings.set).not.toHaveBeenCalled();
		expect(renderSpy).toHaveBeenCalled();
	});
});
