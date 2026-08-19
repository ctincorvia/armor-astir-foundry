import { BASIC_MOVES, SPECIAL_MOVES } from "../../scripts/moves/moves.js";
import { ALL_PLAYBOOK_MOVES } from "../../scripts/moves/playbook-moves.js";
import { ASTIR_MOVE_CATALOG, ASTIR_PART_CATALOG } from "../../scripts/frames/astir.js";
import { ARDENT_FEATURE_PARTS } from "../../scripts/frames/ardent.js";

// Shared catalog-lookup constants for the PlaybookActorSheet astir/move-roll/roll-results/summoner
// test files, which were previously split across those files with duplicate
// `const X = CATALOG.find((m) => m.key === "...")` lines each. Centralized here the same way
// move-test-helpers.js centralizes roll/dialog fixtures for the move-*.test.js family. Each of these
// resolves against the real catalog regardless of whether the importing test file `vi.mock`s
// moves.js/playbook-moves.js/astir.js with an `importOriginal` passthrough — the mock intercepts at
// the module-graph level, so this file's own imports go through the same passthrough and land on
// the same real objects.

// BASIC_MOVES
export const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
export const STRIKE_DECISIVELY = BASIC_MOVES.find((m) => m.key === "strike-decisively");
export const WEATHER_THE_STORM = BASIC_MOVES.find((m) => m.key === "weather-the-storm");
export const READ_THE_ROOM = BASIC_MOVES.find((m) => m.key === "read-the-room");
export const DISPEL_UNCERTAINTIES = BASIC_MOVES.find((m) => m.key === "dispel-uncertainties");
export const BITE_THE_DUST = BASIC_MOVES.find((m) => m.key === "bite-the-dust");
export const WEAVE_MAGIC = BASIC_MOVES.find((m) => m.key === "weave-magic");
export const HELP_OR_HINDER = BASIC_MOVES.find((m) => m.key === "help-or-hinder");
export const COOL_OFF = BASIC_MOVES.find((m) => m.key === "cool-off");

// SPECIAL_MOVES
export const LEAD_A_SORTIE = SPECIAL_MOVES.find((m) => m.key === "lead-a-sortie");

// ALL_PLAYBOOK_MOVES
export const DENY = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:deny");
export const CLASSICAL_SPELLCASTING = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:classical-spellcasting");
export const I_KNOW_YOU = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-revenant:i-know-you");
export const ARCANE_AUGMENTS = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:arcane-augments");
export const LET_LOOSE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:let-loose");
export const DONT_FOLLOW_ME = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:dont-follow-me");
export const PATRON = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-witch:patron");
export const INDOMITABLE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "soldier:indomitable");
export const TRUTH_MAKING = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:truth-making");
export const A_GREENER_WORLD = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-advocate:a-greener-world");
export const SHARP_TONGUE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-diplomat:sharp-tongue");
export const BUREAUCRAT = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-diplomat:bureaucrat");
export const EIDOLON_DRIVE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-summoner:eidolon-drive");
export const BINDING = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-summoner:binding");
export const HELPING_HANDS = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-summoner:helping-hands");
export const LIVING_DRIVE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-summoner:living-drive");
export const ENDURING_SUPPORT = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-summoner:enduring-support");

// grantsRollModifier/grantsRollStack sources (Roll Modifiers section — see
// tests/playbook-actor-sheet-roll-modifiers.test.js and the-*.js/cantrips.js catalog entries).
export const WATCH_THIS = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-commander:watch-this");
export const SHARPER_KNIVES = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-diplomat:sharper-knives");
export const IDENTIFY = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-arcanist:identify");
export const NEW_PERSPECTIVE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-arcanist:new-perspective");
export const FIELD_TESTING = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-artificer:field-testing");
export const MASTER_SERVANT = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-attendant:master-servant");
export const THE_UTMOST_CARE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-attendant:the-utmost-care");
export const YOU_SHOULD_SEE_ME_IN_A_CROWN =
	ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-icon:you-should-see-me-in-a-crown");
export const DARK_GUARANTEES = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-wither:dark-guarantees");
export const SNAKES_IN_THE_GRASS = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-adrift:snakes-in-the-grass");
export const RAVENOUS_SPECTRE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-revenant:ravenous-spectre");
export const BONDED_IN_BLOOD = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-summoner:bonded-in-blood");
export const BULLHEADED = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:bullheaded");
export const EMBRACE_CHAOS = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-witch:embrace-chaos");
export const ALL_IN = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:all-in");
// separateHold (not flatHold) — the-arcanist:reshape, the one exercised _moveHoldValue/
// _moveHoldUpdatePath's "flatHold falsy, separateHold truthy" branch needs.
export const RESHAPE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-arcanist:reshape");

// ASTIR_PART_CATALOG
export const WEAPON_CONDUIT = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:weapon-conduit");
export const ALCHEMICAL_SUITE = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:alchemical-suite");
export const WARDING = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:warding");
export const ARTIFACT = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:artifact");
export const FLOURISH_COMPONENT = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:flourish-component");
export const SPELL_ROUTINES = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:spell-routines");
export const CHROMATIC_FOCUS = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:chromatic-focus");

// ARDENT_FEATURE_PARTS
export const CHROMATIC_RESERVES = ARDENT_FEATURE_PARTS.find((p) => p.key === "ardent-feature:chromatic-reserves");

// ASTIR_MOVE_CATALOG
export const LEGACY = ASTIR_MOVE_CATALOG.find((m) => m.key === "astir:legacy");
export const MANA_DEVOURER = ASTIR_MOVE_CATALOG.find((m) => m.key === "astir:mana-devourer");
export const PETRIFIER_CORE = ASTIR_MOVE_CATALOG.find((m) => m.key === "astir:petrifier-core");
export const INERTIA_DRIVE = ASTIR_MOVE_CATALOG.find((m) => m.key === "astir:inertia-drive");
export const FUTURE_SIGHT = ASTIR_MOVE_CATALOG.find((m) => m.key === "astir:future-sight");
export const MANAWHEELS = ASTIR_MOVE_CATALOG.find((m) => m.key === "astir:manawheels");
export const BRANDED_BLADES = ASTIR_MOVE_CATALOG.find((m) => m.key === "astir:branded-blades");
export const GOLIATH_SHIELD = ASTIR_MOVE_CATALOG.find((m) => m.key === "astir:goliath-shield");
