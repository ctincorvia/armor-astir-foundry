import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the picker dialogs are mocked — the catalogs and helpers stay real, so the sheet is
// exercised against the actual Astir Part/Move/Weapon content.
vi.mock("../scripts/frames/astir.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseAstirPart: vi.fn(),
	chooseAstirMove: vi.fn(),
	chooseAstirWeapon: vi.fn()
}));

// Only the editor dialog is mocked — the tag catalog and resolve helpers stay real, same
// reasoning as astir.js above.
vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn()
}));

import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { configureEquipment } from "../scripts/equipment/equipment.js";
import {
	ASTIR_CORES,
	ASTIR_DEFAULT_IMG,
	ASTIR_MOVE_CATALOG,
	ASTIR_PART_CATALOG,
	ASTIR_POWER_BASE,
	ASTIR_POWER_MIN,
	ASTIR_TIER_MAX,
	ASTIR_TIER_MIN,
	astirMaxPower,
	astirMaxWeaponPower,
	chooseAstirMove,
	chooseAstirPart,
	chooseAstirWeapon
} from "../scripts/frames/astir.js";
import { BASIC_MOVES, SPECIAL_MOVES } from "../scripts/moves/moves.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const WEAPON_CONDUIT = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:weapon-conduit");
const ALCHEMICAL_SUITE = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:alchemical-suite");
const WARDING = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:warding");
const ARTIFACT = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:artifact");
const LEGACY = ASTIR_MOVE_CATALOG.find((m) => m.key === "astir:legacy");
const MANA_DEVOURER = ASTIR_MOVE_CATALOG.find((m) => m.key === "astir:mana-devourer");
const PETRIFIER_CORE = ASTIR_MOVE_CATALOG.find((m) => m.key === "astir:petrifier-core");
const INERTIA_DRIVE = ASTIR_MOVE_CATALOG.find((m) => m.key === "astir:inertia-drive");
const FUTURE_SIGHT = ASTIR_MOVE_CATALOG.find((m) => m.key === "astir:future-sight");
const LEAD_A_SORTIE = SPECIAL_MOVES.find((m) => m.key === "lead-a-sortie");
const STRIKE_DECISIVELY = BASIC_MOVES.find((m) => m.key === "strike-decisively");
const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const WEATHER_THE_STORM = BASIC_MOVES.find((m) => m.key === "weather-the-storm");
const READ_THE_ROOM = BASIC_MOVES.find((m) => m.key === "read-the-room");

beforeEach(() => {
	chooseAstirPart.mockClear();
	chooseAstirMove.mockClear();
	chooseAstirWeapon.mockClear();
	configureEquipment.mockClear();
	ui.notifications.warn.mockClear();
});

