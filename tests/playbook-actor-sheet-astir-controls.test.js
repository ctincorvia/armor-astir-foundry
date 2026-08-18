import { describe, expect, it, vi } from "vitest";

import {
	ASTIR_DEFAULT_IMG,
	ASTIR_PART_CATALOG,
	ASTIR_POWER_BASE,
	ASTIR_POWER_MIN,
	ASTIR_TIER_MAX,
	ASTIR_TIER_MIN,
	astirMaxPower,
	astirMaxWeaponPower
} from "../scripts/frames/astir.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { WEAPON_CONDUIT } from "./helpers/move-fixtures.js";

describe("PlaybookActorSheet#_onAstirCreate", () => {
	it("creates a fresh Astir at base power, tier minimum, with no parts or move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirCreate();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir": {
				id: "test-id",
				img: ASTIR_DEFAULT_IMG,
				core: "",
				approach: "",
				tier: ASTIR_TIER_MIN,
				power: ASTIR_POWER_BASE,
				overheating: false,
				piloted: false,
				parts: [],
				extraParts: [],
				move: null
			}
		});
	});

	it("does nothing when an Astir already exists", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirCreate();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("pre-sets the Summoner's fixed Astir Move (eidolon drive), not null", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Summoner" }, attributes: {} }, update: vi.fn() };

		sheet._onAstirCreate();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir": {
				id: "test-id",
				img: ASTIR_DEFAULT_IMG,
				core: "",
				approach: "",
				tier: ASTIR_TIER_MIN,
				power: ASTIR_POWER_BASE,
				overheating: false,
				piloted: false,
				parts: [],
				extraParts: [],
				move: "the-summoner:eidolon-drive"
			}
		});
	});
});

