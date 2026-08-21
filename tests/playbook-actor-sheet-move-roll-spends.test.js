import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	rollMove: vi.fn()
}));

import { configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { EQUIPMENT_TAGS } from "../scripts/equipment/equipment.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { DISPEL_UNCERTAINTIES, BITE_THE_DUST } from "./helpers/move-fixtures.js";

// _availableHeatUp's own return value for an actor with no Astir at all (see moves-mixin.js) —
// every fixture in this file lacks one unless a test says otherwise, so _rollMove's baseOptions
// always threads this same false through to rollMove.
const NO_HEAT_UP = false;

beforeEach(() => {
	configureMoveRoll.mockClear();
	rollMove.mockClear();
	// rollMove resolves { message, dice } (see moves.js) — a bare default so every existing test
	// that doesn't care about the roll's dice (most of them) doesn't have to configure this itself.
	rollMove.mockResolvedValue({ message: undefined, dice: null });
});

// dispel-uncertainties (not a usesWeapon move) stands in for "any ordinary move" here — these
// tests exercise _equipmentSpends' own unscoped behavior (offering, spent/stale filtering,
// disabling, marking), which is identical for every move except Exchange Blows/Strike Decisively.
// Weapon-scoping itself (the merged dialog's own weaponBundles, and the weaponLabel it produces)
// is covered separately in playbook-actor-sheet-weapon-rolls.test.js's own
// "PlaybookActorSheet#_onMoveRoll - weapon choice" and "PlaybookActorSheet#_equipmentSpends -
// weapon scoping" below.
describe("PlaybookActorSheet#_onMoveRoll - equipment spends", () => {
	const know = { key: "know", label: "KNOW", value: 1 };
	const blitzSpend = {
		equipmentId: "eq1",
		equipmentName: "Halberd",
		tagKey: "blitz",
		tagLabel: "Blitz",
		description: "You may spend this tag once per Scene to make a move with confidence.",
		effect: "confidence",
		disabled: false
	};

	it("offers every unspent spendable tag across the actor's equipment", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			DISPEL_UNCERTAINTIES,
			[{ key: "know", label: "KNOW", value: 1 }],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, equipmentSpends: [blitzSpend], narrativeTags: [], rollModifiers: [], riders: [] }
		);
	});

	it("excludes a tag already marked spent on its entry", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			equipmentSpends: [], narrativeTags: [], rollModifiers: [], riders: []
		});
	});

	it("treats a missing spent array on an entry as nothing spent yet", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			equipmentSpends: [blitzSpend], narrativeTags: [], rollModifiers: [], riders: []
		});
	});

	it("treats a missing tags array on an entry as offering nothing", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "gear", name: "Odd", description: "", spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			equipmentSpends: [], narrativeTags: [], rollModifiers: [], riders: []
		});
	});

	it("excludes a disabled weapon's spendable tag from the roll-dialog offering", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", disabled: true, name: "Halberd", description: "", tags: ["blitz"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			equipmentSpends: [], narrativeTags: [], rollModifiers: [], riders: []
		});
	});

	it("excludes a tag key that no longer resolves in the catalog", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "gear", name: "Odd", description: "", tags: ["stale-key"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			equipmentSpends: [], narrativeTags: [], rollModifiers: [], riders: []
		});
	});

	it("excludes an Astir weapon's spendable tag while unpiloted, even for a non-usesWeapon move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					astir: { id: "a1", piloted: false },
					equipment: [{ id: "eq1", kind: "weapon", astir: true, name: "Lance", description: "", tags: ["blitz"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			equipmentSpends: [], narrativeTags: [], rollModifiers: [], riders: []
		});
	});

	it("offers an Astir weapon's spendable tag once piloted, excluding a mundane weapon's", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					astir: { id: "a1", piloted: true },
					equipment: [
						{ id: "eq1", kind: "weapon", astir: true, name: "Lance", description: "", tags: ["blitz"], spent: [] },
						{ id: "eq2", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			equipmentSpends: [expect.objectContaining({ equipmentId: "eq1", tagKey: "blitz" })], narrativeTags: [], rollModifiers: [], riders: []
		});
	});

	it("leaves a gear entry's spendable tag unaffected by piloted state", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					astir: { id: "a1", piloted: true },
					equipment: [{ id: "eq1", kind: "gear", name: "Charm", description: "", tags: ["blitz"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			equipmentSpends: [expect.objectContaining({ equipmentId: "eq1", tagKey: "blitz" })], narrativeTags: [], rollModifiers: [], riders: []
		});
	});

	it("excludes a spend tag with no effect (e.g. Ward) from the roll-dialog offering", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "gear", name: "Charm", description: "", tags: ["ward"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			equipmentSpends: [], narrativeTags: [], rollModifiers: [], riders: []
		});
	});

	it("disables offered spends when the roll's Effect is already locked (bite the dust at max Perils)", async () => {
		const sheet = new PlaybookActorSheet();
		const defy = { key: "defy", label: "DEFY", value: 0 };
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "peril", label: "c" }
					],
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], {
			lockedEffect: "desperation", lockedAdvantage: null, lockedTrait: null,
			equipmentSpends: [{ ...blitzSpend, disabled: true }], narrativeTags: [], rollModifiers: [], riders: []
		});
	});

	it("marks each checked spend's tag as spent, then rolls the move", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] };
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { equipment: [entry] } },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "confidence", spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DISPEL_UNCERTAINTIES, know, { ...config, heatUp: NO_HEAT_UP });
	});

	it("treats a missing spent array as empty when marking a spend", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"] };
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { equipment: [entry] } },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "confidence", spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
	});

	it("does not touch equipment when nothing was spent", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "none", spentTags: [] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DISPEL_UNCERTAINTIES, know, { ...config, heatUp: NO_HEAT_UP });
	});

	it("leaves equipment on other entries untouched when marking a spend", async () => {
		const sheet = new PlaybookActorSheet();
		const spent = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] };
		const untouched = { id: "eq2", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { equipment: [spent, untouched] } },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "confidence", spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...spent, spent: ["blitz"] }, untouched]
		});
	});
});

