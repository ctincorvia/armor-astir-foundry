import { beforeEach, describe, expect, it, vi } from "vitest";
import { APPROACHES, PLAYBOOK_APPROACHES, availableApproaches, chooseApproachOverride } from "../scripts/core/approaches.js";

beforeEach(() => {
	Dialog.mockClear();
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
	});
});

describe("APPROACHES", () => {
	it("lists the five approaches", () => {
		expect(APPROACHES.map((a) => a.key)).toEqual(["mundane", "arcane", "divine", "profane", "elemental"]);
	});
});

describe("availableApproaches", () => {
	it("restricts The Scout and The Commander to Mundane", () => {
		expect(availableApproaches("the-scout").map((a) => a.key)).toEqual(["mundane"]);
		expect(availableApproaches("the-commander").map((a) => a.key)).toEqual(["mundane"]);
	});

	it("restricts The Impostor to Arcane or Elemental", () => {
		expect(availableApproaches("the-impostor").map((a) => a.key)).toEqual(["arcane", "elemental"]);
	});

	it("restricts The Arcanist to Arcane or Elemental", () => {
		expect(availableApproaches("the-arcanist").map((a) => a.key)).toEqual(["arcane", "elemental"]);
	});

	it("restricts The Witch to Arcane or Profane", () => {
		expect(availableApproaches("the-witch").map((a) => a.key)).toEqual(["arcane", "profane"]);
	});

	it("restricts The Wither to Profane", () => {
		expect(availableApproaches("the-wither").map((a) => a.key)).toEqual(["profane"]);
	});

	it("restricts The Adrift to Mundane", () => {
		expect(availableApproaches("the-adrift").map((a) => a.key)).toEqual(["mundane"]);
	});

	it("restricts The Advocate to Elemental", () => {
		expect(availableApproaches("the-advocate").map((a) => a.key)).toEqual(["elemental"]);
	});

	it("restricts The Revenant to Profane or Divine", () => {
		// availableApproaches filters APPROACHES in APPROACHES' own declared order (mundane, arcane,
		// divine, profane, elemental), not PLAYBOOK_APPROACHES' own key order — divine sorts ahead
		// of profane there.
		expect(availableApproaches("the-revenant").map((a) => a.key)).toEqual(["divine", "profane"]);
	});

	it("restricts The Summoner to Elemental or Profane", () => {
		expect(availableApproaches("the-summoner").map((a) => a.key)).toEqual(["profane", "elemental"]);
	});

	it("restricts The Icon to Mundane", () => {
		expect(availableApproaches("the-icon").map((a) => a.key)).toEqual(["mundane"]);
	});

	it("restricts The Attendant to Mundane", () => {
		expect(availableApproaches("the-attendant").map((a) => a.key)).toEqual(["mundane"]);
	});

	it("restricts The Captain to Mundane", () => {
		expect(availableApproaches("the-captain").map((a) => a.key)).toEqual(["mundane"]);
	});

	it("restricts The Artificer to Mundane", () => {
		expect(availableApproaches("the-artificer").map((a) => a.key)).toEqual(["mundane"]);
	});

	it("falls back to every approach for a playbook with no restriction entry", () => {
		expect(PLAYBOOK_APPROACHES["some-future-playbook"]).toBeUndefined();
		expect(availableApproaches("some-future-playbook")).toEqual(APPROACHES);
	});
});

// Chromatic Focus/Chromatic Reserves' own Activate button (see astir-parts.js/ardent.js's
// promptsApproachOverride) — mirrors carrier-actor-sheet.js's chooseCarrier exactly (promise/
// Dialog/resolve-null shape, one labelled button per option), tested the same way tests/astir.test.js
// and tests/ardent.test.js already test their own Dialog-based pickers.
describe("chooseApproachOverride", () => {
	it("opens a Dialog with one labelled button per Approach except the excluded one", () => {
		chooseApproachOverride("mundane");

		const dialogData = Dialog.mock.calls.at(-1)[0];
		expect(dialogData.title).toBe("Swap Approach");
		expect(Object.keys(dialogData.buttons)).toEqual(["arcane", "divine", "profane", "elemental"]);
		expect(dialogData.buttons.arcane.label).toBe("Arcane");
	});

	it("resolves the clicked Approach's key", async () => {
		const promise = chooseApproachOverride("mundane");

		Dialog.mock.calls.at(-1)[0].buttons.profane.callback();

		expect(await promise).toBe("profane");
	});

	it("resolves null when the dialog is closed", async () => {
		const promise = chooseApproachOverride("mundane");

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});

	it("uses the module's own styling", () => {
		chooseApproachOverride("mundane");

		expect(Dialog.mock.calls.at(-1)[1]).toEqual({ classes: ["armor-astir"] });
	});
});
