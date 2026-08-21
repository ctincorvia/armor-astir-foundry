import { describe, expect, it } from "vitest";
import { FACTION_KINDS, findFactionKind } from "../scripts/world-actors/faction-kinds.js";

describe("FACTION_KINDS", () => {
	it("gives every entry a key, label, opposes, and outcome", () => {
		for (const kind of FACTION_KINDS) {
			expect(typeof kind.key).toBe("string");
			expect(typeof kind.label).toBe("string");
			expect(typeof kind.opposes).toBe("string");
			expect(typeof kind.outcome).toBe("string");
		}
	});

	it("has unique keys", () => {
		const keys = FACTION_KINDS.map((kind) => kind.key);

		expect(new Set(keys).size).toBe(keys.length);
	});

	it("holds the ten real Faction kinds, not placeholder content", () => {
		expect(FACTION_KINDS.map((kind) => kind.key)).toEqual([
			"guerrillas",
			"agents",
			"bandits",
			"despoilers",
			"scholars",
			"suppliers",
			"firebrands",
			"military",
			"strange",
			"adventurers"
		]);
		for (const kind of FACTION_KINDS) {
			expect(kind.opposes).not.toContain("TODO");
			expect(kind.outcome).not.toContain("TODO");
		}
	});
});

describe("findFactionKind", () => {
	it("resolves a real key to its catalog entry", () => {
		const key = FACTION_KINDS[0].key;

		expect(findFactionKind(key)).toBe(FACTION_KINDS[0]);
	});

	it("returns null for an unknown key", () => {
		expect(findFactionKind("not-a-real-kind")).toBeNull();
	});

	it("returns null for an empty key", () => {
		expect(findFactionKind("")).toBeNull();
	});
});
