import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the picker dialog is mocked — the pool definitions and resolvePlaybookMoves stay real, so
// the sheet is exercised against the actual move content.
vi.mock("../scripts/moves/playbook-moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	choosePlaybookMove: vi.fn()
}));

// Only the picker dialog is mocked — the pool definitions and findStartingMovePool stay real, same
// reasoning as playbook-moves.js above.
vi.mock("../scripts/moves/starting-moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseStartingMoves: vi.fn()
}));

import { ALL_PLAYBOOK_MOVES, choosePlaybookMove } from "../scripts/moves/playbook-moves.js";
import { chooseStartingMoves } from "../scripts/moves/starting-moves.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const DENY = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:deny");
const BULLHEADED = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:bullheaded");
const ARCANE_AUGMENTS = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:arcane-augments");
const LET_LOOSE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:let-loose");
const TRANSMUTE_SELF = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-arcanist:transmute-self");
const PRE_ORDAINED = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-arcanist:pre-ordained");
const I_KNOW_YOU = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-revenant:i-know-you");
const CLASSICAL_SPELLCASTING = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:classical-spellcasting");
const ADVANCED_EVOCATION = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:advanced-evocation");

beforeEach(() => {
	choosePlaybookMove.mockClear();
	chooseStartingMoves.mockClear();
});

