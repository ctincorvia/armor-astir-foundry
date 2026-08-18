import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRAITS } from "../scripts/core/traits.js";
import { BASIC_MOVES, MOVE_CHAT_TEMPLATE, MOVE_RESULT_LABELS, rollMove } from "../scripts/moves/moves.js";
import { mockRoll } from "./helpers/move-test-helpers.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const STRIKE_DECISIVELY = BASIC_MOVES.find((m) => m.key === "strike-decisively");

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

describe("rollMove - reroll (Decisive/Defensive/Versatile)", () => {
	it("offers a reroll, and records everything needed to redo it, when the roll fails", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, {
			advantage: "none",
			effect: "none",
			weaponLabel: "Halberd",
			reroll: { equipmentId: "eq1", tagKey: "defensive", spendKey: "defensive" }
		});

		expect(renderTemplate).toHaveBeenCalledWith(
			MOVE_CHAT_TEMPLATE,
			expect.objectContaining({ reroll: true, rerollLabel: "Defensive" })
		);
		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "",
			flags: {
				"armor-astir": {
					reroll: {
						actorId: "actor1",
						moveKey: "exchange-blows",
						trait: clash,
						equipmentId: "eq1",
						tagKey: "defensive",
						// A single-move reroll tag (Defensive) keeps a plain spendKey, matching tagKey —
						// see equipment.js#rerollSpendKey. Only a multi-move tag (Versatile) produces a
						// compound one (see the dedicated Versatile tests below).
						spendKey: "defensive",
						options: { advantage: "none", effect: "none", weaponLabel: "Halberd" },
						flavorArgs: expect.any(Object)
					},
					advantageOffer: expect.any(Object)
				}
			}
		});
	});

	it("names the specific tag (Decisive) offering the reroll, not every reroll tag", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, STRIKE_DECISIVELY, clash, {
			reroll: { equipmentId: "eq1", tagKey: "decisive" }
		});

		expect(renderTemplate).toHaveBeenCalledWith(
			MOVE_CHAT_TEMPLATE,
			expect.objectContaining({ reroll: true, rerollLabel: "Decisive" })
		);
	});

	it("names the specific move (Versatile — Exchange Blows), not just the tag, for a multi-move reroll tag", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, {
			advantage: "none",
			effect: "none",
			weaponLabel: "Rifle",
			reroll: { equipmentId: "eq1", tagKey: "versatile", spendKey: "versatile:exchange-blows" }
		});

		expect(renderTemplate).toHaveBeenCalledWith(
			MOVE_CHAT_TEMPLATE,
			expect.objectContaining({ reroll: true, rerollLabel: "Versatile — Exchange Blows" })
		);
		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "",
			flags: {
				"armor-astir": {
					reroll: {
						actorId: "actor1",
						moveKey: "exchange-blows",
						trait: clash,
						equipmentId: "eq1",
						tagKey: "versatile",
						spendKey: "versatile:exchange-blows",
						options: { advantage: "none", effect: "none", weaponLabel: "Rifle" },
						flavorArgs: expect.any(Object)
					},
					advantageOffer: expect.any(Object)
				}
			}
		});
	});

	it("names the other move (Versatile — Strike Decisively) when that move is the one being rerolled", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, STRIKE_DECISIVELY, clash, {
			reroll: { equipmentId: "eq1", tagKey: "versatile", spendKey: "versatile:strike-decisively" }
		});

		expect(renderTemplate).toHaveBeenCalledWith(
			MOVE_CHAT_TEMPLATE,
			expect.objectContaining({ reroll: true, rerollLabel: "Versatile — Strike Decisively" })
		);
	});

	it("does not offer a reroll when the roll doesn't fail", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [6, 6] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { reroll: { equipmentId: "eq1", tagKey: "defensive" } });

		expect(renderTemplate).toHaveBeenCalledWith(
			MOVE_CHAT_TEMPLATE,
			expect.objectContaining({ reroll: false, rerollLabel: null })
		);
		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "",
			flags: { "armor-astir": { advantageOffer: expect.any(Object) } }
		});
	});

	it("does not offer a reroll on a failure when no reroll option was passed", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(renderTemplate).toHaveBeenCalledWith(
			MOVE_CHAT_TEMPLATE,
			expect.objectContaining({ reroll: false, rerollLabel: null })
		);
		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "",
			flags: { "armor-astir": { advantageOffer: expect.any(Object) } }
		});
	});
});

