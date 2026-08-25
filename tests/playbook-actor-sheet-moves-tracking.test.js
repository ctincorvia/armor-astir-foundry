import { describe, expect, it, vi } from "vitest";

import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const SEEK_ALLIES = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:seek-allies");
const PERSONAL_FAMILIAR = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:personal-familiar");
// Haste (see cantrips.js) has no uses of its own.
const HASTE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:haste");
const CLASSICAL_SPELLCASTING = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:classical-spellcasting");

describe("PlaybookActorSheet#getData - move uses", () => {
	function playbookGroup(data) {
		return data.moveGroups.find((group) => group.label === "Playbook Moves");
	}

	it("gives a move with no uses declared an empty uses array", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [HASTE.key] } } };

		expect(playbookGroup(sheet.getData()).moves[0].uses).toEqual([]);
	});

	it("reads each use entry's label and defaults to unchecked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [SEEK_ALLIES.key] } } };

		expect(playbookGroup(sheet.getData()).moves[0].uses).toEqual([
			{ key: "sortie", label: "Used this Sortie", checked: false }
		]);
	});

	it("reads each use entry's checked state independently, by move key and use key", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [PERSONAL_FAMILIAR.key],
					moveUses: { [PERSONAL_FAMILIAR.key]: { sortie: true } }
				}
			}
		};

		expect(playbookGroup(sheet.getData()).moves[0].uses).toEqual([
			{ key: "sortie", label: "Ignored a disadvantage this Sortie", checked: true }
		]);
	});

	it("doesn't confuse one move's stored uses with another's", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [SEEK_ALLIES.key],
					moveUses: { [PERSONAL_FAMILIAR.key]: { sortie: true } }
				}
			}
		};

		expect(playbookGroup(sheet.getData()).moves[0].uses[0].checked).toBe(false);
	});
});

describe("PlaybookActorSheet#activateListeners - move uses", () => {
	it("binds a change handler to the uses checkbox", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".move-use-checkbox");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});

	it("binds a change handler to the trait bonus select", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".trait-bonus-select");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});

	it("binds a change handler to the adds-trait-move select", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".adds-trait-move-select");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});

	it("binds a change handler to the weapon tag choice select", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".weapon-tag-choice-select");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onMoveUseToggle", () => {
	it("writes the checked state to the actor, keyed by move and use", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onMoveUseToggle({
			currentTarget: { dataset: { move: SEEK_ALLIES.key, use: "sortie" }, checked: true }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${SEEK_ALLIES.key}.sortie`]: true
		});
	});

	it("writes false when the box is unchecked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onMoveUseToggle({
			currentTarget: { dataset: { move: PERSONAL_FAMILIAR.key, use: "sortie" }, checked: false }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${PERSONAL_FAMILIAR.key}.sortie`]: false
		});
	});
});

describe("PlaybookActorSheet#_onTraitBonusChoiceChange", () => {
	it("writes the selected trait key to the actor, keyed by move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onTraitBonusChoiceChange({
			currentTarget: { dataset: { move: "the-impostor:let-loose" }, value: "clash" }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.traitBonusChoices.the-impostor:let-loose": "clash"
		});
	});

	it("writes an empty string back when the blank option is chosen", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onTraitBonusChoiceChange({
			currentTarget: { dataset: { move: "the-impostor:let-loose" }, value: "" }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.traitBonusChoices.the-impostor:let-loose": ""
		});
	});
});

describe("PlaybookActorSheet#_onAddsTraitToMoveChoiceChange", () => {
	it("writes the selected move key to the actor, keyed by the granting move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onAddsTraitToMoveChoiceChange({
			currentTarget: { dataset: { move: "cantrips:classical-spellcasting" }, value: "read-the-room" }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.addsTraitToMoveChoices.cantrips:classical-spellcasting": "read-the-room"
		});
	});

	it("writes an empty string back when the blank option is chosen", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onAddsTraitToMoveChoiceChange({
			currentTarget: { dataset: { move: "cantrips:classical-spellcasting" }, value: "" }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.addsTraitToMoveChoices.cantrips:classical-spellcasting": ""
		});
	});
});

describe("PlaybookActorSheet#_onWeaponTagChoiceChange", () => {
	it("writes the selected tag key to the actor, keyed by the granting move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onWeaponTagChoiceChange({
			currentTarget: { dataset: { move: "cantrips:advanced-evocation" }, value: "impact" }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.weaponTagChoices.cantrips:advanced-evocation": "impact"
		});
	});

	it("writes an empty string back when the blank option is chosen", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onWeaponTagChoiceChange({
			currentTarget: { dataset: { move: "cantrips:advanced-evocation" }, value: "" }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.weaponTagChoices.cantrips:advanced-evocation": ""
		});
	});
});

