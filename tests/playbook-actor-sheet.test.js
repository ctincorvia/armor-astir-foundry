import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/actor-creation.js", async (importOriginal) => ({
	...(await importOriginal()),
	swapActorPlaybook: vi.fn()
}));

vi.mock("../scripts/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	postGuidedResult: vi.fn(),
	postMoveDescription: vi.fn(),
	rollMove: vi.fn()
}));

// Only the picker dialog is mocked — the pool definitions and resolvePlaybookMoves stay real, so
// the sheet is exercised against the actual move content.
vi.mock("../scripts/playbook-moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	choosePlaybookMove: vi.fn()
}));

// Only the editor and catalog picker dialogs are mocked — the tag catalog, item catalog, and
// resolve helpers stay real, so the sheet is exercised against the actual Blitz/placeholder
// content, same reasoning as playbook-moves.js above.
vi.mock("../scripts/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn(),
	chooseEquipmentCatalogItem: vi.fn(),
	chooseWeapon: vi.fn()
}));

// Only the picker dialog is mocked — the pool definitions and findStartingGearPool stay real, same
// reasoning as playbook-moves.js above.
vi.mock("../scripts/starting-gear.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseStartingGear: vi.fn()
}));

// Only the picker dialog is mocked — the pool definitions and findStartingMovePool stay real, same
// reasoning as starting-gear.js above.
vi.mock("../scripts/starting-moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseStartingMoves: vi.fn()
}));

// Only the picker dialogs are mocked — the catalogs/helpers stay real, same reasoning as
// playbook-moves.js/equipment.js above.
vi.mock("../scripts/astir.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseAstirPart: vi.fn(),
	chooseAstirMove: vi.fn(),
	chooseAstirWeapon: vi.fn()
}));

// findCarrierActors defaults to no Carriers in the world, matching how lead-a-sortie's CREW
// fixedTraits placeholder behaved before Carrier existed — see the beforeEach reset below.
vi.mock("../scripts/carrier-actor-sheet.js", async (importOriginal) => ({
	...(await importOriginal()),
	findCarrierActors: vi.fn(() => []),
	chooseCarrier: vi.fn()
}));

// Only the Mount Up picker dialog is mocked — ardentParts/ardentWeapons/buildArdent/
// ardentLoadoutCount and the constants stay real, same reasoning as astir.js above.
vi.mock("../scripts/ardent.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseFrame: vi.fn()
}));

import { PLAYBOOKS, swapActorPlaybook } from "../scripts/actor-creation.js";
import { BASIC_MOVES, SPECIAL_MOVES, configureMoveRoll, postGuidedResult, postMoveDescription, rollMove } from "../scripts/moves.js";
import { ADVANCEMENT_TOP, ADVANCEMENT_BOTTOM } from "../scripts/advancements.js";
import { ALL_PLAYBOOK_MOVES, choosePlaybookMove } from "../scripts/playbook-moves.js";
import { UNARMED, chooseEquipmentCatalogItem, chooseWeapon, configureEquipment } from "../scripts/equipment.js";
import { STARTING_GEAR_POOLS, chooseStartingGear } from "../scripts/starting-gear.js";
import { chooseStartingMoves } from "../scripts/starting-moves.js";
import { GRAVITY_TRIGGERS } from "../scripts/gravity-triggers.js";
import { PLAYBOOK_FLAVOR, defaultConsiderText, defaultLookText } from "../scripts/playbook-flavor.js";
import {
	ASTIR_CORES,
	ASTIR_DEFAULT_IMG,
	ASTIR_MOVE_CATALOG,
	ASTIR_PART_CATALOG,
	ASTIR_POWER_BASE,
	ASTIR_POWER_MIN,
	ASTIR_TIER_MAX,
	ASTIR_TIER_MIN,
	astirMaxPower,
	astirMaxWeaponPower,
	chooseAstirMove,
	chooseAstirPart,
	chooseAstirWeapon
} from "../scripts/astir.js";
import { findCarrierActors, chooseCarrier } from "../scripts/carrier-actor-sheet.js";
import { ARDENT_TIER_MAX, ARDENT_TIER_MIN, ardentParts, ardentWeapons, chooseFrame } from "../scripts/ardent.js";
import {
	PlaybookActorSheet,
	registerPlaybookActorSheet,
	registerMoveChatListeners,
	onRenderMoveChat,
	mergeSpentTags,
	TRAITS
} from "../scripts/playbook-actor-sheet.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const STRIKE_DECISIVELY = BASIC_MOVES.find((m) => m.key === "strike-decisively");
const DISPEL_UNCERTAINTIES = BASIC_MOVES.find((m) => m.key === "dispel-uncertainties");
const WEAVE_MAGIC = BASIC_MOVES.find((m) => m.key === "weave-magic");
const BITE_THE_DUST = BASIC_MOVES.find((m) => m.key === "bite-the-dust");
const LEAD_A_SORTIE = SPECIAL_MOVES.find((m) => m.key === "lead-a-sortie");
const SUBSYSTEMS = SPECIAL_MOVES.find((m) => m.key === "subsystems");
const B_PLOT = SPECIAL_MOVES.find((m) => m.key === "b-plot");
const BULLHEADED = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:bullheaded");
const ARCANE_AUGMENTS = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:arcane-augments");
const LET_LOOSE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:let-loose");
const DONT_FOLLOW_ME = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:dont-follow-me");
const FACILITATOR = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-diplomat:facilitator");
const BUREAUCRAT = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-diplomat:bureaucrat");
const FACE_TO_FACE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:face-to-face");
const DENY = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:deny");
const SEEK_ALLIES = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:seek-allies");
const PERSONAL_FAMILIAR = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:personal-familiar");
const WEAPON_CONDUIT = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:weapon-conduit");
const INPUT_CHANNEL = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:input-channel");
const SPELL_ROUTINES = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:spell-routines");
const FLOURISH_COMPONENT = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:flourish-component");
const ALCHEMICAL_SUITE = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:alchemical-suite");
const STANDARDISED_PARTS = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:standardised-parts");
const DIVINATION_CODEX = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:divination-codex");
const WARDING = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:warding");
const ARTIFACT = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:artifact");
const READ_THE_ROOM = BASIC_MOVES.find((m) => m.key === "read-the-room");

beforeEach(() => {
	swapActorPlaybook.mockClear();
	configureMoveRoll.mockClear();
	postGuidedResult.mockClear();
	postMoveDescription.mockClear();
	rollMove.mockClear();
	// rollMove resolves { message, dice } (see moves.js) — a bare default so every existing test
	// that doesn't care about the roll's dice (most of them) doesn't have to configure this itself.
	// Tests that do care (Flourish Component's doubles regen) override this per-test.
	rollMove.mockResolvedValue({ message: undefined, dice: null });
	choosePlaybookMove.mockClear();
	configureEquipment.mockClear();
	chooseEquipmentCatalogItem.mockClear();
	chooseWeapon.mockClear();
	chooseStartingGear.mockClear();
	chooseStartingMoves.mockClear();
	chooseAstirPart.mockClear();
	chooseAstirMove.mockClear();
	chooseAstirWeapon.mockClear();
	findCarrierActors.mockClear();
	findCarrierActors.mockReturnValue([]);
	chooseCarrier.mockClear();
	chooseFrame.mockClear();
});

describe("PlaybookActorSheet", () => {
	it("extends the core ActorSheet", () => {
		expect(PlaybookActorSheet.prototype instanceof ActorSheet).toBe(true);
	});
});

describe("PlaybookActorSheet.defaultOptions", () => {
	it("merges the playbook sheet's classes/template/size onto the base options", () => {
		const options = PlaybookActorSheet.defaultOptions;

		expect(options).toEqual({
			classes: ["armor-astir", "sheet", "actor", "playbook"],
			template: "modules/armor-astir/templates/playbook-actor-sheet.hbs",
			width: 760,
			tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "moves" }]
		});
	});
});

describe("registerPlaybookActorSheet", () => {
	it("registers the sheet as the default character sheet on init", () => {
		registerPlaybookActorSheet();

		expect(Hooks.once).toHaveBeenCalledWith("init", expect.any(Function));

		const callback = Hooks.once.mock.calls.at(-1)[1];
		callback();

		expect(Actors.registerSheet).toHaveBeenCalledWith("pbta", PlaybookActorSheet, {
			types: ["character"],
			makeDefault: true
		});
	});
});

function fakeChatHtml() {
	const state = { handler: null };
	state.html = {
		find: (selector) => (selector === ".move-reroll"
			? { on: (event, handler) => { state.handler = handler; } }
			: {})
	};
	return state;
}

describe("registerMoveChatListeners", () => {
	it("registers a renderChatMessage hook wired to onRenderMoveChat", () => {
		registerMoveChatListeners();

		expect(Hooks.on).toHaveBeenCalledWith("renderChatMessage", onRenderMoveChat);
	});
});

describe("onRenderMoveChat (Decisive/Defensive/Versatile reroll)", () => {
	it("does nothing for a message with no reroll offer", () => {
		const fake = fakeChatHtml();

		onRenderMoveChat({ flags: {} }, fake.html);

		expect(fake.handler).toBeNull();
	});

	it("does nothing for a message with no flags at all", () => {
		const fake = fakeChatHtml();

		expect(() => onRenderMoveChat({}, fake.html)).not.toThrow();
		expect(fake.handler).toBeNull();
	});

	it("wires the Reroll button, disabling it on click and rerunning the move", async () => {
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", tags: ["defensive"], spent: [] };
		const actor = { id: "actor1", system: { attributes: { equipment: [rifle] } }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const reroll = {
			actorId: "actor1",
			moveKey: "exchange-blows",
			trait: { key: "clash", label: "CLASH", value: 0 },
			equipmentId: "eq1",
			tagKey: "defensive",
			options: { advantage: "none", effect: "none", weaponLabel: "Rifle" }
		};
		const fake = fakeChatHtml();

		onRenderMoveChat({ flags: { "armor-astir": { reroll } } }, fake.html);
		const button = { disabled: false };
		fake.handler({ currentTarget: button });
		await Promise.resolve();
		await Promise.resolve();

		expect(button.disabled).toBe(true);
		expect(actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...rifle, spent: ["defensive"] }]
		});
		expect(rollMove).toHaveBeenCalledWith(actor, EXCHANGE_BLOWS, reroll.trait, reroll.options);
	});

	it("does nothing when the actor no longer exists", async () => {
		game.actors.get.mockReturnValue(undefined);
		const reroll = {
			actorId: "gone", moveKey: "exchange-blows", trait: {}, equipmentId: "eq1", tagKey: "defensive", options: {}
		};
		const fake = fakeChatHtml();

		onRenderMoveChat({ flags: { "armor-astir": { reroll } } }, fake.html);
		fake.handler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();

		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does nothing when the move no longer resolves", async () => {
		const actor = { id: "actor1", system: { attributes: {} }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const reroll = {
			actorId: "actor1", moveKey: "not-a-real-move", trait: {}, equipmentId: "eq1", tagKey: "defensive", options: {}
		};
		const fake = fakeChatHtml();

		onRenderMoveChat({ flags: { "armor-astir": { reroll } } }, fake.html);
		fake.handler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("treats a missing equipment array as empty when marking the reroll tag spent", async () => {
		const actor = { id: "actor1", system: { attributes: {} }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const reroll = {
			actorId: "actor1", moveKey: "exchange-blows", trait: {}, equipmentId: "eq1", tagKey: "defensive", options: {}
		};
		const fake = fakeChatHtml();

		onRenderMoveChat({ flags: { "armor-astir": { reroll } } }, fake.html);
		fake.handler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.equipment": [] });
	});
});

describe("PlaybookActorSheet#getData", () => {
	it("adds the playbook list and the actor's current playbook id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[1].name } } };

		const data = sheet.getData();

		expect(data.playbooks).toBe(PLAYBOOKS);
		expect(data.currentPlaybookId).toBe(PLAYBOOKS[1].packId);
	});

	it("falls back to null when the actor has no playbook set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData();

		expect(data.currentPlaybookId).toBeNull();
	});

	it("scopes the approach options to the actor's playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-impostor" } } };

		const data = sheet.getData();

		expect(data.approachOptions.map((a) => a.key)).toEqual(["arcane", "elemental"]);
	});

	it("gives the actor's playbook its gravity trigger", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-commander" } } };

		const data = sheet.getData();

		expect(data.gravityTrigger).toBe(GRAVITY_TRIGGERS["the-commander"]);
	});

	it("falls back to null gravity trigger when the actor has no playbook set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData();

		expect(data.gravityTrigger).toBeNull();
	});

	it("seeds Look/Consider with the playbook's flavor prompts when the actor has none saved", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-scout" } } };

		const data = sheet.getData();

		expect(data.lookText).toBe(defaultLookText("the-scout"));
		expect(data.considerText).toBe(defaultConsiderText("the-scout"));
		expect(PLAYBOOK_FLAVOR["the-scout"].look.length).toBeGreaterThan(0);
	});

	it("falls back to empty Look/Consider text when the actor has no playbook set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData();

		expect(data.lookText).toBe("");
		expect(data.considerText).toBe("");
	});

	it("prefers the actor's own saved Look/Consider text over the playbook's flavor prompts", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { slug: "the-scout" },
				details: { look: { value: "<p>My own look</p>" }, consider: { value: "<p>My own answer</p>" } }
			}
		};

		const data = sheet.getData();

		expect(data.lookText).toBe("<p>My own look</p>");
		expect(data.considerText).toBe("<p>My own answer</p>");
	});

	it("defaults an actor with no picked moves and no Astir to Tier 1", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData();

		expect(data.tier).toEqual({ base: 1, effective: 1, fromFrame: false });
	});

	it("raises base Tier off a picked move's conflictTier, e.g. Field Scout", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: ["the-scout:field-scout"] } } };

		const data = sheet.getData();

		expect(data.tier).toEqual({ base: 2, effective: 2, fromFrame: false });
	});

	it("takes the higher of two conflictTier moves rather than the last one picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: ["the-scout:field-scout", "the-scout:giant-slayer"] } }
		};

		const data = sheet.getData();

		expect(data.tier.base).toBe(3);
	});

	it("reads Tier off the Astir instead of base while piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			name: "Vanguard",
			system: {
				attributes: {
					playbookMoves: ["the-scout:field-scout"],
					astir: { tier: 4, piloted: true }
				}
			}
		};

		const data = sheet.getData();

		expect(data.tier).toEqual({ base: 2, effective: 4, fromFrame: true, frameName: "Vanguard" });
	});

	it("reads Tier off an Ardent instead of base while it's the mounted frame", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			name: "Vanguard",
			system: {
				attributes: {
					playbookMoves: ["the-scout:field-scout"],
					ardents: [{ id: "ar1", name: "Warhound", tier: 3, piloted: true }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.tier).toEqual({ base: 2, effective: 3, fromFrame: true, frameName: "Warhound" });
	});

	it("reverts to base Tier once dismounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: ["the-scout:field-scout"],
					astir: { tier: 4, piloted: false }
				}
			}
		};

		const data = sheet.getData();

		expect(data.tier).toEqual({ base: 2, effective: 2, fromFrame: false });
	});
});

describe("PlaybookActorSheet#activateListeners", () => {
	it("binds a change handler to the playbook select", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".playbook-select");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_seedCosmeticDefaults", () => {
	it("writes both Look and Consider defaults for an owned actor with neither stored", () => {
		const sheet = new PlaybookActorSheet();
		const update = vi.fn();
		sheet.actor = { isOwner: true, system: { playbook: { slug: "the-scout" } }, update };

		sheet._seedCosmeticDefaults();

		expect(update).toHaveBeenCalledWith({
			"system.details.look.value": defaultLookText("the-scout"),
			"system.details.consider.value": defaultConsiderText("the-scout")
		});
	});

	it("does nothing for an actor the current user doesn't own", () => {
		const sheet = new PlaybookActorSheet();
		const update = vi.fn();
		sheet.actor = { isOwner: false, system: { playbook: { slug: "the-scout" } }, update };

		sheet._seedCosmeticDefaults();

		expect(update).not.toHaveBeenCalled();
	});

	it("does not resurrect a field the player deliberately cleared to an empty string", () => {
		const sheet = new PlaybookActorSheet();
		const update = vi.fn();
		sheet.actor = {
			isOwner: true,
			system: { playbook: { slug: "the-scout" }, details: { look: { value: "" }, consider: { value: "" } } },
			update
		};

		sheet._seedCosmeticDefaults();

		expect(update).not.toHaveBeenCalled();
	});

	it("only seeds the one field still missing when the other is already stored", () => {
		const sheet = new PlaybookActorSheet();
		const update = vi.fn();
		sheet.actor = {
			isOwner: true,
			system: { playbook: { slug: "the-scout" }, details: { look: { value: "<p>Mine</p>" } } },
			update
		};

		sheet._seedCosmeticDefaults();

		expect(update).toHaveBeenCalledWith({ "system.details.consider.value": defaultConsiderText("the-scout") });
	});

	it("does nothing for a playbook with no flavor prompts to seed", () => {
		const sheet = new PlaybookActorSheet();
		const update = vi.fn();
		sheet.actor = { isOwner: true, system: { playbook: { slug: "the-commander" } }, update };

		sheet._seedCosmeticDefaults();

		expect(update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onPlaybookChange", () => {
	it("swaps the actor to the selected playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		sheet._onPlaybookChange({ currentTarget: { value: PLAYBOOKS[1].packId } });

		expect(swapActorPlaybook).toHaveBeenCalledWith(sheet.actor, PLAYBOOKS[1]);
	});

	it("does nothing for an unrecognized value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: {} } };

		sheet._onPlaybookChange({ currentTarget: { value: "not-a-real-pack" } });

		expect(swapActorPlaybook).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#getData - traits", () => {
	it("defaults every trait to value 0, no bonus, and enabled when system.stats is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.traits).toEqual(
			TRAITS.map(({ key, label }) => ({ key, label, value: 0, bonus: 0, total: 0, disabled: false }))
		);
	});

	it("reflects each trait's stored value and disabled flag", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {
					defy: { value: 2 },
					channel: { value: 0, disabled: true }
				}
			}
		};

		const data = sheet.getData();

		expect(data.traits.find((t) => t.key === "defy")).toEqual({ key: "defy", label: "DEFY", value: 2, bonus: 0, total: 2, disabled: false });
		expect(data.traits.find((t) => t.key === "channel")).toEqual({ key: "channel", label: "CHANNEL", value: 0, bonus: 0, total: 0, disabled: true });
	});

	it("adds Arcane Augments' +1 CHANNEL per Danger into bonus/total, capped at +3", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 1 } },
				attributes: {
					playbookMoves: [ARCANE_AUGMENTS.key],
					dangers: [
						{ id: "1", type: "risk", label: "Exposed" },
						{ id: "2", type: "peril", label: "Cornered" },
						{ id: "3", type: "risk", label: "Followed" },
						{ id: "4", type: "risk", label: "Watched" }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.traits.find((t) => t.key === "channel")).toEqual({ key: "channel", label: "CHANNEL", value: 1, bonus: 3, total: 4, disabled: false });
	});

	it("adds Let Loose's uncapped per-Burden bonus to whichever Trait the player chose", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 0 } },
				attributes: {
					playbookMoves: [LET_LOOSE.key],
					burdens: [{ id: "1", label: "A" }, { id: "2", label: "B" }],
					traitBonusChoices: { [LET_LOOSE.key]: "sense" }
				}
			}
		};

		const data = sheet.getData();

		expect(data.traits.find((t) => t.key === "sense")).toEqual({ key: "sense", label: "SENSE", value: 0, bonus: 2, total: 2, disabled: false });
	});
});

