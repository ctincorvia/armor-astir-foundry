import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	postGuidedResult: vi.fn(),
	rollMove: vi.fn()
}));

import { configureMoveRoll, postGuidedResult, rollMove } from "../scripts/moves/moves.js";
import { UNARMED, findEquipmentTag } from "../scripts/equipment/equipment.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import {
	EXCHANGE_BLOWS, DISPEL_UNCERTAINTIES, FLOURISH_COMPONENT, SPELL_ROUTINES
} from "./helpers/move-fixtures.js";
import { soleWeaponBundle } from "./helpers/move-test-helpers.js";

beforeEach(() => {
	configureMoveRoll.mockClear();
	postGuidedResult.mockClear();
	rollMove.mockClear();
	// rollMove resolves { message, dice } (see moves.js) — a bare default so every existing test
	// that doesn't care about the roll's dice (most of them) doesn't have to configure this itself.
	// Tests that do care (Flourish Component's doubles regen) override this per-test.
	rollMove.mockResolvedValue({ message: undefined, dice: null });
});

describe("PlaybookActorSheet#_rollMove - Guided (take 7-9)", () => {
	it("passes the weapon tag's own label as guided to configureMoveRoll when the weapon has a live Guided tag", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["guided"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(soleWeaponBundle(configureMoveRoll)).toEqual(expect.objectContaining({
			weaponKey: "eq1", lockedEffect: null, equipmentSpends: [], narrativeTags: [], rollModifiers: [], guided: "Guided"
		}));
	});

	it("omits guided from configureMoveRoll's options for a non-Guided weapon", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(soleWeaponBundle(configureMoveRoll)).toEqual(expect.objectContaining({
			weaponKey: "eq1", lockedEffect: null, equipmentSpends: [], narrativeTags: [], rollModifiers: [], guided: null
		}));
	});

	it("treats a missing tags array as not Guided", async () => {
		const sheet = new PlaybookActorSheet();
		const fists = { id: "eq1", kind: "weapon", name: "Fists", description: "", spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [fists] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(soleWeaponBundle(configureMoveRoll)).toEqual(expect.objectContaining({
			weaponKey: "eq1", lockedEffect: null, equipmentSpends: [], narrativeTags: [], rollModifiers: [], guided: null
		}));
	});

	it("is never Guided for Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		// With no weapons, the merged dialog offers exactly one weaponBundles entry (Unarmed) — its
		// own guided field (not a top-level option any more — see
		// PlaybookActorSheet#_rollMoveWithWeaponChoice/_weaponRollBundle) is null.
		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedAdvantage: null, lockedTrait: null, riders: [],
			weaponBundles: [expect.objectContaining({ weaponKey: UNARMED, weaponLabel: "Unarmed", guided: null })]
		});
	});

	it("posts a guided result and never rolls when Take 7-9 is chosen", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["guided"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		// weaponId is always included alongside takeSeven whenever weaponBundles was offered — see
		// move-dialogs.js's own takeSeven button handler, which reads the (possibly CSS-hidden, but
		// still present and defaulted to the sole bundle) weapon-select's value regardless.
		configureMoveRoll.mockResolvedValue({ takeSeven: true, weaponId: "eq1" });

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(postGuidedResult).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, {
			weaponLabel: "Rifle", narrativeTags: [], guidedSource: "Guided"
		});
		expect(rollMove).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("resolves narrativeTags on the Take 7-9 result for a fromCarrier weapon too (full parity), even when Guided comes from an installed Astir Part", async () => {
		const sheet = new PlaybookActorSheet();
		// Carries a narrative Impact tag (no codified mechanic) — proves the Guided/Take-7-9 path
		// resolves a fromCarrier weapon's own narrative tags exactly like a normal roll's (see
		// "PlaybookActorSheet#_rollMove - fromCarrier weapon parity" in
		// playbook-actor-sheet-the-captain.test.js). Guided itself comes from Spell Routines here,
		// not the weapon's own tag — this weapon carries no Guided tag of its own — but an installed
		// Astir Part's grant is actor-wide and still applies regardless of which weapon is in hand.
		const carrierWeapon = {
			id: "carrier-w1", kind: "weapon", name: "Broadside Cannon", tags: ["impact"], spent: [], fromCarrier: true
		};
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					equipment: [],
					astir: { id: "a1", parts: [SPELL_ROUTINES.key], piloted: true },
					guidedMoveChoices: { [SPELL_ROUTINES.key]: "exchange-blows" }
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ takeSeven: true });

		await sheet._rollMove(EXCHANGE_BLOWS, carrierWeapon);

		expect(postGuidedResult).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, {
			weaponLabel: "Broadside Cannon",
			narrativeTags: [{
				equipmentId: "carrier-w1",
				equipmentName: "Broadside Cannon",
				tagKey: "impact",
				tagLabel: "Impact",
				value: 1,
				showValue: true,
				description: findEquipmentTag("impact").description
			}],
			guidedSource: SPELL_ROUTINES.name
		});
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("labels the guided result Unarmed when taking 7-9 with no weapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ takeSeven: true });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(postGuidedResult).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, {
			weaponLabel: "Unarmed", narrativeTags: [], guidedSource: null
		});
	});
});

