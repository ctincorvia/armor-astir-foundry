import { beforeEach, describe, expect, it, vi } from "vitest";

import { BASIC_MOVES, SPECIAL_MOVES, configureMoveRoll, configureVariableDiceRoll } from "../scripts/moves/moves.js";
import { EQUIPMENT_TAGS, UNARMED } from "../scripts/equipment/equipment.js";
import { CLASH_TRAIT, fakeNoopJQuery, fakeRollHtml, mockRoll } from "./helpers/move-test-helpers.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const HELP_OR_HINDER = BASIC_MOVES.find((m) => m.key === "help-or-hinder");
const BITE_THE_DUST = BASIC_MOVES.find((m) => m.key === "bite-the-dust");
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

describe("configureMoveRoll - notched slider states", () => {
	const clash = CLASH_TRAIT;

	it("shapes advantageStates in display order, with no lock", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			advantageStates: [
				{ key: "disadvantage2", label: "Disadvantage x2", selected: false, disabled: false },
				{ key: "disadvantage", label: "Disadvantage", selected: false, disabled: false },
				{ key: "none", label: "None", selected: true, disabled: false },
				{ key: "advantage", label: "Advantage", selected: false, disabled: false },
				{ key: "advantage2", label: "Advantage x2", selected: false, disabled: false }
			],
			advantageSelectedKey: "none",
			advantageSelectedLabel: "None"
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("shapes effectStates in display order, with no lock", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			effectStates: [
				{ key: "desperation", label: "Desperation", selected: false, disabled: false },
				{ key: "none", label: "None", selected: true, disabled: false },
				{ key: "confidence", label: "Confidence", selected: false, disabled: false }
			],
			effectSelectedKey: "none",
			effectSelectedLabel: "None"
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	// There is no lockedAdvantage anymore (see docs/domains/moves.md) -- the Advantage slider is
	// never disabled, regardless of what rollModifiers carries (a forced entry's own seed only ever
	// affects the render callback's live currentAdvantage, not this template-context array, which is
	// built before the render callback ever runs).
	it("never disables advantageStates, even with a forced Roll Modifier entry among rollModifiers", async () => {
		const forcedEntry = {
			key: "target-tier-matchup", label: "Tier Advantage", description: "d",
			advantage: "advantage", effect: null, requiresAdvantage: null,
			reminderOnly: false, disabled: false, disabledReason: null, forced: true
		};
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { rollModifiers: [forcedEntry] });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			advantageStates: [
				{ key: "disadvantage2", label: "Disadvantage x2", selected: false, disabled: false },
				{ key: "disadvantage", label: "Disadvantage", selected: false, disabled: false },
				{ key: "none", label: "None", selected: true, disabled: false },
				{ key: "advantage", label: "Advantage", selected: false, disabled: false },
				{ key: "advantage2", label: "Advantage x2", selected: false, disabled: false }
			],
			advantageSelectedKey: "none",
			advantageSelectedLabel: "None"
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("disables every effectStates entry and selects the locked one when lockedEffect is set", async () => {
		const promise = configureMoveRoll(BITE_THE_DUST, [clash], { lockedEffect: "desperation" });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			effectStates: [
				{ key: "desperation", label: "Desperation", selected: true, disabled: true },
				{ key: "none", label: "None", selected: false, disabled: true },
				{ key: "confidence", label: "Confidence", selected: false, disabled: true }
			],
			effectSelectedKey: "desperation",
			effectSelectedLabel: "Desperation"
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});
});

describe("configureMoveRoll - notched slider wiring", () => {
	const clash = CLASH_TRAIT;

	// Fakes the differently-named <name>-notch radio group driving the hidden [name=<name>] input
	// (see wireNotchedSlider, move-dialogs.js) -- captures every change handler bound to it (both
	// wireNotchedSlider's own, and configureMoveRoll's own render callback's chain-recompute
	// handler -- see the "live chain recompute" tests in tests/move-roll-dialog-chain.test.js) so
	// fireChange can invoke them in binding order, the same way a real DOM change event fires every
	// listener on an element.
	function fakeNotchedSliderRenderHtml(name) {
		const state = { hiddenValue: undefined, readoutText: null, handlers: [] };
		const hiddenEl = {
			val(value) { if (value === undefined) return state.hiddenValue; state.hiddenValue = value; return hiddenEl; }
		};
		const readoutEl = { text(value) { state.readoutText = value; return readoutEl; } };
		const notchEl = { on: (event, handler) => { if (event === "change") state.handlers.push(handler); } };
		state.fireChange = (detail) => { for (const handler of state.handlers) handler(detail); };
		state.html = {
			find: (selector) => {
				if (selector === `[name='${name}']`) return hiddenEl;
				if (selector === `[name='${name}-notch']`) return notchEl;
				if (selector === `[data-notched-slider='${name}'] [data-notched-slider-readout]`) return readoutEl;
				return fakeNoopJQuery();
			}
		};
		return state;
	}

	it("drives the hidden advantage input and readout when a Dice notch is picked", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeNotchedSliderRenderHtml("advantage");
		Dialog.mock.calls.at(-1)[0].render(state.html);
		state.fireChange({ target: { value: "advantage2", title: "Advantage x2" } });

		expect(state.hiddenValue).toBe("advantage2");
		expect(state.readoutText).toBe("Advantage x2");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("drives the hidden effect input and readout when an Effect notch is picked", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeNotchedSliderRenderHtml("effect");
		Dialog.mock.calls.at(-1)[0].render(state.html);
		state.fireChange({ target: { value: "confidence", title: "Confidence" } });

		expect(state.hiddenValue).toBe("confidence");
		expect(state.readoutText).toBe("Confidence");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
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

	it("passes the given lockedEffect and its display label, with source, to the dialog template", async () => {
		const promise = configureMoveRoll(BITE_THE_DUST, [clash], { lockedEffect: "desperation", lockedEffectSource: "Test Source" });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			lockedEffect: "desperation",
			lockedEffectLabel: "Desperation from Test Source"
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("labels a Confidence lockedEffect (Field Scout's grantsEffectOnMove) correctly too", async () => {
		const promise = configureMoveRoll(BITE_THE_DUST, [clash], { lockedEffect: "confidence", lockedEffectSource: "Field Scout" });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			lockedEffectLabel: "Confidence from Field Scout"
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

// narrativeTags (see PlaybookActorSheet#_narrativeWeaponTags) — a read-only display list, unlike
// equipmentSpends above, so there's no Roll-button/checkbox round trip to test here, only the
// render-time passthrough (mirrors the "riders" describe block's own shape further below).
describe("configureMoveRoll - narrative tags", () => {
	const clash = CLASH_TRAIT;
	const impact = EQUIPMENT_TAGS.find((t) => t.key === "impact");
	const impactTag = {
		equipmentId: "eq1",
		equipmentName: "Halberd",
		tagKey: impact.key,
		tagLabel: impact.label,
		description: impact.description
	};

	it("passes the offered narrative tags to the dialog template", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { narrativeTags: [impactTag] });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			narrativeTags: [impactTag]
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("defaults narrativeTags to an empty list", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			narrativeTags: []
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
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

describe("configureMoveRoll - reroll tag", () => {
	const clash = CLASH_TRAIT;

	it("passes rerollTag through to the dialog template", async () => {
		const rerollTag = { tagLabel: "Defensive", description: "Some reroll text." };
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { rerollTag });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			rerollTag
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("defaults rerollTag to null", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			rerollTag: null
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});
});

// Riders (see PlaybookActorSheet#_ridersForMove) — a read-only preview of the move's passive
// on-roll bonuses, passed through to the template unscoped by weapon (see the field's own doc
// comment above configureMoveRoll). No Roll-button/callback wiring to test here, unlike
// equipmentSpends/rollModifiers — riders carries no key/disabled concept for the Roll
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
		advantage: "advantage", effect: null, requiresAdvantage: null, reminderOnly: false, disabled: false, disabledReason: null
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

	// The render callback's own live chain (resolveRollChain, roll-chain.js -- see its own DOM-level
	// coverage in tests/move-roll-dialog-chain.test.js) is what folds a checked Roll Modifier's
	// advantage/effect into the roll's own hidden [name='advantage']/[name='effect'] inputs *before*
	// Roll is ever clicked. The Roll button's own callback, exercised here without ever calling
	// .render(), just reads whatever is already sitting in those two hidden inputs -- so these tests
	// simulate the chain's already-painted state directly, the same way they always simulated a bare
	// Dice-select value.
	it("reads the roll's advantage from the (already chain-painted) hidden input, and spends the checked entry", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { rollModifiers: [advantageEntry] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "advantage",
			"[name='effect']": "none"
		}, [], [], [], [advantageEntry.key]));

		const result = await promise;
		expect(result.advantage).toBe("advantage");
		expect(result.spentRollModifiers).toEqual([advantageEntry.key]);
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
		advantage: "advantage", effect: null, reminderOnly: false, disabled: false, disabledReason: null
	};
	const halberdBundle = {
		weaponKey: "eq1",
		weaponLabel: "Halberd",
		weaponCard: { name: "Halberd", value: 1, tier: 1, scale: "foot", scaleLabel: "Foot Scale", tags: [] },
		traits: [clash],
		traitOptions: [{ key: "clash", label: "CLASH (1)" }],
		lockedEffect: "desperation",
		lockedEffectSource: "Test Source",
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
	// "no TabsV2 controller inside a bare Foundry Dialog" reason. val() tracks the currently
	// "selected" weapon key (seeded from `initialWeaponKey`, matching the template's own
	// `{{#if @first}}selected{{/if}}` default) since the render callback's own recompute() (see
	// configureMoveRoll) reads it back to resolve which bundle's own Roll Modifiers are active —
	// the wrapped handler below updates it the same way a real <select> already reflects its own
	// value by the time its own "change" event fires.
	function fakeWeaponPanelRenderHtml(initialWeaponKey) {
		const state = { handler: null, removeClassCalls: [], addClassCalls: [], weaponKey: initialWeaponKey };
		state.html = {
			find: (selector) => {
				if (selector === "[name='weapon-select']") {
					return {
						on: (event, handler) => {
							state.handler = (evt) => { state.weaponKey = evt.target.value; handler(evt); };
						},
						val: () => state.weaponKey
					};
				}
				if (selector === "[data-weapon-panel]" || selector.startsWith("[data-weapon-panel=")) {
					return {
						removeClass: (cls) => { state.removeClassCalls.push([selector, cls]); },
						addClass: (cls) => { state.addClassCalls.push([selector, cls]); }
					};
				}
				return fakeNoopJQuery();
			}
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
				{ ...halberdBundle, lockedEffectLabel: "Desperation from Test Source" }
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

		const state = fakeWeaponPanelRenderHtml(unarmedBundle.weaponKey);
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
		}, [], ["eq1::blitz"], [], [], true));

		const result = await promise;
		expect(result.spentTags).toEqual([{ equipmentId: "eq1", tagKey: "blitz" }]);
		expect(result.effect).toBe("confidence");
	});

	// The active panel's own Roll Modifiers list is what the render callback's own recompute()
	// resolves the chain against (see configureMoveRoll) — this test, which never calls .render(),
	// simulates the chain's already-painted result directly (the hidden [name='advantage'] input),
	// the same way the top-level "roll modifiers" describe block above does. spentRollModifiers
	// itself is still a dumb read of the checked [name='roll-modifier'] keys, scoped to the active
	// panel.
	it("resolves spentRollModifiers from the active panel's own rollModifiers", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash], { weaponBundles: [unarmedBundle, halberdBundle] });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='weapon-select']": halberdBundle.weaponKey,
			"[data-weapon-panel].active [name='trait']": "clash",
			"[name='advantage']": "advantage",
			"[name='effect']": "none"
		}, [], [], [], [modifierEntry.key], true));

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
