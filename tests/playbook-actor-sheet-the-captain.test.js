import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	rollMove: vi.fn()
}));

// findCarrierActors defaults to no Carriers in the world, matching every other move-roll test
// file's own convention (see playbook-actor-sheet-move-rolls.test.js).
vi.mock("../scripts/world-actors/carrier-actor-sheet.js", async (importOriginal) => ({
	...(await importOriginal()),
	findCarrierActors: vi.fn(() => []),
	chooseCarrier: vi.fn()
}));

import { BASIC_MOVES, SPECIAL_MOVES, configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { UNARMED, findEquipmentTag } from "../scripts/equipment/equipment.js";
import { ASTIR_PART_CATALOG } from "../scripts/frames/astir.js";
import { findCarrierActors } from "../scripts/world-actors/carrier-actor-sheet.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { DANGER_MAX } from "../scripts/playbook/playbook-sheet/tracking-mixin.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const STRIKE_DECISIVELY = BASIC_MOVES.find((m) => m.key === "strike-decisively");
const READ_THE_ROOM = BASIC_MOVES.find((m) => m.key === "read-the-room");
const BITE_THE_DUST = BASIC_MOVES.find((m) => m.key === "bite-the-dust");
const FIRE_SUPPORT = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-captain:fire-support");
const HUMAN_RESOURCES = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-captain:human-resources");
const COORDINATOR = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-captain:coordinator");
const HELP_OR_HINDER = BASIC_MOVES.find((m) => m.key === "help-or-hinder");
const DARK_REBIRTH = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-wither:dark-rebirth");
const ARTIFACT = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:artifact");
const BORN_LEADER = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-captain:born-leader");
const LEAD_A_SORTIE = SPECIAL_MOVES.find((m) => m.key === "lead-a-sortie");

beforeEach(() => {
	configureMoveRoll.mockClear();
	rollMove.mockClear();
	rollMove.mockResolvedValue({ message: undefined, dice: null, tier: undefined });
	findCarrierActors.mockClear();
	findCarrierActors.mockReturnValue([]);
});

// Fakes the DOM traversal _onDangerAdd uses to read the label/type inputs next to the clicked Add
// button — same helper shape as playbook-actor-sheet-tracking.test.js's own fakeDangerAddEvent.
function fakeDangerAddEvent({ label, type = "risk" }) {
	return {
		currentTarget: {
			closest: () => ({
				querySelector: (selector) => (
					selector === ".danger-label-input" ? { value: label } : { value: type }
				)
			})
		}
	};
}

describe("PlaybookActorSheet#_dangerMax", () => {
	it("returns the base DANGER_MAX for a Captain not at the helm", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-captain" }, attributes: { atHelm: false } } };

		expect(sheet._dangerMax()).toBe(DANGER_MAX);
	});

	it("returns 4 for a Captain at the helm", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-captain" }, attributes: { atHelm: true } } };

		expect(sheet._dangerMax()).toBe(4);
	});

	it("stays at the base DANGER_MAX for a non-Captain playbook, even with atHelm somehow true", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-scout" }, attributes: { atHelm: true } } };

		expect(sheet._dangerMax()).toBe(DANGER_MAX);
	});

	it("defaults to the base DANGER_MAX with no playbook or attributes at all", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		expect(sheet._dangerMax()).toBe(DANGER_MAX);
	});
});

describe("PlaybookActorSheet#_onAtHelmToggle", () => {
	it("writes the checked state to system.attributes.atHelm", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onAtHelmToggle({ currentTarget: { checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.atHelm": true });
	});

	it("writes false when unchecked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onAtHelmToggle({ currentTarget: { checked: false } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.atHelm": false });
	});
});

