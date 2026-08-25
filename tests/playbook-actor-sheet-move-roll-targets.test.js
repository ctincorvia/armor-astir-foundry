import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	rollMove: vi.fn()
}));

import { configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { UNARMED, findEquipmentTag } from "../scripts/equipment/equipment.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { EXCHANGE_BLOWS, STRIKE_DECISIVELY, DISPEL_UNCERTAINTIES } from "./helpers/move-fixtures.js";
import { soleWeaponBundle } from "./helpers/move-test-helpers.js";

beforeEach(() => {
	configureMoveRoll.mockClear();
	rollMove.mockClear();
	// rollMove resolves { message, dice } (see moves.js) — a bare default so every existing test
	// that doesn't care about the roll's dice (most of them) doesn't have to configure this itself.
	rollMove.mockResolvedValue({ message: undefined, dice: null });
});

// Tier's own forced Roll Modifier (see move-grants-mixin.js's _targetTierRollModifier) —
// composes with every other Advantage-axis source (no masking, no lockedAdvantage — see
// docs/domains/moves.md).
function tierRollModifier(advantage) {
	return {
		key: "target-tier-matchup",
		label: advantage === "advantage" ? "Tier Advantage" : "Tier Disadvantage",
		description: "This roll's Tier advantage/disadvantage against the currently targeted NPC.",
		advantage,
		effect: null,
		requiresAdvantage: null,
		reminderOnly: false,
		deferred: false,
		disabled: false,
		disabledReason: null,
		forced: true
	};
}

// Approach's own forced Roll Modifier (see move-grants-mixin.js's _targetMatchupRollModifier) —
// masked to null whenever lockedEffect is set, but not masked against a forced weapon tag (see
// the "compose, not compete" test below).
function approachRollModifier(effect) {
	return {
		key: "target-approach-matchup",
		label: effect === "confidence" ? "Approach Confidence" : "Approach Desperation",
		description: "This roll's Approach confidence/desperation against the currently targeted NPC.",
		advantage: null,
		effect,
		requiresAdvantage: null,
		reminderOnly: false,
		deferred: false,
		disabled: false,
		disabledReason: null,
		forced: true
	};
}

const COLD_COMPANY_HAUNTED_ROLL_MODIFIER = {
	key: "cold-company-advantage",
	label: "Cold Company: Haunted",
	description: expect.any(String),
	advantage: "disadvantage",
	effect: null,
	requiresAdvantage: null,
	reminderOnly: false,
	deferred: false,
	disabled: false,
	disabledReason: null,
	forced: true
};

const UNRELIABLE_ROLL_MODIFIER = {
	key: "forced-weapon-effect-unreliable",
	label: findEquipmentTag("unreliable").label,
	description: findEquipmentTag("unreliable").description,
	advantage: null,
	effect: "desperation",
	requiresAdvantage: null,
	reminderOnly: false,
	deferred: false,
	disabled: false,
	disabledReason: null,
	forced: true
};

// A usesWeapon move (Exchange Blows/Strike Decisively) with no weapons on the actor still offers
// exactly one weaponBundles entry — Unarmed (see PlaybookActorSheet#_rollMoveWithWeaponChoice) —
// so lockedEffect/rollModifiers now live on that bundle rather than at the top level, while
// lockedTrait stays weapon-independent and top-level. There is no lockedAdvantage anymore — every
// Advantage-axis source (Tier included) surfaces as a forced Roll Modifier entry instead (see
// docs/domains/moves.md). objectContaining keeps this test file focused on the Tier/Approach
// signals it's actually about, rather than every derived display field the bundle also carries.
function weaponRollConfig({ lockedEffect = null, rollModifiers = [] } = {}) {
	return {
		lockedTrait: null,
		riders: [],
		weaponBundles: [expect.objectContaining({ weaponKey: UNARMED, weaponLabel: "Unarmed", lockedEffect, rollModifiers })]
	};
}

// Tier Advantage on Exchange Blows/Strike Decisively (see moves-mixin.js's _targetTierAdvantage):
// +1 higher / -1 lower / 0 equal, resolved straight to Advantage/Disadvantage, surfaced as a
// forced Roll Modifier entry. This axis is now independent of the Approach matchup below — see the
// "Tier and Approach act independently" describe further down for the case where both signals fire
// at once. Field Scout's conflictTier: 2 (see playbook-moves.js) is used to raise the roller's Tier
// above the default 1, which every NPC's own Tier floors at too (TIER_MIN), so "higher Tier" can be
// exercised without it.
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
			weaponRollConfig({ rollModifiers: [tierRollModifier("advantage")] })
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
			weaponRollConfig({ rollModifiers: [tierRollModifier("advantage")] })
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
			weaponRollConfig({ rollModifiers: [tierRollModifier("disadvantage")] })
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
			{ lockedEffect: null, lockedEffectSource: null, lockedTrait: null, equipmentSpends: [], narrativeTags: [], rollModifiers: [], riders: [] }
		);
	});

	// Every Advantage-axis source composes now — no masking, no precedence chain (see
	// docs/domains/moves.md's "Advantage axis" note). Cold Company's haunted state (disadvantage)
	// and a higher-Tier target match (advantage) both apply here at once; a passing test proves they
	// both surface as independent forced entries rather than one silently discarding the other.
	it("stacks Cold Company's standing Advantage-axis lock with a higher-Tier target match", async () => {
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
			weaponRollConfig({
				rollModifiers: [COLD_COMPANY_HAUNTED_ROLL_MODIFIER, tierRollModifier("advantage")]
			})
		);
	});
});

