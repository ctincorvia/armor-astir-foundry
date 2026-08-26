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
	DARK_GUARANTEES,
	EMBRACE_CHAOS,
	EXCHANGE_BLOWS,
	FIELD_TESTING,
	IDENTIFY,
	MANAWHEELS,
	PREPARE_RITUALS,
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

const PREPARE_RITUALS_KEY = PREPARE_RITUALS.key;

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

	// The Arcanist's synthesized ritual source (arcanist-mixin.js's _ritualRollModifierSource) —
	// unlike _grantingMoves/_mountedParts, this isn't a static catalog entry at all, so it's omitted
	// entirely (not an empty placeholder) with nothing prepared, and appears keyed to the real
	// Prepare Rituals move once something is.
	it("omits the ritual source with nothing prepared", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._rollModifierSources().map((s) => s.key)).not.toContain(PREPARE_RITUALS_KEY);
	});

	it("includes the ritual source, keyed to the real Prepare Rituals move, once a Warding ritual is prepared", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { arcanist: { rituals: [{ ritualKey: "arcanist-ritual:warding" }, null, null] } } }
		};

		expect(sheet._rollModifierSources().map((s) => s.key)).toContain(PREPARE_RITUALS_KEY);
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
	const [embraceChaosSpec] = EMBRACE_CHAOS.grantsRollModifier;
	const [identifySpec] = IDENTIFY.grantsRollModifier;
	const [blueSpec] = ALCHEMICAL_SUITE.grantsRollModifier;
	const [artifactSpec] = ARTIFACT.grantsRollModifier;
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
			system: { attributes: { moveHold: { [EMBRACE_CHAOS.key]: { value: 1 } } } }
		};
		expect(sheet._rollModifierAvailability(embraceChaosSpec, EMBRACE_CHAOS)).toEqual({
			available: true,
			reason: null
		});

		sheet.actor.system.attributes.moveHold[EMBRACE_CHAOS.key].value = 0;
		expect(sheet._rollModifierAvailability(embraceChaosSpec, EMBRACE_CHAOS)).toEqual({
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
		expect(sheet._rollModifierAvailability(artifactSpec, ARTIFACT)).toEqual({
			available: true,
			reason: null
		});

		sheet.actor.system.attributes.moveUses[ARTIFACT.key] = { expended: true };
		expect(sheet._rollModifierAvailability(artifactSpec, ARTIFACT)).toEqual({
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

	// costsTracker (see the Arcanist's Warding ritual, arcanist-mixin.js) — the first gate kind that
	// reads/writes a numericTrackers pool instead of hold/a uses checkbox/a Potion, shaped exactly
	// like costsHold otherwise, down to the optional cross-move moveKey.
	describe("costsTracker", () => {
		const source = { key: PREPARE_RITUALS_KEY };
		const spec = { costsTracker: { trackerKey: "ward-hold", amount: 1 } };

		it("available at or above the amount, unavailable below it", () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = {
				system: { attributes: { moveTrackers: { [PREPARE_RITUALS_KEY]: { "ward-hold": 1 } } } }
			};
			expect(sheet._rollModifierAvailability(spec, source)).toEqual({ available: true, reason: null });

			sheet.actor.system.attributes.moveTrackers[PREPARE_RITUALS_KEY]["ward-hold"] = 0;
			expect(sheet._rollModifierAvailability(spec, source)).toEqual({
				available: false,
				reason: "Needs 1 Ward Hold"
			});
		});

		it("treats a missing tracker value as 0", () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = { system: { attributes: {} } };

			expect(sheet._rollModifierAvailability(spec, source)).toEqual({
				available: false,
				reason: "Needs 1 Ward Hold"
			});
		});

		it("reads a named cross-move moveKey's own pool instead of the source's", () => {
			const sheet = new PlaybookActorSheet();
			const crossSpec = { costsTracker: { moveKey: "some-other-move", trackerKey: "ward-hold", amount: 1 } };
			sheet.actor = {
				system: { attributes: { moveTrackers: { "some-other-move": { "ward-hold": 1 } } } }
			};

			expect(sheet._rollModifierAvailability(crossSpec, source)).toEqual({ available: true, reason: null });
		});

		it("falls back to the raw trackerKey in the reason when the catalog label can't be resolved", () => {
			const sheet = new PlaybookActorSheet();
			const unknownSpec = { costsTracker: { moveKey: "not-a-real-move", trackerKey: "made-up", amount: 1 } };
			sheet.actor = { system: { attributes: {} } };

			expect(sheet._rollModifierAvailability(unknownSpec, source)).toEqual({
				available: false,
				reason: "Needs 1 made-up"
			});
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
			requiresAdvantage: null,
			reminderOnly: false,
			disabled: false,
			disabledReason: null,
			forced: false
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
			requiresAdvantage: null,
			reminderOnly: true,
			disabled: false,
			disabledReason: null,
			forced: false
		}]);
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
			requiresAdvantage: null,
			reminderOnly: false,
			disabled: false,
			disabledReason: null,
			forced: false
		});

		sheet.actor.system.attributes.moveUses = { [ARTIFACT.key]: { expended: true } };
		const [expendedEntry] = sheet._rollModifiersForMove(EXCHANGE_BLOWS, null);

		expect(expendedEntry.disabled).toBe(true);
		expect(expendedEntry.disabledReason).toBe("Already used");
	});

	// requiresAdvantage (see roll-chain.js's resolveRollChain/chainEntryResult) is a NEW gate a spec
	// can carry on top of any resource gate, threaded straight through onto the resolved entry so
	// the move-roll dialog's own render callback can re-check it live -- All In (cantrips.js) is the
	// catalog's own example.
	it("threads a spec's own requiresAdvantage through to the resolved entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [ALL_IN.key] } } };

		const [entry] = sheet._rollModifiersForMove(EXCHANGE_BLOWS, null);

		expect(entry.requiresAdvantage).toEqual(["advantage"]);
	});

	it("defaults requiresAdvantage to null for a spec that doesn't carry one", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [SHARPER_KNIVES.key] } } };

		const [entry] = sheet._rollModifiersForMove(READ_THE_ROOM, null);

		expect(entry.requiresAdvantage).toBeNull();
	});

	// The Arcanist's Prepare Rituals synthesized source (arcanist-mixin.js) — confidence entries
	// scope themselves to their own stored target move only, two slots of the same ritual type never
	// collide (each keeps its own "ritual-N" key), and a spent confidence entry stays visible but
	// disabled, the same "always shown, only ever disabled" treatment every other costsUse entry
	// (e.g. Artifact) already gets.
	describe("the Arcanist's Prepare Rituals", () => {
		it("scopes a confidence entry to its own stored target move only", () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = {
				system: {
					attributes: {
						arcanist: { rituals: [{ ritualKey: "arcanist-ritual:confidence", moveKey: WEATHER_THE_STORM.key }, null, null] }
					}
				}
			};

			expect(sheet._rollModifiersForMove(WEATHER_THE_STORM, null).map((e) => e.key)).toEqual(["ritual-1"]);
			expect(sheet._rollModifiersForMove(READ_THE_ROOM, null)).toEqual([]);
		});

		it("gives two slots holding the same ritual type their own independently checkable entries", () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = {
				system: {
					attributes: {
						arcanist: {
							rituals: [{ ritualKey: "arcanist-ritual:warding" }, { ritualKey: "arcanist-ritual:warding" }, null]
						},
						moveTrackers: { [PREPARE_RITUALS_KEY]: { "ward-hold": 4 } }
					}
				}
			};

			const entries = sheet._rollModifiersForMove(EXCHANGE_BLOWS, null);

			expect(entries.map((e) => e.key)).toEqual(["ritual-1", "ritual-2"]);
			expect(entries.every((e) => !e.disabled)).toBe(true);
		});

		it("renders a spent confidence entry disabled, with its own reason", () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = {
				system: {
					attributes: {
						arcanist: { rituals: [{ ritualKey: "arcanist-ritual:confidence", moveKey: WEATHER_THE_STORM.key }, null, null] },
						moveUses: { [PREPARE_RITUALS_KEY]: { "ritual-1": true } }
					}
				}
			};

			const [entry] = sheet._rollModifiersForMove(WEATHER_THE_STORM, null);

			expect(entry.disabled).toBe(true);
			expect(entry.disabledReason).toBe("Already used");
		});

		it("produces no roll-modifier source at all for an Aspect-only prepared slot (it carries no rollModifier)", () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = {
				system: { attributes: { arcanist: { rituals: [{ ritualKey: "arcanist-ritual:aspect" }, null, null] } } }
			};

			expect(sheet._rollModifiersForMove(EXCHANGE_BLOWS, null)).toEqual([]);
			expect(sheet._rollModifierSources().map((s) => s.key)).not.toContain(PREPARE_RITUALS_KEY);
		});

		it("labels a confidence entry with no stored moveKey by the ritual name alone, scoped to no move", () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = {
				system: { attributes: { arcanist: { rituals: [{ ritualKey: "arcanist-ritual:confidence" }, null, null] } } }
			};

			const [entry] = sheet._rollModifiersForMove(EXCHANGE_BLOWS, null);

			expect(entry).toBeUndefined();
			const source = sheet._ritualRollModifierSource();
			expect(source.grantsRollModifier[0]).toEqual(expect.objectContaining({
				label: "Make a Move in Confidence",
				moveKeys: []
			}));
		});

		it("falls back to the raw moveKey in a confidence entry's label when it no longer resolves in ALL_MOVES", () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = {
				system: {
					attributes: {
						arcanist: { rituals: [{ ritualKey: "arcanist-ritual:confidence", moveKey: "stale-move-key" }, null, null] }
					}
				}
			};

			const source = sheet._ritualRollModifierSource();

			expect(source.grantsRollModifier[0]).toEqual(expect.objectContaining({
				label: "Make a Move in Confidence: stale-move-key",
				moveKeys: ["stale-move-key"]
			}));
		});

		it("renders a Warding entry disabled once its shared Wardhold pool is empty", () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = {
				system: {
					attributes: {
						arcanist: { rituals: [{ ritualKey: "arcanist-ritual:warding" }, null, null] },
						moveTrackers: { [PREPARE_RITUALS_KEY]: { "ward-hold": 0 } }
					}
				}
			};

			const [entry] = sheet._rollModifiersForMove(EXCHANGE_BLOWS, null);

			expect(entry.disabled).toBe(true);
			expect(entry.disabledReason).toBe("Needs 1 Ward Hold");
			expect(entry.advantage).toBe("advantage");
			expect(entry.requiresAdvantage).toEqual(["disadvantage", "disadvantage2"]);
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

	it("costsHold (own pool, no explicit moveKey): decrements this source's own hold", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { playbookMoves: [EMBRACE_CHAOS.key], moveHold: { [EMBRACE_CHAOS.key]: { value: 1 } } }
			},
			update: vi.fn()
		};

		await sheet._spendRollModifiers([EMBRACE_CHAOS.key]);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveHold.${EMBRACE_CHAOS.key}.value`]: 0
		});
	});

	it("costsHold (explicit cross-move moveKey): decrements the named move's shared pool only", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [IDENTIFY.key] }, resources: { hold: { value: 2 } } },
			update: vi.fn()
		};

		await sheet._spendRollModifiers([IDENTIFY.key]);

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 1 });
	});

	it("costsPotion (Alchemical Suite's own spec key): marks the named color spent, on demand", async () => {
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
			"system.attributes.astir.potions.blue": true
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
			"system.attributes.astir.potions.blue": true
		});
	});

	it("costsUse (Artifact): marks its own Expended checkbox", async () => {
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

	// costsTracker's own spend (the Arcanist's Warding ritual) — shaped exactly like costsHold's
	// write above, just against a numericTrackers pool instead.
	it("costsTracker: decrements the named tracker by the spec's own amount", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					arcanist: { rituals: [{ ritualKey: "arcanist-ritual:warding" }, null, null] },
					moveTrackers: { [PREPARE_RITUALS_KEY]: { "ward-hold": 2 } }
				}
			},
			update: vi.fn()
		};

		await sheet._spendRollModifiers(["ritual-1"]);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveTrackers.${PREPARE_RITUALS_KEY}.ward-hold`]: 1
		});
	});

	it("costsTracker: treats a missing tracker value as 0 before clamping at 0", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { arcanist: { rituals: [{ ritualKey: "arcanist-ritual:warding" }, null, null] } } },
			update: vi.fn()
		};

		await sheet._spendRollModifiers(["ritual-1"]);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveTrackers.${PREPARE_RITUALS_KEY}.ward-hold`]: 0
		});
	});

	// The confirmed accumulation bug (see move-grants-mixin.js's _spendRollModifiers doc comment):
	// two checked entries drawing from the same pool in one batch must each apply their own
	// deduction, not both compute off the same stale stored value — exercised for both the new
	// costsTracker gate (two prepared Warding rituals sharing one Wardhold pool) and the
	// pre-existing costsHold gate (fixed in the same pass, for correctness).
	it("costsTracker: two checked entries sharing one Wardhold pool each apply their own deduction", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					arcanist: {
						rituals: [{ ritualKey: "arcanist-ritual:warding" }, { ritualKey: "arcanist-ritual:warding" }, null]
					},
					moveTrackers: { [PREPARE_RITUALS_KEY]: { "ward-hold": 4 } }
				}
			},
			update: vi.fn()
		};

		await sheet._spendRollModifiers(["ritual-1", "ritual-2"]);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveTrackers.${PREPARE_RITUALS_KEY}.ward-hold`]: 2
		});
	});

	it("costsHold: two checked entries sharing one hold pool each apply their own deduction", async () => {
		const sheet = new PlaybookActorSheet();
		const TWIN_HOLD_SOURCE_A = { key: "twin-hold-a", grantsRollModifier: [{ key: "twin-a", costsHold: { moveKey: EMBRACE_CHAOS.key, amount: 1 } }] };
		const TWIN_HOLD_SOURCE_B = { key: "twin-hold-b", grantsRollModifier: [{ key: "twin-b", costsHold: { moveKey: EMBRACE_CHAOS.key, amount: 1 } }] };
		sheet._rollModifierSources = vi.fn(() => [TWIN_HOLD_SOURCE_A, TWIN_HOLD_SOURCE_B]);
		sheet.actor = {
			system: { attributes: { moveHold: { [EMBRACE_CHAOS.key]: { value: 2 } } } },
			update: vi.fn()
		};

		await sheet._spendRollModifiers(["twin-a", "twin-b"]);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveHold.${EMBRACE_CHAOS.key}.value`]: 0
		});
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

// Bonded In Blood is a plain unscoped grantsRollModifier entry with no gate of its own --
// one pass-through case so this catalog entry's own call site isn't dead code.
describe("PlaybookActorSheet#_rollModifiersForMove - Bonded In Blood", () => {
	it("is unscoped and never gated", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BONDED_IN_BLOOD.key] } } };

		const [entry] = sheet._rollModifiersForMove(READ_THE_ROOM, null);

		expect(entry.deferred).toBeUndefined();
		expect(entry.disabled).toBe(false);
	});
});

// Bullheaded is a plain unscoped grantsRollModifier entry with no gate of its own -- one
// pass-through case so this catalog entry's own call site isn't dead code.
describe("PlaybookActorSheet#_rollModifiersForMove - Bullheaded", () => {
	it("is unscoped and never gated", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BULLHEADED.key] } } };

		const [entry] = sheet._rollModifiersForMove(READ_THE_ROOM, null);

		expect(entry.deferred).toBeUndefined();
		expect(entry.disabled).toBe(false);
	});
});

// _rollMove's own spentRollModifiers wiring (move-roll-mixin.js's _finishMoveRoll) -- confirms
// _onMoveRoll actually spends every checked Roll Modifier through the real precedence chain, not
// just in the unit-level _spendRollModifiers describe above.
describe("PlaybookActorSheet#_rollMove - spentRollModifiers wiring", () => {
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
