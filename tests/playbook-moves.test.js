import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { BASIC_MOVES, SPECIAL_MOVES } from "../scripts/moves/moves.js";
import { TRAITS } from "../scripts/core/traits.js";
import {
	ALL_PLAYBOOK_MOVES,
	MOVE_POOLS,
	choosePlaybookMove,
	findPlaybookMove,
	moveRequirementTooltip,
	pickerMove,
	pickerSection,
	playbookMoveSections,
	resolvePlaybookMoves,
	unmetMoveRequirements
} from "../scripts/moves/playbook-moves.js";

const BULLHEADED = "the-impostor:bullheaded";
// Deny is the one real Cantrip with traits/results — plays the same functional role the old
// placeholder cantrip did (rolls +CHANNEL, disabled by default for The Scout).
const DENY = "cantrips:deny";
const SCOUT_KEYS = MOVE_POOLS.find((pool) => pool.key === "the-scout").moves.map((move) => move.key);
const IMPOSTOR_KEYS = MOVE_POOLS.find((pool) => pool.key === "the-impostor").moves.map((move) => move.key);
const CANTRIP_KEYS = MOVE_POOLS.find((pool) => pool.key === "cantrips").moves.map((move) => move.key);
const SOLDIER_KEYS = MOVE_POOLS.find((pool) => pool.key === "soldier").moves.map((move) => move.key);

// Fakes the jQuery `.find("[name='playbook-move']:checked").val()` chain choosePlaybookMove uses
// to read the picked radio. `undefined` stands in for "nothing checked", which is what an empty
// jQuery set's .val() returns.
function fakePickerHtml(checkedValue) {
	return { find: () => ({ val: () => checkedValue }) };
}

beforeEach(() => {
	vi.resetAllMocks();
	// resetAllMocks wipes the default Dialog implementation stubbed in tests/setup.js.
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
	});
	renderTemplate.mockResolvedValue("");
});

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
		expect(personalFamiliar.uses.map((use) => use.key)).toEqual(["sortie", "downtime"]);
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
		expect(personalFamiliar.uses.find((use) => use.key === "downtime").period).toBeUndefined();
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

	it("gives Don't Follow Me a standing +DEFY & advantage grant on Lead a Sortie", () => {
		const dontFollowMe = findPlaybookMove("the-impostor:dont-follow-me");

		expect(dontFollowMe.grantsTraitOnMove).toEqual({ moveKey: "lead-a-sortie", trait: "defy" });
		expect(dontFollowMe.grantsAdvantageOnMove).toEqual({ moveKey: "lead-a-sortie", advantage: "advantage" });
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
});

describe("MOVE_POOLS - the-wither", () => {
	it("registers The Wither's own pool with 9 moves", () => {
		const wither = MOVE_POOLS.find((pool) => pool.key === "the-wither");

		expect(wither.label).toBe("The Wither");
		expect(wither.playbookName).toBe("The Wither");
		expect(wither.moves).toHaveLength(9);
	});
});

describe("MOVE_POOLS - the-adrift", () => {
	it("registers The Adrift's own pool with 9 moves", () => {
		const adrift = MOVE_POOLS.find((pool) => pool.key === "the-adrift");

		expect(adrift.label).toBe("The Adrift");
		expect(adrift.playbookName).toBe("The Adrift");
		expect(adrift.moves).toHaveLength(9);
	});

	it("gives Love, Love, Love the grantsHomeInsteadOfChannel flag", () => {
		expect(findPlaybookMove("the-adrift:love-love-love").grantsHomeInsteadOfChannel).toBe(true);
	});

	it("gives Snakes In The Grass a flatHold:1 pool", () => {
		expect(findPlaybookMove("the-adrift:snakes-in-the-grass").flatHold).toBe(1);
	});

	it("gives Walk-on Part In The War a +HOME addsTraitToMove grant on Exchange Blows and Strike Decisively, gated on the Astir being mounted", () => {
		const walkOnPart = findPlaybookMove("the-adrift:walk-on-part-in-the-war");

		expect(walkOnPart.addsTraitToMove).toEqual({
			moveKeys: ["exchange-blows", "strike-decisively"],
			trait: "home",
			requiresAstirMounted: true
		});
	});

	it("gives Walk-on Part In The War an overheating addsFailureReminderToMove grant on the same two moves, also gated on the Astir being mounted", () => {
		const walkOnPart = findPlaybookMove("the-adrift:walk-on-part-in-the-war");

		expect(walkOnPart.addsFailureReminderToMove).toEqual({
			moveKeys: ["exchange-blows", "strike-decisively"],
			reminder: "Tick 'overheating' on your Astir",
			requiresAstirMounted: true
		});
	});

	it("gives Lead Role In A Cage only an addsTraitToMove option on Lead a Sortie, no lock", () => {
		const leadRole = findPlaybookMove("the-adrift:lead-role-in-a-cage");

		expect(leadRole.addsTraitToMove).toEqual({ moveKey: "lead-a-sortie", trait: "home" });
		expect(leadRole.grantsTraitOnMove).toBeUndefined();
	});

	it("gives Draw Your Bath And Load Your Gun a self-targeting +HOME addsTraitToMove grant, with empty traits", () => {
		const drawYourBath = findPlaybookMove("the-adrift:draw-your-bath-and-load-your-gun");

		expect(drawYourBath.traits).toEqual([]);
		expect(drawYourBath.addsTraitToMove).toEqual({
			moveKey: "the-adrift:draw-your-bath-and-load-your-gun",
			trait: "home"
		});
		expect(drawYourBath.results.success).toBeTruthy();
		expect(drawYourBath.results.mixed).toBeTruthy();
		expect(drawYourBath.results.failure).toBeNull();
	});
});

