import { afterEach, describe, expect, it, vi } from "vitest";

import { MODULE_ID } from "../scripts/module-id.js";
import {
	ENABLE_MOVE_CUSTOMIZATION_SETTING,
	customizedMove,
	isCustomizableMoveKey,
	isMoveCustomizationActiveFor,
	isMoveCustomizationEnabled,
	moveCustomizationOverrides,
	saveMoveCustomization
} from "../scripts/moves/move-customization.js";
import { ARTIFACT, DENY, EXCHANGE_BLOWS, RESISTANCE_CHARMS } from "./helpers/move-fixtures.js";
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

describe("isMoveCustomizationActiveFor", () => {
	it("is true when the setting is on for any eligible key", () => {
		game.settings.get.mockReturnValue(true);

		expect(isMoveCustomizationActiveFor(DENY.key)).toBe(true);
	});

	it("is true when the setting is off but the key is Resistance Charms", () => {
		game.settings.get.mockReturnValue(false);

		expect(isMoveCustomizationActiveFor(RESISTANCE_CHARMS.key)).toBe(true);
	});

	it("is true when the setting is off but the key is Artifact", () => {
		game.settings.get.mockReturnValue(false);

		expect(isMoveCustomizationActiveFor(ARTIFACT.key)).toBe(true);
	});

	it("is false when the setting is off for an ordinary eligible key", () => {
		game.settings.get.mockReturnValue(false);

		expect(isMoveCustomizationActiveFor(DENY.key)).toBe(false);
	});

	it("is false for an ineligible key regardless of the setting", () => {
		game.settings.get.mockReturnValue(true);

		expect(isMoveCustomizationActiveFor(EXCHANGE_BLOWS.key)).toBe(false);
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

	it("returns {} without calling actor.getFlag when the setting is off and presentKeys has no always-active key", () => {
		const getFlag = vi.fn();

		expect(moveCustomizationOverrides({ getFlag }, false, [DENY.key])).toEqual({});
		expect(getFlag).not.toHaveBeenCalled();
	});

	it("filters the stored bucket down to only the always-active keys present in presentKeys, with the setting off", () => {
		const stored = {
			[ARTIFACT.key]: { name: "Heirloom", description: "A custom artifact." },
			[DENY.key]: { name: "Refuse", description: "A custom refusal." }
		};
		const getFlag = vi.fn(() => stored);

		const result = moveCustomizationOverrides({ getFlag }, false, [ARTIFACT.key, DENY.key]);

		expect(getFlag).toHaveBeenCalledWith(MODULE_ID, "moveCustomizations");
		expect(result).toEqual({ [ARTIFACT.key]: stored[ARTIFACT.key] });
	});

	it("drops an always-active key from presentKeys with nothing stored for it, with the setting off", () => {
		const getFlag = vi.fn(() => ({}));

		expect(moveCustomizationOverrides({ getFlag }, false, [ARTIFACT.key])).toEqual({});
	});

	it("falls back to {} internally when the setting is off, an always-active key is present, and getFlag returns nothing stored yet", () => {
		const getFlag = vi.fn(() => undefined);

		expect(moveCustomizationOverrides({ getFlag }, false, [ARTIFACT.key])).toEqual({});
		expect(getFlag).toHaveBeenCalledWith(MODULE_ID, "moveCustomizations");
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
