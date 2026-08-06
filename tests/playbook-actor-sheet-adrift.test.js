import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn()
}));

vi.mock("../scripts/frames/astir.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseAstirPart: vi.fn(),
	chooseAstirWeapon: vi.fn()
}));

// findCarrierActors defaults to no Carriers in the world, matching every other sheet test file's
// own stance — needed here since getData's move-trait resolution reaches it regardless of which
// feature is under test.
vi.mock("../scripts/world-actors/carrier-actor-sheet.js", async (importOriginal) => ({
	...(await importOriginal()),
	findCarrierActors: vi.fn(() => [])
}));

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	postGuidedResult: vi.fn(),
	rollMove: vi.fn()
}));

import { BASIC_MOVES, SPECIAL_MOVES, configureMoveRoll, postGuidedResult, rollMove } from "../scripts/moves/moves.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import {
	GRAVITY_CLOCK_PROGRESS_MAX,
	GRAVITY_CLOCK_VALUE_MAX,
	GRAVITY_CLOCK_VALUE_MIN
} from "../scripts/playbook/playbook-sheet/tracking-mixin.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const WEAVE_MAGIC = BASIC_MOVES.find((m) => m.key === "weave-magic");
const DISPEL_UNCERTAINTIES = BASIC_MOVES.find((m) => m.key === "dispel-uncertainties");
const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const STRIKE_DECISIVELY = BASIC_MOVES.find((m) => m.key === "strike-decisively");
const LEAD_A_SORTIE = SPECIAL_MOVES.find((m) => m.key === "lead-a-sortie");
const LOVE_LOVE_LOVE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-adrift:love-love-love");
const WALK_ON_PART = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-adrift:walk-on-part-in-the-war");
const LEAD_ROLE_IN_A_CAGE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-adrift:lead-role-in-a-cage");
const DRAW_YOUR_BATH = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-adrift:draw-your-bath-and-load-your-gun");

beforeEach(() => {
	foundry.utils.randomID.mockReturnValue("test-id");
	configureMoveRoll.mockClear();
	postGuidedResult.mockClear();
	rollMove.mockClear();
	// rollMove resolves { message, dice, tier } (see moves.js) — a bare default so every test that
	// doesn't care about the roll's own outcome doesn't have to configure this itself.
	rollMove.mockResolvedValue({ message: undefined, dice: null, tier: undefined });
});

describe("PlaybookActorSheet#_home", () => {
	it("defaults to progress 0 and GRAVITY_CLOCK_VALUE_MIN when unset", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._home()).toEqual({ progress: 0, value: GRAVITY_CLOCK_VALUE_MIN });
	});

	it("returns the stored value when set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { home: { progress: 3, value: 2 } } } };

		expect(sheet._home()).toEqual({ progress: 3, value: 2 });
	});
});

describe("PlaybookActorSheet#_homeMove", () => {
	it("is undefined when Love, Love, Love isn't picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._homeMove()).toBeUndefined();
	});

	it("returns the move object once picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [LOVE_LOVE_LOVE.key] } } };

		expect(sheet._homeMove()).toEqual(LOVE_LOVE_LOVE);
	});
});

describe("PlaybookActorSheet#_homeTraitOption", () => {
	it("tracks the actor's stored home value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { home: { progress: 0, value: 3 } } } };

		expect(sheet._homeTraitOption()).toEqual({ key: "home", label: "HOME", value: 3 });
	});

	it("defaults to GRAVITY_CLOCK_VALUE_MIN with no stored home", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._homeTraitOption()).toEqual({ key: "home", label: "HOME", value: GRAVITY_CLOCK_VALUE_MIN });
	});
});

describe("PlaybookActorSheet#getData - data.home", () => {
	it("is null without Love, Love, Love picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-adrift" }, attributes: { playbookMoves: [] } } };

		expect(sheet.getData().home).toBeNull();
	});

	it("is populated with the right progressSteps once picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { slug: "the-adrift" },
				attributes: { playbookMoves: [LOVE_LOVE_LOVE.key], home: { progress: 2, value: 3 } }
			}
		};

		const data = sheet.getData();

		expect(data.home.value).toBe(3);
		expect(data.home.progressSteps).toHaveLength(GRAVITY_CLOCK_PROGRESS_MAX);
		expect(data.home.progressSteps.filter((step) => step.filled)).toHaveLength(2);
	});

	it("treats a missing stored value as GRAVITY_CLOCK_VALUE_MIN", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { slug: "the-adrift" },
				attributes: { playbookMoves: [LOVE_LOVE_LOVE.key], home: { progress: 2 } }
			}
		};

		expect(sheet.getData().home.value).toBe(GRAVITY_CLOCK_VALUE_MIN);
	});

	it("treats a missing stored progress as 0 (no steps filled)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { slug: "the-adrift" },
				attributes: { playbookMoves: [LOVE_LOVE_LOVE.key], home: { value: 2 } }
			}
		};

		expect(sheet.getData().home.progressSteps.filter((step) => step.filled)).toHaveLength(0);
	});
});

