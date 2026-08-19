import { describe, expect, it } from "vitest";
import { DIVISION_KINDS, findDivisionKind } from "../scripts/world-actors/division-kinds.js";

describe("DIVISION_KINDS", () => {
	it("gives every entry a key, label, passive, and non-empty active list", () => {
		for (const kind of DIVISION_KINDS) {
			expect(typeof kind.key).toBe("string");
			expect(typeof kind.label).toBe("string");
			expect(typeof kind.passive).toBe("string");
			expect(Array.isArray(kind.active)).toBe(true);
			expect(kind.active.length).toBeGreaterThan(0);
		}
	});

	it("has unique keys", () => {
		const keys = DIVISION_KINDS.map((kind) => kind.key);

		expect(new Set(keys).size).toBe(keys.length);
	});
});

describe("findDivisionKind", () => {
	it("resolves a real key to its catalog entry", () => {
		const key = DIVISION_KINDS[0].key;

		expect(findDivisionKind(key)).toBe(DIVISION_KINDS[0]);
	});

	it("returns null for an unknown key", () => {
		expect(findDivisionKind("not-a-real-kind")).toBeNull();
	});

	it("returns null for an empty key", () => {
		expect(findDivisionKind("")).toBeNull();
	});
});
