import { beforeEach, describe, expect, it, vi } from "vitest";

// _availableDowngrade (move-grants-mixin.js) mirrors _availableAutomaticSuccess's own moves/
// excludeMoves scoping fields, but grantsDowngradeHold has exactly one real source today (Embrace
// Chaos), and it's deliberately unscoped -- the rules text ("hold 1, which you may spend ... to
// upgrade a result of 7-9 to a 10+") never restricts which move the upgrade half applies to, so no
// catalog entry ever sets `moves`/`excludeMoves`. That leaves both scoping branches unreachable
// through real content alone (moves.js#_availableAutomaticSuccess's own moves/excludeMoves
// branches, by contrast, are naturally covered since The Arity Method/Dark Rebirth and Ain't No
// Grave really do use them).
//
// Appending fixtures onto ALL_PLAYBOOK_MOVES (rather than all-moves.js's own ALL_MOVES, the
// precedent playbook-actor-sheet-move-roll-quickroll.test.js uses) is what's actually needed here:
// _availableDowngrade's own pickedKeys gate runs every entry through
// resolvePlaybookMoves(this._playbookMoves()) first, and that helper resolves against
// ALL_PLAYBOOK_MOVES, not ALL_MOVES directly -- a synthetic move that only exists on ALL_MOVES
// would never be resolved as "picked". resolvePlaybookMoves itself is re-implemented against the
// extended array (rather than left as the passthrough importOriginal() would give) since the
// original function's own module-scoped ALL_PLAYBOOK_MOVES reference was already bound at its
// definition time and wouldn't see this override. all-moves.js is left unmocked -- it imports
// ALL_PLAYBOOK_MOVES from playbook-moves.js at module-evaluation time, so its own derived
// ALL_MOVES picks up the mocked array automatically, the same way every other test in this
// codebase that mocks one barrel and relies on a second, unmocked module's eager import already
// does (see all-moves.js's own comment on ASTIR_MOVE_CATALOG/ARDENT_PART_CATALOG).
vi.mock("../scripts/moves/playbook-moves.js", async (importOriginal) => {
	const original = await importOriginal();
	const ALL_PLAYBOOK_MOVES = [
		...original.ALL_PLAYBOOK_MOVES,
		{
			key: "test:downgrade-scoped",
			name: "Downgrade Scoped Test Move",
			traits: [],
			grantsDowngradeHold: { amount: 1, moves: ["test:downgrade-target-a"] }
		},
		{
			key: "test:downgrade-excluded",
			name: "Downgrade Excluded Test Move",
			traits: [],
			grantsDowngradeHold: { amount: 1, excludeMoves: ["test:downgrade-target-b"] }
		}
	];
	return {
		...original,
		ALL_PLAYBOOK_MOVES,
		resolvePlaybookMoves: (keys = []) => keys.map((key) => ALL_PLAYBOOK_MOVES.find((m) => m.key === key)).filter(Boolean)
	};
});

import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("PlaybookActorSheet#_availableDowngrade - moves/excludeMoves scoping", () => {
	it("offers a moves-scoped source for a move key it names", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: ["test:downgrade-scoped"] } } };

		expect(sheet._availableDowngrade({ key: "test:downgrade-target-a" }).map((s) => s.key))
			.toContain("test:downgrade-scoped");
	});

	it("withholds a moves-scoped source for a move key it doesn't name", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: ["test:downgrade-scoped"] } } };

		expect(sheet._availableDowngrade({ key: "test:downgrade-target-b" }).map((s) => s.key))
			.not.toContain("test:downgrade-scoped");
	});

	it("offers an excludeMoves source for a move key it doesn't exclude", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: ["test:downgrade-excluded"] } } };

		expect(sheet._availableDowngrade({ key: "test:downgrade-target-a" }).map((s) => s.key))
			.toContain("test:downgrade-excluded");
	});

	it("withholds an excludeMoves source for the one move key it excludes", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: ["test:downgrade-excluded"] } } };

		expect(sheet._availableDowngrade({ key: "test:downgrade-target-b" }).map((s) => s.key))
			.not.toContain("test:downgrade-excluded");
	});
});
