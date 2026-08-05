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

// findCarrierActors defaults to no Carriers in the world — same mock playbook-actor-sheet-
// commander.test.js applies, needed here since getData's move-trait resolution reaches it
// regardless of which feature is under test.
vi.mock("../scripts/world-actors/carrier-actor-sheet.js", async (importOriginal) => ({
	...(await importOriginal()),
	findCarrierActors: vi.fn(() => [])
}));

vi.mock("../scripts/playbook/witch.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseWitchBoons: vi.fn()
}));

import { configureEquipment } from "../scripts/equipment/equipment.js";
import { chooseAstirPart, chooseAstirWeapon } from "../scripts/frames/astir.js";
import { findCarrierActors } from "../scripts/world-actors/carrier-actor-sheet.js";
import { WITCH_BOONS, chooseWitchBoons } from "../scripts/playbook/witch.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

beforeEach(() => {
	chooseAstirPart.mockReset();
	chooseAstirWeapon.mockReset();
	configureEquipment.mockReset();
	chooseWitchBoons.mockReset();
	findCarrierActors.mockClear();
	findCarrierActors.mockReturnValue([]);
	foundry.utils.randomID.mockReturnValue("test-id");
});

describe("PlaybookActorSheet#getData - isWitch", () => {
	it("is true only for the Witch playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-witch" } } };

		expect(sheet.getData().isWitch).toBe(true);
	});

	it("is false for every other playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-scout" } } };

		expect(sheet.getData().isWitch).toBe(false);
	});

	it("is false with no playbook set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		expect(sheet.getData().isWitch).toBe(false);
	});
});

describe("PlaybookActorSheet#_witchData / getData.witch", () => {
	it("exposes influence and every catalog boon, flagging the held ones", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { witch: { influence: 2, boons: ["witch-boon:masking"] } } }
		};

		const data = sheet._witchData();

		expect(data.influence).toBe(2);
		expect(data.boons).toHaveLength(WITCH_BOONS.length);
		expect(data.boons.find((b) => b.key === "witch-boon:masking").held).toBe(true);
		expect(data.boons.find((b) => b.key === "witch-boon:tenacious").held).toBe(false);
	});

	it("defaults influence to 0 and every boon to unheld", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet._witchData();

		expect(data.influence).toBe(0);
		expect(data.boons.every((b) => !b.held)).toBe(true);
		expect(data.canChooseBoons).toBe(false);
	});

	it("canChooseBoons is true once Whims is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: ["the-witch:whims"] } }
		};

		expect(sheet._witchData().canChooseBoons).toBe(true);
	});

	it("getData.witch matches _witchData's own output, computed regardless of playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { slug: "the-scout" }, attributes: { witch: { influence: 1, boons: [] } } }
		};

		expect(sheet.getData().witch).toEqual(sheet._witchData());
	});
});

describe("PlaybookActorSheet#_onWitchInfluenceStep", () => {
	it("increments influence", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { witch: { influence: 0 } } }, update: vi.fn() };

		sheet._onWitchInfluenceStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.witch.influence": 1 });
	});

	it("is uncapped upward", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { witch: { influence: 10 } } }, update: vi.fn() };

		sheet._onWitchInfluenceStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.witch.influence": 11 });
	});

	it("clamps at a floor of 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { witch: { influence: 0 } } }, update: vi.fn() };

		sheet._onWitchInfluenceStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onWitchBoonsChoose", () => {
	it("does nothing when the picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { witch: { boons: [] } } }, update: vi.fn() };
		chooseWitchBoons.mockResolvedValue(null);

		await sheet._onWitchBoonsChoose();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when nothing was checked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { witch: { boons: [] } } }, update: vi.fn() };
		chooseWitchBoons.mockResolvedValue([]);

		await sheet._onWitchBoonsChoose();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("adds the chosen boons, offering the current held list to the picker", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { witch: { boons: [] } } }, update: vi.fn() };
		chooseWitchBoons.mockResolvedValue(["witch-boon:masking", "witch-boon:shielding"]);

		await sheet._onWitchBoonsChoose();

		expect(chooseWitchBoons).toHaveBeenCalledWith(WITCH_BOONS, 2, []);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.witch.boons": ["witch-boon:masking", "witch-boon:shielding"]
		});
	});

	it("dedupes against already-held boons on merge", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { witch: { boons: ["witch-boon:masking"] } } }, update: vi.fn() };
		chooseWitchBoons.mockResolvedValue(["witch-boon:masking", "witch-boon:shielding"]);

		await sheet._onWitchBoonsChoose();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.witch.boons": ["witch-boon:masking", "witch-boon:shielding"]
		});
	});
});

describe("PlaybookActorSheet#_grantRandomWitchBoons", () => {
	it("replaces already-held boons with exactly 2 new ones, rather than adding to them", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					witch: {
						boons: ["witch-boon:masking", "witch-boon:shielding", "witch-boon:tenacious"]
					}
				}
			},
			update: vi.fn()
		};

		await sheet._grantRandomWitchBoons();

		expect(sheet.actor.update).toHaveBeenCalledTimes(1);
		const [update] = sheet.actor.update.mock.calls[0];
		const granted = update["system.attributes.witch.boons"];
		expect(granted).toHaveLength(2);
		expect(granted.every((key) => WITCH_BOONS.some((boon) => boon.key === key))).toBe(true);
	});

	it("grants exactly 2 boons when none are held", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { witch: { boons: [] } } }, update: vi.fn() };

		await sheet._grantRandomWitchBoons();

		expect(sheet.actor.update).toHaveBeenCalledTimes(1);
		const [update] = sheet.actor.update.mock.calls[0];
		expect(update["system.attributes.witch.boons"]).toHaveLength(2);
	});
});

describe("PlaybookActorSheet#_onWitchBoonsRelinquish", () => {
	it("clears held boons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { witch: { boons: ["witch-boon:masking"] } } }, update: vi.fn() };

		sheet._onWitchBoonsRelinquish();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.witch.boons": [] });
	});

	it("is a no-op when nothing is held", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { witch: { boons: [] } } }, update: vi.fn() };

		sheet._onWitchBoonsRelinquish();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});
