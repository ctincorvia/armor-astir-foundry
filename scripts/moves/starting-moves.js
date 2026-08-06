import { MOVE_POOLS, pickerMove } from "./playbook-moves.js";

export const STARTING_MOVE_PICKER_TEMPLATE = "modules/armor-astir/templates/starting-move-picker.hbs";

// Per-playbook starting-move allotments ("pick either Field Scout or Giant Slayer, as well as two
// others from your Additional Moves") — mirrors starting-gear.js's own pool/chooseCount shape and
// its enforcement stance: unlike MOVE_POOLS' own "+ Add Playbook Move" picker, which offers every
// pool to every actor with no cap (see playbook-moves.js's top comment), a starting-move
// allotment is a real chargen budget, so both pickOneKeys and chooseCount below are hard caps
// enforced by chooseStartingMoves.
//
// `poolKey` points back at the matching MOVE_POOLS entry (see startingMovePickerData) rather than
// this file carrying its own copy of the moves — same reasoning STARTING_GEAR_POOLS' `items` are
// snapshotted (equipment) while playbookMoves are not: a move's definition already lives in
// exactly one place (playbook-moves.js), so edited rules text reaches every actor.
//
// `grantedKeys` (The Impostor's Arcane Augments) are moves every character of that playbook just
// starts with — no pick involved, unlike pickOneKeys/chooseCount. They're shown read-only in the
// picker (see startingMovePickerData's grantedMoves) so the player can see what they're getting,
// but PlaybookActorSheet#_onStartingMovesAdd adds them to playbookMoves unconditionally, the same
// "clicking the button spends the one-time allowance regardless of what the dialog resolves"
// treatment _onStartingGearAdd already gives starting-gear.js's own grantedItems.
export const STARTING_MOVE_POOLS = [
	{
		playbookName: "The Scout",
		poolKey: "the-scout",
		grantedKeys: [],
		pickOneKeys: ["the-scout:field-scout", "the-scout:giant-slayer"],
		chooseCount: 2
	},
	{
		playbookName: "The Commander",
		poolKey: "the-commander",
		// "You start with the ace crew and debrief moves as well as one other from your Additional
		// Moves" — both always granted (no pick involved), same treatment The Impostor's own
		// grantedKeys gives Arcane Augments.
		grantedKeys: ["the-commander:ace-crew", "the-commander:debrief"],
		pickOneKeys: [],
		chooseCount: 1
	},
	{
		playbookName: "The Impostor",
		poolKey: "the-impostor",
		grantedKeys: ["the-impostor:arcane-augments"],
		pickOneKeys: [],
		chooseCount: 0
	},
	{
		playbookName: "The Diplomat",
		poolKey: "the-diplomat",
		// "You start with the facilitator move as well as two others from your Additional Moves" —
		// Facilitator is always granted (no pick involved), same treatment The Impostor's own
		// grantedKeys gives Arcane Augments.
		grantedKeys: ["the-diplomat:facilitator"],
		pickOneKeys: [],
		chooseCount: 2
	},
	{
		playbookName: "The Arcanist",
		poolKey: "the-arcanist",
		// Prepare Rituals is unconditionally granted ("You start with the prepare rituals move"). The
		// Astir's own unique move ("a move of your choice from your Additional Moves or the Cantrips
		// list") is handled separately by astir.js's existing chooseAstirMove/astirMoveSections, which
		// already offers exactly that selection (own playbook pool, then Cantrips, then the Astir Moves
		// catalog) — no playbook-move budget needed here for it.
		grantedKeys: ["the-arcanist:prepare-rituals"],
		pickOneKeys: [],
		chooseCount: 0
	},
	{
		playbookName: "The Paradigm",
		poolKey: "the-paradigm",
		// Tenets is unconditionally granted. The Astir's own unique move ("the Astir's own move from
		// Additional Moves or the Cantrips list") is handled the same generic way as The Arcanist's own
		// comment above describes — no separate budget needed here for it.
		grantedKeys: ["the-paradigm:tenets"],
		pickOneKeys: [],
		chooseCount: 0
	},
	{
		playbookName: "The Witch",
		poolKey: "the-witch",
		// "You start with the patron move" is unconditionally granted. The Astir's own unique move
		// ("a move of your choice from your Additional Moves or the Cantrips list") is handled the
		// same generic way as The Arcanist's/The Paradigm's own comments above describe — no
		// separate budget needed here for it.
		grantedKeys: ["the-witch:patron"],
		pickOneKeys: [],
		chooseCount: 0
	},
	{
		playbookName: "The Wither",
		poolKey: "the-wither",
		// "You start with the born to die move" is unconditionally granted. The Astir's own unique
		// move ("a move of your choice from your Additional Moves or the Cantrips list") is handled
		// the same generic way as every other Astir-piloting playbook's own comment above describes —
		// no separate budget needed here for it.
		grantedKeys: ["the-wither:born-to-die"],
		pickOneKeys: [],
		chooseCount: 0
	}
];

