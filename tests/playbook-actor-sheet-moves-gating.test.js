import { beforeEach, describe, expect, it, vi } from "vitest";

// findCarrierActors defaults to no Carriers in the world, matching every other move-roll test
// file's own convention (see playbook-actor-sheet-move-rolls.test.js).
vi.mock("../scripts/world-actors/carrier-actor-sheet.js", async (importOriginal) => ({
	...(await importOriginal()),
	findCarrierActors: vi.fn(() => [])
}));

import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { findCarrierActors } from "../scripts/world-actors/carrier-actor-sheet.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const NEVER_QUITE_FREE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-revenant:never-quite-free");

beforeEach(() => {
	findCarrierActors.mockClear();
	findCarrierActors.mockReturnValue([]);
});

describe("PlaybookActorSheet#getData - gated moves", () => {
	it("gates weave magic's Roll button when CHANNEL is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		const weaveMagic = data.moveGroups[0].moves.find((m) => m.key === "weave-magic");
		expect(weaveMagic.gated).toBe(true);
		expect(weaveMagic.traits).toEqual([]);
	});

	it("un-gates weave magic once CHANNEL is enabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		const weaveMagic = data.moveGroups[0].moves.find((m) => m.key === "weave-magic");
		expect(weaveMagic.gated).toBe(false);
		expect(weaveMagic.traits).toEqual([{ key: "channel", label: "CHANNEL", value: 1 }]);
	});

	it("never gates help or hinder, which has no stat traits by design", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.moveGroups[0].moves.find((m) => m.key === "help-or-hinder").gated).toBe(false);
	});

	function specialGroup(data) {
		return data.moveGroups.find((g) => g.label === "Special Moves");
	}

	it("gates b-plot when CHANNEL is enabled, the mirror image of weave magic", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		expect(specialGroup(data).moves.find((m) => m.key === "b-plot").gated).toBe(true);
	});

	it("gates b-plot when CHANNEL is missing from stats (reads as enabled)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(specialGroup(data).moves.find((m) => m.key === "b-plot").gated).toBe(true);
	});

	it("un-gates b-plot once CHANNEL is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		expect(specialGroup(data).moves.find((m) => m.key === "b-plot").gated).toBe(false);
	});

	it("never gates lead a sortie off CHANNEL, unlike b-plot", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		// Subsystems used to live alongside lead-a-sortie here too, but it's moved to the Astir
		// Moves group (see _movesData) — its gating is now mount-based, not CHANNEL-based, and is
		// covered in tests/playbook-actor-sheet-astir.test.js instead.
		expect(specialGroup(data).moves.find((m) => m.key === "lead-a-sortie").gated).toBe(false);
	});

	it("gates Crew Support when the world's Carrier CREW is 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(specialGroup(data).moves.find((m) => m.key === "crew-support").gated).toBe(true);
	});

	it("un-gates Crew Support once the world's Carrier has nonzero CREW", () => {
		findCarrierActors.mockReturnValue([{ id: "carrier1", system: { stats: { crew: { value: 2 } } } }]);
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(specialGroup(data).moves.find((m) => m.key === "crew-support").gated).toBe(false);
	});

	it("leaves an ordinary move (requiresCrew absent) ungated regardless of the world's Carrier CREW", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.moveGroups[0].moves.find((m) => m.key === "help-or-hinder").gated).toBe(false);
	});

	it("also greys out b-plot's Description button when CHANNEL is enabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		expect(specialGroup(data).moves.find((m) => m.key === "b-plot").descriptionGated).toBe(true);
	});

	it("un-greys b-plot's Description button once CHANNEL is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		expect(specialGroup(data).moves.find((m) => m.key === "b-plot").descriptionGated).toBe(false);
	});

	it("never greys out weave magic's Description button, unlike b-plot", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		const weaveMagic = data.moveGroups[0].moves.find((m) => m.key === "weave-magic");
		expect(weaveMagic.gated).toBe(true);
		expect(weaveMagic.descriptionGated).toBe(false);
	});

	it("gates bite the dust's Roll button once Never Quite Free is picked, with a tooltip explaining why", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: {}, attributes: { playbookMoves: [NEVER_QUITE_FREE.key] } }
		};

		const data = sheet.getData();

		const biteTheDust = data.moveGroups[0].moves.find((m) => m.key === "bite-the-dust");
		expect(biteTheDust.gated).toBe(true);
		expect(biteTheDust.gatedTooltip).toBe("Replaced by Never Quite Free");
	});

	// You Should See Me In A Crown's real requiresMoves: ["the-icon:touchstone"] — the picker-time
	// gating is covered in tests/playbook-moves.test.js; this covers the live re-gating on an
	// already-picked move's own Roll button (see moves-mixin.js's _moveGroupMoves).
	const CROWN_KEY = "the-icon:you-should-see-me-in-a-crown";
	const TOUCHSTONE_KEY = "the-icon:touchstone";

	it("gates an already-picked move's Roll button when its requiresMoves prerequisite is missing", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { playbookMoves: [CROWN_KEY] } } };

		const data = sheet.getData();

		const crown = data.moveGroups[1].moves.find((m) => m.key === CROWN_KEY);
		expect(crown.gated).toBe(true);
		expect(crown.gatedTooltip).toBe("Requires Touchstone");
	});

	it("un-gates that move once its prerequisite is picked too", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { playbookMoves: [CROWN_KEY, TOUCHSTONE_KEY] } } };

		const data = sheet.getData();

		const crown = data.moveGroups[1].moves.find((m) => m.key === CROWN_KEY);
		expect(crown.gated).toBe(false);
		expect(crown.gatedTooltip).toBeUndefined();
	});

	it("re-gates the move live if its prerequisite is removed after having been picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { playbookMoves: [CROWN_KEY, TOUCHSTONE_KEY] } } };
		expect(sheet.getData().moveGroups[1].moves.find((m) => m.key === CROWN_KEY).gated).toBe(false);

		// Touchstone removed from the actor's playbookMoves — same actor object, no other state change.
		sheet.actor.system.attributes.playbookMoves = [CROWN_KEY];

		const crown = sheet.getData().moveGroups[1].moves.find((m) => m.key === CROWN_KEY);
		expect(crown.gated).toBe(true);
		expect(crown.gatedTooltip).toBe("Requires Touchstone");
	});

	// No real move carries requiresParts yet (mechanism-only, per docs/domains/frames.md's Astir section), so the
	// requiresParts half of this gating is exercised directly against _moveGroupMoves, the same
	// pattern tests/playbook-actor-sheet-summoner.test.js already uses for Eidolon Drive.
	it("gates a move whose requiresParts isn't met by the actor's installed Astir Parts", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { astir: { parts: [] } } } };
		const fixture = {
			key: "fixture:gated-by-part",
			name: "Fixture",
			traits: [],
			requiresParts: ["astir-part:familiar-matrix"]
		};

		const [entry] = sheet._moveGroupMoves([fixture]);

		expect(entry.gated).toBe(true);
		expect(entry.gatedTooltip).toBe("Requires Familiar Matrix Astir Part");
	});

	it("un-gates that move once the required Astir Part is installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { astir: { parts: ["astir-part:familiar-matrix"] } } } };
		const fixture = {
			key: "fixture:gated-by-part",
			name: "Fixture",
			traits: [],
			requiresParts: ["astir-part:familiar-matrix"]
		};

		const [entry] = sheet._moveGroupMoves([fixture]);

		expect(entry.gated).toBe(false);
		expect(entry.gatedTooltip).toBeUndefined();
	});

	it("combines a requiresMoves and requiresParts tooltip when both are unmet on the same move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { playbookMoves: [], astir: { parts: [] } } } };
		const fixture = {
			key: "fixture:gated-by-both",
			name: "Fixture",
			traits: [],
			requiresMoves: [TOUCHSTONE_KEY],
			requiresParts: ["astir-part:familiar-matrix"]
		};

		const [entry] = sheet._moveGroupMoves([fixture]);

		expect(entry.gated).toBe(true);
		expect(entry.gatedTooltip).toBe("Requires Touchstone; Requires Familiar Matrix Astir Part");
	});
});
