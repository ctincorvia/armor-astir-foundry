import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn()
}));

vi.mock("../scripts/frames/astir.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseAstirPart: vi.fn(),
	chooseAstirWeapon: vi.fn()
}));

// findCarrierActors defaults to no Carriers in the world, matching every other sheet test file's
// own stance — needed here since getData's move-trait resolution reaches it regardless of which
// feature is under test.
vi.mock("../scripts/world-actors/carrier-actor-sheet.js", async (importOriginal) => ({
	...(await importOriginal()),
	findCarrierActors: vi.fn(() => [])
}));

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	postGuidedResult: vi.fn(),
	rollMove: vi.fn()
}));

import { BASIC_MOVES, configureMoveRoll, postGuidedResult, rollMove } from "../scripts/moves/moves.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const AINT_NO_GRAVE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-revenant:aint-no-grave");
const NEVER_QUITE_FREE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-revenant:never-quite-free");
const I_KNOW_YOU = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-revenant:i-know-you");

beforeEach(() => {
	foundry.utils.randomID.mockReturnValue("test-id");
	configureMoveRoll.mockClear();
	postGuidedResult.mockClear();
	rollMove.mockClear();
	// rollMove resolves { message, dice, tier } (see moves.js) — a bare default so every test that
	// doesn't care about the roll's own outcome doesn't have to configure this itself.
	rollMove.mockResolvedValue({ message: undefined, dice: null, tier: undefined });
});

describe("PlaybookActorSheet#_availableAutomaticSuccess - Ain't No Grave (costless)", () => {
	it("offers Ain't No Grave on an arbitrary other move once picked, with no hold/uses state on the actor at all", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [AINT_NO_GRAVE.key] } } };

		const offered = sheet._availableAutomaticSuccess(EXCHANGE_BLOWS);

		expect(offered).toContainEqual({
			key: AINT_NO_GRAVE.key,
			name: "Ain't No Grave",
			excludeMoves: ["the-revenant:never-quite-free"]
		});
	});

	it("does not offer Ain't No Grave when it hasn't been picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		const offered = sheet._availableAutomaticSuccess(EXCHANGE_BLOWS);

		expect(offered.some((source) => source.key === AINT_NO_GRAVE.key)).toBe(false);
	});

	it("does not offer Ain't No Grave on Never Quite Free itself, even when picked (excludeMoves)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [AINT_NO_GRAVE.key] } } };

		const offered = sheet._availableAutomaticSuccess(NEVER_QUITE_FREE);

		expect(offered.some((source) => source.key === AINT_NO_GRAVE.key)).toBe(false);
	});
});

describe("PlaybookActorSheet#_moveTraits - I Know You's live FAMILIARITY", () => {
	it("reflects the actor's own familiarity stat rather than the move's static fixedTraits literal", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { familiarity: { value: 1 } },
				attributes: { playbookMoves: [I_KNOW_YOU.key] }
			}
		};

		expect(sheet._moveTraits(I_KNOW_YOU)).toEqual([{ key: "familiarity", label: "FAMILIARITY", value: 1 }]);
	});

	it("falls back to 3 when system.stats.familiarity is absent", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { playbookMoves: [I_KNOW_YOU.key] } } };

		expect(sheet._moveTraits(I_KNOW_YOU)).toEqual([{ key: "familiarity", label: "FAMILIARITY", value: 3 }]);
	});
});