describe("PlaybookActorSheet#getData - astir", () => {
	it("is available when channel is missing from stats (reads as enabled)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.astir.available).toBe(true);
		expect(data.astir.exists).toBe(false);
	});

	it("is available when channel is explicitly enabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		expect(sheet.getData().astir.available).toBe(true);
	});

	it("is unavailable when channel is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		expect(sheet.getData().astir.available).toBe(false);
	});

	it("is unavailable when channel is disabled and no playbook move grants Astir access", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 0, disabled: true } },
				attributes: { playbookMoves: [] }
			}
		};

		expect(sheet.getData().astir.available).toBe(false);
	});

	it("is available when channel is disabled but Mechanical Aria has been picked (The Icon)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 0, disabled: true } },
				attributes: { playbookMoves: ["the-icon:mechanical-aria"] }
			}
		};

		expect(sheet.getData().astir.available).toBe(true);
	});

	it("always exposes the core catalog and tier bounds, even with no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.astir.cores).toEqual(ASTIR_CORES);
		expect(data.astir.tierMin).toBe(ASTIR_TIER_MIN);
		expect(data.astir.tierMax).toBe(ASTIR_TIER_MAX);
	});

	it("reports exists true once an Astir is stored", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [], move: null } }
			}
		};

		expect(sheet.getData().astir.exists).toBe(true);
	});

	it("names the Astir after the character's Callsign", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			name: "Fallback Name",
			system: {
				stats: {},
				details: { callsign: { value: "Vanguard" } },
				attributes: { astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [], move: null } }
			}
		};

		expect(sheet.getData().astir.name).toBe("Vanguard");
	});

	it("falls back to the actor's own name when Callsign is blank", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			name: "Fallback Name",
			system: {
				stats: {},
				details: { callsign: { value: "" } },
				attributes: { astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [], move: null } }
			}
		};

		expect(sheet.getData().astir.name).toBe("Fallback Name");
	});

	it("narrows Approach options to the chosen Core", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "alchemical", approach: "arcane", tier: 3, power: 4, overheating: false, parts: [], move: null }
				}
			}
		};

		expect(sheet.getData().astir.approachOptions.map((a) => a.key)).toEqual(["mundane", "arcane"]);
	});

	it("reports max power as the base minus every equipped part's cost", () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [partKey], move: null }
				}
			}
		};

		const data = sheet.getData();

		expect(data.astir.power).toEqual({ value: 4, max: astirMaxPower([partKey], []), negative: false });
	});

	it("resolves parts to their name, power cost, and the Astir's own tier", () => {
		const sheet = new PlaybookActorSheet();
		const part = ASTIR_PART_CATALOG[0];
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [part.key], move: null }
				}
			}
		};

		expect(sheet.getData().astir.parts).toEqual([
			{ key: part.key, name: part.name, powerCost: part.powerCost, partType: part.partType, tier: 3 }
		]);
	});

	it("falls back to ASTIR_TIER_MIN for a part's tier when the Astir has no tier stored", () => {
		const sheet = new PlaybookActorSheet();
		const part = ASTIR_PART_CATALOG[0];
		sheet.actor = { system: { stats: {}, attributes: { astir: { id: "a1", parts: [part.key] } } } };

		expect(sheet.getData().astir.parts[0].tier).toBe(ASTIR_TIER_MIN);
	});

	it("reports the piloted flag", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, parts: [], move: null, piloted: true } }
			}
		};

		expect(sheet.getData().astir.piloted).toBe(true);
	});

	it("reports weapon power as 0/0 without Weapon Conduit, and the bonus max with it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, parts: [], move: null } }
			}
		};

		expect(sheet.getData().astir.weaponPower).toEqual({ value: 0, max: 0 });

		sheet.actor.system.attributes.astir.parts = [WEAPON_CONDUIT.key];
		sheet.actor.system.attributes.astir.weaponPower = 1;

		expect(sheet.getData().astir.weaponPower).toEqual({ value: 1, max: astirMaxWeaponPower([WEAPON_CONDUIT.key], []) });
	});

	it("lowers max power for an Astir weapon's Drain, absorbed by Weapon Power first when Weapon Conduit is installed", () => {
		const sheet = new PlaybookActorSheet();
		const weapon = { id: "w1", kind: "weapon", astir: true, tags: ["drain-1"] };
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, weaponPower: 0, parts: [WEAPON_CONDUIT.key], move: null },
					equipment: [weapon]
				}
			}
		};

		const data = sheet.getData();

		// Weapon Conduit's capacity (2) fully absorbs the single Drain-1, so main Power is untouched
		// and Weapon Power's max drops from 2 to 1.
		expect(data.astir.power).toEqual({ value: 4, max: ASTIR_POWER_BASE, negative: false });
		expect(data.astir.weaponPower).toEqual({ value: 0, max: 1 });
	});

	it("flags power.negative and spills excess Drain onto main Power once Weapon Power's capacity is used up", () => {
		const sheet = new PlaybookActorSheet();
		const weapons = [
			{ id: "w1", kind: "weapon", astir: true, tags: ["drain-3"] },
			{ id: "w2", kind: "weapon", astir: true, tags: ["drain-3"] }
		];
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: -2, parts: [], move: null },
					equipment: weapons
				}
			}
		};

		const data = sheet.getData();

		expect(data.astir.power).toEqual({ value: -2, max: astirMaxPower([], weapons), negative: true });
		expect(data.astir.power.max).toBeLessThan(0);
	});

	it("reports Potions once Alchemical Suite is installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: {
						id: "a1",
						core: "",
						approach: "",
						tier: 3,
						power: 4,
						parts: [ALCHEMICAL_SUITE.key],
						move: null,
						potions: { red: 2, blue: 0, yellow: 1 }
					}
				}
			}
		};

		expect(sheet.getData().astir.potions).toEqual({ red: 2, blue: 0, yellow: 1 });
	});

	it("defaults each Potion color to 0 when none is stored yet", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, parts: [ALCHEMICAL_SUITE.key], move: null }
				}
			}
		};

		expect(sheet.getData().astir.potions).toEqual({ red: 0, blue: 0, yellow: 0 });
	});

	it("resolves the unique move to its key and name", () => {
		const sheet = new PlaybookActorSheet();
		const move = ASTIR_MOVE_CATALOG[0];
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [], move: move.key }
				}
			}
		};

		expect(sheet.getData().astir.move).toEqual({ key: move.key, name: move.name });
	});

	it("reports no move when none is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [], move: null } }
			}
		};

		expect(sheet.getData().astir.move).toBeNull();
	});

	it("surfaces only astir: true weapons under astir.weapons, with the Astir's own tier/scale", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 4, power: 4, overheating: false, parts: [], move: null },
					equipment: [
						{ id: "1", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] },
						{ id: "2", kind: "weapon", name: "Rifle", description: "", tags: [], spent: [], scale: "foot", tier: 2 }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.astir.weapons.map((w) => w.id)).toEqual(["1"]);
		expect(data.astir.weapons[0].tier).toBe(4);
		expect(data.astir.weapons[0].scaleLabel).toBe("Astir Scale");
		expect(data.equipment.astirWeapons).toBe(data.astir.weapons);
		expect(data.equipment.weapons.map((w) => w.id)).toEqual(["2"]);
	});

	it("defaults every optional field when only an id is stored", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { name: "Fallback Name", system: { stats: {}, attributes: { astir: { id: "a1" } } } };

		const data = sheet.getData();

		expect(data.astir).toEqual({
			available: true,
			exists: true,
			cores: ASTIR_CORES,
			tierMin: ASTIR_TIER_MIN,
			tierMax: ASTIR_TIER_MAX,
			name: "Fallback Name",
			img: ASTIR_DEFAULT_IMG,
			core: "",
			approachOptions: [],
			approach: "",
			tier: ASTIR_TIER_MIN,
			overheating: false,
			piloted: false,
			power: { value: 0, max: ASTIR_POWER_BASE, negative: false },
			weaponPower: { value: 0, max: 0 },
			potions: null,
			parts: [],
			move: null,
			weapons: []
		});
	});
});

