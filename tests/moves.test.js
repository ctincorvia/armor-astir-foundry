import { beforeEach, describe, expect, it, vi } from "vitest";

import { DIE_FACES, EFFECT_STATES, NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS, effectState } from "../scripts/moves/roll-effects.js";
import { TRAITS } from "../scripts/core/traits.js";
import {
	BASIC_MOVES,
	FAILURE_REMINDERS,
	MOVE_CHAT_TEMPLATE,
	MOVE_RESULT_LABELS,
	SPECIAL_MOVES,
	availableMoveTraits,
	buildReminders,
	configureMoveRoll,
	explodeSixes,
	moveResultTier,
	postGuidedResult,
	postMoveDescription,
	rollMove
} from "../scripts/moves/moves.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
// The one real move carrying separateHold — a roll-tiered hold grant routed into its own
// per-move pool instead of the shared system.resources.hold field (see playbook-moves.js).
const MOBILITY = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-scout:mobility");
// The one real move carrying fixedTraits alongside Lead a Sortie's own CREW — a flat, hardcoded
// "Roll +3" with no actor-stat lookup at all (see playbook-moves.js).
const I_KNOW_YOU = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-revenant:i-know-you");
const WEATHER_THE_STORM = BASIC_MOVES.find((m) => m.key === "weather-the-storm");
const READ_THE_ROOM = BASIC_MOVES.find((m) => m.key === "read-the-room");
const DISPEL_UNCERTAINTIES = BASIC_MOVES.find((m) => m.key === "dispel-uncertainties");
const HELP_OR_HINDER = BASIC_MOVES.find((m) => m.key === "help-or-hinder");
const WEAVE_MAGIC = BASIC_MOVES.find((m) => m.key === "weave-magic");
const BITE_THE_DUST = BASIC_MOVES.find((m) => m.key === "bite-the-dust");
const LEAD_A_SORTIE = SPECIAL_MOVES.find((m) => m.key === "lead-a-sortie");
const SUBSYSTEMS = SPECIAL_MOVES.find((m) => m.key === "subsystems");
const B_PLOT = SPECIAL_MOVES.find((m) => m.key === "b-plot");