describe("PlaybookActorSheet#getData - astir", () => {
	it("is available when channel is missing from stats (reads as enabled)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.astir.available).toBe(true);
		expect(data.astir.exists).toBe(false);
	});

	it("is available when channel is explicitly enabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		expect(sheet.getData().astir.available).toBe(true);
	});

	it("is unavailable when channel is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		expect(sheet.getData().astir.available).toBe(false);
	});

	it("always exposes the core catalog and tier bounds, even with no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.astir.cores).toEqual(ASTIR_CORES);
		expect(data.astir.tierMin).toBe(ASTIR_TIER_MIN);
		expect(data.astir.tierMax).toBe(ASTIR_TIER_MAX);
	});

	it("reports exists true once an Astir is stored", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [], move: null } }
			}
		};

		expect(sheet.getData().astir.exists).toBe(true);
	});

	it("names the Astir after the character's Callsign", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			name: "Fallback Name",
			system: {
				stats: {},
				details: { callsign: { value: "Vanguard" } },
				attributes: { astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [], move: null } }
			}
		};

		expect(sheet.getData().astir.name).toBe("Vanguard");
	});

	it("falls back to the actor's own name when Callsign is blank", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			name: "Fallback Name",
			system: {
				stats: {},
				details: { callsign: { value: "" } },
				attributes: { astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [], move: null } }
			}
		};

		expect(sheet.getData().astir.name).toBe("Fallback Name");
	});

	it("narrows Approach options to the chosen Core", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "alchemical", approach: "arcane", tier: 3, power: 4, overheating: false, parts: [], move: null }
				}
			}
		};

		expect(sheet.getData().astir.approachOptions.map((a) => a.key)).toEqual(["mundane", "arcane"]);
	});

	it("reports max power as the base minus every equipped part's cost", () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [partKey], move: null }
				}
			}
		};

		const data = sheet.getData();

		expect(data.astir.power).toEqual({ value: 4, max: astirMaxPower([partKey], []), negative: false });
	});

	it("resolves parts to their name and power cost", () => {
		const sheet = new PlaybookActorSheet();
		const part = ASTIR_PART_CATALOG[0];
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [part.key], move: null }
				}
			}
		};

		expect(sheet.getData().astir.parts).toEqual([
			{ key: part.key, name: part.name, powerCost: part.powerCost, partType: part.partType }
		]);
	});

	it("reports the piloted flag", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, parts: [], move: null, piloted: true } }
			}
		};

		expect(sheet.getData().astir.piloted).toBe(true);
	});

	it("reports weapon power as 0/0 without Weapon Conduit, and the bonus max with it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, parts: [], move: null } }
			}
		};

		expect(sheet.getData().astir.weaponPower).toEqual({ value: 0, max: 0 });

		sheet.actor.system.attributes.astir.parts = [WEAPON_CONDUIT.key];
		sheet.actor.system.attributes.astir.weaponPower = 1;

		expect(sheet.getData().astir.weaponPower).toEqual({ value: 1, max: astirMaxWeaponPower([WEAPON_CONDUIT.key], []) });
	});

	it("lowers max power for an Astir weapon's Drain, absorbed by Weapon Power first when Weapon Conduit is installed", () => {
		const sheet = new PlaybookActorSheet();
		const weapon = { id: "w1", kind: "weapon", astir: true, tags: ["drain-1"] };
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, weaponPower: 0, parts: [WEAPON_CONDUIT.key], move: null },
					equipment: [weapon]
				}
			}
		};

		const data = sheet.getData();

		// Weapon Conduit's capacity (2) fully absorbs the single Drain-1, so main Power is untouched
		// and Weapon Power's max drops from 2 to 1.
		expect(data.astir.power).toEqual({ value: 4, max: ASTIR_POWER_BASE, negative: false });
		expect(data.astir.weaponPower).toEqual({ value: 0, max: 1 });
	});

	it("flags power.negative and spills excess Drain onto main Power once Weapon Power's capacity is used up", () => {
		const sheet = new PlaybookActorSheet();
		const weapons = [
			{ id: "w1", kind: "weapon", astir: true, tags: ["drain-3"] },
			{ id: "w2", kind: "weapon", astir: true, tags: ["drain-3"] }
		];
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: -2, parts: [], move: null },
					equipment: weapons
				}
			}
		};

		const data = sheet.getData();

		expect(data.astir.power).toEqual({ value: -2, max: astirMaxPower([], weapons), negative: true });
		expect(data.astir.power.max).toBeLessThan(0);
	});

	it("reports Potions once Alchemical Suite is installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: {
						id: "a1",
						core: "",
						approach: "",
						tier: 3,
						power: 4,
						parts: [ALCHEMICAL_SUITE.key],
						move: null,
						potions: { red: 2, blue: 0, yellow: 1 }
					}
				}
			}
		};

		expect(sheet.getData().astir.potions).toEqual({ red: 2, blue: 0, yellow: 1 });
	});

	it("defaults each Potion color to 0 when none is stored yet", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, parts: [ALCHEMICAL_SUITE.key], move: null }
				}
			}
		};

		expect(sheet.getData().astir.potions).toEqual({ red: 0, blue: 0, yellow: 0 });
	});

	it("reports Repair Tokens once Standardised Parts is installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: {
						id: "a1",
						core: "",
						approach: "",
						tier: 3,
						power: 4,
						parts: [STANDARDISED_PARTS.key],
						move: null,
						repairTokens: 3
					}
				}
			}
		};

		expect(sheet.getData().astir.repairTokens).toEqual({ value: 3 });
	});

	it("defaults Repair Tokens to 0 when Standardised Parts is installed but none is stored yet", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, parts: [STANDARDISED_PARTS.key], move: null }
				}
			}
		};

		expect(sheet.getData().astir.repairTokens).toEqual({ value: 0 });
	});

	it("resolves the unique move to its key and name", () => {
		const sheet = new PlaybookActorSheet();
		const move = ASTIR_MOVE_CATALOG[0];
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [], move: move.key }
				}
			}
		};

		expect(sheet.getData().astir.move).toEqual({ key: move.key, name: move.name });
	});

	it("reports no move when none is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [], move: null } }
			}
		};

		expect(sheet.getData().astir.move).toBeNull();
	});

	it("surfaces only astir: true weapons under astir.weapons, with the Astir's own tier/scale", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 4, power: 4, overheating: false, parts: [], move: null },
					equipment: [
						{ id: "1", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] },
						{ id: "2", kind: "weapon", name: "Rifle", description: "", tags: [], spent: [], scale: "foot", tier: 2 }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.astir.weapons.map((w) => w.id)).toEqual(["1"]);
		expect(data.astir.weapons[0].tier).toBe(4);
		expect(data.astir.weapons[0].scaleLabel).toBe("Astir Scale");
		expect(data.equipment.astirWeapons).toBe(data.astir.weapons);
		expect(data.equipment.weapons.map((w) => w.id)).toEqual(["2"]);
	});

	it("defaults every optional field when only an id is stored", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { name: "Fallback Name", system: { stats: {}, attributes: { astir: { id: "a1" } } } };

		const data = sheet.getData();

		expect(data.astir).toEqual({
			available: true,
			exists: true,
			cores: ASTIR_CORES,
			tierMin: ASTIR_TIER_MIN,
			tierMax: ASTIR_TIER_MAX,
			name: "Fallback Name",
			img: ASTIR_DEFAULT_IMG,
			core: "",
			approachOptions: [],
			approach: "",
			tier: ASTIR_TIER_MIN,
			overheating: false,
			piloted: false,
			power: { value: 0, max: ASTIR_POWER_BASE, negative: false },
			weaponPower: { value: 0, max: 0 },
			potions: null,
			repairTokens: null,
			parts: [],
			move: null,
			weapons: []
		});
	});
});

describe("PlaybookActorSheet#getData - astir moves group", () => {
	it("adds no Astir Moves group when the Astir has no parts and no unique move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [], move: null } }
			}
		};

		expect(sheet.getData().moveGroups.some((g) => g.label === "Astir Moves")).toBe(false);
	});

	it("adds no Astir Moves group at all when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		expect(sheet.getData().moveGroups).toHaveLength(3);
	});

	it("lists parts then the unique move, read-only (no addable/removable)", () => {
		const sheet = new PlaybookActorSheet();
		const part = ASTIR_PART_CATALOG[0];
		const move = ASTIR_MOVE_CATALOG[0];
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, overheating: false, parts: [part.key], move: move.key }
				}
			}
		};

		const group = sheet.getData().moveGroups.find((g) => g.label === "Astir Moves");

		expect(group.moves.map((m) => m.key)).toEqual([part.key, move.key]);
		expect(group.addable).toBeUndefined();
		expect(group.removable).toBeUndefined();
	});

	it("gates every entry — parts and the unique move alike — when the Astir isn't piloted", () => {
		const sheet = new PlaybookActorSheet();
		const part = ASTIR_PART_CATALOG[0];
		const move = ASTIR_MOVE_CATALOG[0];
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: {
						id: "a1", core: "", approach: "", tier: 3, power: 4, parts: [part.key], move: move.key, piloted: false
					}
				}
			}
		};

		const group = sheet.getData().moveGroups.find((g) => g.label === "Astir Moves");

		expect(group.moves.every((m) => m.gated)).toBe(true);
	});

	it("leaves gating to each entry's own logic once piloted", () => {
		const sheet = new PlaybookActorSheet();
		const part = ASTIR_PART_CATALOG[0];
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, parts: [part.key], move: null, piloted: true }
				}
			}
		};

		const group = sheet.getData().moveGroups.find((g) => g.label === "Astir Moves");

		expect(group.moves[0].gated).toBe(false);
	});
});

describe("PlaybookActorSheet#activateListeners - astir", () => {
	it("binds the Astir tab's controls to their handlers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		const bound = [
			[".astir-create", "click"],
			[".astir-delete", "click"],
			[".astir-core-select", "change"],
			[".astir-approach-select", "change"],
			[".astir-tier-step", "click"],
			[".astir-power-step", "click"],
			[".astir-weapon-power-step", "click"],
			[".astir-overheating-checkbox", "change"],
			[".astir-piloted-checkbox", "change"],
			[".astir-potion-use", "click"],
			[".astir-part-add", "click"],
			[".astir-part-remove", "click"],
			[".astir-move-add", "click"],
			[".astir-move-remove", "click"],
			[".astir-weapon-catalog-add", "click"]
		];
		for (const [selector] of bound) {
			expect(html.find).toHaveBeenCalledWith(selector);
		}
		expect(on).toHaveBeenCalledTimes(html.find.mock.calls.length);
	});
});

describe("PlaybookActorSheet#_onAstirCreate", () => {
	it("creates a fresh Astir at base power, tier minimum, with no parts or move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirCreate();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir": {
				id: "test-id",
				img: ASTIR_DEFAULT_IMG,
				core: "",
				approach: "",
				tier: ASTIR_TIER_MIN,
				power: ASTIR_POWER_BASE,
				overheating: false,
				piloted: false,
				parts: [],
				move: null
			}
		});
	});

	it("does nothing when an Astir already exists", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirCreate();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirDelete", () => {
	it("clears the Astir and drops every astir: true equipment entry", () => {
		const sheet = new PlaybookActorSheet();
		const astirWeapon = { id: "1", kind: "weapon", astir: true, name: "Lance", tags: [], spent: [] };
		const gear = { id: "2", kind: "gear", name: "Rope", tags: [], spent: [] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1" }, equipment: [astirWeapon, gear] } },
			update: vi.fn()
		};

		sheet._onAstirDelete();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir": null,
			"system.attributes.equipment": [gear]
		});
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirDelete();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirCoreChange", () => {
	it("writes the chosen core", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", core: "", approach: "arcane" } } }, update: vi.fn() };

		sheet._onAstirCoreChange({ currentTarget: { value: "alchemical" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.core": "alchemical" });
	});

	it("clears the approach when it isn't valid for the new core", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", core: "alchemical", approach: "arcane" } } }, update: vi.fn() };

		sheet._onAstirCoreChange({ currentTarget: { value: "natural" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.core": "natural",
			"system.attributes.astir.approach": ""
		});
	});

	it("keeps the approach when it's still valid for the new core", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", core: "alchemical", approach: "arcane" } } }, update: vi.fn() };

		sheet._onAstirCoreChange({ currentTarget: { value: "crystalline" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.core": "crystalline" });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirCoreChange({ currentTarget: { value: "alchemical" } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirApproachChange", () => {
	it("writes the chosen approach", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirApproachChange({ currentTarget: { value: "arcane" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.approach": "arcane" });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirApproachChange({ currentTarget: { value: "arcane" } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirTierStep", () => {
	it("increments the tier", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", tier: 3 } } }, update: vi.fn() };

		sheet._onAstirTierStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.tier": 4 });
	});

	it("clamps at ASTIR_TIER_MAX", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", tier: ASTIR_TIER_MAX } } }, update: vi.fn() };

		sheet._onAstirTierStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at ASTIR_TIER_MIN", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", tier: ASTIR_TIER_MIN } } }, update: vi.fn() };

		sheet._onAstirTierStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing tier as ASTIR_TIER_MIN", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirTierStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.tier": ASTIR_TIER_MIN + 1 });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirTierStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirPowerStep", () => {
	it("increments the power value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 1, parts: [] } } }, update: vi.fn() };

		sheet._onAstirPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.power": 2 });
	});

	it("clamps at the parts-adjusted maximum rather than a fixed constant", () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		const max = astirMaxPower([partKey]);
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: max, parts: [partKey] } } }, update: vi.fn() };

		sheet._onAstirPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at ASTIR_POWER_MIN", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: ASTIR_POWER_MIN, parts: [] } } }, update: vi.fn() };

		sheet._onAstirPowerStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing power and parts array as 0 and none", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.power": 1 });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirOverheatingToggle", () => {
	it("writes the checkbox's checked state", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirOverheatingToggle({ currentTarget: { checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.overheating": true });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirOverheatingToggle({ currentTarget: { checked: true } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirWeaponPowerStep", () => {
	it("increments the weapon power value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", weaponPower: 0, parts: [WEAPON_CONDUIT.key] } } },
			update: vi.fn()
		};

		sheet._onAstirWeaponPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.weaponPower": 1 });
	});

	it("clamps at the parts-adjusted maximum rather than a fixed constant", () => {
		const sheet = new PlaybookActorSheet();
		const max = astirMaxWeaponPower([WEAPON_CONDUIT.key]);
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", weaponPower: max, parts: [WEAPON_CONDUIT.key] } } },
			update: vi.fn()
		};

		sheet._onAstirWeaponPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at ASTIR_POWER_MIN", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", weaponPower: ASTIR_POWER_MIN, parts: [] } } },
			update: vi.fn()
		};

		sheet._onAstirWeaponPowerStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing weaponPower and parts array as 0 and none", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirWeaponPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirWeaponPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirPilotedToggle", () => {
	it("writes the checkbox's checked state", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirPilotedToggle({ currentTarget: { checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.piloted": true });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirPilotedToggle({ currentTarget: { checked: true } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("blocks checking the box while Power is negative, reverting it and warning instead of updating", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: -1 } } }, update: vi.fn() };
		const event = { currentTarget: { checked: true } };

		sheet._onAstirPilotedToggle(event);

		expect(event.currentTarget.checked).toBe(false);
		expect(ui.notifications.warn).toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("still allows unchecking the box while Power is negative", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: -1, piloted: true } } }, update: vi.fn() };

		sheet._onAstirPilotedToggle({ currentTarget: { checked: false } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.piloted": false });
	});
});

describe("PlaybookActorSheet#_onAstirPotionUse", () => {
	it("decrements the chosen color by 1", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", potions: { red: 2, blue: 0, yellow: 1 } } } },
			update: vi.fn()
		};

		sheet._onAstirPotionUse({ currentTarget: { dataset: { potion: "red" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.potions.red": 1 });
	});

	it("does nothing when that color is already at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", potions: { red: 0, blue: 0, yellow: 0 } } } },
			update: vi.fn()
		};

		sheet._onAstirPotionUse({ currentTarget: { dataset: { potion: "red" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing potions object as all zero", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirPotionUse({ currentTarget: { dataset: { potion: "red" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirPotionUse({ currentTarget: { dataset: { potion: "red" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirPartAdd", () => {
	it("adds the chosen part and re-clamps power to the new maximum", async () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 4, parts: [] } } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(partKey);

		await sheet._onAstirPartAdd();

		expect(chooseAstirPart).toHaveBeenCalledWith([]);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [partKey],
			"system.attributes.astir.power": astirMaxPower([partKey]),
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does not lower power below what it already is, only clamps if it now exceeds the max", async () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 0, parts: [] } } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(partKey);

		await sheet._onAstirPartAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [partKey],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when the dialog is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 4, parts: [] } } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(null);

		await sheet._onAstirPartAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats missing parts and power as empty/zero", async () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(partKey);

		await sheet._onAstirPartAdd();

		expect(chooseAstirPart).toHaveBeenCalledWith([]);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [partKey],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAstirPartAdd();

		expect(chooseAstirPart).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("accounts for existing Astir weapon Drain when re-clamping power", async () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		const weapon = { id: "w1", kind: "weapon", astir: true, tags: ["drain-2"] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [] }, equipment: [weapon] } },
			update: vi.fn()
		};
		chooseAstirPart.mockResolvedValue(partKey);

		await sheet._onAstirPartAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [partKey],
			"system.attributes.astir.power": astirMaxPower([partKey], [weapon]),
			"system.attributes.astir.weaponPower": 0
		});
	});
});

describe("PlaybookActorSheet#_onAstirPartRemove", () => {
	it("removes the matching part and re-clamps power to the new (higher) maximum", () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 0, parts: [partKey] } } }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: partKey } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when the key doesn't match any current part", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 4, parts: [] } } }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: "astir-part:not-there" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing parts array as having none", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 4 } } }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: "astir-part:placeholder-part" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing power value as 0 once the part is removed", () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [partKey] } } }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: partKey } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: "astir-part:placeholder-part" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("un-pilots with a warning when removing a Power-granting part leaves Power negative under existing Drain", () => {
		const sheet = new PlaybookActorSheet();
		const conduitKey = "astir-part:weapon-conduit";
		const weapons = [
			{ id: "w1", kind: "weapon", astir: true, tags: ["drain-3"] },
			{ id: "w2", kind: "weapon", astir: true, tags: ["drain-3"] }
		];
		sheet.actor = {
			system: {
				attributes: { astir: { id: "a1", power: 4, piloted: true, parts: [conduitKey] }, equipment: weapons }
			},
			update: vi.fn()
		};

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: conduitKey } } });

		// Removing Weapon Conduit drops the Weapon Power pool (2) that was absorbing part of the
		// 6 total Drain, so all of it now spills onto main Power: max = ASTIR_POWER_BASE (4) - 6.
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [],
			"system.attributes.astir.power": astirMaxPower([], weapons),
			"system.attributes.astir.weaponPower": 0,
			"system.attributes.astir.piloted": false
		});
		expect(astirMaxPower([], weapons)).toBeLessThan(0);
		expect(ui.notifications.warn).toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirMoveAdd", () => {
	it("sets the chosen move, passing the current one (if any) as already-selected", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { astir: { id: "a1", move: "cantrips:deny" } } },
			update: vi.fn()
		};
		chooseAstirMove.mockResolvedValue("astir:placeholder-move");

		await sheet._onAstirMoveAdd();

		expect(chooseAstirMove).toHaveBeenCalledWith("The Scout", ["cantrips:deny"]);
		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.move": "astir:placeholder-move" });
	});

	it("passes no already-selected move when none is picked yet", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { astir: { id: "a1", move: null } } },
			update: vi.fn()
		};
		chooseAstirMove.mockResolvedValue("cantrips:deny");

		await sheet._onAstirMoveAdd();

		expect(chooseAstirMove).toHaveBeenCalledWith("The Scout", []);
	});

	it("does nothing when the dialog is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", move: null } } }, update: vi.fn() };
		chooseAstirMove.mockResolvedValue(null);

		await sheet._onAstirMoveAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAstirMoveAdd();

		expect(chooseAstirMove).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirMoveRemove", () => {
	it("clears the move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", move: "cantrips:deny" } } }, update: vi.fn() };

		sheet._onAstirMoveRemove();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.move": null });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirMoveRemove();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirWeaponAdd", () => {
	it("chains the catalog picker into configureEquipment with astirWeapon, then saves the result flagged astir: true", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		const template = { key: "placeholder-astir-weapon", name: "Placeholder Astir Weapon", description: "", tags: ["melee"] };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Lance", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onAstirWeaponAdd();

		expect(configureEquipment).toHaveBeenCalledWith(template, undefined, { astirWeapon: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], astir: true, name: "Lance", description: "", kind: "weapon", tags: ["melee"] }
			],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("lowers Power when the added weapon carries Drain, and un-pilots with a warning if it goes negative", async () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "e1", kind: "weapon", astir: true, tags: ["drain-3"] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 1, piloted: true, parts: [] }, equipment: [existing] } },
			update: vi.fn()
		};
		const template = { key: "placeholder-astir-weapon", name: "Placeholder Astir Weapon", description: "", tags: ["drain-2"] };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Lance", description: "", kind: "weapon", tags: ["drain-2"] });

		await sheet._onAstirWeaponAdd();

		// Total Drain (drain-3 existing + drain-2 new) is 5, with no Weapon Power pool to absorb any
		// of it: max Power = ASTIR_POWER_BASE (4) - 5 = -1.
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				existing,
				{ id: "test-id", spent: [], astir: true, name: "Lance", description: "", kind: "weapon", tags: ["drain-2"] }
			],
			"system.attributes.astir.power": -1,
			"system.attributes.astir.weaponPower": 0,
			"system.attributes.astir.piloted": false
		});
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it("carries familiar: true onto the saved entry when the picked template is a Familiar weapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		const template = { key: "wisp-familiar", name: "Wisp Familiar III", description: "", tags: ["ranged"], familiar: true };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Wisp Familiar III", description: "", kind: "weapon", tags: ["ranged"] });

		await sheet._onAstirWeaponAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "test-id",
					spent: [],
					astir: true,
					familiar: true,
					name: "Wisp Familiar III",
					description: "",
					kind: "weapon",
					tags: ["ranged"]
				}
			],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does not set familiar on the saved entry when the picked template isn't a Familiar", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		const template = { key: "astir-fists", name: "Astir Fists III", description: "", tags: ["melee"] };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Astir Fists III", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onAstirWeaponAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], astir: true, name: "Astir Fists III", description: "", kind: "weapon", tags: ["melee"] }
			],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when the catalog picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		chooseAstirWeapon.mockResolvedValue(null);

		await sheet._onAstirWeaponAdd();

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the editor is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		chooseAstirWeapon.mockResolvedValue({ key: "placeholder-astir-weapon", name: "x", description: "", tags: [] });
		configureEquipment.mockResolvedValue(null);

		await sheet._onAstirWeaponAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAstirWeaponAdd();

		expect(chooseAstirWeapon).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#getData - ardents", () => {
	it("defaults to an empty list when there are no Ardents", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet.getData().ardents).toEqual([]);
	});

	it("exposes the Ardent tier bounds", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.ardentTierMin).toBe(ARDENT_TIER_MIN);
		expect(data.ardentTierMax).toBe(ARDENT_TIER_MAX);
	});

	it("resolves an Ardent's own fields, defaulting name and offering the full Approach list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { ardents: [{ id: "ar1", approach: "elemental", tier: 3, piloted: true, parts: [] }] } }
		};

		const [ardent] = sheet.getData().ardents;

		expect(ardent.id).toBe("ar1");
		expect(ardent.name).toBe("Ardent");
		expect(ardent.approach).toBe("elemental");
		expect(ardent.approachOptions.map((a) => a.key)).toEqual(["mundane", "arcane", "divine", "profane", "elemental"]);
		expect(ardent.tier).toBe(3);
		expect(ardent.piloted).toBe(true);
	});

	it("uses a stored name when present", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", name: "Warhound", parts: [] }] } } };

		expect(sheet.getData().ardents[0].name).toBe("Warhound");
	});

	it("resolves parts to name/partType, without a Power cost field", () => {
		const sheet = new PlaybookActorSheet();
		const part = WARDING;
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [part.key] }] } } };

		expect(sheet.getData().ardents[0].parts).toEqual([{ key: part.key, name: part.name, partType: part.partType }]);
	});

	it("reports Repair Tokens once Standardised Parts is installed, defaulting to 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [STANDARDISED_PARTS.key] }] } } };

		expect(sheet.getData().ardents[0].repairTokens).toEqual({ value: 0 });
	});

	it("reports no Repair Tokens without Standardised Parts installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }] } } };

		expect(sheet.getData().ardents[0].repairTokens).toBeNull();
	});

	it("surfaces only this Ardent's own ardent-flagged weapons, with the Ardent's own tier and Astir scale", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", tier: 4, parts: [] }, { id: "ar2", tier: 2, parts: [] }],
					equipment: [
						{ id: "1", kind: "weapon", ardent: "ar1", name: "Spear", description: "", tags: [], spent: [] },
						{ id: "2", kind: "weapon", ardent: "ar2", name: "Axe", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.ardents[0].weapons.map((w) => w.id)).toEqual(["1"]);
		expect(data.ardents[0].weapons[0].tier).toBe(4);
		expect(data.ardents[0].weapons[0].scaleLabel).toBe("Astir Scale");
		expect(data.ardents[1].weapons.map((w) => w.id)).toEqual(["2"]);
		expect(data.equipment.ardentWeapons.map((w) => w.id)).toEqual(["1", "2"]);
	});

	it("flags loadoutFull once parts+weapons reach ARDENT_MAX_LOADOUT", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", parts: [WARDING.key] }],
					equipment: [{ id: "1", kind: "weapon", ardent: "ar1", name: "Spear", description: "", tags: [], spent: [] }]
				}
			}
		};

		expect(sheet.getData().ardents[0].loadoutFull).toBe(true);
	});

	it("leaves loadoutFull false below the cap", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }] } } };

		expect(sheet.getData().ardents[0].loadoutFull).toBe(false);
	});
});