describe("PlaybookActorSheet#getData - astir moves group", () => {
	it("always includes Heat Up and Subsystems, even when the Astir has no parts and no unique move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [], move: null } }
			}
		};

		const group = sheet.getData().moveGroups.find((g) => g.label === "Astir Moves");

		expect(group.moves.map((m) => m.key)).toEqual(["heat-up", "subsystems"]);
	});

	it("omits the Astir Moves group entirely when there is no Astir at all", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.moveGroups).toHaveLength(3);
		expect(data.moveGroups.find((g) => g.label === "Astir Moves")).toBeUndefined();
	});

	it("lists Heat Up and Subsystems first, then parts, then the unique move, read-only (no addable/removable)", () => {
		const sheet = new PlaybookActorSheet();
		const part = ASTIR_PART_CATALOG[0];
		const move = ASTIR_MOVE_CATALOG[0];
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [part.key], move: move.key }
				}
			}
		};

		const group = sheet.getData().moveGroups.find((g) => g.label === "Astir Moves");

		expect(group.moves.map((m) => m.key)).toEqual(["heat-up", "subsystems", part.key, move.key]);
		expect(group.addable).toBeUndefined();
		expect(group.removable).toBeUndefined();
	});

	it("gates every entry — Heat Up, Subsystems, parts and the unique move alike — when the Astir isn't piloted", () => {
		const sheet = new PlaybookActorSheet();
		const part = ASTIR_PART_CATALOG[0];
		const move = ASTIR_MOVE_CATALOG[0];
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: {
						id: "a1", core: "", approach: "", tier: 3, power: 4, parts: [part.key], move: move.key, piloted: false
					}
				}
			}
		};

		const group = sheet.getData().moveGroups.find((g) => g.label === "Astir Moves");

		expect(group.moves.every((m) => m.gated)).toBe(true);
	});

	it("leaves gating to each entry's own logic once piloted", () => {
		const sheet = new PlaybookActorSheet();
		const part = ASTIR_PART_CATALOG[0];
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, parts: [part.key], move: null, piloted: true }
				}
			}
		};

		const group = sheet.getData().moveGroups.find((g) => g.label === "Astir Moves");

		// Heat Up and Subsystems have no gating logic of their own (see moves.js) — with the Astir
		// piloted, the group's own mount gating no longer forces them either, so both come through
		// as false, same as the part.
		expect(group.moves.find((m) => m.key === "heat-up").gated).toBe(false);
		expect(group.moves.find((m) => m.key === "subsystems").gated).toBe(false);
		expect(group.moves.find((m) => m.key === part.key).gated).toBe(false);
	});
});

