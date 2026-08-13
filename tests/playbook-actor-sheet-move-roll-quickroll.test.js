import { beforeEach, describe, expect, it, vi } from "vitest";

// A defensive-only scenario: no real content ships a quickRollsMove whose moveKey fails to
// resolve (Bureaucrat's own "exchange-blows" always resolves), but _onMoveRoll's second
// `if (!move) return` guard (move-roll-mixin.js) still needs coverage for the 100% branch gate.
// Appending one broken fixture move onto the real ALL_MOVES list (rather than replacing it
// outright) keeps every other real move/catalog entry — and WEAPON_MOVES' own filter over them —
// intact for anything else this module touches at load time.
vi.mock("../scripts/moves/all-moves.js", async (importOriginal) => {
	const original = await importOriginal();
	return {
		...original,
		ALL_MOVES: [
			...original.ALL_MOVES,
			{
				key: "test:broken-quick-roll",
				name: "Broken Quick Roll",
				traits: ["talk"],
				quickRollsMove: { moveKey: "this-key-does-not-exist", trait: "talk", reminders: ["unreachable"] }
			}
		]
	};
});

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	rollMove: vi.fn()
}));

import { configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

beforeEach(() => {
	configureMoveRoll.mockClear();
	rollMove.mockClear();
});

describe("PlaybookActorSheet#_onMoveRoll - quickRollsMove pointing at an unresolved move key", () => {
	it("does nothing when quickRollsMove.moveKey doesn't resolve to a real move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { talk: { value: 0 } } } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "test:broken-quick-roll" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});
});
