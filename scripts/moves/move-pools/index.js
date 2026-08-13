import { THE_SCOUT_POOL } from "./the-scout.js";
import { THE_COMMANDER_POOL } from "./the-commander.js";
import { THE_IMPOSTOR_POOL } from "./the-impostor.js";
import { THE_DIPLOMAT_POOL } from "./the-diplomat.js";
import { THE_ARCANIST_POOL } from "./the-arcanist.js";
import { THE_PARADIGM_POOL } from "./the-paradigm.js";
import { THE_WITCH_POOL } from "./the-witch.js";
import { THE_WITHER_POOL } from "./the-wither.js";
import { THE_ADRIFT_POOL } from "./the-adrift.js";
import { THE_ADVOCATE_POOL } from "./the-advocate.js";
import { THE_REVENANT_POOL } from "./the-revenant.js";
import { THE_SUMMONER_POOL } from "./the-summoner.js";
import { THE_ICON_POOL } from "./the-icon.js";
import { THE_ATTENDANT_POOL } from "./the-attendant.js";
import { THE_CAPTAIN_POOL } from "./the-captain.js";
import { CANTRIPS_POOL } from "./cantrips.js";
import { SOLDIER_POOL } from "./soldier.js";
import { THE_ARTIFICER_POOL } from "./the-artificer.js";

// Order matters: ALL_PLAYBOOK_MOVES (playbook-moves.js) inherits this array's order, and it is
// not alphabetical — cantrips/soldier are universal pools wedged between the-captain and
// the-artificer, matching the order the content was originally authored in.
export const MOVE_POOLS = [
	THE_SCOUT_POOL,
	THE_COMMANDER_POOL,
	THE_IMPOSTOR_POOL,
	THE_DIPLOMAT_POOL,
	THE_ARCANIST_POOL,
	THE_PARADIGM_POOL,
	THE_WITCH_POOL,
	THE_WITHER_POOL,
	THE_ADRIFT_POOL,
	THE_ADVOCATE_POOL,
	THE_REVENANT_POOL,
	THE_SUMMONER_POOL,
	THE_ICON_POOL,
	THE_ATTENDANT_POOL,
	THE_CAPTAIN_POOL,
	CANTRIPS_POOL,
	SOLDIER_POOL,
	THE_ARTIFICER_POOL
];