describe("PlaybookActorSheet#getData - ardent moves group", () => {
	it("adds no group for an Ardent with no parts", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", name: "Warhound", parts: [] }] } } };

		expect(sheet.getData().moveGroups.some((g) => g.label === "Warhound Moves")).toBe(false);
	});

	it("lists an Ardent's own installed parts under a group named after it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { ardents: [{ id: "ar1", name: "Warhound", parts: [WARDING.key] }] } }
		};

		const group = sheet.getData().moveGroups.find((g) => g.label === "Warhound Moves");

		expect(group.moves.map((m) => m.key)).toEqual([WARDING.key]);
		expect(group.addable).toBeUndefined();
	});

	it("defaults an unnamed Ardent's group label to Ardent Moves", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [WARDING.key] }] } } };

		expect(sheet.getData().moveGroups.some((g) => g.label === "Ardent Moves")).toBe(true);
	});

	it("gates the group unless this Ardent specifically is the mounted frame", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [
						{ id: "ar1", name: "Warhound", parts: [WARDING.key], piloted: true },
						{ id: "ar2", name: "Kestrel", parts: [WARDING.key], piloted: false }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.moveGroups.find((g) => g.label === "Warhound Moves").moves[0].gated).toBe(false);
		expect(data.moveGroups.find((g) => g.label === "Kestrel Moves").moves[0].gated).toBe(true);
	});

	it("gates every Ardent's group when the Astir is mounted instead", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", piloted: true, parts: [] },
					ardents: [{ id: "ar1", name: "Warhound", parts: [WARDING.key], piloted: false }]
				}
			}
		};

		const group = sheet.getData().moveGroups.find((g) => g.label === "Warhound Moves");

		expect(group.moves[0].gated).toBe(true);
	});
});

describe("PlaybookActorSheet#getData - controls with Ardents", () => {
	it("enables Mount Up with an unpiloted Ardent and no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", piloted: false }] } } };

		expect(sheet.getData().controls).toEqual({ mountUpDisabled: false, dismountDisabled: true });
	});

	it("disables Mount Up and enables Dismount once an Ardent is piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", piloted: true }] } } };

		expect(sheet.getData().controls).toEqual({ mountUpDisabled: true, dismountDisabled: false });
	});
});

describe("PlaybookActorSheet#activateListeners - ardent", () => {
	it("binds every Ardent control to its handler", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		const bound = [
			".ardent-create",
			".ardent-delete",
			".ardent-name-input",
			".ardent-approach-select",
			".ardent-tier-step",
			".ardent-piloted-checkbox",
			".ardent-repair-tokens-input",
			".ardent-part-add",
			".ardent-part-remove",
			".ardent-weapon-catalog-add"
		];
		for (const selector of bound) {
			expect(html.find).toHaveBeenCalledWith(selector);
		}
	});
});

describe("PlaybookActorSheet#_onArdentCreate", () => {
	it("appends a fresh Ardent to an empty list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onArdentCreate();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [
				{ id: "test-id", name: "Ardent", approach: "", tier: ARDENT_TIER_MIN, piloted: false, parts: [], repairTokens: 0 }
			]
		});
	});

	it("appends alongside existing Ardents rather than replacing them", () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "ar1", name: "Warhound" };
		sheet.actor = { system: { attributes: { ardents: [existing] } }, update: vi.fn() };

		sheet._onArdentCreate();

		const updated = sheet.actor.update.mock.calls[0][0]["system.attributes.ardents"];
		expect(updated[0]).toBe(existing);
		expect(updated).toHaveLength(2);
	});
});

describe("PlaybookActorSheet#_onArdentDelete", () => {
	it("removes the matching Ardent and every weapon it owns", () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "ar2", name: "Kestrel" };
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", name: "Warhound" }, other],
					equipment: [
						{ id: "1", kind: "weapon", ardent: "ar1" },
						{ id: "2", kind: "weapon", ardent: "ar2" },
						{ id: "3", kind: "gear" }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onArdentDelete({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [other],
			"system.attributes.equipment": [
				{ id: "2", kind: "weapon", ardent: "ar2" },
				{ id: "3", kind: "gear" }
			]
		});
	});

	it("does nothing for an id that doesn't match any Ardent", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentDelete({ currentTarget: { dataset: { ardentId: "not-a-real-id" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentNameChange", () => {
	it("trims and writes the new name, leaving other Ardents untouched", () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "ar2", name: "Kestrel" };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", name: "Old" }, other] } }, update: vi.fn() };

		sheet._onArdentNameChange({ currentTarget: { dataset: { ardentId: "ar1" }, value: "  Warhound  " } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", name: "Warhound" }, other]
		});
	});

	it("does nothing for an unknown Ardent id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentNameChange({ currentTarget: { dataset: { ardentId: "nope" }, value: "x" } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentApproachChange", () => {
	it("writes the chosen Approach, unrestricted by any Core, leaving other Ardents untouched", () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "ar2", approach: "mundane" };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", approach: "" }, other] } }, update: vi.fn() };

		sheet._onArdentApproachChange({ currentTarget: { dataset: { ardentId: "ar1" }, value: "elemental" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", approach: "elemental" }, other]
		});
	});

	it("does nothing for an unknown Ardent id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentApproachChange({ currentTarget: { dataset: { ardentId: "nope" }, value: "elemental" } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentTierStep", () => {
	it("increments within the 2-4 band, leaving other Ardents untouched", () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "ar2", tier: 3 };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", tier: 2 }, other] } }, update: vi.fn() };

		sheet._onArdentTierStep({ currentTarget: { dataset: { ardentId: "ar1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.ardents": [{ id: "ar1", tier: 3 }, other] });
	});

	it("treats a missing tier as ARDENT_TIER_DEFAULT", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1" }] } }, update: vi.fn() };

		sheet._onArdentTierStep({ currentTarget: { dataset: { ardentId: "ar1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.ardents": [{ id: "ar1", tier: ARDENT_TIER_MIN + 1 }] });
	});

	it("clamps at ARDENT_TIER_MAX", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", tier: ARDENT_TIER_MAX }] } }, update: vi.fn() };

		sheet._onArdentTierStep({ currentTarget: { dataset: { ardentId: "ar1", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at ARDENT_TIER_MIN", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", tier: ARDENT_TIER_MIN }] } }, update: vi.fn() };

		sheet._onArdentTierStep({ currentTarget: { dataset: { ardentId: "ar1", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an unknown Ardent id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentTierStep({ currentTarget: { dataset: { ardentId: "nope", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentPilotedToggle", () => {
	it("mounts this Ardent and dismounts the Astir/any other Ardent", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", piloted: true },
					ardents: [{ id: "ar1", piloted: false }, { id: "ar2", piloted: false }]
				}
			},
			update: vi.fn()
		};

		sheet._onArdentPilotedToggle({ currentTarget: { dataset: { ardentId: "ar1" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.piloted": false,
			"system.attributes.ardents": [{ id: "ar1", piloted: true }, { id: "ar2", piloted: false }]
		});
	});

	it("dismounts when unchecked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", piloted: true }] } }, update: vi.fn() };

		sheet._onArdentPilotedToggle({ currentTarget: { dataset: { ardentId: "ar1" }, checked: false } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.ardents": [{ id: "ar1", piloted: false }] });
	});

	it("does nothing for an unknown Ardent id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentPilotedToggle({ currentTarget: { dataset: { ardentId: "nope" }, checked: true } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentRepairTokensChange", () => {
	it("writes the entered value, leaving other Ardents untouched", () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "ar2", repairTokens: 1 };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", repairTokens: 0 }, other] } }, update: vi.fn() };

		sheet._onArdentRepairTokensChange({ currentTarget: { dataset: { ardentId: "ar1" }, value: "3" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", repairTokens: 3 }, other]
		});
	});

	it("clamps a negative value to 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", repairTokens: 2 }] } }, update: vi.fn() };

		sheet._onArdentRepairTokensChange({ currentTarget: { dataset: { ardentId: "ar1" }, value: "-5" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", repairTokens: 0 }]
		});
	});

	it("clamps a non-numeric value to 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", repairTokens: 2 }] } }, update: vi.fn() };

		sheet._onArdentRepairTokensChange({ currentTarget: { dataset: { ardentId: "ar1" }, value: "" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", repairTokens: 0 }]
		});
	});

	it("does nothing for an unknown Ardent id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentRepairTokensChange({ currentTarget: { dataset: { ardentId: "nope" }, value: "3" } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentPartAdd", () => {
	it("offers the Ardent-eligible catalog and adds the chosen part, leaving other Ardents untouched", async () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "ar2", parts: [ARTIFACT.key] };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }, other] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(WARDING.key);

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirPart).toHaveBeenCalledWith([], ardentParts(), { title: "Add an Ardent Part" });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", parts: [WARDING.key] }, other]
		});
	});

	it("treats a missing parts array as empty", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1" }] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(WARDING.key);

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirPart).toHaveBeenCalledWith([], ardentParts(), { title: "Add an Ardent Part" });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", parts: [WARDING.key] }]
		});
	});

	it("refuses once the combined loadout is already at ARDENT_MAX_LOADOUT", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", parts: [WARDING.key] }],
					equipment: [{ id: "1", kind: "weapon", ardent: "ar1" }]
				}
			},
			update: vi.fn()
		};

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirPart).not.toHaveBeenCalled();
		expect(ui.notifications.warn).toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(null);

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an already-picked part", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [WARDING.key] } ] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(WARDING.key);

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an unknown Ardent id", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "nope" } } });

		expect(chooseAstirPart).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentPartRemove", () => {
	it("removes the matching part, leaving other Ardents untouched", () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "ar2", parts: [ARTIFACT.key] };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [WARDING.key] }, other] } }, update: vi.fn() };

		sheet._onArdentPartRemove({ currentTarget: { dataset: { ardentId: "ar1", part: WARDING.key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.ardents": [{ id: "ar1", parts: [] }, other] });
	});

	it("does nothing for a part that isn't installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }] } }, update: vi.fn() };

		sheet._onArdentPartRemove({ currentTarget: { dataset: { ardentId: "ar1", part: WARDING.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing parts array as empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1" }] } }, update: vi.fn() };

		sheet._onArdentPartRemove({ currentTarget: { dataset: { ardentId: "ar1", part: WARDING.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an unknown Ardent id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentPartRemove({ currentTarget: { dataset: { ardentId: "nope", part: WARDING.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentWeaponAdd", () => {
	it("chains the catalog picker into configureEquipment with ardentWeapon, then saves flagged for this Ardent", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }], equipment: [] } }, update: vi.fn() };
		const template = { key: "placeholder-astir-weapon", name: "Placeholder Astir Weapon", description: "", tags: ["melee"] };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Spear", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onArdentWeaponAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirWeapon).toHaveBeenCalledWith(ardentWeapons(), { title: "Pick an Ardent Weapon" });
		expect(configureEquipment).toHaveBeenCalledWith(template, undefined, { ardentWeapon: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], ardent: "ar1", name: "Spear", description: "", kind: "weapon", tags: ["melee"] }
			]
		});
	});

	it("refuses once the combined loadout is already at ARDENT_MAX_LOADOUT", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", parts: [WARDING.key] }],
					equipment: [{ id: "1", kind: "weapon", ardent: "ar1" }]
				}
			},
			update: vi.fn()
		};

		await sheet._onArdentWeaponAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirWeapon).not.toHaveBeenCalled();
		expect(ui.notifications.warn).toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the catalog picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }], equipment: [] } }, update: vi.fn() };
		chooseAstirWeapon.mockResolvedValue(null);

		await sheet._onArdentWeaponAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the editor is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }], equipment: [] } }, update: vi.fn() };
		chooseAstirWeapon.mockResolvedValue({ key: "x", name: "x", description: "", tags: [] });
		configureEquipment.mockResolvedValue(null);

		await sheet._onArdentWeaponAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an unknown Ardent id", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		await sheet._onArdentWeaponAdd({ currentTarget: { dataset: { ardentId: "nope" } } });

		expect(chooseAstirWeapon).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onMountUp - multiple frames", () => {
	it("prompts chooseFrame with every unmounted frame and mounts the chosen one", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", piloted: false },
					ardents: [{ id: "ar1", name: "Warhound", piloted: false }]
				}
			},
			update: vi.fn()
		};
		chooseFrame.mockResolvedValue({ kind: "ardent", id: "ar1" });

		await sheet._onMountUp();

		expect(chooseFrame).toHaveBeenCalledWith([
			expect.objectContaining({ kind: "astir", id: "astir" }),
			expect.objectContaining({ kind: "ardent", id: "ar1", name: "Warhound" })
		]);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.piloted": false,
			"system.attributes.ardents": [{ id: "ar1", name: "Warhound", piloted: true }]
		});
	});

	it("does nothing when the picker is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", piloted: false }, ardents: [{ id: "ar1", piloted: false }] } },
			update: vi.fn()
		};
		chooseFrame.mockResolvedValue(null);

		await sheet._onMountUp();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("mounts an Ardent directly with no prompt when it's the only frame", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", piloted: false }] } }, update: vi.fn() };

		await sheet._onMountUp();

		expect(chooseFrame).not.toHaveBeenCalled();
		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.ardents": [{ id: "ar1", piloted: true }] });
	});
});

describe("PlaybookActorSheet#_onDismount - with Ardents", () => {
	it("clears whichever Ardent is mounted, leaving the rest untouched", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { ardents: [{ id: "ar1", piloted: true }, { id: "ar2", piloted: false }] } },
			update: vi.fn()
		};

		sheet._onDismount();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", piloted: false }, { id: "ar2", piloted: false }]
		});
	});
});

describe("PlaybookActorSheet#_onEquipmentEdit - Ardent weapons", () => {
	it("reopens an Ardent weapon with the ardentWeapon option and carries the ardent flag forward", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", ardent: "ar1", name: "Spear", description: "", tags: ["melee"], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Spear II", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(configureEquipment).toHaveBeenCalledWith(entry, undefined, { ardentWeapon: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "1", spent: [], name: "Spear II", description: "", kind: "weapon", tags: ["melee"], ardent: "ar1" }
			]
		});
	});
});

describe("PlaybookActorSheet#_onEquipmentRemove - Ardent weapons", () => {
	it("removes an Ardent weapon without touching Astir Power", () => {
		const sheet = new PlaybookActorSheet();
		const weapon = { id: "1", kind: "weapon", ardent: "ar1" };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [] }, equipment: [weapon] } },
			update: vi.fn()
		};

		sheet._onEquipmentRemove({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.equipment": [] });
	});
});

describe("PlaybookActorSheet#_onMoveRoll - Ardent weapon choice", () => {
	it("offers only the mounted Ardent's own weapons, excluding the Astir's and other Ardents'", async () => {
		const sheet = new PlaybookActorSheet();
		const mine = { id: "eq1", kind: "weapon", ardent: "ar1", name: "Spear", description: "", tags: [], spent: [] };
		const otherArdent = { id: "eq2", kind: "weapon", ardent: "ar2", name: "Axe", description: "", tags: [], spent: [] };
		const astirWeapon = { id: "eq3", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] };
		const mundane = { id: "eq4", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					astir: { id: "a1", piloted: false },
					ardents: [{ id: "ar1", piloted: true }, { id: "ar2", piloted: false }],
					equipment: [mine, otherArdent, astirWeapon, mundane]
				}
			}
		};
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(chooseWeapon).toHaveBeenCalledWith([mine]);
	});
});

describe("PlaybookActorSheet#_moveTraits - Input Channel from a mounted Ardent", () => {
	it("offers +CHANNEL when Input Channel is installed on the mounted Ardent", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 2, disabled: true } },
				attributes: { ardents: [{ id: "ar1", parts: [INPUT_CHANNEL.key], piloted: true }] }
			}
		};

		expect(sheet._moveTraits({ traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "channel", label: "CHANNEL", value: 2 }
		]);
	});
});

describe("PlaybookActorSheet#_onMoveRoll - astir part spends from a mounted Ardent", () => {
	it("offers an Ardent-installed part's spend when it's the mounted frame", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { ardents: [{ id: "ar1", parts: [WARDING.key], piloted: true }] }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [{
				partKey: WARDING.key, partName: "Warding", description: WARDING.spend.description,
				effect: null, advantage: null, disabled: false
			}],
			equipmentSpends: []
		});
	});
});

describe("PlaybookActorSheet#getData - advancements", () => {
	it("defaults every top and bottom item to unchecked when attributes are missing", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.advancements.top.every((item) => item.checked === false)).toBe(true);
		expect(data.advancements.bottom.every((item) => item.checked === false)).toBe(true);
	});

	it("defaults topCount to 0 and unlocked to false when nothing is checked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.advancements.topCount).toBe(0);
		expect(data.advancements.unlocked).toBe(false);
	});

	it("reflects a stored true value on the matching top item only", () => {
		const key = ADVANCEMENT_TOP[1].key;
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { advancements: { [key]: true } } } };

		const data = sheet.getData();

		expect(data.advancements.top.find((item) => item.key === key).checked).toBe(true);
		expect(
			data.advancements.top.filter((item) => item.key !== key).every((item) => item.checked === false)
		).toBe(true);
	});

	it("counts exactly the checked top keys", () => {
		const sheet = new PlaybookActorSheet();
		const advancements = { [ADVANCEMENT_TOP[0].key]: true, [ADVANCEMENT_TOP[1].key]: true };
		sheet.actor = { system: { stats: {}, attributes: { advancements } } };

		const data = sheet.getData();

		expect(data.advancements.topCount).toBe(2);
	});

	it("keeps the bottom group locked when topCount is one below the threshold", () => {
		const sheet = new PlaybookActorSheet();
		const advancements = {};
		ADVANCEMENT_TOP.slice(0, 2).forEach((item) => {
			advancements[item.key] = true;
		});
		sheet.actor = { system: { stats: {}, attributes: { advancements } } };

		const data = sheet.getData();

		expect(data.advancements.topCount).toBe(2);
		expect(data.advancements.unlocked).toBe(false);
		expect(data.advancements.bottom.every((item) => item.locked === true)).toBe(true);
	});

	it("unlocks the bottom group once topCount reaches the threshold", () => {
		const sheet = new PlaybookActorSheet();
		const advancements = {};
		ADVANCEMENT_TOP.slice(0, 3).forEach((item) => {
			advancements[item.key] = true;
		});
		sheet.actor = { system: { stats: {}, attributes: { advancements } } };

		const data = sheet.getData();

		expect(data.advancements.topCount).toBe(3);
		expect(data.advancements.unlocked).toBe(true);
		expect(data.advancements.bottom.every((item) => item.locked === false)).toBe(true);
	});

	it("stays unlocked when every top item is checked", () => {
		const sheet = new PlaybookActorSheet();
		const advancements = {};
		ADVANCEMENT_TOP.forEach((item) => {
			advancements[item.key] = true;
		});
		sheet.actor = { system: { stats: {}, attributes: { advancements } } };

		const data = sheet.getData();

		expect(data.advancements.topCount).toBe(ADVANCEMENT_TOP.length);
		expect(data.advancements.unlocked).toBe(true);
	});

	it("keeps a bottom item's stored checked state even while its row is locked", () => {
		const bottomKey = ADVANCEMENT_BOTTOM[0].key;
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { advancements: { [bottomKey]: true } } } };

		const data = sheet.getData();

		expect(data.advancements.unlocked).toBe(false);
		const item = data.advancements.bottom.find((entry) => entry.key === bottomKey);
		expect(item.checked).toBe(true);
		expect(item.locked).toBe(true);
	});

	it("exposes the unlock threshold", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.advancements.unlockThreshold).toBe(3);
	});
});

