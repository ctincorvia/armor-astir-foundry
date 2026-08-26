import { renderTemplate } from "../compat.js";

// The Witch's Boons — see moves.js's Patron move (playbook-moves.js) and patron-mixin.js, which
// owns the actor-facing side of this domain (Influence, held Boons, the random grant, the manual
// picker, Relinquish). Follows the same catalog-in-code / keys-on-actor split as astir.js's
// ASTIR_PART_CATALOG/findAstirPart/resolveAstirParts trio, and stays free of any Foundry API the
// same way trait-bonuses.js/entry-list.js do, so the catalog lookups and random-pick logic are
// testable without stubbing an actor.
//
// Boon keys are namespaced witch-boon:..., not the-witch:..., since boons aren't moves and never
// touch ALL_MOVES/resolvePlaybookMoves — they're their own tracked resource
// (system.attributes.witch.boons), rendered read-only in their own Moves-tab group via
// moves-mixin.js's _movesData rather than joining either of those. Descriptions are plain text, not
// HTML, matching EQUIPMENT_TAGS' own catalog-item convention (equipment.js) rather than a move's own
// {{{description}}} rich text.
export const WITCH_BOONS = [
	{
		key: "witch-boon:empowering",
		name: "Empowering Boon",
		traits: [],
		description: "You may give your patron 1 Influence to make the subsystems move for free. When you " +
			"do so, describe what mark your patron's power leaves on the situation."
	},
	{
		key: "witch-boon:tenacious",
		name: "Tenacious Boon",
		traits: [],
		description: "When you cool off you may choose to succeed as if you had rolled a 10+. If you do so, " +
			"give your patron 1 Influence."
	},
	{
		key: "witch-boon:masking",
		name: "Masking Boon",
		traits: ["channel"],
		description: "You can mask yourself or an Astir you are attuned to against detection. When you do " +
			"so, roll +CHANNEL. On a 10+, you are disguised or cloaked in a fashion appropriate to your " +
			"patron. On a 7-9, the Director will tell you a flaw with your disguise.",
		results: {
			success: "You are disguised or cloaked in a fashion appropriate to your patron.",
			mixed: "The Director will tell you a flaw with your disguise.",
			failure: null
		}
	},
	{
		key: "witch-boon:shielding",
		name: "Shielding Boon",
		traits: [],
		description: "You may give your patron 1 Influence to avoid taking a risk."
	},
	{
		key: "witch-boon:shifting",
		name: "Shifting Boon",
		traits: [],
		// No new mechanic — the existing "manual edit + revert, no enforcement" precedent (Transmute
		// Self, the Astir/Ardent Approach swap) already covers a Sortie-scoped Trait swap just as well.
		description: "You may swap two of your Traits for this Sortie."
	},
	{
		key: "witch-boon:tricksters",
		name: "Trickster's Boon",
		traits: [],
		// Declarative flags, evaluated generically in PlaybookActorSheet (see CLAUDE.md's "behaviour
		// that depends on actor state goes in the sheet" convention) — this boon has no roll of its
		// own, so it surfaces entirely through every other move's own roll (_ridersForMove) and
		// resolution (_onMoveResolved).
		showsRollRiderOnAllRolls: true,
		activatesOnDoubles: true,
		description: "Whenever you roll doubles, something helpful but unexpected happens."
	}
];

export function findWitchBoon(key, catalog = WITCH_BOONS) {
	return catalog.find((boon) => boon.key === key) ?? null;
}

// Drops a boon key that no longer resolves — mirrors resolveAstirParts/resolvePlaybookMoves.
export function resolveWitchBoons(keys = [], catalog = WITCH_BOONS) {
	return keys.map((key) => findWitchBoon(key, catalog)).filter(Boolean);
}

export const WITCH_BOONS_PICKER_TEMPLATE = "modules/armor-astir/templates/witch-boons-picker.hbs";

