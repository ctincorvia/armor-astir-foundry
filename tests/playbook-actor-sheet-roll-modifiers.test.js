import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	rollMove: vi.fn()
}));

import { HOLD_MAX, configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { SPOTLIGHT_MIN } from "../scripts/playbook/playbook-sheet/progression-mixin.js";
import {
	ALCHEMICAL_SUITE,
	ALL_IN,
	ARTIFACT,
	BONDED_IN_BLOOD,
	BRANDED_BLADES,
	BULLHEADED,
	COOL_OFF,
	DARK_GUARANTEES,
	EMBRACE_CHAOS,
	EXCHANGE_BLOWS,
	FIELD_TESTING,
	IDENTIFY,
	MANAWHEELS,
	RAVENOUS_SPECTRE,
	READ_THE_ROOM,
	RESHAPE,
	SHARPER_KNIVES,
	SNAKES_IN_THE_GRASS,
	STRIKE_DECISIVELY,
	WATCH_THIS,
	WEATHER_THE_STORM,
	WEAVE_MAGIC,
	YOU_SHOULD_SEE_ME_IN_A_CROWN
} from "./helpers/move-fixtures.js";

beforeEach(() => {
	configureMoveRoll.mockClear();
	rollMove.mockClear();
	rollMove.mockResolvedValue({ message: undefined, dice: null });
});

// _rollModifierSources unions every source a grantsRollModifier spec can live on: picked playbook
// moves / the mounted Astir's own move (_grantingMoves, already covered by its own dedicated
// tests elsewhere), plus every part installed on the currently mounted frame (_mountedParts) --
// the one addition this function makes on top of _grantingMoves, since Alchemical Suite is a Part,
// not a move.
describe("PlaybookActorSheet#_rollModifierSources", () => {
	it("includes a picked playbook move that carries grantsRollModifier", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [SHARPER_KNIVES.key] } } };

		expect(sheet._rollModifierSources().map((s) => s.key)).toContain(SHARPER_KNIVES.key);
	});

	it("includes an installed part on the currently mounted frame", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [],
					astir: { id: "a1", piloted: true, parts: [ALCHEMICAL_SUITE.key] }
				}
			}
		};

		expect(sheet._rollModifierSources().map((s) => s.key)).toContain(ALCHEMICAL_SUITE.key);
	});

	it("excludes an installed part when nothing is mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [],
					astir: { id: "a1", piloted: false, parts: [ALCHEMICAL_SUITE.key] }
				}
			}
		};

		expect(sheet._rollModifierSources().map((s) => s.key)).not.toContain(ALCHEMICAL_SUITE.key);
	});
});

// Read the Room's shared hold pool vs a per-move flatHold/separateHold pool -- mirrors
// moves-mixin.js:202-204's own branch. Exercised against all three shapes: flatHold (Snakes in
// the Grass), separateHold-but-not-flatHold (Reshape), and neither (Read the Room, the shared
// pool).
describe("PlaybookActorSheet#_moveHoldValue", () => {
	it("reads a flatHold move's own per-move pool", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveHold: { [SNAKES_IN_THE_GRASS.key]: { value: 2 } } } }
		};

		expect(sheet._moveHoldValue(SNAKES_IN_THE_GRASS.key)).toBe(2);
	});

	it("reads a separateHold (but not flatHold) move's own per-move pool", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveHold: { [RESHAPE.key]: { value: 1 } } } }
		};

		expect(sheet._moveHoldValue(RESHAPE.key)).toBe(1);
	});

	it("reads the shared resources.hold pool for a move with neither flatHold nor separateHold", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {}, resources: { hold: { value: 3 } } } };

		expect(sheet._moveHoldValue(READ_THE_ROOM.key)).toBe(3);
	});

	it("defaults a missing per-move pool to 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._moveHoldValue(SNAKES_IN_THE_GRASS.key)).toBe(0);
	});

	it("defaults a missing shared pool to 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {}, resources: {} } };

		expect(sheet._moveHoldValue(READ_THE_ROOM.key)).toBe(0);
	});
});

