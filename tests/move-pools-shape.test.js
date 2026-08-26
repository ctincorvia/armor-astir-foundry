import { describe, expect, it } from "vitest";
import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { BASIC_MOVES, SPECIAL_MOVES } from "../scripts/moves/moves.js";
import { TRAITS } from "../scripts/core/traits.js";
import { ALL_PLAYBOOK_MOVES, MOVE_POOLS, findPlaybookMove } from "../scripts/moves/playbook-moves.js";

describe("MOVE_POOLS", () => {
	it("gives every pool a key, a label and a moves array", () => {
		for (const pool of MOVE_POOLS) {
			expect(pool.key).toBeTruthy();
			expect(pool.label).toBeTruthy();
			expect(Array.isArray(pool.moves)).toBe(true);
		}
	});

	it("names a real playbook on every playbook-specific pool", () => {
		const playbookNames = PLAYBOOKS.map((playbook) => playbook.name);

		for (const pool of MOVE_POOLS.filter((p) => p.playbookName)) {
			expect(playbookNames).toContain(pool.playbookName);
		}
	});

	it("explains when each universal pool applies, since nothing enforces it in code", () => {
		for (const pool of MOVE_POOLS.filter((p) => !p.playbookName)) {
			expect(pool.note).toBeTruthy();
		}
	});

	it("prefixes every move key with its own pool's key, keeping same-named moves distinct", () => {
		for (const pool of MOVE_POOLS) {
			for (const move of pool.moves) {
				expect(move.key.startsWith(`${pool.key}:`)).toBe(true);
			}
		}
	});

	it("keeps every move key unique across basic, special and playbook moves", () => {
		const keys = [...BASIC_MOVES, ...SPECIAL_MOVES, ...ALL_PLAYBOOK_MOVES].map((move) => move.key);

		expect(new Set(keys).size).toBe(keys.length);
	});

	it("gives every playbook move the same shape the sheet expects of a basic move", () => {
		for (const move of ALL_PLAYBOOK_MOVES) {
			expect(move.name).toBeTruthy();
			expect(Array.isArray(move.traits)).toBe(true);
			expect(move.description).toBeTruthy();
			// Every trait a move can roll has to be a real, steppable stat on the sheet.
			for (const key of move.traits) {
				expect(TRAITS.some((trait) => trait.key === key)).toBe(true);
			}
		}
	});

	it("gives every uses entry a key and a label", () => {
		for (const move of ALL_PLAYBOOK_MOVES.filter((m) => m.uses)) {
			for (const use of move.uses) {
				expect(use.key).toBeTruthy();
				expect(use.label).toBeTruthy();
			}
		}
	});

	it("caps Seek Allies and Personal Familiar with their stated per-Sortie/per-Downtime uses", () => {
		const seekAllies = findPlaybookMove("cantrips:seek-allies");
		const personalFamiliar = findPlaybookMove("cantrips:personal-familiar");

		expect(seekAllies.uses.map((use) => use.key)).toEqual(["sortie"]);
		expect(personalFamiliar.uses.map((use) => use.key)).toEqual(["sortie"]);
	});

	// PlaybookActorSheet#_onRefreshSortie reads this field to know which uses entries and flat
	// hold pools to clear — Downtime isn't a resettable button in this module, so Personal
	// Familiar's downtime use deliberately carries no period.
	it("scopes Sortie-limited uses and flat hold pools to the Sortie, leaving Downtime unscoped", () => {
		const seekAllies = findPlaybookMove("cantrips:seek-allies");
		const personalFamiliar = findPlaybookMove("cantrips:personal-familiar");
		const arityMethod = findPlaybookMove("soldier:the-arity-method");
		const getOutOfMyWay = findPlaybookMove("soldier:get-out-of-my-way");
		const onceTheWarsOver = findPlaybookMove("soldier:once-the-wars-over");

		expect(seekAllies.uses.find((use) => use.key === "sortie").period).toBe("Sortie");
		expect(arityMethod.uses.find((use) => use.key === "sortie").period).toBe("Sortie");
		expect(personalFamiliar.uses.find((use) => use.key === "sortie").period).toBe("Sortie");
		expect(getOutOfMyWay.period).toBe("Sortie");
		expect(onceTheWarsOver.period).toBe("Sortie");
	});

	it("scopes The Scout's own flat hold moves the same way", () => {
		const improvisation = findPlaybookMove("the-scout:improvisation");
		const pathFinding = findPlaybookMove("the-scout:path-finding");

		expect(improvisation.period).toBe("Sortie");
		expect(pathFinding.period).toBeUndefined();
	});

	it("marks Field Scout and Giant Slayer as The Scout's Starting Moves", () => {
		const fieldScout = findPlaybookMove("the-scout:field-scout");
		const giantSlayer = findPlaybookMove("the-scout:giant-slayer");

		expect(fieldScout.starting).toBe(true);
		expect(giantSlayer.starting).toBe(true);
	});

	// Field Scout/Giant Slayer and Earthly Ally/Titanic each present alternate identities, not
	// merely alternate skill picks — exclusiveGroup keeps every picker (not just the chargen one)
	// from ever offering both at once. See pickerSection's own tests below for the filtering itself.
	it("shares an exclusiveGroup between Field Scout and Giant Slayer, distinct from the Advocate pair", () => {
		const fieldScout = findPlaybookMove("the-scout:field-scout");
		const giantSlayer = findPlaybookMove("the-scout:giant-slayer");
		const earthlyAlly = findPlaybookMove("the-advocate:earthly-ally");
		const titanic = findPlaybookMove("the-advocate:titanic");

		expect(fieldScout.exclusiveGroup).toBeTruthy();
		expect(fieldScout.exclusiveGroup).toBe(giantSlayer.exclusiveGroup);
		expect(earthlyAlly.exclusiveGroup).toBeTruthy();
		expect(earthlyAlly.exclusiveGroup).toBe(titanic.exclusiveGroup);
		expect(fieldScout.exclusiveGroup).not.toBe(earthlyAlly.exclusiveGroup);
	});

	it("marks Arcane Augments as The Impostor's Starting Move", () => {
		expect(findPlaybookMove("the-impostor:arcane-augments").starting).toBe(true);
	});

	it("gives Arcane Augments a +1 CHANNEL per Danger traitBonus, capped at +3", () => {
		expect(findPlaybookMove("the-impostor:arcane-augments").traitBonus).toEqual({
			trait: "channel",
			per: "danger",
			max: 3
		});
	});

	it("gives Let Loose an uncapped, per-actor-chosen traitBonus scaled by burdens", () => {
		expect(findPlaybookMove("the-impostor:let-loose").traitBonus).toEqual({ per: "burden", chooseTrait: true });
	});

	it("gives Hot-blooded a flat, unscoped (no period) hold grant", () => {
		const hotBlooded = findPlaybookMove("the-impostor:hot-blooded");

		expect(hotBlooded.flatHold).toBe(1);
		expect(hotBlooded.period).toBeUndefined();
	});

	it("gives Hot-blooded, Once the War's Over and The Arity Method their own automatic-success grant", () => {
		const hotBlooded = findPlaybookMove("the-impostor:hot-blooded");
		const onceTheWarsOver = findPlaybookMove("soldier:once-the-wars-over");
		const arityMethod = findPlaybookMove("soldier:the-arity-method");

		expect(hotBlooded.grantsAutomaticSuccess).toEqual({ cost: 3 });
		expect(onceTheWarsOver.grantsAutomaticSuccess).toEqual({ cost: 1 });
		expect(arityMethod.grantsAutomaticSuccess).toEqual({ useKey: "sortie", moves: ["bite-the-dust"] });
	});

	it("gives Don't Follow Me its own quick-roll button that quick-rolls Lead a Sortie with +DEFY & advantage", () => {
		const dontFollowMe = findPlaybookMove("the-impostor:dont-follow-me");

		expect(dontFollowMe.traits).toEqual(["defy"]);
		expect(dontFollowMe.quickRollsMove).toEqual({ moveKey: "lead-a-sortie", trait: "defy", advantage: "advantage" });
		expect(dontFollowMe.grantsTraitOnMove).toBeUndefined();
		expect(dontFollowMe.grantsAdvantageOnMove).toBeUndefined();
	});

	it("gives Bullheaded an unscoped, unguarded advantage grant", () => {
		const bullheaded = findPlaybookMove("the-impostor:bullheaded");

		expect(bullheaded.uses).toBeUndefined();
		expect(bullheaded.grantsRollModifier).toEqual([
			{ advantage: "advantage",
				label: "Bullheaded", description: "Take a risk to take advantage." }
		]);
	});

	it("rolls Face To Face with +TALK, with a mixed-success choose-one menu", () => {
		const faceToFace = findPlaybookMove("the-impostor:face-to-face");

		expect(faceToFace.traits).toEqual(["talk"]);
		expect(faceToFace.results.success).toBeTruthy();
		expect(faceToFace.results.failure).toBeNull();
		expect(faceToFace.questions).toHaveLength(3);
	});

	it("gives Prepare Rituals 3 Sortie-scoped uses checkboxes, one per ritual", () => {
		const prepareRituals = findPlaybookMove("the-arcanist:prepare-rituals");

		expect(prepareRituals.uses.map((use) => use.key)).toEqual(["ritual-1", "ritual-2", "ritual-3"]);
		for (const use of prepareRituals.uses) {
			expect(use.period).toBe("Sortie");
		}
	});

	// The additive Wardhold pool every prepared Warding ritual instance feeds (see arcanist.js's
	// wardHoldFor/adaptedWardHold) — Sortie-scoped like the ritual-1/2/3 uses above, so it clears for
	// free on Refresh Sortie via the same generic numericTrackers walk (_refreshPeriod).
	it("gives Prepare Rituals a Sortie-scoped ward-hold numericTracker, 0 to 6", () => {
		const prepareRituals = findPlaybookMove("the-arcanist:prepare-rituals");

		expect(prepareRituals.numericTrackers).toEqual([
			{ key: "ward-hold", label: "Ward Hold", min: 0, max: 6, period: "Sortie" }
		]);
	});

	it("rolls Reshape with +CHANNEL, granting 2 hold on both success and mixed via separateHold", () => {
		const reshape = findPlaybookMove("the-arcanist:reshape");

		expect(reshape.traits).toEqual(["channel"]);
		expect(reshape.hold).toEqual({ success: 2, mixed: 2, failure: 0 });
		expect(reshape.separateHold).toBe(true);
	});

	it("gives Transmute Self two clamped -3 to +3 numericTrackers", () => {
		const transmuteSelf = findPlaybookMove("the-arcanist:transmute-self");

		expect(transmuteSelf.numericTrackers).toEqual([
			{ key: "set-1", label: "Alternate Set 1", min: -3, max: 3 },
			{ key: "set-2", label: "Alternate Set 2", min: -3, max: 3 }
		]);
	});

	it("gives Pre-ordained a single 0-6 kept-die numericTracker", () => {
		const preOrdained = findPlaybookMove("the-arcanist:pre-ordained");

		expect(preOrdained.numericTrackers).toEqual([
			{ key: "kept-die", label: "Kept d6", min: 0, max: 6 }
		]);
	});

	it("gives every numericTrackers entry a key, label, min and max", () => {
		for (const move of ALL_PLAYBOOK_MOVES.filter((m) => m.numericTrackers)) {
			for (const tracker of move.numericTrackers) {
				expect(tracker.key).toBeTruthy();
				expect(tracker.label).toBeTruthy();
				expect(typeof tracker.min).toBe("number");
				expect(typeof tracker.max).toBe("number");
			}
		}
	});

	it("gives every bonusDowntimeTokens flag a numeric max and a description", () => {
		for (const move of ALL_PLAYBOOK_MOVES.filter((m) => m.bonusDowntimeTokens)) {
			expect(typeof move.bonusDowntimeTokens.max).toBe("number");
			expect(move.bonusDowntimeTokens.description).toBeTruthy();
		}
	});

	it("gives Dark Rebirth a costsPeril automatic-success grant scoped to bite-the-dust", () => {
		const darkRebirth = findPlaybookMove("the-wither:dark-rebirth");

		expect(darkRebirth.grantsAutomaticSuccess).toEqual({ moves: ["bite-the-dust"], costsPeril: true });
	});

	it("gives Number Of The Beast a standing, actor-wide exploding-sixes grant", () => {
		expect(findPlaybookMove("the-wither:number-of-the-beast").grantsExplodingSixes).toBe(true);
	});

	it("gives Cold Company a dispelled uses checkbox and the standing haunted-roll grant reading it", () => {
		const coldCompany = findPlaybookMove("the-wither:cold-company");

		expect(coldCompany.uses.map((use) => use.key)).toEqual(["dispelled"]);
		expect(coldCompany.grantsHauntedStandingRoll).toEqual({ useKey: "dispelled" });
	});

	it("gives The Old Blood a +CHANNEL addsTraitToMove grant on Exchange Blows and Strike Decisively", () => {
		const theOldBlood = findPlaybookMove("the-wither:the-old-blood");

		expect(theOldBlood.addsTraitToMove).toEqual({
			moveKeys: ["exchange-blows", "strike-decisively"],
			trait: "channel",
			requiresUnmounted: true
		});
	});

	it("gives Embrace Chaos a flatHold pool with its own Activate button suppressed, plus its three hold-spend grants", () => {
		const embraceChaos = findPlaybookMove("the-witch:embrace-chaos");

		expect(embraceChaos.flatHold).toBe(1);
		expect(embraceChaos.suppressActivateButton).toBe(true);
		expect(embraceChaos.grantsDowngradeHold).toEqual({ amount: 1 });
		expect(embraceChaos.grantsAutomaticSuccess).toEqual({
			cost: 1,
			requiresTier: "mixed",
			buttonLabel: "Upgrade from embrace chaos"
		});
		expect(embraceChaos.grantsRollModifier).toEqual([{
			advantage: "advantage2",
			requiresAdvantage: ["disadvantage", "disadvantage2"],
			costsHold: { amount: 1 }
		}]);
	});
});
