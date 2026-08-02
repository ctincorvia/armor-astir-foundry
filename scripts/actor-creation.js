// Each playbook is a compendium Actor (see claude.md, "Domain conventions"). Adding a new
// playbook means adding an entry here plus its own compendium pack; no other code changes.
export const PLAYBOOKS = [
	{ packId: "armor-astir.basic-playbook-scout", name: "The Scout" },
	{ packId: "armor-astir.basic-playbook-commander", name: "The Commander" },
	{ packId: "armor-astir.basic-playbook-impostor", name: "The Impostor" }
];

async function getPlaybookSourceData(playbook) {
	const pack = game.packs.get(playbook.packId);
	if (!pack) {
		ui.notifications.error(`Armor Astir | Could not find the ${playbook.packId} compendium.`);
		return null;
	}

	const index = await pack.getIndex();
	const entry = index.find((e) => e.name === playbook.name);
	if (!entry) {
		ui.notifications.error(`Armor Astir | Could not find "${playbook.name}" in the ${playbook.packId} compendium.`);
		return null;
	}

	const source = await pack.getDocument(entry._id);
	const data = source.toObject();
	delete data._id;
	return data;
}

export async function createPlaybookActor(playbook, { folder = null } = {}) {
	const data = await getPlaybookSourceData(playbook);
	if (!data) return null;
	data.folder = folder;

	return Actor.create(data, { renderSheet: true });
}

// Re-targets an existing character actor at a different playbook, replacing its playbook-derived
// data (system.playbook/stats/attributes and items) while leaving the actor's own name, img, and
// system.details.callsign untouched (see claude.md, "Domain conventions"). Equipment is one
// exception carved out of the attributes wipe: unlike playbookMoves — which is meant to reset,
// since Bite the Dust's own text says a new playbook doesn't come with new equipment — a
// character's gear is theirs, not the playbook's, so it survives the swap.
//
// The Astir (see astir.js/PlaybookActorSheet) is the character's too, but only when the new
// playbook still grants CHANNEL — an Astir the new playbook's own tab would immediately grey out
// as unavailable is dropped instead, along with any astir: true equipment entries it owns (same
// cleanup _onAstirDelete does), so nothing orphaned lingers in the equipment array.
export async function swapActorPlaybook(actor, playbook) {
	const data = await getPlaybookSourceData(playbook);
	if (!data) return null;

	const channelEnabled = !data.system.stats?.channel?.disabled;
	const currentEquipment = actor.system.attributes?.equipment ?? [];
	const equipment = channelEnabled ? currentEquipment : currentEquipment.filter((item) => !item.astir);
	const astir = actor.system.attributes?.astir;
	await actor.update({
		"system.playbook": data.system.playbook,
		"system.stats": data.system.stats,
		"system.attributes": {
			...data.system.attributes,
			equipment,
			...(channelEnabled && astir && { astir })
		}
	});

	const oldItemIds = actor.items.map((i) => i.id);
	if (oldItemIds.length) await actor.deleteEmbeddedDocuments("Item", oldItemIds);
	if (data.items?.length) await actor.createEmbeddedDocuments("Item", data.items);

	return actor;
}

// With a single playbook there's nothing to choose, so skip straight to creating it. With
// more than one, ask which playbook the new character should use. `playbooks` is injectable
// for testing the single-playbook shortcut without depending on how many are registered.
export function choosePlaybook(playbooks = PLAYBOOKS) {
	if (playbooks.length === 1) return Promise.resolve(playbooks[0]);

	return new Promise((resolve) => {
		const buttons = {};
		for (const playbook of playbooks) {
			buttons[playbook.packId] = {
				label: playbook.name,
				callback: () => resolve(playbook)
			};
		}

		new Dialog({
			title: "Choose a Playbook",
			content: "<p>Choose a playbook for the new character.</p>",
			buttons,
			close: () => resolve(null)
		}, { classes: ["armor-astir"] }).render(true);
	});
}

