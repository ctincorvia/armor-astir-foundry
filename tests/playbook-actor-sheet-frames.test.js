import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the Mount Up picker dialog is mocked — ardentParts/ardentWeapons/buildArdent/
// ardentLoadoutCount and the constants stay real.
vi.mock("../scripts/frames/ardent.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseFrame: vi.fn()
}));

import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { ASTIR_PART_CATALOG } from "../scripts/frames/astir.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { chooseFrame } from "../scripts/frames/ardent.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const ALCHEMICAL_SUITE = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:alchemical-suite");
const DIVINATION_CODEX = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:divination-codex");
const SEEK_ALLIES = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:seek-allies");
const PERSONAL_FAMILIAR = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:personal-familiar");
const TACTICAL_GENIUS = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-captain:tactical-genius");
const FORCE_MULTIPLIER = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-captain:force-multiplier");
const LET_LOOSE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:let-loose");

beforeEach(() => {
	chooseFrame.mockClear();
	ui.notifications.warn.mockClear();
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
			"system.attributes.downtimeTokens.value": 2,
			[`system.attributes.moveTrackers.${TACTICAL_GENIUS.key}.hold`]: 1
		});
	});

	it("clears a Sortie-scoped moveUses flag (Seek Allies) but leaves Personal Familiar's Downtime use", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					moveUses: {
						[SEEK_ALLIES.key]: { sortie: true },
						[PERSONAL_FAMILIAR.key]: { downtime: true }
					}
				}
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${SEEK_ALLIES.key}.sortie`]: false,
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
			"system.attributes.downtimeTokens.value": 2,
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
			"system.attributes.downtimeTokens.value": 2,
			[`system.attributes.moveTrackers.${TACTICAL_GENIUS.key}.hold`]: 1
		});
	});

	it("resets Astir Potions to 0 when Alchemical Suite is installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", parts: [ALCHEMICAL_SUITE.key], potions: { red: 2, blue: 1, yellow: 3 } }
				}
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.potions": { red: 0, blue: 0, yellow: 0 },
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
			"system.attributes.downtimeTokens.value": 2,
			[`system.attributes.moveTrackers.${TACTICAL_GENIUS.key}.hold`]: 1
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
			"system.attributes.downtimeTokens.value": 2,
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
			"system.attributes.downtimeTokens.value": 2
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

	it("folds a Let Loose KNOW trait bonus into Tactical Genius's computed hold value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					moveTrackers: { [TACTICAL_GENIUS.key]: { hold: 0 } },
					playbookMoves: [TACTICAL_GENIUS.key, LET_LOOSE.key],
					burdens: [{ id: "b1", label: "A burden" }],
					traitBonusChoices: { [LET_LOOSE.key]: "know" }
				},
				stats: { know: { value: 1 } }
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		// 1 (base KNOW) + 1 (Let Loose's +1-per-burden, 1 burden) = 2, so 1+KNOW = 3.
		expect(sheet.actor.update).toHaveBeenCalledWith(
			expect.objectContaining({ [`system.attributes.moveTrackers.${TACTICAL_GENIUS.key}.hold`]: 3 })
		);
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
});
