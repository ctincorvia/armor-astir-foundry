import { beforeEach, describe, expect, it, vi } from "vitest";
import { TIER_MIN } from "../scripts/equipment/equipment.js";
import {
	choosePlaybook,
	chooseActorKind,
	createPlaybookActor,
	createWorldActor,
	PLAYBOOKS,
	WORLD_ACTOR_KINDS,
	registerPlaybookActorCreation,
	swapActorPlaybook
} from "../scripts/actor-creation.js";

const SCOUT = PLAYBOOKS[0];
const CARRIER_KIND = WORLD_ACTOR_KINDS.find((k) => k.key === "carrier");
const AUTHORITY_KIND = WORLD_ACTOR_KINDS.find((k) => k.key === "authority");
const CAUSE_KIND = WORLD_ACTOR_KINDS.find((k) => k.key === "cause");
const NPC_KIND = WORLD_ACTOR_KINDS.find((k) => k.key === "npc");

beforeEach(() => {
	vi.resetAllMocks();
	// resetAllMocks wipes the default Dialog/randomID implementations stubbed in tests/setup.js.
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
	});
	foundry.utils.randomID.mockReturnValue("test-id");
});

describe("createPlaybookActor", () => {
	it("errors when the compendium pack is missing", async () => {
		game.packs.get.mockReturnValue(undefined);

		const result = await createPlaybookActor(SCOUT);

		expect(result).toBeNull();
		expect(ui.notifications.error).toHaveBeenCalled();
	});

	it("errors when the playbook entry is missing from the pack", async () => {
		game.packs.get.mockReturnValue({
			getIndex: vi.fn().mockResolvedValue([])
		});

		const result = await createPlaybookActor(SCOUT);

		expect(result).toBeNull();
		expect(ui.notifications.error).toHaveBeenCalled();
	});

	it("creates a world actor from the compendium playbook, dropping its _id", async () => {
		const scoutSource = {
			toObject: () => ({ _id: "abc123", name: SCOUT.name, type: "character" })
		};
		const pack = {
			getIndex: vi.fn().mockResolvedValue([{ _id: "abc123", name: SCOUT.name }]),
			getDocument: vi.fn().mockResolvedValue(scoutSource)
		};
		game.packs.get.mockReturnValue(pack);
		Actor.create.mockResolvedValue({ id: "new-actor" });

		const result = await createPlaybookActor(SCOUT, { folder: "folder1" });

		expect(pack.getDocument).toHaveBeenCalledWith("abc123");
		expect(Actor.create).toHaveBeenCalledWith(
			{ name: SCOUT.name, type: "character", folder: "folder1" },
			{ renderSheet: true }
		);
		expect(result).toEqual({ id: "new-actor" });
	});
});

