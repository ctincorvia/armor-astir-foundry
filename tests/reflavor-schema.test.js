import { afterEach, describe, expect, it } from "vitest";

import { ASTIR_WEAPON_CATALOG } from "../scripts/frames/astir-weapons.js";
import { ARDENT_FEATURE_WEAPONS } from "../scripts/frames/ardent.js";
import { REFLAVOR_SECTIONS, resolveSectionCatalog } from "../scripts/reflavor/reflavor-schema.js";
import { applyCustomContent, resetCustomContent } from "../scripts/custom-content/custom-content-apply.js";
import { resetToBaseline } from "../scripts/reflavor/reflavor-apply.js";

afterEach(() => {
	resetCustomContent();
	resetToBaseline();
});

describe("resolveSectionCatalog", () => {
	it("returns a plain-array section's catalog unchanged", () => {
		expect(resolveSectionCatalog(REFLAVOR_SECTIONS.equipment)).toBe(REFLAVOR_SECTIONS.equipment.catalog);
	});

	it("calls a function-shaped section's catalog and returns its result", () => {
		const resolved = resolveSectionCatalog(REFLAVOR_SECTIONS.astirWeapons);

		expect(typeof REFLAVOR_SECTIONS.astirWeapons.catalog).toBe("function");
		expect(resolved).toEqual(expect.arrayContaining([...ASTIR_WEAPON_CATALOG, ...ARDENT_FEATURE_WEAPONS]));
	});

	it("astirWeapons re-spreads fresh on every call, so a weapon added after load is included", () => {
		applyCustomContent({
			astirWeapons: [{ key: "custom:storm-lance", name: "Storm Lance", description: "...", tags: ["melee"] }]
		});

		const resolved = resolveSectionCatalog(REFLAVOR_SECTIONS.astirWeapons);

		expect(resolved.some((weapon) => weapon.key === "custom:storm-lance")).toBe(true);
	});
});