describe("PlaybookActorSheet#activateListeners - advancements", () => {
	it("binds a change handler to the advancement checkboxes", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".advancement-checkbox");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onAdvancementToggle", () => {
	it("writes true to the matching top advancement key when checked", () => {
		const key = ADVANCEMENT_TOP[0].key;
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAdvancementToggle({ currentTarget: { checked: true, dataset: { advancementKey: key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ [`system.attributes.advancements.${key}`]: true });
	});

	it("writes false to the matching top advancement key when unchecked", () => {
		const key = ADVANCEMENT_TOP[0].key;
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { advancements: { [key]: true } } }, update: vi.fn() };

		sheet._onAdvancementToggle({ currentTarget: { checked: false, dataset: { advancementKey: key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ [`system.attributes.advancements.${key}`]: false });
	});

	it("writes to the matching bottom advancement key", () => {
		const key = ADVANCEMENT_BOTTOM[0].key;
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAdvancementToggle({ currentTarget: { checked: true, dataset: { advancementKey: key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ [`system.attributes.advancements.${key}`]: true });
	});
});

describe("PlaybookActorSheet#getData - spotlight", () => {
	it("defaults to value 0 with every step unfilled when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.spotlight).toEqual({
			value: 0,
			steps: [1, 2, 3, 4, 5, 6].map((step) => ({ step, filled: false }))
		});
	});

	it("reflects the actor's stored spotlight value, filling steps up to it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 3 } } } };

		const data = sheet.getData();

		expect(data.spotlight).toEqual({
			value: 3,
			steps: [
				{ step: 1, filled: true },
				{ step: 2, filled: true },
				{ step: 3, filled: true },
				{ step: 4, filled: false },
				{ step: 5, filled: false },
				{ step: 6, filled: false }
			]
		});
	});
});

describe("PlaybookActorSheet#activateListeners - spotlight step", () => {
	it("binds a click handler to the spotlight step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".spotlight-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onSpotlightStep", () => {
	it("fills the track up to a clicked step above the current value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 1 } } }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "4" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 4 });
	});

	it("empties the track down to a clicked step below the current value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 5 } } }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "2" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 2 });
	});

	it("decrements by one when clicking the current top (highest filled) step", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 3 } } }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "3" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 2 });
	});

	it("clears to 0 when clicking step 1 while it's the only filled step", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 1 } } }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 0 });
	});

	it("treats a missing spotlight value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "2" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 2 });
	});

	it("clamps a step beyond the track's max and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 6 } } }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "7" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#getData - downtimeTokens", () => {
	it("defaults value to the flat max (3) when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.downtimeTokens).toEqual({ value: 3, max: 3 });
	});

	it("reflects the actor's stored value against the flat max", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { downtimeTokens: { value: 1 } } } };

		const data = sheet.getData();

		expect(data.downtimeTokens).toEqual({ value: 1, max: 3 });
	});
});

describe("PlaybookActorSheet#activateListeners - downtime tokens step", () => {
	it("binds a click handler to the downtime tokens step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".downtime-tokens-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onDowntimeTokensStep", () => {
	it("increments the value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { downtimeTokens: { value: 1 } } }, update: vi.fn() };

		sheet._onDowntimeTokensStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.downtimeTokens.value": 2 });
	});

	it("decrements the value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { downtimeTokens: { value: 1 } } }, update: vi.fn() };

		sheet._onDowntimeTokensStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.downtimeTokens.value": 0 });
	});

	it("clamps at DOWNTIME_TOKENS_MAX", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { downtimeTokens: { value: 3 } } }, update: vi.fn() };

		sheet._onDowntimeTokensStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at DOWNTIME_TOKENS_MIN", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { downtimeTokens: { value: 0 } } }, update: vi.fn() };

		sheet._onDowntimeTokensStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing downtimeTokens value as starting at the max", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onDowntimeTokensStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.downtimeTokens.value": 2 });
	});
});

describe("PlaybookActorSheet#getData - dangers", () => {
	it("defaults to an empty list, not at max, and able to add when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.dangers).toEqual({ max: 3, list: [], atMax: false, canAdd: true, addOpen: false });
	});

	it("reports addOpen once toggled open, while still below max", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };
		sheet._dangerAddOpen = true;

		const data = sheet.getData();

		expect(data.dangers.addOpen).toBe(true);
	});

	it("hides addOpen once at max, even if toggled open", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					dangers: [
						{ id: "1", type: "risk", label: "a" },
						{ id: "2", type: "risk", label: "b" },
						{ id: "3", type: "risk", label: "c" }
					]
				}
			}
		};
		sheet._dangerAddOpen = true;

		const data = sheet.getData();

		expect(data.dangers.addOpen).toBe(false);
	});

	it("marks each danger as a peril or a risk based on its stored type", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "Exposed position" },
						{ id: "2", type: "risk", label: "Low on ammo" }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.dangers.list).toEqual([
			{ id: "1", type: "peril", label: "Exposed position", isPeril: true },
			{ id: "2", type: "risk", label: "Low on ammo", isPeril: false }
		]);
	});

	it("reports atMax and hides canAdd once the actor has 3 dangers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					dangers: [
						{ id: "1", type: "risk", label: "a" },
						{ id: "2", type: "risk", label: "b" },
						{ id: "3", type: "risk", label: "c" }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.dangers.atMax).toBe(true);
		expect(data.dangers.canAdd).toBe(false);
	});
});

describe("PlaybookActorSheet#activateListeners - dangers", () => {
	it("binds click handlers to the danger add and remove buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".danger-add-toggle");
		expect(html.find).toHaveBeenCalledWith(".danger-add");
		expect(html.find).toHaveBeenCalledWith(".danger-remove");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onDangerAddToggle", () => {
	it("flips _dangerAddOpen and re-renders", () => {
		const sheet = new PlaybookActorSheet();
		sheet.render = vi.fn();

		sheet._onDangerAddToggle();

		expect(sheet._dangerAddOpen).toBe(true);
		expect(sheet.render).toHaveBeenCalledTimes(1);

		sheet._onDangerAddToggle();

		expect(sheet._dangerAddOpen).toBe(false);
		expect(sheet.render).toHaveBeenCalledTimes(2);
	});
});

// Fakes the DOM traversal _onDangerAdd uses to read the label/type inputs sitting next to the
// clicked Add button (closest(".danger-add-controls") -> querySelector(...)), since there's no
// single value to encode on the button's own dataset the way every other control on this sheet
// does.
function fakeDangerAddEvent({ label, type = "risk" }) {
	const labelInput = { value: label };
	const typeSelect = { value: type };
	return {
		currentTarget: {
			closest: () => ({
				querySelector: (selector) => (selector === ".danger-label-input" ? labelInput : typeSelect)
			})
		},
		labelInput
	};
}

describe("PlaybookActorSheet#_onDangerAdd", () => {
	it("appends a new danger with a generated id and clears the label input", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { dangers: [] } }, update: vi.fn() };
		const { labelInput, ...event } = fakeDangerAddEvent({ label: "Exposed position", type: "peril" });

		sheet._onDangerAdd(event);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [{ id: "test-id", type: "peril", label: "Exposed position" }]
		});
		expect(labelInput.value).toBe("");
	});

	// Players add dangers one at a time in practice, so a successful add closes the row back up
	// rather than leaving it open for another entry.
	it("closes the add-danger row once a danger is successfully added", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { dangers: [] } }, update: vi.fn() };
		sheet._dangerAddOpen = true;
		const { ...event } = fakeDangerAddEvent({ label: "Exposed position", type: "peril" });

		sheet._onDangerAdd(event);

		expect(sheet._dangerAddOpen).toBe(false);
	});

	it("leaves the add-danger row open when the label is blank", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { dangers: [] } }, update: vi.fn() };
		sheet._dangerAddOpen = true;
		const { ...event } = fakeDangerAddEvent({ label: "   " });

		sheet._onDangerAdd(event);

		expect(sheet._dangerAddOpen).toBe(true);
	});

	it("appends to, rather than replaces, existing dangers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { dangers: [{ id: "existing", type: "risk", label: "Low on ammo" }] } },
			update: vi.fn()
		};
		const { ...event } = fakeDangerAddEvent({ label: "Losing blood", type: "peril" });

		sheet._onDangerAdd(event);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [
				{ id: "existing", type: "risk", label: "Low on ammo" },
				{ id: "test-id", type: "peril", label: "Losing blood" }
			]
		});
	});

	it("trims the label and does nothing when it's blank", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { dangers: [] } }, update: vi.fn() };
		const { ...event } = fakeDangerAddEvent({ label: "   " });

		sheet._onDangerAdd(event);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing once the actor already has the maximum dangers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					dangers: [
						{ id: "1", type: "risk", label: "a" },
						{ id: "2", type: "risk", label: "b" },
						{ id: "3", type: "risk", label: "c" }
					]
				}
			},
			update: vi.fn()
		};
		const { ...event } = fakeDangerAddEvent({ label: "One more" });

		sheet._onDangerAdd(event);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing dangers array as starting empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };
		const { ...event } = fakeDangerAddEvent({ label: "First danger", type: "risk" });

		sheet._onDangerAdd(event);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [{ id: "test-id", type: "risk", label: "First danger" }]
		});
	});
});

describe("PlaybookActorSheet#_onDangerRemove", () => {
	it("removes the danger matching the clicked button's id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					dangers: [
						{ id: "1", type: "risk", label: "a" },
						{ id: "2", type: "peril", label: "b" }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onDangerRemove({ currentTarget: { dataset: { dangerId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [{ id: "2", type: "peril", label: "b" }]
		});
	});

	it("leaves the list untouched when the id doesn't match any danger", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { dangers: [{ id: "1", type: "risk", label: "a" }] } },
			update: vi.fn()
		};

		sheet._onDangerRemove({ currentTarget: { dataset: { dangerId: "not-a-real-id" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [{ id: "1", type: "risk", label: "a" }]
		});
	});
});

describe("PlaybookActorSheet#getData - burdens", () => {
	it("defaults to an empty list when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet.getData().burdens).toEqual({ list: [] });
	});

	it("exposes the actor's stored burdens as-is, with no derived per-entry shape", () => {
		const sheet = new PlaybookActorSheet();
		const burdens = [{ id: "1", label: "A lingering injury" }, { id: "2", label: "A promise made" }];
		sheet.actor = { system: { attributes: { burdens } } };

		expect(sheet.getData().burdens).toEqual({ list: burdens });
	});
});

describe("PlaybookActorSheet#activateListeners - burdens", () => {
	it("binds handlers to the add, remove and label controls", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".burden-add");
		expect(html.find).toHaveBeenCalledWith(".burden-remove");
		expect(html.find).toHaveBeenCalledWith(".burden-label-input");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onBurdenAdd", () => {
	it("appends a new burden with a generated id and blank label", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { burdens: [] } }, update: vi.fn() };

		sheet._onBurdenAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.burdens": [{ id: "test-id", label: "" }]
		});
	});

	it("appends to, rather than replaces, existing burdens", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { burdens: [{ id: "existing", label: "Existing" }] } },
			update: vi.fn()
		};

		sheet._onBurdenAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.burdens": [{ id: "existing", label: "Existing" }, { id: "test-id", label: "" }]
		});
	});

	it("treats a missing burdens array as starting empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onBurdenAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.burdens": [{ id: "test-id", label: "" }]
		});
	});
});

describe("PlaybookActorSheet#_onBurdenRemove", () => {
	it("removes the burden matching the clicked button's id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { burdens: [{ id: "1", label: "A" }, { id: "2", label: "B" }] }
			},
			update: vi.fn()
		};

		sheet._onBurdenRemove({ currentTarget: { dataset: { burdenId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.burdens": [{ id: "2", label: "B" }]
		});
	});
});

describe("PlaybookActorSheet#_onBurdenLabelChange", () => {
	it("writes the trimmed label to the matching burden", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { burdens: [{ id: "1", label: "" }] } },
			update: vi.fn()
		};

		sheet._onBurdenLabelChange({ currentTarget: { dataset: { burdenId: "1" }, value: "  A lingering injury  " } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.burdens": [{ id: "1", label: "A lingering injury" }]
		});
	});

	it("leaves every other burden untouched", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { burdens: [{ id: "1", label: "A" }, { id: "2", label: "B" }] } },
			update: vi.fn()
		};

		sheet._onBurdenLabelChange({ currentTarget: { dataset: { burdenId: "2" }, value: "Changed" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.burdens": [{ id: "1", label: "A" }, { id: "2", label: "Changed" }]
		});
	});
});

describe("PlaybookActorSheet#getData - gravity clocks", () => {
	it("defaults to an empty list and able to add when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.gravityClocks).toEqual({ max: 5, canAdd: true, list: [] });
	});

	it("expands each clock's stored progress into a Spotlight-style steps array", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: [
						{ id: "1", label: "The Council Turns", progress: 2, value: 1 },
						{ id: "2", label: "Fuel Runs Out", progress: 0, value: 3 }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.gravityClocks.list).toEqual([
			{
				id: "1",
				label: "The Council Turns",
				progress: 2,
				value: 1,
				progressSteps: [
					{ step: 1, filled: true },
					{ step: 2, filled: true },
					{ step: 3, filled: false },
					{ step: 4, filled: false },
					{ step: 5, filled: false },
					{ step: 6, filled: false }
				]
			},
			{
				id: "2",
				label: "Fuel Runs Out",
				progress: 0,
				value: 3,
				progressSteps: [1, 2, 3, 4, 5, 6].map((step) => ({ step, filled: false }))
			}
		]);
	});

	it("treats a clock with no stored progress as starting at 0 when expanding steps", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "New clock", value: 1 }] } }
		};

		const data = sheet.getData();

		expect(data.gravityClocks.list[0].progressSteps).toEqual([1, 2, 3, 4, 5, 6].map((step) => ({ step, filled: false })));
	});

	it("hides canAdd once the actor has 5 gravity clocks", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, label: "", progress: 0, value: 1 }))
				}
			}
		};

		const data = sheet.getData();

		expect(data.gravityClocks.canAdd).toBe(false);
	});
});

describe("PlaybookActorSheet#activateListeners - gravity clocks", () => {
	it("binds handlers to the add, remove, label, value step, and progress step controls", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".gravity-clock-add");
		expect(html.find).toHaveBeenCalledWith(".gravity-clock-remove");
		expect(html.find).toHaveBeenCalledWith(".gravity-clock-label-input");
		expect(html.find).toHaveBeenCalledWith(".gravity-clock-value-step");
		expect(html.find).toHaveBeenCalledWith(".gravity-clock-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onGravityClockAdd", () => {
	it("appends a new clock with a generated id and default progress/value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { gravityClocks: [] } }, update: vi.fn() };

		sheet._onGravityClockAdd({});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "test-id", label: "", progress: 0, value: 1 }]
		});
	});

	it("appends to, rather than replaces, existing clocks", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "existing", label: "Existing", progress: 3, value: 2 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockAdd({});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [
				{ id: "existing", label: "Existing", progress: 3, value: 2 },
				{ id: "test-id", label: "", progress: 0, value: 1 }
			]
		});
	});

	it("treats a missing gravityClocks array as starting empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onGravityClockAdd({});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "test-id", label: "", progress: 0, value: 1 }]
		});
	});

	it("does nothing once the actor already has the maximum gravity clocks", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, label: "", progress: 0, value: 1 }))
				}
			},
			update: vi.fn()
		};

		sheet._onGravityClockAdd({});

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onGravityClockRemove", () => {
	it("removes the clock matching the clicked button's id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: [
						{ id: "1", label: "a", progress: 0, value: 1 },
						{ id: "2", label: "b", progress: 0, value: 1 }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onGravityClockRemove({ currentTarget: { dataset: { clockId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "2", label: "b", progress: 0, value: 1 }]
		});
	});

	it("leaves the list untouched when the id doesn't match any clock", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockRemove({ currentTarget: { dataset: { clockId: "not-a-real-id" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 0, value: 1 }]
		});
	});
});

describe("PlaybookActorSheet#_onGravityClockLabelChange", () => {
	it("trims and updates only the matching clock's label", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: [
						{ id: "1", label: "Old label", progress: 0, value: 1 },
						{ id: "2", label: "Untouched", progress: 0, value: 1 }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onGravityClockLabelChange({ currentTarget: { dataset: { clockId: "1" }, value: "  New label  " } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [
				{ id: "1", label: "New label", progress: 0, value: 1 },
				{ id: "2", label: "Untouched", progress: 0, value: 1 }
			]
		});
	});
});

describe("PlaybookActorSheet#_onGravityClockValueStep", () => {
	it("increments the matching clock's value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 0, value: 2 }]
		});
	});

	it("decrements the matching clock's value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 2 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 0, value: 1 }]
		});
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 3 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the id doesn't match any clock", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "not-a-real-id", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing value as starting at the minimum", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 0, value: 2 }]
		});
	});

	it("does not affect other clocks in the list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: [
						{ id: "1", label: "a", progress: 0, value: 1 },
						{ id: "2", label: "b", progress: 0, value: 2 }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [
				{ id: "1", label: "a", progress: 0, value: 2 },
				{ id: "2", label: "b", progress: 0, value: 2 }
			]
		});
	});
});

describe("PlaybookActorSheet#_onGravityClockStep", () => {
	it("fills the matching clock's track up to a clicked step above the current progress", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 1, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "4" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 4, value: 1 }]
		});
	});

	it("empties the matching clock's track down to a clicked step below the current progress", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 5, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "2" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 2, value: 1 }]
		});
	});

	it("decrements by one when clicking the current top (highest filled) step", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 3, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "3" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 2, value: 1 }]
		});
	});

	it("clamps a step beyond the track's max and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 6, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "7" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing progress value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "2" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", value: 1, progress: 2 }]
		});
	});

	it("does not affect other clocks in the list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: [
						{ id: "1", label: "a", progress: 1, value: 1 },
						{ id: "2", label: "b", progress: 3, value: 2 }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "4" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [
				{ id: "1", label: "a", progress: 4, value: 1 },
				{ id: "2", label: "b", progress: 3, value: 2 }
			]
		});
	});

	it("does nothing when the id doesn't match any clock", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "not-a-real-id", step: "2" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#getData - equipment", () => {
	it("defaults to empty weapons/gear lists, with tierMin/tierMax, when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.equipment).toEqual({
			tierMin: 1,
			tierMax: 5,
			weapons: [],
			astirWeapons: [],
			ardentWeapons: [],
			gear: [],
			startingGear: { available: false }
		});
	});

	it("makes starting gear available for a playbook whose pool has items or a custom weapon", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: {} } };

		const data = sheet.getData();

		expect(data.equipment.startingGear).toEqual({ available: true });
	});

	it("hides starting gear for a playbook whose pool has neither items nor a custom weapon", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Commander" }, attributes: {} } };

		const data = sheet.getData();

		expect(data.equipment.startingGear).toEqual({ available: false });
	});

	it("hides starting gear for good once startingGearChosen is set, even if the pool still has content", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { startingGearChosen: true } } };

		const data = sheet.getData();

		expect(data.equipment.startingGear).toEqual({ available: false });
	});

	it("partitions equipment into weapons and gear by kind", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{ id: "1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 2 },
						{ id: "2", kind: "gear", name: "Rations", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons.map((w) => w.id)).toEqual(["1"]);
		expect(data.equipment.gear.map((g) => g.id)).toEqual(["2"]);
	});

	it("resolves a weapon's tags, value, scale label, and tier", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{
							id: "1",
							kind: "weapon",
							name: "Halberd",
							description: "A long blade.",
							tags: ["blitz"],
							spent: [],
							scale: "astir",
							tier: 3
						}
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons).toEqual([
			{
				id: "1",
				kind: "weapon",
				name: "Halberd",
				description: "A long blade.",
				tags: [
					{
						key: "blitz",
						label: "Blitz",
						value: 1,
						description: "You may spend this tag once per Scene to make a move with confidence.",
						spendable: true,
						spent: false
					}
				],
				value: 1,
				scale: "astir",
				scaleLabel: "Astir Scale",
				tier: 3,
				weaponMoves: [
					{ key: "exchange-blows", name: "Exchange Blows", gated: false },
					{ key: "strike-decisively", name: "Strike Decisively", gated: false }
				],
				isAstir: false
			}
		]);
	});

	it("marks a forcesEffect-only tag (e.g. Unreliable) spendable, same as a player-opted spend", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{ id: "1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable"], spent: [], scale: "foot", tier: 1 }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].tags[0].spendable).toBe(true);
	});

	it("marks a reroll-only tag (e.g. Defensive) spendable, so a spent one can be cleared", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{ id: "1", kind: "weapon", name: "Rifle", description: "", tags: ["defensive"], spent: [], scale: "foot", tier: 1 }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].tags[0].spendable).toBe(true);
	});

	it("marks a tag spent when its key is in the entry's spent array", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{ id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"], scale: "foot", tier: 1 }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].tags[0].spent).toBe(true);
	});

	it("omits scale, scaleLabel, and tier for gear", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { equipment: [{ id: "1", kind: "gear", name: "Rations", description: "", tags: [], spent: [] }] } }
		};

		const data = sheet.getData();

		expect(data.equipment.gear[0]).toEqual({
			id: "1",
			kind: "gear",
			name: "Rations",
			description: "",
			tags: [],
			value: 0
		});
	});

	it("falls back to the raw scale key when it doesn't match a known WEAPON_SCALES entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [{ id: "1", kind: "weapon", name: "Odd", description: "", tags: [], spent: [], scale: "orbital", tier: 1 }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].scaleLabel).toBe("orbital");
	});

	it("treats a missing tags array as having no tags", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { equipment: [{ id: "1", kind: "gear", name: "Odd", description: "", spent: [] }] } }
		};

		const data = sheet.getData();

		expect(data.equipment.gear[0].tags).toEqual([]);
		expect(data.equipment.gear[0].value).toBe(0);
	});

	it("drops a tag key that no longer resolves in the catalog", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{ id: "1", kind: "gear", name: "Odd", description: "", tags: ["blitz", "stale-key"], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.gear[0].tags.map((t) => t.key)).toEqual(["blitz"]);
		expect(data.equipment.gear[0].value).toBe(1);
	});
});

