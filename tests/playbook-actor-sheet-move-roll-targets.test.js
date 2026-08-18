import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	rollMove: vi.fn()
}));

import { configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { UNARMED } from "../scripts/equipment/equipment.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { EXCHANGE_BLOWS, STRIKE_DECISIVELY, DISPEL_UNCERTAINTIES } from "./helpers/move-fixtures.js";

beforeEach(() => {
	configureMoveRoll.mockClear();
	rollMove.mockClear();
	// rollMove resolves { message, dice } (see moves.js) — a bare default so every existing test
	// that doesn't care about the roll's dice (most of them) doesn't have to configure this itself.
	rollMove.mockResolvedValue({ message: undefined, dice: null });
});

// A usesWeapon move (Exchange Blows/Strike Decisively) with no weapons on the actor still offers
// exactly one weaponBundles entry — Unarmed (see PlaybookActorSheet#_rollMoveWithWeaponChoice) —
// so lockedEffect now lives on that bundle rather than at the top level, while
// lockedAdvantage/lockedTrait/rollStack/disadvantageConversion stay weapon-independent and
// top-level. objectContaining keeps this test file focused on the Tier/Approach signals it's
// actually about, rather than every derived display field the bundle also carries.
function weaponRollConfig({ lockedAdvantage = null, lockedEffect = null } = {}) {
	return {
		lockedAdvantage,
		lockedTrait: null,
		rollStack: null,
		disadvantageConversion: null,
		weaponBundles: [expect.objectContaining({ weaponKey: UNARMED, weaponLabel: "Unarmed", lockedEffect })]
	};
}

// Tier Advantage on Exchange Blows/Strike Decisively (see moves-mixin.js's _targetTierAdvantage):
// +1 higher / -1 lower / 0 equal, resolved straight to Advantage/Disadvantage. This axis is now
// independent of the Approach matchup below — see the "Tier and Approach act independently" test
// further down for the case where both signals fire at once. Field Scout's conflictTier: 2 (see
// playbook-moves.js) is used to raise the roller's Tier above the default 1, which every NPC's own
// Tier floors at too (TIER_MIN), so "higher Tier" can be exercised without it.
describe("PlaybookActorSheet#_onMoveRoll - Tier Advantage from a targeted NPC", () => {
	const clashTalkStats = { clash: { value: 0 }, talk: { value: 0 } };

	function npcTarget(tier, approach) {
		return { actor: { type: "armor-astir.npc", system: { attributes: { tier, approach } } } };
	}

	afterEach(() => {
		delete game.user.targets;
	});

	it("locks Advantage when this actor's Tier exceeds the single targeted NPC's Tier", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: clashTalkStats, attributes: { playbookMoves: ["the-scout:field-scout"] } } };
		game.user.targets = new Set([npcTarget(1)]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			expect.any(Array),
			weaponRollConfig({ lockedAdvantage: "advantage" })
		);
	});

	it("treats a targeted NPC missing its stored Tier as TIER_MIN", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: clashTalkStats, attributes: { playbookMoves: ["the-scout:field-scout"] } } };
		game.user.targets = new Set([{ actor: { type: "armor-astir.npc", system: { attributes: {} } } }]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			expect.any(Array),
			weaponRollConfig({ lockedAdvantage: "advantage" })
		);
	});

	it("does not lock Advantage when Tier is equal", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: clashTalkStats, attributes: { playbookMoves: ["the-scout:field-scout"] } } };
		game.user.targets = new Set([npcTarget(2)]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			expect.any(Array),
			weaponRollConfig()
		);
	});

	it("locks Disadvantage when the targeted NPC's Tier is higher than this actor's own", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: clashTalkStats, attributes: {} } };
		game.user.targets = new Set([npcTarget(3)]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "strike-decisively" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			STRIKE_DECISIVELY,
			expect.any(Array),
			weaponRollConfig({ lockedAdvantage: "disadvantage" })
		);
	});

	it("leaves a non-usesWeapon move unaffected even with a favorable Tier target match", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { playbookMoves: ["the-scout:field-scout"] }
			}
		};
		game.user.targets = new Set([npcTarget(1)]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			DISPEL_UNCERTAINTIES,
			expect.any(Array),
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, equipmentSpends: [], rollModifiers: [], rollStack: null, disadvantageConversion: null }
		);
	});

	// Cold Company's standing lock (see _coldCompanyAdvantage) sits ahead of this target-matchup
	// signal in the precedence chain — its haunted state resolves to "disadvantage", the opposite of
	// what the Tier match alone would compute here, so a passing test proves the ordering rather than
	// just happening to agree with it.
	it("lets Cold Company's standing Advantage-axis lock win over a higher-Tier target match", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: clashTalkStats,
				attributes: { playbookMoves: ["the-scout:field-scout", "the-wither:cold-company"] }
			}
		};
		game.user.targets = new Set([npcTarget(1)]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			expect.any(Array),
			weaponRollConfig({ lockedAdvantage: "disadvantage" })
		);
	});
});

