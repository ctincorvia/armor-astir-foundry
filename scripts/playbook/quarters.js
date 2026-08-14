// Quarters — a Support playbook's private space aboard the Carrier: a name, a free-text
// description, and up to QUARTERS_BENEFIT_MAX picked benefits from the fixed catalog below. Only
// "extra-token" carries a real mechanical effect (see quarters-mixin.js's
// _quartersExtraTokenSource, folded into progression-mixin.js's
// _bonusDowntimeTokenKeyedSources) — the other three are tracked as a pick only, applied by hand.
// Stays a pure leaf module (no import of playbook-actor-sheet.js or any mixin), same as witch.js
// and equipment.js's EQUIPMENT_TAGS/resolveEquipmentTags trio.
export const SUPPORT_PLAYBOOK_SLUGS = [
	"the-icon",
	"the-attendant",
	"the-commander",
	"the-captain",
	"the-diplomat",
	"the-artificer",
	"the-scout"
];

export const QUARTERS_BENEFIT_MAX = 2;

export const QUARTERS_BENEFITS = [
	{
		key: "extra-token",
		label: "Take an extra token when you enter Downtime.",
		bonusDowntimeTokens: { max: 1, description: "Quarters: an extra token when you enter Downtime." }
	},
	{ key: "cheap-advancement", label: "You may spend 5 Spotlight rather than 6 to earn an advancement." },
	{ key: "increase-crew", label: "Increase the Carrier's CREW by 1." },
	{ key: "increase-trait", label: "Add +1 to a Trait of your choice (max +3)." }
];

export function findQuartersBenefit(key, catalog = QUARTERS_BENEFITS) {
	return catalog.find((benefit) => benefit.key === key) ?? null;
}

// Drops a benefit key that no longer resolves — mirrors resolveEquipmentTags/resolveWitchBoons.
export function resolveQuartersBenefits(keys = [], catalog = QUARTERS_BENEFITS) {
	return keys.map((key) => findQuartersBenefit(key, catalog)).filter(Boolean);
}