describe("PlaybookActorSheet#activateListeners - equipment", () => {
	it("binds handlers to the add, catalog add, edit, remove, tier step, and tag spent controls", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".equipment-add");
		expect(html.find).toHaveBeenCalledWith(".equipment-catalog-add");
		expect(html.find).toHaveBeenCalledWith(".starting-gear-add");
		expect(html.find).toHaveBeenCalledWith(".equipment-edit");
		expect(html.find).toHaveBeenCalledWith(".equipment-remove");
		expect(html.find).toHaveBeenCalledWith(".equipment-tier-step");
		expect(html.find).toHaveBeenCalledWith(".equipment-tag-spent-checkbox");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onEquipmentAdd", () => {
	it("appends a new entry, generating its id and starting spent empty", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Halberd", description: "", kind: "weapon", tags: [], scale: "foot", tier: 1 });

		await sheet._onEquipmentAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(configureEquipment).toHaveBeenCalledWith({ kind: "weapon" });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], name: "Halberd", description: "", kind: "weapon", tags: [], scale: "foot", tier: 1 }
			]
		});
	});

	it("appends to, rather than replaces, existing equipment", async () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "existing", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [existing] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Rope", description: "", kind: "gear", tags: [] });

		await sheet._onEquipmentAdd({ currentTarget: { dataset: { kind: "gear" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				existing,
				{ id: "test-id", spent: [], name: "Rope", description: "", kind: "gear", tags: [] }
			]
		});
	});

	it("does not update the actor when the dialog is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue(null);

		await sheet._onEquipmentAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onEquipmentCatalogAdd", () => {
	const template = { name: "Halberd", description: "A long blade.", kind: "weapon", tags: [], scale: "foot", tier: 2 };

	it("opens the catalog picker for the clicked section's kind, then the editor pre-filled with the pick", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		chooseEquipmentCatalogItem.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ ...template, name: "Halberd (renamed)" });

		await sheet._onEquipmentCatalogAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(chooseEquipmentCatalogItem).toHaveBeenCalledWith("weapon");
		expect(configureEquipment).toHaveBeenCalledWith(template);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ id: "test-id", spent: [], ...template, name: "Halberd (renamed)" }]
		});
	});

	it("appends to, rather than replaces, existing equipment", async () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "existing", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [existing] } }, update: vi.fn() };
		chooseEquipmentCatalogItem.mockResolvedValue(template);
		configureEquipment.mockResolvedValue(template);

		await sheet._onEquipmentCatalogAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [existing, { id: "test-id", spent: [], ...template }]
		});
	});

	it("does not open the editor, and does not update the actor, when the catalog picker is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		chooseEquipmentCatalogItem.mockResolvedValue(null);

		await sheet._onEquipmentCatalogAdd({ currentTarget: { dataset: { kind: "gear" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does not update the actor when the pre-filled editor is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		chooseEquipmentCatalogItem.mockResolvedValue(template);
		configureEquipment.mockResolvedValue(null);

		await sheet._onEquipmentCatalogAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onStartingGearAdd", () => {
	const scoutPool = STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Scout");
	const scoutItems = scoutPool.groups.flatMap((group) => group.items);
	const [firstItem, secondItem] = scoutItems;
	const weaponResult = { name: "Custom Blade", description: "", kind: "weapon", tags: [], scale: "foot", tier: 1 };

	it("does nothing for a playbook with no starting gear pool", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "Not a Real Playbook" }, attributes: { equipment: [] } }, update: vi.fn() };

		await sheet._onStartingGearAdd();

		expect(chooseStartingGear).not.toHaveBeenCalled();
		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for a pool with neither items nor a custom weapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Commander" }, attributes: { equipment: [] } }, update: vi.fn() };

		await sheet._onStartingGearAdd();

		expect(chooseStartingGear).not.toHaveBeenCalled();
		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("opens the gear picker, then the custom weapon editor with the pool's guidance note", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue([]);
		configureEquipment.mockResolvedValue(null);

		await sheet._onStartingGearAdd();

		expect(chooseStartingGear).toHaveBeenCalledWith("The Scout");
		expect(configureEquipment).toHaveBeenCalledWith({ kind: "weapon" }, undefined, { note: scoutPool.customWeaponNote });
	});

	it("appends picked pool items as new gear entries when the weapon editor is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue([firstItem, secondItem]);
		configureEquipment.mockResolvedValue(null);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.startingGearChosen": true,
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], kind: "gear", name: firstItem.name, description: firstItem.description, tags: [] },
				{ id: "test-id", spent: [], kind: "gear", name: secondItem.name, description: secondItem.description, tags: [] }
			]
		});
	});

	it("carries a picked item's own tags onto the new gear entry, e.g. Blades & Bracers' ward", async () => {
		const bladesAndBracers = scoutItems.find((item) => item.key === "the-scout:blades-and-bracers");
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue([bladesAndBracers]);
		configureEquipment.mockResolvedValue(null);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.startingGearChosen": true,
			"system.attributes.equipment": [
				{
					id: "test-id",
					spent: [],
					kind: "gear",
					name: bladesAndBracers.name,
					description: bladesAndBracers.description,
					tags: ["ward"]
				}
			]
		});
	});

	it("appends the custom weapon when the gear picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue(null);
		configureEquipment.mockResolvedValue(weaponResult);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.startingGearChosen": true,
			"system.attributes.equipment": [{ id: "test-id", spent: [], ...weaponResult }]
		});
	});

	it("appends both the picked gear and the custom weapon in a single update", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue([firstItem]);
		configureEquipment.mockResolvedValue(weaponResult);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).toHaveBeenCalledTimes(1);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.startingGearChosen": true,
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], kind: "gear", name: firstItem.name, description: firstItem.description, tags: [] },
				{ id: "test-id", spent: [], ...weaponResult }
			]
		});
	});

	it("appends to, rather than replaces, existing equipment", async () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "existing", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [existing] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue([firstItem]);
		configureEquipment.mockResolvedValue(null);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.startingGearChosen": true,
			"system.attributes.equipment": [
				existing,
				{ id: "test-id", spent: [], kind: "gear", name: firstItem.name, description: firstItem.description, tags: [] }
			]
		});
	});

	it("still marks startingGearChosen, without touching equipment, when both dialogs are cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue(null);
		configureEquipment.mockResolvedValue(null);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.startingGearChosen": true });
	});

	describe("granted items and weapon-kind items (The Impostor)", () => {
		const impostorPool = STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Impostor");
		const impostorItems = impostorPool.groups.flatMap((group) => group.items);
		const augmentsI = impostorPool.grantedItems.find((item) => item.key === "the-impostor:augments-i");
		const powerFocusI = impostorItems.find((item) => item.key === "the-impostor:power-focus-i");
		const shieldBroachI = impostorItems.find((item) => item.key === "the-impostor:shield-broach-i");

		it("adds Augments I unconditionally, as a Tier I foot-scale weapon", async () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = { system: { playbook: { name: "The Impostor" }, attributes: { equipment: [] } }, update: vi.fn() };
			chooseStartingGear.mockResolvedValue([]);

			await sheet._onStartingGearAdd();

			expect(chooseStartingGear).toHaveBeenCalledWith("The Impostor");
			expect(sheet.actor.update).toHaveBeenCalledWith({
				"system.attributes.startingGearChosen": true,
				"system.attributes.equipment": [{
					id: "test-id",
					spent: [],
					kind: "weapon",
					name: augmentsI.name,
					description: augmentsI.description,
					tags: augmentsI.tags,
					scale: "foot",
					tier: 1
				}]
			});
		});

		it("still adds Augments I even if the gear picker is cancelled", async () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = { system: { playbook: { name: "The Impostor" }, attributes: { equipment: [] } }, update: vi.fn() };
			chooseStartingGear.mockResolvedValue(null);

			await sheet._onStartingGearAdd();

			expect(sheet.actor.update).toHaveBeenCalledWith({
				"system.attributes.startingGearChosen": true,
				"system.attributes.equipment": [expect.objectContaining({ name: "Augments I" })]
			});
		});

		it("saves a picked weapon-kind item (Power Focus I) with its own scale/tier defaults", async () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = { system: { playbook: { name: "The Impostor" }, attributes: { equipment: [] } }, update: vi.fn() };
			chooseStartingGear.mockResolvedValue([powerFocusI]);

			await sheet._onStartingGearAdd();

			const equipment = sheet.actor.update.mock.calls[0][0]["system.attributes.equipment"];
			expect(equipment.find((e) => e.name === "Power Focus I")).toEqual({
				id: "test-id",
				spent: [],
				kind: "weapon",
				name: powerFocusI.name,
				description: powerFocusI.description,
				tags: powerFocusI.tags,
				scale: "foot",
				tier: 1
			});
		});

		it("saves a picked gear-kind item (Shield Broach I) with no scale/tier at all", async () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = { system: { playbook: { name: "The Impostor" }, attributes: { equipment: [] } }, update: vi.fn() };
			chooseStartingGear.mockResolvedValue([shieldBroachI]);

			await sheet._onStartingGearAdd();

			const equipment = sheet.actor.update.mock.calls[0][0]["system.attributes.equipment"];
			expect(equipment.find((e) => e.name === "Shield Broach I")).toEqual({
				id: "test-id",
				spent: [],
				kind: "gear",
				name: shieldBroachI.name,
				description: shieldBroachI.description,
				tags: shieldBroachI.tags
			});
		});
	});
});

describe("PlaybookActorSheet#_onStartingMovesAdd", () => {
	it("does nothing for a playbook with no starting-move allotment", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "Not a Real Playbook" } }, update: vi.fn() };

		await sheet._onStartingMovesAdd();

		expect(chooseStartingMoves).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for a playbook whose pool has nothing to offer yet", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Commander" } }, update: vi.fn() };

		await sheet._onStartingMovesAdd();

		expect(chooseStartingMoves).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("opens the picker for The Scout's own pool", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: {} }, update: vi.fn() };
		chooseStartingMoves.mockResolvedValue([]);

		await sheet._onStartingMovesAdd();

		expect(chooseStartingMoves).toHaveBeenCalledWith("The Scout");
	});

	it("appends the picked keys to the actor's existing playbookMoves", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { playbookMoves: [DENY.key] } },
			update: vi.fn()
		};
		chooseStartingMoves.mockResolvedValue(["the-scout:field-scout", "the-scout:mobility"]);

		await sheet._onStartingMovesAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.startingMovesChosen": true,
			"system.attributes.playbookMoves": [DENY.key, "the-scout:field-scout", "the-scout:mobility"]
		});
	});

	it("does not duplicate a key the actor already has", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { playbookMoves: ["the-scout:field-scout"] } },
			update: vi.fn()
		};
		chooseStartingMoves.mockResolvedValue(["the-scout:field-scout", "the-scout:mobility"]);

		await sheet._onStartingMovesAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.startingMovesChosen": true,
			"system.attributes.playbookMoves": ["the-scout:field-scout", "the-scout:mobility"]
		});
	});

	it("still marks startingMovesChosen, without touching playbookMoves, when the picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: {} }, update: vi.fn() };
		chooseStartingMoves.mockResolvedValue(null);

		await sheet._onStartingMovesAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.startingMovesChosen": true });
	});

	it("still marks startingMovesChosen, without touching playbookMoves, when nothing was picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: {} }, update: vi.fn() };
		chooseStartingMoves.mockResolvedValue([]);

		await sheet._onStartingMovesAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.startingMovesChosen": true });
	});

	it("opens the picker and grants Arcane Augments for The Impostor, which has nothing to pick", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Impostor" }, attributes: {} }, update: vi.fn() };
		chooseStartingMoves.mockResolvedValue([]);

		await sheet._onStartingMovesAdd();

		expect(chooseStartingMoves).toHaveBeenCalledWith("The Impostor");
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.startingMovesChosen": true,
			"system.attributes.playbookMoves": [ARCANE_AUGMENTS.key]
		});
	});

	it("still grants Arcane Augments even if The Impostor's (empty) picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Impostor" }, attributes: {} }, update: vi.fn() };
		chooseStartingMoves.mockResolvedValue(null);

		await sheet._onStartingMovesAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.startingMovesChosen": true,
			"system.attributes.playbookMoves": [ARCANE_AUGMENTS.key]
		});
	});

	it("does not duplicate a granted key the actor already has", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Impostor" }, attributes: { playbookMoves: [ARCANE_AUGMENTS.key] } },
			update: vi.fn()
		};
		chooseStartingMoves.mockResolvedValue([]);

		await sheet._onStartingMovesAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.startingMovesChosen": true });
	});
});

describe("PlaybookActorSheet#_onEquipmentEdit", () => {
	it("replaces the matching entry wholesale, keeping only its id and spent array, leaving other entries untouched", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"], scale: "foot", tier: 2 };
		const other = { id: "2", kind: "gear", name: "Rope", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry, other] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Rations", description: "", kind: "gear", tags: [] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(configureEquipment).toHaveBeenCalledWith(entry);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "1", spent: ["blitz"], name: "Rations", description: "", kind: "gear", tags: [] },
				other
			]
		});
	});

	it("reopens an Astir weapon with the astirWeapon option and carries the astir flag forward", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", astir: true, name: "Lance", description: "", tags: ["melee"], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Lance II", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(configureEquipment).toHaveBeenCalledWith(entry, undefined, { astirWeapon: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "1", spent: [], name: "Lance II", description: "", kind: "weapon", tags: ["melee"], astir: true }
			]
		});
	});

	it("carries the familiar flag forward on a Familiar weapon", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", astir: true, familiar: true, name: "Wisp Familiar III", description: "", tags: ["ranged"], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Wisp Familiar III", description: "", kind: "weapon", tags: ["ranged"] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "1",
					spent: [],
					name: "Wisp Familiar III",
					description: "",
					kind: "weapon",
					tags: ["ranged"],
					astir: true,
					familiar: true
				}
			]
		});
	});

	it("treats a missing spent array on the edited entry as empty", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "gear", name: "Odd", description: "", tags: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Rations", description: "", kind: "gear", tags: [] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ id: "1", spent: [], name: "Rations", description: "", kind: "gear", tags: [] }]
		});
	});

	it("does nothing for an id that doesn't match any entry", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "not-a-real-id" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does not update the actor when the dialog is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue(null);

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("recomputes Power when editing an Astir weapon's tags changes its Drain, with an Astir present", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", astir: true, name: "Lance", description: "", tags: ["melee"], spent: [] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, piloted: true, parts: [] }, equipment: [entry] } },
			update: vi.fn()
		};
		configureEquipment.mockResolvedValue({ name: "Lance II", description: "", kind: "weapon", tags: ["drain-2"] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		const edited = { id: "1", spent: [], name: "Lance II", description: "", kind: "weapon", tags: ["drain-2"], astir: true };
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [edited],
			"system.attributes.astir.power": astirMaxPower([], [edited]),
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("leaves Power untouched when editing a mundane weapon even with an Astir present", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Sword", description: "", tags: ["melee"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [] }, equipment: [entry] } },
			update: vi.fn()
		};
		configureEquipment.mockResolvedValue({ name: "Sword+1", description: "", kind: "weapon", tags: ["drain-2"], scale: "foot", tier: 1 });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "1", spent: [], name: "Sword+1", description: "", kind: "weapon", tags: ["drain-2"], scale: "foot", tier: 1 }
			]
		});
	});
});

