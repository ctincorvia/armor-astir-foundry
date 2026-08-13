import { beforeEach, describe, expect, it, vi } from "vitest";

import { effectState } from "../scripts/moves/roll-effects.js";
import { TRAITS } from "../scripts/core/traits.js";
import {
	BASIC_MOVES,
	FAILURE_REMINDERS,
	SPECIAL_MOVES,
	availableMoveTraits,
	buildReminders,
	moveResultTier
} from "../scripts/moves/moves.js";
import { mockRoll } from "./helpers/move-test-helpers.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const WEATHER_THE_STORM = BASIC_MOVES.find((m) => m.key === "weather-the-storm");
const BITE_THE_DUST = BASIC_MOVES.find((m) => m.key === "bite-the-dust");
const B_PLOT = SPECIAL_MOVES.find((m) => m.key === "b-plot");
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

describe("SPECIAL_MOVES - plan-and-prepare", () => {
	it("declares variableDicePool, so PlaybookActorSheet renders its own dice-pool Roll button", () => {
		expect(PLAN_AND_PREPARE.variableDicePool).toBe(true);
	});

	it("is the only special move that declares a variable dice pool", () => {
		const pooled = SPECIAL_MOVES.filter((move) => move.variableDicePool);
		expect(pooled).toEqual([PLAN_AND_PREPARE]);
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

	it("includes the extraSuccessReminder only on an actual 10+", () => {
		const none = effectState("none");
		const reminder = "If you chose to help, your ally may act with confidence in addition to advantage.";

		expect(buildReminders("success", none, null, reminder)).toEqual([reminder]);
		expect(buildReminders("mixed", none, null, reminder)).toEqual([]);
		expect(buildReminders("failure", none, null, reminder)).toEqual(FAILURE_REMINDERS);
	});

	it("omits the extraSuccessReminder slot entirely when none is passed", () => {
		expect(buildReminders("success", effectState("none"))).toEqual([]);
	});

	it("keeps extraFailureReminder and extraSuccessReminder independent when both are passed", () => {
		const none = effectState("none");

		expect(buildReminders("failure", none, "fail reminder", "success reminder")).toEqual([
			...FAILURE_REMINDERS,
			"fail reminder"
		]);
		expect(buildReminders("success", none, "fail reminder", "success reminder")).toEqual(["success reminder"]);
	});
});