describe("PlaybookActorSheet#_moveHoldUpdatePath", () => {
	it("returns the per-move moveHold path for a flatHold move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._moveHoldUpdatePath(SNAKES_IN_THE_GRASS.key)).toBe(
			`system.attributes.moveHold.${SNAKES_IN_THE_GRASS.key}.value`
		);
	});

	it("returns the per-move moveHold path for a separateHold move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._moveHoldUpdatePath(RESHAPE.key)).toBe(`system.attributes.moveHold.${RESHAPE.key}.value`);
	});

	it("returns the shared resources.hold path for a move with neither", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._moveHoldUpdatePath(READ_THE_ROOM.key)).toBe("system.resources.hold.value");
	});
});

// One case per gate kind (astir-moves.js's grantsRollModifier §1 doc comment), plus the no-gate
// fallback.
describe("PlaybookActorSheet#_rollModifierAvailability", () => {
	const [manawheelsSpec] = MANAWHEELS.grantsRollModifier;
	const [watchThisSpec] = WATCH_THIS.grantsRollModifier;
	const [snakesSpec] = SNAKES_IN_THE_GRASS.grantsRollModifier;
	const [identifySpec] = IDENTIFY.grantsRollModifier;
	const [blueSpec] = ALCHEMICAL_SUITE.grantsRollModifier;
	const [ravenousSpectreSpec] = RAVENOUS_SPECTRE.grantsRollModifier;
	const [sharperKnivesSpec] = SHARPER_KNIVES.grantsRollModifier;

	it("requiresOverheating: available while overheating, unavailable (with a reason) while not", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", overheating: true } } } };
		expect(sheet._rollModifierAvailability(manawheelsSpec, MANAWHEELS)).toEqual({ available: true, reason: null });

		sheet.actor.system.attributes.astir.overheating = false;
		expect(sheet._rollModifierAvailability(manawheelsSpec, MANAWHEELS)).toEqual({
			available: false,
			reason: "Not overheating"
		});
	});

	it("costsSpotlight: available at or above the cost, unavailable below it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 3 } } } };
		expect(sheet._rollModifierAvailability(watchThisSpec, WATCH_THIS)).toEqual({ available: true, reason: null });

		sheet.actor.system.attributes.spotlight.value = 2;
		expect(sheet._rollModifierAvailability(watchThisSpec, WATCH_THIS)).toEqual({
			available: false,
			reason: "Needs 3 Spotlight"
		});
	});

	it("costsSpotlight: treats a missing spotlight value as 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._rollModifierAvailability(watchThisSpec, WATCH_THIS)).toEqual({
			available: false,
			reason: "Needs 3 Spotlight"
		});
	});

	it("costsHold (own pool, no explicit moveKey): reads this source's own hold", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveHold: { [SNAKES_IN_THE_GRASS.key]: { value: 1 } } } }
		};
		expect(sheet._rollModifierAvailability(snakesSpec, SNAKES_IN_THE_GRASS)).toEqual({
			available: true,
			reason: null
		});

		sheet.actor.system.attributes.moveHold[SNAKES_IN_THE_GRASS.key].value = 0;
		expect(sheet._rollModifierAvailability(snakesSpec, SNAKES_IN_THE_GRASS)).toEqual({
			available: false,
			reason: "Needs 1 hold"
		});
	});

	it("costsHold (explicit cross-move moveKey): reads the named move's own pool, not the source's", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {}, resources: { hold: { value: 1 } } } };
		expect(sheet._rollModifierAvailability(identifySpec, IDENTIFY)).toEqual({ available: true, reason: null });

		sheet.actor.system.resources.hold.value = 0;
		expect(sheet._rollModifierAvailability(identifySpec, IDENTIFY)).toEqual({
			available: false,
			reason: "Needs 1 hold"
		});
	});

	it("costsPotion: available while the named color is unspent, unavailable once spent", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", potions: { blue: false } } } } };
		expect(sheet._rollModifierAvailability(blueSpec, ALCHEMICAL_SUITE)).toEqual({ available: true, reason: null });

		sheet.actor.system.attributes.astir.potions.blue = true;
		expect(sheet._rollModifierAvailability(blueSpec, ALCHEMICAL_SUITE)).toEqual({
			available: false,
			reason: "No blue Potion left"
		});
	});

	it("costsUse: available while the named use is unchecked, unavailable once checked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveUses: {} } } };
		expect(sheet._rollModifierAvailability(ravenousSpectreSpec, RAVENOUS_SPECTRE)).toEqual({
			available: true,
			reason: null
		});

		sheet.actor.system.attributes.moveUses[RAVENOUS_SPECTRE.key] = { triggered: true };
		expect(sheet._rollModifierAvailability(ravenousSpectreSpec, RAVENOUS_SPECTRE)).toEqual({
			available: false,
			reason: "Already used"
		});
	});

	it("no gate: always available", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._rollModifierAvailability(sharperKnivesSpec, SHARPER_KNIVES)).toEqual({
			available: true,
			reason: null
		});
	});
});