// checkedConditions/checkedEquipmentTags/checkedAstirPartSpends fake the jQuery
// `.find("[name='...']:checked").map(...).get()` chains configureMoveRoll uses to collect Help or
// Hinder's checkbox values, equipment spends, and Astir Part spends.
function fakeRollHtml(values, checkedConditions = [], checkedEquipmentTags = [], checkedAstirPartSpends = []) {
	return {
		find: (selector) => {
			if (selector === "[name='condition']:checked") {
				return { map: (fn) => ({ get: () => checkedConditions.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === "[name='equipment-tag']:checked") {
				return { map: (fn) => ({ get: () => checkedEquipmentTags.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === "[name='astir-part-spend']:checked") {
				return { map: (fn) => ({ get: () => checkedAstirPartSpends.map((value, index) => fn(index, { value })) }) };
			}
			return { val: () => values[selector] };
		}
	};
}

// Seeds the die's raw results (pre-substitution/keep) so rollMove's real, unmocked
// applyRollEffects computes the total exactly as it would in production — there is no `total`
// to inject directly any more, since rollMove derives it from the dice breakdown + trait value.
function mockRoll({ dice = [3, 3] } = {}) {
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

// mockRoll above replaces Roll.mockImplementation with one fixed implementation shared by *every*
// `new Roll(...)` call, which breaks down once a test needs the initial pool roll and one-or-more
// later explosion rolls (see moves.js#explodeSixes) to return *different* results. This queues one
// Roll.mockImplementationOnce per array entry — consumed strictly in call order, so entry 0 is the
// first `new Roll(...)` a test triggers (the initial pool, when testing through rollMove) and each
// subsequent entry is one explosion die.
function mockRollSequence(diceSets) {
	for (const dice of diceSets) {
		Roll.mockImplementationOnce(function (formula, data) {
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
}

beforeEach(() => {
	vi.resetAllMocks();
	// resetAllMocks wipes the default Dialog/Roll implementations stubbed in tests/setup.js.
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
	});
	mockRoll();
	renderTemplate.mockResolvedValue("");
});

describe("moveResultTier", () => {
	it("treats 10 and above as a success", () => {
		expect(moveResultTier(10)).toBe("success");
		expect(moveResultTier(12)).toBe("success");
	});

	it("treats 7-9 as a mixed success", () => {
		expect(moveResultTier(7)).toBe("mixed");
		expect(moveResultTier(9)).toBe("mixed");
	});

	it("treats 6 and below as a failure", () => {
		expect(moveResultTier(6)).toBe("failure");
		expect(moveResultTier(2)).toBe("failure");
	});
});

describe("availableMoveTraits", () => {
	it("resolves each trait key to its TRAITS entry", () => {
		const actor = { system: { stats: { clash: { value: 1 }, talk: { value: 2 } } } };

		const traits = availableMoveTraits(actor, EXCHANGE_BLOWS);

		expect(traits).toEqual([TRAITS.find((t) => t.key === "clash"), TRAITS.find((t) => t.key === "talk")]);
	});

	it("excludes traits disabled on the actor's stats", () => {
		const actor = { system: { stats: { clash: { value: 1, disabled: true }, talk: { value: 2 } } } };

		const traits = availableMoveTraits(actor, EXCHANGE_BLOWS);

		expect(traits).toEqual([TRAITS.find((t) => t.key === "talk")]);
	});

	it("excludes traits missing from the actor's stats entirely", () => {
		const actor = { system: { stats: {} } };

		const traits = availableMoveTraits(actor, EXCHANGE_BLOWS);

		expect(traits).toEqual([TRAITS.find((t) => t.key === "clash"), TRAITS.find((t) => t.key === "talk")]);
	});

	it("resolves all three traits for weather-the-storm", () => {
		const actor = { system: { stats: { defy: { value: 1 }, know: { value: 2 }, sense: { value: 3 } } } };

		const traits = availableMoveTraits(actor, WEATHER_THE_STORM);

		expect(traits).toEqual([
			TRAITS.find((t) => t.key === "defy"),
			TRAITS.find((t) => t.key === "know"),
			TRAITS.find((t) => t.key === "sense")
		]);
	});

	it("resolves no traits for b-plot, which rolls nothing by design", () => {
		const actor = { system: { stats: {} } };

		const traits = availableMoveTraits(actor, B_PLOT);

		expect(traits).toEqual([]);
	});
});

describe("SPECIAL_MOVES - b-plot", () => {
	it("scopes its flat hold pool to the Sortie, for PlaybookActorSheet#_onRefreshSortie", () => {
		expect(B_PLOT.period).toBe("Sortie");
	});
});

describe("configureMoveRoll", () => {
	const clash = { key: "clash", label: "CLASH", value: 1 };
	const talk = { key: "talk", label: "TALK", value: 2 };

	it("renders the roll dialog template with the given traits and modifier states", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			traits: [clash],
			advantageStates: expect.any(Array),
			effectStates: expect.any(Array)
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves the selected trait, advantage, and effect when Roll is clicked", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash, talk]);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "talk",
			"[name='advantage']": "advantage",
			"[name='effect']": "confidence"
		}));

		expect(await promise).toEqual({ trait: talk, advantage: "advantage", effect: "confidence" });
	});

	it("resolves null when Cancel is clicked", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.cancel.callback();

		expect(await promise).toBeNull();
	});

	it("resolves null when the dialog is closed without a selection", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.close();

		expect(await promise).toBeNull();
	});
});

describe("BASIC_MOVES - bite the dust", () => {
	it("declares forcesDesperationAtMaxPerils, so PlaybookActorSheet locks Desperation at max Perils", () => {
		expect(BITE_THE_DUST.forcesDesperationAtMaxPerils).toBe(true);
	});

	it("is the only basic move that forces Desperation", () => {
		const forcing = BASIC_MOVES.filter((move) => move.forcesDesperationAtMaxPerils);
		expect(forcing).toEqual([BITE_THE_DUST]);
	});
});

describe("configureMoveRoll - lockedEffect", () => {
	const clash = { key: "clash", label: "CLASH", value: 1 };

	it("passes a null lockedEffect and lockedEffectLabel to the dialog template by default", async () => {
		const promise = configureMoveRoll(BITE_THE_DUST, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			lockedEffect: null,
			lockedEffectLabel: null
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("passes the given lockedEffect and its display label to the dialog template", async () => {
		const promise = configureMoveRoll(BITE_THE_DUST, [clash], { lockedEffect: "desperation" });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			lockedEffect: "desperation",
			lockedEffectLabel: "Desperation"
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("labels a Confidence lockedEffect (Field Scout's grantsEffectOnMove) correctly too", async () => {
		const promise = configureMoveRoll(BITE_THE_DUST, [clash], { lockedEffect: "confidence" });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			lockedEffectLabel: "Confidence"
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("forces the resolved effect to lockedEffect regardless of what the (disabled) select reports", async () => {
		const promise = configureMoveRoll(BITE_THE_DUST, [clash], { lockedEffect: "desperation" });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}));

		expect(await promise).toEqual({ trait: clash, advantage: "none", effect: "desperation" });
	});
});

describe("configureMoveRoll - lockedAdvantage", () => {
	const clash = { key: "clash", label: "CLASH", value: 1 };

	it("passes a null lockedAdvantage and lockedAdvantageLabel to the dialog template by default", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			lockedAdvantage: null,
			lockedAdvantageLabel: null
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("passes the given lockedAdvantage and its display label to the dialog template", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { lockedAdvantage: "advantage" });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			lockedAdvantage: "advantage",
			lockedAdvantageLabel: "Advantage"
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("forces the resolved advantage to lockedAdvantage regardless of what the (disabled) select reports", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { lockedAdvantage: "advantage" });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}));

		expect((await promise).advantage).toBe("advantage");
	});

	it("lets a spent Astir Part's advantage (Artifact) win over lockedAdvantage", async () => {
		const spend = {
			partKey: "astir-part:artifact", partName: "Artifact", description: "d", effect: null, advantage: "advantage2", disabled: false
		};
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { lockedAdvantage: "advantage", astirPartSpends: [spend] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, [], [], ["astir-part:artifact"]));

		expect((await promise).advantage).toBe("advantage2");
	});
});

describe("configureMoveRoll - intents and conditions", () => {
	it("passes the move's intents and conditions to the dialog template", async () => {
		const promise = configureMoveRoll(HELP_OR_HINDER, []);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			traits: [],
			intents: HELP_OR_HINDER.intents,
			conditions: HELP_OR_HINDER.conditions
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves the chosen intent and checked conditions when Roll is clicked", async () => {
		const promise = configureMoveRoll(HELP_OR_HINDER, []);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='intent']": "help",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, ["downtime", "hook"]));

		expect(await promise).toEqual({
			intent: HELP_OR_HINDER.intents.find((i) => i.key === "help"),
			conditions: ["downtime", "hook"],
			advantage: "none",
			effect: "none"
		});
	});

	it("does not add intent or conditions keys for moves that don't define them", async () => {
		const clash = { key: "clash", label: "CLASH", value: 1 };
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}));

		expect(await promise).toEqual({ trait: clash, advantage: "none", effect: "none" });
	});
});