export function findStartingMovePool(playbookName, pools = STARTING_MOVE_POOLS) {
	return pools.find((pool) => pool.playbookName === playbookName) ?? null;
}

// Resolves a starting-move pool's pickOneKeys and remaining "Additional Moves" against the real
// move content in MOVE_POOLS (or an injectable movePools, for testing — mirrors
// playbookMoveSections' own injectable `pools` pattern). A move named in pickOneKeys that no
// longer exists in its source pool is dropped rather than breaking the picker, the same
// quietly-drop-stale-keys treatment resolvePlaybookMoves already gives an actor's own picks.
export function startingMovePickerData(pool, movePools = MOVE_POOLS) {
	const sourceMoves = movePools.find((p) => p.key === pool.poolKey)?.moves ?? [];
	return {
		grantedMoves: pool.grantedKeys
			.map((key) => sourceMoves.find((move) => move.key === key))
			.filter(Boolean)
			.map(pickerMove),
		pickOneMoves: pool.pickOneKeys
			.map((key) => sourceMoves.find((move) => move.key === key))
			.filter(Boolean)
			.map(pickerMove),
		additionalMoves: sourceMoves
			.filter((move) => !pool.pickOneKeys.includes(move.key) && !pool.grantedKeys.includes(move.key))
			.map(pickerMove),
		chooseCount: pool.chooseCount
	};
}

// Opens the one-time "+ Choose Starting Moves" picker for a playbook's pool and resolves the
// chosen move keys — the pickOne radio's key (if any was checked) followed by up to chooseCount
// checked Additional Move keys, in checkbox order — or null if the dialog was dismissed. Mirrors
// chooseStartingGear's promise/Dialog shape and its "normalize rather than reject" clamp on
// chooseCount.
export async function chooseStartingMoves(playbookName, pools = STARTING_MOVE_POOLS, movePools = MOVE_POOLS) {
	const pool = findStartingMovePool(playbookName, pools);
	if (!pool) return null;

	const { grantedMoves, pickOneMoves, additionalMoves, chooseCount } = startingMovePickerData(pool, movePools);
	const content = await renderTemplate(STARTING_MOVE_PICKER_TEMPLATE, { grantedMoves, pickOneMoves, additionalMoves, chooseCount });

	return new Promise((resolve) => {
		new Dialog({
			title: "Choose Starting Moves",
			content,
			buttons: {
				add: {
					label: "Add",
					callback: (html) => {
						// An empty jQuery set's .val() is undefined, same as "nothing checked" reads
						// everywhere else in this module — filtered against the real pickOneMoves so a
						// stale/tampered value can't sneak a non-existent key into playbookMoves.
						const rawPickOneKey = html.find("[name='starting-move-pick-one']:checked").val();
						const pickOneKey = pickOneMoves.some((move) => move.key === rawPickOneKey) ? rawPickOneKey : undefined;

						const additionalKeys = html.find("[name='starting-move-additional']:checked").map((_, el) => el.value).get()
							.filter((key) => additionalMoves.some((move) => move.key === key))
							.slice(0, chooseCount);

						resolve([pickOneKey, ...additionalKeys].filter(Boolean));
					}
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "add",
			close: () => resolve(null)
		}, { classes: ["armor-astir", "starting-move-picker"] }).render(true);
	});
}