describe("MOVE_POOLS - the-advocate", () => {
	it("registers The Advocate's own pool with 9 moves", () => {
		const advocate = MOVE_POOLS.find((pool) => pool.key === "the-advocate");

		expect(advocate.label).toBe("The Advocate");
		expect(advocate.playbookName).toBe("The Advocate");
		expect(advocate.moves).toHaveLength(9);
	});

	it("gives Earthly Ally and Titanic empty traits, as prose-only starting-move options", () => {
		expect(findPlaybookMove("the-advocate:earthly-ally").traits).toEqual([]);
		expect(findPlaybookMove("the-advocate:titanic").traits).toEqual([]);
	});

	it("gives Nature's Bounty a +CHANNEL roll with success/mixed results and no failure result", () => {
		const naturesBounty = findPlaybookMove("the-advocate:natures-bounty");

		expect(naturesBounty.traits).toEqual(["channel"]);
		expect(naturesBounty.results.success).toBeTruthy();
		expect(naturesBounty.results.mixed).toBeTruthy();
		expect(naturesBounty.results.failure).toBeNull();
	});
});

describe("MOVE_POOLS - the-revenant", () => {
	it("registers The Revenant's own pool with 9 moves", () => {
		const revenant = MOVE_POOLS.find((pool) => pool.key === "the-revenant");

		expect(revenant.label).toBe("The Revenant");
		expect(revenant.playbookName).toBe("The Revenant");
		expect(revenant.moves).toHaveLength(9);
	});

	it("rolls Never Quite Free with +CHANNEL and a full 3-tier results object, no forced Desperation", () => {
		const neverQuiteFree = findPlaybookMove("the-revenant:never-quite-free");

		expect(neverQuiteFree.traits).toEqual(["channel"]);
		expect(neverQuiteFree.results.success).toBeTruthy();
		expect(neverQuiteFree.results.mixed).toBeTruthy();
		expect(neverQuiteFree.results.failure).toBeTruthy();
		expect(neverQuiteFree.forcesDesperationAtMaxPerils).toBeUndefined();
		expect(neverQuiteFree.disablesMove).toEqual({ moveKey: "bite-the-dust" });
	});

	it("rolls Joyride with +CHANNEL and no failure result", () => {
		const joyride = findPlaybookMove("the-revenant:joyride");

		expect(joyride.traits).toEqual(["channel"]);
		expect(joyride.results.success).toBeTruthy();
		expect(joyride.results.mixed).toBeTruthy();
		expect(joyride.results.failure).toBeNull();
	});

	it("gives I Know You a flat +3 FAMILIARITY fixedTraits entry and no actor-read traits", () => {
		const iKnowYou = findPlaybookMove("the-revenant:i-know-you");

		expect(iKnowYou.traits).toEqual([]);
		expect(iKnowYou.fixedTraits).toEqual([{ key: "familiarity", label: "FAMILIARITY", value: 3 }]);
		expect(iKnowYou.results.success).toBeTruthy();
		expect(iKnowYou.results.mixed).toBeTruthy();
		expect(iKnowYou.results.failure).toBeNull();
	});

	it("flags I Know You as granting a live FAMILIARITY trait", () => {
		const iKnowYou = findPlaybookMove("the-revenant:i-know-you");

		expect(iKnowYou.grantsFamiliarityTrait).toBe(true);
	});

	it("gives Ain't No Grave a costless automatic-success offer excluding Never Quite Free", () => {
		const aintNoGrave = findPlaybookMove("the-revenant:aint-no-grave");

		expect(aintNoGrave.grantsAutomaticSuccess).toEqual({
			excludeMoves: ["the-revenant:never-quite-free"]
		});
	});

	it("gives Ancient Recall a 3-point flat hold and an automatic-success grant scoped to two basic moves", () => {
		const ancientRecall = findPlaybookMove("the-revenant:ancient-recall");

		expect(ancientRecall.flatHold).toBe(3);
		expect(ancientRecall.grantsAutomaticSuccess).toEqual({
			cost: 1,
			moves: ["dispel-uncertainties", "read-the-room"]
		});
	});
});