describe("swapActorPlaybook", () => {
	it("errors when the compendium pack is missing", async () => {
		game.packs.get.mockReturnValue(undefined);
		const actor = { update: vi.fn(), items: [], deleteEmbeddedDocuments: vi.fn(), createEmbeddedDocuments: vi.fn() };

		const result = await swapActorPlaybook(actor, PLAYBOOKS[1]);

		expect(result).toBeNull();
		expect(ui.notifications.error).toHaveBeenCalled();
		expect(actor.update).not.toHaveBeenCalled();
	});

	it("errors when the playbook entry is missing from the pack", async () => {
		game.packs.get.mockReturnValue({
			getIndex: vi.fn().mockResolvedValue([])
		});
		const actor = { update: vi.fn(), items: [], deleteEmbeddedDocuments: vi.fn(), createEmbeddedDocuments: vi.fn() };

		const result = await swapActorPlaybook(actor, PLAYBOOKS[1]);

		expect(result).toBeNull();
		expect(ui.notifications.error).toHaveBeenCalled();
		expect(actor.update).not.toHaveBeenCalled();
	});

	it("replaces the actor's playbook data and items, leaving name/img/callsign untouched", async () => {
		const commanderSource = {
			toObject: () => ({
				_id: "def456",
				name: PLAYBOOKS[1].name,
				type: "character",
				system: {
					playbook: { name: PLAYBOOKS[1].name, slug: "the-commander", uuid: "" },
					stats: { command: { value: 1 } },
					attributes: {}
				},
				items: [{ name: "Rally the Troops", type: "move" }]
			})
		};
		const pack = {
			getIndex: vi.fn().mockResolvedValue([{ _id: "def456", name: PLAYBOOKS[1].name }]),
			getDocument: vi.fn().mockResolvedValue(commanderSource)
		};
		game.packs.get.mockReturnValue(pack);

		const actor = {
			system: { attributes: {} },
			update: vi.fn().mockResolvedValue(undefined),
			items: [{ id: "old-item-1" }, { id: "old-item-2" }],
			deleteEmbeddedDocuments: vi.fn().mockResolvedValue(undefined),
			createEmbeddedDocuments: vi.fn().mockResolvedValue(undefined)
		};

		const result = await swapActorPlaybook(actor, PLAYBOOKS[1]);

		expect(actor.update).toHaveBeenCalledWith({
			"system.playbook": { name: PLAYBOOKS[1].name, slug: "the-commander", uuid: "" },
			"system.stats": { command: { value: 1 } },
			"system.attributes": { equipment: [] }
		});
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["old-item-1", "old-item-2"]);
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [{ name: "Rally the Troops", type: "move" }]);
		expect(result).toBe(actor);
	});

	it("skips deleteEmbeddedDocuments/createEmbeddedDocuments when there's nothing to change", async () => {
		const scoutSource = {
			toObject: () => ({
				_id: "abc123",
				name: PLAYBOOKS[0].name,
				type: "character",
				system: { playbook: { name: PLAYBOOKS[0].name }, stats: {}, attributes: {} },
				items: []
			})
		};
		const pack = {
			getIndex: vi.fn().mockResolvedValue([{ _id: "abc123", name: PLAYBOOKS[0].name }]),
			getDocument: vi.fn().mockResolvedValue(scoutSource)
		};
		game.packs.get.mockReturnValue(pack);

		const actor = {
			system: { attributes: {} },
			update: vi.fn().mockResolvedValue(undefined),
			items: [],
			deleteEmbeddedDocuments: vi.fn(),
			createEmbeddedDocuments: vi.fn()
		};

		await swapActorPlaybook(actor, PLAYBOOKS[0]);

		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("preserves the actor's existing equipment across the swap, unlike playbookMoves", async () => {
		const scoutSource = {
			toObject: () => ({
				_id: "abc123",
				name: PLAYBOOKS[0].name,
				type: "character",
				system: {
					playbook: { name: PLAYBOOKS[0].name },
					stats: {},
					attributes: { playbookMoves: ["the-commander:some-move"] }
				},
				items: []
			})
		};
		const pack = {
			getIndex: vi.fn().mockResolvedValue([{ _id: "abc123", name: PLAYBOOKS[0].name }]),
			getDocument: vi.fn().mockResolvedValue(scoutSource)
		};
		game.packs.get.mockReturnValue(pack);

		const existingEquipment = [{ id: "eq1", kind: "weapon", name: "Halberd", tags: [], spent: [] }];
		const actor = {
			system: { attributes: { equipment: existingEquipment, playbookMoves: ["the-scout:field-scout"] } },
			update: vi.fn().mockResolvedValue(undefined),
			items: [],
			deleteEmbeddedDocuments: vi.fn(),
			createEmbeddedDocuments: vi.fn()
		};

		await swapActorPlaybook(actor, PLAYBOOKS[0]);

		expect(actor.update).toHaveBeenCalledWith({
			"system.playbook": { name: PLAYBOOKS[0].name },
			"system.stats": {},
			"system.attributes": { playbookMoves: ["the-commander:some-move"], equipment: existingEquipment }
		});
	});

	it("preserves the actor's Astir (and its equipment) when the new playbook still grants CHANNEL", async () => {
		const impostorSource = {
			toObject: () => ({
				_id: "ghi789",
				name: PLAYBOOKS[2].name,
				type: "character",
				system: { playbook: { name: PLAYBOOKS[2].name }, stats: { channel: { value: 0 } }, attributes: {} },
				items: []
			})
		};
		const pack = {
			getIndex: vi.fn().mockResolvedValue([{ _id: "ghi789", name: PLAYBOOKS[2].name }]),
			getDocument: vi.fn().mockResolvedValue(impostorSource)
		};
		game.packs.get.mockReturnValue(pack);

		const astir = { id: "a1", core: "alchemical", approach: "arcane", tier: 3, power: 4, overheating: false, parts: [], move: null };
		const astirWeapon = { id: "1", kind: "weapon", astir: true, name: "Lance", tags: [], spent: [] };
		const gear = { id: "2", kind: "gear", name: "Rope", tags: [], spent: [] };
		const actor = {
			system: { attributes: { astir, equipment: [astirWeapon, gear] } },
			update: vi.fn().mockResolvedValue(undefined),
			items: [],
			deleteEmbeddedDocuments: vi.fn(),
			createEmbeddedDocuments: vi.fn()
		};

		await swapActorPlaybook(actor, PLAYBOOKS[2]);

		expect(actor.update).toHaveBeenCalledWith({
			"system.playbook": { name: PLAYBOOKS[2].name },
			"system.stats": { channel: { value: 0 } },
			"system.attributes": { equipment: [astirWeapon, gear], astir }
		});
	});

	it("clears the actor's Astir and its equipment when the new playbook has CHANNEL disabled", async () => {
		const scoutSource = {
			toObject: () => ({
				_id: "abc123",
				name: PLAYBOOKS[0].name,
				type: "character",
				system: { playbook: { name: PLAYBOOKS[0].name }, stats: { channel: { value: 0, disabled: true } }, attributes: {} },
				items: []
			})
		};
		const pack = {
			getIndex: vi.fn().mockResolvedValue([{ _id: "abc123", name: PLAYBOOKS[0].name }]),
			getDocument: vi.fn().mockResolvedValue(scoutSource)
		};
		game.packs.get.mockReturnValue(pack);

		const astir = { id: "a1", core: "alchemical", approach: "arcane", tier: 3, power: 4, overheating: false, parts: [], move: null };
		const astirWeapon = { id: "1", kind: "weapon", astir: true, name: "Lance", tags: [], spent: [] };
		const gear = { id: "2", kind: "gear", name: "Rope", tags: [], spent: [] };
		const actor = {
			system: { attributes: { astir, equipment: [astirWeapon, gear] } },
			update: vi.fn().mockResolvedValue(undefined),
			items: [],
			deleteEmbeddedDocuments: vi.fn(),
			createEmbeddedDocuments: vi.fn()
		};

		await swapActorPlaybook(actor, PLAYBOOKS[0]);

		expect(actor.update).toHaveBeenCalledWith({
			"system.playbook": { name: PLAYBOOKS[0].name },
			"system.stats": { channel: { value: 0, disabled: true } },
			"system.attributes": { equipment: [gear] }
		});
	});

	it("keeps the actor's Astir and its equipment when swapping into Adrift, despite CHANNEL being disabled there too", async () => {
		const adriftSource = {
			toObject: () => ({
				_id: "adr123",
				name: PLAYBOOKS[8].name,
				type: "character",
				system: { playbook: { name: PLAYBOOKS[8].name }, stats: { channel: { value: 0, disabled: true } }, attributes: {} },
				items: []
			})
		};
		const pack = {
			getIndex: vi.fn().mockResolvedValue([{ _id: "adr123", name: PLAYBOOKS[8].name }]),
			getDocument: vi.fn().mockResolvedValue(adriftSource)
		};
		game.packs.get.mockReturnValue(pack);

		const astir = { id: "a1", core: "alchemical", approach: "arcane", tier: 3, power: 4, overheating: false, parts: [], move: null };
		const astirWeapon = { id: "1", kind: "weapon", astir: true, name: "Lance", tags: [], spent: [] };
		const gear = { id: "2", kind: "gear", name: "Rope", tags: [], spent: [] };
		const actor = {
			system: { attributes: { astir, equipment: [astirWeapon, gear] } },
			update: vi.fn().mockResolvedValue(undefined),
			items: [],
			deleteEmbeddedDocuments: vi.fn(),
			createEmbeddedDocuments: vi.fn()
		};

		await swapActorPlaybook(actor, PLAYBOOKS[8]);

		expect(actor.update).toHaveBeenCalledWith({
			"system.playbook": { name: PLAYBOOKS[8].name },
			"system.stats": { channel: { value: 0, disabled: true } },
			"system.attributes": { equipment: [astirWeapon, gear], astir }
		});
	});

	it("has nothing to preserve or clear when the actor never had an Astir", async () => {
		const impostorSource = {
			toObject: () => ({
				_id: "ghi789",
				name: PLAYBOOKS[2].name,
				type: "character",
				system: { playbook: { name: PLAYBOOKS[2].name }, stats: { channel: { value: 0 } }, attributes: {} },
				items: []
			})
		};
		const pack = {
			getIndex: vi.fn().mockResolvedValue([{ _id: "ghi789", name: PLAYBOOKS[2].name }]),
			getDocument: vi.fn().mockResolvedValue(impostorSource)
		};
		game.packs.get.mockReturnValue(pack);

		const actor = {
			system: { attributes: {} },
			update: vi.fn().mockResolvedValue(undefined),
			items: [],
			deleteEmbeddedDocuments: vi.fn(),
			createEmbeddedDocuments: vi.fn()
		};

		await swapActorPlaybook(actor, PLAYBOOKS[2]);

		expect(actor.update).toHaveBeenCalledWith({
			"system.playbook": { name: PLAYBOOKS[2].name },
			"system.stats": { channel: { value: 0 } },
			"system.attributes": { equipment: [] }
		});
	});
});

