import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	postGuidedResult: vi.fn(),
	rollMove: vi.fn()
}));

import { configureMoveRoll, postGuidedResult, rollMove } from "../scripts/moves/moves.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import {
	EXCHANGE_BLOWS, DISPEL_UNCERTAINTIES, FLOURISH_COMPONENT, SPELL_ROUTINES
} from "./helpers/move-fixtures.js";

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

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [],
			rollModifiers: [], rollStack: null, disadvantageConversion: null,
			guided: "Guided"
		});
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

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), { lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null, disadvantageConversion: null });
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

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), { lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null, disadvantageConversion: null });
	});

	it("is never Guided for Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), { lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null, disadvantageConversion: null });
	});

	it("posts a guided result and never rolls when Take 7-9 is chosen", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["guided"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ takeSeven: true });

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(postGuidedResult).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, {
			weaponLabel: "Rifle", weaponTags: "Guided", guidedSource: "Guided"
		});
		expect(rollMove).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
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
			weaponLabel: "Unarmed", weaponTags: null, guidedSource: null
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
			astirPartSpends: [],
			equipmentSpends: [],
			rollModifiers: [], rollStack: null, disadvantageConversion: null,
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
			astirPartSpends: [],
			equipmentSpends: [],
			rollModifiers: [], rollStack: null, disadvantageConversion: null
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
			astirPartSpends: [],
			equipmentSpends: [],
			rollModifiers: [], rollStack: null, disadvantageConversion: null
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
			astirPartSpends: [],
			equipmentSpends: [],
			rollModifiers: [], rollStack: null, disadvantageConversion: null
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