describe("PlaybookActorSheet#_onEquipmentRemove", () => {
	it("removes the entry matching the clicked button's id", () => {
		const sheet = new PlaybookActorSheet();
		const a = { id: "1", kind: "gear", name: "a", description: "", tags: [], spent: [] };
		const b = { id: "2", kind: "gear", name: "b", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [a, b] } }, update: vi.fn() };

		sheet._onEquipmentRemove({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.equipment": [b] });
	});

	it("leaves the list untouched when the id doesn't match any entry", () => {
		const sheet = new PlaybookActorSheet();
		const a = { id: "1", kind: "gear", name: "a", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [a] } }, update: vi.fn() };

		sheet._onEquipmentRemove({ currentTarget: { dataset: { equipmentId: "not-a-real-id" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.equipment": [a] });
	});

	it("recomputes Power (freeing it back up) when removing a Drain-tagged Astir weapon, with an Astir present", () => {
		const sheet = new PlaybookActorSheet();
		const weapon = { id: "1", kind: "weapon", astir: true, tags: ["drain-2"] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 1, parts: [] }, equipment: [weapon] } },
			update: vi.fn()
		};

		sheet._onEquipmentRemove({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [],
			"system.attributes.astir.power": 1,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("leaves Power untouched when removing gear even with an Astir present", () => {
		const sheet = new PlaybookActorSheet();
		const gear = { id: "1", kind: "gear", name: "Rope", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [] }, equipment: [gear] } },
			update: vi.fn()
		};

		sheet._onEquipmentRemove({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.equipment": [] });
	});
});

describe("PlaybookActorSheet#_onEquipmentTierStep", () => {
	it("increments the matching entry's tier, leaving other entries untouched", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 2 };
		const other = { id: "2", kind: "gear", name: "Rope", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry, other] } }, update: vi.fn() };

		sheet._onEquipmentTierStep({ currentTarget: { dataset: { equipmentId: "1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, tier: 3 }, other]
		});
	});

	it("clamps at the maximum tier and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 5 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTierStep({ currentTarget: { dataset: { equipmentId: "1", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum tier and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTierStep({ currentTarget: { dataset: { equipmentId: "1", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an id that doesn't match any entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };

		sheet._onEquipmentTierStep({ currentTarget: { dataset: { equipmentId: "not-a-real-id", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing tier as starting at the minimum", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot" };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTierStep({ currentTarget: { dataset: { equipmentId: "1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, tier: 2 }]
		});
	});
});

describe("PlaybookActorSheet#_onEquipmentTagSpentToggle", () => {
	it("adds the tag key to the entry's spent array when checked", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTagSpentToggle({ currentTarget: { dataset: { equipmentId: "1", tag: "blitz" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
	});

	it("treats a missing spent array as empty when checking a tag", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTagSpentToggle({ currentTarget: { dataset: { equipmentId: "1", tag: "blitz" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
	});

	it("does not duplicate an already-spent tag key", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTagSpentToggle({ currentTarget: { dataset: { equipmentId: "1", tag: "blitz" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
	});

	it("removes the tag key from the entry's spent array when unchecked", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTagSpentToggle({ currentTarget: { dataset: { equipmentId: "1", tag: "blitz" }, checked: false } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: [] }]
		});
	});

	it("leaves entries that don't match the toggled id untouched", () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "2", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry, other] } }, update: vi.fn() };

		sheet._onEquipmentTagSpentToggle({ currentTarget: { dataset: { equipmentId: "1", tag: "blitz" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }, other]
		});
	});
});

describe("PlaybookActorSheet#activateListeners - trait steps", () => {
	it("binds a click handler to the trait step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".trait-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onTraitStep", () => {
	it("increments the trait's value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { defy: { value: 0 } } }, update: vi.fn() };

		sheet._onTraitStep({ currentTarget: { dataset: { trait: "defy", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.stats.defy.value": 1 });
	});

	it("decrements the trait's value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { defy: { value: 0 } } }, update: vi.fn() };

		sheet._onTraitStep({ currentTarget: { dataset: { trait: "defy", delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.stats.defy.value": -1 });
	});

	it("treats a missing stat as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} }, update: vi.fn() };

		sheet._onTraitStep({ currentTarget: { dataset: { trait: "defy", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.stats.defy.value": 1 });
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { defy: { value: 3 } } }, update: vi.fn() };

		sheet._onTraitStep({ currentTarget: { dataset: { trait: "defy", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { defy: { value: -3 } } }, update: vi.fn() };

		sheet._onTraitStep({ currentTarget: { dataset: { trait: "defy", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#getData - moves", () => {
	it("exposes basic moves grouped, with each move's currently enabled traits and values", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 1 }, talk: { value: -1 } } } };

		const data = sheet.getData();

		expect(data.moveGroups).toEqual([
			{
				label: "Basic Moves",
				moves: [
					{
						key: "exchange-blows",
						name: "Exchange Blows",
						traits: [
							{ key: "clash", label: "CLASH", value: 1 },
							{ key: "talk", label: "TALK", value: -1 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: [],
						traitBonusChoosable: false,
						traitBonusChoice: ""
					},
					{
						key: "weather-the-storm",
						name: "Weather the Storm",
						traits: [
							{ key: "defy", label: "DEFY", value: 0 },
							{ key: "know", label: "KNOW", value: 0 },
							{ key: "sense", label: "SENSE", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: [],
						traitBonusChoosable: false,
						traitBonusChoice: ""
					},
					{
						key: "read-the-room",
						name: "Read the Room",
						traits: [
							{ key: "sense", label: "SENSE", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: true,
						separateHoldPool: false,
						hold: 0,
						uses: [],
						traitBonusChoosable: false,
						traitBonusChoice: ""
					},
					{
						key: "dispel-uncertainties",
						name: "Dispel Uncertainties",
						traits: [
							{ key: "know", label: "KNOW", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: [],
						traitBonusChoosable: false,
						traitBonusChoice: ""
					},
					{
						key: "help-or-hinder",
						name: "Help or Hinder",
						traits: [],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: [],
						traitBonusChoosable: false,
						traitBonusChoice: ""
					},
					{
						key: "weave-magic",
						name: "Weave Magic",
						// channel isn't in this actor's stats at all — same as any other missing stat,
						// that reads as enabled rather than gated (see availableMoveTraits).
						traits: [
							{ key: "channel", label: "CHANNEL", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: [],
						traitBonusChoosable: false,
						traitBonusChoice: ""
					},
					{
						key: "cool-off",
						name: "Cool Off",
						traits: [
							{ key: "defy", label: "DEFY", value: 0 },
							{ key: "sense", label: "SENSE", value: 0 },
							{ key: "clash", label: "CLASH", value: 1 },
							{ key: "talk", label: "TALK", value: -1 },
							{ key: "know", label: "KNOW", value: 0 },
							{ key: "channel", label: "CHANNEL", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: [],
						traitBonusChoosable: false,
						traitBonusChoice: ""
					},
					{
						key: "strike-decisively",
						name: "Strike Decisively",
						traits: [
							{ key: "clash", label: "CLASH", value: 1 },
							{ key: "talk", label: "TALK", value: -1 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: [],
						traitBonusChoosable: false,
						traitBonusChoice: ""
					},
					{
						key: "bite-the-dust",
						name: "Bite the Dust",
						traits: [
							{ key: "defy", label: "DEFY", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: [],
						traitBonusChoosable: false,
						traitBonusChoice: ""
					}
				]
			},
			// Empty until the player picks something with the "+" — no playbook starts with any
			// playbook moves. addable/removable are what render that "+" and each row's ✕.
			{
				label: "Playbook Moves",
				moves: [],
				addable: true,
				removable: true,
				startingMovesAvailable: false
			},
			{
				label: "Special Moves",
				moves: [
					{
						key: "lead-a-sortie",
						name: "Lead a Sortie",
						traits: [
							{ key: "know", label: "KNOW", value: 0 },
							{ key: "defy", label: "DEFY", value: 0 },
							{ key: "crew", label: "CREW", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: [],
						traitBonusChoosable: false,
						traitBonusChoice: ""
					},
					{
						key: "subsystems",
						name: "Subsystems",
						traits: [],
						gated: false,
						rollable: false,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: [],
						traitBonusChoosable: false,
						traitBonusChoice: ""
					},
					{
						key: "b-plot",
						name: "B-Plot",
						traits: [],
						// channel isn't in this actor's stats at all, which reads as enabled — so
						// b-plot is gated here, the mirror image of weave-magic above.
						gated: true,
						rollable: false,
						activatable: true,
						descriptionGated: true,
						trackHold: true,
						separateHoldPool: true,
						hold: 0,
						uses: [],
						traitBonusChoosable: false,
						traitBonusChoice: ""
					}
				]
			}
		]);
	});

	it("omits a move's disabled traits from the trait list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 1, disabled: true }, talk: { value: 0 } } } };

		const data = sheet.getData();

		expect(data.moveGroups[0].moves[0].traits).toEqual([{ key: "talk", label: "TALK", value: 0 }]);
	});
});

describe("PlaybookActorSheet#getData - playbook moves", () => {
	function playbookGroup(data) {
		return data.moveGroups.find((group) => group.label === "Playbook Moves");
	}

	it("starts empty, since no playbook grants playbook moves by default", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		expect(playbookGroup(sheet.getData()).moves).toEqual([]);
	});

	it("marks only the playbook group as addable and removable", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const groups = sheet.getData().moveGroups;

		expect(groups.filter((group) => group.addable).map((group) => group.label)).toEqual(["Playbook Moves"]);
		expect(groups.filter((group) => group.removable).map((group) => group.label)).toEqual(["Playbook Moves"]);
	});

	it("makes starting moves available for The Scout, which has a real allotment to offer", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" } } };

		expect(playbookGroup(sheet.getData()).startingMovesAvailable).toBe(true);
	});

	it("hides starting moves for a playbook with nothing to offer yet, e.g. The Commander", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Commander" } } };

		expect(playbookGroup(sheet.getData()).startingMovesAvailable).toBe(false);
	});

	it("makes starting moves available for The Impostor, which grants Arcane Augments with nothing to pick", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Impostor" } } };

		expect(playbookGroup(sheet.getData()).startingMovesAvailable).toBe(true);
	});

	it("hides starting moves for good once startingMovesChosen is set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { startingMovesChosen: true } } };

		expect(playbookGroup(sheet.getData()).startingMovesAvailable).toBe(false);
	});

	it("hides starting moves when the actor has no playbook set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		expect(playbookGroup(sheet.getData()).startingMovesAvailable).toBe(false);
	});

	it("renders the moves the actor has picked, in the order they were picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 2 } },
				attributes: { playbookMoves: [DENY.key, BULLHEADED.key] }
			}
		};

		expect(playbookGroup(sheet.getData()).moves.map((move) => move.key))
			.toEqual([DENY.key, BULLHEADED.key]);
	});

	it("gives a picked move the same shape as a basic move, so it rolls the same way", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { channel: { value: 2 } }, attributes: { playbookMoves: [DENY.key] } }
		};

		expect(playbookGroup(sheet.getData()).moves[0]).toEqual({
			key: DENY.key,
			name: "Deny",
			traits: [{ key: "channel", label: "CHANNEL", value: 2 }],
			gated: false,
			rollable: true,
			activatable: false,
			descriptionGated: false,
			trackHold: false,
			separateHoldPool: false,
			hold: 0,
			uses: [],
			traitBonusChoosable: false,
			traitBonusChoice: ""
		});
	});

	it("marks a chooseTrait traitBonus move (Let Loose) as traitBonusChoosable, defaulting choice to blank", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [LET_LOOSE.key] } } };

		const move = playbookGroup(sheet.getData()).moves[0];

		expect(move.traitBonusChoosable).toBe(true);
		expect(move.traitBonusChoice).toBe("");
	});

	it("reflects a stored traitBonus choice for that move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { playbookMoves: [LET_LOOSE.key], traitBonusChoices: { [LET_LOOSE.key]: "sense" } }
			}
		};

		expect(playbookGroup(sheet.getData()).moves[0].traitBonusChoice).toBe("sense");
	});

	it("shows no Roll button for a picked move that rolls nothing", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BULLHEADED.key] } } };

		const [move] = playbookGroup(sheet.getData()).moves;

		expect(move.rollable).toBe(false);
		expect(move.activatable).toBe(false);
		expect(move.gated).toBe(false);
	});

	it("gates a picked move whose only trait is disabled for this playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 0, disabled: true } },
				attributes: { playbookMoves: [DENY.key] }
			}
		};

		expect(playbookGroup(sheet.getData()).moves[0].gated).toBe(true);
	});

	it("drops a stored key whose move no longer exists rather than breaking the sheet", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: ["the-scout:deleted-move", BULLHEADED.key] } }
		};

		expect(playbookGroup(sheet.getData()).moves.map((move) => move.key)).toEqual([BULLHEADED.key]);
	});
});

describe("PlaybookActorSheet#activateListeners - playbook moves", () => {
	it("binds click handlers to the playbook move add and remove buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".playbook-move-add");
		expect(html.find).toHaveBeenCalledWith(".playbook-move-remove");
		expect(html.find).toHaveBeenCalledWith(".starting-moves-add");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onPlaybookMoveAdd", () => {
	it("opens the picker with the actor's playbook and current picks", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { playbookMoves: [BULLHEADED.key] } },
			update: vi.fn()
		};
		choosePlaybookMove.mockResolvedValue(null);

		await sheet._onPlaybookMoveAdd();

		expect(choosePlaybookMove).toHaveBeenCalledWith("The Scout", [BULLHEADED.key]);
	});

	it("appends the chosen move to the actor's picks", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { playbookMoves: [BULLHEADED.key] } },
			update: vi.fn()
		};
		choosePlaybookMove.mockResolvedValue(DENY.key);

		await sheet._onPlaybookMoveAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.playbookMoves": [BULLHEADED.key, DENY.key]
		});
	});

	it("adds the first move to an actor that has never picked one", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" } }, update: vi.fn() };
		choosePlaybookMove.mockResolvedValue(BULLHEADED.key);

		await sheet._onPlaybookMoveAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.playbookMoves": [BULLHEADED.key]
		});
	});

	it("does nothing when the picker is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" } }, update: vi.fn() };
		choosePlaybookMove.mockResolvedValue(null);

		await sheet._onPlaybookMoveAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	// The picker already filters out what the actor has, so this only guards against a stale
	// dialog left open across another window's edit — but a duplicate key would render the move
	// twice with two ✕ buttons that both remove it.
	it("does not add a move the actor already has", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { playbookMoves: [BULLHEADED.key] } },
			update: vi.fn()
		};
		choosePlaybookMove.mockResolvedValue(BULLHEADED.key);

		await sheet._onPlaybookMoveAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("passes an undefined playbook name through when the actor has no playbook set", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };
		choosePlaybookMove.mockResolvedValue(null);

		await sheet._onPlaybookMoveAdd();

		expect(choosePlaybookMove).toHaveBeenCalledWith(undefined, []);
	});
});

describe("PlaybookActorSheet#_onPlaybookMoveRemove", () => {
	it("removes just the clicked move, leaving the rest in order", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [BULLHEADED.key, DENY.key] } },
			update: vi.fn()
		};

		sheet._onPlaybookMoveRemove({ currentTarget: { dataset: { move: BULLHEADED.key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.playbookMoves": [DENY.key]
		});
	});

	it("does nothing for a move the actor doesn't have", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BULLHEADED.key] } }, update: vi.fn() };

		sheet._onPlaybookMoveRemove({ currentTarget: { dataset: { move: DENY.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#getData - move uses", () => {
	function playbookGroup(data) {
		return data.moveGroups.find((group) => group.label === "Playbook Moves");
	}

	it("gives a move with no uses declared an empty uses array", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BULLHEADED.key] } } };

		expect(playbookGroup(sheet.getData()).moves[0].uses).toEqual([]);
	});

	it("reads each use entry's label and defaults to unchecked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [SEEK_ALLIES.key] } } };

		expect(playbookGroup(sheet.getData()).moves[0].uses).toEqual([
			{ key: "sortie", label: "Used this Sortie", checked: false }
		]);
	});

	it("reads each use entry's checked state independently, by move key and use key", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [PERSONAL_FAMILIAR.key],
					moveUses: { [PERSONAL_FAMILIAR.key]: { sortie: true } }
				}
			}
		};

		expect(playbookGroup(sheet.getData()).moves[0].uses).toEqual([
			{ key: "sortie", label: "Ignored a disadvantage this Sortie", checked: true },
			{ key: "downtime", label: "Reported back this Downtime", checked: false }
		]);
	});

	it("doesn't confuse one move's stored uses with another's", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [SEEK_ALLIES.key],
					moveUses: { [PERSONAL_FAMILIAR.key]: { sortie: true } }
				}
			}
		};

		expect(playbookGroup(sheet.getData()).moves[0].uses[0].checked).toBe(false);
	});
});

describe("PlaybookActorSheet#activateListeners - move uses", () => {
	it("binds a change handler to the uses checkbox", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".move-use-checkbox");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});

	it("binds a change handler to the trait bonus select", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".trait-bonus-select");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onMoveUseToggle", () => {
	it("writes the checked state to the actor, keyed by move and use", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onMoveUseToggle({
			currentTarget: { dataset: { move: SEEK_ALLIES.key, use: "sortie" }, checked: true }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${SEEK_ALLIES.key}.sortie`]: true
		});
	});

	it("writes false when the box is unchecked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onMoveUseToggle({
			currentTarget: { dataset: { move: PERSONAL_FAMILIAR.key, use: "downtime" }, checked: false }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${PERSONAL_FAMILIAR.key}.downtime`]: false
		});
	});
});

describe("PlaybookActorSheet#_onTraitBonusChoiceChange", () => {
	it("writes the selected trait key to the actor, keyed by move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onTraitBonusChoiceChange({
			currentTarget: { dataset: { move: "the-impostor:let-loose" }, value: "clash" }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.traitBonusChoices.the-impostor:let-loose": "clash"
		});
	});

	it("writes an empty string back when the blank option is chosen", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onTraitBonusChoiceChange({
			currentTarget: { dataset: { move: "the-impostor:let-loose" }, value: "" }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.traitBonusChoices.the-impostor:let-loose": ""
		});
	});
});

describe("PlaybookActorSheet#getData - gated moves", () => {
	it("gates weave magic's Roll button when CHANNEL is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		const weaveMagic = data.moveGroups[0].moves.find((m) => m.key === "weave-magic");
		expect(weaveMagic.gated).toBe(true);
		expect(weaveMagic.traits).toEqual([]);
	});

	it("un-gates weave magic once CHANNEL is enabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		const weaveMagic = data.moveGroups[0].moves.find((m) => m.key === "weave-magic");
		expect(weaveMagic.gated).toBe(false);
		expect(weaveMagic.traits).toEqual([{ key: "channel", label: "CHANNEL", value: 1 }]);
	});

	it("never gates help or hinder, which has no stat traits by design", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.moveGroups[0].moves.find((m) => m.key === "help-or-hinder").gated).toBe(false);
	});

	it("gates b-plot when CHANNEL is enabled, the mirror image of weave magic", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		expect(data.moveGroups[2].moves.find((m) => m.key === "b-plot").gated).toBe(true);
	});

	it("gates b-plot when CHANNEL is missing from stats (reads as enabled)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.moveGroups[2].moves.find((m) => m.key === "b-plot").gated).toBe(true);
	});

	it("un-gates b-plot once CHANNEL is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		expect(data.moveGroups[2].moves.find((m) => m.key === "b-plot").gated).toBe(false);
	});

	it("never gates lead a sortie or subsystems off CHANNEL, unlike b-plot", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		expect(data.moveGroups[2].moves.find((m) => m.key === "lead-a-sortie").gated).toBe(false);
		expect(data.moveGroups[2].moves.find((m) => m.key === "subsystems").gated).toBe(false);
	});

	it("also greys out b-plot's Description button when CHANNEL is enabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		expect(data.moveGroups[2].moves.find((m) => m.key === "b-plot").descriptionGated).toBe(true);
	});

	it("un-greys b-plot's Description button once CHANNEL is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		expect(data.moveGroups[2].moves.find((m) => m.key === "b-plot").descriptionGated).toBe(false);
	});

	it("never greys out weave magic's Description button, unlike b-plot", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		const weaveMagic = data.moveGroups[0].moves.find((m) => m.key === "weave-magic");
		expect(weaveMagic.gated).toBe(true);
		expect(weaveMagic.descriptionGated).toBe(false);
	});
});

describe("PlaybookActorSheet#getData - hold", () => {
	it("marks trackHold true only for moves that define a hold track", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();
		const holdFlags = Object.fromEntries(data.moveGroups[0].moves.map((m) => [m.key, m.trackHold]));

		expect(holdFlags).toEqual({
			"exchange-blows": false,
			"weather-the-storm": false,
			"read-the-room": true,
			"dispel-uncertainties": false,
			"help-or-hinder": false,
			"weave-magic": false,
			"cool-off": false,
			"strike-decisively": false,
			"bite-the-dust": false
		});
	});

	it("reflects the actor's current hold value on every move, defaulting to 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, resources: { hold: { value: 2 } } } };

		const data = sheet.getData();

		for (const move of data.moveGroups[0].moves) {
			expect(move.hold).toBe(2);
		}
	});
});

describe("PlaybookActorSheet#getData - flatHold moves' separate hold pools", () => {
	it("reads b-plot's hold from system.attributes.moveHold, keyed by its own move key, not the shared resources.hold pool", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				resources: { hold: { value: 5 } },
				attributes: { moveHold: { "b-plot": { value: 2 } } }
			}
		};

		const data = sheet.getData();

		expect(data.moveGroups[2].moves.find((m) => m.key === "b-plot").hold).toBe(2);
		// Read the Room (a basic move) keeps reading the shared pool, unaffected by moveHold.
		expect(data.moveGroups[0].moves.find((m) => m.key === "read-the-room").hold).toBe(5);
	});

	it("defaults b-plot's hold to 0 when moveHold is missing", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.moveGroups[2].moves.find((m) => m.key === "b-plot").hold).toBe(0);
	});

	it("keeps two different flatHold moves' pools independent, keyed by their own move key", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					moveHold: {
						"b-plot": { value: 2 },
						"soldier:get-out-of-my-way": { value: 1 }
					},
					playbookMoves: ["soldier:get-out-of-my-way"]
				}
			}
		};

		const data = sheet.getData();

		expect(data.moveGroups[2].moves.find((m) => m.key === "b-plot").hold).toBe(2);
		expect(data.moveGroups[1].moves.find((m) => m.key === "soldier:get-out-of-my-way").hold).toBe(1);
	});
});

describe("PlaybookActorSheet#activateListeners - hold step", () => {
	it("binds a click handler to the hold step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".hold-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onHoldStep", () => {
	it("increments the hold value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { resources: { hold: { value: 1 } } }, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 2 });
	});

	it("decrements the hold value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { resources: { hold: { value: 1 } } }, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 0 });
	});

	it("treats a missing hold value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 1 });
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { resources: { hold: { value: 3 } } }, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { resources: { hold: { value: 0 } } }, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#activateListeners - flat hold step", () => {
	it("binds a click handler to the flat hold step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".flat-hold-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onFlatHoldStep", () => {
	it("increments the move's hold value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 1 } } } }, update: vi.fn() };

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 2 });
	});

	it("decrements the move's hold value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 1 } } } }, update: vi.fn() };

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 0 });
	});

	it("treats a missing hold value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 1 });
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 3 } } } }, update: vi.fn() };

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 0 } } } }, update: vi.fn() };

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does not affect the shared resources.hold field", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveHold: { "b-plot": { value: 1 } } }, resources: { hold: { value: 5 } } },
			update: vi.fn()
		};

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 2 });
		expect(sheet.actor.update).not.toHaveBeenCalledWith(expect.objectContaining({
			"system.resources.hold.value": expect.anything()
		}));
	});

	it("keeps a different flatHold move's pool untouched when stepping this one", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					moveHold: { "b-plot": { value: 2 }, "soldier:get-out-of-my-way": { value: 1 } }
				}
			},
			update: vi.fn()
		};

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "soldier:get-out-of-my-way", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.soldier:get-out-of-my-way.value": 2
		});
	});
});

describe("PlaybookActorSheet#activateListeners - moves", () => {
	it("binds click handlers to the move roll and description buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".move-roll");
		expect(html.find).toHaveBeenCalledWith(".move-activate");
		expect(html.find).toHaveBeenCalledWith(".move-description");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_moveTraits", () => {
	it("leaves a non-crew fixedTrait untouched", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };
		const move = { traits: [], fixedTraits: [{ key: "cargo", label: "CARGO", value: 3 }] };

		expect(sheet._moveTraits(move)).toEqual([{ key: "cargo", label: "CARGO", value: 3 }]);
	});

	it("offers +CHANNEL on any move when piloted with Input Channel installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 2, disabled: true } },
				attributes: { astir: { id: "a1", parts: [INPUT_CHANNEL.key], piloted: true } }
			}
		};
		const move = { traits: ["clash"] };

		expect(sheet._moveTraits(move)).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "channel", label: "CHANNEL", value: 2 }
		]);
	});

	it("does not offer +CHANNEL when not piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 2, disabled: true } },
				attributes: { astir: { id: "a1", parts: [INPUT_CHANNEL.key], piloted: false } }
			}
		};

		expect(sheet._moveTraits({ traits: ["clash"] })).toEqual([{ key: "clash", label: "CLASH", value: 1 }]);
	});

	it("does not offer +CHANNEL without Input Channel installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 2, disabled: true } },
				attributes: { astir: { id: "a1", parts: [], piloted: true } }
			}
		};

		expect(sheet._moveTraits({ traits: ["clash"] })).toEqual([{ key: "clash", label: "CLASH", value: 1 }]);
	});

	it("treats a missing channel stat value as 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [INPUT_CHANNEL.key], piloted: true } }
			}
		};

		expect(sheet._moveTraits({ traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "channel", label: "CHANNEL", value: 0 }
		]);
	});

	it("does not add a second CHANNEL entry when the move already rolls it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 2, disabled: false } },
				attributes: { astir: { id: "a1", parts: [INPUT_CHANNEL.key], piloted: true } }
			}
		};

		expect(sheet._moveTraits({ traits: ["channel"] })).toEqual([{ key: "channel", label: "CHANNEL", value: 2 }]);
	});

	it("offers +TALK on Read the Room when Facilitator is picked (addsTraitToMove)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 1 }, talk: { value: 2 } },
				attributes: { playbookMoves: [FACILITATOR.key] }
			}
		};
		const readTheRoom = { key: "read-the-room", traits: ["sense"] };

		expect(sheet._moveTraits(readTheRoom)).toEqual([
			{ key: "sense", label: "SENSE", value: 1 },
			{ key: "talk", label: "TALK", value: 2 }
		]);
	});

	it("does not add +TALK to a different move just because Facilitator is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, talk: { value: 2 } },
				attributes: { playbookMoves: [FACILITATOR.key] }
			}
		};

		expect(sheet._moveTraits({ key: "exchange-blows", traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 }
		]);
	});

	it("leaves Read the Room's traits untouched without Facilitator picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { sense: { value: 1 }, talk: { value: 2 } }, attributes: { playbookMoves: [] } }
		};
		const readTheRoom = { key: "read-the-room", traits: ["sense"] };

		expect(sheet._moveTraits(readTheRoom)).toEqual([{ key: "sense", label: "SENSE", value: 1 }]);
	});

	it("does not add a second TALK entry when the target move already rolls it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { talk: { value: 2 } },
				attributes: { playbookMoves: [FACILITATOR.key] }
			}
		};

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["talk"] })).toEqual([
			{ key: "talk", label: "TALK", value: 2 }
		]);
	});

	it("treats a missing talk stat value as 0 for an added trait", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { sense: { value: 1 } }, attributes: { playbookMoves: [FACILITATOR.key] } }
		};

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["sense"] })).toEqual([
			{ key: "sense", label: "SENSE", value: 1 },
			{ key: "talk", label: "TALK", value: 0 }
		]);
	});
});

