import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	rollMove: vi.fn()
}));

import { configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { DISPEL_UNCERTAINTIES, BITE_THE_DUST, WEAPON_CONDUIT, WARDING, ARTIFACT } from "./helpers/move-fixtures.js";

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
// Weapon-scoping itself (chooseWeapon, the weaponLabel it produces) is covered separately below in
// "PlaybookActorSheet#_onMoveRoll - weapon choice" and "PlaybookActorSheet#_equipmentSpends -
// weapon scoping".
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
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [blitzSpend], rollModifiers: [], rollStack: null }
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
			astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null
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
			astirPartSpends: [], equipmentSpends: [blitzSpend], rollModifiers: [], rollStack: null
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
			astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null
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
			astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null
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
			astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null
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
			astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null
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
			astirPartSpends: [], equipmentSpends: [expect.objectContaining({ equipmentId: "eq1", tagKey: "blitz" })], rollModifiers: [], rollStack: null
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
			astirPartSpends: [], equipmentSpends: [expect.objectContaining({ equipmentId: "eq1", tagKey: "blitz" })], rollModifiers: [], rollStack: null
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
			astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null
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
			astirPartSpends: [], equipmentSpends: [{ ...blitzSpend, disabled: true }], rollModifiers: [], rollStack: null
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

describe("PlaybookActorSheet#_onMoveRoll - astir part spends", () => {
	const know = { key: "know", label: "KNOW", value: 1 };
	const artifactSpend = {
		partKey: ARTIFACT.key,
		partName: "Artifact",
		description: ARTIFACT.spend.description,
		effect: null,
		advantage: "advantage",
		disabled: false
	};

	it("offers an installed part's spend when piloted and not yet Expended", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [ARTIFACT.key], piloted: true } }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [artifactSpend],
			equipmentSpends: [],
			rollModifiers: [], rollStack: null
		});
	});

	it("offers nothing when not piloted", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [ARTIFACT.key], piloted: false } }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [],
			equipmentSpends: [],
			rollModifiers: [], rollStack: null
		});
	});

	it("excludes a part already marked Expended", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					astir: { id: "a1", parts: [ARTIFACT.key], piloted: true },
					moveUses: { [ARTIFACT.key]: { expended: true } }
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [],
			equipmentSpends: [],
			rollModifiers: [], rollStack: null
		});
	});

	it("excludes a disabled part (moveUses.<key>.disabled), the same way it's dropped from _mountedParts", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					astir: { id: "a1", parts: [ARTIFACT.key], piloted: true },
					moveUses: { [ARTIFACT.key]: { disabled: true } }
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [],
			equipmentSpends: [],
			rollModifiers: [], rollStack: null
		});
	});

	it("excludes a part with no spend field", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [WEAPON_CONDUIT.key], piloted: true } }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [],
			equipmentSpends: [],
			rollModifiers: [], rollStack: null
		});
	});

	// Warding used to carry a `spend` with no `effect`/`advantage`, which leaked it into every
	// move's roll dialog as a checkbox that did nothing when checked (see docs/domains/frames.md's Astir
	// section) — this pins it as permanently excluded, the same way an effect-less equipment tag
	// (Ward) is excluded from _equipmentSpends, rather than relying on it merely happening to have
	// no `spend` field today.
	it("excludes Warding, a part whose spend sets neither effect nor advantage", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [WARDING.key], piloted: true } }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [],
			equipmentSpends: [],
			rollModifiers: [], rollStack: null
		});
	});

	// No Astir Part in the catalog uses spend.effect yet (only Artifact's spend.advantage), but
	// _astirPartSpends supports it symmetrically with an equipment tag's spend.effect (see
	// docs/domains/frames.md's Astir section) — this stubs _mountedParts with a synthetic part so that support
	// stays exercised rather than silently rotting until a real effect-based part is added.
	it("offers a hypothetical part whose spend sets effect rather than advantage", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 } }, attributes: {} } };
		sheet._mountedParts = () => [
			{ key: "astir-part:fixture", name: "Fixture", spend: { effect: "confidence", description: "d" } }
		];
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [{
				partKey: "astir-part:fixture", partName: "Fixture", description: "d",
				effect: "confidence", advantage: null, disabled: false
			}],
			equipmentSpends: [],
			rollModifiers: [], rollStack: null
		});
	});

	// Artifact's spend sets Advantage, not Effect (unlike an equipment tag's spend) — a locked
	// Effect (bite-the-dust at max Perils) has nothing to conflict with, so it stays offerable.
	it("leaves an advantage-only spend enabled even when the roll's Effect is locked (bite the dust at max Perils)", async () => {
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
					astir: { id: "a1", parts: [ARTIFACT.key], piloted: true }
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], {
			lockedEffect: "desperation", lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [{
				partKey: ARTIFACT.key,
				partName: "Artifact",
				description: ARTIFACT.spend.description,
				effect: null,
				advantage: "advantage",
				disabled: false
			}],
			equipmentSpends: [],
			rollModifiers: [], rollStack: null
		});
	});

	it("marks each checked part spend Expended, then rolls the move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [ARTIFACT.key], piloted: true } }
			},
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "none", spentParts: [ARTIFACT.key] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ [`system.attributes.moveUses.${ARTIFACT.key}.expended`]: true });
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DISPEL_UNCERTAINTIES, know, {
			...config,
			spentPartLabels: [{ key: ARTIFACT.key, label: "Artifact" }],
			// The actor's astir is piloted (see the fixture above) with overheating unset, so Heat
			// Up is available here — unlike every other _rollMove test in this file.
			heatUp: true
		});
	});

	it("does not touch moveUses when no astir part was spent", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: {} },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DISPEL_UNCERTAINTIES, know, { ...config, heatUp: NO_HEAT_UP });
	});
});