// One blank id-keyed entry, shared by every world actor kind's seeded lists below (Authority's
// fixed Pillars/Divisions slots today; any freeform list starts empty instead, since add/remove
// generates its own entries at claim-time via entry-list.js's addEntry).
function blankEntry(extra = {}) {
	return { id: foundry.utils.randomID(), name: "", description: "", ...extra };
}

// The non-playbook actor kinds a table can create (see claude.md, "World actors"). Unlike
// PLAYBOOKS, these aren't compendium-backed — buildSystem returns each kind's starting
// system data directly, freshly per call so array/object fields are never shared between
// actors created from the same kind entry.
export const WORLD_ACTOR_KINDS = [
	{
		key: "carrier",
		type: "armor-astir.carrier",
		name: "Carrier",
		buildSystem: () => ({
			stats: { crew: { value: 0 } },
			details: { description: { value: "" } },
			attributes: { crewMembers: [] }
		})
	},
	{
		key: "authority",
		type: "armor-astir.authority",
		name: "Authority",
		// Pillars and Divisions are always exactly three slots (see authority-actor-sheet.js) —
		// seeded blank here rather than left empty, since that sheet has no add/remove control
		// for either list. Divisions additionally seed Strength (0-5, starting at 5/4/4) and
		// Disfavor (0-10, always starting at 0).
		buildSystem: () => ({
			attributes: {
				stability: { value: 10 },
				pillars: [blankEntry(), blankEntry(), blankEntry()],
				divisions: [
					blankEntry({ strength: 5, disfavor: 0 }),
					blankEntry({ strength: 4, disfavor: 0 }),
					blankEntry({ strength: 4, disfavor: 0 })
				],
				assets: [],
				notableActors: []
			}
		})
	},
	{
		key: "cause",
		type: "armor-astir.cause",
		name: "Cause",
		buildSystem: () => ({ attributes: { factions: [] } })
	}
];

export async function createWorldActor(kind, { folder = null } = {}) {
	return Actor.create(
		{ name: kind.name, type: kind.type, folder, system: kind.buildSystem() },
		{ renderSheet: true }
	);
}

// Fronts choosePlaybook/createWorldActor with which kind of actor to create at all. Resolves
// "playbook", a WORLD_ACTOR_KINDS key, or null (dialog closed without a choice) — same
// close-resolves-null contract as choosePlaybook. `worldActorKinds` is injectable for testing,
// same reasoning as choosePlaybook's own `playbooks` parameter.
export function chooseActorKind(worldActorKinds = WORLD_ACTOR_KINDS) {
	return new Promise((resolve) => {
		const buttons = {
			playbook: { label: "Playbook", callback: () => resolve("playbook") }
		};
		for (const kind of worldActorKinds) {
			buttons[kind.key] = { label: kind.name, callback: () => resolve(kind.key) };
		}

		new Dialog({
			title: "Create Actor",
			content: "<p>What kind of actor do you want to create?</p>",
			buttons,
			close: () => resolve(null)
		}, { classes: ["armor-astir"] }).render(true);
	});
}

async function onCreateEntryClick(event) {
	event.preventDefault();
	event.stopPropagation();
	const folder = event.currentTarget.closest(".directory-item")?.dataset.folderId ?? null;

	const kindKey = await chooseActorKind();
	if (!kindKey) return;

	if (kindKey === "playbook") {
		const playbook = await choosePlaybook();
		if (!playbook) return;
		createPlaybookActor(playbook, { folder });
		return;
	}

	// kindKey is always either "playbook" (handled above) or one of WORLD_ACTOR_KINDS' own keys —
	// chooseActorKind's buttons are built from this exact list, so the lookup below can't miss.
	const worldKind = WORLD_ACTOR_KINDS.find((k) => k.key === kindKey);
	createWorldActor(worldKind, { folder });
}

export function registerPlaybookActorCreation() {
	Hooks.on("renderActorDirectory", (app, html) => {
		html.find(".create-entry").off("click").on("click", onCreateEntryClick);
	});
}
