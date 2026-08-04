import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn()
}));

vi.mock("../scripts/frames/astir.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseAstirPart: vi.fn(),
	chooseAstirWeapon: vi.fn()
}));

// findCarrierActors defaults to no Carriers in the world, matching how lead-a-sortie's CREW
// fixedTraits placeholder behaves before Carrier exists — same mock playbook-actor-sheet.test.js
// itself applies, needed here since getData's move-trait resolution reaches it regardless of which
// feature is under test.
vi.mock("../scripts/world-actors/carrier-actor-sheet.js", async (importOriginal) => ({
	...(await importOriginal()),
	findCarrierActors: vi.fn(() => [])
}));

// findStartingGearPool/findStartingMovePool default to their real implementations (every real
// playbook pool now has at least one non-empty field, since Commander's own pools were filled in —
// see starting-gear.js/starting-moves.js), overridden per-test below to exercise the "a real pool
// object exists but every field is empty" branch that no real playbook data shape reaches anymore.
vi.mock("../scripts/equipment/starting-gear.js", async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, findStartingGearPool: vi.fn(actual.findStartingGearPool) };
});
vi.mock("../scripts/moves/starting-moves.js", async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, findStartingMovePool: vi.fn(actual.findStartingMovePool) };
});

import { configureEquipment } from "../scripts/equipment/equipment.js";
import { ASTIR_PART_CATALOG, chooseAstirPart, chooseAstirWeapon } from "../scripts/frames/astir.js";
import { ARDENT_FEATURE_PARTS, ARDENT_FEATURE_WEAPONS } from "../scripts/frames/ardent.js";
import { findCarrierActors } from "../scripts/world-actors/carrier-actor-sheet.js";
import { findStartingGearPool } from "../scripts/equipment/starting-gear.js";
import { findStartingMovePool } from "../scripts/moves/starting-moves.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const WARDING = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:warding");

beforeEach(() => {
	chooseAstirPart.mockReset();
	chooseAstirWeapon.mockReset();
	configureEquipment.mockReset();
	findCarrierActors.mockClear();
	findCarrierActors.mockReturnValue([]);
	findStartingGearPool.mockClear();
	findStartingMovePool.mockClear();
	ui.notifications.warn.mockClear();
	foundry.utils.randomID.mockReturnValue("test-id");
});

describe("PlaybookActorSheet#getData - isCommander", () => {
	it("is true only for the Commander playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-commander" } } };

		expect(sheet.getData().isCommander).toBe(true);
	});

	it("is false for every other playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-scout" } } };

		expect(sheet.getData().isCommander).toBe(false);
	});

	it("is false with no playbook set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		expect(sheet.getData().isCommander).toBe(false);
	});
});

describe("PlaybookActorSheet#getData - tier bonus (Ace Crew)", () => {
	it("adds a picked move's tierBonus on top of base Tier while on foot", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: ["the-commander:ace-crew"] } } };

		expect(sheet.getData().tier).toEqual({ base: 2, effective: 2, fromFrame: false });
	});

	it("adds tierBonus on top of a mounted frame's own Tier too", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			name: "Vanguard",
			system: {
				attributes: {
					playbookMoves: ["the-commander:ace-crew"],
					astir: { tier: 4, piloted: true }
				}
			}
		};

		expect(sheet.getData().tier).toEqual({ base: 2, effective: 5, fromFrame: true, frameName: "Vanguard" });
	});

	it("sums tierBonus on top of whatever conflictTier already raised base to", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: ["the-commander:ace-crew", "the-scout:field-scout"] } }
		};

		expect(sheet.getData().tier).toEqual({ base: 3, effective: 3, fromFrame: false });
	});

	it("adds no bonus when Ace Crew isn't picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet.getData().tier).toEqual({ base: 1, effective: 1, fromFrame: false });
	});
});

describe("PlaybookActorSheet#getData - downtimeTokens max (Debrief)", () => {
	it("defaults to DOWNTIME_TOKENS_MAX_BASE (3) with no picked moves", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet.getData().downtimeTokens.max).toBe(3);
	});

	it("raises the max to a picked move's own downtimeTokensMax flag (Debrief: 4)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: ["the-commander:debrief"] } } };

		expect(sheet.getData().downtimeTokens.max).toBe(4);
	});

	it("defaults value to the derived max when nothing is stored yet", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: ["the-commander:debrief"] } } };

		expect(sheet.getData().downtimeTokens.value).toBe(4);
	});
});