describe("rollMove - automatic success offer (Hot-blooded/Once the War's Over/The Arity Method)", () => {
	const HOT_BLOODED_SOURCE = { key: "the-impostor:hot-blooded", name: "Hot-blooded", cost: 3 };

	it("offers automatic success, and records everything needed to spend it, on a Mixed result", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [3, 4] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { automaticSuccess: [HOT_BLOODED_SOURCE] });

		expect(renderTemplate).toHaveBeenCalledWith(
			MOVE_CHAT_TEMPLATE,
			expect.objectContaining({ automaticSuccess: [HOT_BLOODED_SOURCE] })
		);
		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "",
			flags: {
				"armor-astir": {
					automaticSuccess: {
						actorId: "actor1",
						moveKey: "exchange-blows",
						flavorArgs: expect.objectContaining({ tier: "mixed", automaticSuccess: [HOT_BLOODED_SOURCE] }),
						sources: [HOT_BLOODED_SOURCE]
					},
					advantageOffer: expect.any(Object)
				}
			}
		});
	});

	it("offers automatic success on a failure the same way", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { automaticSuccess: [HOT_BLOODED_SOURCE] });

		expect(renderTemplate).toHaveBeenCalledWith(
			MOVE_CHAT_TEMPLATE,
			expect.objectContaining({ automaticSuccess: [HOT_BLOODED_SOURCE] })
		);
	});

	it("does not offer automatic success once the roll already succeeded", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [6, 6] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { automaticSuccess: [HOT_BLOODED_SOURCE] });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ automaticSuccess: [] }));
		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "",
			flags: { "armor-astir": { advantageOffer: expect.any(Object) } }
		});
	});

	it("does not offer automatic success on a failing roll when nothing was passed", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ automaticSuccess: [] }));
		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "",
			flags: { "armor-astir": { advantageOffer: expect.any(Object) } }
		});
	});

	it("carries both a reroll offer and an automatic success offer on the same failed weapon roll", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, {
			weaponLabel: "Halberd",
			reroll: { equipmentId: "eq1", tagKey: "defensive" },
			automaticSuccess: [HOT_BLOODED_SOURCE]
		});

		const rollInstance = Roll.mock.results.at(-1).value;
		const flags = rollInstance.toMessage.mock.calls.at(-1)[0].flags["armor-astir"];
		expect(flags.reroll).toBeDefined();
		expect(flags.reroll.flavorArgs).toEqual(expect.any(Object));
		expect(flags.automaticSuccess.sources).toEqual([HOT_BLOODED_SOURCE]);
	});
});

describe("rollMove - automatic success requiresTier gate (Embrace Chaos's own Upgrade)", () => {
	const HOT_BLOODED_SOURCE = { key: "the-impostor:hot-blooded", name: "Hot-blooded", cost: 3 };
	const EMBRACE_CHAOS_UPGRADE_SOURCE = {
		key: "the-witch:embrace-chaos", name: "Embrace Chaos", cost: 1, requiresTier: "mixed", buttonLabel: "Upgrade from embrace chaos"
	};

	it("offers a requiresTier: mixed source on a Mixed result", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		mockRoll({ dice: [3, 4] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { automaticSuccess: [EMBRACE_CHAOS_UPGRADE_SOURCE] });

		expect(renderTemplate).toHaveBeenCalledWith(
			MOVE_CHAT_TEMPLATE,
			expect.objectContaining({ automaticSuccess: [EMBRACE_CHAOS_UPGRADE_SOURCE] })
		);
	});

	it("does not offer a requiresTier: mixed source on a failure", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { automaticSuccess: [EMBRACE_CHAOS_UPGRADE_SOURCE] });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ automaticSuccess: [] }));
	});

	it("still offers an unrestricted source (Hot-blooded) on that same failure, proving the filter is additive/per-source", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, {
			automaticSuccess: [EMBRACE_CHAOS_UPGRADE_SOURCE, HOT_BLOODED_SOURCE]
		});

		expect(renderTemplate).toHaveBeenCalledWith(
			MOVE_CHAT_TEMPLATE,
			expect.objectContaining({ automaticSuccess: [HOT_BLOODED_SOURCE] })
		);
	});
});

