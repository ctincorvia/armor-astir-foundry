import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRAITS } from "../scripts/core/traits.js";
import { MOVE_CHAT_TEMPLATE, MOVE_RESULT_LABELS, rollMove } from "../scripts/moves/moves.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const COMBAT_ENGINEER = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-artificer:combat-engineer");
const REFINED_RITUALS = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-artificer:refined-rituals");
const JURY_RIGGER = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-artificer:jury-rigger");
const ARCANE_GENERATOR = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-artificer:arcane-generator");

// Same fixed-dice-results seeding moves.test.js uses (see its own mockRoll) — the real,
// unmocked rollMove from moves.js derives its total from these dice plus the trait value, so
// this is the standard way to force a specific result tier.
function mockRoll(dice) {
	Roll.mockImplementation(function (formula, data) {
		this.formula = formula;
		this.data = data;
		this._total = 0;
		this.terms = [];
		this.dice = [{ results: dice.map((value) => ({ result: value, active: true })), modifiers: [] }];
		this.evaluate = vi.fn().mockImplementation(async () => this);
		this.toMessage = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(this, "total", { get: () => this._total, configurable: true });
	});
}

beforeEach(() => {
	mockRoll([3, 3]);
	renderTemplate.mockClear();
	renderTemplate.mockResolvedValue("");
	ChatMessage.getSpeaker.mockClear();
});

describe("PlaybookActorSheet#getData - tier bonus (Combat Engineer)", () => {
	it("adds Combat Engineer's tierBonus on top of base Tier while on foot", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [COMBAT_ENGINEER.key] } } };

		expect(sheet.getData().tier).toEqual({ base: 2, effective: 2, fromFrame: false });
	});
});

describe("PlaybookActorSheet - Refined Rituals' flatHold pool", () => {
	it("reads its hold from its own moveHold pool, keyed by its own move key", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					moveHold: { [REFINED_RITUALS.key]: { value: 2 } },
					playbookMoves: [REFINED_RITUALS.key]
				}
			}
		};

		const data = sheet.getData();
		const playbookGroup = data.moveGroups.find((g) => g.label === "Playbook Moves");

		expect(playbookGroup.moves.find((m) => m.key === REFINED_RITUALS.key).hold).toBe(2);
	});

	it("grants its flat hold via Activate, additive on top of any existing hold", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveHold: { [REFINED_RITUALS.key]: { value: 0 } } } },
			update: vi.fn()
		};

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: REFINED_RITUALS.key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveHold.${REFINED_RITUALS.key}.value`]: 3
		});
	});
});

describe("rollMove - Jury-Rigger and Arcane Generator result text (standard tiered rolls, no new mechanic)", () => {
	it("renders Jury-Rigger's Choose 3/Choose 2 text for a 10+ and a 7-9", async () => {
		const actor = { system: { stats: { know: { value: 0 } } } };
		const know = TRAITS.find((t) => t.key === "know");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll([5, 5]);
		await rollMove(actor, JURY_RIGGER, know);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "success",
			tierLabel: MOVE_RESULT_LABELS.success,
			resultText: JURY_RIGGER.results.success
		}));

		mockRoll([4, 4]);
		await rollMove(actor, JURY_RIGGER, know);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "mixed",
			tierLabel: MOVE_RESULT_LABELS.mixed,
			resultText: JURY_RIGGER.results.mixed
		}));
	});

	it("renders Arcane Generator's create-object text for a 10+ and its Choose 1 text for a 7-9", async () => {
		const actor = { system: { stats: { know: { value: 0 } } } };
		const know = TRAITS.find((t) => t.key === "know");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll([5, 5]);
		await rollMove(actor, ARCANE_GENERATOR, know);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "success",
			tierLabel: MOVE_RESULT_LABELS.success,
			resultText: ARCANE_GENERATOR.results.success
		}));

		mockRoll([4, 4]);
		await rollMove(actor, ARCANE_GENERATOR, know);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "mixed",
			tierLabel: MOVE_RESULT_LABELS.mixed,
			resultText: ARCANE_GENERATOR.results.mixed
		}));
	});
});
