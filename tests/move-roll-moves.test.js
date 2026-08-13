import { beforeEach, describe, expect, it, vi } from "vitest";

import { DIE_FACES } from "../scripts/moves/roll-effects.js";
import { TRAITS } from "../scripts/core/traits.js";
import { BASIC_MOVES, MOVE_CHAT_TEMPLATE, SPECIAL_MOVES, availableMoveTraits, rollMove } from "../scripts/moves/moves.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { mockRoll } from "./helpers/move-test-helpers.js";

// The one real move carrying fixedTraits alongside Lead a Sortie's own CREW — a flat, hardcoded
// "Roll +3" with no actor-stat lookup at all (see playbook-moves.js).
const I_KNOW_YOU = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-revenant:i-know-you");
const DISPEL_UNCERTAINTIES = BASIC_MOVES.find((m) => m.key === "dispel-uncertainties");
const HELP_OR_HINDER = BASIC_MOVES.find((m) => m.key === "help-or-hinder");
const WEAVE_MAGIC = BASIC_MOVES.find((m) => m.key === "weave-magic");
const LEAD_A_SORTIE = SPECIAL_MOVES.find((m) => m.key === "lead-a-sortie");

beforeEach(() => {
	vi.resetAllMocks();
	// resetAllMocks wipes the default Dialog/Roll implementations stubbed in tests/setup.js.
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
		this.close = vi.fn(() => this.data.close?.());
	});
	mockRoll();
	renderTemplate.mockResolvedValue("");
});

describe("rollMove - dispel uncertainties and weave magic", () => {
	it("rolls 2d6 plus the KNOW value for dispel uncertainties", async () => {
		const actor = { system: { stats: { know: { value: 2 } } } };
		const know = TRAITS.find((t) => t.key === "know");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, DISPEL_UNCERTAINTIES, know);

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 2 });
	});

	it("rolls 2d6 plus the CHANNEL value for weave magic", async () => {
		const actor = { system: { stats: { channel: { value: 1 } } } };
		const channel = TRAITS.find((t) => t.key === "channel");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, WEAVE_MAGIC, channel);

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 1 });
	});
});

describe("rollMove - lead a sortie", () => {
	it("resolves KNOW and DEFY as normal, actor-backed traits", () => {
		const actor = { system: { stats: { know: { value: 1 }, defy: { value: 2 } } } };

		const traits = availableMoveTraits(actor, LEAD_A_SORTIE);

		expect(traits).toEqual([TRAITS.find((t) => t.key === "know"), TRAITS.find((t) => t.key === "defy")]);
	});

	it("rolls 2d6 plus the KNOW or DEFY value like any other trait", async () => {
		const actor = { system: { stats: { know: { value: 2 }, defy: { value: -1 } } } };
		const know = TRAITS.find((t) => t.key === "know");
		const defy = TRAITS.find((t) => t.key === "defy");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, LEAD_A_SORTIE, know);
		expect(Roll).toHaveBeenLastCalledWith(`2d${DIE_FACES} + @mod`, { mod: 2 });

		await rollMove(actor, LEAD_A_SORTIE, defy);
		expect(Roll).toHaveBeenLastCalledWith(`2d${DIE_FACES} + @mod`, { mod: -1 });
	});

	it("rolls the CREW fixed trait's own value rather than any actor stat", async () => {
		// crew is deliberately set on the actor's stats to prove it's ignored — CREW is a fixed
		// placeholder (see SPECIAL_MOVES), never looked up on the actor.
		const actor = { system: { stats: { crew: { value: 99 } } } };
		const crew = { key: "crew", label: "CREW", value: 0 };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, LEAD_A_SORTIE, crew);

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 0 });
	});
});

describe("rollMove - I Know You (flat +3 FAMILIARITY, no actor stat)", () => {
	it("rolls the FAMILIARITY fixed trait's own +3 value rather than any actor stat", async () => {
		// familiarity is deliberately absent from actor.system.stats entirely — a fixedTraits value
		// is never looked up on the actor, same as Lead a Sortie's own CREW above.
		const actor = { system: { stats: {} } };
		const familiarity = { key: "familiarity", label: "FAMILIARITY", value: 3 };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, I_KNOW_YOU, familiarity);

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 3 });
	});

	it("shows a +FAMILIARITY badge on the chat card, the same trait?.label path Lead a Sortie's CREW badge uses", async () => {
		const actor = { system: { stats: {} } };
		const familiarity = { key: "familiarity", label: "FAMILIARITY", value: 3 };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, I_KNOW_YOU, familiarity);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			traitLabel: "FAMILIARITY"
		}));
	});
});

describe("rollMove - help or hinder", () => {
	it("rolls with no base value when no conditions are checked", async () => {
		const actor = { system: { stats: {} } };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, HELP_OR_HINDER, undefined, {});

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 0 });
	});

	it("adds +1 per checked condition", async () => {
		const actor = { system: { stats: {} } };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, HELP_OR_HINDER, undefined, { conditions: ["downtime", "hook"] });

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 2 });
	});

	it("passes no trait label but the chosen intent's label to the chat template", async () => {
		const actor = { system: { stats: {} } };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		const help = HELP_OR_HINDER.intents.find((i) => i.key === "help");

		await rollMove(actor, HELP_OR_HINDER, undefined, { intent: help });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			traitLabel: null,
			intentLabel: "Help"
		}));
	});

	it("includes the checked condition labels alongside advantage/effect conditions in the chat template", async () => {
		const actor = { system: { stats: {} } };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, HELP_OR_HINDER, undefined, { conditions: ["hook"], advantage: "advantage" });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			conditions: [
				{ key: "advantage", label: "Advantage" },
				{ key: "hook", label: "They're part of one of your Hooks" }
			]
		}));
	});
});