// Covers every one of the 7 DANGER_MAX call sites now reading _dangerMax() instead (see
// tracking-mixin.js's _dangersData/_onDangerAdd and moves-mixin.js's _allDangersArePeril/
// _availableAutomaticSuccess).
describe("PlaybookActorSheet#_dangersData / _onDangerAdd - Captain's raised Danger cap", () => {
	const threeDangers = [
		{ id: "1", type: "risk", label: "a" },
		{ id: "2", type: "risk", label: "b" },
		{ id: "3", type: "risk", label: "c" }
	];

	it("raises max/atMax/canAdd/addOpen to 4 for a Captain at the helm with 3 dangers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { slug: "the-captain" },
				attributes: { atHelm: true, dangers: threeDangers }
			}
		};
		sheet._dangerAddOpen = true;

		const data = sheet._dangersData();

		expect(data.max).toBe(4);
		expect(data.atMax).toBe(false);
		expect(data.canAdd).toBe(true);
		expect(data.addOpen).toBe(true);
	});

	it("stays at the base max of 3 for a Captain not at the helm with 3 dangers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { slug: "the-captain" },
				attributes: { atHelm: false, dangers: threeDangers }
			}
		};

		const data = sheet._dangersData();

		expect(data.max).toBe(3);
		expect(data.atMax).toBe(true);
		expect(data.canAdd).toBe(false);
	});

	it("allows adding a 4th danger for a Captain at the helm", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { slug: "the-captain" },
				attributes: { atHelm: true, dangers: threeDangers }
			},
			update: vi.fn()
		};

		sheet._onDangerAdd(fakeDangerAddEvent({ label: "Fourth danger" }));

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [...threeDangers, { id: "test-id", type: "risk", label: "Fourth danger" }]
		});
	});

	it("blocks a 4th danger for a Captain not at the helm (still capped at 3)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { slug: "the-captain" },
				attributes: { atHelm: false, dangers: threeDangers }
			},
			update: vi.fn()
		};

		sheet._onDangerAdd(fakeDangerAddEvent({ label: "Fourth danger" }));

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("blocks a 5th danger for a Captain at the helm, once at the raised max of 4", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { slug: "the-captain" },
				attributes: {
					atHelm: true,
					dangers: [...threeDangers, { id: "4", type: "risk", label: "d" }]
				}
			},
			update: vi.fn()
		};

		sheet._onDangerAdd(fakeDangerAddEvent({ label: "Fifth danger" }));

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_allDangersArePeril - Captain's raised Danger cap", () => {
	it("requires 4 peril Dangers for a Captain at the helm, not the base 3", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { slug: "the-captain" },
				attributes: {
					atHelm: true,
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "peril", label: "c" }
					]
				}
			}
		};

		expect(sheet._allDangersArePeril()).toBe(false);

		sheet.actor.system.attributes.dangers.push({ id: "4", type: "peril", label: "d" });
		expect(sheet._allDangersArePeril()).toBe(true);
	});

	it("is already true at 3 peril Dangers for a Captain not at the helm", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { slug: "the-captain" },
				attributes: {
					atHelm: false,
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "peril", label: "c" }
					]
				}
			}
		};

		expect(sheet._allDangersArePeril()).toBe(true);
	});
});

describe("PlaybookActorSheet#_availableAutomaticSuccess - Dark Rebirth (costsPeril) against the Captain's raised cap", () => {
	it("still offers Dark Rebirth at 3 risk-type Dangers for a Captain at the helm (below the raised 4-cap)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { slug: "the-captain" },
				attributes: {
					atHelm: true,
					playbookMoves: [DARK_REBIRTH.key],
					dangers: [
						{ id: "1", type: "risk", label: "a" },
						{ id: "2", type: "risk", label: "b" },
						{ id: "3", type: "risk", label: "c" }
					]
				}
			}
		};

		const offered = sheet._availableAutomaticSuccess(BITE_THE_DUST);

		expect(offered.some((source) => source.key === DARK_REBIRTH.key)).toBe(true);
	});

	it("stops offering Dark Rebirth once a Captain at the helm reaches the raised cap of 4", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { slug: "the-captain" },
				attributes: {
					atHelm: true,
					playbookMoves: [DARK_REBIRTH.key],
					dangers: [
						{ id: "1", type: "risk", label: "a" },
						{ id: "2", type: "risk", label: "b" },
						{ id: "3", type: "risk", label: "c" },
						{ id: "4", type: "risk", label: "d" }
					]
				}
			}
		};

		const offered = sheet._availableAutomaticSuccess(BITE_THE_DUST);

		expect(offered.some((source) => source.key === DARK_REBIRTH.key)).toBe(false);
	});
});

describe("PlaybookActorSheet#_grantsCarrierWeaponAccess", () => {
	it("is false without Fire Support picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._grantsCarrierWeaponAccess(EXCHANGE_BLOWS)).toBe(false);
	});

	it("is true for Exchange Blows and Strike Decisively once Fire Support is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [FIRE_SUPPORT.key] } } };

		expect(sheet._grantsCarrierWeaponAccess(EXCHANGE_BLOWS)).toBe(true);
		expect(sheet._grantsCarrierWeaponAccess(STRIKE_DECISIVELY)).toBe(true);
	});

	it("is false for a move Fire Support doesn't target", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [FIRE_SUPPORT.key] } } };

		expect(sheet._grantsCarrierWeaponAccess(READ_THE_ROOM)).toBe(false);
	});
});