describe("rollMove - downgrade offer (Embrace Chaos)", () => {
	const EMBRACE_CHAOS_SOURCE = { key: "the-witch:embrace-chaos", name: "Embrace Chaos", amount: 1 };

	it("offers downgrade, and records everything needed to spend it, on a plain 10+", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [5, 5] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { downgrade: [EMBRACE_CHAOS_SOURCE] });

		expect(renderTemplate).toHaveBeenCalledWith(
			MOVE_CHAT_TEMPLATE,
			expect.objectContaining({ downgrade: [EMBRACE_CHAOS_SOURCE] })
		);
		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "",
			flags: {
				"armor-astir": {
					downgrade: {
						actorId: "actor1",
						moveKey: "exchange-blows",
						flavorArgs: expect.objectContaining({ tier: "success", downgrade: [EMBRACE_CHAOS_SOURCE] }),
						sources: [EMBRACE_CHAOS_SOURCE]
					},
					advantageOffer: expect.any(Object)
				}
			}
		});
	});

	it("offers downgrade on a 12+ critical, the same as a plain 10+", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		mockRoll({ dice: [6, 6] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { downgrade: [EMBRACE_CHAOS_SOURCE] });

		expect(renderTemplate).toHaveBeenCalledWith(
			MOVE_CHAT_TEMPLATE,
			expect.objectContaining({ downgrade: [EMBRACE_CHAOS_SOURCE] })
		);
	});

	it("does not offer downgrade on a Mixed result", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [3, 4] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { downgrade: [EMBRACE_CHAOS_SOURCE] });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ downgrade: [] }));
		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "",
			flags: { "armor-astir": { advantageOffer: expect.any(Object) } }
		});
	});

	it("does not offer downgrade on a failure", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { downgrade: [EMBRACE_CHAOS_SOURCE] });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ downgrade: [] }));
	});

	it("does not offer downgrade on a 10+ when nothing was passed", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [5, 5] });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ downgrade: [] }));
		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "",
			flags: { "armor-astir": { advantageOffer: expect.any(Object) } }
		});
	});
});

describe("rollMove - heat up (Astir Overheating reroll)", () => {
	// Unlike reroll (failure only) and automaticSuccess (non-success only), Heat Up's own gate
	// (see PlaybookActorSheet#_availableHeatUp) carries no tier restriction of its own — it's
	// offered on a success, mixed, and failure roll alike, since the rules text ("you must take
	// the second roll even if it's worse") is a gamble the player can take on any result.
	it.each([
		["success", [6, 6]],
		["mixed", [3, 4]],
		["failure", [1, 1]]
	])("offers heat up, and records everything needed to redo the roll, on a %s result", async (tier, dice) => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice });

		await rollMove(actor, EXCHANGE_BLOWS, clash, {
			advantage: "none",
			effect: "confidence",
			weaponLabel: "Halberd",
			weaponTags: "Blitz",
			heatUp: true
		});

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ heatUp: true }));
		const rollInstance = Roll.mock.results.at(-1).value;
		const flags = rollInstance.toMessage.mock.calls.at(-1)[0].flags["armor-astir"];
		expect(flags.heatUp).toEqual({
			actorId: "actor1",
			moveKey: "exchange-blows",
			trait: clash,
			options: { advantage: "none", effect: "confidence", weaponLabel: "Halberd", weaponTags: "Blitz" },
			flavorArgs: expect.any(Object)
		});
	});

	// Unlike the Astir Moves group's own entries (always shown, disabled+tooltipped when
	// ungated), the chat-card button is omitted entirely when unavailable — there's nothing to
	// click, so nothing is rendered.
	it("does not offer heat up when options.heatUp is false", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [6, 6] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { heatUp: false });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ heatUp: false }));
		const rollInstance = Roll.mock.results.at(-1).value;
		const flags = rollInstance.toMessage.mock.calls.at(-1)[0].flags["armor-astir"];
		expect(flags.heatUp).toBeUndefined();
	});

	it("does not offer heat up when options.heatUp is omitted entirely", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [6, 6] });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ heatUp: false }));
		const rollInstance = Roll.mock.results.at(-1).value;
		const flags = rollInstance.toMessage.mock.calls.at(-1)[0].flags["armor-astir"];
		expect(flags.heatUp).toBeUndefined();
	});
});

