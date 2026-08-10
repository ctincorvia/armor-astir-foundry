import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	postMoveDescription: vi.fn()
}));

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

import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { BASIC_MOVES, SPECIAL_MOVES, postMoveDescription } from "../scripts/moves/moves.js";
import { ALL_PLAYBOOK_MOVES, choosePlaybookMove } from "../scripts/moves/playbook-moves.js";
import { chooseStartingMoves } from "../scripts/moves/starting-moves.js";
import { ASTIR_PART_CATALOG } from "../scripts/frames/astir.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const READ_THE_ROOM = BASIC_MOVES.find((m) => m.key === "read-the-room");
const SUBSYSTEMS = SPECIAL_MOVES.find((m) => m.key === "subsystems");
const B_PLOT = SPECIAL_MOVES.find((m) => m.key === "b-plot");
const BULLHEADED = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:bullheaded");
const ARCANE_AUGMENTS = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:arcane-augments");
const LET_LOOSE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:let-loose");
const FACILITATOR = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-diplomat:facilitator");
const TURN_UNEARTHLY = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-paradigm:turn-unearthly");
const BUREAUCRAT = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-diplomat:bureaucrat");
const DENY = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:deny");
const TRANSMUTE_SELF = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-arcanist:transmute-self");
const PRE_ORDAINED = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-arcanist:pre-ordained");
const SEEK_ALLIES = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:seek-allies");
const PERSONAL_FAMILIAR = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:personal-familiar");
const INPUT_CHANNEL = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:input-channel");
const DIVINATION_CODEX = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:divination-codex");
const I_KNOW_YOU = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-revenant:i-know-you");
const NEVER_QUITE_FREE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-revenant:never-quite-free");

