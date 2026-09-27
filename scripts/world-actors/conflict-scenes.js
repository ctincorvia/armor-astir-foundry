// Conflict Scenes (Conflict Scenes tab on the Authority and Cause sheets): a rules-text-only
// reference list, no mechanical effect — see docs/domains/world-actors.md, "Conflict Scenes".
// Stays a pure leaf module, same as downtime-scenes.js.
export const CONFLICT_SCENES = [
	{
		key: "an-unfurling-plan",
		name: "An Unfurling Plan",
		summary: [
			"Everyone plays, taking the role of either members of the Authority (as you hatch a plan of some nefarious nature) or the Cause (as you figure out how to thwart that plan). Decide together where this meeting is taking place, and who else is present. Who are you both playing? What history do you have?",
			"During the conversation, anyone may ask anyone else for details on the situation and circumstances."
		],
		playing: [
			"Players freely roleplay, issuing Challenges to escalate and complicate the Scene. Continue playing until at least three rolls have been made or the Scene reaches what feels like a natural end: look at the Resolutions below for what that might look like.",
			"During the scene, anyone may issue a Challenge:"
		],
		challenges: [
			"I present evidence of a spy in our ranks: roll to see if it's taken seriously.",
			"I point out a blind spot in our intel: will we recommit resources (reduce a beneficial clock by 1 step) or roll and take the risk?",
			"A step of our planning is left undone: who will roll and suggest a solution?",
			"My squad or group is eager to contribute. Who will give us direction?",
			"Explain to me how this represents the Authority/Cause's ideals.",
			"How does your plan better serve the common people?",
			"I'm hesitant to commit my resources: who will roll and try to convince me?"
		],
		resolutions: [
			"A consensus is reached: who benefits the most?",
			"We leave without reaching an agreement: who acts alone?",
			"The meeting falls to argument and conflict: who feels most slighted?"
		]
	},
	{
		key: "a-covert-op",
		name: "A Covert Op",
		summary: [
			"Everyone plays. The Director assumes the role of various Authority or Cause characters, while other players act as agents for the opposite. Discuss what kind of undercover operation you are leading, and what happens should you fail.",
			"Who are you? What part of the Division or what Factions are you tied to? Why were you chosen for this? What do you think about the mission?"
		],
		playing: [
			"Players freely roleplay, issuing Challenges to escalate and complicate the Scene. Continue playing until at least three rolls have been made or the Scene reaches what feels like a natural end: look at the Resolutions below for what that might look like.",
			"During the scene, anyone may issue a Challenge:"
		],
		challenges: [
			"A magical trap bars the way. Do you take a slow route around, or roll to disarm it?",
			"Tight guard patrols threaten to catch you. Roll to see if you can evade them.",
			"You must quickly and quietly take out a watchman: who will roll to do the job?",
			"Your intel turns out to be inaccurate: what's wrong, and how do you improvise?",
			"You find a position that overlooks something secret: describe it.",
			"Someone will have to split off as a decoy. Who goes? Roll to see how successful they are.",
			"Our plans are changed suddenly: roll to see if it's for better or worse."
		],
		resolutions: [
			"The agents are discovered and exposed: can they still escape?",
			"The agents escape without being caught: how do they celebrate?",
			"The agents sacrifice themselves to accomplish their duty: is it worth it?"
		]
	},
	{
		key: "all-out-war",
		name: "All Out War",
		summary: [
			"Everyone plays. Players distribute themselves between the Authority and the Cause evenly if possible, casting themselves as soldiers, Channelers and other members of the Division or a Faction. The Director may freely play characters from both sides where needed to facilitate the scene. Decide together where your battlefield is, what the stakes of this fight are and how these characters feel about the war and their place in it.",
			"Freely roleplay the clashing forces, Astir against Astir, Carrier vs Carrier, and so on. During the struggle, anyone may ask anyone else for details on the situation and circumstances."
		],
		playing: [
			"Players freely roleplay, issuing Challenges to escalate and complicate the Scene. Continue playing until at least three rolls have been made or the Scene reaches what feels like a natural end: look at the Resolutions below for what that might look like.",
			"During the scene, anyone may issue a Challenge:"
		],
		challenges: [
			"I come straight for you, weapons ready: roll to see if you can hold me back.",
			"I lead an unexpected ambush, and roll to see if I catch you by surprise.",
			"I separate you from your supporting forces: roll to see if you can regroup.",
			"You are ordered to pull back. Do you follow orders?",
			"I seem to drop my guard: if you seize the opportunity, roll to find out if it's a feint or not.",
			"Our battle endangers a group of civilians. If you refuse to hold back, roll.",
			"You could complete a key objective at cost. What would you lose? If you give it up, don't roll: just add a success."
		],
		resolutions: [
			"One side is forced to rout: are they cut down as they flee?",
			"A truce is reached: what are its terms?",
			"The battle will continue tomorrow, but an impressive push wins it for today: what is secured?"
		]
	},
	{
		key: "a-chase",
		name: "A Chase",
		summary: [
			"Two volunteers play, one hunter and one hunted. They should decide between them which takes the role of an Authority member and which represents the Cause, on what level the chase is occurring—on foot, in Astirs, etc—and why it is happening. Decide where the chase takes place, and who is at risk should things get messy.",
			"Freely roleplay the chase. During it, anyone may ask anyone else for details on the situation and circumstances. Other players may embody bystanders, the environment, and so on where required."
		],
		playing: [
			"Take turns making Challenges, starting with the hunter. Continue playing until at least three rolls have been made or the Scene reaches what feels like a natural end: look at the Resolutions below for what that might look like.",
			"During the scene, anyone may issue a Challenge:"
		],
		challenges: [
			"I lead you into a trap. Roll to see if you can escape it.",
			"We briefly draw close, and I injure you: how do you push me away?",
			"We dash through a dangerous area. Will you take your time, or will you roll to give chase?",
			"I deploy something magical to my advantage. What happens?",
			"I find a sudden burst of speed in me: roll to see if you can match me.",
			"I slip through a busy, crowded place. Do you rush through and cause a scene, or roll to find another path?",
			"You turn a corner and lose sight of me. How do you find me?"
		],
		resolutions: [
			"We walk into a dead end. Can the hunted still escape?",
			"An escape is in sight: can the hunter catch up in time?",
			"A third party intervenes: whose side are they on?"
		]
	},
	{
		key: "one-on-one",
		name: "One-On-One",
		summary: [
			"Two volunteers play, locked in conflict with one another. They should decide between them which takes the role of an Authority member and which represents the Cause, what form their duel takes, and what it's stakes are.",
			"Decide where the duel takes place, and who is at risk should things get messy.",
			"Freely roleplay the duel. During it, anyone may ask anyone else for details on the situation and circumstances. Other players may embody bystanders, the environment, and so on where required."
		],
		playing: [
			"Take turns making Challenges, starting with whoever has the most to lose. Continue playing until at least three rolls have been made or the Scene reaches what feels like a natural end: look at the Resolutions below for what that might look like.",
			"During the scene, anyone may issue a Challenge:"
		],
		challenges: [
			"My guard seems to drop for a moment. Will you roll to take the risk and strike?",
			"I reveal a surprising new weapon. Roll to see if you can adapt to it.",
			"We reach a momentary impasse: what do you say to me?",
			"I make a flashy, unnecessary play. Do you let me show off?",
			"I reach for a moment of intimacy, like a kiss, between blows. Will you let me close?",
			"Your allies appear. Do you allow them to intervene?",
			"I push you and our fight into a new location. Roll to see if you find an advantage here.",
			"I make an attack that threatens innocents. Will you roll to ensure their safety?"
		],
		resolutions: [
			"I drive you back to the point that you could flee. Do you run or stand?",
			"We are evenly matched. Will you risk something to strike me down?",
			"Your skills are undeniable. Can I convince you to join me?"
		]
	},
	{
		key: "the-discourse",
		name: "The Discourse",
		summary: [
			"Everyone plays, taking the role of either members of the Authority, the Cause, or both, as key figures discuss and politic among themselves, idly or otherwise. Anyone may be present, but roll; on a Division success, a Faction must still be tapped if you can do so without destroying it—the discourse is exhausting. Decide together where this conversation occurs, who else is present, and what the power dynamic between participants is.",
			"During the conversation, anyone may ask anyone else for details on the situation and circumstances."
		],
		playing: [
			"Players freely roleplay, issuing Challenges to escalate and complicate the Scene. Continue playing until the Scene reaches what feels like a natural end: after the discourse, there is no winner or loser and no Outcomes are earned. Simply choose a Resolution as a group.",
			"During the scene, anyone may issue a Challenge:"
		],
		challenges: [
			"I say something insulting about a superior or influential figure. Who reacts strongest?",
			"I press someone for their opinion on something. Do you answer honestly?",
			"I arrive, dressed to kill. Whose eye do I catch?",
			"I talk flippantly about our duties. Does anyone admonish me?",
			"I offer my opinion on another Division or Faction. Whose attention do I catch?",
			"I direct a flirtatious comment towards someone. Does it take root?",
			"I openly question our current course of action. Who can reassure me?",
			"I offer to take someone aside, to dance, talk privately, or otherwise. Is my offer accepted?",
			"I make a hopeful statement about our future. Can anyone back me up, genuinely?",
			"I say something overly revealing or personal. Does anyone press me on it?"
		],
		resolutions: [
			"Someone or something breaks up our discussion. Who or what, and why?",
			"Our conversation is overheard: by who?",
			"One of us makes a statement that history will look back on as prophetic: who, and what is it?"
		]
	}
];

export function findConflictScene(key, catalog = CONFLICT_SCENES) {
	return catalog.find((scene) => scene.key === key) ?? null;
}
