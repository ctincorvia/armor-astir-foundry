import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/playbook-moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseNpcMove: vi.fn()
}));

vi.mock("../scripts/moves/move-roll.js", async (importOriginal) => ({
	...(await importOriginal()),
	postMoveDescription: vi.fn()
}));

import { chooseNpcMove, findPlaybookMove } from "../scripts/moves/playbook-moves.js";
import { postMoveDescription } from "../scripts/moves/move-roll.js";
import { NpcActorSheet } from "../scripts/world-actors/npc-actor-sheet.js";
import { DENY, INDOMITABLE } from "./helpers/move-fixtures.js";

beforeEach(() => {
	chooseNpcMove.mockClear();
	postMoveDescription.mockClear();
});

describe("NpcActorSheet#_npcMoves", () => {
	it("defaults to an empty list when unset", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: {} };

		expect(sheet._npcMoves()).toEqual([]);
	});

	it("reads the stored keys", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { npcMoves: [DENY.key] } } };

		expect(sheet._npcMoves()).toEqual([DENY.key]);
	});
});

describe("NpcActorSheet#getData - moves", () => {
	it("resolves stored npcMoves keys to display entries via resolvePlaybookMoves", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { name: "Warhound", system: { attributes: { npcMoves: [DENY.key, INDOMITABLE.key] } } };

		expect(sheet.getData().moves).toEqual([
			{ key: DENY.key, name: DENY.name },
			{ key: INDOMITABLE.key, name: INDOMITABLE.name }
		]);
	});

	it("drops a stale key rather than throwing", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { name: "Warhound", system: { attributes: { npcMoves: [DENY.key, "not-a-real-move"] } } };

		expect(sheet.getData().moves).toEqual([{ key: DENY.key, name: DENY.name }]);
	});

	it("defaults to an empty list when npcMoves is unset", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { name: "Warhound", system: { attributes: {} } };

		expect(sheet.getData().moves).toEqual([]);
	});
});

describe("NpcActorSheet#_onMoveAdd", () => {
	it("opens the NPC picker and appends the chosen key", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { npcMoves: [DENY.key] } }, update: vi.fn() };
		chooseNpcMove.mockResolvedValue(INDOMITABLE.key);

		await sheet._onMoveAdd();

		expect(chooseNpcMove).toHaveBeenCalledWith([DENY.key]);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.npcMoves": [DENY.key, INDOMITABLE.key]
		});
	});

	it("treats a missing npcMoves array as empty", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };
		chooseNpcMove.mockResolvedValue(DENY.key);

		await sheet._onMoveAdd();

		expect(chooseNpcMove).toHaveBeenCalledWith([]);
		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.npcMoves": [DENY.key] });
	});

	it("does nothing when the picker is cancelled", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { npcMoves: [] } }, update: vi.fn() };
		chooseNpcMove.mockResolvedValue(null);

		await sheet._onMoveAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the chosen key is already present", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { npcMoves: [DENY.key] } }, update: vi.fn() };
		chooseNpcMove.mockResolvedValue(DENY.key);

		await sheet._onMoveAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onMoveRemove", () => {
	it("filters out the referenced key", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { npcMoves: [DENY.key, INDOMITABLE.key] } }, update: vi.fn() };

		sheet._onMoveRemove({ currentTarget: { dataset: { move: DENY.key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.npcMoves": [INDOMITABLE.key] });
	});

	it("does nothing when the key isn't present", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { npcMoves: [DENY.key] } }, update: vi.fn() };

		sheet._onMoveRemove({ currentTarget: { dataset: { move: INDOMITABLE.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onMoveDescription", () => {
	it("resolves the move and posts its description to chat", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: DENY.key } } });

		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, findPlaybookMove(DENY.key));
	});

	it("does nothing for a key that doesn't resolve", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "not-a-real-move" } } });

		expect(postMoveDescription).not.toHaveBeenCalled();
	});
});
