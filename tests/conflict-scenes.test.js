import { describe, expect, it } from "vitest";

import { CONFLICT_SCENES, findConflictScene } from "../scripts/world-actors/conflict-scenes.js";

describe("CONFLICT_SCENES", () => {
	it("has a unique key per entry", () => {
		const keys = CONFLICT_SCENES.map((scene) => scene.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("gives every entry a name and non-empty summary/playing/challenges/resolutions text", () => {
		for (const scene of CONFLICT_SCENES) {
			expect(scene.name).toEqual(expect.any(String));
			for (const field of ["summary", "playing", "challenges", "resolutions"]) {
				expect(scene[field].length).toBeGreaterThan(0);
				expect(scene[field].every((line) => typeof line === "string" && line.length > 0)).toBe(true);
			}
		}
	});
});

describe("findConflictScene", () => {
	it("returns the matching entry by key", () => {
		expect(findConflictScene("an-unfurling-plan")).toBe(CONFLICT_SCENES.find((scene) => scene.key === "an-unfurling-plan"));
	});

	it("returns null for an unrecognized key", () => {
		expect(findConflictScene("not-a-real-scene")).toBeNull();
	});
});
