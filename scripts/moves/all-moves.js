import { BASIC_MOVES, SPECIAL_MOVES } from "./moves.js";
import { ALL_PLAYBOOK_MOVES } from "./playbook-moves.js";
import { ASTIR_MOVE_CATALOG } from "../frames/astir.js";
import { ARDENT_PART_CATALOG } from "../frames/ardent.js";

// All groups share one flat list for key lookup (PlaybookActorSheet#_onMoveRoll/_onMoveDescription)
// since a move's section (Basic vs Special vs Playbook vs Astir) is purely a sheet-display
// grouping, not part of its identity. Playbook/Astir move keys are pool-prefixed (see
// playbook-moves.js/astir.js) so this stays collision-free as pools fill in. ARDENT_PART_CATALOG
// (which already includes ASTIR_PART_CATALOG — see ardent.js) and ASTIR_MOVE_CATALOG are flattened
// in whole, the same "every possible entry, not just what's picked" treatment ALL_PLAYBOOK_MOVES
// already gives MOVE_POOLS — an individual actor's picked subset is resolved separately (see
// resolveAstirParts/findAstirMove in PlaybookActorSheet#getData). Ardent Features need to be in
// this flat list too — Roll/Activate/Description buttons, Refresh Sortie's uses-clearing walk, and
// the roll dialog all resolve a move purely by key here, regardless of which catalog it actually
// lives in.
export const ALL_MOVES = [...BASIC_MOVES, ...SPECIAL_MOVES, ...ALL_PLAYBOOK_MOVES, ...ARDENT_PART_CATALOG, ...ASTIR_MOVE_CATALOG];

// Moves that represent attacking with a weapon (see moves.js's usesWeapon). Drives both
// PlaybookActorSheet#_onMoveRoll's weapon-choice prompt and the per-weapon quick-roll buttons in
// the Equipment tab (see PlaybookActorSheet#_equipmentEntry).
export const WEAPON_MOVES = ALL_MOVES.filter((move) => move.usesWeapon);