describe("PlaybookActorSheet#_onStartingMovesAdd", () => {
	it("does nothing for a playbook with no starting-move allotment", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "Not a Real Playbook" } }, update: vi.fn() };

		await sheet._onStartingMovesAdd();

		expect(chooseStartingMoves).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for a playbook with no pool at all", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "Not A Real Playbook" } }, update: vi.fn() };

		await sheet._onStartingMovesAdd();

		expect(chooseStartingMoves).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("opens the picker for The Scout's own pool", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: {} }, update: vi.fn() };
		chooseStartingMoves.mockResolvedValue([]);

		await sheet._onStartingMovesAdd();

		expect(chooseStartingMoves).toHaveBeenCalledWith("The Scout");
	});

	it("appends the picked keys to the actor's existing playbookMoves", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { playbookMoves: [DENY.key] } },
			update: vi.fn()
		};
		chooseStartingMoves.mockResolvedValue(["the-scout:field-scout", "the-scout:mobility"]);

		await sheet._onStartingMovesAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.playbookMoves": [DENY.key, "the-scout:field-scout", "the-scout:mobility"]
		});
	});

	it("does not duplicate a key the actor already has", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { playbookMoves: ["the-scout:field-scout"] } },
			update: vi.fn()
		};
		chooseStartingMoves.mockResolvedValue(["the-scout:field-scout", "the-scout:mobility"]);

		await sheet._onStartingMovesAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.playbookMoves": ["the-scout:field-scout", "the-scout:mobility"]
		});
	});

	it("does nothing, leaving the button available to retry, when the picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: {} }, update: vi.fn() };
		chooseStartingMoves.mockResolvedValue(null);

		await sheet._onStartingMovesAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing, leaving the button available to retry, when nothing was picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: {} }, update: vi.fn() };
		chooseStartingMoves.mockResolvedValue([]);

		await sheet._onStartingMovesAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("opens the picker and grants Arcane Augments for The Impostor, which has nothing to pick", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Impostor" }, attributes: {} }, update: vi.fn() };
		chooseStartingMoves.mockResolvedValue([]);

		await sheet._onStartingMovesAdd();

		expect(chooseStartingMoves).toHaveBeenCalledWith("The Impostor");
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.playbookMoves": [ARCANE_AUGMENTS.key]
		});
	});

	it("still grants Arcane Augments even if The Impostor's (empty) picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Impostor" }, attributes: {} }, update: vi.fn() };
		chooseStartingMoves.mockResolvedValue(null);

		await sheet._onStartingMovesAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.playbookMoves": [ARCANE_AUGMENTS.key]
		});
	});

	it("does nothing when a granted key the actor already has leaves no new additions", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Impostor" }, attributes: { playbookMoves: [ARCANE_AUGMENTS.key] } },
			update: vi.fn()
		};
		chooseStartingMoves.mockResolvedValue([]);

		await sheet._onStartingMovesAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#getData - playbook moves", () => {
	function playbookGroup(data) {
		return data.moveGroups.find((group) => group.label === "Playbook Moves");
	}

	it("starts empty, since no playbook grants playbook moves by default", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		expect(playbookGroup(sheet.getData()).moves).toEqual([]);
	});

	it("marks only the playbook group as addable and removable", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const groups = sheet.getData().moveGroups;

		expect(groups.filter((group) => group.addable).map((group) => group.label)).toEqual(["Playbook Moves"]);
		expect(groups.filter((group) => group.removable).map((group) => group.label)).toEqual(["Playbook Moves"]);
	});

	it("makes starting moves available for The Scout, which has a real allotment to offer", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" } } };

		expect(playbookGroup(sheet.getData()).startingMovesAvailable).toBe(true);
	});

	it("hides starting moves for a playbook with no pool at all", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "Not A Real Playbook" } } };

		expect(playbookGroup(sheet.getData()).startingMovesAvailable).toBe(false);
	});

	it("makes starting moves available for The Impostor, which grants Arcane Augments with nothing to pick", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Impostor" } } };

		expect(playbookGroup(sheet.getData()).startingMovesAvailable).toBe(true);
	});

	it("hides starting moves while the actor already has playbook moves", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { playbookMoves: ["the-scout:field-scout"] } } };

		expect(playbookGroup(sheet.getData()).startingMovesAvailable).toBe(false);
	});

	it("hides starting moves when the actor has no playbook set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		expect(playbookGroup(sheet.getData()).startingMovesAvailable).toBe(false);
	});

	it("renders the moves the actor has picked, in the order they were picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 2 } },
				attributes: { playbookMoves: [DENY.key, BULLHEADED.key] }
			}
		};

		expect(playbookGroup(sheet.getData()).moves.map((move) => move.key))
			.toEqual([DENY.key, BULLHEADED.key]);
	});

	it("gives a picked move the same shape as a basic move, so it rolls the same way", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { channel: { value: 2 } }, attributes: { playbookMoves: [DENY.key] } }
		};

		expect(playbookGroup(sheet.getData()).moves[0]).toEqual({
			key: DENY.key,
			name: "Deny",
			traits: [{ key: "channel", label: "CHANNEL", value: 2 }],
			gated: false,
			rollable: true,
			activatable: false,
			summonable: false,
			descriptionGated: false,
			trackHold: false,
			separateHoldPool: false,
			hold: 0,
			uses: [],
			traitBonusChoosable: false,
			traitBonusChoice: "",
			trackers: []
		});
	});

	it("resolves Transmute Self's numericTrackers, with a stored value on one and the default 0 on the other", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [TRANSMUTE_SELF.key],
					moveTrackers: { [TRANSMUTE_SELF.key]: { "set-1": 2 } }
				}
			}
		};

		const move = playbookGroup(sheet.getData()).moves[0];

		expect(move.trackers).toEqual([
			{ key: "set-1", label: "Alternate Set 1", min: -3, max: 3, value: 2 },
			{ key: "set-2", label: "Alternate Set 2", min: -3, max: 3, value: 0 }
		]);
	});

	it("resolves Pre-ordained's kept-die numericTracker, defaulting to 0 when unset", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [PRE_ORDAINED.key] } } };

		const move = playbookGroup(sheet.getData()).moves[0];

		expect(move.trackers).toEqual([
			{ key: "kept-die", label: "Kept d6", min: 0, max: 6, value: 0 }
		]);
	});

	it("marks a chooseTrait traitBonus move (Let Loose) as traitBonusChoosable, defaulting choice to blank", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [LET_LOOSE.key] } } };

		const move = playbookGroup(sheet.getData()).moves[0];

		expect(move.traitBonusChoosable).toBe(true);
		expect(move.traitBonusChoice).toBe("");
	});

	it("reflects a stored traitBonus choice for that move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { playbookMoves: [LET_LOOSE.key], traitBonusChoices: { [LET_LOOSE.key]: "sense" } }
			}
		};

		expect(playbookGroup(sheet.getData()).moves[0].traitBonusChoice).toBe("sense");
	});

	it("marks a chooseMove addsTraitToMove move (Classical Spellcasting) as addsTraitToMoveChoosable, defaulting choice to blank", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [CLASSICAL_SPELLCASTING.key] } } };

		const move = playbookGroup(sheet.getData()).moves[0];

		expect(move.addsTraitToMoveChoosable).toBe(true);
		expect(move.addsTraitToMoveChoice).toBe("");
	});

	it("reflects a stored addsTraitToMove choice for that move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [CLASSICAL_SPELLCASTING.key],
					addsTraitToMoveChoices: { [CLASSICAL_SPELLCASTING.key]: "read-the-room" }
				}
			}
		};

		expect(playbookGroup(sheet.getData()).moves[0].addsTraitToMoveChoice).toBe("read-the-room");
	});

	it("marks a grantsWeaponTagChoice move (Advanced Evocation) as weaponTagChoiceChoosable, with its four options and a blank default", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [CLASSICAL_SPELLCASTING.key, ADVANCED_EVOCATION.key] } }
		};

		const move = playbookGroup(sheet.getData()).moves[1];

		expect(move.weaponTagChoiceChoosable).toBe(true);
		expect(move.weaponTagChoiceOptions).toEqual([
			{ key: "defensive", label: "Defensive" },
			{ key: "decisive", label: "Decisive" },
			{ key: "restraining", label: "Restraining" },
			{ key: "impact", label: "Impact" }
		]);
		expect(move.weaponTagChoiceChoice).toBe("");
	});

	it("reflects a stored weaponTagChoice for Advanced Evocation", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [CLASSICAL_SPELLCASTING.key, ADVANCED_EVOCATION.key],
					weaponTagChoices: { [ADVANCED_EVOCATION.key]: "impact" }
				}
			}
		};

		expect(playbookGroup(sheet.getData()).moves[1].weaponTagChoiceChoice).toBe("impact");
	});

	it("omits weaponTagChoiceChoosable for a move with no grantsWeaponTagChoice", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BULLHEADED.key] } } };

		expect(playbookGroup(sheet.getData()).moves[0]).not.toHaveProperty("weaponTagChoiceChoosable");
	});

	it("shows no Roll button for a picked move that rolls nothing", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BULLHEADED.key] } } };

		const [move] = playbookGroup(sheet.getData()).moves;

		expect(move.rollable).toBe(false);
		expect(move.activatable).toBe(false);
		expect(move.gated).toBe(false);
	});

	it("shows a Roll button for a fixedTraits-only move with no actor stats to roll (I Know You)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { playbookMoves: [I_KNOW_YOU.key] } } };

		const [move] = playbookGroup(sheet.getData()).moves;

		expect(move.rollable).toBe(true);
		expect(move.gated).toBe(false);
	});

	it("gates a picked move whose only trait is disabled for this playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 0, disabled: true } },
				attributes: { playbookMoves: [DENY.key] }
			}
		};

		expect(playbookGroup(sheet.getData()).moves[0].gated).toBe(true);
	});

	it("drops a stored key whose move no longer exists rather than breaking the sheet", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: ["the-scout:deleted-move", BULLHEADED.key] } }
		};

		expect(playbookGroup(sheet.getData()).moves.map((move) => move.key)).toEqual([BULLHEADED.key]);
	});
});

