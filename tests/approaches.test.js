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

	it("falls back to every approach for a playbook with no restriction entry", () => {
		expect(PLAYBOOK_APPROACHES["some-future-playbook"]).toBeUndefined();
		expect(availableApproaches("some-future-playbook")).toEqual(APPROACHES);
	});
});
