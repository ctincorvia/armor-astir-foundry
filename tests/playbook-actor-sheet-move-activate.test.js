import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	postMoveDescription: vi.fn(),
	showMoveDescription: vi.fn(),
	configureVariableDiceRoll: vi.fn(),
	rollVariableDicePool: vi.fn()
}));

import { PLAYBOOKS } from "../scripts/actor-creation.js";
import {
	BASIC_MOVES,
	SPECIAL_MOVES,
	configureVariableDiceRoll,
	postMoveDescription,
	rollVariableDicePool,
	showMoveDescription
} from "../scripts/moves/moves.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { ASTIR_PART_CATALOG } from "../scripts/frames/astir.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const READ_THE_ROOM = BASIC_MOVES.find((m) => m.key === "read-the-room");
const SUBSYSTEMS = SPECIAL_MOVES.find((m) => m.key === "subsystems");
const B_PLOT = SPECIAL_MOVES.find((m) => m.key === "b-plot");
const BULLHEADED = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:bullheaded");
const DIVINATION_CODEX = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:divination-codex");
const BUREAUCRAT = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-diplomat:bureaucrat");
const PLAN_AND_PREPARE = SPECIAL_MOVES.find((m) => m.key === "plan-and-prepare");
const ENDURING_SUPPORT = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-summoner:enduring-support");

beforeEach(() => {
	postMoveDescription.mockClear();
	showMoveDescription.mockClear();
	configureVariableDiceRoll.mockClear();
	rollVariableDicePool.mockClear();
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
		expect(html.find).toHaveBeenCalledWith(".move-info");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
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

	it("does nothing for Enduring Support with no ally summoned", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { boundAllies: [] } }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: ENDURING_SUPPORT.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(postMoveDescription).not.toHaveBeenCalled();
	});

	it("does nothing for Enduring Support when the summoned ally has no approach set", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			},
			update: vi.fn()
		};

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: ENDURING_SUPPORT.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(postMoveDescription).not.toHaveBeenCalled();
	});

	it("snapshots the summoned ally's approach into approachOverride and posts the description", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", approach: "profane" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			},
			update: vi.fn()
		};

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: ENDURING_SUPPORT.key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.approachOverride": { approach: "profane" }
		});
		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, ENDURING_SUPPORT);
	});
});

describe("PlaybookActorSheet#_moveGroupMoves - Enduring Support's Activate button", () => {
	it("is activatable, and gated with no ally summoned", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { boundAllies: [] } } };

		const [entry] = sheet._moveGroupMoves([ENDURING_SUPPORT]);

		expect(entry.activatable).toBe(true);
		expect(entry.gated).toBe(true);
	});

	it("is gated when the summoned ally has no approach set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			}
		};

		const [entry] = sheet._moveGroupMoves([ENDURING_SUPPORT]);

		expect(entry.gated).toBe(true);
	});

	it("is ungated once a summoned ally with a real approach exists", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", approach: "profane" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			}
		};

		const [entry] = sheet._moveGroupMoves([ENDURING_SUPPORT]);

		expect(entry.gated).toBe(false);
	});

	it("omits approachOverrideInfo entirely with no active override", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: {} } };

		const [entry] = sheet._moveGroupMoves([ENDURING_SUPPORT]);

		expect("approachOverrideInfo" in entry).toBe(false);
	});

	it("includes approachOverrideInfo with the resolved Approach label once an override is active", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { approachOverride: { approach: "profane" } }
			}
		};

		const [entry] = sheet._moveGroupMoves([ENDURING_SUPPORT]);

		expect(entry.approachOverrideInfo).toEqual({ approachLabel: "Profane" });
	});

	it("falls back to the raw key in approachOverrideInfo when it doesn't match a known APPROACHES entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { approachOverride: { approach: "not-a-real-approach" } }
			}
		};

		const [entry] = sheet._moveGroupMoves([ENDURING_SUPPORT]);

		expect(entry.approachOverrideInfo).toEqual({ approachLabel: "not-a-real-approach" });
	});

	it("omits approachOverrideInfo for an ordinary move even with an active override", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { approachOverride: { approach: "profane" } }
			}
		};

		const [entry] = sheet._moveGroupMoves([BULLHEADED]);

		expect("approachOverrideInfo" in entry).toBe(false);
	});
});

describe("PlaybookActorSheet#_onVariableDiceRoll", () => {
	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onVariableDiceRoll({ currentTarget: { dataset: { move: "not-a-real-move" } } });

		expect(configureVariableDiceRoll).not.toHaveBeenCalled();
	});

	it("looks up the move in ALL_MOVES by its data-move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };
		configureVariableDiceRoll.mockResolvedValue(null);

		await sheet._onVariableDiceRoll({ currentTarget: { dataset: { move: "plan-and-prepare" } } });

		expect(configureVariableDiceRoll).toHaveBeenCalledWith(PLAN_AND_PREPARE);
	});

	it("never calls rollVariableDicePool when the dialog resolves null (Cancel/close)", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };
		configureVariableDiceRoll.mockResolvedValue(null);

		await sheet._onVariableDiceRoll({ currentTarget: { dataset: { move: "plan-and-prepare" } } });

		expect(rollVariableDicePool).not.toHaveBeenCalled();
	});

	it("rolls the dice pool with the actor, the move, and the dialog's resolved config", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };
		const config = { target: 3, extraDice: 1 };
		configureVariableDiceRoll.mockResolvedValue(config);

		await sheet._onVariableDiceRoll({ currentTarget: { dataset: { move: "plan-and-prepare" } } });

		expect(rollVariableDicePool).toHaveBeenCalledWith(sheet.actor, PLAN_AND_PREPARE, config);
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

describe("PlaybookActorSheet#_onMoveInfo", () => {
	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveInfo({ currentTarget: { dataset: { move: "not-a-real-move" } } });

		expect(showMoveDescription).not.toHaveBeenCalled();
	});

	it("shows the move's description privately, without posting to chat", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveInfo({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(showMoveDescription).toHaveBeenCalledWith(EXCHANGE_BLOWS);
		expect(postMoveDescription).not.toHaveBeenCalled();
	});

	it("finds a special move (subsystems) by key, same as a basic move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveInfo({ currentTarget: { dataset: { move: "subsystems" } } });

		expect(showMoveDescription).toHaveBeenCalledWith(SUBSYSTEMS);
	});

	it("finds a playbook move by its pool-prefixed key, same as a basic move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveInfo({ currentTarget: { dataset: { move: BULLHEADED.key } } });

		expect(showMoveDescription).toHaveBeenCalledWith(BULLHEADED);
	});

	it("shows b-plot's description even when it's gated (CHANNEL enabled)", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveInfo({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(showMoveDescription).toHaveBeenCalledWith(B_PLOT);
	});
});