describe("PlaybookActorSheet#_onAstirDelete", () => {
	it("clears the Astir and drops every astir: true equipment entry", () => {
		const sheet = new PlaybookActorSheet();
		const astirWeapon = { id: "1", kind: "weapon", astir: true, name: "Lance", tags: [], spent: [] };
		const gear = { id: "2", kind: "gear", name: "Rope", tags: [], spent: [] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1" }, equipment: [astirWeapon, gear] } },
			update: vi.fn()
		};

		sheet._onAstirDelete();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir": null,
			"system.attributes.equipment": [gear]
		});
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirDelete();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirCoreChange", () => {
	it("writes the chosen core", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", core: "", approach: "arcane" } } }, update: vi.fn() };

		sheet._onAstirCoreChange({ currentTarget: { value: "alchemical" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.core": "alchemical" });
	});

	it("clears the approach when it isn't valid for the new core", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", core: "alchemical", approach: "arcane" } } }, update: vi.fn() };

		sheet._onAstirCoreChange({ currentTarget: { value: "natural" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.core": "natural",
			"system.attributes.astir.approach": ""
		});
	});

	it("keeps the approach when it's still valid for the new core", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", core: "alchemical", approach: "arcane" } } }, update: vi.fn() };

		sheet._onAstirCoreChange({ currentTarget: { value: "crystalline" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.core": "crystalline" });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirCoreChange({ currentTarget: { value: "alchemical" } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirApproachChange", () => {
	it("writes the chosen approach", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirApproachChange({ currentTarget: { value: "arcane" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.approach": "arcane" });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirApproachChange({ currentTarget: { value: "arcane" } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onGuidedMoveChoiceChange", () => {
	it("writes the chosen move key to the actor, keyed by the granting part", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onGuidedMoveChoiceChange({
			currentTarget: { dataset: { part: "astir-part:spell-routines" }, value: "dispel-uncertainties" }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.guidedMoveChoices.astir-part:spell-routines": "dispel-uncertainties"
		});
	});

	it("writes an empty string back when the blank option is chosen", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onGuidedMoveChoiceChange({
			currentTarget: { dataset: { part: "astir-part:spell-routines" }, value: "" }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.guidedMoveChoices.astir-part:spell-routines": ""
		});
	});
});

describe("PlaybookActorSheet#_onAstirTierStep", () => {
	it("increments the tier", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", tier: 3 } } }, update: vi.fn() };

		sheet._onAstirTierStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.tier": 4 });
	});

	it("clamps at ASTIR_TIER_MAX", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", tier: ASTIR_TIER_MAX } } }, update: vi.fn() };

		sheet._onAstirTierStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at ASTIR_TIER_MIN", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", tier: ASTIR_TIER_MIN } } }, update: vi.fn() };

		sheet._onAstirTierStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing tier as ASTIR_TIER_MIN", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirTierStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.tier": ASTIR_TIER_MIN + 1 });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirTierStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirPowerStep", () => {
	it("increments the power value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 1, parts: [] } } }, update: vi.fn() };

		sheet._onAstirPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.power": 2 });
	});

	it("clamps at the parts-adjusted maximum rather than a fixed constant", () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		const max = astirMaxPower([partKey]);
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: max, parts: [partKey] } } }, update: vi.fn() };

		sheet._onAstirPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at ASTIR_POWER_MIN", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: ASTIR_POWER_MIN, parts: [] } } }, update: vi.fn() };

		sheet._onAstirPowerStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing power and parts array as 0 and none", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.power": 1 });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirOverheatingToggle", () => {
	it("writes the checkbox's checked state", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirOverheatingToggle({ currentTarget: { checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.overheating": true });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirOverheatingToggle({ currentTarget: { checked: true } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

// Heat Up's own gate (see moves.js's heat-up move and moves-mixin.js's _availableHeatUp) — the
// chat-card button is only ever rendered when this is true (see move-chat.hbs's {{#if heatUp}}),
// so there's no unavailable reason to report, just a plain boolean.
describe("PlaybookActorSheet#_availableHeatUp", () => {
	it("is false when the actor has no Astir at all", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._availableHeatUp()).toBe(false);
	});

	it("is false when the Astir exists but isn't the mounted frame", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: false } } } };

		expect(sheet._availableHeatUp()).toBe(false);
	});

	it("is false when the Astir is mounted but already overheating", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: true, overheating: true } } } };

		expect(sheet._availableHeatUp()).toBe(false);
	});

	it("is true when the Astir is mounted and not overheating", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: true, overheating: false } } } };

		expect(sheet._availableHeatUp()).toBe(true);
	});
});

describe("PlaybookActorSheet#_onAstirWeaponPowerStep", () => {
	it("increments the weapon power value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", weaponPower: 0, parts: [WEAPON_CONDUIT.key] } } },
			update: vi.fn()
		};

		sheet._onAstirWeaponPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.weaponPower": 1 });
	});

	it("clamps at the parts-adjusted maximum rather than a fixed constant", () => {
		const sheet = new PlaybookActorSheet();
		const max = astirMaxWeaponPower([WEAPON_CONDUIT.key]);
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", weaponPower: max, parts: [WEAPON_CONDUIT.key] } } },
			update: vi.fn()
		};

		sheet._onAstirWeaponPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at ASTIR_POWER_MIN", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", weaponPower: ASTIR_POWER_MIN, parts: [] } } },
			update: vi.fn()
		};

		sheet._onAstirWeaponPowerStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing weaponPower and parts array as 0 and none", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirWeaponPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirWeaponPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirPotionToggle", () => {
	it("writes the checkbox's checked state for the chosen color", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", potions: { red: false, blue: false, yellow: true } } } },
			update: vi.fn()
		};

		sheet._onAstirPotionToggle({ currentTarget: { dataset: { potion: "red" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.potions.red": true });
	});

	it("can uncheck a previously spent color", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", potions: { red: true, blue: false, yellow: false } } } },
			update: vi.fn()
		};

		sheet._onAstirPotionToggle({ currentTarget: { dataset: { potion: "red" }, checked: false } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.potions.red": false });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirPotionToggle({ currentTarget: { dataset: { potion: "red" }, checked: true } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});