describe("MOVE_POOLS - the-summoner", () => {
	it("registers The Summoner's own pool with 9 moves", () => {
		const summoner = MOVE_POOLS.find((pool) => pool.key === "the-summoner");

		expect(summoner.label).toBe("The Summoner");
		expect(summoner.playbookName).toBe("The Summoner");
		expect(summoner.moves).toHaveLength(9);
	});

	it("gives Eidolon Drive empty traits and summonsAlly, with no uses checkbox of its own", () => {
		const eidolonDrive = findPlaybookMove("the-summoner:eidolon-drive");

		expect(eidolonDrive.traits).toEqual([]);
		expect(eidolonDrive.summonsAlly).toBe(true);
		// The "once per Scene" grant is tracked entirely via system.attributes.eidolonDrive (see
		// summoner-mixin.js), not a uses checkbox.
		expect(eidolonDrive.uses).toBeUndefined();
	});

	it("flags Binding with grantsBoundAlliesRoster and empty traits", () => {
		const binding = findPlaybookMove("the-summoner:binding");

		expect(binding.traits).toEqual([]);
		expect(binding.grantsBoundAlliesRoster).toBe(true);
	});

	it("flags Helping Hands with grantsDowntimeAllySlot and empty traits", () => {
		const helpingHands = findPlaybookMove("the-summoner:helping-hands");

		expect(helpingHands.traits).toEqual([]);
		expect(helpingHands.grantsDowntimeAllySlot).toBe(true);
		expect(helpingHands.bonusDowntimeTokens).toEqual({ max: 1, description: "Only while a Downtime Ally is bound." });
	});

	it("flags Living Drive with grantsUnpilotedAstirMove targeting Eidolon Drive", () => {
		const livingDrive = findPlaybookMove("the-summoner:living-drive");

		expect(livingDrive.traits).toEqual([]);
		expect(livingDrive.grantsUnpilotedAstirMove).toEqual({ moveKey: "the-summoner:eidolon-drive" });
	});

	it("flags Enduring Support with activatesApproachOverride and empty traits", () => {
		const enduringSupport = findPlaybookMove("the-summoner:enduring-support");

		expect(enduringSupport.traits).toEqual([]);
		expect(enduringSupport.activatesApproachOverride).toBe(true);
	});

	it("gives every other Additional Move (prose-only) empty traits", () => {
		for (const key of [
			"the-summoner:bonded-in-blood",
			"the-summoner:spritecraft",
			"the-summoner:dynamic-entry",
			"the-summoner:conveyance"
		]) {
			expect(findPlaybookMove(key).traits).toEqual([]);
		}
	});
});

describe("MOVE_POOLS - the-icon", () => {
	it("registers The Icon's own pool with 9 moves", () => {
		const icon = MOVE_POOLS.find((pool) => pool.key === "the-icon");

		expect(icon.label).toBe("The Icon");
		expect(icon.playbookName).toBe("The Icon");
		expect(icon.moves).toHaveLength(9);
	});

	it("gives Performance and Bardic Inspiration a 3-point flat hold and no results", () => {
		const performance = findPlaybookMove("the-icon:performance");
		const bardicInspiration = findPlaybookMove("the-icon:bardic-inspiration");

		expect(performance.traits).toEqual([]);
		expect(performance.flatHold).toBe(3);
		expect(performance.results).toBeUndefined();

		expect(bardicInspiration.traits).toEqual([]);
		expect(bardicInspiration.flatHold).toBe(3);
		expect(bardicInspiration.results).toBeUndefined();
	});

	it("flags Mechanical Aria with grantsAstirAccessWithoutChannel and empty traits", () => {
		const mechanicalAria = findPlaybookMove("the-icon:mechanical-aria");

		expect(mechanicalAria.traits).toEqual([]);
		expect(mechanicalAria.grantsAstirAccessWithoutChannel).toBe(true);
	});

	it("gives every other move (prose-only) empty traits and no results", () => {
		for (const key of [
			"the-icon:power",
			"the-icon:change-of-heart",
			"the-icon:touchstone",
			"the-icon:you-should-see-me-in-a-crown",
			"the-icon:showstopper",
			"the-icon:perspective"
		]) {
			const move = findPlaybookMove(key);
			expect(move.traits).toEqual([]);
			expect(move.results).toBeUndefined();
		}
	});
});

describe("MOVE_POOLS - the-attendant", () => {
	it("registers The Attendant's own pool with 9 moves", () => {
		const attendant = MOVE_POOLS.find((pool) => pool.key === "the-attendant");

		expect(attendant.label).toBe("The Attendant");
		expect(attendant.playbookName).toBe("The Attendant");
		expect(attendant.moves).toHaveLength(9);
	});

	it("gives Master & Servant a restricted +1 bonusDowntimeTokens pool and empty traits", () => {
		const masterServant = findPlaybookMove("the-attendant:master-servant");

		expect(masterServant.traits).toEqual([]);
		expect(masterServant.bonusDowntimeTokens).toEqual({
			max: 1,
			description: "Must be spent on your Employer's needs and whims."
		});
		expect(masterServant.downtimeTokensMax).toBeUndefined();
	});

	it("flags Signed & Sealed with grantsApproachOverride and grantsWeaponTags", () => {
		const signedSealed = findPlaybookMove("the-attendant:signed-sealed");

		expect(signedSealed.traits).toEqual([]);
		expect(signedSealed.grantsApproachOverride).toBe("profane");
		expect(signedSealed.grantsWeaponTags).toEqual(["messy", "decisive"]);
	});

	it("gives Smiling Politely a 0-10 clamped Hold numericTracker", () => {
		const smilingPolitely = findPlaybookMove("the-attendant:smiling-politely");

		expect(smilingPolitely.numericTrackers).toEqual([
			{ key: "hold", label: "Hold", min: 0, max: 10 }
		]);
	});

	it("gives On Your Feet a once-per-Sortie uses checkbox", () => {
		const onYourFeet = findPlaybookMove("the-attendant:on-your-feet");

		expect(onYourFeet.uses).toEqual([{ key: "sortie", label: "Used this Sortie", period: "Sortie" }]);
	});

	it("gives every other move (prose-only) empty traits and no results", () => {
		for (const key of [
			"the-attendant:a-drink-sir",
			"the-attendant:in-blood-terror",
			"the-attendant:man-of-many-manners",
			"the-attendant:dilettante",
			"the-attendant:the-utmost-care"
		]) {
			const move = findPlaybookMove(key);
			expect(move.traits).toEqual([]);
			expect(move.results).toBeUndefined();
		}
	});
});