describe("configureMoveRoll - equipment spends", () => {
	const clash = { key: "clash", label: "CLASH", value: 1 };
	const blitzSpend = {
		equipmentId: "eq1",
		equipmentName: "Halberd",
		tagKey: "blitz",
		tagLabel: "Blitz",
		description: "You may spend this tag once per Scene to make a move with confidence.",
		effect: "confidence",
		disabled: false
	};

	it("passes the offered equipment spends to the dialog template", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { equipmentSpends: [blitzSpend] });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			equipmentSpends: [blitzSpend]
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("defaults equipmentSpends to an empty list", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			equipmentSpends: []
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves checked equipment spends as {equipmentId, tagKey} pairs", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { equipmentSpends: [blitzSpend] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, [], ["eq1::blitz"]));

		expect(await promise).toEqual({
			trait: clash,
			advantage: "none",
			effect: "confidence",
			spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }]
		});
	});

	it("sets the roll's effect from a checked spend, regardless of the Effect select's own value", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { equipmentSpends: [blitzSpend] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "desperation"
		}, [], ["eq1::blitz"]));

		expect((await promise).effect).toBe("confidence");
	});

	it("lets lockedEffect win over a checked spend", async () => {
		const promise = configureMoveRoll(BITE_THE_DUST, [clash], { lockedEffect: "desperation", equipmentSpends: [blitzSpend] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, [], ["eq1::blitz"]));

		expect((await promise).effect).toBe("desperation");
	});

	it("takes the later checked spend's effect on a collision", async () => {
		const desperationSpend = { ...blitzSpend, equipmentId: "eq2", tagKey: "grimdark", effect: "desperation" };
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { equipmentSpends: [blitzSpend, desperationSpend] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, [], ["eq1::blitz", "eq2::grimdark"]));

		expect((await promise).effect).toBe("desperation");
	});

	it("resolves an empty spentTags list, and falls back to the Effect select, when spends were offered but none were checked", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { equipmentSpends: [blitzSpend] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}));

		expect(await promise).toEqual({ trait: clash, advantage: "none", effect: "none", spentTags: [] });
	});

	it("does not add a spentTags key when no equipment was offered", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}));

		expect(await promise).toEqual({ trait: clash, advantage: "none", effect: "none" });
	});
});

describe("configureMoveRoll - astir part spends", () => {
	const clash = { key: "clash", label: "CLASH", value: 1 };
	const wardingSpend = {
		partKey: "astir-part:warding",
		partName: "Warding",
		description: "Reduce an incoming source of harm from a peril to a risk, or a risk to nothing.",
		effect: null,
		advantage: null,
		disabled: false
	};
	const artifactSpend = {
		partKey: "astir-part:artifact",
		partName: "Artifact",
		description: "Grants advantage towards a task this Artifact is designed for.",
		effect: null,
		advantage: "advantage",
		disabled: false
	};

	it("passes the offered astir part spends to the dialog template", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { astirPartSpends: [wardingSpend] });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			astirPartSpends: [wardingSpend]
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("defaults astirPartSpends to an empty list", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			astirPartSpends: []
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves checked astir part spends as a plain array of part keys", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { astirPartSpends: [wardingSpend] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, [], [], ["astir-part:warding"]));

		expect(await promise).toEqual({
			trait: clash,
			advantage: "none",
			effect: "none",
			spentParts: ["astir-part:warding"]
		});
	});

	it("sets the roll's Advantage from a checked spend's advantage, regardless of the Dice select's own value", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { astirPartSpends: [artifactSpend] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "disadvantage",
			"[name='effect']": "none"
		}, [], [], ["astir-part:artifact"]));

		expect((await promise).advantage).toBe("advantage");
	});

	it("sets the roll's effect from a checked spend's effect, same precedence as an equipment spend", async () => {
		const spend = { ...wardingSpend, effect: "confidence" };
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { astirPartSpends: [spend] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "desperation"
		}, [], [], ["astir-part:warding"]));

		expect((await promise).effect).toBe("confidence");
	});

	it("lets lockedEffect win over a checked part's effect", async () => {
		const spend = { ...wardingSpend, effect: "confidence" };
		const promise = configureMoveRoll(BITE_THE_DUST, [clash], { lockedEffect: "desperation", astirPartSpends: [spend] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, [], [], ["astir-part:warding"]));

		expect((await promise).effect).toBe("desperation");
	});

	it("resolves an empty spentParts list when spends were offered but none were checked", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { astirPartSpends: [wardingSpend] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}));

		expect(await promise).toEqual({ trait: clash, advantage: "none", effect: "none", spentParts: [] });
	});

	it("does not add a spentParts key when no astir part was offered", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}));

		expect(await promise).toEqual({ trait: clash, advantage: "none", effect: "none" });
	});
});

