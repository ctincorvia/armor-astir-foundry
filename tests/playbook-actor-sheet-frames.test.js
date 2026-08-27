import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the Mount Up picker dialog is mocked — ardentParts/ardentWeapons/buildArdent/
// ardentLoadoutCount and the constants stay real.
vi.mock("../scripts/frames/ardent.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseFrame: vi.fn()
}));

// findCarrierActors defaults to no Carriers in the world, matching every other move-roll test
// file's own convention (see playbook-actor-sheet-move-rolls.test.js) — Crew Support's own
// _onRefreshSortie tests below override this per-test.
vi.mock("../scripts/world-actors/carrier-actor-sheet.js", async (importOriginal) => ({
	...(await importOriginal()),
	findCarrierActors: vi.fn(() => [])
}));

import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { ASTIR_PART_CATALOG, astirMaxPower } from "../scripts/frames/astir.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { chooseFrame, ARDENT_FEATURE_PARTS } from "../scripts/frames/ardent.js";
import { findCarrierActors } from "../scripts/world-actors/carrier-actor-sheet.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { WEAPON_CONDUIT } from "./helpers/move-fixtures.js";

const ALCHEMICAL_SUITE = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:alchemical-suite");
const DIVINATION_CODEX = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:divination-codex");
const SEEK_ALLIES = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:seek-allies");
const TACTICAL_GENIUS = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-captain:tactical-genius");
const FORCE_MULTIPLIER = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-captain:force-multiplier");
const LET_LOOSE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:let-loose");
// ARDENT_FEATURE_PARTS' Chromatic Reserves is folded into ALL_MOVES (all-moves.js), so every
// _onRefreshSortie assertion below sees its resetTo: "max" numericTracker reset from its
// "nothing stored" default (0, per frames-mixin.js's own current fallback) up to its max (3) —
// alongside Tactical Genius's own unrelated Sortie-scoped tracker.
const CHROMATIC_RESERVES = ARDENT_FEATURE_PARTS.find((p) => p.key === "ardent-feature:chromatic-reserves");

beforeEach(() => {
	chooseFrame.mockClear();
	ui.notifications.warn.mockClear();
	findCarrierActors.mockClear();
	findCarrierActors.mockReturnValue([]);
});

describe("PlaybookActorSheet#_onAstirPilotedToggle", () => {
	it("writes the checkbox's checked state", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirPilotedToggle({ currentTarget: { checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.piloted": true });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirPilotedToggle({ currentTarget: { checked: true } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("blocks checking the box while Power is negative, reverting it and warning instead of updating", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: -1 } } }, update: vi.fn() };
		const event = { currentTarget: { checked: true } };

		sheet._onAstirPilotedToggle(event);

		expect(event.currentTarget.checked).toBe(false);
		expect(ui.notifications.warn).toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("still allows unchecking the box while Power is negative", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: -1, piloted: true } } }, update: vi.fn() };

		sheet._onAstirPilotedToggle({ currentTarget: { checked: false } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.piloted": false });
	});
});

describe("PlaybookActorSheet#_isPartDisabled", () => {
	it("is false when moveUses has no entry for the key at all", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._isPartDisabled(ALCHEMICAL_SUITE.key)).toBe(false);
	});

	it("is false when the key's own moveUses entry has no disabled flag", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveUses: { [ALCHEMICAL_SUITE.key]: { expended: true } } } } };

		expect(sheet._isPartDisabled(ALCHEMICAL_SUITE.key)).toBe(false);
	});

	it("is true once moveUses.<key>.disabled is set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveUses: { [ALCHEMICAL_SUITE.key]: { disabled: true } } } } };

		expect(sheet._isPartDisabled(ALCHEMICAL_SUITE.key)).toBe(true);
	});
});

describe("PlaybookActorSheet#_mountedParts", () => {
	it("excludes a disabled part from the mounted frame's resolved parts", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", piloted: true, parts: [ALCHEMICAL_SUITE.key, DIVINATION_CODEX.key] },
					moveUses: { [ALCHEMICAL_SUITE.key]: { disabled: true } }
				}
			}
		};

		expect(sheet._mountedParts().map((p) => p.key)).toEqual([DIVINATION_CODEX.key]);
	});

	it("keeps every installed part when none are disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", piloted: true, parts: [ALCHEMICAL_SUITE.key] } } }
		};

		expect(sheet._mountedParts().map((p) => p.key)).toEqual([ALCHEMICAL_SUITE.key]);
	});

	it("folds in an Extra Part's effects while the Astir is mounted, alongside its regular parts", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", piloted: true, parts: [ALCHEMICAL_SUITE.key], extraParts: [DIVINATION_CODEX.key] }
				}
			}
		};

		expect(sheet._mountedParts().map((p) => p.key)).toEqual([ALCHEMICAL_SUITE.key, DIVINATION_CODEX.key]);
	});

	it("folds in an Extra Part's effects while an Ardent is mounted, alongside its regular parts", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", piloted: true, parts: [DIVINATION_CODEX.key], extraParts: [ALCHEMICAL_SUITE.key] }]
				}
			}
		};

		expect(sheet._mountedParts().map((p) => p.key)).toEqual([DIVINATION_CODEX.key, ALCHEMICAL_SUITE.key]);
	});

	it("excludes a disabled Extra Part the same way it excludes a disabled regular one", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", piloted: true, parts: [], extraParts: [ALCHEMICAL_SUITE.key] },
					moveUses: { [ALCHEMICAL_SUITE.key]: { disabled: true } }
				}
			}
		};

		expect(sheet._mountedParts()).toEqual([]);
	});
});