describe("MOVE_POOLS - the-captain", () => {
	it("registers The Captain's own pool with 9 moves", () => {
		const captain = MOVE_POOLS.find((pool) => pool.key === "the-captain");

		expect(captain.label).toBe("The Captain");
		expect(captain.playbookName).toBe("The Captain");
		expect(captain.moves).toHaveLength(9);
	});

	it("gives In Command empty traits and no results — the Danger cap is mechanized elsewhere", () => {
		const inCommand = findPlaybookMove("the-captain:in-command");

		expect(inCommand.traits).toEqual([]);
		expect(inCommand.results).toBeUndefined();
	});

	it("gives Tactical Genius and Force Multiplier empty traits and no flatHold/results", () => {
		for (const key of ["the-captain:tactical-genius", "the-captain:force-multiplier"]) {
			const move = findPlaybookMove(key);
			expect(move.traits).toEqual([]);
			expect(move.flatHold).toBeUndefined();
			expect(move.results).toBeUndefined();
		}
	});

	it("gives Tactical Genius a Sortie-scoped 0-6 hold numericTracker", () => {
		const tacticalGenius = findPlaybookMove("the-captain:tactical-genius");

		expect(tacticalGenius.numericTrackers).toEqual([
			{ key: "hold", label: "Hold", min: 0, max: 6, period: "Sortie" }
		]);
	});

	it("gives Force Multiplier a manual 0-3 confidence numericTracker with no period", () => {
		const forceMultiplier = findPlaybookMove("the-captain:force-multiplier");

		expect(forceMultiplier.numericTrackers).toEqual([
			{ key: "confidence", label: "Confidence rolls available", min: 0, max: 3 }
		]);
		expect(forceMultiplier.numericTrackers[0].period).toBeUndefined();
	});

	it("gives Surprise Requisition a CREW fixedTraits entry and a full 3-tier results object", () => {
		const surpriseRequisition = findPlaybookMove("the-captain:surprise-requisition");

		expect(surpriseRequisition.traits).toEqual([]);
		expect(surpriseRequisition.fixedTraits).toEqual([{ key: "crew", label: "CREW", value: 0 }]);
		expect(surpriseRequisition.results.success).toBeTruthy();
		expect(surpriseRequisition.results.mixed).toBeTruthy();
		expect(surpriseRequisition.results.failure).toBeNull();
	});

	it("gives Fire Support a KNOW addsTraitToMove grant and a grantsCarrierWeaponAccess flag on Exchange Blows and Strike Decisively", () => {
		const fireSupport = findPlaybookMove("the-captain:fire-support");

		expect(fireSupport.traits).toEqual([]);
		expect(fireSupport.addsTraitToMove).toEqual({
			moveKeys: ["exchange-blows", "strike-decisively"],
			trait: "know"
		});
		expect(fireSupport.grantsCarrierWeaponAccess).toEqual({
			moveKeys: ["exchange-blows", "strike-decisively"]
		});
	});

	it("gives Information Network a TALK addsTraitToMove grant on Dispel Uncertainties", () => {
		const informationNetwork = findPlaybookMove("the-captain:information-network");

		expect(informationNetwork.traits).toEqual([]);
		expect(informationNetwork.addsTraitToMove).toEqual({ moveKey: "dispel-uncertainties", trait: "talk" });
		expect(informationNetwork.bonusDowntimeTokens).toEqual({
			max: 1,
			description: "Any info-gathering efforts or projects."
		});
	});

	it("gives Born Leader a standing advantage grant on Lead a Sortie", () => {
		const bornLeader = findPlaybookMove("the-captain:born-leader");

		expect(bornLeader.traits).toEqual([]);
		expect(bornLeader.grantsAdvantageOnMove).toEqual({ moveKey: "lead-a-sortie", advantage: "advantage" });
	});

	it("gives Human Resources three extra Read the Room questions", () => {
		const humanResources = findPlaybookMove("the-captain:human-resources");

		expect(humanResources.traits).toEqual([]);
		expect(humanResources.addsQuestionsToMove).toEqual({
			moveKey: "read-the-room",
			questions: [
				"What is the crew's mood like?",
				"Who is responsible for a problem on-board the Carrier?",
				"What could be a problem for the crew in the immediate future?"
			]
		});
	});

	it("gives Coordinator (prose-only) empty traits and no results", () => {
		const coordinator = findPlaybookMove("the-captain:coordinator");

		expect(coordinator.traits).toEqual([]);
		expect(coordinator.results).toBeUndefined();
	});

	it("gives Coordinator an addsSuccessReminderToMove grant on Help or Hinder", () => {
		const coordinator = findPlaybookMove("the-captain:coordinator");

		expect(coordinator.addsSuccessReminderToMove).toEqual({
			moveKeys: ["help-or-hinder"],
			reminder: "If you chose to help, your ally may act with confidence in addition to advantage."
		});
	});
});

