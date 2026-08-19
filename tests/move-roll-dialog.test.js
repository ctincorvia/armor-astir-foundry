import { beforeEach, describe, expect, it, vi } from "vitest";

import { BASIC_MOVES, SPECIAL_MOVES, configureMoveRoll, configureVariableDiceRoll } from "../scripts/moves/moves.js";
import { UNARMED } from "../scripts/equipment/equipment.js";
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

// Riders (see PlaybookActorSheet#_ridersForMove) — a read-only preview of the move's passive
// on-roll bonuses, passed through to the template unscoped by weapon (see the field's own doc
// comment above configureMoveRoll). No Roll-button/callback wiring to test here, unlike
// equipmentSpends/rollModifiers — riders carries no key/disabled/deferred concept for the Roll
// callback to read back.
describe("configureMoveRoll - riders", () => {
	const clash = CLASH_TRAIT;
	const riders = [{ label: "On 10+", text: "Coordinator's own reminder" }];

	it("passes the given riders through to the dialog template", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { riders });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			riders
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("defaults riders to an empty list", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			riders: []
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	// weaponBundles' own per-bundle fields (Trait, Equipment, Roll Modifiers) are read from the
	// active panel (see the weaponBundles describe block below) — riders is deliberately not one of
	// them, since none of its three source resolvers take a weapon. This proves it still reaches the
	// template unscoped, once at the top level, even when weaponBundles is also passed.
	it("passes riders through unchanged alongside weaponBundles", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], {
			riders,
			weaponBundles: [{
				weaponKey: "unarmed", weaponLabel: "Unarmed", weaponCard: null, traits: [clash],
				traitOptions: [{ key: "clash", label: "CLASH (1)" }], lockedEffect: null,
				equipmentSpends: [], guided: null, rollModifiers: []
			}]
		});
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			riders
		}));

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
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], {
			lockedEffect: "confidence", rollStack
		});
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

describe("configureMoveRoll - disadvantage conversion (Embrace Chaos)", () => {
	const clash = CLASH_TRAIT;
	const disadvantageConversion = {
		key: "the-witch:embrace-chaos",
		label: "Embrace Chaos",
		costsHold: { amount: 1 },
		transform: { disadvantage: "advantage", disadvantage2: "none" }
	};

	it("passes disadvantageConversion through to the dialog template", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { disadvantageConversion });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			disadvantageConversion
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("defaults disadvantageConversion to null", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			disadvantageConversion: null
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("leaves advantage untouched, and omits spentDisadvantageConversion, when the checkbox isn't checked", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { disadvantageConversion });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "disadvantage",
			"[name='effect']": "none"
		}, [], [], [], [], [], false, false));

		const result = await promise;
		expect(result.advantage).toBe("disadvantage");
		expect(result.spentDisadvantageConversion).toBeUndefined();
	});

	it("resolves transform['disadvantage'] -> 'advantage' when checked with Disadvantage selected", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { disadvantageConversion });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "disadvantage",
			"[name='effect']": "none"
		}, [], [], [], [], [], false, true));

		const result = await promise;
		expect(result.advantage).toBe("advantage");
		expect(result.spentDisadvantageConversion).toBe(true);
	});

	it("resolves transform['disadvantage2'] -> 'none' (a flat roll) when checked with Disadvantage x2 selected", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { disadvantageConversion });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "disadvantage2",
			"[name='effect']": "none"
		}, [], [], [], [], [], false, true));

		const result = await promise;
		expect(result.advantage).toBe("none");
		expect(result.spentDisadvantageConversion).toBe(true);
	});

	it("wins over every other advantage source when checked", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], {
			lockedEffect: "confidence", disadvantageConversion
		});
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "disadvantage2",
			"[name='effect']": "none"
		}, [], [], [], [], [], false, true));

		const result = await promise;
		expect(result.advantage).toBe("none");
	});

	// The live-reactive checkbox itself — same pattern as fakeRollStackRenderHtml above, keyed off
	// the disadvantage-conversion checkbox name instead of roll-stack.
	function fakeDisadvantageConversionRenderHtml({ advantage = "none", checked = false } = {}) {
		const state = { advantage, disadvantageConversionDisabled: undefined, disadvantageConversionChecked: checked, advantageHandlers: {} };
		const disadvantageConversionEl = {
			prop(name, value) {
				if (name === "disabled") state.disadvantageConversionDisabled = value;
				if (name === "checked") {
					state.disadvantageConversionChecked = typeof value === "function"
						? value(0, state.disadvantageConversionChecked)
						: value;
				}
				return disadvantageConversionEl;
			}
		};
		const advantageEl = {
			val: () => state.advantage,
			on: (event, handler) => { state.advantageHandlers[event] = handler; }
		};
		state.html = {
			find: (selector) => {
				if (selector === "[name='advantage']") return advantageEl;
				if (selector === "[name='disadvantage-conversion']") return disadvantageConversionEl;
				return {};
			}
		};
		return state;
	}

	it("does nothing when disadvantageConversion wasn't offered", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeDisadvantageConversionRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.disadvantageConversionDisabled).toBeUndefined();
		expect(Object.keys(state.advantageHandlers)).toEqual([]);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("enables the checkbox on open when Disadvantage is already selected", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { disadvantageConversion });
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeDisadvantageConversionRenderHtml({ advantage: "disadvantage" });
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.disadvantageConversionDisabled).toBe(false);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("enables the checkbox on open when Disadvantage x2 is already selected", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { disadvantageConversion });
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeDisadvantageConversionRenderHtml({ advantage: "disadvantage2" });
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.disadvantageConversionDisabled).toBe(false);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("disables and unchecks the checkbox on open for every other Dice state", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { disadvantageConversion });
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeDisadvantageConversionRenderHtml({ advantage: "none", checked: true });
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.disadvantageConversionDisabled).toBe(true);
		expect(state.disadvantageConversionChecked).toBe(false);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("re-evaluates live when the Advantage select changes", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { disadvantageConversion });
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeDisadvantageConversionRenderHtml({ advantage: "none" });
		Dialog.mock.calls.at(-1)[0].render(state.html);
		expect(state.disadvantageConversionDisabled).toBe(true);

		state.advantage = "disadvantage";
		state.advantageHandlers.change();

		expect(state.disadvantageConversionDisabled).toBe(false);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});
});