describe("PlaybookActorSheet#activateListeners - astir", () => {
	it("binds the Astir tab's controls to their handlers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		const bound = [
			[".astir-create", "click"],
			[".astir-delete", "click"],
			[".astir-core-select", "change"],
			[".astir-approach-select", "change"],
			[".astir-tier-step", "click"],
			[".astir-power-step", "click"],
			[".astir-weapon-power-step", "click"],
			[".astir-overheating-checkbox", "change"],
			[".astir-piloted-checkbox", "change"],
			[".astir-potion-use", "click"],
			[".astir-part-add", "click"],
			[".astir-part-remove", "click"],
			[".astir-move-add", "click"],
			[".astir-move-remove", "click"],
			[".astir-weapon-catalog-add", "click"]
		];
		for (const [selector] of bound) {
			expect(html.find).toHaveBeenCalledWith(selector);
		}
		expect(on).toHaveBeenCalledTimes(html.find.mock.calls.length);
	});
});

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

describe("PlaybookActorSheet#_onAstirPotionUse", () => {
	it("decrements the chosen color by 1", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", potions: { red: 2, blue: 0, yellow: 1 } } } },
			update: vi.fn()
		};

		sheet._onAstirPotionUse({ currentTarget: { dataset: { potion: "red" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.potions.red": 1 });
	});

	it("does nothing when that color is already at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", potions: { red: 0, blue: 0, yellow: 0 } } } },
			update: vi.fn()
		};

		sheet._onAstirPotionUse({ currentTarget: { dataset: { potion: "red" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing potions object as all zero", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirPotionUse({ currentTarget: { dataset: { potion: "red" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirPotionUse({ currentTarget: { dataset: { potion: "red" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirPartAdd", () => {
	it("adds the chosen part and re-clamps power to the new maximum", async () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 4, parts: [] } } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(partKey);

		await sheet._onAstirPartAdd();

		expect(chooseAstirPart).toHaveBeenCalledWith([]);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [partKey],
			"system.attributes.astir.power": astirMaxPower([partKey]),
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does not lower power below what it already is, only clamps if it now exceeds the max", async () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 0, parts: [] } } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(partKey);

		await sheet._onAstirPartAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [partKey],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when the dialog is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 4, parts: [] } } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(null);

		await sheet._onAstirPartAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats missing parts and power as empty/zero", async () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(partKey);

		await sheet._onAstirPartAdd();

		expect(chooseAstirPart).toHaveBeenCalledWith([]);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [partKey],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAstirPartAdd();

		expect(chooseAstirPart).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("accounts for existing Astir weapon Drain when re-clamping power", async () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		const weapon = { id: "w1", kind: "weapon", astir: true, tags: ["drain-2"] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [] }, equipment: [weapon] } },
			update: vi.fn()
		};
		chooseAstirPart.mockResolvedValue(partKey);

		await sheet._onAstirPartAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [partKey],
			"system.attributes.astir.power": astirMaxPower([partKey], [weapon]),
			"system.attributes.astir.weaponPower": 0
		});
	});
});