describe("PlaybookActorSheet#_onMoveRoll", () => {
	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "not-a-real-move" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does nothing when the move has no enabled traits to roll with", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { disabled: true }, talk: { disabled: true } } } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does not roll when the roll dialog is dismissed without a selection", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 }, talk: { value: 0 } } } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).not.toHaveBeenCalled();
	});

	it("rolls a playbook move by its pool-prefixed key, same as a basic move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 2 } } } };
		const config = { trait: { key: "channel", label: "CHANNEL", value: 2 }, advantage: "normal", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: DENY.key } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DENY, config.trait, config);
	});

	it("still opens the roll dialog for help or hinder, which has no stat traits at all", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "help-or-hinder" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			BASIC_MOVES.find((m) => m.key === "help-or-hinder"),
			[],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
		);
	});

	it("configures the roll, then rolls the move with the chosen trait and modifiers", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 1 }, talk: { value: 0 } } } };
		const talk = { key: "talk", label: "TALK", value: 0 };
		const config = { trait: talk, advantage: "advantage", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[
				{ key: "clash", label: "CLASH", value: 1 },
				{ key: "talk", label: "TALK", value: 0 }
			],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
		);
		// exchange-blows is usesWeapon (see moves.js) and the actor has no equipment at all here,
		// so the weapon-choice step is skipped straight to "Unarmed" — see
		// "PlaybookActorSheet#_onMoveRoll - weapon choice" for the chooseWeapon-driven paths.
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, talk, { ...config, weaponLabel: "Unarmed", weaponTags: null });
	});

	it("rolls a no-trait move (Help or Hinder) through to completion with no traitBonus option", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };
		const config = { conditions: ["hook"], advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "help-or-hinder" } } });

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor,
			BASIC_MOVES.find((m) => m.key === "help-or-hinder"),
			undefined,
			config
		);
	});

	it("finds a special move (lead a sortie) by key, same as a basic move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 }, defy: { value: 0 } } } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			LEAD_A_SORTIE,
			[
				{ key: "know", label: "KNOW", value: 1 },
				{ key: "defy", label: "DEFY", value: 0 },
				{ key: "crew", label: "CREW", value: 0 }
			],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
		);
	});

	it("resolves lead a sortie's CREW from the single Carrier in the world, without prompting", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 }, defy: { value: 0 } } } };
		findCarrierActors.mockReturnValue([{ id: "carrier1", name: "The Wanderer", system: { stats: { crew: { value: 2 } } } }]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(chooseCarrier).not.toHaveBeenCalled();
		expect(configureMoveRoll).toHaveBeenCalledWith(
			LEAD_A_SORTIE,
			[
				{ key: "know", label: "KNOW", value: 1 },
				{ key: "defy", label: "DEFY", value: 0 },
				{ key: "crew", label: "CREW", value: 2 }
			],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
		);
	});

	it("prompts to choose a Carrier when more than one exists, and rolls with its Crew value", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 }, defy: { value: 0 } } } };
		const carrier1 = { id: "carrier1", name: "The Wanderer", system: { stats: { crew: { value: 2 } } } };
		const carrier2 = { id: "carrier2", name: "The Anchor", system: { stats: { crew: { value: -1 } } } };
		findCarrierActors.mockReturnValue([carrier1, carrier2]);
		chooseCarrier.mockResolvedValue("carrier2");
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(chooseCarrier).toHaveBeenCalledWith([carrier1, carrier2]);
		expect(configureMoveRoll).toHaveBeenCalledWith(
			LEAD_A_SORTIE,
			[
				{ key: "know", label: "KNOW", value: 1 },
				{ key: "defy", label: "DEFY", value: 0 },
				{ key: "crew", label: "CREW", value: -1 }
			],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
		);
	});

	it("aborts the roll when the multi-Carrier choice dialog is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 }, defy: { value: 0 } } } };
		findCarrierActors.mockReturnValue([
			{ id: "carrier1", name: "The Wanderer", system: { stats: { crew: { value: 2 } } } },
			{ id: "carrier2", name: "The Anchor", system: { stats: { crew: { value: -1 } } } }
		]);
		chooseCarrier.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});

	it("treats a single Carrier missing its crew stat as 0", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 }, defy: { value: 0 } } } };
		findCarrierActors.mockReturnValue([{ id: "carrier1", name: "The Wanderer", system: { stats: {} } }]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			LEAD_A_SORTIE,
			[
				{ key: "know", label: "KNOW", value: 1 },
				{ key: "defy", label: "DEFY", value: 0 },
				{ key: "crew", label: "CREW", value: 0 }
			],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
		);
	});

	it("treats the chosen Carrier missing its crew stat as 0", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 }, defy: { value: 0 } } } };
		findCarrierActors.mockReturnValue([
			{ id: "carrier1", name: "The Wanderer", system: { stats: {} } },
			{ id: "carrier2", name: "The Anchor", system: { stats: {} } }
		]);
		chooseCarrier.mockResolvedValue("carrier1");
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			LEAD_A_SORTIE,
			[
				{ key: "know", label: "KNOW", value: 1 },
				{ key: "defy", label: "DEFY", value: 0 },
				{ key: "crew", label: "CREW", value: 0 }
			],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
		);
	});

	it("does nothing for subsystems, which has no traits, conditions, or fixed traits to roll", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "subsystems" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does nothing for b-plot, which has no traits, conditions, or fixed traits to roll", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onMoveRoll - bite the dust's locked Desperation", () => {
	const defy = { key: "defy", label: "DEFY", value: 0 };

	it("locks Desperation when at max Dangers and every one is a Peril", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "peril", label: "c" }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], { lockedEffect: "desperation", lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] });
	});

	it("does not lock Desperation when at max Dangers but the types are mixed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "risk", label: "c" }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], { lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] });
	});

	it("does not lock Desperation when below max Dangers, even if all are Perils", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], { lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] });
	});

	it("never locks Desperation for a move without forcesDesperationAtMaxPerils, even at max Perils", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "peril", label: "c" }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[
				{ key: "clash", label: "CLASH", value: 0 },
				{ key: "talk", label: "TALK", value: 0 }
			],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
		);
	});
});

// dispel-uncertainties (not a usesWeapon move) stands in for "any ordinary move" here — these
// tests exercise _equipmentSpends' own unscoped behavior (offering, spent/stale filtering,
// disabling, marking), which is identical for every move except Exchange Blows/Strike Decisively.
// Weapon-scoping itself (chooseWeapon, the weaponLabel it produces) is covered separately below in
// "PlaybookActorSheet#_onMoveRoll - weapon choice" and "PlaybookActorSheet#_equipmentSpends -
// weapon scoping".
describe("PlaybookActorSheet#_onMoveRoll - equipment spends", () => {
	const know = { key: "know", label: "KNOW", value: 1 };
	const blitzSpend = {
		equipmentId: "eq1",
		equipmentName: "Halberd",
		tagKey: "blitz",
		tagLabel: "Blitz",
		description: "You may spend this tag once per Scene to make a move with confidence.",
		effect: "confidence",
		disabled: false
	};

	it("offers every unspent spendable tag across the actor's equipment", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			DISPEL_UNCERTAINTIES,
			[{ key: "know", label: "KNOW", value: 1 }],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [blitzSpend] }
		);
	});

	it("excludes a tag already marked spent on its entry", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: []
		});
	});

	it("treats a missing spent array on an entry as nothing spent yet", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [blitzSpend]
		});
	});

	it("treats a missing tags array on an entry as offering nothing", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "gear", name: "Odd", description: "", spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: []
		});
	});

	it("excludes a tag key that no longer resolves in the catalog", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "gear", name: "Odd", description: "", tags: ["stale-key"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: []
		});
	});

	it("excludes an Astir weapon's spendable tag while unpiloted, even for a non-usesWeapon move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					astir: { id: "a1", piloted: false },
					equipment: [{ id: "eq1", kind: "weapon", astir: true, name: "Lance", description: "", tags: ["blitz"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: []
		});
	});

	it("offers an Astir weapon's spendable tag once piloted, excluding a mundane weapon's", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					astir: { id: "a1", piloted: true },
					equipment: [
						{ id: "eq1", kind: "weapon", astir: true, name: "Lance", description: "", tags: ["blitz"], spent: [] },
						{ id: "eq2", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [expect.objectContaining({ equipmentId: "eq1", tagKey: "blitz" })]
		});
	});

	it("leaves a gear entry's spendable tag unaffected by piloted state", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					astir: { id: "a1", piloted: true },
					equipment: [{ id: "eq1", kind: "gear", name: "Charm", description: "", tags: ["blitz"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [expect.objectContaining({ equipmentId: "eq1", tagKey: "blitz" })]
		});
	});

	it("excludes a spend tag with no effect (e.g. Ward) from the roll-dialog offering", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "gear", name: "Charm", description: "", tags: ["ward"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: []
		});
	});

	it("disables offered spends when the roll's Effect is already locked (bite the dust at max Perils)", async () => {
		const sheet = new PlaybookActorSheet();
		const defy = { key: "defy", label: "DEFY", value: 0 };
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "peril", label: "c" }
					],
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], {
			lockedEffect: "desperation", lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [{ ...blitzSpend, disabled: true }]
		});
	});

	it("marks each checked spend's tag as spent, then rolls the move", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] };
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { equipment: [entry] } },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "confidence", spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DISPEL_UNCERTAINTIES, know, config);
	});

	it("treats a missing spent array as empty when marking a spend", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"] };
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { equipment: [entry] } },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "confidence", spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
	});

	it("does not touch equipment when nothing was spent", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "none", spentTags: [] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DISPEL_UNCERTAINTIES, know, config);
	});

	it("leaves equipment on other entries untouched when marking a spend", async () => {
		const sheet = new PlaybookActorSheet();
		const spent = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] };
		const untouched = { id: "eq2", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { equipment: [spent, untouched] } },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "confidence", spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...spent, spent: ["blitz"] }, untouched]
		});
	});
});

describe("PlaybookActorSheet#_onMoveRoll - astir part spends", () => {
	const know = { key: "know", label: "KNOW", value: 1 };
	const wardingSpend = {
		partKey: WARDING.key,
		partName: "Warding",
		description: WARDING.spend.description,
		effect: null,
		advantage: null,
		disabled: false
	};

	it("offers an installed part's spend when piloted and not yet Expended", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [WARDING.key], piloted: true } }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [wardingSpend],
			equipmentSpends: []
		});
	});

	it("offers nothing when not piloted", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [WARDING.key], piloted: false } }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [],
			equipmentSpends: []
		});
	});

	it("excludes a part already marked Expended", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					astir: { id: "a1", parts: [WARDING.key], piloted: true },
					moveUses: { [WARDING.key]: { expended: true } }
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [],
			equipmentSpends: []
		});
	});

	it("excludes a part with no spend field", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [WEAPON_CONDUIT.key], piloted: true } }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [],
			equipmentSpends: []
		});
	});

	// Artifact's spend sets Advantage, not Effect (unlike an equipment tag's spend) — a locked
	// Effect (bite-the-dust at max Perils) has nothing to conflict with, so it stays offerable.
	it("leaves an advantage-only spend enabled even when the roll's Effect is locked (bite the dust at max Perils)", async () => {
		const sheet = new PlaybookActorSheet();
		const defy = { key: "defy", label: "DEFY", value: 0 };
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "peril", label: "c" }
					],
					astir: { id: "a1", parts: [ARTIFACT.key], piloted: true }
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], {
			lockedEffect: "desperation", lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [{
				partKey: ARTIFACT.key,
				partName: "Artifact",
				description: ARTIFACT.spend.description,
				effect: null,
				advantage: "advantage",
				disabled: false
			}],
			equipmentSpends: []
		});
	});

	it("marks each checked part spend Expended, then rolls the move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [WARDING.key], piloted: true } }
			},
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "none", spentParts: [WARDING.key] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ [`system.attributes.moveUses.${WARDING.key}.expended`]: true });
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DISPEL_UNCERTAINTIES, know, {
			...config,
			spentPartLabels: [{ key: WARDING.key, label: "Warding" }]
		});
	});

	it("does not touch moveUses when no astir part was spent", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: {} },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DISPEL_UNCERTAINTIES, know, config);
	});
});

describe("PlaybookActorSheet#activateListeners - weapon moves", () => {
	it("binds a click handler to the per-weapon quick-roll buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".weapon-move-roll");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onMoveRoll - weapon choice", () => {
	const halberd = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
	const sidearm = { id: "eq2", kind: "weapon", name: "Sidearm", description: "", tags: [], spent: [], scale: "foot", tier: 1 };

	it("prompts chooseWeapon with the actor's weapons when the move usesWeapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd, sidearm] } } };
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(chooseWeapon).toHaveBeenCalledWith([halberd, sidearm]);
	});

	it("excludes Astir weapons from the weapon choice while unpiloted", async () => {
		const sheet = new PlaybookActorSheet();
		const astirWeapon = { id: "eq3", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { astir: { id: "a1", piloted: false }, equipment: [halberd, astirWeapon] }
			}
		};
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(chooseWeapon).toHaveBeenCalledWith([halberd]);
	});

	it("excludes mundane weapons from the weapon choice while piloted, offering only Astir weapons", async () => {
		const sheet = new PlaybookActorSheet();
		const astirWeapon = { id: "eq3", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { astir: { id: "a1", piloted: true }, equipment: [halberd, astirWeapon] }
			}
		};
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(chooseWeapon).toHaveBeenCalledWith([astirWeapon]);
	});

	it("aborts the whole roll when the weapon-choice dialog is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } } };
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});

	it("scopes the roll to no weapon and labels it Unarmed when Unarmed is chosen", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		chooseWeapon.mockResolvedValue(UNARMED);
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: []
		});
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", weaponTags: null });
	});

	it("scopes the roll to the chosen weapon and labels it by name", async () => {
		const sheet = new PlaybookActorSheet();
		const armed = { ...halberd, tags: ["blitz"] };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [armed, sidearm] } },
			update: vi.fn()
		};
		chooseWeapon.mockResolvedValue(armed.id);
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [expect.objectContaining({ equipmentId: armed.id, tagKey: "blitz" })]
		});
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Halberd", weaponTags: "Blitz" });
	});

	it("treats an id chooseWeapon resolved that no longer matches any weapon as Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		chooseWeapon.mockResolvedValue("not-a-real-weapon-id");
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", weaponTags: null });
	});

	it("skips chooseWeapon entirely and rolls Unarmed when the actor has no weapons", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "strike-decisively" } } });

		expect(chooseWeapon).not.toHaveBeenCalled();
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, STRIKE_DECISIVELY, config.trait, { ...config, weaponLabel: "Unarmed", weaponTags: null });
	});
});

describe("PlaybookActorSheet#_onWeaponMoveRoll", () => {
	const halberd = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [], scale: "foot", tier: 1 };

	it("rolls the clicked move with the clicked weapon, without prompting chooseWeapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(chooseWeapon).not.toHaveBeenCalled();
		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [expect.objectContaining({ equipmentId: "eq1", tagKey: "blitz" })]
		});
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Halberd", weaponTags: "Blitz" });
	});

	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [halberd] } } };

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "not-a-real-move", equipmentId: "eq1" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});

	it("does nothing for an unrecognized equipment id", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [halberd] } } };

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "not-a-real-id" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_rollMove - forced weapon effects (Unreliable)", () => {
	it("locks Effect to Desperation on the first roll with an unspent Unreliable weapon this Scene", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: "desperation", lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: []
		});
	});

	it("does not lock Effect when the Unreliable tag is already spent this Scene", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable"], spent: ["unreliable"], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: []
		});
	});

	it("treats a missing spent array as nothing spent yet, for a forced tag", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable"], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), expect.objectContaining({
			lockedEffect: "desperation", lockedAdvantage: null, lockedTrait: null
		}));
	});

	it("marks the forced tag spent after rolling, alongside any player-chosen spend, in one update", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable", "blitz"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		const config = {
			trait: { key: "clash", label: "CLASH", value: 0 },
			advantage: "none",
			effect: "desperation",
			spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }]
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...rifle, spent: ["blitz", "unreliable"] }]
		});
	});

	it("does not force an effect for a weapon with no forcesEffect tag", async () => {
		const sheet = new PlaybookActorSheet();
		const halberd = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), expect.objectContaining({
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null
		}));
	});

	it("treats a missing tags array as no forced effect", async () => {
		const sheet = new PlaybookActorSheet();
		const fists = { id: "eq1", kind: "weapon", name: "Fists", description: "", spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [fists] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), expect.objectContaining({
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null
		}));
	});

	it("never forces an effect for Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		chooseWeapon.mockResolvedValue(UNARMED);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), expect.objectContaining({
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null
		}));
	});
});

describe("PlaybookActorSheet#_rollMove - Field Scout's grantsEffectOnMove", () => {
	it("locks Read the Room's Effect to Confidence when Field Scout is picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { sense: { value: 0 } }, attributes: { playbookMoves: ["the-scout:field-scout"] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "read-the-room" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(READ_THE_ROOM, expect.any(Array), expect.objectContaining({
			lockedEffect: "confidence", lockedAdvantage: null, lockedTrait: null
		}));
	});

	it("leaves Read the Room's Effect unlocked without Field Scout picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { sense: { value: 0 } }, attributes: { playbookMoves: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "read-the-room" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(READ_THE_ROOM, expect.any(Array), expect.objectContaining({
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null
		}));
	});

	it("does not lock a different move's Effect just because Field Scout is picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 0 } }, attributes: { playbookMoves: ["the-scout:field-scout"] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), expect.objectContaining({
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null
		}));
	});
});

describe("PlaybookActorSheet#_rollMove - Don't Follow Me's grantsTraitOnMove/grantsAdvantageOnMove", () => {
	it("locks Lead a Sortie's Trait to DEFY and its Dice to Advantage when picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 }, defy: { value: 2 } },
				attributes: { playbookMoves: [DONT_FOLLOW_ME.key] }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(LEAD_A_SORTIE, expect.any(Array), expect.objectContaining({
			lockedTrait: { key: "defy", label: "DEFY", value: 2 },
			lockedAdvantage: "advantage"
		}));
	});

	it("leaves Lead a Sortie's Trait and Dice unlocked without Don't Follow Me picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 1 }, defy: { value: 2 } }, attributes: { playbookMoves: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(LEAD_A_SORTIE, expect.any(Array), expect.objectContaining({
			lockedTrait: null,
			lockedAdvantage: null
		}));
	});

	it("does not lock a different move's Trait/Dice just because Don't Follow Me is picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 0 } }, attributes: { playbookMoves: [DONT_FOLLOW_ME.key] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), expect.objectContaining({
			lockedTrait: null,
			lockedAdvantage: null
		}));
	});

	it("does not lock the granted trait when it's disabled for this actor", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 }, defy: { value: 0, disabled: true } },
				attributes: { playbookMoves: [DONT_FOLLOW_ME.key] }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(LEAD_A_SORTIE, expect.any(Array), expect.objectContaining({
			lockedTrait: null
		}));
	});
});

