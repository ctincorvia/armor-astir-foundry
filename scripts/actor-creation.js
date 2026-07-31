// Each playbook is a compendium Actor (see claude.md, "Domain conventions"). Adding a new
// playbook means adding an entry here plus its own compendium pack; no other code changes.
export const PLAYBOOKS = [
	{ packId: "armor-astir.basic-playbook-scout", name: "The Scout" },
	{ packId: "armor-astir.basic-playbook-commander", name: "The Commander" }
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
// system.details.callsign untouched (see claude.md, "Domain conventions").
export async function swapActorPlaybook(actor, playbook) {
	const data = await getPlaybookSourceData(playbook);
	if (!data) return null;

	await actor.update({
		"system.playbook": data.system.playbook,
		"system.stats": data.system.stats,
		"system.attributes": data.system.attributes
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
		}).render(true);
	});
}

async function onCreateEntryClick(event) {
	event.preventDefault();
	event.stopPropagation();
	const folder = event.currentTarget.closest(".directory-item")?.dataset.folderId ?? null;

	const playbook = await choosePlaybook();
	if (!playbook) return;

	createPlaybookActor(playbook, { folder });
}

export function registerPlaybookActorCreation() {
	Hooks.on("renderActorDirectory", (app, html) => {
		html.find(".create-entry").off("click").on("click", onCreateEntryClick);
	});
}