describe("PlaybookActorSheet#_moveTraits - Fire Support's KNOW addsTraitToMove", () => {
	it("offers +KNOW on both Exchange Blows and Strike Decisively once Fire Support is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, know: { value: 2 } },
				attributes: { playbookMoves: [FIRE_SUPPORT.key] }
			}
		};

		expect(sheet._moveTraits({ key: "exchange-blows", traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "know", label: "KNOW", value: 2 }
		]);
		expect(sheet._moveTraits({ key: "strike-decisively", traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "know", label: "KNOW", value: 2 }
		]);
	});

	it("does not add +KNOW to an unrelated move just because Fire Support is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 1 }, know: { value: 2 } },
				attributes: { playbookMoves: [FIRE_SUPPORT.key] }
			}
		};

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["sense"] })).toEqual([
			{ key: "sense", label: "SENSE", value: 1 }
		]);
	});
});

describe("PlaybookActorSheet#_onMoveRoll - Fire Support's Carrier weapon offering", () => {
	const halberd = { id: "eq1", kind: "weapon", name: "Halberd", tags: [] };
	// Carries a narrative Impact tag (no codified mechanic) — proves the bundle's own narrativeTags
	// resolve for a fromCarrier weapon (full parity with an actor's own weapon), including the
	// slot's own locked tags merged in on top of what the Carrier actually stored.
	const carrierWeapon = { id: "carrier-w1", kind: "weapon", name: "Broadside Cannon", tags: ["impact"] };

	it("folds the single Carrier's own weapons into the weaponBundles offer, tagged fromCarrier, with the primary slot's locked tags (Set-Up, Mounted) merged into narrativeTags", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { playbookMoves: [FIRE_SUPPORT.key], equipment: [halberd] }
			}
		};
		findCarrierActors.mockReturnValue([
			{ id: "carrier1", name: "The Wanderer", system: { attributes: { weapons: { primary: carrierWeapon, secondary: null } } } }
		]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const { weaponBundles } = configureMoveRoll.mock.calls.at(-1)[2];
		expect(weaponBundles.map((b) => b.weaponKey)).toEqual([UNARMED, "eq1", "carrier-w1"]);
		// Stored tags: ["impact"]; primary's own lockedTagKeys: ["set-up", "mounted"] — merged
		// (see carrier-actor-sheet.js's carrierWeaponTagKeys) into 3 narrative-tag entries.
		expect(weaponBundles.find((b) => b.weaponKey === "carrier-w1").narrativeTags.map((t) => t.tagKey))
			.toEqual(["impact", "set-up", "mounted"]);
		// The Carrier's own stored entry is never mutated — no fromCarrier flag leaks onto it.
		expect(carrierWeapon.fromCarrier).toBeUndefined();
	});

	it("treats a single Carrier with no weapons array at all as offering none", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { playbookMoves: [FIRE_SUPPORT.key], equipment: [halberd] }
			}
		};
		findCarrierActors.mockReturnValue([{ id: "carrier1", name: "The Wanderer", system: { attributes: {} } }]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const { weaponBundles } = configureMoveRoll.mock.calls.at(-1)[2];
		expect(weaponBundles.map((b) => b.weaponKey)).toEqual([UNARMED, "eq1"]);
	});

	it("offers no Carrier weapons with zero Carriers in the world", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { playbookMoves: [FIRE_SUPPORT.key], equipment: [halberd] }
			}
		};
		findCarrierActors.mockReturnValue([]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const { weaponBundles } = configureMoveRoll.mock.calls.at(-1)[2];
		expect(weaponBundles.map((b) => b.weaponKey)).toEqual([UNARMED, "eq1"]);
	});

	it("offers no Carrier weapons with more than one Carrier in the world", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { playbookMoves: [FIRE_SUPPORT.key], equipment: [halberd] }
			}
		};
		findCarrierActors.mockReturnValue([
			{ id: "carrier1", name: "The Wanderer", system: { attributes: { weapons: { primary: carrierWeapon, secondary: null } } } },
			{ id: "carrier2", name: "The Anchor", system: { attributes: { weapons: { primary: carrierWeapon, secondary: null } } } }
		]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const { weaponBundles } = configureMoveRoll.mock.calls.at(-1)[2];
		expect(weaponBundles.map((b) => b.weaponKey)).toEqual([UNARMED, "eq1"]);
	});

	it("offers no Carrier weapons for a usesWeapon move when Fire Support isn't picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { playbookMoves: [], equipment: [halberd] }
			}
		};
		findCarrierActors.mockReturnValue([
			{ id: "carrier1", name: "The Wanderer", system: { attributes: { weapons: { primary: carrierWeapon, secondary: null } } } }
		]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const { weaponBundles } = configureMoveRoll.mock.calls.at(-1)[2];
		expect(weaponBundles.map((b) => b.weaponKey)).toEqual([UNARMED, "eq1"]);
	});
});