describe("PlaybookActorSheet#_onPartDisabledToggle", () => {
	it("writes moveUses.<key>.disabled true when checked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onPartDisabledToggle({ currentTarget: { dataset: { part: ALCHEMICAL_SUITE.key }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${ALCHEMICAL_SUITE.key}.disabled`]: true
		});
	});

	it("writes moveUses.<key>.disabled false when unchecked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveUses: { [ALCHEMICAL_SUITE.key]: { disabled: true } } } },
			update: vi.fn()
		};

		sheet._onPartDisabledToggle({ currentTarget: { dataset: { part: ALCHEMICAL_SUITE.key }, checked: false } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${ALCHEMICAL_SUITE.key}.disabled`]: false
		});
	});
});

describe("PlaybookActorSheet#activateListeners - part disabled checkbox", () => {
	it("binds a change handler to the part-disabled checkbox", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".part-disabled-checkbox");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#getData - controls with Ardents", () => {
	it("enables Mount Up with an unpiloted Ardent and no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", piloted: false }] } } };

		expect(sheet.getData().controls).toEqual({ mountUpDisabled: false, dismountDisabled: true });
	});

	it("disables Mount Up and enables Dismount once an Ardent is piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", piloted: true }] } } };

		expect(sheet.getData().controls).toEqual({ mountUpDisabled: true, dismountDisabled: false });
	});
});

describe("PlaybookActorSheet#_onArdentPilotedToggle", () => {
	it("mounts this Ardent and dismounts the Astir/any other Ardent", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", piloted: true },
					ardents: [{ id: "ar1", piloted: false }, { id: "ar2", piloted: false }]
				}
			},
			update: vi.fn()
		};

		sheet._onArdentPilotedToggle({ currentTarget: { dataset: { ardentId: "ar1" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.piloted": false,
			"system.attributes.ardents": [{ id: "ar1", piloted: true }, { id: "ar2", piloted: false }]
		});
	});

	it("dismounts when unchecked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", piloted: true }] } }, update: vi.fn() };

		sheet._onArdentPilotedToggle({ currentTarget: { dataset: { ardentId: "ar1" }, checked: false } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.ardents": [{ id: "ar1", piloted: false }] });
	});

	it("does nothing for an unknown Ardent id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentPilotedToggle({ currentTarget: { dataset: { ardentId: "nope" }, checked: true } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onMountUp - multiple frames", () => {
	it("prompts chooseFrame with every unmounted frame and mounts the chosen one", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", piloted: false },
					ardents: [{ id: "ar1", name: "Warhound", piloted: false }]
				}
			},
			update: vi.fn()
		};
		chooseFrame.mockResolvedValue({ kind: "ardent", id: "ar1" });

		await sheet._onMountUp();

		expect(chooseFrame).toHaveBeenCalledWith([
			expect.objectContaining({ kind: "astir", id: "astir" }),
			expect.objectContaining({ kind: "ardent", id: "ar1", name: "Warhound" })
		]);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.piloted": false,
			"system.attributes.ardents": [{ id: "ar1", name: "Warhound", piloted: true }]
		});
	});

	it("does nothing when the picker is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", piloted: false }, ardents: [{ id: "ar1", piloted: false }] } },
			update: vi.fn()
		};
		chooseFrame.mockResolvedValue(null);

		await sheet._onMountUp();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("mounts an Ardent directly with no prompt when it's the only frame", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", piloted: false }] } }, update: vi.fn() };

		await sheet._onMountUp();

		expect(chooseFrame).not.toHaveBeenCalled();
		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.ardents": [{ id: "ar1", piloted: true }] });
	});
});

describe("PlaybookActorSheet#_onDismount - with Ardents", () => {
	it("clears whichever Ardent is mounted, leaving the rest untouched", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { ardents: [{ id: "ar1", piloted: true }, { id: "ar2", piloted: false }] } },
			update: vi.fn()
		};

		sheet._onDismount();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", piloted: false }, { id: "ar2", piloted: false }]
		});
	});
});

describe("PlaybookActorSheet#getData - controls", () => {
	it("disables both buttons when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.controls).toEqual({ mountUpDisabled: true, dismountDisabled: true });
	});

	it("enables Mount Up and disables Dismount for an unpiloted Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: false } } } };

		const data = sheet.getData();

		expect(data.controls).toEqual({ mountUpDisabled: false, dismountDisabled: true });
	});

	it("disables Mount Up and enables Dismount for a piloted Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: true } } } };

		const data = sheet.getData();

		expect(data.controls).toEqual({ mountUpDisabled: true, dismountDisabled: false });
	});
});

describe("PlaybookActorSheet#activateListeners - controls", () => {
	it("binds click handlers to the Mount Up, Dismount, Refresh Scene, and Refresh Sortie buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".controls-mount-up");
		expect(html.find).toHaveBeenCalledWith(".controls-dismount");
		expect(html.find).toHaveBeenCalledWith(".controls-refresh-scene");
		expect(html.find).toHaveBeenCalledWith(".controls-refresh-sortie");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onMountUp", () => {
	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onMountUp();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when already piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: true } } }, update: vi.fn() };

		sheet._onMountUp();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("sets piloted to true", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: false } } }, update: vi.fn() };

		sheet._onMountUp();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.piloted": true });
	});

	it("warns and does not update when Power is negative", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", piloted: false, power: -1 } } },
			update: vi.fn()
		};

		sheet._onMountUp();

		expect(ui.notifications.warn).toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onDismount", () => {
	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onDismount();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when already not piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: false } } }, update: vi.fn() };

		sheet._onDismount();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("sets piloted to false", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: true } } }, update: vi.fn() };

		sheet._onDismount();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.piloted": false });
	});
});

describe("PlaybookActorSheet#_onRefreshScene", () => {
	it("clears every Scene-scoped spend/forcesEffect/reroll tag but leaves Sortie-scoped and unscoped ones", () => {
		const sheet = new PlaybookActorSheet();
		const entry = {
			id: "1",
			kind: "weapon",
			name: "Halberd",
			description: "",
			// blitz: spend.period Scene; unreliable: forcesEffect.period Scene; decisive: reroll.period
			// Scene; cursed: no spend/forcesEffect/reroll at all; dangerous: spend.period Sortie.
			tags: ["blitz", "unreliable", "decisive", "cursed", "dangerous"],
			spent: ["blitz", "unreliable", "decisive", "cursed", "dangerous"],
			scale: "foot",
			tier: 1
		};
		sheet.actor = {
			system: { attributes: { equipment: [entry] }, resources: { hold: { value: 2 } } },
			update: vi.fn()
		};

		sheet._onRefreshScene();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["cursed", "dangerous"] }],
			"system.attributes.moveHold.astir:lev-spells.value": 0,
			"system.attributes.moveHold.the-arcanist:reshape.value": 0,
			"system.attributes.moveHold.the-scout:mobility.value": 0,
			"system.resources.hold.value": 0,
			"system.attributes.eidolonDrive": { summonedAllyId: null, bonusUsed: false }
		});
	});

	it("clears both of Versatile's independent compound-key spends on Refresh Scene", () => {
		const sheet = new PlaybookActorSheet();
		const entry = {
			id: "1",
			kind: "weapon",
			name: "Rifle",
			description: "",
			tags: ["versatile"],
			// Compound spend keys (see equipment.js#rerollSpendKey) — Refresh Scene has to strip each
			// back to the plain "versatile" catalog key (baseEquipmentTagKey) to resolve its period.
			spent: ["versatile:exchange-blows", "versatile:strike-decisively"],
			scale: "foot",
			tier: 1
		};
		sheet.actor = {
			system: { attributes: { equipment: [entry] }, resources: { hold: { value: 0 } } },
			update: vi.fn()
		};

		sheet._onRefreshScene();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: [] }],
			"system.attributes.moveHold.astir:lev-spells.value": 0,
			"system.attributes.moveHold.the-arcanist:reshape.value": 0,
			"system.attributes.moveHold.the-scout:mobility.value": 0,
			"system.resources.hold.value": 0,
			"system.attributes.eidolonDrive": { summonedAllyId: null, bonusUsed: false }
		});
	});

	it("clears Versatile's spend even when only one of its two compound keys is present", () => {
		const sheet = new PlaybookActorSheet();
		// Only one of Versatile's two moves has been rerolled — confirms baseEquipmentTagKey resolves
		// a lone compound key back to the "versatile" tag just as well as when both are present.
		const entry = {
			id: "1", kind: "weapon", name: "Rifle", description: "", tags: ["versatile"],
			spent: ["versatile:exchange-blows"], scale: "foot", tier: 1
		};
		sheet.actor = {
			system: { attributes: { equipment: [entry] }, resources: { hold: { value: 0 } } },
			update: vi.fn()
		};

		sheet._onRefreshScene();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: [] }],
			"system.attributes.moveHold.astir:lev-spells.value": 0,
			"system.attributes.moveHold.the-arcanist:reshape.value": 0,
			"system.attributes.moveHold.the-scout:mobility.value": 0,
			"system.resources.hold.value": 0,
			"system.attributes.eidolonDrive": { summonedAllyId: null, bonusUsed: false }
		});
	});

	it("leaves the equipment array untouched when nothing matches the Scene period", () => {
		const sheet = new PlaybookActorSheet();
		const untouched = {
			id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["dangerous"], spent: ["dangerous"]
		};
		const noSpends = { id: "2", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		const neverSpent = { id: "3", kind: "gear", name: "Kit", description: "", tags: ["ward"] };
		sheet.actor = {
			system: {
				attributes: { equipment: [untouched, noSpends, neverSpent] },
				resources: { hold: { value: 0 } }
			},
			update: vi.fn()
		};

		sheet._onRefreshScene();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.astir:lev-spells.value": 0,
			"system.attributes.moveHold.the-arcanist:reshape.value": 0,
			"system.attributes.moveHold.the-scout:mobility.value": 0,
			"system.resources.hold.value": 0,
			"system.attributes.eidolonDrive": { summonedAllyId: null, bonusUsed: false }
		});
	});

	it("does not touch Sortie-scoped moveUses flags", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { moveUses: { [SEEK_ALLIES.key]: { sortie: true } } },
				resources: { hold: { value: 0 } }
			},
			update: vi.fn()
		};

		sheet._onRefreshScene();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.astir:lev-spells.value": 0,
			"system.attributes.moveHold.the-arcanist:reshape.value": 0,
			"system.attributes.moveHold.the-scout:mobility.value": 0,
			"system.resources.hold.value": 0,
			"system.attributes.eidolonDrive": { summonedAllyId: null, bonusUsed: false }
		});
	});

	it("resets the shared hold value to 0 even with nothing else to clear", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {}, resources: { hold: { value: 3 } } }, update: vi.fn() };

		sheet._onRefreshScene();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.astir:lev-spells.value": 0,
			"system.attributes.moveHold.the-arcanist:reshape.value": 0,
			"system.attributes.moveHold.the-scout:mobility.value": 0,
			"system.resources.hold.value": 0,
			"system.attributes.eidolonDrive": { summonedAllyId: null, bonusUsed: false }
		});
	});

	it("clears a live separateHold pool (Mobility) alongside the shared hold value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { moveHold: { "the-scout:mobility": { value: 3 } } },
				resources: { hold: { value: 0 } }
			},
			update: vi.fn()
		};

		sheet._onRefreshScene();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.astir:lev-spells.value": 0,
			"system.attributes.moveHold.the-arcanist:reshape.value": 0,
			"system.attributes.moveHold.the-scout:mobility.value": 0,
			"system.resources.hold.value": 0,
			"system.attributes.eidolonDrive": { summonedAllyId: null, bonusUsed: false }
		});
	});

	it("clears Eidolon Drive's active summon — the real rules boundary for it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { eidolonDrive: { summonedAllyId: "a1", bonusUsed: true } },
				resources: { hold: { value: 0 } }
			},
			update: vi.fn()
		};

		sheet._onRefreshScene();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.astir:lev-spells.value": 0,
			"system.attributes.moveHold.the-arcanist:reshape.value": 0,
			"system.attributes.moveHold.the-scout:mobility.value": 0,
			"system.resources.hold.value": 0,
			"system.attributes.eidolonDrive": { summonedAllyId: null, bonusUsed: false }
		});
	});

	it("does not touch a Sortie-scoped numericTracker (Tactical Genius) or an unscoped one (Force Multiplier)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					moveTrackers: {
						[TACTICAL_GENIUS.key]: { hold: 4 },
						[FORCE_MULTIPLIER.key]: { confidence: 2 }
					}
				},
				resources: { hold: { value: 0 } }
			},
			update: vi.fn()
		};

		sheet._onRefreshScene();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.astir:lev-spells.value": 0,
			"system.attributes.moveHold.the-arcanist:reshape.value": 0,
			"system.attributes.moveHold.the-scout:mobility.value": 0,
			"system.resources.hold.value": 0,
			"system.attributes.eidolonDrive": { summonedAllyId: null, bonusUsed: false }
		});
	});

	// Enduring Support's own effect lasts "for the rest of the Sortie" (see moves-mixin.js's
	// _onMoveActivate), a longer boundary than the summon itself — see _onRefreshSortie for the real
	// clear point, below.
	it("does not touch Enduring Support's active Approach override", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { approachOverride: { approach: "profane" } },
				resources: { hold: { value: 0 } }
			},
			update: vi.fn()
		};

		sheet._onRefreshScene();

		expect(sheet.actor.update).not.toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.approachOverride": expect.anything() })
		);
	});

	// Chromatic Focus/Chromatic Reserves' own override (astir-parts.js/ardent.js's
	// promptsApproachOverride) is scoped to a single Scene, unlike Enduring Support's Sortie-scoped
	// one immediately above — this is its real (and only) clear point.
	it("clears a Scene-scoped Approach override (Chromatic Focus/Chromatic Reserves)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { approachOverride: { approach: "profane", period: "Scene" } },
				resources: { hold: { value: 0 } }
			},
			update: vi.fn()
		};

		sheet._onRefreshScene();

		expect(sheet.actor.update).toHaveBeenCalledWith(expect.objectContaining({
			"system.attributes.approachOverride": null
		}));
	});
});

describe("PlaybookActorSheet#_onRefreshSortie", () => {
	it("clears Sortie-scoped spent equipment tags but leaves Scene-scoped ones", () => {
		const sheet = new PlaybookActorSheet();
		const entry = {
			id: "1",
			kind: "weapon",
			name: "Halberd",
			description: "",
			tags: ["blitz", "dangerous"],
			spent: ["blitz", "dangerous"],
			scale: "foot",
			tier: 1
		};
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }],
			"system.attributes.moveHold.b-plot.value": 0,
			"system.attributes.moveHold.the-scout:improvisation.value": 0,
			"system.attributes.moveHold.soldier:get-out-of-my-way.value": 0,
			"system.attributes.moveHold.soldier:once-the-wars-over.value": 0,
			"system.attributes.bonusDowntimeTokens.astir-part:standardised-parts.value": 1,
			"system.attributes.bonusDowntimeTokens.the-attendant:master-servant.value": 1,
			"system.attributes.bonusDowntimeTokens.the-captain:information-network.value": 1,
			"system.attributes.bonusDowntimeTokens.the-summoner:helping-hands.value": 1,
			"system.attributes.eidolonDrive": { summonedAllyId: null, bonusUsed: false },
			"system.attributes.approachOverride": null,
			"system.attributes.arcanist.rituals": [],
			"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-1": false,
			"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-2": false,
			"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-3": false,
			"system.attributes.downtimeTokens.value": 2,
			[`system.attributes.moveTrackers.${CHROMATIC_RESERVES.key}.uses`]: 3,
			[`system.attributes.moveTrackers.${TACTICAL_GENIUS.key}.hold`]: 1
		});
	});

	it("clears an Astir Active part's Expended flag", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveUses: { [DIVINATION_CODEX.key]: { expended: true } } } },
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${DIVINATION_CODEX.key}.expended`]: false,
			"system.attributes.moveHold.b-plot.value": 0,
			"system.attributes.moveHold.the-scout:improvisation.value": 0,
			"system.attributes.moveHold.soldier:get-out-of-my-way.value": 0,
			"system.attributes.moveHold.soldier:once-the-wars-over.value": 0,
			"system.attributes.bonusDowntimeTokens.astir-part:standardised-parts.value": 1,
			"system.attributes.bonusDowntimeTokens.the-attendant:master-servant.value": 1,
			"system.attributes.bonusDowntimeTokens.the-captain:information-network.value": 1,
			"system.attributes.bonusDowntimeTokens.the-summoner:helping-hands.value": 1,
			"system.attributes.eidolonDrive": { summonedAllyId: null, bonusUsed: false },
			"system.attributes.approachOverride": null,
			"system.attributes.arcanist.rituals": [],
			"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-1": false,
			"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-2": false,
			"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-3": false,
			"system.attributes.downtimeTokens.value": 2,
			[`system.attributes.moveTrackers.${CHROMATIC_RESERVES.key}.uses`]: 3,
			[`system.attributes.moveTrackers.${TACTICAL_GENIUS.key}.hold`]: 1
		});
	});

	it("grants 1 of each Astir Potion (marks every color available) when Alchemical Suite is installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", parts: [ALCHEMICAL_SUITE.key], potions: { red: true, blue: false, yellow: true } }
				}
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.potions": { red: false, blue: false, yellow: false },
			"system.attributes.moveHold.b-plot.value": 0,
			"system.attributes.moveHold.the-scout:improvisation.value": 0,
			"system.attributes.moveHold.soldier:get-out-of-my-way.value": 0,
			"system.attributes.moveHold.soldier:once-the-wars-over.value": 0,
			"system.attributes.bonusDowntimeTokens.astir-part:standardised-parts.value": 1,
			"system.attributes.bonusDowntimeTokens.the-attendant:master-servant.value": 1,
			"system.attributes.bonusDowntimeTokens.the-captain:information-network.value": 1,
			"system.attributes.bonusDowntimeTokens.the-summoner:helping-hands.value": 1,
			"system.attributes.eidolonDrive": { summonedAllyId: null, bonusUsed: false },
			"system.attributes.approachOverride": null,
			"system.attributes.arcanist.rituals": [],
			"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-1": false,
			"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-2": false,
			"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-3": false,
			"system.attributes.downtimeTokens.value": 2,
			[`system.attributes.moveTrackers.${CHROMATIC_RESERVES.key}.uses`]: 3,
			[`system.attributes.moveTrackers.${TACTICAL_GENIUS.key}.hold`]: 1,
			// The end-of-method Power reclamp against the regular-only loadout (no Extra Parts stored
			// here) — Alchemical Suite's own -2 Power cost, already reflected before this refresh.
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does not add a potions field when Alchemical Suite is not installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [] } } }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(sheet.actor.update).not.toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.astir.potions": expect.anything() })
		);
	});

	it("resets the three flat hold pools to 0 even with nothing else to clear", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.b-plot.value": 0,
			"system.attributes.moveHold.the-scout:improvisation.value": 0,
			"system.attributes.moveHold.soldier:get-out-of-my-way.value": 0,
			"system.attributes.moveHold.soldier:once-the-wars-over.value": 0,
			"system.attributes.bonusDowntimeTokens.astir-part:standardised-parts.value": 1,
			"system.attributes.bonusDowntimeTokens.the-attendant:master-servant.value": 1,
			"system.attributes.bonusDowntimeTokens.the-captain:information-network.value": 1,
			"system.attributes.bonusDowntimeTokens.the-summoner:helping-hands.value": 1,
			"system.attributes.eidolonDrive": { summonedAllyId: null, bonusUsed: false },
			"system.attributes.approachOverride": null,
			"system.attributes.arcanist.rituals": [],
			"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-1": false,
			"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-2": false,
			"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-3": false,
			"system.attributes.downtimeTokens.value": 2,
			[`system.attributes.moveTrackers.${CHROMATIC_RESERVES.key}.uses`]: 3,
			[`system.attributes.moveTrackers.${TACTICAL_GENIUS.key}.hold`]: 1
		});
	});

	it("sets Tactical Genius's Sortie-scoped hold numericTracker to 1+KNOW (with no stats/bonuses, floors at 1) but leaves Force Multiplier's unscoped one", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					moveTrackers: {
						[TACTICAL_GENIUS.key]: { hold: 4 },
						[FORCE_MULTIPLIER.key]: { confidence: 2 }
					}
				}
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveTrackers.${TACTICAL_GENIUS.key}.hold`]: 1,
			"system.attributes.moveHold.b-plot.value": 0,
			"system.attributes.moveHold.the-scout:improvisation.value": 0,
			"system.attributes.moveHold.soldier:get-out-of-my-way.value": 0,
			"system.attributes.moveHold.soldier:once-the-wars-over.value": 0,
			"system.attributes.bonusDowntimeTokens.astir-part:standardised-parts.value": 1,
			"system.attributes.bonusDowntimeTokens.the-attendant:master-servant.value": 1,
			"system.attributes.bonusDowntimeTokens.the-captain:information-network.value": 1,
			"system.attributes.bonusDowntimeTokens.the-summoner:helping-hands.value": 1,
			"system.attributes.eidolonDrive": { summonedAllyId: null, bonusUsed: false },
			"system.attributes.approachOverride": null,
			"system.attributes.arcanist.rituals": [],
			"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-1": false,
			"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-2": false,
			"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-3": false,
			"system.attributes.downtimeTokens.value": 2,
			[`system.attributes.moveTrackers.${CHROMATIC_RESERVES.key}.uses`]: 3
		});
	});

	it("sets Tactical Genius's tracker to 1+KNOW for a mid-range KNOW value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { moveTrackers: { [TACTICAL_GENIUS.key]: { hold: 0 } } },
				stats: { know: { value: 2 } }
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ [`system.attributes.moveTrackers.${TACTICAL_GENIUS.key}.hold`]: 3 })
		);
	});

	it("clamps Tactical Genius's tracker to its max even with a very high KNOW", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { moveTrackers: { [TACTICAL_GENIUS.key]: { hold: 0 } } },
				stats: { know: { value: 10 } }
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ [`system.attributes.moveTrackers.${TACTICAL_GENIUS.key}.hold`]: 6 })
		);
	});

	it("floors Tactical Genius's tracker at its min with a very negative KNOW", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { moveTrackers: { [TACTICAL_GENIUS.key]: { hold: 0 } } },
				stats: { know: { value: -5 } }
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ [`system.attributes.moveTrackers.${TACTICAL_GENIUS.key}.hold`]: 0 })
		);
	});

	it("adds no bonus from Let Loose into Tactical Genius's computed hold value — its increase is manual, not a traitBonus", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					moveTrackers: { [TACTICAL_GENIUS.key]: { hold: 0 } },
					playbookMoves: [TACTICAL_GENIUS.key, LET_LOOSE.key],
					burdens: [{ id: "b1", label: "A burden" }]
				},
				stats: { know: { value: 1 } }
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		// 1 (base KNOW) + 0 (Let Loose contributes no traitBonus) = 1, so 1+KNOW = 2.
		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ [`system.attributes.moveTrackers.${TACTICAL_GENIUS.key}.hold`]: 2 })
		);
	});

	// Chromatic Reserves (ardent.js's ARDENT_FEATURE_PARTS) is the one real numericTrackers entry
	// that opts into `resetTo: "max"` — a pool that starts full and depletes, rather than the usual
	// starts-empty-and-fills pattern. Contrasted here against Tactical Genius's own plain min-reset
	// (0, before its own KNOW-computed override further above ever runs) in the same actor update,
	// confirming _refreshPeriod's `resetTo === "max" ? tracker.max : tracker.min` picks the right
	// side of that branch for each.
	it("resets Chromatic Reserves' partially-spent tracker up to its max (3), unlike a plain min-reset tracker", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					moveTrackers: {
						[CHROMATIC_RESERVES.key]: { uses: 1 },
						[TACTICAL_GENIUS.key]: { hold: 4 }
					}
				}
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({
				[`system.attributes.moveTrackers.${CHROMATIC_RESERVES.key}.uses`]: 3,
				[`system.attributes.moveTrackers.${TACTICAL_GENIUS.key}.hold`]: 1
			})
		);
	});

	// Crew Support (see special-moves.js) takes its own hold from the world's Carrier's live CREW,
	// the same "computed, not just cleared" treatment Tactical Genius's own KNOW-sourced hold gets
	// immediately above -- but the pool itself now lives on the Carrier, not this actor, so
	// Refresh Sortie writes it via a standalone carrier.update call (see frames-mixin.js's
	// _onRefreshSortie) rather than folding it into sheet.actor.update's own patch.
	it("sets Crew Support's shared hold on the Carrier to its own live CREW value", () => {
		const carrier = { id: "carrier1", system: { stats: { crew: { value: 2 } }, attributes: {} }, update: vi.fn() };
		findCarrierActors.mockReturnValue([carrier]);
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(carrier.update).toHaveBeenCalledWith({ "system.attributes.crewSupportHold": 2 });
	});

	it("does not touch the Carrier or the actor's own crew-support tracker with no Carrier in the world", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(sheet.actor.update).not.toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.moveTrackers.crew-support.hold": expect.anything() })
		);
	});

	it("does not touch either Carrier with more than one Carrier in the world (ambiguous, per _crewFixedTraitValue)", () => {
		const carrierA = { id: "carrier1", system: { stats: { crew: { value: 2 } }, attributes: {} }, update: vi.fn() };
		const carrierB = { id: "carrier2", system: { stats: { crew: { value: 1 } }, attributes: {} }, update: vi.fn() };
		findCarrierActors.mockReturnValue([carrierA, carrierB]);
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(carrierA.update).not.toHaveBeenCalled();
		expect(carrierB.update).not.toHaveBeenCalled();
	});

	it("clamps the Carrier's shared hold to its max (3) even with a very high Carrier CREW", () => {
		const carrier = { id: "carrier1", system: { stats: { crew: { value: 10 } }, attributes: {} }, update: vi.fn() };
		findCarrierActors.mockReturnValue([carrier]);
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(carrier.update).toHaveBeenCalledWith({ "system.attributes.crewSupportHold": 3 });
	});

	it("floors the Carrier's shared hold at its min (0) with a negative Carrier CREW", () => {
		const carrier = { id: "carrier1", system: { stats: { crew: { value: -3 } }, attributes: { crewSupportHold: 2 } }, update: vi.fn() };
		findCarrierActors.mockReturnValue([carrier]);
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(carrier.update).toHaveBeenCalledWith({ "system.attributes.crewSupportHold": 0 });
	});

	it("does not re-write the Carrier's shared hold when the computed value is already current", () => {
		const carrier = { id: "carrier1", system: { stats: { crew: { value: 2 } }, attributes: { crewSupportHold: 2 } }, update: vi.fn() };
		findCarrierActors.mockReturnValue([carrier]);
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(carrier.update).not.toHaveBeenCalled();
	});

	it("resets a below-max Bonus Downtime Tokens pool (Master & Servant) back to its own max", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { bonusDowntimeTokens: { "the-attendant:master-servant": { value: 0 } } } },
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.bonusDowntimeTokens.the-attendant:master-servant.value": 1 })
		);
	});

	it("resets a below-max part-sourced Bonus Downtime Tokens pool (Standardised Parts) back to its own max", () => {
		const STANDARDISED_PARTS = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:standardised-parts");
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", parts: [STANDARDISED_PARTS.key] },
					bonusDowntimeTokens: { [STANDARDISED_PARTS.key]: { value: 0 } }
				}
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ [`system.attributes.bonusDowntimeTokens.${STANDARDISED_PARTS.key}.value`]: 1 })
		);
	});

	it("resets a below-max equipment-sourced Bonus Downtime Tokens pool back to its own max", () => {
		const sheet = new PlaybookActorSheet();
		const item = {
			id: "eq1",
			kind: "gear",
			name: "Artificers",
			bonusDowntimeTokens: { max: 1, description: "" },
			bonusDowntimeTokensValue: 0
		};
		sheet.actor = { system: { attributes: { equipment: [item] } }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.equipment": [{ ...item, bonusDowntimeTokensValue: 1 }] })
		);
	});

	it("leaves an equipment array untouched when its only Bonus Downtime Tokens entry is already at max", () => {
		const sheet = new PlaybookActorSheet();
		const item = {
			id: "eq1",
			kind: "gear",
			name: "Artificers",
			bonusDowntimeTokens: { max: 1, description: "" },
			bonusDowntimeTokensValue: 1
		};
		sheet.actor = { system: { attributes: { equipment: [item] } }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(sheet.actor.update).not.toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.equipment": expect.anything() })
		);
	});

	it("leaves an equipment array untouched when a Bonus Downtime Tokens entry has never had a value stepped (already at its default max)", () => {
		const sheet = new PlaybookActorSheet();
		const item = { id: "eq1", kind: "gear", name: "Artificers", bonusDowntimeTokens: { max: 1, description: "" } };
		sheet.actor = { system: { attributes: { equipment: [item] } }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(sheet.actor.update).not.toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.equipment": expect.anything() })
		);
	});

	it("composes the equipment-array rewrite for a Bonus Downtime Tokens reset with the one for clearing an unrelated spent Sortie-scoped tag on a different entry", () => {
		const sheet = new PlaybookActorSheet();
		const spentEntry = {
			id: "1",
			kind: "weapon",
			name: "Halberd",
			description: "",
			tags: ["dangerous"],
			spent: ["dangerous"],
			scale: "foot",
			tier: 1
		};
		const bonusEntry = {
			id: "2",
			kind: "gear",
			name: "Artificers",
			bonusDowntimeTokens: { max: 1, description: "" },
			bonusDowntimeTokensValue: 0
		};
		sheet.actor = { system: { attributes: { equipment: [spentEntry, bonusEntry] } }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({
				"system.attributes.equipment": [
					{ ...spentEntry, spent: [] },
					{ ...bonusEntry, bonusDowntimeTokensValue: 1 }
				]
			})
		);
	});

	it("clears Enduring Support's active Approach override, unconditionally", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { approachOverride: { approach: "profane" } } },
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.approachOverride": null })
		);
	});

	it("resets a stepped-down Quarters extra-token pool back to its max, when the benefit is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					quarters: { benefits: ["extra-token"] },
					bonusDowntimeTokens: { "quarters:extra-token": { value: 0 } }
				}
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.bonusDowntimeTokens.quarters:extra-token.value": 1 })
		);
	});

	it("writes no Quarters extra-token key when the benefit isn't picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { quarters: { benefits: [] } } }, update: vi.fn() };

		sheet._onRefreshSortie();

		const updates = sheet.actor.update.mock.calls.at(-1)[0];
		expect(Object.keys(updates).some((key) => key.includes("quarters:extra-token"))).toBe(false);
	});

	// The Arcanist's Prepare Rituals (arcanist-mixin.js): "any remaining rituals expire when you
	// prepare new ones," and rituals are re-prepared every Sortie regardless — see docs/domains/moves.md's
	// "synthesize a roll-modifier source" paragraph for why this needs its own explicit clear. Neither
	// arcanist.rituals nor the ritual-1/2/3 spent flags is a uses/numericTrackers entry on a catalog
	// move, so both get their own explicit line in _onRefreshSortie; only the ward-hold tracker is
	// cleared for free by the generic _refreshPeriod walk.
	it("clears arcanist.rituals, unconditionally", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { arcanist: { rituals: [{ ritualKey: "arcanist-ritual:warding" }, null, null] } } },
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.arcanist.rituals": [] })
		);
	});

	it("clears the ritual-1/2/3 spent flags via _onRefreshSortie's own explicit write", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveUses: { "the-arcanist:prepare-rituals": { "ritual-1": true, "ritual-2": true } } } },
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({
				"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-1": false,
				"system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-2": false
			})
		);
	});

	it("resets the ward-hold tracker to its min via the generic _refreshPeriod walk", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveTrackers: { "the-arcanist:prepare-rituals": { "ward-hold": 4 } } } },
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.moveTrackers.the-arcanist:prepare-rituals.ward-hold": 0 })
		);
	});
});

describe("PlaybookActorSheet#_onRefreshScene - the Arcanist's Prepare Rituals", () => {
	it("leaves arcanist.rituals, the spent flags and the ward-hold tracker alone", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					arcanist: { rituals: [{ ritualKey: "arcanist-ritual:warding" }, null, null] },
					moveUses: { "the-arcanist:prepare-rituals": { "ritual-1": true } },
					moveTrackers: { "the-arcanist:prepare-rituals": { "ward-hold": 4 } }
				},
				resources: { hold: { value: 0 } }
			},
			update: vi.fn()
		};

		sheet._onRefreshScene();

		const updates = sheet.actor.update.mock.calls.at(-1)[0];
		expect("system.attributes.arcanist.rituals" in updates).toBe(false);
		expect("system.attributes.moveUses.the-arcanist:prepare-rituals.ritual-1" in updates).toBe(false);
		expect("system.attributes.moveTrackers.the-arcanist:prepare-rituals.ward-hold" in updates).toBe(false);
	});
});

describe("PlaybookActorSheet#_onRefreshSortie - Extra Parts/Weapons", () => {
	it("clears a non-empty astir.extraParts", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [], extraParts: [ALCHEMICAL_SUITE.key] } } },
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.astir.extraParts": [] })
		);
	});

	it("writes no astir.extraParts key when it's already empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [], extraParts: [] } } },
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		const updates = sheet.actor.update.mock.calls.at(-1)[0];
		expect(Object.keys(updates)).not.toContain("system.attributes.astir.extraParts");
	});

	it("never resurrects a null astir by writing a sub-path of it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onRefreshSortie();

		const updates = sheet.actor.update.mock.calls.at(-1)[0];
		expect(Object.keys(updates).some((key) => key.startsWith("system.attributes.astir"))).toBe(false);
	});

	it("clears an Ardent's extraParts, leaving an Ardent with nothing to clear untouched (same reference)", () => {
		const sheet = new PlaybookActorSheet();
		const untouched = { id: "ar2", parts: [], extraParts: [] };
		sheet.actor = {
			system: {
				attributes: { ardents: [{ id: "ar1", parts: [], extraParts: [ALCHEMICAL_SUITE.key] }, untouched] }
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		const updates = sheet.actor.update.mock.calls.at(-1)[0];
		expect(updates["system.attributes.ardents"]).toEqual([{ id: "ar1", parts: [], extraParts: [] }, untouched]);
		expect(updates["system.attributes.ardents"][1]).toBe(untouched);
	});

	it("writes no ardents key when no Ardent has anything to clear", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }] } }, update: vi.fn() };

		sheet._onRefreshSortie();

		const updates = sheet.actor.update.mock.calls.at(-1)[0];
		expect(Object.keys(updates)).not.toContain("system.attributes.ardents");
	});

	it("drops every extra: true equipment entry (Astir- or Ardent-owned) entirely", () => {
		const sheet = new PlaybookActorSheet();
		const regular = { id: "1", kind: "weapon", astir: true, name: "Lance", tags: [], spent: [] };
		const extraAstir = { id: "2", kind: "weapon", astir: true, extra: true, name: "Spare Lance", tags: [], spent: [] };
		const extraArdent = { id: "3", kind: "weapon", ardent: "ar1", extra: true, name: "Spare Spear", tags: [], spent: [] };
		sheet.actor = {
			system: { attributes: { equipment: [regular, extraAstir, extraArdent] } },
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.equipment": [regular] })
		);
	});

	it("still applies the equipment-array rewrite when only an Extra Weapon needs dropping and nothing else changes", () => {
		const sheet = new PlaybookActorSheet();
		const extraWeapon = { id: "1", kind: "weapon", astir: true, extra: true, name: "Spare Lance", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [extraWeapon] } }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.equipment": [] })
		);
	});

	it("reclamps Power down when an Extra Part granting Weapon Power capacity is cleared", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { astir: { id: "a1", power: 4, weaponPower: 2, parts: [], extraParts: [WEAPON_CONDUIT.key] } }
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		// Weapon Conduit's own Weapon Power capacity (2) is gone once the Extra Part is cleared, so
		// Weapon Power reclamps down to 0 the same way removing a regular part already would.
		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({
				"system.attributes.astir.power": astirMaxPower([], []),
				"system.attributes.astir.weaponPower": 0
			})
		);
	});

	it("reclamps Power using only the extras-filtered equipment once a Drain-tagged Extra Weapon is cleared", () => {
		const sheet = new PlaybookActorSheet();
		const regularDrainWeapon = { id: "1", kind: "weapon", astir: true, tags: ["drain-1"], name: "Lance", spent: [] };
		const extraDrainWeapon = {
			id: "2", kind: "weapon", astir: true, extra: true, tags: ["drain-2"], name: "Spare Lance", spent: []
		};
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", power: 3, parts: [] },
					equipment: [regularDrainWeapon, extraDrainWeapon]
				}
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		// Only the Extra Weapon's Drain-2 is dropped — the regular weapon's own Drain-1 still applies,
		// so max Power recovers to 3 (base 4 minus the remaining Drain-1), not all the way back to 4.
		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({
				"system.attributes.equipment": [regularDrainWeapon],
				"system.attributes.astir.power": astirMaxPower([], [regularDrainWeapon]),
				"system.attributes.astir.weaponPower": 0
			})
		);
	});

	it("treats a missing regular parts array as empty when reclamping Power", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, extraParts: [WEAPON_CONDUIT.key] } } },
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({
				"system.attributes.astir.power": astirMaxPower([], []),
				"system.attributes.astir.weaponPower": 0
			})
		);
	});
});
