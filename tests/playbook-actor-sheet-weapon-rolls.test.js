import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	rollMove: vi.fn()
}));

import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { UNARMED } from "../scripts/equipment/equipment.js";
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

	it("offers the actor's weapons as weaponBundles, Unarmed first, when the move usesWeapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd, sidearm] } } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), expect.objectContaining({
			weaponBundles: [
				expect.objectContaining({ weaponKey: UNARMED, weaponLabel: "Unarmed" }),
				expect.objectContaining({ weaponKey: "eq1", weaponLabel: "Halberd" }),
				expect.objectContaining({ weaponKey: "eq2", weaponLabel: "Sidearm" })
			]
		}));
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
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const { weaponBundles } = configureMoveRoll.mock.calls.at(-1)[2];
		expect(weaponBundles.map((b) => b.weaponKey)).toEqual([UNARMED, "eq1"]);
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
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const { weaponBundles } = configureMoveRoll.mock.calls.at(-1)[2];
		expect(weaponBundles.map((b) => b.weaponKey)).toEqual([UNARMED, "eq3"]);
	});

	it("excludes a disabled weapon from the weapon choice", async () => {
		const sheet = new PlaybookActorSheet();
		const disabledWeapon = { id: "eq3", kind: "weapon", disabled: true, name: "Broken Rifle", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd, disabledWeapon] } }
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const { weaponBundles } = configureMoveRoll.mock.calls.at(-1)[2];
		expect(weaponBundles.map((b) => b.weaponKey)).toEqual([UNARMED, "eq1"]);
	});

	it("aborts the whole roll when the merged dialog is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("scopes the roll to no weapon and labels it Unarmed when Unarmed is chosen", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none", weaponId: UNARMED };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", narrativeTags: [], heatUp: NO_HEAT_UP }
		);
	});

	it("scopes the roll to the chosen weapon and labels it by name", async () => {
		const sheet = new PlaybookActorSheet();
		const armed = { ...halberd, tags: ["blitz"] };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [armed, sidearm] } },
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none", weaponId: armed.id };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const { weaponBundles } = configureMoveRoll.mock.calls.at(-1)[2];
		const armedBundle = weaponBundles.find((b) => b.weaponKey === armed.id);
		expect(armedBundle.equipmentSpends).toEqual([expect.objectContaining({ equipmentId: armed.id, tagKey: "blitz" })]);
		// Blitz is the only tag on this weapon, and it's spendable (excluded from narrativeTags) —
		// see PlaybookActorSheet#_narrativeWeaponTags' own tests for the tag-inclusion cases.
		expect(armedBundle.narrativeTags).toEqual([]);
		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Halberd", narrativeTags: [], heatUp: NO_HEAT_UP }
		);
	});

	it("carries the weapon's narrative (no codified mechanic) tags on its own bundle", async () => {
		const sheet = new PlaybookActorSheet();
		const armed = { ...halberd, tags: ["impact"] };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [armed, sidearm] } }
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const { weaponBundles } = configureMoveRoll.mock.calls.at(-1)[2];
		const armedBundle = weaponBundles.find((b) => b.weaponKey === armed.id);
		expect(armedBundle.narrativeTags).toEqual([
			expect.objectContaining({ equipmentId: armed.id, tagKey: "impact", tagLabel: "Impact" })
		]);
	});

	it("carries the chosen weapon's still-live reroll tag on its own bundle (Defensive, Exchange Blows)", async () => {
		const sheet = new PlaybookActorSheet();
		const armed = { ...halberd, tags: ["defensive"] };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [armed, sidearm] } }
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const { weaponBundles } = configureMoveRoll.mock.calls.at(-1)[2];
		const armedBundle = weaponBundles.find((b) => b.weaponKey === armed.id);
		expect(armedBundle.rerollTag).toEqual({
			tagLabel: "Defensive",
			description: "Defensive weaponry is excellent for keeping foes at a distance, parrying their blows, " +
				"or suppressing them. Once per Scene, you may reroll a failed exchange blows when using it."
		});
	});

	it.each([
		["exchange-blows"],
		["strike-decisively"]
	])("carries a Versatile-tagged weapon's reroll tag on its %s bundle too", async (moveKey) => {
		const sheet = new PlaybookActorSheet();
		const armed = { ...halberd, tags: ["versatile"] };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [armed, sidearm] } }
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: moveKey } } });

		const { weaponBundles } = configureMoveRoll.mock.calls.at(-1)[2];
		const armedBundle = weaponBundles.find((b) => b.weaponKey === armed.id);
		expect(armedBundle.rerollTag).toEqual({
			tagLabel: "Versatile",
			description: "This tag combines the effects of decisive and defensive."
		});
	});

	it("carries no reroll tag on Exchange Blows for a Decisive-tagged weapon, since Decisive only covers Strike Decisively", async () => {
		const sheet = new PlaybookActorSheet();
		const armed = { ...halberd, tags: ["decisive"] };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [armed, sidearm] } }
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const { weaponBundles } = configureMoveRoll.mock.calls.at(-1)[2];
		const armedBundle = weaponBundles.find((b) => b.weaponKey === armed.id);
		expect(armedBundle.rerollTag).toBeNull();
	});

	it("treats a weaponId configureMoveRoll resolved that no longer matches any weapon as Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		const config = {
			trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none", weaponId: "not-a-real-weapon-id"
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", narrativeTags: [], heatUp: NO_HEAT_UP }
		);
	});

	it("still offers Unarmed alone, no chooseWeapon prompt, and rolls Unarmed when the actor has no weapons", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none", weaponId: UNARMED };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "strike-decisively" } } });

		const { weaponBundles } = configureMoveRoll.mock.calls.at(-1)[2];
		expect(weaponBundles.map((b) => b.weaponKey)).toEqual([UNARMED]);
		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, STRIKE_DECISIVELY, config.trait, { ...config, weaponLabel: "Unarmed", narrativeTags: [], heatUp: NO_HEAT_UP }
		);
	});
});

describe("PlaybookActorSheet#_onWeaponMoveRoll", () => {
	const halberd = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [], scale: "foot", tier: 1 };

	it("rolls the clicked move with the clicked weapon's own single bundle, offering no weapon choice", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none", weaponId: "eq1" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), expect.objectContaining({
			lockedAdvantage: null, lockedTrait: null, riders: []
		}));
		const { weaponBundles } = configureMoveRoll.mock.calls.at(-1)[2];
		// No Unarmed entry, and no <select>-worth of choice — exactly the one clicked weapon's bundle.
		expect(weaponBundles).toHaveLength(1);
		expect(weaponBundles[0].weaponKey).toBe("eq1");
		expect(weaponBundles[0].weaponCard).not.toBeNull();
		expect(weaponBundles[0].equipmentSpends).toEqual([expect.objectContaining({ equipmentId: "eq1", tagKey: "blitz" })]);
		expect(weaponBundles[0].narrativeTags).toEqual([]);
		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Halberd", narrativeTags: [], heatUp: NO_HEAT_UP }
		);
	});

	it("passes the weapon's still-live reroll tag through its own bundle", async () => {
		const sheet = new PlaybookActorSheet();
		const defensiveHalberd = { ...halberd, tags: ["blitz", "defensive"] };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [defensiveHalberd] } },
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none", weaponId: "eq1" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		const { weaponBundles } = configureMoveRoll.mock.calls.at(-1)[2];
		expect(weaponBundles).toHaveLength(1);
		expect(weaponBundles[0].rerollTag).toEqual({ tagLabel: "Defensive", description: expect.any(String) });
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
