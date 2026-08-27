import { describe, expect, it } from "vitest";

import { DOWNTIME_SCENE_KINDS, findDowntimeSceneKind } from "../scripts/playbook/downtime-scenes.js";

describe("DOWNTIME_SCENE_KINDS", () => {
	it("has exactly 7 entries", () => {
		expect(DOWNTIME_SCENE_KINDS).toHaveLength(7);
	});

	it("has a unique key per entry", () => {
		const keys = DOWNTIME_SCENE_KINDS.map((kind) => kind.key);
		expect(new Set(keys).size).toBe(keys.length);
	});
});

describe("findDowntimeSceneKind", () => {
	it("returns the matching entry by key", () => {
		expect(findDowntimeSceneKind("fade")).toBe(DOWNTIME_SCENE_KINDS.find((kind) => kind.key === "fade"));
	});

	it("returns null for an unrecognized key", () => {
		expect(findDowntimeSceneKind("not-a-real-scene-kind")).toBeNull();
	});
});