describe("configureMoveRoll - guided", () => {
	const clash = { key: "clash", label: "CLASH", value: 1 };

	it("passes guided through to the dialog template", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { guided: true });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			guided: true
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("defaults guided to false", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			guided: false
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("adds a Take 7-9 button that resolves { takeSeven: true } when guided", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { guided: true });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.takeSeven.callback();

		expect(await promise).toEqual({ takeSeven: true });
	});

	it("omits the Take 7-9 button when not guided", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[0].buttons.takeSeven).toBeUndefined();

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});
});

describe("postGuidedResult", () => {
	it("posts the move's mixed-success text as chat content, with no dice", async () => {
		const actor = { system: {} };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		renderTemplate.mockResolvedValue("<div>guided</div>");

		await postGuidedResult(actor, EXCHANGE_BLOWS, { weaponLabel: "Rifle" });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, {
			name: "Exchange Blows",
			traitLabel: null,
			intentLabel: null,
			weaponLabel: "Rifle",
			weaponTags: null,
			tier: "mixed",
			tierLabel: MOVE_RESULT_LABELS.mixed,
			resultText: EXCHANGE_BLOWS.results.mixed,
			reminders: null,
			conditions: [{ key: "guided", label: "Guided" }],
			dice: null,
			hold: null,
			questionPrompt: null,
			questions: null,
			reroll: false
		});
		expect(ChatMessage.create).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			content: "<div>guided</div>"
		});
	});

	it("defaults weaponLabel to null when no options are given", async () => {
		const actor = { system: {} };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await postGuidedResult(actor, EXCHANGE_BLOWS);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ weaponLabel: null }));
	});

	it("grants a move's flat hold tier the same way a real roll would", async () => {
		const actor = { system: {}, update: vi.fn() };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await postGuidedResult(actor, READ_THE_ROOM, {});

		expect(actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": READ_THE_ROOM.hold.mixed });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ hold: READ_THE_ROOM.hold.mixed }));
	});

	it("routes a separateHold move's Guided hold into its own per-move pool", async () => {
		const actor = { system: {}, update: vi.fn() };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await postGuidedResult(actor, MOBILITY, {});

		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.the-scout:mobility.value": MOBILITY.hold.mixed });
	});
});

describe("explodeSixes (Number Of The Beast)", () => {
	const NONE = EFFECT_STATES.find((e) => e.key === "none");
	const CONFIDENCE = effectState("confidence");
	const DESPERATION = effectState("desperation");

	it("does nothing when there are no 6s in the pool", async () => {
		const result = await explodeSixes([{ result: 3 }, { result: 4 }], NONE);

		expect(result).toEqual({ bonus: 0, sixCount: 0, extraDice: [], triggered: false });
		expect(Roll).not.toHaveBeenCalled();
	});

	it("explodes one initial 6 into a non-6 die, adding its face to the bonus", async () => {
		mockRollSequence([[4]]);

		const result = await explodeSixes([{ result: 6 }, { result: 2 }], NONE);

		expect(Roll).toHaveBeenCalledTimes(1);
		expect(Roll).toHaveBeenCalledWith(`1d${DIE_FACES}`);
		expect(result).toEqual({
			bonus: 4,
			sixCount: 1,
			extraDice: [{ original: 4, result: 4, changed: false }],
			triggered: false
		});
	});

	it("explodes once per initial 6, summing every exploded die's face into the bonus", async () => {
		mockRollSequence([[2], [5]]);

		const result = await explodeSixes([{ result: 6 }, { result: 6 }], NONE);

		expect(Roll).toHaveBeenCalledTimes(2);
		expect(result).toEqual({
			bonus: 7,
			sixCount: 2,
			extraDice: [
				{ original: 2, result: 2, changed: false },
				{ original: 5, result: 5, changed: false }
			],
			triggered: false
		});
	});

	// Two initial 6s owe 2 explosions; the first explosion itself landing on a 6 re-chains, owing a
	// third (see explodeSixes' toRoll bookkeeping) — three rolls total, the third and fourth kept
	// deliberately non-6 so the chain terminates cleanly at exactly 3 sixes.
	it("chains explosions when an exploded die itself lands on a 6, and triggers at 3 sixes", async () => {
		mockRollSequence([[6], [2], [3]]);

		const result = await explodeSixes([{ result: 6 }, { result: 6 }], NONE);

		expect(Roll).toHaveBeenCalledTimes(3);
		expect(result).toEqual({
			bonus: 11,
			sixCount: 3,
			extraDice: [
				{ original: 6, result: 6, changed: false },
				{ original: 2, result: 2, changed: false },
				{ original: 3, result: 3, changed: false }
			],
			triggered: true
		});
	});

	it("does not trigger below 3 total sixes", async () => {
		mockRollSequence([[2]]);

		const result = await explodeSixes([{ result: 6 }], NONE);

		expect(result.sixCount).toBe(1);
		expect(result.triggered).toBe(false);
	});

	it("stops exploding once NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS is hit, rather than looping forever", async () => {
		mockRollSequence(Array.from({ length: NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS }, () => [6]));

		const result = await explodeSixes([{ result: 6 }], NONE);

		expect(Roll).toHaveBeenCalledTimes(NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS);
		expect(result.extraDice).toHaveLength(NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS);
		expect(result.triggered).toBe(true);
	});

	it("applies the same face substitution to an exploded die, and a Desperation-substituted 6 does not re-explode", async () => {
		mockRollSequence([[6]]);

		const result = await explodeSixes([{ result: 6 }], DESPERATION);

		expect(Roll).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			bonus: 1,
			sixCount: 1,
			extraDice: [{ original: 6, result: 1, changed: true }],
			triggered: false
		});
	});

	it("lets a Confidence-substituted exploded die (1 -> 6) re-explode", async () => {
		mockRollSequence([[1], [3]]);

		const result = await explodeSixes([{ result: 6 }], CONFIDENCE);

		expect(Roll).toHaveBeenCalledTimes(2);
		expect(result).toEqual({
			bonus: 9,
			sixCount: 2,
			extraDice: [
				{ original: 1, result: 6, changed: true },
				{ original: 3, result: 3, changed: false }
			],
			triggered: false
		});
	});
});

