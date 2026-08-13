import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	rollMove: vi.fn()
}));

import { configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { WITCH_BOONS } from "../scripts/playbook/witch.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import {
	ALCHEMICAL_SUITE, LEAD_A_SORTIE, PATRON, EXCHANGE_BLOWS, BITE_THE_DUST, INDOMITABLE,
	READ_THE_ROOM, TRUTH_MAKING, WEAVE_MAGIC, A_GREENER_WORLD, SHARP_TONGUE
} from "./helpers/move-fixtures.js";

beforeEach(() => {
	configureMoveRoll.mockClear();
	rollMove.mockClear();
	// rollMove resolves { message, dice } (see moves.js) — a bare default so every existing test
	// that doesn't care about the roll's dice (most of them) doesn't have to configure this itself.
	rollMove.mockResolvedValue({ message: undefined, dice: null });
});

describe("PlaybookActorSheet#_onMoveResolved", () => {
	it("does nothing when not piloted", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", parts: [ALCHEMICAL_SUITE.key], piloted: false } } },
			update: vi.fn()
		};

		await sheet._onMoveResolved(LEAD_A_SORTIE, null);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir at all", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onMoveResolved(LEAD_A_SORTIE, null);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onMoveResolved - Patron's random Boon grant", () => {
	it("grants two boons on Lead a Sortie when Patron is picked, even with nothing mounted", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [PATRON.key] } },
			update: vi.fn()
		};

		await sheet._onMoveResolved(LEAD_A_SORTIE, null);

		expect(sheet.actor.update).toHaveBeenCalledTimes(1);
		const [update] = sheet.actor.update.mock.calls[0];
		const granted = update["system.attributes.witch.boons"];
		expect(granted).toHaveLength(2);
		expect(granted.every((key) => WITCH_BOONS.some((boon) => boon.key === key))).toBe(true);
	});

	it("grants nothing on a move other than Lead a Sortie", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [PATRON.key] } },
			update: vi.fn()
		};

		await sheet._onMoveResolved(EXCHANGE_BLOWS, null);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("grants nothing on Lead a Sortie when Patron isn't picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } }, update: vi.fn() };

		await sheet._onMoveResolved(LEAD_A_SORTIE, null);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("still runs the mounted-frame Astir Part effects afterward when both apply", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [PATRON.key],
					astir: { id: "a1", parts: [ALCHEMICAL_SUITE.key], piloted: true }
				}
			},
			update: vi.fn()
		};

		await sheet._onMoveResolved(LEAD_A_SORTIE, null);

		// One update for the Boon grant, one for Alchemical Suite's Potions grant — Patron's grant
		// doesn't short-circuit the existing mounted-frame branch below it.
		expect(sheet.actor.update).toHaveBeenCalledTimes(2);
		expect(sheet.actor.update.mock.calls[1][0]).toMatchObject({
			"system.attributes.astir.potions": { red: 1, blue: 1, yellow: 1 }
		});
	});
});

describe("PlaybookActorSheet#_grantedCriticalReminderForMove", () => {
	it("returns null with nothing picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._grantedCriticalReminderForMove(BITE_THE_DUST)).toBeNull();
	});

	it("fires Indomitable's universal grant for any move at all, since it declares no moveKeys", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [INDOMITABLE.key] } } };

		expect(sheet._grantedCriticalReminderForMove(BITE_THE_DUST)).toBe("You may clear a risk");
		expect(sheet._grantedCriticalReminderForMove(READ_THE_ROOM)).toBe("You may clear a risk");
	});

	it("fires Truth-making's grant only for Read the Room, not an unrelated move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [TRUTH_MAKING.key] } } };

		expect(sheet._grantedCriticalReminderForMove(READ_THE_ROOM)).toBe("You may answer one of your questions yourself");
		expect(sheet._grantedCriticalReminderForMove(BITE_THE_DUST)).toBeNull();
	});

	it("fires A Greener World's grant only for Weave Magic", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [A_GREENER_WORLD.key] } } };

		expect(sheet._grantedCriticalReminderForMove(WEAVE_MAGIC)).toBe("New flora and fauna spring to life nearby");
		expect(sheet._grantedCriticalReminderForMove(BITE_THE_DUST)).toBeNull();
	});

	it("fires Sharp Tongue's grant on Exchange Blows only when rolled with the talk trait, not clash", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [SHARP_TONGUE.key] } } };

		expect(sheet._grantedCriticalReminderForMove(EXCHANGE_BLOWS, "talk")).toBe("Your opponent is put in peril");
		expect(sheet._grantedCriticalReminderForMove(EXCHANGE_BLOWS, "clash")).toBeNull();
	});
});

describe("PlaybookActorSheet#_rollMove - addsCriticalReminderToMove wiring (extraCriticalReminder)", () => {
	it("passes Indomitable's universal reminder through to rollMove's options", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { sense: { value: 0 } }, attributes: { playbookMoves: [INDOMITABLE.key] } },
			update: vi.fn()
		};
		const sense = { key: "sense", label: "SENSE", value: 0 };
		configureMoveRoll.mockResolvedValue({ trait: sense, advantage: "none", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "read-the-room" } } });

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor,
			READ_THE_ROOM,
			sense,
			expect.objectContaining({ extraCriticalReminder: "You may clear a risk" })
		);
	});

	it("passes Sharp Tongue's reminder only when Exchange Blows is rolled with the talk trait", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { playbookMoves: [SHARP_TONGUE.key] } },
			update: vi.fn()
		};
		const talk = { key: "talk", label: "TALK", value: 0 };
		configureMoveRoll.mockResolvedValue({ trait: talk, advantage: "none", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor,
			EXCHANGE_BLOWS,
			talk,
			expect.objectContaining({ extraCriticalReminder: "Your opponent is put in peril" })
		);
	});

	it("omits extraCriticalReminder when Exchange Blows is instead rolled with clash", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { playbookMoves: [SHARP_TONGUE.key] } },
			update: vi.fn()
		};
		const clash = { key: "clash", label: "CLASH", value: 0 };
		configureMoveRoll.mockResolvedValue({ trait: clash, advantage: "none", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const [, , , options] = rollMove.mock.calls.at(-1);
		expect(options).not.toHaveProperty("extraCriticalReminder");
	});

	it("omits extraCriticalReminder entirely without any granting move picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { sense: { value: 0 } }, attributes: { playbookMoves: [] } },
			update: vi.fn()
		};
		const sense = { key: "sense", label: "SENSE", value: 0 };
		configureMoveRoll.mockResolvedValue({ trait: sense, advantage: "none", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "read-the-room" } } });

		const [, , , options] = rollMove.mock.calls.at(-1);
		expect(options).not.toHaveProperty("extraCriticalReminder");
	});
});