describe("PlaybookActorSheet#_grantedMoveEquipmentUpdate", () => {
	it("returns an empty patch for a move with no grantsEquipment", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._grantedMoveEquipmentUpdate(HASTE.key)).toEqual({});
	});

	it("snapshots Classical Spellcasting's Hand-casting weapon onto the actor's equipment", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._grantedMoveEquipmentUpdate(CLASSICAL_SPELLCASTING.key)).toEqual({
			"system.attributes.equipment": [{
				id: "test-id",
				spent: [],
				kind: "weapon",
				name: "Hand-casting",
				tags: ["ranged", "area"],
				scale: "foot",
				startingGear: true
			}]
		});
	});

	it("appends to the actor's existing equipment rather than replacing it", () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "eq1", kind: "gear", name: "Rope", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [existing] } } };

		const update = sheet._grantedMoveEquipmentUpdate(CLASSICAL_SPELLCASTING.key);

		expect(update["system.attributes.equipment"][0]).toBe(existing);
		expect(update["system.attributes.equipment"]).toHaveLength(2);
	});

	it("returns an empty patch when the actor already has a same-named entry", () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "eq1", kind: "weapon", name: "Hand-casting", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [existing] } } };

		expect(sheet._grantedMoveEquipmentUpdate(CLASSICAL_SPELLCASTING.key)).toEqual({});
	});
});

describe("PlaybookActorSheet#getData - hold", () => {
	it("marks trackHold true only for moves that define a hold track", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();
		const holdFlags = Object.fromEntries(data.moveGroups[0].moves.map((m) => [m.key, m.trackHold]));

		expect(holdFlags).toEqual({
			"exchange-blows": false,
			"weather-the-storm": false,
			"read-the-room": true,
			"dispel-uncertainties": false,
			"help-or-hinder": false,
			"weave-magic": false,
			"cool-off": false,
			"strike-decisively": false,
			"bite-the-dust": false
		});
	});

	it("reflects the actor's current hold value on every move, defaulting to 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, resources: { hold: { value: 2 } } } };

		const data = sheet.getData();

		for (const move of data.moveGroups[0].moves) {
			expect(move.hold).toBe(2);
		}
	});
});

describe("PlaybookActorSheet#getData - flatHold moves' separate hold pools", () => {
	it("reads b-plot's hold from system.attributes.moveHold, keyed by its own move key, not the shared resources.hold pool", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				resources: { hold: { value: 5 } },
				attributes: { moveHold: { "b-plot": { value: 2 } } }
			}
		};

		const data = sheet.getData();

		expect(data.moveGroups.find((g) => g.label === "Special Moves").moves.find((m) => m.key === "b-plot").hold).toBe(2);
		// Read the Room (a basic move) keeps reading the shared pool, unaffected by moveHold.
		expect(data.moveGroups[0].moves.find((m) => m.key === "read-the-room").hold).toBe(5);
	});

	it("defaults b-plot's hold to 0 when moveHold is missing", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.moveGroups.find((g) => g.label === "Special Moves").moves.find((m) => m.key === "b-plot").hold).toBe(0);
	});

	it("keeps two different flatHold moves' pools independent, keyed by their own move key", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					moveHold: {
						"b-plot": { value: 2 },
						"soldier:get-out-of-my-way": { value: 1 }
					},
					playbookMoves: ["soldier:get-out-of-my-way"]
				}
			}
		};

		const data = sheet.getData();

		expect(data.moveGroups.find((g) => g.label === "Special Moves").moves.find((m) => m.key === "b-plot").hold).toBe(2);
		expect(data.moveGroups[1].moves.find((m) => m.key === "soldier:get-out-of-my-way").hold).toBe(1);
	});
});

describe("PlaybookActorSheet#activateListeners - hold step", () => {
	it("binds a click handler to the hold step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".hold-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onHoldStep", () => {
	it("increments the hold value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { resources: { hold: { value: 1 } } }, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 2 });
	});

	it("decrements the hold value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { resources: { hold: { value: 1 } } }, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 0 });
	});

	it("treats a missing hold value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 1 });
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { resources: { hold: { value: 3 } } }, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { resources: { hold: { value: 0 } } }, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#activateListeners - flat hold step", () => {
	it("binds a click handler to the flat hold step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".flat-hold-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onFlatHoldStep", () => {
	it("increments the move's hold value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 1 } } } }, update: vi.fn() };

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 2 });
	});

	it("decrements the move's hold value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 1 } } } }, update: vi.fn() };

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 0 });
	});

	it("treats a missing hold value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 1 });
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 3 } } } }, update: vi.fn() };

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 0 } } } }, update: vi.fn() };

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does not affect the shared resources.hold field", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveHold: { "b-plot": { value: 1 } } }, resources: { hold: { value: 5 } } },
			update: vi.fn()
		};

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 2 });
		expect(sheet.actor.update).not.toHaveBeenCalledWith(expect.objectContaining({
			"system.resources.hold.value": expect.anything()
		}));
	});

	it("keeps a different flatHold move's pool untouched when stepping this one", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					moveHold: { "b-plot": { value: 2 }, "soldier:get-out-of-my-way": { value: 1 } }
				}
			},
			update: vi.fn()
		};

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "soldier:get-out-of-my-way", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.soldier:get-out-of-my-way.value": 2
		});
	});
});