describe("rollMove - Number Of The Beast (exploding sixes)", () => {
	it("does nothing extra when options.explodeOnSix is not set, even on a roll full of 6s", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [6, 6] });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(Roll).toHaveBeenCalledTimes(1);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			explodedDice: null,
			beastTriggered: false
		}));
	});

	it("adds the exploded dice's total to the roll's total, and passes them to the chat template", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRollSequence([[6, 3], [4]]);

		await rollMove(actor, EXCHANGE_BLOWS, clash, { explodeOnSix: true });

		// Roll.mock.results[0] is the main "2d6 + @mod" roll — its own dice/mod total is the one
		// rollMove writes _total onto; the explosion die's own Roll instance (results[1]) never gets
		// its own _total touched, so grabbing the *last* result here (as most other tests in this
		// file do, since they never trigger a second `new Roll(...)` call) would read 0 instead.
		expect(Roll.mock.results[0].value.total).toBe(6 + 3 + 4);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			explodedDice: [{ original: 4, result: 4, changed: false }],
			beastTriggered: false
		}));
	});

	// Three initial 6s (via an Advantage pool, so the initial roll itself has 3 dice) trigger the
	// badge outright — the three explosion rolls owed for them are all kept deliberately non-6 so
	// the chain terminates cleanly after exactly those three.
	it("sets beastTriggered once three 6s are rolled across the pool and its explosions", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRollSequence([[6, 6, 6], [1], [2], [3]]);

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage", explodeOnSix: true });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ beastTriggered: true }));
	});

	it("does not merge exploded dice into the returned dice array, so rolledDoubles is unaffected", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRollSequence([[6, 6], [3], [2]]);

		const result = await rollMove(actor, EXCHANGE_BLOWS, clash, { explodeOnSix: true });

		expect(result.dice).toHaveLength(2);
		expect(result.dice.every((die) => die.kept)).toBe(true);
	});
});

describe("rollMove - return value", () => {
	it("returns the roll's outcome tier alongside the message and dice", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll({ dice: [5, 5] });
		expect((await rollMove(actor, EXCHANGE_BLOWS, clash)).tier).toBe("success");

		mockRoll({ dice: [4, 4] });
		expect((await rollMove(actor, EXCHANGE_BLOWS, clash)).tier).toBe("mixed");

		mockRoll({ dice: [1, 1] });
		expect((await rollMove(actor, EXCHANGE_BLOWS, clash)).tier).toBe("failure");
	});
});