describe("rollMove - equipment spends", () => {
	it("includes a spent equipment tag's label alongside advantage/effect conditions in the chat template", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }] });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			conditions: [{ key: "blitz", label: "Blitz" }]
		}));
	});

	it("drops a spent tag whose key no longer resolves in the catalog", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { spentTags: [{ equipmentId: "eq1", tagKey: "not-a-real-tag" }] });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ conditions: [] }));
	});

	it("renders no equipment conditions when nothing was spent", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash, {});

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ conditions: [] }));
	});
});

describe("rollMove - critical (12+)", () => {
	// A 12+ total still resolves tier "success" (moveResultTier itself stays three-valued — see
	// isCriticalResult's own comment); `critical` is the orthogonal signal layered on top. No real
	// catalog move defines a `critical` override key today, so these two fixtures exist purely to
	// exercise resolveTierValue's two branches — the default-fallback path (no test move fixture
	// used above already covers a 12+ roll at all) and the override path.
	const CRITICAL_FALLBACK_MOVE = {
		key: "test:critical-fallback",
		name: "Critical Fallback Test Move",
		traits: ["clash"],
		hold: { success: 3, mixed: 1, failure: 0 },
		results: { success: "Success text.", mixed: "Mixed text.", failure: null }
	};
	const CRITICAL_OVERRIDE_MOVE = {
		key: "test:critical-override",
		name: "Critical Override Test Move",
		traits: ["clash"],
		hold: { success: 3, mixed: 1, failure: 0, critical: 3 },
		results: { success: "Success text.", mixed: "Mixed text.", failure: null, critical: "Critical text." }
	};

	it("reports tier success (not a fourth tier) with critical true on a 12+", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } }, update: vi.fn() };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [6, 6] });

		await rollMove(actor, CRITICAL_FALLBACK_MOVE, clash);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "success",
			critical: true,
			tierLabel: MOVE_RESULT_LABELS.critical
		}));
	});

	it("reports critical false on a plain 10-11 success", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } }, update: vi.fn() };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [5, 5] });

		await rollMove(actor, CRITICAL_FALLBACK_MOVE, clash);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "success",
			critical: false,
			tierLabel: MOVE_RESULT_LABELS.success
		}));
	});

	it("falls back to the move's own success hold/results when no critical key is defined", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } }, update: vi.fn() };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [6, 6] });

		await rollMove(actor, CRITICAL_FALLBACK_MOVE, clash);

		expect(actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": CRITICAL_FALLBACK_MOVE.hold.success });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			hold: CRITICAL_FALLBACK_MOVE.hold.success,
			resultText: CRITICAL_FALLBACK_MOVE.results.success
		}));
	});

	it("uses the move's own critical hold/results when one is explicitly defined", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } }, update: vi.fn() };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [6, 6] });

		await rollMove(actor, CRITICAL_OVERRIDE_MOVE, clash);

		expect(actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": CRITICAL_OVERRIDE_MOVE.hold.critical });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			hold: CRITICAL_OVERRIDE_MOVE.hold.critical,
			resultText: CRITICAL_OVERRIDE_MOVE.results.critical
		}));
	});

	it("includes extraCriticalReminder only on a 12+, alongside a plain extraSuccessReminder", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } }, update: vi.fn() };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [6, 6] });

		await rollMove(actor, CRITICAL_FALLBACK_MOVE, clash, {
			extraSuccessReminder: "success reminder", extraCriticalReminder: "critical reminder"
		});

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			reminders: ["success reminder", "critical reminder"]
		}));
	});

	it("omits extraCriticalReminder on a plain 10-11 success even when one is passed", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } }, update: vi.fn() };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [5, 5] });

		await rollMove(actor, CRITICAL_FALLBACK_MOVE, clash, { extraCriticalReminder: "critical reminder" });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			reminders: null
		}));
	});

	it("carries extraCriticalReminder on advantageOffer so a retroactive Advantage add can rebuild it", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } }, update: vi.fn() };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [5, 5] });

		const message = await rollMove(actor, CRITICAL_FALLBACK_MOVE, clash, { extraCriticalReminder: "critical reminder" });

		expect(message).toBeDefined();
		expect(Roll.mock.results.at(-1).value.toMessage).toHaveBeenCalledWith(expect.objectContaining({
			flags: {
				"armor-astir": expect.objectContaining({
					advantageOffer: expect.objectContaining({ extraCriticalReminder: "critical reminder" })
				})
			}
		}));
	});
});