describe("PlaybookActorSheet#_onAstirPartRemove", () => {
	it("removes the matching part and re-clamps power to the new (higher) maximum", () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 0, parts: [partKey] } } }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: partKey } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when the key doesn't match any current part", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 4, parts: [] } } }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: "astir-part:not-there" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing parts array as having none", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 4 } } }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: "astir-part:placeholder-part" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing power value as 0 once the part is removed", () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [partKey] } } }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: partKey } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: "astir-part:placeholder-part" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("un-pilots with a warning when removing a Power-granting part leaves Power negative under existing Drain", () => {
		const sheet = new PlaybookActorSheet();
		const conduitKey = "astir-part:weapon-conduit";
		const weapons = [
			{ id: "w1", kind: "weapon", astir: true, tags: ["drain-3"] },
			{ id: "w2", kind: "weapon", astir: true, tags: ["drain-3"] }
		];
		sheet.actor = {
			system: {
				attributes: { astir: { id: "a1", power: 4, piloted: true, parts: [conduitKey] }, equipment: weapons }
			},
			update: vi.fn()
		};

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: conduitKey } } });

		// Removing Weapon Conduit drops the Weapon Power pool (2) that was absorbing part of the
		// 6 total Drain, so all of it now spills onto main Power: max = ASTIR_POWER_BASE (4) - 6.
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [],
			"system.attributes.astir.power": astirMaxPower([], weapons),
			"system.attributes.astir.weaponPower": 0,
			"system.attributes.astir.piloted": false
		});
		expect(astirMaxPower([], weapons)).toBeLessThan(0);
		expect(ui.notifications.warn).toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirMoveAdd", () => {
	it("sets the chosen move, passing the actor's playbookMoves and the current Astir move (if any) as already-selected", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { name: "The Scout" },
				attributes: {
					astir: { id: "a1", move: "cantrips:deny" },
					playbookMoves: ["the-scout:field-scout"]
				}
			},
			update: vi.fn()
		};
		chooseAstirMove.mockResolvedValue("astir:placeholder-move");

		await sheet._onAstirMoveAdd();

		// Both the actor's regular playbookMoves and the Astir's own current move end up in the
		// combined already-selected array — this is what closes the exclusiveGroup bypass (Field
		// Scout/Giant Slayer, Earthly Ally/Titanic) since both pickers draw from the same pool.
		expect(chooseAstirMove).toHaveBeenCalledWith("The Scout", ["the-scout:field-scout", "cantrips:deny"], undefined, undefined, []);
		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.move": "astir:placeholder-move" });
	});

	it("passes just the actor's playbookMoves when no Astir move is picked yet", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { name: "The Scout" },
				attributes: { astir: { id: "a1", move: null }, playbookMoves: ["the-scout:field-scout"] }
			},
			update: vi.fn()
		};
		chooseAstirMove.mockResolvedValue("cantrips:deny");

		await sheet._onAstirMoveAdd();

		expect(chooseAstirMove).toHaveBeenCalledWith("The Scout", ["the-scout:field-scout"], undefined, undefined, []);
	});

	it("passes an empty already-selected array when the actor has no playbookMoves and no Astir move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { astir: { id: "a1", move: null } } },
			update: vi.fn()
		};
		chooseAstirMove.mockResolvedValue("cantrips:deny");

		await sheet._onAstirMoveAdd();

		expect(chooseAstirMove).toHaveBeenCalledWith("The Scout", [], undefined, undefined, []);
	});

	it("does nothing when the dialog is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", move: null } } }, update: vi.fn() };
		chooseAstirMove.mockResolvedValue(null);

		await sheet._onAstirMoveAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAstirMoveAdd();

		expect(chooseAstirMove).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirMoveRemove", () => {
	it("clears the move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", move: "cantrips:deny" } } }, update: vi.fn() };

		sheet._onAstirMoveRemove();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.move": null });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirMoveRemove();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirWeaponAdd", () => {
	it("chains the catalog picker into configureEquipment with astirWeapon, then saves the result flagged astir: true", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		const template = { key: "placeholder-astir-weapon", name: "Placeholder Astir Weapon", description: "", tags: ["melee"] };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Lance", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onAstirWeaponAdd();

		expect(configureEquipment).toHaveBeenCalledWith(template, undefined, { astirWeapon: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], astir: true, name: "Lance", description: "", kind: "weapon", tags: ["melee"] }
			],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("lowers Power when the added weapon carries Drain, and un-pilots with a warning if it goes negative", async () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "e1", kind: "weapon", astir: true, tags: ["drain-3"] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 1, piloted: true, parts: [] }, equipment: [existing] } },
			update: vi.fn()
		};
		const template = { key: "placeholder-astir-weapon", name: "Placeholder Astir Weapon", description: "", tags: ["drain-2"] };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Lance", description: "", kind: "weapon", tags: ["drain-2"] });

		await sheet._onAstirWeaponAdd();

		// Total Drain (drain-3 existing + drain-2 new) is 5, with no Weapon Power pool to absorb any
		// of it: max Power = ASTIR_POWER_BASE (4) - 5 = -1.
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				existing,
				{ id: "test-id", spent: [], astir: true, name: "Lance", description: "", kind: "weapon", tags: ["drain-2"] }
			],
			"system.attributes.astir.power": -1,
			"system.attributes.astir.weaponPower": 0,
			"system.attributes.astir.piloted": false
		});
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it("carries familiar: true onto the saved entry when the picked template is a Familiar weapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		const template = { key: "wisp-familiar", name: "Wisp Familiar", description: "", tags: ["ranged"], familiar: true };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Wisp Familiar", description: "", kind: "weapon", tags: ["ranged"] });

		await sheet._onAstirWeaponAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "test-id",
					spent: [],
					astir: true,
					familiar: true,
					name: "Wisp Familiar",
					description: "",
					kind: "weapon",
					tags: ["ranged"]
				}
			],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does not set familiar on the saved entry when the picked template isn't a Familiar", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		const template = { key: "astir-fists", name: "Astir Fists", description: "", tags: ["melee"] };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Astir Fists", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onAstirWeaponAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], astir: true, name: "Astir Fists", description: "", kind: "weapon", tags: ["melee"] }
			],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when the catalog picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		chooseAstirWeapon.mockResolvedValue(null);

		await sheet._onAstirWeaponAdd();

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the editor is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		chooseAstirWeapon.mockResolvedValue({ key: "placeholder-astir-weapon", name: "x", description: "", tags: [] });
		configureEquipment.mockResolvedValue(null);

		await sheet._onAstirWeaponAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAstirWeaponAdd();

		expect(chooseAstirWeapon).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_grantPotions", () => {
	it("increments each color by 1", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", potions: { red: 1, blue: 0, yellow: 0 } } } },
			update: vi.fn()
		};

		await sheet._grantPotions();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.potions": { red: 2, blue: 1, yellow: 1 }
		});
	});

	it("treats a missing potions object as all zero", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		await sheet._grantPotions();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.potions": { red: 1, blue: 1, yellow: 1 }
		});
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._grantPotions();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_regainAstirPower", () => {
	it("adds the given amount, clamped to the parts-adjusted maximum", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 1, parts: [] } } }, update: vi.fn() };

		await sheet._regainAstirPower(1);

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.power": 2 });
	});

	it("does not exceed the maximum", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: ASTIR_POWER_BASE, parts: [] } } },
			update: vi.fn()
		};

		await sheet._regainAstirPower(1);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing power and parts array as 0 and none", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		await sheet._regainAstirPower(1);

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.power": 1 });
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._regainAstirPower(1);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_spendAstirParts", () => {
	it("marks each given part key Expended in one update", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		await sheet._spendAstirParts([WARDING.key, ARTIFACT.key]);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${WARDING.key}.expended`]: true,
			[`system.attributes.moveUses.${ARTIFACT.key}.expended`]: true
		});
	});

	it("writes nothing for an empty list", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		await sheet._spendAstirParts([]);

		expect(sheet.actor.update).toHaveBeenCalledWith({});
	});
});

// _grantingMoves (moves-mixin.js) is what lets an Astir Move (Legacy, Mana Devourer, Petrifier
// Core, Inertia Drive, Future Sight — see astir.js's ASTIR_MOVE_CATALOG) source the same
// grantsAdvantageOnMove/addsSuccessReminderToMove/addsFailureReminderToMove/
// addsCriticalReminderToMove/addsQuestionsToMove flags a picked playbook move already can, but only
// while the Astir specifically is the mounted frame — the same mounted-vs-installed distinction
// every other Astir Part effect already draws. Legacy's own pair of tests below exercises both
// branches of _grantingMoves itself; the rest just need one passing case each so their own call
// site isn't dead code.
describe("PlaybookActorSheet#_grantedAdvantageForMove - Legacy (Astir Move)", () => {
	it("grants advantage on Lead a Sortie when Legacy is picked and the Astir is mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", move: LEGACY.key, piloted: true, parts: [] } } }
		};

		expect(sheet._grantedAdvantageForMove(LEAD_A_SORTIE)).toBe("advantage");
	});

	it("grants nothing when the Astir is not the mounted frame", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", move: LEGACY.key, piloted: false, parts: [] } } }
		};

		expect(sheet._grantedAdvantageForMove(LEAD_A_SORTIE)).toBeNull();
	});

	it("grants nothing when an Ardent is mounted instead of the Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", move: LEGACY.key, piloted: false, parts: [] },
					ardents: [{ id: "ard1", name: "Ardent", piloted: true, parts: [] }]
				}
			}
		};

		expect(sheet._grantedAdvantageForMove(LEAD_A_SORTIE)).toBeNull();
	});

	it("grants nothing without Legacy picked, even while the Astir is mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", move: null, piloted: true, parts: [] } } }
		};

		expect(sheet._grantedAdvantageForMove(LEAD_A_SORTIE)).toBeNull();
	});
});

describe("PlaybookActorSheet#_grantedSuccessReminderForMove - Mana Devourer (Astir Move)", () => {
	it("returns Mana Devourer's reminder for Strike Decisively once picked and mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", move: MANA_DEVOURER.key, piloted: true, parts: [] } } }
		};

		expect(sheet._grantedSuccessReminderForMove(STRIKE_DECISIVELY)).toBe(
			"+1 Power (against another Astir, with physical harm)"
		);
	});
});

describe("PlaybookActorSheet#_grantedFailureReminderForMove - Petrifier Core (Astir Move)", () => {
	it("returns Petrifier Core's reminder for Exchange Blows once picked and mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", move: PETRIFIER_CORE.key, piloted: true, parts: [] } } }
		};

		expect(sheet._grantedFailureReminderForMove(EXCHANGE_BLOWS)).toBe(
			"If you took disadvantage, your opponent takes the risk (restrained)"
		);
	});
});

describe("PlaybookActorSheet#_grantedCriticalReminderForMove - Inertia Drive (Astir Move)", () => {
	it("returns Inertia Drive's reminder for Weather the Storm once picked and mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", move: INERTIA_DRIVE.key, piloted: true, parts: [] } } }
		};

		expect(sheet._grantedCriticalReminderForMove(WEATHER_THE_STORM)).toBe("Regain 1 Power");
	});
});

describe("PlaybookActorSheet#_grantedQuestionsForMove - Future Sight (Astir Move)", () => {
	it("returns Future Sight's questions for Read the Room once picked and mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", move: FUTURE_SIGHT.key, piloted: true, parts: [] } } }
		};

		expect(sheet._grantedQuestionsForMove(READ_THE_ROOM)).toEqual(FUTURE_SIGHT.addsQuestionsToMove.questions);
	});
});