describe("PlaybookActorSheet#_rollModifiersForMove", () => {
	it("includes an unscoped entry (no moveKeys) for any move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [FIELD_TESTING.key] } } };

		const entries = sheet._rollModifiersForMove(EXCHANGE_BLOWS, null);

		expect(entries).toEqual([{
			key: FIELD_TESTING.key,
			label: FIELD_TESTING.name,
			description: FIELD_TESTING.description,
			advantage: "advantage",
			effect: null,
			reminderOnly: false,
			deferred: false,
			disabled: false,
			disabledReason: null
		}]);
	});

	it("includes a scoped entry for a matching move key", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [WATCH_THIS.key], spotlight: { value: 3 } } } };

		expect(sheet._rollModifiersForMove(WEATHER_THE_STORM, null).map((e) => e.key)).toEqual([WATCH_THIS.key]);
	});

	it("excludes a scoped entry for a non-matching move key", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [WATCH_THIS.key] } } };

		expect(sheet._rollModifiersForMove(READ_THE_ROOM, null)).toEqual([]);
	});

	it("disables a gated entry and surfaces the availability reason", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", piloted: true, overheating: false, move: MANAWHEELS.key } } }
		};

		const [entry] = sheet._rollModifiersForMove(WEAVE_MAGIC, null);

		expect(entry.disabled).toBe(true);
		expect(entry.disabledReason).toBe("Not overheating");
	});

	it("enables an available entry with no disabledReason", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", piloted: true, overheating: true, move: MANAWHEELS.key } } }
		};

		const [entry] = sheet._rollModifiersForMove(WEAVE_MAGIC, null);

		expect(entry.disabled).toBe(false);
		expect(entry.disabledReason).toBeNull();
	});

	it("disables an effect-setting entry when this roll's Effect is already locked, even though its own gate is open", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [YOU_SHOULD_SEE_ME_IN_A_CROWN.key] } } };

		const [entry] = sheet._rollModifiersForMove(READ_THE_ROOM, "desperation");

		expect(entry.disabled).toBe(true);
		expect(entry.disabledReason).toBe("Effect already set");
	});

	it("leaves an effect-setting entry enabled when nothing else has locked this roll's Effect", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [YOU_SHOULD_SEE_ME_IN_A_CROWN.key] } } };

		const [entry] = sheet._rollModifiersForMove(READ_THE_ROOM, null);

		expect(entry.disabled).toBe(false);
	});

	it("does not disable an advantage-only entry just because Effect is locked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [SHARPER_KNIVES.key] } } };

		const [entry] = sheet._rollModifiersForMove(READ_THE_ROOM, "desperation");

		expect(entry.disabled).toBe(false);
	});

	it("renders a reminderOnly entry as never gated or disabled, with no advantage/effect", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [DARK_GUARANTEES.key] } } };

		expect(sheet._rollModifiersForMove(READ_THE_ROOM, "desperation")).toEqual([{
			key: DARK_GUARANTEES.key,
			label: DARK_GUARANTEES.name,
			description: DARK_GUARANTEES.description,
			advantage: null,
			effect: null,
			reminderOnly: true,
			deferred: false,
			disabled: false,
			disabledReason: null
		}]);
	});

	it("carries deferred through to the entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [SNAKES_IN_THE_GRASS.key],
					moveHold: { [SNAKES_IN_THE_GRASS.key]: { value: 1 } }
				}
			}
		};

		const [entry] = sheet._rollModifiersForMove(EXCHANGE_BLOWS, null);

		expect(entry.deferred).toBe(true);
	});

	it("gives Alchemical Suite's two specs off one source their own unique keys/labels/descriptions", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [],
					astir: { id: "a1", piloted: true, parts: [ALCHEMICAL_SUITE.key], potions: { blue: false, yellow: false } }
				}
			}
		};

		const weaveMagicEntries = sheet._rollModifiersForMove(WEAVE_MAGIC, null);
		const strikeEntries = sheet._rollModifiersForMove(STRIKE_DECISIVELY, null);

		expect(weaveMagicEntries.map((e) => e.key)).toEqual(["blue"]);
		expect(weaveMagicEntries[0].label).toBe("Blue Potion");
		expect(strikeEntries.map((e) => e.key)).toEqual(["yellow"]);
		expect(strikeEntries[0].label).toBe("Yellow Potion");
		expect(strikeEntries[0].effect).toBe("confidence");
	});

	it("resolves Artifact's own entry, unscoped, disabled once its Expended checkbox is already set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [],
					astir: { id: "a1", piloted: true, parts: [ARTIFACT.key] }
				}
			}
		};

		const [entry] = sheet._rollModifiersForMove(EXCHANGE_BLOWS, null);

		expect(entry).toEqual({
			key: ARTIFACT.key,
			label: "Advantage from Artifact",
			description: "Grants advantage towards a task this Artifact is designed for.",
			advantage: "advantage",
			effect: null,
			reminderOnly: false,
			deferred: false,
			disabled: false,
			disabledReason: null
		});

		sheet.actor.system.attributes.moveUses = { [ARTIFACT.key]: { expended: true } };
		const [expendedEntry] = sheet._rollModifiersForMove(EXCHANGE_BLOWS, null);

		expect(expendedEntry.disabled).toBe(true);
		expect(expendedEntry.disabledReason).toBe("Already used");
	});
});