describe("PlaybookActorSheet#_rollMove - fromCarrier weapon parity", () => {
	it("offers equipment spends, narrative tags, and Guided for a fromCarrier weapon, alongside an installed Astir Part's own Roll Modifier, and spends a checked tag onto the Carrier that actually owns it", async () => {
		const sheet = new PlaybookActorSheet();
		// Rations carries a spendable Blitz tag too, proving the fromCarrier weapon's own Blitz is
		// resolved independently of this actor's own equipment (see resolveEquipmentSpends).
		// Artifact's own Roll Modifier entry is actor-wide rather than weapon-scoped (see
		// _rollModifiersForMove), so it's unaffected by fromCarrier and still shows up below.
		const gear = { id: "g1", kind: "gear", name: "Rations", tags: ["blitz"], spent: [] };
		const carrierWeapon = {
			id: "carrier-w1", kind: "weapon", name: "Broadside Cannon", tags: ["blitz", "guided"], spent: [],
			fromCarrier: true, carrierActorId: "carrier1"
		};
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					equipment: [gear],
					astir: { id: "a1", parts: [ARTIFACT.key], piloted: true }
				}
			},
			update: vi.fn()
		};
		const config = {
			trait: { key: "clash", label: "CLASH", value: 0 },
			advantage: "none",
			effect: "confidence",
			spentTags: [{ equipmentId: "carrier-w1", tagKey: "blitz" }]
		};
		configureMoveRoll.mockResolvedValue(config);
		const carrier = {
			id: "carrier1",
			system: {
				attributes: {
					weapons: { primary: { id: "carrier-w1", tags: ["blitz", "guided"], spent: [] }, secondary: null }
				}
			},
			update: vi.fn()
		};
		game.actors.get.mockReturnValue(carrier);

		await sheet._rollMove(EXCHANGE_BLOWS, carrierWeapon);

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null,
			lockedTrait: null,
			equipmentSpends: [{
				equipmentId: "carrier-w1",
				equipmentName: "Broadside Cannon",
				tagKey: "blitz",
				tagLabel: "Blitz",
				description: findEquipmentTag("blitz").description,
				effect: "confidence",
				disabled: false
			}],
			// blitz/guided are both excluded from narrativeTags (a spend and a guided tag,
			// respectively — see resolveNarrativeWeaponTags), so nothing narrative is left to show.
			narrativeTags: [],
			guided: "Guided",
			rollModifiers: [{
				key: ARTIFACT.key,
				label: "Advantage from Artifact",
				description: "Grants advantage towards a task this Artifact is designed for.",
				advantage: "advantage",
				effect: null,
				requiresAdvantage: null,
				reminderOnly: false,
				deferred: false,
				disabled: false,
				disabledReason: null,
				forced: false
			}],
			riders: []
		});

		// The checked Blitz spend lands on the Carrier that actually owns the weapon, not on this
		// actor's own equipment array.
		expect(carrier.update).toHaveBeenCalledWith({
			"system.attributes.weapons": {
				primary: { id: "carrier-w1", tags: ["blitz", "guided"], spent: ["blitz"] },
				secondary: null
			}
		});
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_grantedQuestionsForMove", () => {
	it("returns null without Human Resources picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._grantedQuestionsForMove(READ_THE_ROOM)).toBeNull();
	});

	it("returns Human Resources' 3 questions for Read the Room once picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [HUMAN_RESOURCES.key] } } };

		expect(sheet._grantedQuestionsForMove(READ_THE_ROOM)).toEqual([
			"What is the crew's mood like?",
			"Who is responsible for a problem on-board the Carrier?",
			"What could be a problem for the crew in the immediate future?"
		]);
	});

	it("returns null for a move Human Resources doesn't target", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [HUMAN_RESOURCES.key] } } };

		expect(sheet._grantedQuestionsForMove(BITE_THE_DUST)).toBeNull();
	});
});

