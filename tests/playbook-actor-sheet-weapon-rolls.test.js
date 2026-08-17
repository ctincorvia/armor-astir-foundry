import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	rollMove: vi.fn()
}));

// Only the weapon-choice dialog is mocked — the tag catalog and resolve helpers stay real.
vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseWeapon: vi.fn()
}));

import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { UNARMED, chooseWeapon } from "../scripts/equipment/equipment.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { EXCHANGE_BLOWS, STRIKE_DECISIVELY } from "./helpers/move-fixtures.js";

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
	chooseWeapon.mockClear();
});

describe("PlaybookActorSheet#activateListeners - weapon moves", () => {
	it("binds a click handler to the per-weapon quick-roll buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".weapon-move-roll");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onMoveRoll - weapon choice", () => {
	const halberd = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
	const sidearm = { id: "eq2", kind: "weapon", name: "Sidearm", description: "", tags: [], spent: [], scale: "foot", tier: 1 };

	it("prompts chooseWeapon with the actor's weapons when the move usesWeapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd, sidearm] } } };
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(chooseWeapon).toHaveBeenCalledWith([halberd, sidearm]);
	});

	it("excludes Astir weapons from the weapon choice while unpiloted", async () => {
		const sheet = new PlaybookActorSheet();
		const astirWeapon = { id: "eq3", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { astir: { id: "a1", piloted: false }, equipment: [halberd, astirWeapon] }
			}
		};
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(chooseWeapon).toHaveBeenCalledWith([halberd]);
	});

	it("excludes mundane weapons from the weapon choice while piloted, offering only Astir weapons", async () => {
		const sheet = new PlaybookActorSheet();
		const astirWeapon = { id: "eq3", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { astir: { id: "a1", piloted: true }, equipment: [halberd, astirWeapon] }
			}
		};
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(chooseWeapon).toHaveBeenCalledWith([astirWeapon]);
	});

	it("excludes a disabled weapon from the weapon choice", async () => {
		const sheet = new PlaybookActorSheet();
		const disabledWeapon = { id: "eq3", kind: "weapon", disabled: true, name: "Broken Rifle", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd, disabledWeapon] } }
		};
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(chooseWeapon).toHaveBeenCalledWith([halberd]);
	});

	it("aborts the whole roll when the weapon-choice dialog is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } } };
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});

	it("scopes the roll to no weapon and labels it Unarmed when Unarmed is chosen", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		chooseWeapon.mockResolvedValue(UNARMED);
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null
		});
		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", weaponTags: null, heatUp: NO_HEAT_UP }
		);
	});

	it("scopes the roll to the chosen weapon and labels it by name", async () => {
		const sheet = new PlaybookActorSheet();
		const armed = { ...halberd, tags: ["blitz"] };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [armed, sidearm] } },
			update: vi.fn()
		};
		chooseWeapon.mockResolvedValue(armed.id);
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [expect.objectContaining({ equipmentId: armed.id, tagKey: "blitz" })],
			rollModifiers: [], rollStack: null
		});
		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Halberd", weaponTags: "Blitz", heatUp: NO_HEAT_UP }
		);
	});

	it("treats an id chooseWeapon resolved that no longer matches any weapon as Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		chooseWeapon.mockResolvedValue("not-a-real-weapon-id");
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", weaponTags: null, heatUp: NO_HEAT_UP }
		);
	});

	it("skips chooseWeapon entirely and rolls Unarmed when the actor has no weapons", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "strike-decisively" } } });

		expect(chooseWeapon).not.toHaveBeenCalled();
		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, STRIKE_DECISIVELY, config.trait, { ...config, weaponLabel: "Unarmed", weaponTags: null, heatUp: NO_HEAT_UP }
		);
	});
});

describe("PlaybookActorSheet#_onWeaponMoveRoll", () => {
	const halberd = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [], scale: "foot", tier: 1 };

	it("rolls the clicked move with the clicked weapon, without prompting chooseWeapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(chooseWeapon).not.toHaveBeenCalled();
		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [expect.objectContaining({ equipmentId: "eq1", tagKey: "blitz" })],
			rollModifiers: [], rollStack: null
		});
		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Halberd", weaponTags: "Blitz", heatUp: NO_HEAT_UP }
		);
	});

	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [halberd] } } };

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "not-a-real-move", equipmentId: "eq1" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});

	it("does nothing for an unrecognized equipment id", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [halberd] } } };

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "not-a-real-id" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});

	it("does nothing for a disabled weapon", async () => {
		const sheet = new PlaybookActorSheet();
		const disabledWeapon = { id: "eq1", kind: "weapon", disabled: true, name: "Broken Rifle", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [disabledWeapon] } } };

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});
});