describe("PlaybookActorSheet#activateListeners - playbook moves", () => {
	it("binds click handlers to the playbook move add and remove buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".playbook-move-add");
		expect(html.find).toHaveBeenCalledWith(".playbook-move-remove");
		expect(html.find).toHaveBeenCalledWith(".starting-moves-add");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onPlaybookMoveAdd", () => {
	it("opens the picker with the actor's playbook and current picks", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { playbookMoves: [BULLHEADED.key] } },
			update: vi.fn()
		};
		choosePlaybookMove.mockResolvedValue(null);

		await sheet._onPlaybookMoveAdd();

		expect(choosePlaybookMove).toHaveBeenCalledWith("The Scout", [BULLHEADED.key]);
	});

	it("appends the chosen move to the actor's picks", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { playbookMoves: [BULLHEADED.key] } },
			update: vi.fn()
		};
		choosePlaybookMove.mockResolvedValue(DENY.key);

		await sheet._onPlaybookMoveAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.playbookMoves": [BULLHEADED.key, DENY.key]
		});
	});

	it("adds the first move to an actor that has never picked one", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" } }, update: vi.fn() };
		choosePlaybookMove.mockResolvedValue(BULLHEADED.key);

		await sheet._onPlaybookMoveAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.playbookMoves": [BULLHEADED.key]
		});
	});

	it("does nothing when the picker is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" } }, update: vi.fn() };
		choosePlaybookMove.mockResolvedValue(null);

		await sheet._onPlaybookMoveAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	// The picker already filters out what the actor has, so this only guards against a stale
	// dialog left open across another window's edit — but a duplicate key would render the move
	// twice with two ✕ buttons that both remove it.
	it("does not add a move the actor already has", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { playbookMoves: [BULLHEADED.key] } },
			update: vi.fn()
		};
		choosePlaybookMove.mockResolvedValue(BULLHEADED.key);

		await sheet._onPlaybookMoveAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("passes an undefined playbook name through when the actor has no playbook set", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };
		choosePlaybookMove.mockResolvedValue(null);

		await sheet._onPlaybookMoveAdd();

		expect(choosePlaybookMove).toHaveBeenCalledWith(undefined, []);
	});

	// Classical Spellcasting's own grantsEquipment (see _grantedMoveEquipmentUpdate's own tests for
	// the granted entry's exact shape) — folded into this same update rather than a second
	// actor.update call, so picking the move and receiving its weapon land as one undo step.
	it("also grants Classical Spellcasting's Hand-casting weapon in the same update", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { playbookMoves: [BULLHEADED.key] } },
			update: vi.fn()
		};
		choosePlaybookMove.mockResolvedValue(CLASSICAL_SPELLCASTING.key);

		await sheet._onPlaybookMoveAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.playbookMoves": [BULLHEADED.key, CLASSICAL_SPELLCASTING.key],
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

	it("does not grant equipment a second time when the actor already has a same-named entry", async () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "eq1", kind: "weapon", name: "Hand-casting", tags: [], spent: [] };
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { equipment: [existing] } },
			update: vi.fn()
		};
		choosePlaybookMove.mockResolvedValue(CLASSICAL_SPELLCASTING.key);

		await sheet._onPlaybookMoveAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.playbookMoves": [CLASSICAL_SPELLCASTING.key]
		});
	});
});

describe("PlaybookActorSheet#_onPlaybookMoveRemove", () => {
	it("removes just the clicked move, leaving the rest in order", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [BULLHEADED.key, DENY.key] } },
			update: vi.fn()
		};

		sheet._onPlaybookMoveRemove({ currentTarget: { dataset: { move: BULLHEADED.key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.playbookMoves": [DENY.key]
		});
	});

	it("does nothing for a move the actor doesn't have", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BULLHEADED.key] } }, update: vi.fn() };

		sheet._onPlaybookMoveRemove({ currentTarget: { dataset: { move: DENY.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});