describe("PlaybookActorSheet#_rollStackModifier", () => {
	it("returns null when All In hasn't been picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._rollStackModifier()).toBeNull();
	});

	it("resolves All In's own grantsRollStack spec once picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [ALL_IN.key] } } };

		expect(sheet._rollStackModifier()).toEqual({
			key: ALL_IN.key,
			label: ALL_IN.name,
			...ALL_IN.grantsRollStack
		});
	});
});

// The mirror image of _availableAutomaticSuccess (unit-tested through integration elsewhere, e.g.
// playbook-actor-sheet-the-captain.test.js) -- direct unit tests here since Embrace Chaos is the
// flag's only source. Scoping (moves/excludeMoves) and the picked-source gate mirror that resolver
// exactly; the HOLD_MAX ceiling is the one gate this resolver adds on top.
describe("PlaybookActorSheet#_availableDowngrade", () => {
	it("offers Embrace Chaos's downgrade once picked, with room left in its own hold pool", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [EMBRACE_CHAOS.key], moveHold: { [EMBRACE_CHAOS.key]: { value: 0 } } } }
		};

		expect(sheet._availableDowngrade(EXCHANGE_BLOWS)).toEqual([
			{ key: EMBRACE_CHAOS.key, name: EMBRACE_CHAOS.name, amount: 1 }
		]);
	});

	it("withholds the offer once the source's own hold pool is at HOLD_MAX", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { playbookMoves: [EMBRACE_CHAOS.key], moveHold: { [EMBRACE_CHAOS.key]: { value: HOLD_MAX } } }
			}
		};

		expect(sheet._availableDowngrade(EXCHANGE_BLOWS)).toEqual([]);
	});

	it("withholds the offer entirely when the source hasn't been picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._availableDowngrade(EXCHANGE_BLOWS)).toEqual([]);
	});

	it("treats a missing moveHold pool as 0, offering the downgrade", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [EMBRACE_CHAOS.key] } } };

		expect(sheet._availableDowngrade(EXCHANGE_BLOWS)).toEqual([
			{ key: EMBRACE_CHAOS.key, name: EMBRACE_CHAOS.name, amount: 1 }
		]);
	});
});

