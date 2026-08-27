// Downtime Scenes (Downtime tab): a fixed, rules-text-only reference list of the seven Scene Kinds
// a Downtime can be framed around — what the leading player does, and what everyone else can spend
// a token on during that Scene. No mechanical effect of its own (see claude.md's "Manual trackers,
// not enforcement" — this is read-only reference content, same as _downtimeAbilitiesData's list).
// Stays a pure leaf module (no import of playbook-actor-sheet.js or any mixin), same as quarters.js.
export const DOWNTIME_SCENE_KINDS = [
	{
		key: "command-deck-briefing-room",
		name: "Command Deck or Briefing Room",
		you: "The leading player helps plan for the upcoming Sortie: adding a d6 to the upcoming plan & prepare. They frame a short scene around this, either alone, or with invited characters.",
		everyoneElse: [
			{ text: "Contribute to the plan & prepare, as above.", subBullets: [] },
			{ text: "Report on aid they've given to a Faction, untapping it.", subBullets: [] },
			{ text: "Report on intel they've gathered: the Director will reveal something useful about the Sortie.", subBullets: [] },
			{ text: "Volunteer to take point: you'll lead a Sortie in confidence.", subBullets: [] }
		]
	},
	{
		key: "social-space-private-quarters",
		name: "Social Space or Private Quarters",
		you: "The leading player talks it out with another character and clears a peril of emotional or social origin from them, or they spend time with someone they have GRAVITY with, advancing it. They frame a short scene around this, either alone, or with invited characters.",
		everyoneElse: [
			{ text: "Talk it out and clear someone else's peril, as above.", subBullets: [] },
			{ text: "Encourage/demoralise someone: they'll make their first move during the Sortie at advantage/disadvantage.", subBullets: [] },
			{ text: "Spend time with someone you have GRAVITY with, advancing it.", subBullets: [] },
			{ text: "Rewrite a Hook, or press someone else to do the same.", subBullets: [] }
		]
	},
	{
		key: "fade",
		name: "Fade",
		you: "The leading player describes somewhere on the Carrier or nearby that they pass time, gaining a point of Spotlight and advancing a GRAVITY clock if they have one with someone that joins them. They frame a short scene around this, either alone, or with invited characters.",
		everyoneElse: [
			{ text: "Pass time, as above.", subBullets: [] }
		]
	},
	{
		key: "infirmary-hangar",
		name: "Infirmary or Hangar",
		you: "The leading player clears a peril of mechanical or physical origin from a character or construct, or swaps an Astir part out for another you already have. They frame a short scene around this, either alone, or with invited characters.",
		everyoneElse: [
			{ text: "Clear a peril or swap a part, as above.", subBullets: [] },
			{ text: "Help someone you have GRAVITY with, advancing it.", subBullets: [] },
			{ text: "Start or advance a long-term project: describe what your work looks like.", subBullets: [] },
			{ text: "Take their Astir and rush ahead: you'll lead a Sortie with +DEFY & advantage.", subBullets: [] }
		],
		note: "When you rush ahead, this doesn't end the Downtime: other Scenes can be played chronologically before this one, and the crew might also just not spring into action in your wake."
	},
	{
		key: "hallways-listening-post",
		name: "Hallways or Listening Post",
		you: "The leading player overhears something: they may start or advance a long-term project to learn more, or take advantage during the next Sortie acting on what they learned. They frame a short scene around this, either alone, or with invited characters.",
		everyoneElse: [
			{ text: "Overhear something, as above.", subBullets: [] },
			{ text: "Discuss how this info will factor into the Sortie: add a d6 to your plan & prepare.", subBullets: [] },
			{ text: "Have a heated conversation with someone you have GRAVITY with, advancing it.", subBullets: [] },
			{ text: "Barge in on whoever was overheard, causing trouble for someone involved.", subBullets: [] }
		]
	},
	{
		key: "somewhere-nearby",
		name: "Somewhere Nearby",
		you: "The leading player rolls a d4 to see what resources they can muster, and acquires gear or equipment with a total value up to the result. They may spend extra tokens or tap Factions to increase the result by another d4, or trade objects with the valuable or treasure tags for +2 or +4 respectively. They frame a short scene around this, either alone, or with invited characters.",
		everyoneElse: [
			{ text: "Buy or trade for something of value, as above.", subBullets: [] },
			{ text: "Start or advance a long-term project: describe what your work looks like.", subBullets: [] },
			{ text: "Spend time working or in the field with someone you have GRAVITY with, advancing it.", subBullets: [] },
			{ text: "Run into trouble: resolve it with moves as usual, and see what you learn.", subBullets: [] }
		],
		note: "As a reminder: smaller equipment like weapons and Astir parts have a basic cost equal to their Tier. Larger things, like Astirs and Ardents, have a basic cost equal to their Tier squared (Tier III things cost 9, etc). Gear with tags must have their values balance out to 0; see Tags & Gear (pg. 91) for more."
	},
	{
		key: "workshop-lab",
		name: "Workshop or Lab",
		you: "The leading player straps on their protective gear (or not) and gets to work on something. They may start or advance a long-term project to build something, run an experiment, salvage the leftover wreckage from a recent battle, attempt to figure out how a mechanism or spell works, etc.",
		everyoneElse: [
			{ text: "Start or advance a long-term project, as above.", subBullets: [] },
			{ text: "Spend time tinkering or working with someone you have GRAVITY with, advancing it.", subBullets: [] },
			{ text: "Produce something of trade value or strip spoils of battle for useful salvage, acquiring:", subBullets: ["Supplies I (valuable, bulky OR fragile)."] },
			{ text: "Make something that directly aids a Faction, untapping it.", subBullets: [] }
		]
	}
];

export function findDowntimeSceneKind(key, catalog = DOWNTIME_SCENE_KINDS) {
	return catalog.find((kind) => kind.key === key) ?? null;
}
