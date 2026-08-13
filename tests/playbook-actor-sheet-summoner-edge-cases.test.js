import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { chooseSummonAlly } from "../scripts/playbook/playbook-sheet/summoner-mixin.js";
import { BINDING, EIDOLON_DRIVE, ENDURING_SUPPORT } from "./helpers/move-fixtures.js";

beforeEach(() => {
	Dialog.mockClear();
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
	});
});

describe("chooseSummonAlly", () => {
	const ally = { id: "a1", name: "Vex" };
	const unnamedAlly = { id: "a2" };

	it("opens a Dialog with one labelled button per ally", () => {
		chooseSummonAlly([ally, unnamedAlly]);

		const dialogData = Dialog.mock.calls.at(-1)[0];
		expect(dialogData.title).toBe("Summon an Ally");
		// Neither approach nor trait is set, so the label is just name + Power (defaulting to 0).
		expect(dialogData.buttons.a1.label).toBe("Vex (Power 0)");
		// Falls back to "Unnamed Ally" for an ally with no stored name.
		expect(dialogData.buttons.a2.label).toBe("Unnamed Ally (Power 0)");
	});

	it("joins approach and trait labels and reports the invested Power when both are set", () => {
		const fullAlly = { id: "a3", name: "Ossa", approach: "profane", trait: "talk", powerInvested: 2 };

		chooseSummonAlly([fullAlly]);

		const dialogData = Dialog.mock.calls.at(-1)[0];
		expect(dialogData.buttons.a3.label).toBe("Ossa — Profane, TALK (Power 2)");
	});

	it("resolves the clicked ally's id", async () => {
		const promise = chooseSummonAlly([ally]);

		Dialog.mock.calls.at(-1)[0].buttons.a1.callback();

		expect(await promise).toBe("a1");
	});

	it("resolves null when the dialog is closed", async () => {
		const promise = chooseSummonAlly([ally]);

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});

	it("uses the module's own styling", () => {
		chooseSummonAlly([ally]);

		expect(Dialog.mock.calls.at(-1)[1]).toEqual({ classes: ["armor-astir"] });
	});
});

describe("PlaybookActorSheet#_boundAlliesData - missing ally name falls back to an empty string", () => {
	it("maps an ally with no stored name to an empty string, not undefined", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [BINDING.key], boundAllies: [{ id: "a1" }] } }
		};

		expect(sheet._boundAlliesData().list[0].name).toBe("");
	});
});

describe("PlaybookActorSheet#_onBoundAllyInvestPower - nullish defaults", () => {
	it("treats a missing Astir Power as 0 (no Power to invest)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", powerInvested: 0 }], astir: {} } },
			update: vi.fn()
		};

		sheet._onBoundAllyInvestPower({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing ally powerInvested as 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1" }], astir: { power: 2 } } },
			update: vi.fn()
		};

		sheet._onBoundAllyInvestPower({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.boundAllies": [{ id: "a1", powerInvested: 1 }],
			"system.attributes.astir.power": 1
		});
	});
});

describe("PlaybookActorSheet#_onBoundAllyRelease - nullish defaults", () => {
	it("treats missing Astir parts/power as their own defaults when refunding", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", powerInvested: 2 }], astir: {}, equipment: [] } },
			update: vi.fn()
		};

		sheet._onBoundAllyRelease({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.boundAllies": [],
			// astirMaxPower([], []) = 4 (base, no parts); 0 (missing power) + 2 invested = 2.
			"system.attributes.astir.power": 2
		});
	});
});

describe("PlaybookActorSheet#_onDowntimeAllyInvestPower - nullish defaults", () => {
	it("treats a missing Astir Power as 0 (no Power to invest)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "Pip", powerInvested: 0 }, astir: {} } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyInvestPower();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing Downtime Ally powerInvested as 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "Pip" }, astir: { power: 2 } } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyInvestPower();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.downtimeAlly.powerInvested": 1,
			"system.attributes.astir.power": 1
		});
	});
});