describe("MOVE_POOLS - the-artificer", () => {
	it("registers The Artificer's own pool with 9 moves", () => {
		const artificer = MOVE_POOLS.find((pool) => pool.key === "the-artificer");

		expect(artificer.label).toBe("The Artificer");
		expect(artificer.playbookName).toBe("The Artificer");
		expect(artificer.moves).toHaveLength(9);
	});

	it("gives Expertise and Field Testing empty traits and no results", () => {
		for (const key of ["the-artificer:expertise", "the-artificer:field-testing"]) {
			const move = findPlaybookMove(key);
			expect(move.traits).toEqual([]);
			expect(move.results).toBeUndefined();
		}
	});

	it("gives Experimenter empty traits and no results", () => {
		const experimenter = findPlaybookMove("the-artificer:experimenter");

		expect(experimenter.traits).toEqual([]);
		expect(experimenter.results).toBeUndefined();
	});

	it("gives Combat Engineer a tierBonus of 1 and no results", () => {
		const combatEngineer = findPlaybookMove("the-artificer:combat-engineer");

		expect(combatEngineer.traits).toEqual([]);
		expect(combatEngineer.tierBonus).toBe(1);
		expect(combatEngineer.results).toBeUndefined();
	});

	it("gives Jury-Rigger a KNOW roll and a full 3-tier results object", () => {
		const juryRigger = findPlaybookMove("the-artificer:jury-rigger");

		expect(juryRigger.traits).toEqual(["know"]);
		expect(juryRigger.results.success).toContain("Choose 3");
		expect(juryRigger.results.mixed).toContain("Choose 2");
		expect(juryRigger.results.failure).toBeNull();
	});

	it("gives Refined Rituals a flatHold of 3 and no results", () => {
		const refinedRituals = findPlaybookMove("the-artificer:refined-rituals");

		expect(refinedRituals.traits).toEqual([]);
		expect(refinedRituals.flatHold).toBe(3);
		expect(refinedRituals.results).toBeUndefined();
	});

	it("gives Arcane Generator grantsChannelOnAnyMove, a KNOW roll and a full 3-tier results object", () => {
		const arcaneGenerator = findPlaybookMove("the-artificer:arcane-generator");

		expect(arcaneGenerator.grantsChannelOnAnyMove).toBe(true);
		expect(arcaneGenerator.traits).toEqual(["know"]);
		expect(arcaneGenerator.results.success).toBeTruthy();
		expect(arcaneGenerator.results.mixed).toContain("Choose 1");
		expect(arcaneGenerator.results.failure).toBeNull();
	});

	it("gives It's A Prototype a once-per-Sortie uses entry and no results", () => {
		const itsAPrototype = findPlaybookMove("the-artificer:its-a-prototype");

		expect(itsAPrototype.traits).toEqual([]);
		expect(itsAPrototype.uses).toEqual([{ key: "sortie", label: "Used this Sortie", period: "Sortie" }]);
		expect(itsAPrototype.results).toBeUndefined();
	});

	it("gives Counterspell a KNOW addsTraitToMove grant on Exchange Blows and Strike Decisively", () => {
		const counterspell = findPlaybookMove("the-artificer:counterspell");

		expect(counterspell.traits).toEqual([]);
		expect(counterspell.addsTraitToMove).toEqual({
			moveKeys: ["exchange-blows", "strike-decisively"],
			trait: "know"
		});
	});
});

describe("addsCriticalReminderToMove (12+ hook)", () => {
	it("gives Indomitable a universal grant, with no moveKeys restriction", () => {
		const indomitable = findPlaybookMove("soldier:indomitable");

		expect(indomitable.traits).toEqual([]);
		expect(indomitable.addsCriticalReminderToMove).toEqual({
			reminder: "You may clear a risk"
		});
	});

	it("gives Truth-making a Read the Room-scoped grant", () => {
		const truthMaking = findPlaybookMove("cantrips:truth-making");

		expect(truthMaking.traits).toEqual([]);
		expect(truthMaking.addsCriticalReminderToMove).toEqual({
			moveKeys: ["read-the-room"],
			reminder: "You may answer one of your questions yourself"
		});
	});

	it("gives A Greener World a Weave Magic-scoped grant", () => {
		const greenerWorld = findPlaybookMove("the-advocate:a-greener-world");

		expect(greenerWorld.traits).toEqual([]);
		expect(greenerWorld.addsCriticalReminderToMove).toEqual({
			moveKeys: ["weave-magic"],
			reminder: "New flora and fauna spring to life nearby"
		});
	});

	it("gives Sharp Tongue an Exchange Blows-scoped grant, gated on the talk trait", () => {
		const sharpTongue = findPlaybookMove("the-diplomat:sharp-tongue");

		expect(sharpTongue.traits).toEqual([]);
		expect(sharpTongue.addsCriticalReminderToMove).toEqual({
			moveKeys: ["exchange-blows"],
			reminder: "Your opponent is put in peril",
			requiresTrait: "talk"
		});
	});
});

