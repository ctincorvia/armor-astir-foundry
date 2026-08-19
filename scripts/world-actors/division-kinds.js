// A Division's kind determines its outcomes (one passive, always in effect, and a list of active
// outcomes the Authority can trigger) — catalog-in-code, key-on-actor (see docs/domains/world-actors.md,
// "Recurring conventions") so edited outcome text reaches existing Authorities without a data migration.
// Entirely display-only, resolved fresh in authority-actor-sheet.js's getData and rendered
// read-only — same convention as astir-parts.js's partType field.
export const DIVISION_KINDS = [
	{
		key: "military",
		label: "Military",
		passive:
			"<p>Deploying forces to attack or defend with violence.</p>" +
			"<p>Hold 3 to spend during the next Sortie 1-for-1 to:</p>" +
			"<ul><li>Introduce a new threat</li><li>Force someone to act in desperation</li></ul>",
		active: [
			"A Faction with 3 GRIP is seized.",
			"The Authority gains 1 GRIP on a Faction or Pillar.",
			"A vulnerable or exposed asset or actor is fortified or hidden."
		]
	},
	{
		key: "subterfuge",
		label: "Subterfuge",
		passive:
			"<p>Deploying spies or agents to deal with things covertly.</p>" +
			"<p>Place 1 GRIP on a Faction or Pillar of their choice.</p>",
		active: [
			"A Faction with 3 GRIP is seized.",
			"The Authority learns a secret about the Cause or a Faction.",
			"The Director may force a re-roll during a Conflict Scene this turn."
		]
	},
	{
		key: "resource",
		label: "Resource",
		passive:
			"<p>Accruing wealth, information and personnel.</p>" +
			"<p>Start a Division Scheme, or advance any existing one by 1 step.</p>",
		active: [
			"At the end of the Conflict Turn, you may re-assign which Divisions are Major or Minor.",
			"The next Sortie faces a complication: lead a Sortie with disadvantage.",
			"The Director takes 2 extra tokens during the next Downtime."
		]
	},
	{
		key: "research",
		label: "Research",
		passive:
			"<p>Developing new enchantments and rituals.</p>" +
			"<p>The Director may force a re-roll during a Conflict Scene this turn.</p>",
		active: [
			"The Authority learns a secret about the Cause or a Faction.",
			"The Authority starts a new Scheme, or advances an existing one.",
			"The Director takes 2 extra tokens during the next Downtime."
		]
	},
	{
		key: "curator",
		label: "Curator",
		passive:
			"<p>Stealing and investigating that which doesn't belong to it.</p>" +
			"<p>Start or advance a 4-step clock titled 'Take something that isn't theirs.'</p>",
		active: [
			"The Authority starts or advances a 4-step clock titled 'Take something that isn't theirs.'",
			"The Authority starts a new Scheme, or advances an existing one.",
			"A vulnerable or exposed asset or actor is fortified or hidden."
		]
	},
	{
		key: "executive",
		label: "Executive",
		passive:
			"<p>Protecting and deepening systems of control.</p>" +
			"<p>Sneaking through, fooling or subverting Authority security and bureaucracy is done in desperation.</p>",
		active: [
			"The next Sortie faces a complication: lead a Sortie with disadvantage.",
			"The Authority starts a new Scheme, or advances an existing one.",
			"The Director may force a re-roll during a Conflict Scene this turn."
		]
	}
];

export function findDivisionKind(key) {
	return DIVISION_KINDS.find((kind) => kind.key === key) ?? null;
}