describe("PlaybookActorSheet#_onDowntimeTokensStep - raised max", () => {
	it("clamps at the derived max rather than the flat base", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: ["the-commander:debrief"], downtimeTokens: { value: 4 } } },
			update: vi.fn()
		};

		sheet._onDowntimeTokensStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("allows stepping up to the raised max", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: ["the-commander:debrief"], downtimeTokens: { value: 3 } } },
			update: vi.fn()
		};

		sheet._onDowntimeTokensStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.downtimeTokens.value": 4 });
	});
});

describe("PlaybookActorSheet#_onRefreshSortie - raised max and Ardent Feature uses", () => {
	it("resets Downtime Tokens to the derived max, not the flat base", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: ["the-commander:debrief"] } }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.downtimeTokens.value": 4 })
		);
	});

	it("clears an installed Ardent Feature's expended/use checkboxes, same as any other move", () => {
		const sheet = new PlaybookActorSheet();
		const featurePart = ARDENT_FEATURE_PARTS.find((part) => part.key === "ardent-feature:armour-plating");
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", parts: [featurePart.key] }],
					moveUses: { [featurePart.key]: { expended: true } }
				}
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ [`system.attributes.moveUses.${featurePart.key}.expended`]: false })
		);
	});
});

describe("PlaybookActorSheet#getData - Ace Crew roster", () => {
	it("exposes the stored roster as-is", () => {
		const sheet = new PlaybookActorSheet();
		const crew = [{ id: "c1", name: "Reyes", adjective: "steady" }];
		sheet.actor = { system: { attributes: { aceCrew: crew } } };

		expect(sheet.getData().aceCrew).toEqual({ list: crew });
	});

	it("defaults to an empty roster", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet.getData().aceCrew).toEqual({ list: [] });
	});
});

describe("PlaybookActorSheet#_onAceCrewAdd", () => {
	it("appends a blank crew member", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { aceCrew: [] } }, update: vi.fn() };

		sheet._onAceCrewAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.aceCrew": [{ id: "test-id", name: "", adjective: "" }]
		});
	});

	it("leaves existing crew members untouched", () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "c1", name: "Reyes", adjective: "steady" };
		sheet.actor = { system: { attributes: { aceCrew: [existing] } }, update: vi.fn() };

		sheet._onAceCrewAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.aceCrew": [existing, { id: "test-id", name: "", adjective: "" }]
		});
	});
});

describe("PlaybookActorSheet#_onAceCrewRemove", () => {
	it("removes the matching crew member, leaving others untouched", () => {
		const sheet = new PlaybookActorSheet();
		const a = { id: "c1", name: "Reyes", adjective: "steady" };
		const b = { id: "c2", name: "Voss", adjective: "sharp" };
		sheet.actor = { system: { attributes: { aceCrew: [a, b] } }, update: vi.fn() };

		sheet._onAceCrewRemove({ currentTarget: { dataset: { entryId: "c1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.aceCrew": [b] });
	});
});

describe("PlaybookActorSheet#_onAceCrewFieldChange", () => {
	it("updates the matching crew member's field", () => {
		const sheet = new PlaybookActorSheet();
		const crew = { id: "c1", name: "Reyes", adjective: "steady" };
		sheet.actor = { system: { attributes: { aceCrew: [crew] } }, update: vi.fn() };

		sheet._onAceCrewFieldChange({
			currentTarget: { dataset: { entryId: "c1", field: "name" }, value: "Reyes-Ortiz" }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.aceCrew": [{ ...crew, name: "Reyes-Ortiz" }]
		});
	});
});

describe("PlaybookActorSheet#getData - Clocks", () => {
	it("expands each clock's own progressSteps sized to its own steps field", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { clocks: [{ id: "cl1", label: "Court-Martialled", progress: 2, steps: 4 }] } }
		};

		const data = sheet.getData();

		expect(data.clocks.min).toBe(2);
		expect(data.clocks.max).toBe(12);
		expect(data.clocks.list).toEqual([
			{
				id: "cl1",
				label: "Court-Martialled",
				progress: 2,
				steps: 4,
				progressSteps: [
					{ step: 1, filled: true },
					{ step: 2, filled: true },
					{ step: 3, filled: false },
					{ step: 4, filled: false }
				]
			}
		]);
	});

	it("defaults to an empty list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet.getData().clocks.list).toEqual([]);
	});
});

describe("PlaybookActorSheet#_onClockAdd", () => {
	it("appends a new clock via clocks.js's addClock", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { clocks: [] } }, update: vi.fn() };

		sheet._onClockAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.clocks": [{ id: "test-id", label: "", progress: 0, steps: 6 }]
		});
	});
});