// Patron's own random 2-boon grant, whenever this actor rolls Lead a Sortie (see
// patron-mixin.js's _grantRandomWitchBoons). Pure and injectable-random (mirrors the codebase's
// existing injectable-default convention, e.g. choosePlaybook's own `playbooks` parameter) so
// tests can pin deterministic output. Prefers boons not currently held — Borrowed Power's own text
// treats "don't currently have" as meaningful — falling back to the full catalog once there aren't
// enough un-held boons left to fill the grant, and never returns a duplicate key within one grant.
// Returns bare keys (not boon objects), so the result can feed straight into
// PlaybookActorSheet#_addWitchBoons the same way a manually chosen key list does.
export function pickRandomBoons(catalog, count, heldKeys = [], random = Math.random) {
	const unheld = catalog.filter((boon) => !heldKeys.includes(boon.key));
	const remaining = [...(unheld.length >= count ? unheld : catalog)];
	const picked = [];
	while (picked.length < count && remaining.length) {
		const index = Math.floor(random() * remaining.length);
		picked.push(remaining.splice(index, 1)[0].key);
	}
	return picked;
}

// Whims' manual "choose your boons instead of rolling" picker — mirrors chooseStartingMoves'
// Dialog/Promise shape (starting-moves.js) and its invalidReason/updateSaveState/authoritative-
// recheck idiom (equipment-dialogs.js's configureEquipment is the original pattern both mirror):
// Choose is disabled live with a CSS gate-tooltip once more than `count` boons are checked, and
// the callback re-checks and warns rather than trusting the DOM's disabled attribute, which
// Enter-to-submit can bypass. Resolves the chosen boon keys (or null if the dialog was dismissed
// or Choose was clicked over count), the same "keys, not objects" contract pickRandomBoons' own
// return value carries, so both of Boons' grant paths feed _addWitchBoons identically.
export async function chooseWitchBoons(catalog, count, heldKeys = []) {
	const content = await renderTemplate(WITCH_BOONS_PICKER_TEMPLATE, {
		boons: catalog.map((boon) => ({ ...boon, held: heldKeys.includes(boon.key) })),
		count
	});

	// The single source of truth for "why can't this be added right now" — shared by the render
	// callback's live Choose-button state and the Choose button's own authoritative recheck,
	// mirroring configureEquipment's own invalidReason (equipment-dialogs.js).
	const invalidReason = (html) => {
		const checkedCount = html.find("[name='witch-boon']:checked").map((_, el) => el.value).get().length;
		if (checkedCount > count) {
			return `You can choose at most ${count} Boon${count === 1 ? "" : "s"} (currently ${checkedCount} selected).`;
		}
		return null;
	};

	return new Promise((resolve) => {
		new Dialog({
			title: "Choose Boons",
			content,
			render: (html) => {
				const updateSaveState = () => {
					const reason = invalidReason(html);
					const addButton = html.find("[data-button='add']");
					addButton.prop("disabled", Boolean(reason));
					addButton.toggleClass("disabled", Boolean(reason));
					if (reason) addButton.attr("data-gate-tooltip", reason);
					else addButton.removeAttr("data-gate-tooltip");
				};
				html.find("[name='witch-boon']").on("change", updateSaveState);
				updateSaveState();
			},
			buttons: {
				add: {
					label: "Choose",
					callback: (html) => {
						// The authoritative gate — see invalidReason's own doc comment above on why this
						// can't just trust the DOM's live disabled attribute (Enter-to-submit bypasses it).
						const reason = invalidReason(html);
						if (reason) {
							ui.notifications.warn(reason);
							resolve(null);
							return;
						}
						const keys = html.find("[name='witch-boon']:checked").map((_, el) => el.value).get()
							.filter((key) => catalog.some((boon) => boon.key === key));
						resolve(keys);
					}
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "add",
			close: () => resolve(null)
		}, { classes: ["armor-astir", "witch-boons-picker"] }).render(true);
	});
}