describe("PlaybookActorSheet#_disadvantageConversionModifier", () => {
	it("returns null when Embrace Chaos hasn't been picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._disadvantageConversionModifier()).toBeNull();
	});

	it("returns null once picked but unaffordable (below its own hold cost)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [EMBRACE_CHAOS.key], moveHold: { [EMBRACE_CHAOS.key]: { value: 0 } } } }
		};

		expect(sheet._disadvantageConversionModifier()).toBeNull();
	});

	it("resolves the source once picked and affordable", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [EMBRACE_CHAOS.key], moveHold: { [EMBRACE_CHAOS.key]: { value: 1 } } } }
		};

		expect(sheet._disadvantageConversionModifier()).toEqual({
			key: EMBRACE_CHAOS.key,
			label: EMBRACE_CHAOS.name,
			...EMBRACE_CHAOS.grantsDisadvantageConversion
		});
	});
});

describe("PlaybookActorSheet#_spendDisadvantageConversion", () => {
	it("decrements the source's own hold pool by the spent amount", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveHold: { [EMBRACE_CHAOS.key]: { value: 1 } } } },
			update: vi.fn()
		};

		await sheet._spendDisadvantageConversion(EMBRACE_CHAOS.key, 1);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveHold.${EMBRACE_CHAOS.key}.value`]: 0
		});
	});

	it("clamps the spend at HOLD_MIN rather than going negative", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveHold: { [EMBRACE_CHAOS.key]: { value: 0 } } } },
			update: vi.fn()
		};

		await sheet._spendDisadvantageConversion(EMBRACE_CHAOS.key, 1);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveHold.${EMBRACE_CHAOS.key}.value`]: 0
		});
	});
});