describe("findPlaybookMove", () => {
	it("finds a move by key across every pool", () => {
		expect(findPlaybookMove(BULLHEADED).name).toBe("Bullheaded");
		expect(findPlaybookMove(DENY).name).toBe("Deny");
	});

	it("returns null for an unknown key", () => {
		expect(findPlaybookMove("nope:not-a-move")).toBeNull();
	});
});

describe("resolvePlaybookMoves", () => {
	it("resolves stored keys to move definitions in order", () => {
		const moves = resolvePlaybookMoves([DENY, BULLHEADED]);

		expect(moves.map((move) => move.key)).toEqual([DENY, BULLHEADED]);
	});

	it("drops keys that no longer match a move, rather than yielding holes", () => {
		const moves = resolvePlaybookMoves([BULLHEADED, "the-scout:deleted-move"]);

		expect(moves.map((move) => move.key)).toEqual([BULLHEADED]);
	});

	it("defaults to an empty list when the actor has never picked anything", () => {
		expect(resolvePlaybookMoves()).toEqual([]);
	});
});

describe("unmetMoveRequirements", () => {
	it("returns every requiresMoves key not among the picked keys", () => {
		const move = { key: "a", requiresMoves: ["b"] };
		expect(unmetMoveRequirements(move, [])).toEqual(["b"]);
	});

	it("returns an empty list once every required key is picked", () => {
		const move = { key: "a", requiresMoves: ["b"] };
		expect(unmetMoveRequirements(move, ["b"])).toEqual([]);
	});

	it("returns an empty list for a move with no requiresMoves at all", () => {
		expect(unmetMoveRequirements({ key: "a" })).toEqual([]);
	});

	it("only reports the keys that are actually missing", () => {
		const move = { key: "a", requiresMoves: ["b", "c"] };
		expect(unmetMoveRequirements(move, ["b"])).toEqual(["c"]);
	});

	it("resolves against the real content: You Should See Me In A Crown requires Touchstone", () => {
		const move = findPlaybookMove("the-icon:you-should-see-me-in-a-crown");
		expect(unmetMoveRequirements(move, [])).toEqual(["the-icon:touchstone"]);
		expect(unmetMoveRequirements(move, ["the-icon:touchstone"])).toEqual([]);
	});
});

describe("moveRequirementTooltip", () => {
	it("returns null when nothing is missing", () => {
		expect(moveRequirementTooltip([])).toBeNull();
	});

	it("names a single missing move by its real display name", () => {
		expect(moveRequirementTooltip(["the-icon:touchstone"])).toBe("Requires Touchstone");
	});

	it("joins multiple missing moves, falling back to the raw key for a stale reference", () => {
		expect(moveRequirementTooltip(["the-icon:touchstone", "not-a-real-key"]))
			.toBe("Requires Touchstone, not-a-real-key");
	});
});

describe("pickerMove", () => {
	const REQUIRES = { key: "needs-b", name: "Needs B", traits: [], description: "<p>d</p>", requiresMoves: ["b"] };
	const FREE = { key: "free", name: "Free", traits: [], description: "<p>d</p>" };

	it("stays visible but disabled, with a tooltip, when its requiresMoves isn't met", () => {
		const result = pickerMove(REQUIRES, []);

		expect(result.key).toBe("needs-b");
		expect(result.disabled).toBe(true);
		expect(result.tooltip).toBe("Requires b");
	});

	it("is enabled with a null tooltip once requiresMoves is satisfied", () => {
		const result = pickerMove(REQUIRES, ["b"]);

		expect(result.disabled).toBe(false);
		expect(result.tooltip).toBeNull();
	});

	it("is enabled by default for a move with no requiresMoves and no extraTooltip", () => {
		const result = pickerMove(FREE, []);

		expect(result.disabled).toBe(false);
		expect(result.tooltip).toBeNull();
	});

	it("folds an extraTooltip callback's result in even when requiresMoves is already met", () => {
		const result = pickerMove(FREE, [], { extraTooltip: () => "Requires Foo Astir Part" });

		expect(result.disabled).toBe(true);
		expect(result.tooltip).toBe("Requires Foo Astir Part");
	});

	it("combines a requiresMoves tooltip with an extraTooltip result", () => {
		const result = pickerMove(REQUIRES, [], { extraTooltip: () => "Requires Foo Astir Part" });

		expect(result.tooltip).toBe("Requires b; Requires Foo Astir Part");
	});

	it("ignores an extraTooltip callback that returns nothing", () => {
		const result = pickerMove(FREE, [], { extraTooltip: () => null });

		expect(result.disabled).toBe(false);
		expect(result.tooltip).toBeNull();
	});
});