describe("rollMove", () => {
	it("rolls 2d6 plus the chosen trait's value with no modifiers", async () => {
		const actor = { system: { stats: { clash: { value: 2 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 2 });
	});

	it("adds a derived trait bonus (Arcane Augments, Let Loose) on top of the trait's own value", async () => {
		const actor = { system: { stats: { clash: { value: 2 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { traitBonus: 3 });

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 5 });
	});

	it("defaults the trait bonus to 0 when omitted", async () => {
		const actor = { system: { stats: { clash: { value: 2 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash, {});

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 2 });
	});

	it("rolls extra dice for advantage and disadvantage stacks", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage" });
		expect(Roll).toHaveBeenLastCalledWith(`3d${DIE_FACES} + @mod`, { mod: 0 });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage2" });
		expect(Roll).toHaveBeenLastCalledWith(`4d${DIE_FACES} + @mod`, { mod: 0 });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "disadvantage2" });
		expect(Roll).toHaveBeenLastCalledWith(`4d${DIE_FACES} + @mod`, { mod: 0 });
	});

	it("substitutes faces via Confidence before computing the total", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 4] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { effect: "confidence" });

		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.dice[0].results[0].result).toBe(DIE_FACES);
		expect(rollInstance.total).toBe(DIE_FACES + 4);
	});

	it("computes the final total from the kept dice plus the trait value", async () => {
		const actor = { system: { stats: { clash: { value: 3 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 6, 4] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage" });

		expect(Roll.mock.results.at(-1).value.total).toBe(6 + 4 + 3);
	});

	it("pushes a keep-highest modifier onto the die term under advantage, keep-lowest under disadvantage", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll({ dice: [4, 3, 2] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage" });
		expect(Roll.mock.results.at(-1).value.dice[0].modifiers).toEqual(["kh2"]);

		mockRoll({ dice: [4, 3, 2] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "disadvantage" });
		expect(Roll.mock.results.at(-1).value.dice[0].modifiers).toEqual(["kl2"]);
	});

	it("leaves the die term's modifiers untouched with no advantage or disadvantage", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(Roll.mock.results.at(-1).value.dice[0].modifiers).toEqual([]);
	});

	it("passes the per-die breakdown to the chat template", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 6, 4] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage", effect: "confidence" });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			dice: [
				{ original: 1, result: DIE_FACES, changed: true, kept: true },
				{ original: 6, result: 6, changed: false, kept: true },
				{ original: 4, result: 4, changed: false, kept: false }
			]
		}));
	});

	it("reports success for a 10+, mixed for 7-9, and failure for 6-, with matching result text", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll({ dice: [5, 5] });
		await rollMove(actor, EXCHANGE_BLOWS, clash);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			name: EXCHANGE_BLOWS.name,
			traitLabel: clash.label,
			tier: "success",
			tierLabel: MOVE_RESULT_LABELS.success,
			resultText: EXCHANGE_BLOWS.results.success,
			conditions: []
		}));

		mockRoll({ dice: [4, 4] });
		await rollMove(actor, EXCHANGE_BLOWS, clash);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "mixed",
			tierLabel: MOVE_RESULT_LABELS.mixed,
			resultText: EXCHANGE_BLOWS.results.mixed
		}));

		mockRoll({ dice: [1, 1] });
		await rollMove(actor, EXCHANGE_BLOWS, clash);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "failure",
			tierLabel: MOVE_RESULT_LABELS.failure,
			resultText: null
		}));
	});

	it("adds the failure reminders on a full failure only", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll({ dice: [1, 1] });
		await rollMove(actor, EXCHANGE_BLOWS, clash);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "failure",
			reminders: ["Add a point of spotlight", "The Director makes a move"]
		}));

		mockRoll({ dice: [4, 4] });
		await rollMove(actor, EXCHANGE_BLOWS, clash);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "mixed",
			reminders: null
		}));

		mockRoll({ dice: [5, 5] });
		await rollMove(actor, EXCHANGE_BLOWS, clash);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "success",
			reminders: null
		}));
	});

	it("adds the failure reminders even for moves with their own failure text", async () => {
		const actor = { system: { stats: { sense: { value: 0 } }, resources: { hold: { value: 0 } } }, update: vi.fn() };
		const sense = TRAITS.find((t) => t.key === "sense");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll({ dice: [1, 1] });
		await rollMove(actor, READ_THE_ROOM, sense);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			resultText: READ_THE_ROOM.results.failure,
			reminders: FAILURE_REMINDERS
		}));
	});

	it("adds the deepen-a-Hook reminder for a Desperation roll that succeeds, but not for mixed or failure", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		// No 6s in these dice, so Desperation's 6->1 substitution never fires — only the effect
		// tag itself (not the substitution) is what the reminder keys off.
		mockRoll({ dice: [5, 5] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { effect: "desperation" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "success",
			reminders: ["You may deepen a Hook"]
		}));

		mockRoll({ dice: [4, 3] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { effect: "desperation" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "mixed",
			reminders: null
		}));

		mockRoll({ dice: [1, 1] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { effect: "desperation" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "failure",
			reminders: FAILURE_REMINDERS
		}));
	});

	it("adds the loosen-a-Hook reminder for a Confidence roll that fails, but not for success or mixed", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		// No 1s in these dice, so Confidence's 1->6 substitution never fires and the roll stays a
		// genuine failure.
		mockRoll({ dice: [2, 2] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { effect: "confidence" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "failure",
			reminders: [...FAILURE_REMINDERS, "You may loosen a Hook"]
		}));

		mockRoll({ dice: [4, 3] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { effect: "confidence" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "mixed",
			reminders: null
		}));

		mockRoll({ dice: [5, 5] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { effect: "confidence" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "success",
			reminders: null
		}));
	});

	it("adds an extraFailureReminder (e.g. Adrift's Walk-on Part In The War) only on an actual 6-", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll({ dice: [1, 1] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { extraFailureReminder: "Tick 'overheating' on your Astir" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "failure",
			reminders: [...FAILURE_REMINDERS, "Tick 'overheating' on your Astir"]
		}));

		mockRoll({ dice: [4, 3] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { extraFailureReminder: "Tick 'overheating' on your Astir" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "mixed",
			reminders: null
		}));
	});

	it("includes the active conditions in the chat template data", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "disadvantage2", effect: "desperation" });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			conditions: [
				{ key: "disadvantage2", label: "Disadvantage x2" },
				{ key: "desperation", label: "Desperation" }
			]
		}));
	});

	it("treats a missing stat value as 0", async () => {
		const actor = { system: { stats: {} } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 0 });
	});

	it("posts the rendered flavor to chat with the actor's speaker", async () => {
		const actor = { system: { stats: { clash: { value: 1 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		renderTemplate.mockResolvedValue("<div>flavor</div>");

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		const rollInstance = Roll.mock.results.at(-1).value;
		expect(ChatMessage.getSpeaker).toHaveBeenCalledWith({ actor });
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "<div>flavor</div>",
			flags: { "armor-astir": { advantageOffer: expect.any(Object) } }
		});
	});

	it("shows Add Advantage/Add Disadvantage based on how far the current advantage state can still move", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			showAddAdvantage: true,
			showAddDisadvantage: true
		}));

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			showAddAdvantage: true,
			// Disadvantage can still be clicked here — it steps back down to a flat roll rather
			// than being locked out (see roll-effects.js#nextAdvantageState).
			showAddDisadvantage: true
		}));

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage2" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			// Maxed in the same direction, so Advantage is blocked...
			showAddAdvantage: false,
			// ...but Disadvantage still steps the stack down to advantage x1.
			showAddDisadvantage: true
		}));
	});

	it("attaches an advantageOffer card flag carrying everything needed to add a die later", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 2 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [3, 4, 2] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage", effect: "confidence" });

		const rollInstance = Roll.mock.results.at(-1).value;
		const flags = rollInstance.toMessage.mock.calls.at(-1)[0].flags["armor-astir"];
		expect(flags.advantageOffer).toEqual({
			actorId: "actor1",
			moveKey: "exchange-blows",
			value: 2,
			effectKey: "confidence",
			advantageKey: "advantage",
			dice: expect.any(Array),
			extraConditions: [],
			extraFailureReminder: null,
			flavorArgs: expect.any(Object)
		});
	});
});