describe("PlaybookActorSheet#_rollMove - derived Trait bonuses (Arcane Augments, Let Loose)", () => {
	it("adds a picked Arcane Augments-style bonus into the trait's dialog value and the roll's traitBonus option", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 1 } },
				attributes: {
					playbookMoves: [ARCANE_AUGMENTS.key],
					dangers: [{ id: "1", type: "risk", label: "Exposed" }, { id: "2", type: "peril", label: "Cornered" }]
				}
			},
			update: vi.fn()
		};
		const trait = { key: "channel", label: "CHANNEL", value: 3 };
		configureMoveRoll.mockResolvedValue({ trait, advantage: "none", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "weave-magic" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(WEAVE_MAGIC, [trait], expect.any(Object));
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, WEAVE_MAGIC, trait, expect.objectContaining({ traitBonus: 2 }));
	});

	it("omits traitBonus entirely when the chosen trait has no bonus", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 1 } } }, update: vi.fn() };
		const trait = { key: "clash", label: "CLASH", value: 1 };
		configureMoveRoll.mockResolvedValue({ trait, advantage: "none", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove.mock.calls.at(-1)[3]).not.toHaveProperty("traitBonus");
	});

	it("lets a Let Loose player pick which Trait its per-burden bonus applies to", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 0 } },
				attributes: {
					playbookMoves: [LET_LOOSE.key],
					burdens: [{ id: "1", label: "A lingering injury" }],
					traitBonusChoices: { [LET_LOOSE.key]: "channel" }
				}
			},
			update: vi.fn()
		};
		const trait = { key: "channel", label: "CHANNEL", value: 1 };
		configureMoveRoll.mockResolvedValue({ trait, advantage: "none", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "weave-magic" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(WEAVE_MAGIC, [trait], expect.any(Object));
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, WEAVE_MAGIC, trait, expect.objectContaining({ traitBonus: 1 }));
	});
});

describe("PlaybookActorSheet#_rollMove - Familiar weapons (+CHANNEL override)", () => {
	const wisp = { id: "eq1", kind: "weapon", astir: true, familiar: true, name: "Wisp Familiar III", description: "", tags: ["ranged"], spent: [] };

	it("rolls Exchange Blows with a Familiar weapon as +CHANNEL instead of CLASH/TALK", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, talk: { value: 2 }, channel: { value: 3 } },
				attributes: { equipment: [wisp] }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[{ key: "channel", label: "CHANNEL", value: 3 }],
			expect.any(Object)
		);
	});

	it("rolls Strike Decisively with a Familiar weapon as +CHANNEL too", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, talk: { value: 2 }, channel: { value: 3 } },
				attributes: { equipment: [wisp] }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "strike-decisively", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			STRIKE_DECISIVELY,
			[{ key: "channel", label: "CHANNEL", value: 3 }],
			expect.any(Object)
		);
	});

	it("defaults CHANNEL to 0 when the actor has no channel stat at all", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 1 }, talk: { value: 2 } }, attributes: { equipment: [wisp] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[{ key: "channel", label: "CHANNEL", value: 0 }],
			expect.any(Object)
		);
	});

	it("leaves CLASH/TALK untouched for a non-Familiar weapon", async () => {
		const sheet = new PlaybookActorSheet();
		const halberd = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, talk: { value: 2 }, channel: { value: 3 } },
				attributes: { equipment: [halberd] }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[{ key: "clash", label: "CLASH", value: 1 }, { key: "talk", label: "TALK", value: 2 }],
			expect.any(Object)
		);
	});
});

describe("PlaybookActorSheet#_rollMove - reroll offer (Decisive/Defensive/Versatile)", () => {
	const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };

	it("offers a reroll when the weapon has an unspent reroll tag matching this move", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["defensive"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, {
			...config,
			weaponLabel: "Rifle",
			weaponTags: "Defensive",
			reroll: { equipmentId: "eq1", tagKey: "defensive" }
		});
	});

	it("does not offer a reroll when the weapon's reroll tag doesn't cover this move", async () => {
		const sheet = new PlaybookActorSheet();
		// Decisive only covers strike-decisively, not exchange-blows.
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["decisive"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Rifle", weaponTags: "Decisive" });
	});

	it("does not offer an already-spent reroll tag", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["defensive"], spent: ["defensive"], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Rifle", weaponTags: "Defensive" });
	});

	it("offers Versatile's reroll for strike-decisively as well as exchange-blows", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["versatile"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "strike-decisively", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, STRIKE_DECISIVELY, config.trait, {
			...config,
			weaponLabel: "Rifle",
			weaponTags: "Versatile",
			reroll: { equipmentId: "eq1", tagKey: "versatile" }
		});
	});

	it("treats a missing spent array as nothing spent yet, for a reroll tag", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["defensive"], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, {
			...config,
			weaponLabel: "Rifle",
			weaponTags: "Defensive",
			reroll: { equipmentId: "eq1", tagKey: "defensive" }
		});
	});

	it("treats a missing tags array as no reroll offer", async () => {
		const sheet = new PlaybookActorSheet();
		const fists = { id: "eq1", kind: "weapon", name: "Fists", description: "", spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [fists] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Fists", weaponTags: null });
	});

	it("never offers a reroll for Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", weaponTags: null });
	});
});

describe("PlaybookActorSheet#_rollMove - Guided (take 7-9)", () => {
	it("passes guided: true to configureMoveRoll when the weapon has a live Guided tag", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["guided"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [],
			guided: true
		});
	});

	it("omits guided from configureMoveRoll's options for a non-Guided weapon", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), { lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] });
	});

	it("treats a missing tags array as not Guided", async () => {
		const sheet = new PlaybookActorSheet();
		const fists = { id: "eq1", kind: "weapon", name: "Fists", description: "", spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [fists] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), { lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] });
	});

	it("is never Guided for Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), { lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] });
	});

	it("posts a guided result and never rolls when Take 7-9 is chosen", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["guided"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ takeSeven: true });

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(postGuidedResult).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, { weaponLabel: "Rifle", weaponTags: "Guided" });
		expect(rollMove).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("labels the guided result Unarmed when taking 7-9 with no weapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ takeSeven: true });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(postGuidedResult).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, { weaponLabel: "Unarmed", weaponTags: null });
	});
});

describe("PlaybookActorSheet#_rollMove - Spell Routines (Guided on any move)", () => {
	it("is Guided for a non-weapon move when piloted with Spell Routines installed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [SPELL_ROUTINES.key], piloted: true } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [],
			equipmentSpends: [],
			guided: true
		});
	});

	it("is not Guided when not piloted, even with Spell Routines installed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [SPELL_ROUTINES.key], piloted: false } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [],
			equipmentSpends: []
		});
	});
});

describe("PlaybookActorSheet#_rollMove - Astir Part reactions (potions, doubles regen)", () => {
	it("grants a Potion of each color after this actor rolls Lead a Sortie with Alchemical Suite installed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 }, defy: { value: 0 } },
				attributes: {
					astir: { id: "a1", parts: [ALCHEMICAL_SUITE.key], piloted: true, potions: { red: 1, blue: 0, yellow: 0 } }
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "know", label: "KNOW", value: 1 }, advantage: "none", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.potions": { red: 2, blue: 1, yellow: 1 }
		});
	});

	it("does not grant Potions for a move other than Lead a Sortie", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [ALCHEMICAL_SUITE.key], piloted: true } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "know", label: "KNOW", value: 1 }, advantage: "none", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).not.toHaveBeenCalledWith(expect.objectContaining({
			"system.attributes.astir.potions": expect.anything()
		}));
	});

	it("regains 1 Power when the roll's kept dice come up doubles with Flourish Component installed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [FLOURISH_COMPONENT.key], piloted: true, power: 1 } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "know", label: "KNOW", value: 1 }, advantage: "none", effect: "none" });
		rollMove.mockResolvedValue({
			message: undefined,
			dice: [{ original: 3, result: 3, changed: false, kept: true }, { original: 3, result: 3, changed: false, kept: true }]
		});

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.power": 2 });
	});

	it("does not regain Power when the roll's kept dice are not doubles", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [FLOURISH_COMPONENT.key], piloted: true, power: 1 } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "know", label: "KNOW", value: 1 }, advantage: "none", effect: "none" });
		rollMove.mockResolvedValue({
			message: undefined,
			dice: [{ original: 3, result: 3, changed: false, kept: true }, { original: 5, result: 5, changed: false, kept: true }]
		});

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does not react to potions/doubles when not piloted", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 }, defy: { value: 0 } },
				attributes: {
					astir: { id: "a1", parts: [ALCHEMICAL_SUITE.key, FLOURISH_COMPONENT.key], piloted: false, power: 1 }
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "know", label: "KNOW", value: 1 }, advantage: "none", effect: "none" });
		rollMove.mockResolvedValue({
			message: undefined,
			dice: [{ original: 3, result: 3, changed: false, kept: true }, { original: 3, result: 3, changed: false, kept: true }]
		});

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_grantPotions", () => {
	it("increments each color by 1", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", potions: { red: 1, blue: 0, yellow: 0 } } } },
			update: vi.fn()
		};

		await sheet._grantPotions();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.potions": { red: 2, blue: 1, yellow: 1 }
		});
	});

	it("treats a missing potions object as all zero", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		await sheet._grantPotions();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.potions": { red: 1, blue: 1, yellow: 1 }
		});
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._grantPotions();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_regainAstirPower", () => {
	it("adds the given amount, clamped to the parts-adjusted maximum", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 1, parts: [] } } }, update: vi.fn() };

		await sheet._regainAstirPower(1);

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.power": 2 });
	});

	it("does not exceed the maximum", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: ASTIR_POWER_BASE, parts: [] } } },
			update: vi.fn()
		};

		await sheet._regainAstirPower(1);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing power and parts array as 0 and none", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		await sheet._regainAstirPower(1);

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.power": 1 });
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._regainAstirPower(1);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onMoveResolved", () => {
	it("does nothing when not piloted", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", parts: [ALCHEMICAL_SUITE.key], piloted: false } } },
			update: vi.fn()
		};

		await sheet._onMoveResolved(LEAD_A_SORTIE, null);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir at all", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onMoveResolved(LEAD_A_SORTIE, null);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_spendAstirParts", () => {
	it("marks each given part key Expended in one update", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		await sheet._spendAstirParts([WARDING.key, ARTIFACT.key]);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${WARDING.key}.expended`]: true,
			[`system.attributes.moveUses.${ARTIFACT.key}.expended`]: true
		});
	});

	it("writes nothing for an empty list", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		await sheet._spendAstirParts([]);

		expect(sheet.actor.update).toHaveBeenCalledWith({});
	});
});

describe("PlaybookActorSheet#getData - weaponMoves", () => {
	it("lists exchange-blows and strike-decisively on every weapon entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: false },
			{ key: "strike-decisively", name: "Strike Decisively", gated: false }
		]);
	});

	it("gates weaponMoves the same way the Moves tab gates them", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0, disabled: true }, talk: { value: 0, disabled: true } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: true },
			{ key: "strike-decisively", name: "Strike Decisively", gated: true }
		]);
	});

	it("gates a mundane weapon's weaponMoves once the Astir is piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					astir: { id: "a1", tier: 3, parts: [], move: null, piloted: true },
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: true },
			{ key: "strike-decisively", name: "Strike Decisively", gated: true }
		]);
	});

	it("does not attach weaponMoves to gear", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					equipment: [{ id: "eq1", kind: "gear", name: "Rations", description: "", tags: [], spent: [] }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.gear[0].weaponMoves).toBeUndefined();
	});

	it("gates an Astir weapon's weaponMoves when the Astir isn't piloted, regardless of its own gating", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					astir: { id: "a1", tier: 3, parts: [], move: null, piloted: false },
					equipment: [
						{ id: "eq1", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.astir.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: true },
			{ key: "strike-decisively", name: "Strike Decisively", gated: true }
		]);
	});

	it("leaves an Astir weapon's weaponMoves gating to its own logic once piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					astir: { id: "a1", tier: 3, parts: [], move: null, piloted: true },
					equipment: [
						{ id: "eq1", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.astir.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: false },
			{ key: "strike-decisively", name: "Strike Decisively", gated: false }
		]);
	});
});

describe("PlaybookActorSheet#_onMoveActivate", () => {
	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "not-a-real-move" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for a move with no flat hold to grant, e.g. lead a sortie", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(postMoveDescription).not.toHaveBeenCalled();
	});

	it("adds b-plot's flat hold to its own moveHold pool", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 3 });
		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, B_PLOT);
	});

	it("adds to, rather than replaces, an existing moveHold value", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 1 } } } }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 3 });
	});

	it("clamps at the maximum and does not update the actor", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 3 } } } }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, B_PLOT);
	});

	it("does not affect the shared resources.hold field", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: {}, resources: { hold: { value: 5 } } },
			update: vi.fn()
		};

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(sheet.actor.update).not.toHaveBeenCalledWith(expect.objectContaining({
			"system.resources.hold.value": expect.anything()
		}));
	});

	it("keeps a different flatHold move's pool untouched when activating this one", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveHold: { "b-plot": { value: 2 } } } },
			update: vi.fn()
		};

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "soldier:get-out-of-my-way" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.soldier:get-out-of-my-way.value": 3
		});
	});

	it("posts Read the Room's real question list to chat and checks Expended, for Divination Codex", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: DIVINATION_CODEX.key } } });

		expect(ChatMessage.create).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "<h3>Divination Codex</h3>",
			content: `<ul>${READ_THE_ROOM.questions.map((question) => `<li>${question}</li>`).join("")}</ul>`
		});
		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${DIVINATION_CODEX.key}.expended`]: true
		});
		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, DIVINATION_CODEX);
	});

	it("posts the move's own prompt and options to chat for an activateChoices move (Bureaucrat)", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: BUREAUCRAT.key } } });

		expect(ChatMessage.create).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "<h3>Bureaucrat</h3>",
			content: `<p>${BUREAUCRAT.activateChoices.prompt}</p>` +
				`<ul>${BUREAUCRAT.activateChoices.options.map((option) => `<li>${option}</li>`).join("")}</ul>`
		});
		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, BUREAUCRAT);
	});
});

describe("PlaybookActorSheet#_onMoveDescription", () => {
	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "not-a-real-move" } } });

		expect(postMoveDescription).not.toHaveBeenCalled();
	});

	it("posts the move's description to chat", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS);
	});

	it("finds a special move (subsystems) by key, same as a basic move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "subsystems" } } });

		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, SUBSYSTEMS);
	});

	it("finds a playbook move by its pool-prefixed key, same as a basic move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: BULLHEADED.key } } });

		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, BULLHEADED);
	});

	it("posts b-plot's description even when it's gated (CHANNEL enabled)", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, B_PLOT);
	});
});

describe("PlaybookActorSheet#getData - controls", () => {
	it("disables both buttons when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.controls).toEqual({ mountUpDisabled: true, dismountDisabled: true });
	});

	it("enables Mount Up and disables Dismount for an unpiloted Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: false } } } };

		const data = sheet.getData();

		expect(data.controls).toEqual({ mountUpDisabled: false, dismountDisabled: true });
	});

	it("disables Mount Up and enables Dismount for a piloted Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: true } } } };

		const data = sheet.getData();

		expect(data.controls).toEqual({ mountUpDisabled: true, dismountDisabled: false });
	});
});

describe("PlaybookActorSheet#activateListeners - controls", () => {
	it("binds click handlers to the Mount Up, Dismount, Refresh Scene, and Refresh Sortie buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".controls-mount-up");
		expect(html.find).toHaveBeenCalledWith(".controls-dismount");
		expect(html.find).toHaveBeenCalledWith(".controls-refresh-scene");
		expect(html.find).toHaveBeenCalledWith(".controls-refresh-sortie");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onMountUp", () => {
	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onMountUp();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when already piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: true } } }, update: vi.fn() };

		sheet._onMountUp();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("sets piloted to true", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: false } } }, update: vi.fn() };

		sheet._onMountUp();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.piloted": true });
	});

	it("warns and does not update when Power is negative", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", piloted: false, power: -1 } } },
			update: vi.fn()
		};

		sheet._onMountUp();

		expect(ui.notifications.warn).toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onDismount", () => {
	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onDismount();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when already not piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: false } } }, update: vi.fn() };

		sheet._onDismount();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("sets piloted to false", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", piloted: true } } }, update: vi.fn() };

		sheet._onDismount();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.piloted": false });
	});
});

describe("PlaybookActorSheet#_onRefreshScene", () => {
	it("clears every Scene-scoped spend/forcesEffect/reroll tag but leaves Sortie-scoped and unscoped ones", () => {
		const sheet = new PlaybookActorSheet();
		const entry = {
			id: "1",
			kind: "weapon",
			name: "Halberd",
			description: "",
			// blitz: spend.period Scene; unreliable: forcesEffect.period Scene; decisive: reroll.period
			// Scene; cursed: no spend/forcesEffect/reroll at all; dangerous: spend.period Sortie.
			tags: ["blitz", "unreliable", "decisive", "cursed", "dangerous"],
			spent: ["blitz", "unreliable", "decisive", "cursed", "dangerous"],
			scale: "foot",
			tier: 1
		};
		sheet.actor = {
			system: { attributes: { equipment: [entry] }, resources: { hold: { value: 2 } } },
			update: vi.fn()
		};

		sheet._onRefreshScene();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["cursed", "dangerous"] }],
			"system.attributes.moveHold.the-scout:mobility.value": 0,
			"system.resources.hold.value": 0
		});
	});

	it("leaves the equipment array untouched when nothing matches the Scene period", () => {
		const sheet = new PlaybookActorSheet();
		const untouched = {
			id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["dangerous"], spent: ["dangerous"]
		};
		const noSpends = { id: "2", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		const neverSpent = { id: "3", kind: "gear", name: "Kit", description: "", tags: ["ward"] };
		sheet.actor = {
			system: {
				attributes: { equipment: [untouched, noSpends, neverSpent] },
				resources: { hold: { value: 0 } }
			},
			update: vi.fn()
		};

		sheet._onRefreshScene();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.the-scout:mobility.value": 0,
			"system.resources.hold.value": 0
		});
	});

	it("does not touch Sortie-scoped moveUses flags", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { moveUses: { [SEEK_ALLIES.key]: { sortie: true } } },
				resources: { hold: { value: 0 } }
			},
			update: vi.fn()
		};

		sheet._onRefreshScene();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.the-scout:mobility.value": 0,
			"system.resources.hold.value": 0
		});
	});

	it("resets the shared hold value to 0 even with nothing else to clear", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {}, resources: { hold: { value: 3 } } }, update: vi.fn() };

		sheet._onRefreshScene();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.the-scout:mobility.value": 0,
			"system.resources.hold.value": 0
		});
	});

	it("clears a live separateHold pool (Mobility) alongside the shared hold value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { moveHold: { "the-scout:mobility": { value: 3 } } },
				resources: { hold: { value: 0 } }
			},
			update: vi.fn()
		};

		sheet._onRefreshScene();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.the-scout:mobility.value": 0,
			"system.resources.hold.value": 0
		});
	});
});

describe("PlaybookActorSheet#_onRefreshSortie", () => {
	it("clears Sortie-scoped spent equipment tags but leaves Scene-scoped ones", () => {
		const sheet = new PlaybookActorSheet();
		const entry = {
			id: "1",
			kind: "weapon",
			name: "Halberd",
			description: "",
			tags: ["blitz", "dangerous"],
			spent: ["blitz", "dangerous"],
			scale: "foot",
			tier: 1
		};
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }],
			"system.attributes.moveHold.b-plot.value": 0,
			"system.attributes.moveHold.the-scout:improvisation.value": 0,
			"system.attributes.moveHold.soldier:get-out-of-my-way.value": 0,
			"system.attributes.moveHold.soldier:once-the-wars-over.value": 0,
			"system.attributes.downtimeTokens.value": 3
		});
	});

	it("clears a Sortie-scoped moveUses flag (Seek Allies) but leaves Personal Familiar's Downtime use", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					moveUses: {
						[SEEK_ALLIES.key]: { sortie: true },
						[PERSONAL_FAMILIAR.key]: { downtime: true }
					}
				}
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${SEEK_ALLIES.key}.sortie`]: false,
			"system.attributes.moveHold.b-plot.value": 0,
			"system.attributes.moveHold.the-scout:improvisation.value": 0,
			"system.attributes.moveHold.soldier:get-out-of-my-way.value": 0,
			"system.attributes.moveHold.soldier:once-the-wars-over.value": 0,
			"system.attributes.downtimeTokens.value": 3
		});
	});

	it("clears an Astir Active part's Expended flag", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveUses: { [DIVINATION_CODEX.key]: { expended: true } } } },
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${DIVINATION_CODEX.key}.expended`]: false,
			"system.attributes.moveHold.b-plot.value": 0,
			"system.attributes.moveHold.the-scout:improvisation.value": 0,
			"system.attributes.moveHold.soldier:get-out-of-my-way.value": 0,
			"system.attributes.moveHold.soldier:once-the-wars-over.value": 0,
			"system.attributes.downtimeTokens.value": 3
		});
	});

	it("resets Astir Potions to 0 when Alchemical Suite is installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", parts: [ALCHEMICAL_SUITE.key], potions: { red: 2, blue: 1, yellow: 3 } }
				}
			},
			update: vi.fn()
		};

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.potions": { red: 0, blue: 0, yellow: 0 },
			"system.attributes.moveHold.b-plot.value": 0,
			"system.attributes.moveHold.the-scout:improvisation.value": 0,
			"system.attributes.moveHold.soldier:get-out-of-my-way.value": 0,
			"system.attributes.moveHold.soldier:once-the-wars-over.value": 0,
			"system.attributes.downtimeTokens.value": 3
		});
	});

	it("does not add a potions field when Alchemical Suite is not installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [] } } }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(sheet.actor.update).not.toHaveBeenCalledWith(
			expect.objectContaining({ "system.attributes.astir.potions": expect.anything() })
		);
	});

	it("resets the three flat hold pools to 0 even with nothing else to clear", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onRefreshSortie();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.b-plot.value": 0,
			"system.attributes.moveHold.the-scout:improvisation.value": 0,
			"system.attributes.moveHold.soldier:get-out-of-my-way.value": 0,
			"system.attributes.moveHold.soldier:once-the-wars-over.value": 0,
			"system.attributes.downtimeTokens.value": 3
		});
	});
});