// Approach Confidence/Desperation on Exchange Blows/Strike Decisively (see moves-mixin.js's
// _targetMatchupEffect): the type wheel (approach-matchup.js) resolves straight to Confidence
// (counters the foe's Approach) or Desperation (is countered), independently of the Tier signal
// above, surfaced as a forced Roll Modifier entry.
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
			weaponRollConfig({ rollModifiers: [approachRollModifier("confidence")] })
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
			weaponRollConfig({ rollModifiers: [approachRollModifier("desperation")] })
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
			weaponRollConfig({ rollModifiers: [approachRollModifier("confidence")] })
		);
	});

	// A forced weapon tag (Unreliable — see _forcedWeaponEffect) no longer wins outright over the
	// target-matchup Approach signal — both are now independent forced Roll Modifier entries that
	// compose with each other (see docs/domains/moves.md's "Effect axis" note and
	// tests/move-roll-dialog.test.js for the seeded-currentEffect regression test proving they
	// actually cancel to a flat roll). This weapon carries an unspent Unreliable tag (forces
	// Desperation) AND the targeted NPC's Approach is favorable (would compute Confidence on its
	// own) — this is a genuine, intentional behavior change: today's build had Unreliable win
	// outright with Approach silently discarded; this build surfaces both.
	it("offers both a forced weapon tag entry and a favorable Approach target match, composing rather than one winning", async () => {
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

		expect(soleWeaponBundle(configureMoveRoll)).toEqual(expect.objectContaining({
			weaponKey: "eq1", lockedEffect: null, equipmentSpends: [], narrativeTags: [],
			rollModifiers: [UNRELIABLE_ROLL_MODIFIER, approachRollModifier("confidence")]
		}));
	});
});

// Tier and Approach act independently — since the two axes no longer sum into one combined stack,
// a higher Tier plus an unfavorable Approach matchup now locks BOTH Advantage AND Desperation on
// the same roll simultaneously, each as its own forced Roll Modifier entry, rather than netting to
// a single Advantage/Disadvantage state.
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
			weaponRollConfig({
				lockedEffect: null,
				rollModifiers: [tierRollModifier("advantage"), approachRollModifier("desperation")]
			})
		);
	});
});
