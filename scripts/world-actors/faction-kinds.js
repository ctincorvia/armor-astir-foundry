// A Faction's kind describes how it opposes the Authority and what happens when the party helps
// it — catalog-in-code, key-on-actor (see docs/domains/world-actors.md, "Recurring conventions")
// so edited outcome text reaches existing Causes without a data migration. Resolved fresh in
// cause-actor-sheet.js's getData and rendered read-only — same convention as division-kinds.js's
// DIVISION_KINDS, except these ten strings are plain text with no embedded HTML (unlike
// DIVISION_KINDS' passive/active fields), so the template renders them with {{}}, not {{{}}}.
export const FACTION_KINDS = [
	{ key: "guerrillas", label: "Guerrillas", opposes: "Opposes with ambushes and scattered force", outcome: "A specific asset or actor is made vulnerable or exposed in some way." },
	{ key: "agents", label: "Agents", opposes: "Opposes with assassination and subterfuge", outcome: "Disrupt the Authority, removing 1d3 GRIP on a Faction or Pillar." },
	{ key: "bandits", label: "Bandits", opposes: "Opposes with robbery and sabotage", outcome: "Reduce a Scheme clock 1 step, and increase a beneficial clock 1 step." },
	{ key: "despoilers", label: "Despoilers", opposes: "Opposes with unnecessary and imprecise force", outcome: "All Scheme clocks are reduced by d6. Players have 1 less token each next Downtime." },
	{ key: "scholars", label: "Scholars", opposes: "Opposes with ingenuity and curiosity", outcome: "Key intel gives the party advantage when they next lead a Sortie." },
	{ key: "suppliers", label: "Suppliers", opposes: "Opposes with new equipment or supplies", outcome: "Replace a seized Faction, or untap any other two Factions." },
	{ key: "firebrands", label: "Firebrands", opposes: "Opposes with propaganda and diplomacy", outcome: "A Division of your choice increases its disfavour by d6." },
	{ key: "military", label: "Military", opposes: "Opposes with direct assaults and force", outcome: "Fell a Pillar with 0 GRIP, or destroy a vulnerable Division (flip a coin: on tails, they become a Wayward Faction)." },
	{ key: "strange", label: "Strange", opposes: "Opposes with the weird and unexplained", outcome: "Something unexpected and strange happens." },
	{ key: "adventurers", label: "Adventurers", opposes: "Opposes with bold action and unpredictable tactics", outcome: "Deliver a cut of loot to the Carrier: flip a coin. Heads, it's valuable—tails, it's treasure." }
];

export function findFactionKind(key) {
	return FACTION_KINDS.find((kind) => kind.key === key) ?? null;
}