describe("PlaybookActorSheet#_onClockRemove", () => {
	it("removes the matching clock", () => {
		const sheet = new PlaybookActorSheet();
		const clock = { id: "cl1", label: "A", progress: 0, steps: 6 };
		sheet.actor = { system: { attributes: { clocks: [clock] } }, update: vi.fn() };

		sheet._onClockRemove({ currentTarget: { dataset: { clockId: "cl1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.clocks": [] });
	});
});

describe("PlaybookActorSheet#_onClockLabelChange", () => {
	it("updates the matching clock's label, trimmed", () => {
		const sheet = new PlaybookActorSheet();
		const clock = { id: "cl1", label: "Old", progress: 0, steps: 6 };
		sheet.actor = { system: { attributes: { clocks: [clock] } }, update: vi.fn() };

		sheet._onClockLabelChange({ currentTarget: { dataset: { clockId: "cl1" }, value: " New " } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.clocks": [{ ...clock, label: "New" }]
		});
	});
});

describe("PlaybookActorSheet#_onClockStepsChange", () => {
	it("updates the matching clock's step count", () => {
		const sheet = new PlaybookActorSheet();
		const clock = { id: "cl1", label: "A", progress: 0, steps: 6 };
		sheet.actor = { system: { attributes: { clocks: [clock] } }, update: vi.fn() };

		sheet._onClockStepsChange({ currentTarget: { dataset: { clockId: "cl1" }, value: "4" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.clocks": [{ ...clock, steps: 4 }]
		});
	});
});

describe("PlaybookActorSheet#_onClockStep", () => {
	it("fills up to the clicked step", () => {
		const sheet = new PlaybookActorSheet();
		const clock = { id: "cl1", label: "A", progress: 0, steps: 6 };
		sheet.actor = { system: { attributes: { clocks: [clock] } }, update: vi.fn() };

		sheet._onClockStep({ currentTarget: { dataset: { clockId: "cl1", step: "3" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.clocks": [{ ...clock, progress: 3 }]
		});
	});
});

describe("PlaybookActorSheet#getData - Ardent Feature parts appear in the per-Ardent Moves group", () => {
	it("resolves an installed Ardent Feature part alongside any baseline parts", () => {
		const sheet = new PlaybookActorSheet();
		const featurePart = ARDENT_FEATURE_PARTS.find((part) => part.key === "ardent-feature:armour-plating");
		sheet.actor = {
			system: {
				attributes: { ardents: [{ id: "ar1", name: "Custom Ardent", tier: 2, parts: [featurePart.key] }] }
			}
		};

		const group = sheet.getData().moveGroups.find((g) => g.label === "Custom Ardent Moves");

		expect(group.moves.map((m) => m.key)).toEqual([featurePart.key]);
	});
});

describe("PlaybookActorSheet#getData - Ardent Feature pool split", () => {
	it("splits an Ardent's Feature parts out of the baseline parts list", () => {
		const sheet = new PlaybookActorSheet();
		const featurePart = ARDENT_FEATURE_PARTS[0];
		sheet.actor = {
			system: {
				attributes: { ardents: [{ id: "ar1", name: "Custom Ardent", tier: 2, parts: [featurePart.key] }] }
			}
		};

		const data = sheet.getData();

		expect(data.ardents[0].parts).toEqual([]);
		expect(data.ardents[0].featureParts).toEqual([
			{ key: featurePart.key, name: featurePart.name, partType: featurePart.partType, tier: 2 }
		]);
	});

	it("splits an Ardent's commanderFeature weapons out of the baseline weapons list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", name: "Custom Ardent", tier: 2, parts: [] }],
					equipment: [
						{ id: "w1", kind: "weapon", ardent: "ar1", name: "Baseline", tags: ["melee"] },
						{ id: "w2", kind: "weapon", ardent: "ar1", commanderFeature: true, name: "Feature", tags: ["ranged"] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.ardents[0].weapons.map((w) => w.id)).toEqual(["w1"]);
		expect(data.ardents[0].featureWeapons.map((w) => w.id)).toEqual(["w2"]);
	});

	it("reports featureMax as ARDENT_FEATURE_MAX_BASE (3) with no Requisitions picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }] } } };

		expect(sheet.getData().ardents[0].featureMax).toBe(3);
	});

	it("raises featureMax to 5 once Requisitions is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { ardents: [{ id: "ar1", parts: [] }], playbookMoves: ["the-commander:requisitions"] }
			}
		};

		expect(sheet.getData().ardents[0].featureMax).toBe(5);
	});

	it("reports featureLoadoutFull once the Feature pool is at its cap", () => {
		const sheet = new PlaybookActorSheet();
		const keys = ARDENT_FEATURE_PARTS.slice(0, 3).map((part) => part.key);
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: keys }] } } };

		expect(sheet.getData().ardents[0].featureLoadoutFull).toBe(true);
	});

	it("keeps the baseline loadoutFull check scoped to non-Feature items only", () => {
		const sheet = new PlaybookActorSheet();
		const keys = ARDENT_FEATURE_PARTS.slice(0, 3).map((part) => part.key);
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: keys }] } } };

		expect(sheet.getData().ardents[0].loadoutFull).toBe(false);
	});
});