describe("choosePlaybook", () => {
	it("skips the dialog and resolves immediately when there is only one playbook", async () => {
		const result = await choosePlaybook([PLAYBOOKS[0]]);

		expect(result).toBe(PLAYBOOKS[0]);
		expect(Dialog).not.toHaveBeenCalled();
	});

	it("resolves null when the dialog is closed without a selection", async () => {
		const promise = choosePlaybook();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.close();

		expect(await promise).toBeNull();
	});
});

describe("createWorldActor", () => {
	it("creates a carrier actor with its starting system data", async () => {
		Actor.create.mockResolvedValue({ id: "new-carrier" });

		const result = await createWorldActor(CARRIER_KIND, { folder: "folder1" });

		expect(Actor.create).toHaveBeenCalledWith(
			{
				name: "Carrier",
				type: "armor-astir.carrier",
				folder: "folder1",
				system: {
					stats: { crew: { value: 0 } },
					details: { description: { value: "" } },
					attributes: { crewMembers: [], weapons: { primary: null, secondary: null }, crewSupportHold: 0 }
				}
			},
			{ renderSheet: true }
		);
		expect(result).toEqual({ id: "new-carrier" });
	});

	it("creates an authority actor at 9 stability, with three divisions each seeding three pillars keyed to that division", async () => {
		Actor.create.mockResolvedValue({ id: "new-authority" });
		// resetAllMocks (see this file's beforeEach) wiped the default randomID stub, which always
		// returns the constant "test-id" — that would make every Division's id identical and make
		// it impossible to verify each Pillar's divisionId actually points at a distinct Division.
		// A counter-based implementation, for this test only, gives each call a distinct id so the
		// FK pairing below can actually be checked.
		let nextId = 0;
		foundry.utils.randomID.mockImplementation(() => `id-${++nextId}`);

		await createWorldActor(AUTHORITY_KIND);

		expect(Actor.create).toHaveBeenCalledWith(
			{
				name: "Authority",
				type: "armor-astir.authority",
				folder: null,
				system: {
					attributes: {
						stability: { value: 9 },
						divisions: [
							{ id: "id-1", name: "", description: "", strength: 5, disfavor: 0, kind: "" },
							{ id: "id-2", name: "", description: "", strength: 4, disfavor: 0, kind: "" },
							{ id: "id-3", name: "", description: "", strength: 4, disfavor: 0, kind: "" }
						],
						pillars: [
							{ id: "id-4", divisionId: "id-1", name: "", description: "", grip: 0, felled: false },
							{ id: "id-5", divisionId: "id-1", name: "", description: "", grip: 0, felled: false },
							{ id: "id-6", divisionId: "id-1", name: "", description: "", grip: 0, felled: false },
							{ id: "id-7", divisionId: "id-2", name: "", description: "", grip: 0, felled: false },
							{ id: "id-8", divisionId: "id-2", name: "", description: "", grip: 0, felled: false },
							{ id: "id-9", divisionId: "id-2", name: "", description: "", grip: 0, felled: false },
							{ id: "id-10", divisionId: "id-3", name: "", description: "", grip: 0, felled: false },
							{ id: "id-11", divisionId: "id-3", name: "", description: "", grip: 0, felled: false },
							{ id: "id-12", divisionId: "id-3", name: "", description: "", grip: 0, felled: false }
						],
						assets: [],
						notableActors: []
					}
				}
			},
			{ renderSheet: true }
		);
	});

	it("creates a cause actor with empty factions and waywardFactions lists", async () => {
		Actor.create.mockResolvedValue({ id: "new-cause" });

		await createWorldActor(CAUSE_KIND);

		expect(Actor.create).toHaveBeenCalledWith(
			{ name: "Cause", type: "armor-astir.cause", folder: null, system: { attributes: { factions: [], waywardFactions: [] } } },
			{ renderSheet: true }
		);
	});

	it("creates an npc actor with a blank approach and tier at TIER_MIN", async () => {
		Actor.create.mockResolvedValue({ id: "new-npc" });

		await createWorldActor(NPC_KIND);

		expect(Actor.create).toHaveBeenCalledWith(
			{
				name: "NPC",
				type: "armor-astir.npc",
				folder: null,
				system: {
					details: { description: { value: "" } },
					attributes: { approach: "", tier: TIER_MIN, rival: { active: false, target: "", need: "", want: "", hold: 0 } }
				}
			},
			{ renderSheet: true }
		);
	});
});