describe("PlaybookActorSheet#_spendRollModifiers", () => {
	it("does nothing for an empty list", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._spendRollModifiers([]);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("costsSpotlight: decrements Spotlight by the cost, clamped to SPOTLIGHT_MIN", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [WATCH_THIS.key], spotlight: { value: 1 } } },
			update: vi.fn()
		};

		await sheet._spendRollModifiers([WATCH_THIS.key]);

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": SPOTLIGHT_MIN });
	});

	it("costsSpotlight: treats a missing spotlight value as 0 before clamping", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [WATCH_THIS.key] } },
			update: vi.fn()
		};

		await sheet._spendRollModifiers([WATCH_THIS.key]);

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": SPOTLIGHT_MIN });
	});

	it("costsHold (own pool) + deferred: decrements this source's own hold and writes a pendingRollModifiers marker", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { playbookMoves: [SNAKES_IN_THE_GRASS.key], moveHold: { [SNAKES_IN_THE_GRASS.key]: { value: 1 } } }
			},
			update: vi.fn()
		};

		await sheet._spendRollModifiers([SNAKES_IN_THE_GRASS.key]);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveHold.${SNAKES_IN_THE_GRASS.key}.value`]: 0,
			[`system.attributes.pendingRollModifiers.${SNAKES_IN_THE_GRASS.key}.default`]: true
		});
	});

	it("costsHold (explicit cross-move moveKey), not deferred: decrements the named move's shared pool only", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [IDENTIFY.key] }, resources: { hold: { value: 2 } } },
			update: vi.fn()
		};

		await sheet._spendRollModifiers([IDENTIFY.key]);

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 1 });
	});

	it("costsPotion + deferred (Alchemical Suite's own specKey): marks the named color spent and writes its own pending marker", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [],
					astir: { id: "a1", piloted: true, parts: [ALCHEMICAL_SUITE.key], potions: { blue: false } }
				}
			},
			update: vi.fn()
		};

		await sheet._spendRollModifiers(["blue"]);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.potions.blue": true,
			[`system.attributes.pendingRollModifiers.${ALCHEMICAL_SUITE.key}.blue`]: true
		});
	});

	it("costsPotion: treats a missing potions object as available", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [],
					astir: { id: "a1", piloted: true, parts: [ALCHEMICAL_SUITE.key] }
				}
			},
			update: vi.fn()
		};

		await sheet._spendRollModifiers(["blue"]);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.potions.blue": true,
			[`system.attributes.pendingRollModifiers.${ALCHEMICAL_SUITE.key}.blue`]: true
		});
	});

	it("costsUse + deferred: marks the named use spent and writes a pendingRollModifiers marker", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [RAVENOUS_SPECTRE.key] } },
			update: vi.fn()
		};

		await sheet._spendRollModifiers([RAVENOUS_SPECTRE.key]);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${RAVENOUS_SPECTRE.key}.triggered`]: true,
			[`system.attributes.pendingRollModifiers.${RAVENOUS_SPECTRE.key}.default`]: true
		});
	});

	it("costsUse, not deferred (Artifact): marks its own Expended checkbox, with no pendingRollModifiers marker", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [],
					astir: { id: "a1", piloted: true, parts: [ARTIFACT.key] }
				}
			},
			update: vi.fn()
		};

		await sheet._spendRollModifiers([ARTIFACT.key]);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${ARTIFACT.key}.expended`]: true
		});
	});

	it("a checked no-gate entry writes nothing", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [SHARPER_KNIVES.key] } },
			update: vi.fn()
		};

		await sheet._spendRollModifiers([SHARPER_KNIVES.key]);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("skips a picked source that carries no grantsRollModifier at all", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			// cantrips:haste has no grantsRollModifier of its own -- present here purely so
			// _rollModifierSources() includes at least one source whose own `grantsRollModifier ?? []`
			// fallback actually fires, alongside Sharper Knives' real (no-gate) entry.
			system: { attributes: { playbookMoves: ["cantrips:haste", SHARPER_KNIVES.key] } },
			update: vi.fn()
		};

		await sheet._spendRollModifiers([SHARPER_KNIVES.key]);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("only writes updates for keys that were actually checked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [WATCH_THIS.key],
					spotlight: { value: 3 },
					astir: { id: "a1", piloted: true, overheating: true, move: BRANDED_BLADES.key }
				}
			},
			update: vi.fn()
		};

		await sheet._spendRollModifiers([WATCH_THIS.key]);

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 0 });
	});
});

describe("PlaybookActorSheet#_pendingRollModifierGrant", () => {
	it("returns null when nothing is pending", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [SNAKES_IN_THE_GRASS.key] } } };

		expect(sheet._pendingRollModifierGrant(EXCHANGE_BLOWS)).toBeNull();
	});

	it("resolves an unscoped pending grant for any move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [SNAKES_IN_THE_GRASS.key],
					pendingRollModifiers: { [SNAKES_IN_THE_GRASS.key]: { default: true } }
				}
			}
		};

		expect(sheet._pendingRollModifierGrant(EXCHANGE_BLOWS)).toEqual({
			advantage: "advantage",
			effect: null,
			sourceKey: SNAKES_IN_THE_GRASS.key,
			specKey: "default"
		});
	});

	it("resolves a scoped pending grant only for a matching move key", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [RAVENOUS_SPECTRE.key],
					pendingRollModifiers: { [RAVENOUS_SPECTRE.key]: { default: true } }
				}
			}
		};

		expect(sheet._pendingRollModifierGrant(COOL_OFF)).toEqual({
			advantage: "advantage",
			effect: null,
			sourceKey: RAVENOUS_SPECTRE.key,
			specKey: "default"
		});
		expect(sheet._pendingRollModifierGrant(READ_THE_ROOM)).toBeNull();
	});

	it("skips a non-deferred entry even when it's the only source present", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [SHARPER_KNIVES.key] } } };

		expect(sheet._pendingRollModifierGrant(EXCHANGE_BLOWS)).toBeNull();
	});

	it("resolves Alchemical Suite's own specKey, not a shared default, once its Blue Potion grant is pending", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [],
					astir: { id: "a1", piloted: true, parts: [ALCHEMICAL_SUITE.key] },
					pendingRollModifiers: { [ALCHEMICAL_SUITE.key]: { blue: true } }
				}
			}
		};

		expect(sheet._pendingRollModifierGrant(WEAVE_MAGIC)).toEqual({
			advantage: "advantage",
			effect: null,
			sourceKey: ALCHEMICAL_SUITE.key,
			specKey: "blue"
		});
	});

	it("carries an effect-only grant's effect through", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [],
					astir: { id: "a1", piloted: true, parts: [ALCHEMICAL_SUITE.key] },
					pendingRollModifiers: { [ALCHEMICAL_SUITE.key]: { yellow: true } }
				}
			}
		};

		expect(sheet._pendingRollModifierGrant(STRIKE_DECISIVELY)).toEqual({
			advantage: null,
			effect: "confidence",
			sourceKey: ALCHEMICAL_SUITE.key,
			specKey: "yellow"
		});
	});
});

describe("PlaybookActorSheet#_clearPendingRollModifier", () => {
	it("writes false to the pending grant's own path", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		await sheet._clearPendingRollModifier(SNAKES_IN_THE_GRASS.key, "default");

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.pendingRollModifiers.${SNAKES_IN_THE_GRASS.key}.default`]: false
		});
	});
});