describe("PlaybookActorSheet#_onArdentPartAdd - independence from the Feature pool", () => {
	it("is not blocked by a full Feature pool", async () => {
		const sheet = new PlaybookActorSheet();
		const keys = ARDENT_FEATURE_PARTS.slice(0, 3).map((part) => part.key);
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: keys }] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(WARDING.key);

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(ui.notifications.warn).not.toHaveBeenCalled();
		expect(sheet.actor.update).toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentWeaponAdd - independence from the Feature pool", () => {
	it("is not blocked by commanderFeature-flagged weapons", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", parts: [] }],
					equipment: [
						{ id: "w1", kind: "weapon", ardent: "ar1", commanderFeature: true },
						{ id: "w2", kind: "weapon", ardent: "ar1", commanderFeature: true }
					]
				}
			},
			update: vi.fn()
		};
		const template = { key: "x", name: "x", description: "", tags: ["melee"] };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Spear", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onArdentWeaponAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(ui.notifications.warn).not.toHaveBeenCalled();
		expect(sheet.actor.update).toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentFeaturePartAdd", () => {
	it("offers the Ardent Feature catalog and adds the chosen part", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }] } }, update: vi.fn() };
		const featurePart = ARDENT_FEATURE_PARTS[0];
		chooseAstirPart.mockResolvedValue(featurePart.key);

		await sheet._onArdentFeaturePartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirPart).toHaveBeenCalledWith([], ARDENT_FEATURE_PARTS, { title: "Add an Ardent Feature" });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", parts: [featurePart.key] }]
		});
	});

	it("refuses once the Feature pool is at its cap (3, no Requisitions)", async () => {
		const sheet = new PlaybookActorSheet();
		const keys = ARDENT_FEATURE_PARTS.slice(0, 3).map((part) => part.key);
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: keys }] } }, update: vi.fn() };

		await sheet._onArdentFeaturePartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirPart).not.toHaveBeenCalled();
		expect(ui.notifications.warn).toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("allows a 4th Feature once Requisitions raises the cap to 5", async () => {
		const sheet = new PlaybookActorSheet();
		const keys = ARDENT_FEATURE_PARTS.slice(0, 3).map((part) => part.key);
		sheet.actor = {
			system: {
				attributes: { ardents: [{ id: "ar1", parts: keys }], playbookMoves: ["the-commander:requisitions"] }
			},
			update: vi.fn()
		};
		chooseAstirPart.mockResolvedValue(ARDENT_FEATURE_PARTS[3].key);

		await sheet._onArdentFeaturePartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(ui.notifications.warn).not.toHaveBeenCalled();
		expect(sheet.actor.update).toHaveBeenCalled();
	});

	it("does not count baseline parts/weapons against the Feature cap", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", parts: ["astir-part:extra-arms"] }],
					equipment: [{ id: "w1", kind: "weapon", ardent: "ar1" }]
				}
			},
			update: vi.fn()
		};
		chooseAstirPart.mockResolvedValue(ARDENT_FEATURE_PARTS[0].key);

		await sheet._onArdentFeaturePartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(ui.notifications.warn).not.toHaveBeenCalled();
		expect(sheet.actor.update).toHaveBeenCalled();
	});

	it("does nothing when the picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(null);

		await sheet._onArdentFeaturePartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an already-picked Feature part", async () => {
		const sheet = new PlaybookActorSheet();
		const key = ARDENT_FEATURE_PARTS[0].key;
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [key] }] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(key);

		await sheet._onArdentFeaturePartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an unknown Ardent id", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		await sheet._onArdentFeaturePartAdd({ currentTarget: { dataset: { ardentId: "nope" } } });

		expect(chooseAstirPart).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentFeatureWeaponAdd", () => {
	it("chains the Ardent Feature catalog picker into configureEquipment, tagging commanderFeature: true", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { ardents: [{ id: "ar1", parts: [] }], equipment: [] } },
			update: vi.fn()
		};
		const template = ARDENT_FEATURE_WEAPONS[0];
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Turret", description: "", kind: "weapon", tags: ["ranged"] });

		await sheet._onArdentFeatureWeaponAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirWeapon).toHaveBeenCalledWith(ARDENT_FEATURE_WEAPONS, { title: "Pick an Ardent Feature Weapon" });
		expect(configureEquipment).toHaveBeenCalledWith(template, undefined, { ardentWeapon: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "test-id",
					spent: [],
					ardent: "ar1",
					commanderFeature: true,
					name: "Turret",
					description: "",
					kind: "weapon",
					tags: ["ranged"]
				}
			]
		});
	});

	it("refuses once the Feature pool is at its cap", async () => {
		const sheet = new PlaybookActorSheet();
		const keys = ARDENT_FEATURE_PARTS.slice(0, 3).map((part) => part.key);
		sheet.actor = {
			system: { attributes: { ardents: [{ id: "ar1", parts: keys }], equipment: [] } },
			update: vi.fn()
		};

		await sheet._onArdentFeatureWeaponAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirWeapon).not.toHaveBeenCalled();
		expect(ui.notifications.warn).toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the catalog picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { ardents: [{ id: "ar1", parts: [] }], equipment: [] } },
			update: vi.fn()
		};
		chooseAstirWeapon.mockResolvedValue(null);

		await sheet._onArdentFeatureWeaponAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the editor is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { ardents: [{ id: "ar1", parts: [] }], equipment: [] } },
			update: vi.fn()
		};
		chooseAstirWeapon.mockResolvedValue(ARDENT_FEATURE_WEAPONS[0]);
		configureEquipment.mockResolvedValue(null);

		await sheet._onArdentFeatureWeaponAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an unknown Ardent id", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		await sheet._onArdentFeatureWeaponAdd({ currentTarget: { dataset: { ardentId: "nope" } } });

		expect(chooseAstirWeapon).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentFeaturePartAdd - branch edges", () => {
	it("treats a missing parts array as empty", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1" }] } }, update: vi.fn() };
		const featurePart = ARDENT_FEATURE_PARTS[0];
		chooseAstirPart.mockResolvedValue(featurePart.key);

		await sheet._onArdentFeaturePartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", parts: [featurePart.key] }]
		});
	});

	it("leaves other Ardents untouched", async () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "ar2", parts: [] };
		sheet.actor = {
			system: { attributes: { ardents: [{ id: "ar1", parts: [] }, other] } },
			update: vi.fn()
		};
		const featurePart = ARDENT_FEATURE_PARTS[0];
		chooseAstirPart.mockResolvedValue(featurePart.key);

		await sheet._onArdentFeaturePartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", parts: [featurePart.key] }, other]
		});
	});
});