describe("PlaybookActorSheet#activateListeners - move tracker step", () => {
	it("binds a click handler to the move tracker step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".move-tracker-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onMoveTrackerStep", () => {
	const TRANSMUTE_SELF = "the-arcanist:transmute-self";

	it("increments the tracker's value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveTrackers: { [TRANSMUTE_SELF]: { "set-1": 0 } } } },
			update: vi.fn()
		};

		sheet._onMoveTrackerStep({
			currentTarget: { dataset: { move: TRANSMUTE_SELF, tracker: "set-1", delta: "1", min: "-3", max: "3" } }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveTrackers.${TRANSMUTE_SELF}.set-1`]: 1
		});
	});

	it("decrements the tracker's value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveTrackers: { [TRANSMUTE_SELF]: { "set-1": 0 } } } },
			update: vi.fn()
		};

		sheet._onMoveTrackerStep({
			currentTarget: { dataset: { move: TRANSMUTE_SELF, tracker: "set-1", delta: "-1", min: "-3", max: "3" } }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveTrackers.${TRANSMUTE_SELF}.set-1`]: -1
		});
	});

	it("treats a missing tracker value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };

		sheet._onMoveTrackerStep({
			currentTarget: { dataset: { move: TRANSMUTE_SELF, tracker: "set-1", delta: "1", min: "-3", max: "3" } }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveTrackers.${TRANSMUTE_SELF}.set-1`]: 1
		});
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveTrackers: { [TRANSMUTE_SELF]: { "set-1": 3 } } } },
			update: vi.fn()
		};

		sheet._onMoveTrackerStep({
			currentTarget: { dataset: { move: TRANSMUTE_SELF, tracker: "set-1", delta: "1", min: "-3", max: "3" } }
		});

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveTrackers: { [TRANSMUTE_SELF]: { "set-1": -3 } } } },
			update: vi.fn()
		};

		sheet._onMoveTrackerStep({
			currentTarget: { dataset: { move: TRANSMUTE_SELF, tracker: "set-1", delta: "-1", min: "-3", max: "3" } }
		});

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("keeps a different tracker on the same move untouched when stepping this one", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { moveTrackers: { [TRANSMUTE_SELF]: { "set-1": 1, "set-2": 2 } } }
			},
			update: vi.fn()
		};

		sheet._onMoveTrackerStep({
			currentTarget: { dataset: { move: TRANSMUTE_SELF, tracker: "set-2", delta: "1", min: "-3", max: "3" } }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveTrackers.${TRANSMUTE_SELF}.set-2`]: 3
		});
	});
});

describe("PlaybookActorSheet#_crewSupportHold", () => {
	it("reads the stored hold value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveTrackers: { "crew-support": { hold: 2 } } } } };

		expect(sheet._crewSupportHold()).toBe(2);
	});

	it("treats a missing stored value as 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._crewSupportHold()).toBe(0);
	});
});

describe("PlaybookActorSheet#_crewSupportHoldSpend", () => {
	it("returns a patch that decrements the current hold by 1", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveTrackers: { "crew-support": { hold: 2 } } } } };

		expect(sheet._crewSupportHoldSpend()).toEqual({ "system.attributes.moveTrackers.crew-support.hold": 1 });
	});

	it("floors at 0 rather than going negative", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveTrackers: { "crew-support": { hold: 0 } } } } };

		expect(sheet._crewSupportHoldSpend()).toEqual({ "system.attributes.moveTrackers.crew-support.hold": 0 });
	});
});

describe("PlaybookActorSheet#_hasUnlimitedCrewSupport", () => {
	it("is true for a Captain", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-captain" }, attributes: {} } };

		expect(sheet._hasUnlimitedCrewSupport()).toBe(true);
	});

	it("is false for any other playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-commander" }, attributes: {} } };

		expect(sheet._hasUnlimitedCrewSupport()).toBe(false);
	});

	it("is false with no playbook selected", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._hasUnlimitedCrewSupport()).toBe(false);
	});
});