describe("PlaybookActorSheet#_onHomeValueStep", () => {
	it("increments within range", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { home: { progress: 0, value: 1 } } }, update: vi.fn() };

		sheet._onHomeValueStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.home.value": 2 });
	});

	it("clamps at the floor (GRAVITY_CLOCK_VALUE_MIN) and does not update", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { home: { progress: 0, value: GRAVITY_CLOCK_VALUE_MIN } } },
			update: vi.fn()
		};

		sheet._onHomeValueStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the ceiling (GRAVITY_CLOCK_VALUE_MAX) and does not update", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { home: { progress: 0, value: GRAVITY_CLOCK_VALUE_MAX } } },
			update: vi.fn()
		};

		sheet._onHomeValueStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing stored value as GRAVITY_CLOCK_VALUE_MIN", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { home: { progress: 0 } } }, update: vi.fn() };

		sheet._onHomeValueStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.home.value": GRAVITY_CLOCK_VALUE_MIN + 1 });
	});
});

describe("PlaybookActorSheet#_onHomeProgressStep", () => {
	it("fills the track up to a clicked step above the current progress", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { home: { progress: 1, value: 1 } } }, update: vi.fn() };

		sheet._onHomeProgressStep({ currentTarget: { dataset: { step: "4" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.home.progress": 4 });
	});

	it("decrements by one when clicking the current top (highest filled) step", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { home: { progress: 3, value: 1 } } }, update: vi.fn() };

		sheet._onHomeProgressStep({ currentTarget: { dataset: { step: "3" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.home.progress": 2 });
	});

	it("clamps at the floor (0) and does not update", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { home: { progress: 0, value: 1 } } }, update: vi.fn() };

		sheet._onHomeProgressStep({ currentTarget: { dataset: { step: "0" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps a step beyond the track's max and does not update", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { home: { progress: GRAVITY_CLOCK_PROGRESS_MAX, value: 1 } } },
			update: vi.fn()
		};

		sheet._onHomeProgressStep({ currentTarget: { dataset: { step: String(GRAVITY_CLOCK_PROGRESS_MAX + 1) } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing stored progress as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { home: { value: 1 } } }, update: vi.fn() };

		sheet._onHomeProgressStep({ currentTarget: { dataset: { step: "2" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.home.progress": 2 });
	});
});

describe("PlaybookActorSheet#_advanceHome", () => {
	it("advances progress by 1", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { home: { progress: 2, value: 1 } } }, update: vi.fn() };

		await sheet._advanceHome();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.home.progress": 3 });
	});

	it("clamps at GRAVITY_CLOCK_PROGRESS_MAX and does not update once already there", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { home: { progress: GRAVITY_CLOCK_PROGRESS_MAX, value: 1 } } },
			update: vi.fn()
		};

		await sheet._advanceHome();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing progress as starting at 0", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { home: { value: 1 } } }, update: vi.fn() };

		await sheet._advanceHome();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.home.progress": 1 });
	});
});

describe("PlaybookActorSheet#_moveTraits - Love, Love, Love's +HOME substitution", () => {
	it("offers +HOME on a channel-using move once Love, Love, Love is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 0, disabled: true } },
				attributes: { playbookMoves: [LOVE_LOVE_LOVE.key], home: { progress: 0, value: 2 } }
			}
		};

		const traits = sheet._moveTraits(WEAVE_MAGIC);

		expect(traits).toContainEqual({ key: "home", label: "HOME", value: 2 });
	});

	it("does not offer +HOME on a channel-using move without Love, Love, Love picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 0, disabled: true } },
				attributes: { playbookMoves: [] }
			}
		};

		const traits = sheet._moveTraits(WEAVE_MAGIC);

		expect(traits.some((trait) => trait.key === "home")).toBe(false);
	});

	it("does not offer +HOME on a move that doesn't roll +CHANNEL", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 0 } },
				attributes: { playbookMoves: [LOVE_LOVE_LOVE.key], home: { progress: 0, value: 2 } }
			}
		};

		const traits = sheet._moveTraits(DISPEL_UNCERTAINTIES);

		expect(traits.some((trait) => trait.key === "home")).toBe(false);
	});

	it("does not add a second +HOME entry to a move that somehow already offers it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 0, disabled: true } },
				attributes: {
					playbookMoves: [LOVE_LOVE_LOVE.key, WALK_ON_PART.key],
					home: { progress: 0, value: 2 }
				}
			}
		};

		// Not a realistic case (Walk-on Part targets Exchange Blows/Strike Decisively, not Weave
		// Magic) — this just exercises the dedupe guard directly by re-using WEAVE_MAGIC, which
		// already offers +HOME via the channel-substitution block on its own.
		const traits = sheet._moveTraits(WEAVE_MAGIC);

		expect(traits.filter((trait) => trait.key === "home")).toHaveLength(1);
	});
});

