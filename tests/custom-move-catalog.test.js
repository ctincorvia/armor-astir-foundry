import { describe, expect, it } from "vitest";

import { CUSTOM_MOVE_CATALOG } from "../scripts/moves/custom-move-catalog.js";

describe("CUSTOM_MOVE_CATALOG", () => {
	it("starts as an empty array", () => {
		expect(CUSTOM_MOVE_CATALOG).toEqual([]);
	});

	it("is a real mutable array", () => {
		expect(Array.isArray(CUSTOM_MOVE_CATALOG)).toBe(true);

		CUSTOM_MOVE_CATALOG.push({ key: "custom:fixture-move" });
		expect(CUSTOM_MOVE_CATALOG).toEqual([{ key: "custom:fixture-move" }]);

		expect(CUSTOM_MOVE_CATALOG.pop()).toEqual({ key: "custom:fixture-move" });
		expect(CUSTOM_MOVE_CATALOG).toEqual([]);
	});
});