describe("pickerSection", () => {
	const POOL = {
		key: "pool",
		label: "Pool",
		moves: [
			{ key: "needs-b", name: "Needs B", traits: [], description: "<p>d</p>", requiresMoves: ["b"] },
			{ key: "free", name: "Free", traits: [], description: "<p>d</p>" }
		]
	};

	it("keeps a move with unmet requiresMoves in the list, disabled, rather than filtering it out", () => {
		const section = pickerSection(POOL, []);

		expect(section.moves.map((m) => m.key)).toEqual(["needs-b", "free"]);
		expect(section.moves.find((m) => m.key === "needs-b").disabled).toBe(true);
		expect(section.moves.find((m) => m.key === "free").disabled).toBe(false);
	});

	it("threads extraTooltip through to every move in the section", () => {
		const section = pickerSection(POOL, [], { extraTooltip: () => "Gated" });

		expect(section.moves.find((m) => m.key === "free").tooltip).toBe("Gated");
		expect(section.moves.find((m) => m.key === "needs-b").tooltip).toBe("Requires b; Gated");
	});
});

// The ordering/nesting/emptiness rules are asserted against fixtures rather than the live pools,
// so they keep testing the same thing as real move content fills MOVE_POOLS in — an assertion
// like "Other Playbooks is dropped when every other pool is empty" would silently stop covering
// that case the moment The Commander gains its first move.
const FIXTURE_POOLS = [
	{
		key: "alpha",
		label: "The Alpha",
		playbookName: "The Alpha",
		moves: [{ key: "alpha:one", name: "Alpha One", traits: ["clash"], description: "<p>a</p>" }]
	},
	{
		key: "beta",
		label: "The Beta",
		playbookName: "The Beta",
		moves: [{ key: "beta:one", name: "Beta One", traits: [], description: "<p>b</p>" }]
	},
	{ key: "gamma", label: "The Gamma", playbookName: "The Gamma", moves: [] },
	{
		key: "universal",
		label: "Universal",
		note: "Anyone may take these.",
		moves: [{ key: "universal:one", name: "Universal One", traits: ["channel"], description: "<p>u</p>" }]
	}
];

describe("playbookMoveSections", () => {
	it("puts the actor's own playbook pool first, expanded", () => {
		const [first] = playbookMoveSections("The Alpha", [], FIXTURE_POOLS);

		expect(first.key).toBe("alpha");
		expect(first.open).toBe(true);
		expect(first.note).toBe("Your playbook.");
		expect(first.moves.map((move) => move.key)).toEqual(["alpha:one"]);
	});

	it("lists the universal pools after the actor's own and the other playbooks last, collapsed", () => {
		const sections = playbookMoveSections("The Alpha", [], FIXTURE_POOLS);

		expect(sections.map((section) => section.key)).toEqual(["alpha", "universal", "other-playbooks"]);
		expect(sections.find((section) => section.key === "universal").open).toBe(false);
	});

	it("carries a universal pool's advisory note through to the picker", () => {
		const universal = playbookMoveSections("The Alpha", [], FIXTURE_POOLS)
			.find((section) => section.key === "universal");

		expect(universal.note).toBe("Anyone may take these.");
	});

	it("nests the other playbooks' pools one level down, never the actor's own", () => {
		const others = playbookMoveSections("The Alpha", [], FIXTURE_POOLS)
			.find((section) => section.key === "other-playbooks");

		expect(others.note).toContain("rare circumstances");
		expect(others.moves).toBeUndefined();
		// Gamma is empty, so only Beta survives — an empty pool is dropped here too.
		expect(others.sections.map((section) => section.key)).toEqual(["beta"]);
	});

	it("exposes each move's rollable traits as display labels", () => {
		const [first] = playbookMoveSections("The Alpha", [], FIXTURE_POOLS);

		expect(first.moves[0].traitLabels).toEqual(["CLASH"]);
	});

	it("leaves traitLabels empty for a move that rolls nothing", () => {
		const others = playbookMoveSections("The Alpha", [], FIXTURE_POOLS)
			.find((section) => section.key === "other-playbooks");

		expect(others.sections[0].moves[0].traitLabels).toEqual([]);
	});

	it("filters out moves the actor already has, so nothing can be taken twice", () => {
		const sections = playbookMoveSections("The Alpha", ["alpha:one"], FIXTURE_POOLS);

		expect(sections.some((section) => section.key === "alpha")).toBe(false);
	});

	it("drops pools left empty once the actor's picks are filtered out", () => {
		const sections = playbookMoveSections("The Alpha", ["alpha:one", "universal:one"], FIXTURE_POOLS);

		expect(sections.map((section) => section.key)).toEqual(["other-playbooks"]);
	});

	it("drops the Other Playbooks section entirely when every other pool is empty", () => {
		const sections = playbookMoveSections("The Alpha", ["beta:one"], FIXTURE_POOLS);

		expect(sections.some((section) => section.key === "other-playbooks")).toBe(false);
	});

	it("still offers the universal pools when the actor's playbook has no pool of its own", () => {
		const sections = playbookMoveSections("The Unwritten", [], FIXTURE_POOLS);

		expect(sections.map((section) => section.key)).toEqual(["universal", "other-playbooks"]);
	});

	it("treats a missing playbook name the same as an unrecognised one", () => {
		const sections = playbookMoveSections(undefined, [], FIXTURE_POOLS);

		expect(sections.some((section) => section.key === "alpha")).toBe(false);
		expect(sections.find((section) => section.key === "other-playbooks").sections)
			.toHaveLength(2);
	});

	it("offers The Scout's own moves from the real pools", () => {
		const [first] = playbookMoveSections("The Scout");

		expect(first.key).toBe("the-scout");
		expect(first.moves.map((move) => move.key)).toEqual(SCOUT_KEYS);
	});

	it("offers The Impostor's own moves from the real pools", () => {
		const [first] = playbookMoveSections("The Impostor");

		expect(first.key).toBe("the-impostor");
		expect(first.moves.map((move) => move.key)).toEqual(IMPOSTOR_KEYS);
		expect(first.moves.map((move) => move.key)).toContain(BULLHEADED);
	});

	it("offers the real universal pools to every playbook", () => {
		const keys = playbookMoveSections("The Scout").map((section) => section.key);

		expect(keys).toContain("cantrips");
		expect(keys).toContain("soldier");
	});

	// Field Scout/Giant Slayer share an exclusiveGroup (see playbook-moves.js#pickerSection) — once
	// one is picked, the other must never be offered by any picker drawing from this pool.
	it("excludes Giant Slayer once Field Scout is already picked, via their shared exclusiveGroup", () => {
		const [scout] = playbookMoveSections("The Scout", ["the-scout:field-scout"]);
		const keys = scout.moves.map((move) => move.key);

		expect(keys).not.toContain("the-scout:giant-slayer");
		// An unrelated move from the same pool is unaffected by the exclusion.
		expect(keys).toContain("the-scout:team-player");
	});

	it("excludes Field Scout once Giant Slayer is already picked", () => {
		const [scout] = playbookMoveSections("The Scout", ["the-scout:giant-slayer"]);

		expect(scout.moves.map((move) => move.key)).not.toContain("the-scout:field-scout");
	});

	it("offers both Field Scout and Giant Slayer when neither is picked yet", () => {
		const [scout] = playbookMoveSections("The Scout", []);
		const keys = scout.moves.map((move) => move.key);

		expect(keys).toContain("the-scout:field-scout");
		expect(keys).toContain("the-scout:giant-slayer");
	});

	// Same shape for The Advocate's Earthly Ally/Titanic pair.
	it("excludes Titanic once Earthly Ally is already picked, via their shared exclusiveGroup", () => {
		const [advocate] = playbookMoveSections("The Advocate", ["the-advocate:earthly-ally"]);
		const keys = advocate.moves.map((move) => move.key);

		expect(keys).not.toContain("the-advocate:titanic");
		expect(keys).toContain("the-advocate:woodland-whispers");
	});

	it("offers both Earthly Ally and Titanic when neither is picked yet", () => {
		const [advocate] = playbookMoveSections("The Advocate", []);
		const keys = advocate.moves.map((move) => move.key);

		expect(keys).toContain("the-advocate:earthly-ally");
		expect(keys).toContain("the-advocate:titanic");
	});

	// You Should See Me In A Crown's real requiresMoves: ["the-icon:touchstone"] — stays offered
	// (visible but disabled) rather than filtered, until Touchstone is also picked.
	it("disables (but still offers) a move whose real requiresMoves isn't met", () => {
		const [icon] = playbookMoveSections("The Icon");
		const crown = icon.moves.find((move) => move.key === "the-icon:you-should-see-me-in-a-crown");

		expect(crown.disabled).toBe(true);
		expect(crown.tooltip).toBe("Requires Touchstone");
	});

	it("enables that same move once its prerequisite is among the picked keys", () => {
		const [icon] = playbookMoveSections("The Icon", ["the-icon:touchstone"]);
		const crown = icon.moves.find((move) => move.key === "the-icon:you-should-see-me-in-a-crown");

		expect(crown.disabled).toBe(false);
		expect(crown.tooltip).toBeNull();
	});
});

