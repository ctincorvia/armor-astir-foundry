import { beforeEach, describe, expect, it, vi } from "vitest";
import { choosePlaybook, createPlaybookActor, PLAYBOOKS, registerPlaybookActorCreation, swapActorPlaybook } from "../scripts/actor-creation.js";

const SCOUT = PLAYBOOKS[0];

beforeEach(() => {
	vi.resetAllMocks();
	// resetAllMocks wipes the default Dialog implementation stubbed in tests/setup.js.
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
	});
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
			update: vi.fn().mockResolvedValue(undefined),
			items: [{ id: "old-item-1" }, { id: "old-item-2" }],
			deleteEmbeddedDocuments: vi.fn().mockResolvedValue(undefined),
			createEmbeddedDocuments: vi.fn().mockResolvedValue(undefined)
		};

		const result = await swapActorPlaybook(actor, PLAYBOOKS[1]);

		expect(actor.update).toHaveBeenCalledWith({
			"system.playbook": { name: PLAYBOOKS[1].name, slug: "the-commander", uuid: "" },
			"system.stats": { command: { value: 1 } },
			"system.attributes": {}
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
			update: vi.fn().mockResolvedValue(undefined),
			items: [],
			deleteEmbeddedDocuments: vi.fn(),
			createEmbeddedDocuments: vi.fn()
		};

		await swapActorPlaybook(actor, PLAYBOOKS[0]);

		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
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

describe("registerPlaybookActorCreation", () => {
	it("rebinds the directory's create-entry button", () => {
		registerPlaybookActorCreation();

		expect(Hooks.on).toHaveBeenCalledWith("renderActorDirectory", expect.any(Function));

		const off = vi.fn().mockReturnThis();
		const on = vi.fn();
		const button = { off, on };
		const html = { find: vi.fn().mockReturnValue(button) };

		const renderCallback = Hooks.on.mock.calls.at(-1)[1];
		renderCallback({}, html);

		expect(html.find).toHaveBeenCalledWith(".create-entry");
		expect(off).toHaveBeenCalledWith("click");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});

	it("prompts to choose a playbook, then creates the chosen one", async () => {
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
		const html = { find: vi.fn().mockReturnValue({ off: vi.fn().mockReturnThis(), on: vi.fn() }) };
		renderCallback({}, html);

		const clickHandler = html.find().on.mock.calls.at(-1)[1];
		const event = {
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
			currentTarget: { closest: vi.fn().mockReturnValue(null) }
		};
		const clickResult = clickHandler(event);

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		expect(Object.keys(dialogOptions.buttons)).toEqual(PLAYBOOKS.map((p) => p.packId));

		dialogOptions.buttons[PLAYBOOKS[1].packId].callback();
		await clickResult;
		// The click handler fires createPlaybookActor without awaiting it (same
		// fire-and-forget pattern Foundry event handlers use), so give its internal
		// awaits a chance to flush before asserting on them.
		await vi.waitFor(() => expect(Actor.create).toHaveBeenCalled());

		expect(Actor.create).toHaveBeenCalledWith(
			expect.objectContaining({ name: PLAYBOOKS[1].name }),
			{ renderSheet: true }
		);
	});

	it("creates the actor in the folder the create-entry button was clicked from", async () => {
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
		const html = { find: vi.fn().mockReturnValue({ off: vi.fn().mockReturnThis(), on: vi.fn() }) };
		renderCallback({}, html);

		const clickHandler = html.find().on.mock.calls.at(-1)[1];
		const event = {
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
			currentTarget: { closest: vi.fn().mockReturnValue({ dataset: { folderId: "folder1" } }) }
		};
		const clickResult = clickHandler(event);

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons[SCOUT.packId].callback();
		await clickResult;

		await vi.waitFor(() => expect(Actor.create).toHaveBeenCalled());
		expect(Actor.create).toHaveBeenCalledWith(
			expect.objectContaining({ folder: "folder1" }),
			{ renderSheet: true }
		);
	});

	it("does not create an actor when the playbook dialog is closed without a selection", async () => {
		const pack = {
			getIndex: vi.fn().mockResolvedValue([{ _id: "def456", name: PLAYBOOKS[1].name }]),
			getDocument: vi.fn()
		};
		game.packs.get.mockReturnValue(pack);

		registerPlaybookActorCreation();
		const renderCallback = Hooks.on.mock.calls.at(-1)[1];
		const html = { find: vi.fn().mockReturnValue({ off: vi.fn().mockReturnThis(), on: vi.fn() }) };
		renderCallback({}, html);

		const clickHandler = html.find().on.mock.calls.at(-1)[1];
		const event = {
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
			currentTarget: { closest: vi.fn().mockReturnValue(null) }
		};
		const clickResult = clickHandler(event);

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.close();
		await clickResult;

		expect(pack.getDocument).not.toHaveBeenCalled();
		expect(Actor.create).not.toHaveBeenCalled();
	});
});