// The merged weapon-choice + move-roll dialog (see PlaybookActorSheet#_rollMoveWithWeaponChoice/
// _weaponRollBundle and this module's own weaponBundles doc comment on configureMoveRoll). Every
// describe block above this one passes no weaponBundles at all, proving the non-weapon/single-
// weapon path renders and resolves byte-for-byte as it did before this option existed — these
// tests cover the weaponBundles-only additions specifically: the template data shape (each
// bundle's own lockedEffectLabel), the weapon-select's panel-toggle wiring, and the Roll/Take 7-9
// buttons' rescoped reads.
describe("configureMoveRoll - weaponBundles", () => {
	const clash = CLASH_TRAIT;
	const channelTrait = { key: "channel", label: "CHANNEL", value: 2 };

	const unarmedBundle = {
		weaponKey: UNARMED,
		weaponLabel: "Unarmed",
		weaponCard: null,
		traits: [clash],
		traitOptions: [{ key: "clash", label: "CLASH (1)" }],
		lockedEffect: null,
		equipmentSpends: [],
		guided: null,
		rollModifiers: []
	};
	const blitzSpend = {
		equipmentId: "eq1",
		equipmentName: "Halberd",
		tagKey: "blitz",
		tagLabel: "Blitz",
		description: "You may spend this tag once per Scene to make a move with confidence.",
		effect: "confidence",
		disabled: false
	};
	const modifierEntry = {
		key: "the-diplomat:sharper-knives", label: "Sharper Knives", description: "d",
		advantage: "advantage", effect: null, reminderOnly: false, deferred: false, disabled: false, disabledReason: null
	};
	const halberdBundle = {
		weaponKey: "eq1",
		weaponLabel: "Halberd",
		weaponCard: { name: "Halberd", value: 1, tier: 1, scale: "foot", scaleLabel: "Foot Scale", tags: [] },
		traits: [clash],
		traitOptions: [{ key: "clash", label: "CLASH (1)" }],
		lockedEffect: "desperation",
		equipmentSpends: [blitzSpend],
		guided: "Guided",
		rollModifiers: [modifierEntry]
	};
	// A Familiar weapon's own traits differ from every other bundle's (CHANNEL instead of CLASH) —
	// used to prove the Roll callback resolves `trait` from the *active* bundle's own traits list,
	// not the dialog's top-level `traits` argument (see PlaybookActorSheet#_weaponRollBundle).
	const familiarBundle = {
		weaponKey: "eq2",
		weaponLabel: "Astir Lance",
		weaponCard: { name: "Astir Lance", value: 0, tier: 3, scale: "astir", scaleLabel: "Astir Scale", tags: [] },
		traits: [channelTrait],
		traitOptions: [{ key: "channel", label: "CHANNEL (2)" }],
		lockedEffect: null,
		equipmentSpends: [],
		guided: null,
		rollModifiers: []
	};

	// Fakes the weapon-select's own render-time wiring (see configureMoveRoll's render callback) —
	// captures the change handler and every [data-weapon-panel] removeClass/addClass call, mirroring
	// fakePickerTabsHtml's shape in tests/equipment-catalog.test.js for the same
	// "no TabsV2 controller inside a bare Foundry Dialog" reason.
	function fakeWeaponPanelRenderHtml() {
		const state = { handler: null, removeClassCalls: [], addClassCalls: [] };
		state.html = {
			find: (selector) => ({
				on: (event, handler) => { state.handler = handler; },
				removeClass: (cls) => { state.removeClassCalls.push([selector, cls]); },
				addClass: (cls) => { state.addClassCalls.push([selector, cls]); }
			})
		};
		return state;
	}

	it("passes weaponBundles to the dialog template, resolving each bundle's own lockedEffectLabel", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { weaponBundles: [unarmedBundle, halberdBundle] });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			weaponBundles: [
				{ ...unarmedBundle, lockedEffectLabel: null },
				{ ...halberdBundle, lockedEffectLabel: "Desperation" }
			]
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("defaults weaponBundles to null", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			weaponBundles: null
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("wires the weapon-select to toggle the active weaponBundles panel", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { weaponBundles: [unarmedBundle, halberdBundle] });
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeWeaponPanelRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);
		state.handler({ target: { value: "eq1" } });

		expect(state.removeClassCalls).toContainEqual(["[data-weapon-panel]", "active"]);
		expect(state.addClassCalls).toContainEqual(["[data-weapon-panel=\"eq1\"]", "active"]);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves the trait from the active panel's own traits, not the top-level traits list", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { weaponBundles: [unarmedBundle, familiarBundle] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='weapon-select']": familiarBundle.weaponKey,
			"[data-weapon-panel].active [name='trait']": "channel",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}));

		const result = await promise;
		expect(result.trait).toEqual(channelTrait);
		expect(result.weaponId).toBe(familiarBundle.weaponKey);
	});

	it("resolves spentTags and the spend's own effect from the active panel's own equipmentSpends", async () => {
		// lockedEffect: null here (unlike halberdBundle's own "desperation") so this test isolates
		// spentEffect's own resolution — activeLockedEffect still outranks a spend in the same
		// precedence chain the top-level (non-weaponBundles) "lets lockedEffect win over a checked
		// spend" test above already covers.
		const unlockedHalberdBundle = { ...halberdBundle, lockedEffect: null };
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { weaponBundles: [unarmedBundle, unlockedHalberdBundle] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='weapon-select']": unlockedHalberdBundle.weaponKey,
			"[data-weapon-panel].active [name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, [], ["eq1::blitz"], [], [], [], false, false, true));

		const result = await promise;
		expect(result.spentTags).toEqual([{ equipmentId: "eq1", tagKey: "blitz" }]);
		expect(result.effect).toBe("confidence");
	});

	it("resolves spentRollModifiers and the entry's own advantage from the active panel's own rollModifiers", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { weaponBundles: [unarmedBundle, halberdBundle] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='weapon-select']": halberdBundle.weaponKey,
			"[data-weapon-panel].active [name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, [], [], [], [modifierEntry.key], [], false, false, true));

		const result = await promise;
		expect(result.advantage).toBe("advantage");
		expect(result.spentRollModifiers).toEqual([modifierEntry.key]);
	});

	it("omits spentTags/spentRollModifiers and resolves lockedEffect null when the active panel offers neither", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { weaponBundles: [unarmedBundle, halberdBundle] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='weapon-select']": unarmedBundle.weaponKey,
			"[data-weapon-panel].active [name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}));

		const result = await promise;
		expect(result).toEqual({ trait: clash, advantage: "none", effect: "none", weaponId: UNARMED });
	});

	it("offers Take 7-9 when any weaponBundles entry is guided, and resolves weaponId from the weapon-select", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { weaponBundles: [unarmedBundle, halberdBundle] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		expect(dialogOptions.buttons.takeSeven).toBeDefined();
		dialogOptions.buttons.takeSeven.callback(fakeRollHtml({ "[name='weapon-select']": halberdBundle.weaponKey }));

		expect(await promise).toEqual({ takeSeven: true, weaponId: halberdBundle.weaponKey });
	});

	it("omits Take 7-9 when no weaponBundles entry is guided", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { weaponBundles: [unarmedBundle, familiarBundle] });
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[0].buttons.takeSeven).toBeUndefined();

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