// Crew Support's own hold spend (see moves-mixin.js's _crewSupportHoldSpend) — a resource spend
// alongside _spendEquipmentTags/_spendRollModifiers above, but keyed off which trait the player
// actually chose (config.trait.key) rather than a checked box, since the CREW-substitution option
// is injected generically into every move's own trait list (see move-traits-mixin.js's
// _moveTraits) rather than declared as its own spend field.
describe("PlaybookActorSheet#_finishMoveRoll - Crew Support hold spend", () => {
	it("spends 1 Crew Support hold when the roll used the crew-support-crew option", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: {}, attributes: { moveTrackers: { "crew-support": { hold: 2 } } } },
			update: vi.fn()
		};
		const config = {
			trait: { key: "crew-support-crew", label: "CREW (Crew Support)", value: 0 },
			advantage: "none",
			effect: "none"
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "help-or-hinder" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveTrackers.crew-support.hold": 1
		});
	});

	it("does not spend Crew Support hold for an ordinary trait key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { moveTrackers: { "crew-support": { hold: 2 } } }
			},
			update: vi.fn()
		};
		const config = { trait: { key: "know", label: "KNOW", value: 1 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).not.toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.moveTrackers.crew-support.hold": expect.anything() })
		);
	});

	it("does not spend Crew Support hold for Lead a Sortie's own permanent crew fixedTraits key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 }, defy: { value: 0 } },
				attributes: { moveTrackers: { "crew-support": { hold: 2 } } }
			},
			update: vi.fn()
		};
		const config = { trait: { key: "crew", label: "CREW", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(sheet.actor.update).not.toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.moveTrackers.crew-support.hold": expect.anything() })
		);
	});
});