describe("PlaybookActorSheet#_rollMove - Spell Routines (Guided on the chosen move)", () => {
	it("passes Spell Routines' own name as guided for the chosen move when piloted", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					astir: { id: "a1", parts: [SPELL_ROUTINES.key], piloted: true },
					guidedMoveChoices: { [SPELL_ROUTINES.key]: "dispel-uncertainties" }
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			equipmentSpends: [], narrativeTags: [],
			rollModifiers: [], riders: [],
			guided: SPELL_ROUTINES.name
		});
	});

	it("is not Guided when not piloted, even with Spell Routines installed and the move chosen", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					astir: { id: "a1", parts: [SPELL_ROUTINES.key], piloted: false },
					guidedMoveChoices: { [SPELL_ROUTINES.key]: "dispel-uncertainties" }
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			equipmentSpends: [], narrativeTags: [],
			rollModifiers: [], riders: []
		});
	});

	it("is not Guided when a different move is rolled than the one chosen", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					astir: { id: "a1", parts: [SPELL_ROUTINES.key], piloted: true },
					guidedMoveChoices: { [SPELL_ROUTINES.key]: "read-the-room" }
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			equipmentSpends: [], narrativeTags: [],
			rollModifiers: [], riders: []
		});
	});

	it("is not Guided when no choice has been made yet", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [SPELL_ROUTINES.key], piloted: true } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			equipmentSpends: [], narrativeTags: [],
			rollModifiers: [], riders: []
		});
	});
});

describe("PlaybookActorSheet#_rollMove - Astir Part reactions (doubles regen)", () => {
	it("regains 1 Power when the roll's kept dice come up doubles with Flourish Component installed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [FLOURISH_COMPONENT.key], piloted: true, power: 1 } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "know", label: "KNOW", value: 1 }, advantage: "none", effect: "none" });
		rollMove.mockResolvedValue({
			message: undefined,
			dice: [{ original: 3, result: 3, changed: false, kept: true }, { original: 3, result: 3, changed: false, kept: true }]
		});

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.power": 2 });
	});

	it("does not regain Power when the roll's kept dice are not doubles", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [FLOURISH_COMPONENT.key], piloted: true, power: 1 } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "know", label: "KNOW", value: 1 }, advantage: "none", effect: "none" });
		rollMove.mockResolvedValue({
			message: undefined,
			dice: [{ original: 3, result: 3, changed: false, kept: true }, { original: 5, result: 5, changed: false, kept: true }]
		});

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does not regain Power on doubles when not piloted", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 }, defy: { value: 0 } },
				attributes: {
					astir: { id: "a1", parts: [FLOURISH_COMPONENT.key], piloted: false, power: 1 }
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "know", label: "KNOW", value: 1 }, advantage: "none", effect: "none" });
		rollMove.mockResolvedValue({
			message: undefined,
			dice: [{ original: 3, result: 3, changed: false, kept: true }, { original: 3, result: 3, changed: false, kept: true }]
		});

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});