describe("PlaybookActorSheet#_moveTraits - Walk-on Part In The War", () => {
	it("offers +HOME on Exchange Blows once picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { playbookMoves: [WALK_ON_PART.key], home: { progress: 0, value: 3 } }
			}
		};

		const traits = sheet._moveTraits(EXCHANGE_BLOWS);

		expect(traits).toContainEqual({ key: "home", label: "HOME", value: 3 });
	});

	it("offers +HOME on Strike Decisively once picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { playbookMoves: [WALK_ON_PART.key], home: { progress: 0, value: 3 } }
			}
		};

		const traits = sheet._moveTraits(STRIKE_DECISIVELY);

		expect(traits).toContainEqual({ key: "home", label: "HOME", value: 3 });
	});

	it("does not offer +HOME on Exchange Blows without the move picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { playbookMoves: [] } }
		};

		const traits = sheet._moveTraits(EXCHANGE_BLOWS);

		expect(traits.some((trait) => trait.key === "home")).toBe(false);
	});
});

describe("PlaybookActorSheet#_rollMove - Lead Role In A Cage locks Lead a Sortie to +HOME", () => {
	it("locks Lead a Sortie's Trait to HOME when picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 }, defy: { value: 2 } },
				attributes: { playbookMoves: [LEAD_ROLE_IN_A_CAGE.key], home: { progress: 0, value: 2 } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(LEAD_A_SORTIE, expect.any(Array), expect.objectContaining({
			lockedTrait: { key: "home", label: "HOME", value: 2 }
		}));
	});

	it("leaves Lead a Sortie's Trait unlocked without Lead Role In A Cage picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 1 }, defy: { value: 2 } }, attributes: { playbookMoves: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(LEAD_A_SORTIE, expect.any(Array), expect.objectContaining({
			lockedTrait: null
		}));
	});
});

describe("PlaybookActorSheet#_rollMove - advances +HOME on use (the playbook's own Gravity Trigger)", () => {
	it("advances the Home clock when the resolved trait is home", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { playbookMoves: [LEAD_ROLE_IN_A_CAGE.key], home: { progress: 1, value: 2 } }
			},
			update: vi.fn()
		};
		const config = { trait: { key: "home", label: "HOME", value: 2 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.home.progress": 2 });
	});

	it("does not advance the Home clock when a different trait is rolled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { playbookMoves: [], home: { progress: 1, value: 2 } }
			},
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(sheet.actor.update).not.toHaveBeenCalledWith({ "system.attributes.home.progress": 2 });
	});

	it("does not advance the Home clock on Guided's Take 7-9 path (no trait was actually rolled)", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { playbookMoves: [LEAD_ROLE_IN_A_CAGE.key], home: { progress: 1, value: 2 } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ takeSeven: true });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(sheet.actor.update).not.toHaveBeenCalledWith({ "system.attributes.home.progress": 2 });
		expect(rollMove).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_rollMove - Draw Your Bath And Load Your Gun (self-targeting addsTraitToMove)", () => {
	it("rolls with +HOME despite the move's own traits: []", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { playbookMoves: [DRAW_YOUR_BATH.key], home: { progress: 0, value: 2 } }
			},
			update: vi.fn()
		};
		const config = { trait: { key: "home", label: "HOME", value: 2 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: DRAW_YOUR_BATH.key } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			DRAW_YOUR_BATH,
			[{ key: "home", label: "HOME", value: 2 }],
			expect.any(Object)
		);
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DRAW_YOUR_BATH, config.trait, expect.any(Object));
	});

	it("does not roll at all without the move picked (no +HOME offered, traits stays empty)", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { playbookMoves: [] } }, update: vi.fn() };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: DRAW_YOUR_BATH.key } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});
});
