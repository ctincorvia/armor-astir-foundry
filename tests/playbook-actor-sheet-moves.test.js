import { beforeEach, describe, expect, it, vi } from "vitest";

// findCarrierActors defaults to no Carriers in the world, matching this file's existing
// fixtures' behavior under the real implementation (game.actors.filter defaults to [] — see
// tests/setup.js) — overridden per-test below for the Crew Support-reads-off-the-Carrier
// regression guard.
vi.mock("../scripts/world-actors/carrier-actor-sheet.js", async (importOriginal) => ({
	...(await importOriginal()),
	findCarrierActors: vi.fn(() => [])
}));

import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { findCarrierActors } from "../scripts/world-actors/carrier-actor-sheet.js";
import { MASKING_BOON, TRICKSTERS_BOON } from "./helpers/move-fixtures.js";

beforeEach(() => {
	findCarrierActors.mockClear();
	findCarrierActors.mockReturnValue([]);
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
						trackers: []
					},
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
						trackers: []
					},
					{
						key: "crew-support",
						name: "Crew Support",
						traits: [],
						// No Carrier exists in this fixture's world, so CREW reads as 0 — requiresCrew
						// gates the move, the same "nothing to draw hold from" treatment b-plot's own
						// CHANNEL-based gating gets above.
						gated: true,
						rollable: false,
						activatable: false,
						summonable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: [],
						trackers: [{ key: "hold", label: "Hold", min: 0, max: 3, value: 0 }]
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
						trackers: []
					},
					{
						key: "plan-and-prepare",
						name: "Plan & Prepare",
						traits: [],
						gated: false,
						rollable: false,
						activatable: false,
						summonable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: [],
						trackers: [],
						variableDiceRoll: true
					}
				]
			}
		]);
	});

	it("omits a move's disabled traits from the trait list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 1, disabled: true }, talk: { value: 0 } } } };

		const data = sheet.getData();

		expect(data.moveGroups[0].moves.find((m) => m.key === "exchange-blows").traits)
			.toEqual([{ key: "talk", label: "TALK", value: 0 }]);
	});

	// Regression guard: Crew Support's hold tracker (see moves-mixin.js's _moveGroupMoves) must
	// read off the world's Carrier, never off this actor's own (now-stale) moveTrackers entry --
	// that per-character copy is exactly the bug this feature moved away from (see special-moves.js).
	it("reads Crew Support's tracker value off the Carrier, not a stale per-character moveTrackers entry", () => {
		findCarrierActors.mockReturnValue([{ system: { attributes: { crewSupportHold: 2 } } }]);
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { moveTrackers: { "crew-support": { hold: 99 } } }
			}
		};

		const data = sheet.getData();
		const specialMoves = data.moveGroups.find((group) => group.label === "Special Moves");
		const crewSupport = specialMoves.moves.find((move) => move.key === "crew-support");

		expect(crewSupport.trackers).toEqual([{ key: "hold", label: "Hold", min: 0, max: 3, value: 2 }]);
	});
});

describe("PlaybookActorSheet#getData - moves - Patron Boons", () => {
	it("omits the Patron Boons group with no boons held", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.moveGroups.some((group) => group.label === "Patron Boons")).toBe(false);
	});

	it("omits the Patron Boons group when every held key is stale", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { witch: { boons: ["witch-boon:deleted"] } } } };

		const data = sheet.getData();

		expect(data.moveGroups.some((group) => group.label === "Patron Boons")).toBe(false);
	});

	it("renders a read-only group for every held boon, with Masking Boon rollable at +CHANNEL", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 2 } },
				attributes: { witch: { boons: [MASKING_BOON.key, TRICKSTERS_BOON.key] } }
			}
		};

		const data = sheet.getData();
		const group = data.moveGroups.find((g) => g.label === "Patron Boons");

		expect(group).toBeTruthy();
		expect(group.addable).toBeUndefined();
		expect(group.removable).toBeUndefined();
		expect(group.moves.map((move) => move.key)).toEqual([MASKING_BOON.key, TRICKSTERS_BOON.key]);

		const masking = group.moves.find((move) => move.key === MASKING_BOON.key);
		expect(masking.rollable).toBe(true);
		expect(masking.traits).toEqual([{ key: "channel", label: "CHANNEL", value: 2 }]);

		const tricksters = group.moves.find((move) => move.key === TRICKSTERS_BOON.key);
		expect(tricksters.rollable).toBe(false);
	});
});

// The Arcanist's Prepared Rituals (arcanist-mixin.js) — one read-only entry per prepared slot,
// gated the same way Patron Boons is immediately above, and inserted right after it.
describe("PlaybookActorSheet#getData - moves - Prepared Rituals", () => {
	it("omits the Prepared Rituals group with nothing prepared", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.moveGroups.some((group) => group.label === "Prepared Rituals")).toBe(false);
	});

	it("appears immediately after Patron Boons when both are present", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					witch: { boons: [MASKING_BOON.key] },
					arcanist: { rituals: [{ ritualKey: "arcanist-ritual:warding" }, null, null] }
				}
			}
		};

		const labels = sheet.getData().moveGroups.map((group) => group.label);
		const patronIndex = labels.indexOf("Patron Boons");
		const ritualsIndex = labels.indexOf("Prepared Rituals");

		expect(patronIndex).toBeGreaterThanOrEqual(0);
		expect(ritualsIndex).toBe(patronIndex + 1);
	});

	it("appears with no addable/removable controls, and no Astir group present", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: {}, attributes: { arcanist: { rituals: [{ ritualKey: "arcanist-ritual:aspect" }, null, null] } } }
		};

		const data = sheet.getData();
		const group = data.moveGroups.find((g) => g.label === "Prepared Rituals");

		expect(group).toBeTruthy();
		expect(group.addable).toBeUndefined();
		expect(group.removable).toBeUndefined();
		expect(group.moves).toHaveLength(1);
	});

	it("renders the Aspect ritual entry activatable, gated once its own Spent flag is already checked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					arcanist: { rituals: [{ ritualKey: "arcanist-ritual:aspect" }, null, null] },
					moveUses: { "the-arcanist:prepare-rituals": { "ritual-1": true } }
				}
			}
		};

		const data = sheet.getData();
		const [entry] = data.moveGroups.find((g) => g.label === "Prepared Rituals").moves;

		expect(entry.activatable).toBe(true);
		expect(entry.gated).toBe(true);
	});

	it("renders an unspent Aspect ritual entry activatable and ungated", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: {}, attributes: { arcanist: { rituals: [{ ritualKey: "arcanist-ritual:aspect" }, null, null] } } }
		};

		const data = sheet.getData();
		const [entry] = data.moveGroups.find((g) => g.label === "Prepared Rituals").moves;

		expect(entry.activatable).toBe(true);
		expect(entry.gated).toBe(false);
	});

	it("renders a confidence/Warding ritual entry non-rollable, non-activatable (Chat/Info only)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: {}, attributes: { arcanist: { rituals: [{ ritualKey: "arcanist-ritual:warding" }, null, null] } } }
		};

		const data = sheet.getData();
		const [entry] = data.moveGroups.find((g) => g.label === "Prepared Rituals").moves;

		expect(entry.rollable).toBe(false);
		expect(entry.activatable).toBe(false);
	});
});