describe("PlaybookActorSheet#getData - Clocks - branch edges", () => {
	it("treats a missing steps field as CLOCK_STEPS_DEFAULT and a missing progress field as 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { clocks: [{ id: "cl1", label: "A" }] } } };

		const data = sheet.getData();

		expect(data.clocks.list[0].progressSteps).toHaveLength(6);
		expect(data.clocks.list[0].progressSteps.every((step) => !step.filled)).toBe(true);
	});
});

describe("PlaybookActorSheet#getData/_onStartingGearAdd/_onStartingMovesAdd - real pool, every field empty", () => {
	it("getData.equipment.startingGear.available is false for a real pool with nothing to offer", () => {
		findStartingGearPool.mockReturnValueOnce({ grantedItems: [], groups: [] });
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "Anything" }, attributes: {} } };

		expect(sheet.getData().equipment.startingGear).toEqual({ available: false });
	});

	it("_onStartingGearAdd does nothing for a real pool with nothing to offer", async () => {
		findStartingGearPool.mockReturnValueOnce({ grantedItems: [], groups: [] });
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "Anything" }, attributes: { equipment: [] } }, update: vi.fn() };

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("getData.moveGroups[1].startingMovesAvailable is false for a real pool with nothing to offer", () => {
		findStartingMovePool.mockReturnValueOnce({ grantedKeys: [], pickOneKeys: [], chooseCount: 0 });
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "Anything" }, attributes: {} } };

		const playbookGroup = sheet.getData().moveGroups.find((g) => g.label === "Playbook Moves");

		expect(playbookGroup.startingMovesAvailable).toBe(false);
	});

	it("_onStartingMovesAdd does nothing for a real pool with nothing to offer", async () => {
		findStartingMovePool.mockReturnValueOnce({ grantedKeys: [], pickOneKeys: [], chooseCount: 0 });
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "Anything" } }, update: vi.fn() };

		await sheet._onStartingMovesAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});