describe("rollMove - reroll (Decisive/Defensive/Versatile)", () => {
	it("offers a reroll, and records everything needed to redo it, when the roll fails", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, {
			advantage: "none",
			effect: "none",
			weaponLabel: "Halberd",
			reroll: { equipmentId: "eq1", tagKey: "defensive" }
		});

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ reroll: true }));
		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "",
			flags: {
				"armor-astir": {
					reroll: {
						actorId: "actor1",
						moveKey: "exchange-blows",
						trait: clash,
						equipmentId: "eq1",
						tagKey: "defensive",
						options: { advantage: "none", effect: "none", weaponLabel: "Halberd" }
					},
					advantageOffer: expect.any(Object)
				}
			}
		});
	});

	it("does not offer a reroll when the roll doesn't fail", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [6, 6] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { reroll: { equipmentId: "eq1", tagKey: "defensive" } });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ reroll: false }));
		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "",
			flags: { "armor-astir": { advantageOffer: expect.any(Object) } }
		});
	});

	it("does not offer a reroll on a failure when no reroll option was passed", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ reroll: false }));
		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "",
			flags: { "armor-astir": { advantageOffer: expect.any(Object) } }
		});
	});
});

describe("rollMove - automatic success offer (Hot-blooded/Once the War's Over/The Arity Method)", () => {
	const HOT_BLOODED_SOURCE = { key: "the-impostor:hot-blooded", name: "Hot-blooded", cost: 3 };

	it("offers automatic success, and records everything needed to spend it, on a Mixed result", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [3, 4] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { automaticSuccess: [HOT_BLOODED_SOURCE] });

		expect(renderTemplate).toHaveBeenCalledWith(
			MOVE_CHAT_TEMPLATE,
			expect.objectContaining({ automaticSuccess: [HOT_BLOODED_SOURCE] })
		);
		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "",
			flags: {
				"armor-astir": {
					automaticSuccess: {
						actorId: "actor1",
						moveKey: "exchange-blows",
						flavorArgs: expect.objectContaining({ tier: "mixed", automaticSuccess: [HOT_BLOODED_SOURCE] }),
						sources: [HOT_BLOODED_SOURCE]
					},
					advantageOffer: expect.any(Object)
				}
			}
		});
	});

	it("offers automatic success on a failure the same way", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { automaticSuccess: [HOT_BLOODED_SOURCE] });

		expect(renderTemplate).toHaveBeenCalledWith(
			MOVE_CHAT_TEMPLATE,
			expect.objectContaining({ automaticSuccess: [HOT_BLOODED_SOURCE] })
		);
	});

	it("does not offer automatic success once the roll already succeeded", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [6, 6] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { automaticSuccess: [HOT_BLOODED_SOURCE] });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ automaticSuccess: [] }));
		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "",
			flags: { "armor-astir": { advantageOffer: expect.any(Object) } }
		});
	});

	it("does not offer automatic success on a failing roll when nothing was passed", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ automaticSuccess: [] }));
		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "",
			flags: { "armor-astir": { advantageOffer: expect.any(Object) } }
		});
	});

	it("carries both a reroll offer and an automatic success offer on the same failed weapon roll", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, {
			weaponLabel: "Halberd",
			reroll: { equipmentId: "eq1", tagKey: "defensive" },
			automaticSuccess: [HOT_BLOODED_SOURCE]
		});

		const rollInstance = Roll.mock.results.at(-1).value;
		const flags = rollInstance.toMessage.mock.calls.at(-1)[0].flags["armor-astir"];
		expect(flags.reroll).toBeDefined();
		expect(flags.automaticSuccess.sources).toEqual([HOT_BLOODED_SOURCE]);
	});
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

describe("rollMove - equipment spends", () => {
	it("includes a spent equipment tag's label alongside advantage/effect conditions in the chat template", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }] });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			conditions: [{ key: "blitz", label: "Blitz" }]
		}));
	});

	it("drops a spent tag whose key no longer resolves in the catalog", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { spentTags: [{ equipmentId: "eq1", tagKey: "not-a-real-tag" }] });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ conditions: [] }));
	});

	it("renders no equipment conditions when nothing was spent", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash, {});

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ conditions: [] }));
	});
});