describe("chooseActorKind", () => {
	it("offers Playbook plus every world actor kind, resolving the clicked kind's key", async () => {
		const promise = chooseActorKind();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		expect(Object.keys(dialogOptions.buttons)).toEqual(["playbook", "carrier", "authority", "cause", "npc"]);

		dialogOptions.buttons.carrier.callback();

		expect(await promise).toBe("carrier");
	});

	it("resolves null when the dialog is closed without a selection", async () => {
		const promise = chooseActorKind();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.close();

		expect(await promise).toBeNull();
	});

	it("builds its buttons from an injected world actor kind list", async () => {
		const customKinds = [{ key: "custom", name: "Custom" }];
		const promise = chooseActorKind(customKinds);

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		expect(Object.keys(dialogOptions.buttons)).toEqual(["playbook", "custom"]);

		dialogOptions.buttons.custom.callback();

		expect(await promise).toBe("custom");
	});
});

describe("registerPlaybookActorCreation", () => {
	// v13+'s AppV2 ActorDirectory passes a bare HTMLElement (and pbta's own directory dispatches
	// clicks via a delegated data-action listener, not a direct one — see actor-creation.js's own
	// comment on registerPlaybookActorCreation), so this suite exercises real DOM nodes rather than
	// the {find, off, on} jQuery-like fake a v12-only implementation could get away with.
	function buildDirectoryContainer({ folderId } = {}) {
		const container = document.createElement("div");
		const button = document.createElement("button");
		button.className = "create-entry";

		if (folderId) {
			const directoryItem = document.createElement("div");
			directoryItem.className = "directory-item";
			directoryItem.dataset.folderId = folderId;
			directoryItem.appendChild(button);
			container.appendChild(directoryItem);
		} else {
			container.appendChild(button);
		}

		return container;
	}

	// replaceWith swaps in a clone (see actor-creation.js), so the button actually wired with a
	// listener has to be re-queried from the DOM rather than reused from before the handler ran.
	function clickCreateEntry(container) {
		const freshButton = container.querySelector(".create-entry");
		freshButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		return freshButton;
	}

	async function latestDialogOptions() {
		const calls = await vi.waitFor(() => {
			expect(Dialog.mock.calls.length).toBeGreaterThan(0);
			return Dialog.mock.calls;
		});
		return calls.at(-1)[0];
	}

	it("rebinds the directory's create-entry button, replacing it with a clone so any direct v12-style listener is stripped", async () => {
		registerPlaybookActorCreation();

		expect(Hooks.on).toHaveBeenCalledWith("renderActorDirectory", expect.any(Function));

		const container = buildDirectoryContainer();
		const originalButton = container.querySelector(".create-entry");

		const renderCallback = Hooks.on.mock.calls.at(-1)[1];
		renderCallback({}, container);

		const freshButton = container.querySelector(".create-entry");
		expect(freshButton).not.toBeNull();
		expect(freshButton).not.toBe(originalButton);

		clickCreateEntry(container);

		const kindDialogOptions = await latestDialogOptions();
		expect(Object.keys(kindDialogOptions.buttons)).toEqual(["playbook", "carrier", "authority", "cause", "npc"]);
	});

	it("does nothing when the directory has no create-entry button", () => {
		registerPlaybookActorCreation();
		const renderCallback = Hooks.on.mock.calls.at(-1)[1];
		const container = document.createElement("div");

		expect(() => renderCallback({}, container)).not.toThrow();
		expect(Dialog).not.toHaveBeenCalled();
	});

	it("also accepts the html[0] jQuery-array shape, not just a bare HTMLElement", async () => {
		registerPlaybookActorCreation();
		const renderCallback = Hooks.on.mock.calls.at(-1)[1];
		const container = buildDirectoryContainer();

		renderCallback({}, [container]);
		clickCreateEntry(container);

		const kindDialogOptions = await latestDialogOptions();
		expect(Object.keys(kindDialogOptions.buttons)).toEqual(["playbook", "carrier", "authority", "cause", "npc"]);
	});

	it("prompts for a kind, then a playbook, then creates the chosen one", async () => {
		const pack = {
			getIndex: vi.fn().mockResolvedValue([{ _id: "def456", name: PLAYBOOKS[1].name }]),
			getDocument: vi.fn().mockResolvedValue({
				toObject: () => ({ _id: "def456", name: PLAYBOOKS[1].name, type: "character" })
			})
		};
		game.packs.get.mockReturnValue(pack);
		Actor.create.mockResolvedValue({ id: "new-actor" });

		registerPlaybookActorCreation();
		const renderCallback = Hooks.on.mock.calls.at(-1)[1];
		const container = buildDirectoryContainer();
		renderCallback({}, container);
		clickCreateEntry(container);

		const kindDialogOptions = await latestDialogOptions();
		expect(Object.keys(kindDialogOptions.buttons)).toEqual(["playbook", "carrier", "authority", "cause", "npc"]);
		kindDialogOptions.buttons.playbook.callback();
		// The kind dialog's callback only resolves chooseActorKind's promise — onCreateEntryClick's
		// continuation (which opens the playbook dialog) runs as a follow-up microtask.
		await vi.waitFor(() => expect(Dialog.mock.calls.at(-1)[0].title).toBe("Choose a Playbook"));

		const playbookDialogOptions = Dialog.mock.calls.at(-1)[0];
		expect(Object.keys(playbookDialogOptions.buttons)).toEqual(PLAYBOOKS.map((p) => p.packId));
		playbookDialogOptions.buttons[PLAYBOOKS[1].packId].callback();

		await vi.waitFor(() => expect(Actor.create).toHaveBeenCalled());

		expect(Actor.create).toHaveBeenCalledWith(
			expect.objectContaining({ name: PLAYBOOKS[1].name }),
			{ renderSheet: true }
		);
	});

	it("creates the playbook actor in the folder the create-entry button was clicked from", async () => {
		const scoutSource = {
			toObject: () => ({ _id: "abc123", name: SCOUT.name, type: "character" })
		};
		const pack = {
			getIndex: vi.fn().mockResolvedValue([{ _id: "abc123", name: SCOUT.name }]),
			getDocument: vi.fn().mockResolvedValue(scoutSource)
		};
		game.packs.get.mockReturnValue(pack);
		Actor.create.mockResolvedValue({ id: "new-actor" });

		registerPlaybookActorCreation();
		const renderCallback = Hooks.on.mock.calls.at(-1)[1];
		const container = buildDirectoryContainer({ folderId: "folder1" });
		renderCallback({}, container);
		clickCreateEntry(container);

		const kindDialogOptions = await latestDialogOptions();
		kindDialogOptions.buttons.playbook.callback();
		await vi.waitFor(() => expect(Dialog.mock.calls.at(-1)[0].title).toBe("Choose a Playbook"));

		const playbookDialogOptions = Dialog.mock.calls.at(-1)[0];
		playbookDialogOptions.buttons[SCOUT.packId].callback();

		await vi.waitFor(() => expect(Actor.create).toHaveBeenCalled());
		expect(Actor.create).toHaveBeenCalledWith(
			expect.objectContaining({ folder: "folder1" }),
			{ renderSheet: true }
		);
	});

	it("does not create anything when the kind dialog is closed without a selection", async () => {
		registerPlaybookActorCreation();
		const renderCallback = Hooks.on.mock.calls.at(-1)[1];
		const container = buildDirectoryContainer();
		renderCallback({}, container);
		clickCreateEntry(container);

		const kindDialogOptions = await latestDialogOptions();
		kindDialogOptions.close();
		await Promise.resolve();
		await Promise.resolve();

		expect(Actor.create).not.toHaveBeenCalled();
	});

	it("does not create a playbook actor when the playbook dialog is closed without a selection", async () => {
		const pack = {
			getIndex: vi.fn().mockResolvedValue([{ _id: "def456", name: PLAYBOOKS[1].name }]),
			getDocument: vi.fn()
		};
		game.packs.get.mockReturnValue(pack);

		registerPlaybookActorCreation();
		const renderCallback = Hooks.on.mock.calls.at(-1)[1];
		const container = buildDirectoryContainer();
		renderCallback({}, container);
		clickCreateEntry(container);

		const kindDialogOptions = await latestDialogOptions();
		kindDialogOptions.buttons.playbook.callback();
		await vi.waitFor(() => expect(Dialog.mock.calls.at(-1)[0].title).toBe("Choose a Playbook"));

		const playbookDialogOptions = Dialog.mock.calls.at(-1)[0];
		playbookDialogOptions.close();
		await Promise.resolve();
		await Promise.resolve();

		expect(pack.getDocument).not.toHaveBeenCalled();
		expect(Actor.create).not.toHaveBeenCalled();
	});

	it.each([
		["carrier", CARRIER_KIND],
		["authority", AUTHORITY_KIND],
		["cause", CAUSE_KIND],
		["npc", NPC_KIND]
	])("creates a %s actor directly, with no second dialog", async (key, kind) => {
		Actor.create.mockResolvedValue({ id: `new-${key}` });

		registerPlaybookActorCreation();
		const renderCallback = Hooks.on.mock.calls.at(-1)[1];
		const container = buildDirectoryContainer({ folderId: "folder1" });
		renderCallback({}, container);
		clickCreateEntry(container);

		const kindDialogOptions = await latestDialogOptions();
		kindDialogOptions.buttons[key].callback();

		await vi.waitFor(() => expect(Actor.create).toHaveBeenCalled());
		expect(Actor.create).toHaveBeenCalledWith(
			expect.objectContaining({ name: kind.name, type: kind.type, folder: "folder1" }),
			{ renderSheet: true }
		);
	});
});