describe("choosePlaybookMove", () => {
	it("renders the picker template with the built sections", async () => {
		choosePlaybookMove("The Scout");
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(
			expect.stringContaining("playbook-move-picker"),
			expect.objectContaining({ sections: expect.any(Array) })
		);
	});

	it("opens the dialog with the module's own styling classes, sized larger than Dialog's default and resizable", async () => {
		choosePlaybookMove("The Scout");
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[1]).toEqual({
			classes: ["armor-astir", "playbook-move-picker"],
			width: 560,
			height: 700,
			resizable: true
		});
	});

	it("resolves the checked move's key", async () => {
		const promise = choosePlaybookMove("The Scout");
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakePickerHtml(BULLHEADED));

		expect(await promise).toBe(BULLHEADED);
	});

	it("resolves null when Add is clicked with nothing selected", async () => {
		const promise = choosePlaybookMove("The Scout");
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakePickerHtml(undefined));

		expect(await promise).toBeNull();
	});

	it("resolves null when cancelled", async () => {
		const promise = choosePlaybookMove("The Scout");
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.cancel.callback();

		expect(await promise).toBeNull();
	});

	it("resolves null when the dialog is closed", async () => {
		const promise = choosePlaybookMove("The Scout");
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});

	it("hides the moves the actor already has from the picker", async () => {
		choosePlaybookMove("The Scout", [...SCOUT_KEYS, ...CANTRIP_KEYS, ...SOLDIER_KEYS]);
		await Promise.resolve();
		await Promise.resolve();

		const { sections } = renderTemplate.mock.calls.at(-1)[1];

		expect(sections.flatMap((section) => section.moves ?? [])).toEqual([]);
	});
});