beforeEach(() => {
	postMoveDescription.mockClear();
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

describe("PlaybookActorSheet#getData - moves", () => {
	it("exposes basic moves grouped, with each move's currently enabled traits and values", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 1 }, talk: { value: -1 } } } };

		const data = sheet.getData();

		expect(data.moveGroups).toEqual([
			{
				label: "Basic Moves",
				moves: [
					{
						key: "exchange-blows",
						name: "Exchange Blows",
						traits: [
							{ key: "clash", label: "CLASH", value: 1 },
							{ key: "talk", label: "TALK", value: -1 }
						],
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
					},
					{
						key: "weather-the-storm",
						name: "Weather the Storm",
						traits: [
							{ key: "defy", label: "DEFY", value: 0 },
							{ key: "know", label: "KNOW", value: 0 },
							{ key: "sense", label: "SENSE", value: 0 }
						],
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
					},
					{
						key: "read-the-room",
						name: "Read the Room",
						traits: [
							{ key: "sense", label: "SENSE", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						summonable: false,
						descriptionGated: false,
						trackHold: true,
						separateHoldPool: false,
						hold: 0,
						uses: [],
						traitBonusChoosable: false,
						traitBonusChoice: "",
						trackers: []
					},
					{
						key: "dispel-uncertainties",
						name: "Dispel Uncertainties",
						traits: [
							{ key: "know", label: "KNOW", value: 0 }
						],
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
					},
					{
						key: "help-or-hinder",
						name: "Help or Hinder",
						traits: [],
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
					},
					{
						key: "weave-magic",
						name: "Weave Magic",
						// channel isn't in this actor's stats at all — same as any other missing stat,
						// that reads as enabled rather than gated (see availableMoveTraits).
						traits: [
							{ key: "channel", label: "CHANNEL", value: 0 }
						],
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
					},
					{
						key: "cool-off",
						name: "Cool Off",
						traits: [
							{ key: "defy", label: "DEFY", value: 0 },
							{ key: "sense", label: "SENSE", value: 0 },
							{ key: "clash", label: "CLASH", value: 1 },
							{ key: "talk", label: "TALK", value: -1 },
							{ key: "know", label: "KNOW", value: 0 },
							{ key: "channel", label: "CHANNEL", value: 0 }
						],
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
					},
					{
						key: "strike-decisively",
						name: "Strike Decisively",
						traits: [
							{ key: "clash", label: "CLASH", value: 1 },
							{ key: "talk", label: "TALK", value: -1 }
						],
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
					},
					{
						key: "bite-the-dust",
						name: "Bite the Dust",
						traits: [
							{ key: "defy", label: "DEFY", value: 0 }
						],
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
					}
				]
			},
			// Empty until the player picks something with the "+" — no playbook starts with any
			// playbook moves. addable/removable are what render that "+" and each row's ✕.
			{
				label: "Playbook Moves",
				moves: [],
				addable: true,
				removable: true,
				startingMovesAvailable: false
			},
			{
				label: "Astir Moves",
				moves: [
					{
						key: "heat-up",
						name: "Heat Up",
						traits: [],
						// No Astir at all for this actor, so the Astir Moves group's mount-based gating
						// (see _movesData) forces every entry gated regardless of its own logic.
						gated: true,
						rollable: false,
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
					},
					{
						key: "subsystems",
						name: "Subsystems",
						traits: [],
						gated: true,
						rollable: false,
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
					}
				]
			},
			{
				label: "Special Moves",
				moves: [
					{
						key: "lead-a-sortie",
						name: "Lead a Sortie",
						traits: [
							{ key: "know", label: "KNOW", value: 0 },
							{ key: "defy", label: "DEFY", value: 0 },
							{ key: "crew", label: "CREW", value: 0 }
						],
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
					},
					{
						key: "b-plot",
						name: "B-Plot",
						traits: [],
						// channel isn't in this actor's stats at all, which reads as enabled — so
						// b-plot is gated here, the mirror image of weave-magic above.
						gated: true,
						rollable: false,
						activatable: true,
						summonable: false,
						descriptionGated: true,
						trackHold: true,
						separateHoldPool: true,
						hold: 0,
						uses: [],
						traitBonusChoosable: false,
						traitBonusChoice: "",
						trackers: []
					}
				]
			}
		]);
	});

	it("omits a move's disabled traits from the trait list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 1, disabled: true }, talk: { value: 0 } } } };

		const data = sheet.getData();

		expect(data.moveGroups[0].moves[0].traits).toEqual([{ key: "talk", label: "TALK", value: 0 }]);
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

describe("PlaybookActorSheet#getData - move uses", () => {
	function playbookGroup(data) {
		return data.moveGroups.find((group) => group.label === "Playbook Moves");
	}

	it("gives a move with no uses declared an empty uses array", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BULLHEADED.key] } } };

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
			{ key: "sortie", label: "Ignored a disadvantage this Sortie", checked: true },
			{ key: "downtime", label: "Reported back this Downtime", checked: false }
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
			currentTarget: { dataset: { move: PERSONAL_FAMILIAR.key, use: "downtime" }, checked: false }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${PERSONAL_FAMILIAR.key}.downtime`]: false
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

describe("PlaybookActorSheet#getData - gated moves", () => {
	it("gates weave magic's Roll button when CHANNEL is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		const weaveMagic = data.moveGroups[0].moves.find((m) => m.key === "weave-magic");
		expect(weaveMagic.gated).toBe(true);
		expect(weaveMagic.traits).toEqual([]);
	});

	it("un-gates weave magic once CHANNEL is enabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		const weaveMagic = data.moveGroups[0].moves.find((m) => m.key === "weave-magic");
		expect(weaveMagic.gated).toBe(false);
		expect(weaveMagic.traits).toEqual([{ key: "channel", label: "CHANNEL", value: 1 }]);
	});

	it("never gates help or hinder, which has no stat traits by design", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.moveGroups[0].moves.find((m) => m.key === "help-or-hinder").gated).toBe(false);
	});

	function specialGroup(data) {
		return data.moveGroups.find((g) => g.label === "Special Moves");
	}

	it("gates b-plot when CHANNEL is enabled, the mirror image of weave magic", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		expect(specialGroup(data).moves.find((m) => m.key === "b-plot").gated).toBe(true);
	});

	it("gates b-plot when CHANNEL is missing from stats (reads as enabled)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(specialGroup(data).moves.find((m) => m.key === "b-plot").gated).toBe(true);
	});

	it("un-gates b-plot once CHANNEL is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		expect(specialGroup(data).moves.find((m) => m.key === "b-plot").gated).toBe(false);
	});

	it("never gates lead a sortie off CHANNEL, unlike b-plot", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		// Subsystems used to live alongside lead-a-sortie here too, but it's moved to the Astir
		// Moves group (see _movesData) — its gating is now mount-based, not CHANNEL-based, and is
		// covered in tests/playbook-actor-sheet-astir.test.js instead.
		expect(specialGroup(data).moves.find((m) => m.key === "lead-a-sortie").gated).toBe(false);
	});

	it("also greys out b-plot's Description button when CHANNEL is enabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		expect(specialGroup(data).moves.find((m) => m.key === "b-plot").descriptionGated).toBe(true);
	});

	it("un-greys b-plot's Description button once CHANNEL is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		expect(specialGroup(data).moves.find((m) => m.key === "b-plot").descriptionGated).toBe(false);
	});

	it("never greys out weave magic's Description button, unlike b-plot", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		const weaveMagic = data.moveGroups[0].moves.find((m) => m.key === "weave-magic");
		expect(weaveMagic.gated).toBe(true);
		expect(weaveMagic.descriptionGated).toBe(false);
	});

	it("gates bite the dust's Roll button once Never Quite Free is picked, with a tooltip explaining why", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: {}, attributes: { playbookMoves: [NEVER_QUITE_FREE.key] } }
		};

		const data = sheet.getData();

		const biteTheDust = data.moveGroups[0].moves.find((m) => m.key === "bite-the-dust");
		expect(biteTheDust.gated).toBe(true);
		expect(biteTheDust.gatedTooltip).toBe("Replaced by Never Quite Free");
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

describe("PlaybookActorSheet#activateListeners - moves", () => {
	it("binds click handlers to the move roll and description buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".move-roll");
		expect(html.find).toHaveBeenCalledWith(".move-activate");
		expect(html.find).toHaveBeenCalledWith(".move-description");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_moveTraits", () => {
	it("leaves a non-crew fixedTrait untouched", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };
		const move = { traits: [], fixedTraits: [{ key: "cargo", label: "CARGO", value: 3 }] };

		expect(sheet._moveTraits(move)).toEqual([{ key: "cargo", label: "CARGO", value: 3 }]);
	});

	it("offers +CHANNEL on any move when piloted with Input Channel installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 2, disabled: true } },
				attributes: { astir: { id: "a1", parts: [INPUT_CHANNEL.key], piloted: true } }
			}
		};
		const move = { traits: ["clash"] };

		expect(sheet._moveTraits(move)).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "channel", label: "CHANNEL", value: 2 }
		]);
	});

	it("does not offer +CHANNEL when not piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 2, disabled: true } },
				attributes: { astir: { id: "a1", parts: [INPUT_CHANNEL.key], piloted: false } }
			}
		};

		expect(sheet._moveTraits({ traits: ["clash"] })).toEqual([{ key: "clash", label: "CLASH", value: 1 }]);
	});

	it("does not offer +CHANNEL without Input Channel installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 2, disabled: true } },
				attributes: { astir: { id: "a1", parts: [], piloted: true } }
			}
		};

		expect(sheet._moveTraits({ traits: ["clash"] })).toEqual([{ key: "clash", label: "CLASH", value: 1 }]);
	});

	it("treats a missing channel stat value as 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [INPUT_CHANNEL.key], piloted: true } }
			}
		};

		expect(sheet._moveTraits({ traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "channel", label: "CHANNEL", value: 0 }
		]);
	});

	it("does not add a second CHANNEL entry when the move already rolls it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 2, disabled: false } },
				attributes: { astir: { id: "a1", parts: [INPUT_CHANNEL.key], piloted: true } }
			}
		};

		expect(sheet._moveTraits({ traits: ["channel"] })).toEqual([{ key: "channel", label: "CHANNEL", value: 2 }]);
	});

	it("offers +TALK on Read the Room when Facilitator is picked (addsTraitToMove)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 1 }, talk: { value: 2 } },
				attributes: { playbookMoves: [FACILITATOR.key] }
			}
		};
		const readTheRoom = { key: "read-the-room", traits: ["sense"] };

		expect(sheet._moveTraits(readTheRoom)).toEqual([
			{ key: "sense", label: "SENSE", value: 1 },
			{ key: "talk", label: "TALK", value: 2 }
		]);
	});

	it("does not add +TALK to a different move just because Facilitator is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, talk: { value: 2 } },
				attributes: { playbookMoves: [FACILITATOR.key] }
			}
		};

		expect(sheet._moveTraits({ key: "exchange-blows", traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 }
		]);
	});

	it("leaves Read the Room's traits untouched without Facilitator picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { sense: { value: 1 }, talk: { value: 2 } }, attributes: { playbookMoves: [] } }
		};
		const readTheRoom = { key: "read-the-room", traits: ["sense"] };

		expect(sheet._moveTraits(readTheRoom)).toEqual([{ key: "sense", label: "SENSE", value: 1 }]);
	});

	it("does not add a second TALK entry when the target move already rolls it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { talk: { value: 2 } },
				attributes: { playbookMoves: [FACILITATOR.key] }
			}
		};

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["talk"] })).toEqual([
			{ key: "talk", label: "TALK", value: 2 }
		]);
	});

	it("treats a missing talk stat value as 0 for an added trait", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { sense: { value: 1 } }, attributes: { playbookMoves: [FACILITATOR.key] } }
		};

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["sense"] })).toEqual([
			{ key: "sense", label: "SENSE", value: 1 },
			{ key: "talk", label: "TALK", value: 0 }
		]);
	});

	it("offers +CHANNEL on both Exchange Blows and Strike Decisively when Turn Unearthly is picked (addsTraitToMove.moveKeys)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 3 } },
				attributes: { playbookMoves: [TURN_UNEARTHLY.key] }
			}
		};

		expect(sheet._moveTraits({ key: "exchange-blows", traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "channel", label: "CHANNEL", value: 3 }
		]);
		expect(sheet._moveTraits({ key: "strike-decisively", traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "channel", label: "CHANNEL", value: 3 }
		]);
	});

	it("does not add +CHANNEL to an unrelated move just because Turn Unearthly is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 1 }, channel: { value: 3 } },
				attributes: { playbookMoves: [TURN_UNEARTHLY.key] }
			}
		};

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["sense"] })).toEqual([
			{ key: "sense", label: "SENSE", value: 1 }
		]);
	});
});

describe("PlaybookActorSheet#_onMoveActivate", () => {
	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "not-a-real-move" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for a move with no flat hold to grant, e.g. lead a sortie", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(postMoveDescription).not.toHaveBeenCalled();
	});

	it("adds b-plot's flat hold to its own moveHold pool", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 3 });
		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, B_PLOT);
	});

	it("adds to, rather than replaces, an existing moveHold value", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 1 } } } }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 3 });
	});

	it("clamps at the maximum and does not update the actor", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 3 } } } }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, B_PLOT);
	});

	it("does not affect the shared resources.hold field", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: {}, resources: { hold: { value: 5 } } },
			update: vi.fn()
		};

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(sheet.actor.update).not.toHaveBeenCalledWith(expect.objectContaining({
			"system.resources.hold.value": expect.anything()
		}));
	});

	it("keeps a different flatHold move's pool untouched when activating this one", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveHold: { "b-plot": { value: 2 } } } },
			update: vi.fn()
		};

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "soldier:get-out-of-my-way" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.soldier:get-out-of-my-way.value": 3
		});
	});

	it("posts Read the Room's real question list to chat and checks Expended, for Divination Codex", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: DIVINATION_CODEX.key } } });

		expect(ChatMessage.create).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "<h3>Divination Codex</h3>",
			content: `<ul>${READ_THE_ROOM.questions.map((question) => `<li>${question}</li>`).join("")}</ul>`
		});
		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${DIVINATION_CODEX.key}.expended`]: true
		});
		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, DIVINATION_CODEX);
	});

	it("posts the move's own prompt and options to chat for an activateChoices move (Bureaucrat)", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: BUREAUCRAT.key } } });

		expect(ChatMessage.create).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "<h3>Bureaucrat</h3>",
			content: `<p>${BUREAUCRAT.activateChoices.prompt}</p>` +
				`<ul>${BUREAUCRAT.activateChoices.options.map((option) => `<li>${option}</li>`).join("")}</ul>`
		});
		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, BUREAUCRAT);
	});
});

describe("PlaybookActorSheet#_onMoveDescription", () => {
	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "not-a-real-move" } } });

		expect(postMoveDescription).not.toHaveBeenCalled();
	});

	it("posts the move's description to chat", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS);
	});

	it("finds a special move (subsystems) by key, same as a basic move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "subsystems" } } });

		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, SUBSYSTEMS);
	});

	it("finds a playbook move by its pool-prefixed key, same as a basic move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: BULLHEADED.key } } });

		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, BULLHEADED);
	});

	it("posts b-plot's description even when it's gated (CHANNEL enabled)", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, B_PLOT);
	});
});
