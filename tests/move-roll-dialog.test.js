import { beforeEach, describe, expect, it, vi } from "vitest";

import { BASIC_MOVES, SPECIAL_MOVES, configureMoveRoll, configureVariableDiceRoll } from "../scripts/moves/moves.js";
import { CLASH_TRAIT, fakeRollHtml, mockRoll } from "./helpers/move-test-helpers.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const HELP_OR_HINDER = BASIC_MOVES.find((m) => m.key === "help-or-hinder");
const BITE_THE_DUST = BASIC_MOVES.find((m) => m.key === "bite-the-dust");
const READ_THE_ROOM = BASIC_MOVES.find((m) => m.key === "read-the-room");
const PLAN_AND_PREPARE = SPECIAL_MOVES.find((m) => m.key === "plan-and-prepare");

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

describe("configureMoveRoll", () => {
	const clash = CLASH_TRAIT;
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

describe("configureMoveRoll - lockedEffect", () => {
	const clash = CLASH_TRAIT;

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
	const clash = CLASH_TRAIT;

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
	const clash = CLASH_TRAIT;
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
	const clash = CLASH_TRAIT;
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
	const clash = CLASH_TRAIT;

	it("passes guided's own source label through to the dialog template", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { guided: "Guided" });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			guided: "Guided"
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("defaults guided to null", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			guided: null
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("adds a Take 7-9 button that resolves { takeSeven: true } when guided", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { guided: "Guided" });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];

		expect(dialogOptions.buttons.takeSeven.label).toBe("Take 7-9");
		dialogOptions.buttons.takeSeven.callback();

		expect(await promise).toEqual({ takeSeven: true });
	});

	// The template's own move-roll-guided-note (move-roll-dialog.hbs) already names the source —
	// the button label stays plain regardless of which source granted it, rather than repeating it.
	it("keeps the Take 7-9 button label plain regardless of the guided source's own name", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { guided: "Spell Routines" });
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[0].buttons.takeSeven.label).toBe("Take 7-9");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
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

describe("configureMoveRoll - roll modifiers", () => {
	const clash = CLASH_TRAIT;
	const advantageEntry = {
		key: "the-diplomat:sharper-knives", label: "Sharper Knives", description: "d",
		advantage: "advantage", effect: null, reminderOnly: false, deferred: false, disabled: false, disabledReason: null
	};
	const effectEntry = {
		key: "the-icon:you-should-see-me-in-a-crown", label: "You Should See Me In A Crown", description: "d",
		advantage: null, effect: "confidence", reminderOnly: false, deferred: false, disabled: false, disabledReason: null
	};
	const deferredEntry = {
		key: "the-adrift:snakes-in-the-grass", label: "Snakes In The Grass", description: "d",
		advantage: "advantage", effect: null, reminderOnly: false, deferred: true, disabled: false, disabledReason: null
	};

	it("passes the offered roll modifiers to the dialog template", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { rollModifiers: [advantageEntry] });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			rollModifiers: [advantageEntry]
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("defaults rollModifiers to an empty list", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			rollModifiers: []
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("sets the roll's advantage from a checked, non-deferred entry", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { rollModifiers: [advantageEntry] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, [], [], [], [advantageEntry.key]));

		const result = await promise;
		expect(result.advantage).toBe("advantage");
		expect(result.spentRollModifiers).toEqual([advantageEntry.key]);
	});

	it("sets the roll's effect from a checked, non-deferred entry", async () => {
		const promise = configureMoveRoll(READ_THE_ROOM, [clash], { rollModifiers: [effectEntry] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, [], [], [], [effectEntry.key]));

		expect((await promise).effect).toBe("confidence");
	});

	it("does not let a checked deferred entry touch this roll's advantage or effect, but still spends it", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { rollModifiers: [deferredEntry] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, [], [], [], [], [deferredEntry.key]));

		const result = await promise;
		expect(result.advantage).toBe("none");
		expect(result.spentRollModifiers).toEqual([deferredEntry.key]);
	});

	it("merges checked immediate and deferred entries into spentRollModifiers together", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { rollModifiers: [advantageEntry, deferredEntry] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, [], [], [], [advantageEntry.key], [deferredEntry.key]));

		expect((await promise).spentRollModifiers).toEqual([advantageEntry.key, deferredEntry.key]);
	});

	it("takes the later checked entry's advantage on a collision", async () => {
		const otherAdvantage = { ...advantageEntry, key: "astir:manawheels", advantage: "advantage2" };
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { rollModifiers: [advantageEntry, otherAdvantage] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, [], [], [], [advantageEntry.key, otherAdvantage.key]));

		expect((await promise).advantage).toBe("advantage2");
	});

	it("lets a spent Astir Part's advantage win over a checked roll modifier's advantage", async () => {
		const spend = {
			partKey: "astir-part:artifact", partName: "Artifact", description: "d", effect: null, advantage: "advantage2", disabled: false
		};
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { astirPartSpends: [spend], rollModifiers: [advantageEntry] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, [], [], ["astir-part:artifact"], [advantageEntry.key]));

		expect((await promise).advantage).toBe("advantage2");
	});

	it("lets a checked roll modifier's advantage win over lockedAdvantage", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { lockedAdvantage: "disadvantage", rollModifiers: [advantageEntry] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, [], [], [], [advantageEntry.key]));

		expect((await promise).advantage).toBe("advantage");
	});

	it("resolves an empty spentRollModifiers list, and falls back to the selects, when none were checked", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { rollModifiers: [advantageEntry] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}));

		const result = await promise;
		expect(result.advantage).toBe("none");
		expect(result.spentRollModifiers).toEqual([]);
	});

	it("does not add a spentRollModifiers key when no roll modifier was offered", async () => {
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

describe("configureMoveRoll - roll stack (All In)", () => {
	const clash = CLASH_TRAIT;
	const rollStack = { key: "cantrips:all-in", label: "All In", requiresAdvantageSelected: true, setAdvantage: "advantage2", setEffect: "desperation" };

	it("passes rollStack through to the dialog template", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { rollStack });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			rollStack
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("defaults rollStack to null", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			rollStack: null
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("leaves advantage/effect untouched when the Stack checkbox isn't checked", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { rollStack });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "advantage",
			"[name='effect']": "none"
		}, [], [], [], [], [], false));

		const result = await promise;
		expect(result.advantage).toBe("advantage");
		expect(result.effect).toBe("none");
	});

	it("sets advantage/effect from rollStack when the Stack checkbox is checked", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { rollStack });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "advantage",
			"[name='effect']": "none"
		}, [], [], [], [], [], true));

		const result = await promise;
		expect(result.advantage).toBe("advantage2");
		expect(result.effect).toBe("desperation");
	});

	it("wins over every other advantage/effect source when checked", async () => {
		const spend = {
			partKey: "astir-part:artifact", partName: "Artifact", description: "d", effect: null, advantage: "advantage", disabled: false
		};
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], {
			lockedEffect: "confidence", astirPartSpends: [spend], rollStack
		});
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "advantage",
			"[name='effect']": "none"
		}, [], [], ["astir-part:artifact"], [], [], true));

		const result = await promise;
		expect(result.advantage).toBe("advantage2");
		expect(result.effect).toBe("desperation");
	});

	// The live-reactive checkbox itself — invoked directly per the existing
	// `Dialog.mock.calls.at(-1)[0].render(html)` pattern already used in tests/equipment-editor.test.js.
	function fakeRollStackRenderHtml({ advantage = "none", checked = false } = {}) {
		const state = { advantage, rollStackDisabled: undefined, rollStackChecked: checked, advantageHandlers: {} };
		const rollStackEl = {
			prop(name, value) {
				if (name === "disabled") state.rollStackDisabled = value;
				if (name === "checked") state.rollStackChecked = typeof value === "function" ? value(0, state.rollStackChecked) : value;
				return rollStackEl;
			}
		};
		const advantageEl = {
			val: () => state.advantage,
			on: (event, handler) => { state.advantageHandlers[event] = handler; }
		};
		state.html = {
			find: (selector) => {
				if (selector === "[name='advantage']") return advantageEl;
				if (selector === "[name='roll-stack']") return rollStackEl;
				return {};
			}
		};
		return state;
	}

	it("does nothing when rollStack wasn't offered", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeRollStackRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.rollStackDisabled).toBeUndefined();
		expect(Object.keys(state.advantageHandlers)).toEqual([]);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("enables the Stack checkbox on open when Advantage is already selected", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { rollStack });
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeRollStackRenderHtml({ advantage: "advantage" });
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.rollStackDisabled).toBe(false);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("disables and unchecks the Stack checkbox on open when Advantage isn't selected", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { rollStack });
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeRollStackRenderHtml({ advantage: "none", checked: true });
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.rollStackDisabled).toBe(true);
		expect(state.rollStackChecked).toBe(false);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("re-evaluates live when the Advantage select changes", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { rollStack });
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeRollStackRenderHtml({ advantage: "none" });
		Dialog.mock.calls.at(-1)[0].render(state.html);
		expect(state.rollStackDisabled).toBe(true);

		state.advantage = "advantage";
		state.advantageHandlers.change();

		expect(state.rollStackDisabled).toBe(false);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});
});

describe("configureVariableDiceRoll", () => {
	function fakeVariableDiceHtml(values) {
		return { find: (selector) => ({ val: () => values[selector] }) };
	}

	it("renders the variable dice roll dialog template", async () => {
		const promise = configureVariableDiceRoll(PLAN_AND_PREPARE);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("variable-dice-roll-dialog"), {});

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves target and extraDice as numbers when Roll is clicked", async () => {
		const promise = configureVariableDiceRoll(PLAN_AND_PREPARE);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeVariableDiceHtml({
			"[name='target']": "3",
			"[name='extra-dice']": "2"
		}));

		expect(await promise).toEqual({ target: 3, extraDice: 2 });
	});

	it("resolves null when Cancel is clicked", async () => {
		const promise = configureVariableDiceRoll(PLAN_AND_PREPARE);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.cancel.callback();

		expect(await promise).toBeNull();
	});

	it("resolves null when the dialog is closed without a selection", async () => {
		const promise = configureVariableDiceRoll(PLAN_AND_PREPARE);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.close();

		expect(await promise).toBeNull();
	});
});