describe("PlaybookActorSheet#_rollMove - Human Resources' extraQuestions", () => {
	it("passes Human Resources' questions through to rollMove's options when reading the room", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 1 } },
				attributes: { playbookMoves: [HUMAN_RESOURCES.key] }
			},
			update: vi.fn()
		};
		const config = { trait: { key: "sense", label: "SENSE", value: 1 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._rollMove(READ_THE_ROOM, undefined);

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor,
			READ_THE_ROOM,
			config.trait,
			expect.objectContaining({
				extraQuestions: [
					"What is the crew's mood like?",
					"Who is responsible for a problem on-board the Carrier?",
					"What could be a problem for the crew in the immediate future?"
				]
			})
		);
	});

	it("omits extraQuestions entirely without Human Resources picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { sense: { value: 1 } }, attributes: { playbookMoves: [] } },
			update: vi.fn()
		};
		const config = { trait: { key: "sense", label: "SENSE", value: 1 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._rollMove(READ_THE_ROOM, undefined);

		const [, , , options] = rollMove.mock.calls.at(-1);
		expect(options).not.toHaveProperty("extraQuestions");
	});
});

describe("PlaybookActorSheet#_grantedSuccessReminderForMove", () => {
	it("returns null without Coordinator picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._grantedSuccessReminderForMove(HELP_OR_HINDER)).toBeNull();
	});

	it("returns Coordinator's reminder for Help or Hinder once picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [COORDINATOR.key] } } };

		expect(sheet._grantedSuccessReminderForMove(HELP_OR_HINDER)).toBe(
			"If you chose to help, your ally may act with confidence in addition to advantage."
		);
	});

	it("returns null for a move Coordinator doesn't target", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [COORDINATOR.key] } } };

		expect(sheet._grantedSuccessReminderForMove(BITE_THE_DUST)).toBeNull();
	});
});

describe("PlaybookActorSheet#_rollMove - Coordinator's extraSuccessReminder", () => {
	it("passes Coordinator's reminder through to rollMove's options when rolling Help or Hinder", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { playbookMoves: [COORDINATOR.key] }
			},
			update: vi.fn()
		};
		// Help or Hinder has no stat traits at all (see move-rolls' own "no-trait move" test), so
		// configureMoveRoll's real resolved config carries no `trait` key at all here.
		const config = { conditions: ["hook"], advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._rollMove(HELP_OR_HINDER, undefined);

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor,
			HELP_OR_HINDER,
			undefined,
			expect.objectContaining({
				extraSuccessReminder: "If you chose to help, your ally may act with confidence in addition to advantage."
			})
		);
	});

	it("omits extraSuccessReminder entirely without Coordinator picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: {}, attributes: { playbookMoves: [] } },
			update: vi.fn()
		};
		const config = { conditions: ["hook"], advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._rollMove(HELP_OR_HINDER, undefined);

		const [, , , options] = rollMove.mock.calls.at(-1);
		expect(options).not.toHaveProperty("extraSuccessReminder");
	});
});

// Parity with Don't Follow Me/Legacy (see playbook-actor-sheet-roll-results.test.js/
// playbook-actor-sheet-astir-effects.test.js): Born Leader shares the same grantsAdvantageOnMove
// flag and the same _grantedAdvantageRollModifier resolver, so it surfaces as a forced Roll
// Modifier entry too, never a lockedAdvantage lock (which no longer exists at all).
describe("PlaybookActorSheet#_rollModifiersForMove - Born Leader", () => {
	it("surfaces as a forced Roll Modifier entry once picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BORN_LEADER.key] } } };

		const entries = sheet._rollModifiersForMove(LEAD_A_SORTIE, null);

		expect(entries).toEqual([{
			key: `granted-advantage-${BORN_LEADER.key}`,
			label: "Born Leader: Advantage",
			description: BORN_LEADER.description,
			advantage: "advantage",
			effect: null,
			requiresAdvantage: null,
			reminderOnly: false,
			deferred: false,
			disabled: false,
			disabledReason: null,
			forced: true
		}]);
	});

	it("offers nothing without Born Leader picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._rollModifiersForMove(LEAD_A_SORTIE, null)).toEqual([]);
	});
});