describe("PlaybookActorSheet#_onDowntimeAllyRelease - nullish defaults", () => {
	it("treats missing Astir parts/power as their own defaults when refunding", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "Pip", powerInvested: 2 }, astir: {}, equipment: [] } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyRelease();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.downtimeAlly": null,
			"system.attributes.astir.power": 2
		});
	});
});

describe("PlaybookActorSheet#_onEidolonDriveSummon - nullish defaults", () => {
	it("treats a missing ally powerInvested and missing Astir parts/power as their own defaults", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", name: "Vex" }], astir: {}, equipment: [] } },
			update: vi.fn()
		};

		await sheet._onEidolonDriveSummon({ currentTarget: { dataset: { move: EIDOLON_DRIVE.key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.eidolonDrive": { summonedAllyId: "a1", bonusUsed: false },
			// Math.max(0, (missing powerInvested = 0) - 1) = 0.
			"system.attributes.boundAllies": [{ id: "a1", name: "Vex", powerInvested: 0 }],
			// astirMaxPower([], []) = 4; (missing power = 0) + 1 = 1.
			"system.attributes.astir.power": 1
		});
	});
});

describe("PlaybookActorSheet#_moveTraits - Eidolon Drive ally trait label fallback", () => {
	it("falls back to the raw trait key when it doesn't match a known TRAITS entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", trait: "not-a-real-trait" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			}
		};

		const traits = sheet._moveTraits({ traits: [] });

		expect(traits).toContainEqual({ key: "eidolon-drive-ally", label: "Vex (not-a-real-trait)", value: 3 });
	});
});

// Enduring Support (Summoner) — a *dynamic* per-roll Approach override, snapshotted at Activate
// time into system.attributes.approachOverride (see moves-mixin.js's _onMoveActivate), resolved by
// _effectiveApproach (progression-mixin.js) ahead of BOTH a mounted frame's own Approach and the
// Attendant's own static grantsApproachOverride (Eidolon Drive normally requires piloting the Astir
// to summon in the first place, so checking the frame first would make this override unreachable in
// the common case). Mirrors the exact result shape playbook-actor-sheet-attendant.test.js's
// Signed & Sealed tests already use, for consistency.
describe("PlaybookActorSheet#_effectiveApproach - Enduring Support", () => {
	it("overrides to the snapshotted approach with Enduring Support picked and an active override", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					approach: "mundane",
					playbookMoves: [ENDURING_SUPPORT.key],
					approachOverride: { approach: "profane" }
				}
			}
		};

		expect(sheet._effectiveApproach()).toEqual({
			base: "mundane",
			effective: "profane",
			effectiveLabel: "Profane",
			fromFrame: false,
			fromMove: true,
			moveName: ENDURING_SUPPORT.name
		});
	});

	it("falls back to the raw key when the snapshotted approach doesn't match a known APPROACHES entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					approach: "mundane",
					playbookMoves: [ENDURING_SUPPORT.key],
					approachOverride: { approach: "not-a-real-approach" }
				}
			}
		};

		expect(sheet._effectiveApproach()).toEqual({
			base: "mundane",
			effective: "not-a-real-approach",
			effectiveLabel: "not-a-real-approach",
			fromFrame: false,
			fromMove: true,
			moveName: ENDURING_SUPPORT.name
		});
	});

	it("ignores a stored override when Enduring Support isn't picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					approach: "mundane",
					playbookMoves: [],
					approachOverride: { approach: "profane" }
				}
			}
		};

		expect(sheet._effectiveApproach()).toEqual({
			base: "mundane",
			effective: "mundane",
			effectiveLabel: "Mundane",
			fromFrame: false
		});
	});

	it("lets an active Enduring Support override win even while a frame is mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					approach: "mundane",
					playbookMoves: [ENDURING_SUPPORT.key],
					approachOverride: { approach: "profane" },
					astir: { id: "a1", approach: "elemental", tier: 3, power: 4, parts: [], piloted: true }
				}
			}
		};

		expect(sheet._effectiveApproach()).toEqual({
			base: "mundane",
			effective: "profane",
			effectiveLabel: "Profane",
			fromFrame: false,
			fromMove: true,
			moveName: ENDURING_SUPPORT.name
		});
	});
});