describe("rollMove - hold", () => {
	it("writes hold 3 to the actor on a 10+", async () => {
		const actor = { system: { stats: { sense: { value: 0 } } }, update: vi.fn() };
		const sense = TRAITS.find((t) => t.key === "sense");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [5, 5] });

		await rollMove(actor, READ_THE_ROOM, sense);

		expect(actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 3 });
	});

	it("writes hold 1 to the actor on a 7-9", async () => {
		const actor = { system: { stats: { sense: { value: 0 } } }, update: vi.fn() };
		const sense = TRAITS.find((t) => t.key === "sense");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [4, 4] });

		await rollMove(actor, READ_THE_ROOM, sense);

		expect(actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 1 });
	});

	it("does not update the actor's hold on a failure, so prior hold survives", async () => {
		const actor = { system: { stats: { sense: { value: 0 } } }, update: vi.fn() };
		const sense = TRAITS.find((t) => t.key === "sense");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, READ_THE_ROOM, sense);

		expect(actor.update).not.toHaveBeenCalled();
	});

	it("does not call actor.update for moves with no hold track", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } }, update: vi.fn() };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [5, 5] });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(actor.update).not.toHaveBeenCalled();
	});

	it("passes hold and the question list to the chat template on success and mixed success", async () => {
		const actor = { system: { stats: { sense: { value: 0 } } }, update: vi.fn() };
		const sense = TRAITS.find((t) => t.key === "sense");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll({ dice: [5, 5] });
		await rollMove(actor, READ_THE_ROOM, sense);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			hold: 3,
			questionPrompt: READ_THE_ROOM.questionPrompts.success,
			questions: READ_THE_ROOM.questions
		}));

		mockRoll({ dice: [4, 4] });
		await rollMove(actor, READ_THE_ROOM, sense);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			hold: 1,
			questionPrompt: READ_THE_ROOM.questionPrompts.mixed,
			questions: READ_THE_ROOM.questions
		}));
	});

	it("tells the player to spend hold on the questions after a hit, and that they have none on a miss", () => {
		expect(READ_THE_ROOM.questionPrompts.success).toMatch(/spend hold/i);
		expect(READ_THE_ROOM.questionPrompts.mixed).toMatch(/spend hold/i);
		expect(READ_THE_ROOM.questionPrompts.failure).not.toMatch(/spend hold/i);
	});

	it("passes the question list with hold 0 on a failure", async () => {
		const actor = { system: { stats: { sense: { value: 0 } } }, update: vi.fn() };
		const sense = TRAITS.find((t) => t.key === "sense");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, READ_THE_ROOM, sense);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			hold: 0,
			questionPrompt: READ_THE_ROOM.questionPrompts.failure,
			questions: READ_THE_ROOM.questions
		}));
	});

	it("suppresses the question list on a failure for a move without questionsOnFailure (Mobility)", async () => {
		const actor = { system: { stats: { defy: { value: 0 } } }, update: vi.fn() };
		const defy = TRAITS.find((t) => t.key === "defy");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, MOBILITY, defy);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			hold: 0,
			questionPrompt: MOBILITY.questionPrompts.failure,
			questions: null
		}));
	});

	it("passes a null hold and null questions for moves without a hold track", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			hold: null,
			questionPrompt: null,
			questions: null
		}));
	});
});

describe("rollMove - separateHold (Mobility)", () => {
	it("writes a hit's hold to the move's own per-move pool, not the shared hold field", async () => {
		const actor = { system: { stats: { defy: { value: 0 } } }, update: vi.fn() };
		const defy = TRAITS.find((t) => t.key === "defy");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [5, 5] });

		await rollMove(actor, MOBILITY, defy);

		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.the-scout:mobility.value": 3 });
	});

	it("does not touch the shared hold field at all", async () => {
		const actor = { system: { stats: { defy: { value: 0 } } }, update: vi.fn() };
		const defy = TRAITS.find((t) => t.key === "defy");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [4, 4] });

		await rollMove(actor, MOBILITY, defy);

		expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({
			"system.resources.hold.value": expect.anything()
		}));
	});

	it("does not overwrite Read the Room's hold when Mobility is rolled right after", async () => {
		const actor = { system: { stats: { sense: { value: 0 }, defy: { value: 0 } } }, update: vi.fn() };
		const sense = TRAITS.find((t) => t.key === "sense");
		const defy = TRAITS.find((t) => t.key === "defy");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll({ dice: [5, 5] });
		await rollMove(actor, READ_THE_ROOM, sense);
		expect(actor.update).toHaveBeenLastCalledWith({ "system.resources.hold.value": 3 });

		mockRoll({ dice: [4, 4] });
		await rollMove(actor, MOBILITY, defy);
		expect(actor.update).toHaveBeenLastCalledWith({ "system.attributes.moveHold.the-scout:mobility.value": 1 });
	});
});

describe("postMoveDescription", () => {
	it("renders the move's description and posts it to chat", async () => {
		const actor = { system: { stats: {} } };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		renderTemplate.mockResolvedValue("<div>description</div>");

		await postMoveDescription(actor, EXCHANGE_BLOWS);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, {
			name: EXCHANGE_BLOWS.name,
			description: EXCHANGE_BLOWS.description
		});
		expect(ChatMessage.getSpeaker).toHaveBeenCalledWith({ actor });
		expect(ChatMessage.create).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			content: "<div>description</div>"
		});
	});

	it("renders subsystems' description too, despite it having no results/roll", async () => {
		const actor = { system: { stats: {} } };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		renderTemplate.mockResolvedValue("<div>description</div>");

		await postMoveDescription(actor, SUBSYSTEMS);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, {
			name: SUBSYSTEMS.name,
			description: SUBSYSTEMS.description
		});
	});
});

describe("buildReminders", () => {
	it("includes the extraFailureReminder only on an actual failure", () => {
		const none = effectState("none");

		expect(buildReminders("failure", none, "Tick 'overheating' on your Astir")).toEqual([
			...FAILURE_REMINDERS,
			"Tick 'overheating' on your Astir"
		]);
		expect(buildReminders("mixed", none, "Tick 'overheating' on your Astir")).toEqual([]);
		expect(buildReminders("success", none, "Tick 'overheating' on your Astir")).toEqual([]);
	});

	it("omits the extraFailureReminder slot entirely when none is passed", () => {
		expect(buildReminders("failure", effectState("none"))).toEqual(FAILURE_REMINDERS);
	});
});
