import { describe, expect, it } from "vitest";

import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

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
						traitBonusChoosable: false,
						traitBonusChoice: "",
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
						traitBonusChoosable: false,
						traitBonusChoice: "",
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
						traitBonusChoosable: false,
						traitBonusChoice: "",
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

		expect(data.moveGroups[0].moves[0].traits).toEqual([{ key: "talk", label: "TALK", value: 0 }]);
	});
});
