// The moves-specific requiredFields/allowedFields lists for the custom-content engine's `moves`
// section (see custom-content-schema.js's CUSTOM_CONTENT_SECTIONS) — split into their own file
// rather than folded into custom-content-schema.js alongside equipment/astirWeapons/astirParts'
// own (much shorter) lists, since a move's own field surface is large enough on its own to deserve
// it (see claude.md's "split when a file's responsibilities multiply"). Pure data: this file
// imports nothing and is imported only by custom-content-schema.js.
//
// `traits` is required but may legitimately be `[]` — many real moves (Subsystems, B-Plot, Heat
// Up) roll no stat at all. `results` is deliberately not required — plenty of real moves (Crew
// Support, Subsystems) have none. "key" is never required here (see custom-content-schema.js's own
// doc comment — its format is validated separately by validateKey) but is still listed as allowed,
// matching every other section.
export const CUSTOM_MOVE_REQUIRED_FIELDS = ["name", "traits", "description"];

// Every field a custom Move addition may carry. See custom-content-moves-validate.js for the
// per-field validation this list is checked against once accepted, and docs/domains/reflavor.md's
// "Adding brand-new catalog entries" moves subsection for the fields deliberately left out of v1
// (usesWeapon, variableDicePool/successOptions, requiresParts) and why.
export const CUSTOM_MOVE_ALLOWED_FIELDS = [
	"key",
	"name",
	"description",
	"traits",
	"downtimeAbility",
	"tierBonus",
	"downtimeTokensMax",
	"exclusiveGroup",
	"removesTraitCap",
	"requiresMoves",
	"grantsWeaponTags",
	"separateHold",
	"suppressActivateButton",
	"flatHold",
	"questionsOnFailure",
	"questions",
	"results",
	"hold",
	"questionPrompts",
	"conditions",
	"intents",
	"uses",
	"fixedTraits",
	"numericTrackers",
	"grantsAutomaticSuccess",
	"grantsDowngradeHold",
	"grantsRollModifier",
	"addsCriticalReminderToMove",
	"addsMixedReminderToMove",
	"addsSuccessReminderToMove",
	"addsFailureReminderToMove",
	"addsTraitToMove",
	"addsQuestionsToMove",
	"grantsEquipment",
	"grantsWeaponTagChoice",
	"grantsAdvantageOnMove",
	"quickRollsMove",
	"grantsExternalRollBonus",
	"upgradesExternalRollBonusDie",
	"promptsApproachOverride",
	"bonusDowntimeTokens"
];
