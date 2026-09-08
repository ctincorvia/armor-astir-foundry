import { afterEach, describe, expect, it, vi } from "vitest";

import { MODULE_ID } from "../scripts/module-id.js";
import {
	ENABLE_MOVE_CUSTOMIZATION_SETTING,
	customizedMove,
	isCustomizableMoveKey,
	isMoveCustomizationEnabled,
	moveCustomizationOverrides,
	saveMoveCustomization
} from "../scripts/moves/move-customization.js";
import { DENY, EXCHANGE_BLOWS } from "./helpers/move-fixtures.js";
import { ASTIR_PART_CATALOG } from "../scripts/frames/astir-parts.js";
import { ARDENT_FEATURE_PARTS } from "../scripts/frames/ardent.js";
import { ASTIR_MOVE_CATALOG } from "../scripts/frames/astir-moves.js";

afterEach(() => {
	game.settings.get.mockReset();
});

describe("isMoveCustomizationEnabled", () => {
	it("reads the world setting via game.settings.get", () => {
		game.settings.get.mockReturnValue(true);

		expect(isMoveCustomizationEnabled()).toBe(true);
		expect(game.settings.get).toHaveBeenCalledWith(MODULE_ID, ENABLE_MOVE_CUSTOMIZATION_SETTING);
	});

	it("is false when the setting reads undefined (the tests/setup.js default)", () => {
		expect(isMoveCustomizationEnabled()).toBe(false);
	});
});

describe("isCustomizableMoveKey", () => {
	it("is true for a Playbook Move's key", () => {
		expect(isCustomizableMoveKey(DENY.key)).toBe(true);
	});

	it("is true for an Astir Part's key", () => {
		expect(isCustomizableMoveKey(ASTIR_PART_CATALOG[0].key)).toBe(true);
	});

	it("is false for a Basic Move's key", () => {
		expect(isCustomizableMoveKey(EXCHANGE_BLOWS.key)).toBe(false);
	});

	it("is false for the Astir's own unique move (ASTIR_MOVE_CATALOG)", () => {
		expect(isCustomizableMoveKey(ASTIR_MOVE_CATALOG[0].key)).toBe(false);
	});

	it("is false for a true Ardent Feature (ARDENT_FEATURE_PARTS)", () => {
		expect(isCustomizableMoveKey(ARDENT_FEATURE_PARTS[0].key)).toBe(false);
	});

	it("is false for a key that matches nothing in any catalog", () => {
		expect(isCustomizableMoveKey("not-a-real-key")).toBe(false);
	});
});

describe("moveCustomizationOverrides", () => {
	it("returns {} without ever calling actor.getFlag when the setting is off", () => {
		const getFlag = vi.fn();

		expect(moveCustomizationOverrides({ getFlag }, false)).toEqual({});
		expect(getFlag).not.toHaveBeenCalled();
	});

	it("returns {} without ever calling actor.getFlag when resolving the setting itself reads off", () => {
		const getFlag = vi.fn();

		expect(moveCustomizationOverrides({ getFlag })).toEqual({});
		expect(getFlag).not.toHaveBeenCalled();
	});

	it("reads the stored flag bucket when the setting is on", () => {
		const stored = { [DENY.key]: { name: "Refuse", description: "A custom refusal." } };
		const getFlag = vi.fn(() => stored);

		expect(moveCustomizationOverrides({ getFlag }, true)).toBe(stored);
		expect(getFlag).toHaveBeenCalledWith(MODULE_ID, "moveCustomizations");
	});

	it("falls back to {} when the setting is on but nothing is stored yet", () => {
		const getFlag = vi.fn(() => undefined);

		expect(moveCustomizationOverrides({ getFlag }, true)).toEqual({});
	});
});

describe("customizedMove", () => {
	it("returns the move unchanged by reference when it's ineligible, even with a matching override", () => {
		const overrides = { [EXCHANGE_BLOWS.key]: { name: "Trade Blows", description: "x" } };

		expect(customizedMove(EXCHANGE_BLOWS, overrides)).toBe(EXCHANGE_BLOWS);
	});

	it("returns the move unchanged by reference when it's eligible but has no override", () => {
		expect(customizedMove(DENY, {})).toBe(DENY);
	});

	it("returns a shallow copy with only name/description swapped when eligible and overridden", () => {
		const overrides = { [DENY.key]: { name: "Refuse", description: "A custom refusal." } };

		const result = customizedMove(DENY, overrides);

		expect(result).not.toBe(DENY);
		expect(result).toEqual({ ...DENY, name: "Refuse", description: "A custom refusal." });
	});
});

describe("saveMoveCustomization", () => {
	it("merges the new override into the existing bucket and writes it in one actor.update", async () => {
		const existing = { "astir-part:extra-arms": { name: "Existing", description: "e" } };
		const update = vi.fn();
		const actor = { getFlag: vi.fn(() => existing), update };

		await saveMoveCustomization(actor, DENY.key, { name: "Refuse", description: "A custom refusal." });

		expect(actor.getFlag).toHaveBeenCalledWith(MODULE_ID, "moveCustomizations");
		expect(update).toHaveBeenCalledWith({
			[`flags.${MODULE_ID}.moveCustomizations`]: {
				...existing,
				[DENY.key]: { name: "Refuse", description: "A custom refusal." }
			}
		});
	});

	it("starts from an empty bucket when nothing was previously stored", async () => {
		const update = vi.fn();
		const actor = { getFlag: vi.fn(() => undefined), update };

		await saveMoveCustomization(actor, DENY.key, { name: "Refuse", description: "A custom refusal." });

		expect(update).toHaveBeenCalledWith({
			[`flags.${MODULE_ID}.moveCustomizations`]: { [DENY.key]: { name: "Refuse", description: "A custom refusal." } }
		});
	});
});