// Regression: Bonded In Blood follows the exact same unscoped-deferred-uses shape as Ravenous
// Spectre above, just with its own use key -- one pass-through case so this catalog entry's own
// call site isn't dead code.
describe("PlaybookActorSheet#_rollModifiersForMove - Bonded In Blood", () => {
	it("is unscoped, deferred, and gated on its own uses checkbox", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BONDED_IN_BLOOD.key] } } };

		const [entry] = sheet._rollModifiersForMove(READ_THE_ROOM, null);

		expect(entry.deferred).toBe(true);
		expect(entry.disabled).toBe(false);

		sheet.actor.system.attributes.moveUses = { [BONDED_IN_BLOOD.key]: { "took-peril": true } };
		expect(sheet._rollModifiersForMove(READ_THE_ROOM, null)[0].disabled).toBe(true);
	});
});

// Regression: Bullheaded (the-impostor.js) follows the same unscoped-deferred-uses shape too, just
// with its own "took a risk" use key -- same one-pass-through-case treatment as Bonded In Blood
// above, so this catalog entry's own call site isn't dead code either.
describe("PlaybookActorSheet#_rollModifiersForMove - Bullheaded", () => {
	it("is unscoped, deferred, and gated on its own uses checkbox", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BULLHEADED.key] } } };

		const [entry] = sheet._rollModifiersForMove(READ_THE_ROOM, null);

		expect(entry.deferred).toBe(true);
		expect(entry.disabled).toBe(false);

		sheet.actor.system.attributes.moveUses = { [BULLHEADED.key]: { "took-risk": true } };
		expect(sheet._rollModifiersForMove(READ_THE_ROOM, null)[0].disabled).toBe(true);
	});
});

