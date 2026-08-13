import { describe, expect, it, vi } from "vitest";

import { PLAYBOOKS } from "../scripts/actor-creation.js";
import {
	ASTIR_CORES,
	ASTIR_DEFAULT_IMG,
	ASTIR_MOVE_CATALOG,
	ASTIR_PART_CATALOG,
	ASTIR_POWER_BASE,
	ASTIR_TIER_MAX,
	ASTIR_TIER_MIN,
	astirMaxPower,
	astirMaxWeaponPower
} from "../scripts/frames/astir.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { ALCHEMICAL_SUITE, WEAPON_CONDUIT } from "./helpers/move-fixtures.js";

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
			{ key: part.key, name: part.name, powerCost: part.powerCost, partType: part.partType, tier: 3, disabled: false }
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

	it("gates a disabled part's own move row even while the Astir is piloted", () => {
		const sheet = new PlaybookActorSheet();
		const part = ASTIR_PART_CATALOG[0];
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, parts: [part.key], move: null, piloted: true },
					moveUses: { [part.key]: { disabled: true } }
				}
			}
		};

		const group = sheet.getData().moveGroups.find((g) => g.label === "Astir Moves");

		expect(group.moves.find((m) => m.key === part.key).gated).toBe(true);
		// Heat Up/Subsystems aren't Parts, so a disabled Part never touches their own gating.
		expect(group.moves.find((m) => m.key === "heat-up").gated).toBe(false);
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