// Approach Confidence/Desperation on Exchange Blows/Strike Decisively (see moves-mixin.js's
// _targetMatchupEffect): the type wheel (approach-matchup.js) resolves straight to Confidence
// (counters the foe's Approach) or Desperation (is countered), independently of the Tier signal
// above — this axis locks lockedEffect, not lockedAdvantage.
describe("PlaybookActorSheet#_onMoveRoll - Approach Confidence/Desperation from a targeted NPC", () => {
	const clashTalkStats = { clash: { value: 0 }, talk: { value: 0 } };

	function npcTarget(tier, approach) {
		return { actor: { type: "armor-astir.npc", system: { attributes: { tier, approach } } } };
	}

	afterEach(() => {
		delete game.user.targets;
	});

	it("locks Confidence from a favorable Approach matchup, with equal Tier", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: clashTalkStats, attributes: { approach: "mundane" } } };
		game.user.targets = new Set([npcTarget(1, "arcane")]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			expect.any(Array),
			weaponRollConfig({ lockedEffect: "confidence" })
		);
	});

	it("locks Desperation from an unfavorable Approach matchup, with equal Tier", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: clashTalkStats, attributes: { approach: "arcane" } } };
		game.user.targets = new Set([npcTarget(1, "mundane")]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			expect.any(Array),
			weaponRollConfig({ lockedEffect: "desperation" })
		);
	});

	it("treats a missing Approach on this actor as neutral, even when the targeted NPC has a real one", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: clashTalkStats, attributes: {} } };
		game.user.targets = new Set([npcTarget(1, "arcane")]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			expect.any(Array),
			weaponRollConfig()
		);
	});

	// Regression for the bug this describe block's own comment doesn't yet cover: the roller's
	// Approach used to be read straight off the character's own persisted system.attributes.approach
	// with no regard for a mounted Astir/Ardent's own, different Approach (see _effectiveApproach in
	// progression-mixin.js). Here the character's persisted Approach (arcane) is neutral against the
	// target's own (arcane vs arcane ties), but the mounted Astir's Approach (mundane) beats it — Tier
	// is held equal (both 3) so the Confidence lock below can only be coming from the Approach signal,
	// and only from the frame's Approach, not the actor's own.
	it("uses the mounted Astir's own Approach for the target matchup, not the character's persisted one", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			name: "Vanguard",
			system: {
				stats: clashTalkStats,
				attributes: {
					approach: "arcane",
					astir: { tier: 3, approach: "mundane", piloted: true }
				}
			}
		};
		game.user.targets = new Set([npcTarget(3, "arcane")]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			expect.any(Array),
			weaponRollConfig({ lockedEffect: "confidence" })
		);
	});

	// A forced weapon tag (Unreliable — see _forcedWeaponEffect) sits ahead of the target-matchup
	// Approach signal in the lockedEffect precedence chain (see _rollMove's own comment). This weapon
	// carries an unspent Unreliable tag (forces Desperation) AND the targeted NPC's Approach is
	// favorable (would compute Confidence on its own) — the forced tag has to win, proving the new
	// target-matchup signal really is the lowest-precedence Effect source, not just usually agreeing
	// with whatever else is in play.
	it("lets a forced weapon tag win over a favorable Approach target match", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = {
			id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable"], spent: [], scale: "foot", tier: 1
		};
		sheet.actor = {
			system: { stats: clashTalkStats, attributes: { approach: "mundane", equipment: [rifle] } },
			update: vi.fn()
		};
		game.user.targets = new Set([npcTarget(1, "arcane")]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			expect.any(Array),
			{ lockedEffect: "desperation", lockedAdvantage: null, lockedTrait: null, equipmentSpends: [], rollModifiers: [], rollStack: null, disadvantageConversion: null }
		);
	});
});

// Tier and Approach act independently — since the two axes no longer sum into one combined stack,
// a higher Tier plus an unfavorable Approach matchup now locks BOTH Advantage AND Desperation on
// the same roll simultaneously, rather than netting to a single Advantage/Disadvantage state.
describe("PlaybookActorSheet#_onMoveRoll - Tier and Approach lock independently", () => {
	afterEach(() => {
		delete game.user.targets;
	});

	it("locks Advantage (from Tier) and Desperation (from Approach) at once", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { playbookMoves: ["the-scout:field-scout"], approach: "arcane" }
			}
		};
		game.user.targets = new Set([{ actor: { type: "armor-astir.npc", system: { attributes: { tier: 1, approach: "mundane" } } } }]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			expect.any(Array),
			weaponRollConfig({ lockedAdvantage: "advantage", lockedEffect: "desperation" })
		);
	});
});