// The one-shot deferred mechanism's wiring into _rollMove itself (move-roll-mixin.js) — the unit
// tests above exercise _pendingRollModifierGrant/_clearPendingRollModifier/_spendRollModifiers in
// isolation; these confirm _rollMove actually reads/clears/spends through the real precedence
// chain, mirroring the existing target-matchup/Cold Company integration tests (e.g.
// playbook-actor-sheet-move-roll-targets.test.js, playbook-actor-sheet-wither.test.js).
describe("PlaybookActorSheet#_rollMove - pending Roll Modifier grant", () => {
	it("folds a pending grant's effect into lockedEffect when nothing else forces it", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					astir: { id: "a1", piloted: true, parts: [ALCHEMICAL_SUITE.key] },
					pendingRollModifiers: { [ALCHEMICAL_SUITE.key]: { yellow: true } }
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "strike-decisively" } } });

		// strike-decisively is usesWeapon, so lockedEffect now lives on the (only, Unarmed)
		// weaponBundles entry rather than at the top level — see
		// PlaybookActorSheet#_rollMoveWithWeaponChoice/_weaponRollBundle.
		expect(configureMoveRoll).toHaveBeenCalledWith(
			expect.objectContaining({ key: "strike-decisively" }),
			expect.any(Array),
			expect.objectContaining({
				weaponBundles: [expect.objectContaining({ lockedEffect: "confidence" })]
			})
		);
	});

	it("folds a pending grant's advantage into lockedAdvantage when nothing else forces it", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					playbookMoves: [SNAKES_IN_THE_GRASS.key],
					pendingRollModifiers: { [SNAKES_IN_THE_GRASS.key]: { default: true } }
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "cool-off" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			COOL_OFF,
			expect.any(Array),
			expect.objectContaining({ lockedAdvantage: "advantage" })
		);
	});

	it("clears the pending grant once the roll dialog resolves with a real selection", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					playbookMoves: [SNAKES_IN_THE_GRASS.key],
					pendingRollModifiers: { [SNAKES_IN_THE_GRASS.key]: { default: true } }
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: undefined, advantage: "advantage", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "cool-off" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.pendingRollModifiers.${SNAKES_IN_THE_GRASS.key}.default`]: false
		});
	});

	// The array-branch counterpart (_rollMoveWithWeaponChoice) of the single-weapon-path test above
	// — a usesWeapon move's own copy of the same read-then-clear wiring (see move-roll-mixin.js's
	// own comment on why the two paths mirror each other field-for-field).
	it("clears the pending grant through the usesWeapon (array) branch too", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					playbookMoves: [SNAKES_IN_THE_GRASS.key],
					pendingRollModifiers: { [SNAKES_IN_THE_GRASS.key]: { default: true } },
					equipment: []
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({
			trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "advantage", effect: "none", weaponId: "unarmed"
		});

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.pendingRollModifiers.${SNAKES_IN_THE_GRASS.key}.default`]: false
		});
	});

	it("does not clear anything when the dialog is dismissed without a selection", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					playbookMoves: [SNAKES_IN_THE_GRASS.key],
					pendingRollModifiers: { [SNAKES_IN_THE_GRASS.key]: { default: true } }
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "cool-off" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does not clear anything when nothing was pending", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: {}, attributes: { playbookMoves: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: undefined, advantage: "none", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "cool-off" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("spends every checked roll modifier once the roll dialog resolves", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { playbookMoves: [WATCH_THIS.key], spotlight: { value: 3 } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({
			trait: undefined, advantage: "advantage", effect: "none", spentRollModifiers: [WATCH_THIS.key]
		});

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "weather-the-storm" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 0 });
	});

	it("does not call _spendRollModifiers when nothing was checked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: {}, attributes: { playbookMoves: [WATCH_THIS.key], spotlight: { value: 3 } } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: undefined, advantage: "none", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "weather-the-storm" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

// _rollMove's wiring of configureMoveRoll's own spentDisadvantageConversion flag into
// _spendDisadvantageConversion — mirrors the "spends every checked roll modifier" integration test
// above, just for Embrace Chaos's own single-source spend instead of the list-shaped Roll Modifiers.
// Deliberately a non-usesWeapon move (Read the Room, not Exchange Blows/Strike Decisively):
// grantsDisadvantageConversion is universal, unscoped by move key, and a non-usesWeapon move keeps
// this test on _rollMove's own single-weapon path (weapon stays undefined) rather than
// _rollMoveWithWeaponChoice's array branch, which playbook-actor-sheet-roll-modifiers.test.js's own
// Roll Modifiers integration tests above already cover separately.
describe("PlaybookActorSheet#_rollMove - disadvantageConversion spend (Embrace Chaos)", () => {
	it("spends the source's own hold once the roll dialog resolves with spentDisadvantageConversion", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 0 } },
				attributes: { playbookMoves: [EMBRACE_CHAOS.key], moveHold: { [EMBRACE_CHAOS.key]: { value: 1 } } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({
			trait: { key: "sense", label: "SENSE", value: 0 },
			advantage: "advantage",
			effect: "none",
			spentDisadvantageConversion: true
		});

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "read-the-room" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveHold.${EMBRACE_CHAOS.key}.value`]: 0
		});
	});

	it("does not spend anything when spentDisadvantageConversion wasn't set", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 0 } },
				attributes: { playbookMoves: [EMBRACE_CHAOS.key], moveHold: { [EMBRACE_CHAOS.key]: { value: 1 } } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({
			trait: { key: "sense", label: "SENSE", value: 0 }, advantage: "none", effect: "none"
		});

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "read-the-room" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	// The array-branch counterpart (_rollMoveWithWeaponChoice) of the single-weapon-path test above
	// — a usesWeapon move with no weapons at all still resolves through the same
	// spentDisadvantageConversion wiring, just via its own copy of the read/spend (see
	// move-roll-mixin.js's own comment on why the two paths mirror each other field-for-field).
	it("spends the source's own hold through the usesWeapon (array) branch too", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					playbookMoves: [EMBRACE_CHAOS.key], moveHold: { [EMBRACE_CHAOS.key]: { value: 1 } }, equipment: []
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({
			trait: { key: "clash", label: "CLASH", value: 0 },
			advantage: "advantage",
			effect: "none",
			spentDisadvantageConversion: true,
			weaponId: "unarmed"
		});

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveHold.${EMBRACE_CHAOS.key}.value`]: 0
		});
	});
});
