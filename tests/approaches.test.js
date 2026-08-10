import { describe, expect, it } from "vitest";
import { APPROACHES, PLAYBOOK_APPROACHES, availableApproaches } from "../scripts/core/approaches.js";

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

	it("falls back to every approach for a playbook with no restriction entry", () => {
		expect(PLAYBOOK_APPROACHES["some-future-playbook"]).toBeUndefined();
		expect(availableApproaches("some-future-playbook")).toEqual(APPROACHES);
	});
});
