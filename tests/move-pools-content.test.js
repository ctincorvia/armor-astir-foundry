import { describe, expect, it } from "vitest";
import { MOVE_POOLS, findPlaybookMove } from "../scripts/moves/playbook-moves.js";

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

describe("MOVE_POOLS - cantrips", () => {
	it("gives Classical Spellcasting a chooseMove +CHANNEL addsTraitToMove grant, gated on being unmounted", () => {
		const classicalSpellcasting = findPlaybookMove("cantrips:classical-spellcasting");

		expect(classicalSpellcasting.traits).toEqual([]);
		expect(classicalSpellcasting.addsTraitToMove).toEqual({
			chooseMove: true,
			trait: "channel",
			requiresUnmounted: true
		});
	});

	it("gives Classical Spellcasting a Hand-casting grantsEquipment template, with no Tier in the name", () => {
		const classicalSpellcasting = findPlaybookMove("cantrips:classical-spellcasting");

		expect(classicalSpellcasting.grantsEquipment).toEqual({
			kind: "weapon",
			name: "Hand-casting",
			tags: ["ranged", "area"],
			scale: "foot"
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