// _narrativeWeaponTags is _equipmentSpends' own sibling for tags with no codified mechanic (see
// docs/domains/equipment.md's narrative-tag definition) — same frame/disabled/scoped filtering,
// tested directly here rather than through _onMoveRoll since there's no equipmentSpends-style
// checked-box round trip to exercise.
describe("PlaybookActorSheet#_narrativeWeaponTags", () => {
	const impact = EQUIPMENT_TAGS.find((t) => t.key === "impact");
	const melee = EQUIPMENT_TAGS.find((t) => t.key === "melee");
	const arcane = EQUIPMENT_TAGS.find((t) => t.key === "arcane");

	function narrativeTagRow(entry, tag) {
		return {
			equipmentId: entry.id,
			equipmentName: entry.name,
			tagKey: tag.key,
			tagLabel: tag.label,
			value: tag.value,
			showValue: true,
			description: tag.description
		};
	}

	it("includes a plain narrative tag with no codified mechanic (Impact)", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["impact"], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } } };

		expect(sheet._narrativeWeaponTags(entry)).toEqual([narrativeTagRow(entry, impact)]);
	});

	it("excludes a spend tag (Blitz)", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } } };

		expect(sheet._narrativeWeaponTags(entry)).toEqual([]);
	});

	it("excludes a forcesEffect tag (Unreliable)", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable"], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } } };

		expect(sheet._narrativeWeaponTags(entry)).toEqual([]);
	});

	it("excludes a reroll tag (Decisive)", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", name: "Sword", description: "", tags: ["decisive"], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } } };

		expect(sheet._narrativeWeaponTags(entry)).toEqual([]);
	});

	it("excludes a Guided tag", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["guided"], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } } };

		expect(sheet._narrativeWeaponTags(entry)).toEqual([]);
	});

	it("excludes a Drain tag (exclusiveGroup DRAIN_GROUP), even though it carries no spend field", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", name: "Lance", description: "", tags: ["drain-1"], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } } };

		expect(sheet._narrativeWeaponTags(entry)).toEqual([]);
	});

	it("includes a WEAPON_RANGE_GROUP classifier tag (Melee), which carries no codified effect", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["melee"], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } } };

		expect(sheet._narrativeWeaponTags(entry)).toEqual([narrativeTagRow(entry, melee)]);
	});

	it("includes an Approach tag (Arcane), which is purely descriptive", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["arcane"], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } } };

		expect(sheet._narrativeWeaponTags(entry)).toEqual([narrativeTagRow(entry, arcane)]);
	});

	it("excludes an Astir weapon's narrative tag while unpiloted", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", astir: true, name: "Lance", description: "", tags: ["impact"], spent: [] };
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: false }, equipment: [entry] } } };

		expect(sheet._narrativeWeaponTags(entry)).toEqual([]);
	});

	it("offers an Astir weapon's narrative tag once piloted, excluding a mundane weapon's", () => {
		const sheet = new PlaybookActorSheet();
		const astirWeapon = { id: "eq1", kind: "weapon", astir: true, name: "Lance", description: "", tags: ["impact"], spent: [] };
		const mundane = { id: "eq2", kind: "weapon", name: "Halberd", description: "", tags: ["impact"], spent: [] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", piloted: true }, equipment: [astirWeapon, mundane] } }
		};

		expect(sheet._narrativeWeaponTags(astirWeapon)).toEqual([narrativeTagRow(astirWeapon, impact)]);
	});

	it("excludes a disabled weapon's narrative tag", () => {
		const sheet = new PlaybookActorSheet();
		const entry = {
			id: "eq1", kind: "weapon", disabled: true, name: "Halberd", description: "", tags: ["impact"], spent: []
		};
		sheet.actor = { system: { attributes: { equipment: [entry] } } };

		expect(sheet._narrativeWeaponTags(entry)).toEqual([]);
	});

	it("excludes every weapon's narrative tag when unscoped (a non-weapon move), but still includes gear", () => {
		const sheet = new PlaybookActorSheet();
		const weapon = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["impact"], spent: [] };
		const gear = { id: "eq2", kind: "gear", name: "Charm", description: "", tags: ["impact"], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [weapon, gear] } } };

		expect(sheet._narrativeWeaponTags()).toEqual([narrativeTagRow(gear, impact)]);
	});

	it("leaves a gear entry's narrative tag unaffected by piloted state", () => {
		const sheet = new PlaybookActorSheet();
		const gear = { id: "eq1", kind: "gear", name: "Charm", description: "", tags: ["impact"], spent: [] };
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: true }, equipment: [gear] } } };

		expect(sheet._narrativeWeaponTags()).toEqual([narrativeTagRow(gear, impact)]);
	});

	it("excludes every other weapon's narrative tags when scoped to one weapon, but never filters gear", () => {
		const sheet = new PlaybookActorSheet();
		const scoped = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["impact"], spent: [] };
		const other = { id: "eq2", kind: "weapon", name: "Sidearm", description: "", tags: ["impact"], spent: [] };
		const gear = { id: "eq3", kind: "gear", name: "Charm", description: "", tags: ["impact"], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [scoped, other, gear] } } };

		expect(sheet._narrativeWeaponTags(scoped)).toEqual([
			narrativeTagRow(scoped, impact),
			narrativeTagRow(gear, impact)
		]);
	});
});
