import { describe, expect, it } from "vitest";
import {
	QUARTERS_BENEFITS,
	QUARTERS_BENEFIT_MAX,
	SUPPORT_PLAYBOOK_SLUGS,
	findQuartersBenefit,
	resolveQuartersBenefits
} from "../scripts/playbook/quarters.js";

const FIXTURE_BENEFITS = [
	{ key: "a", label: "A" },
	{ key: "b", label: "B" },
	{ key: "c", label: "C" }
];

describe("SUPPORT_PLAYBOOK_SLUGS", () => {
	it("contains exactly the seven confirmed Support playbook slugs", () => {
		expect(SUPPORT_PLAYBOOK_SLUGS).toEqual([
			"the-icon",
			"the-attendant",
			"the-commander",
			"the-captain",
			"the-diplomat",
			"the-artificer",
			"the-scout"
		]);
	});
});

describe("QUARTERS_BENEFIT_MAX", () => {
	it("is 2", () => {
		expect(QUARTERS_BENEFIT_MAX).toBe(2);
	});
});

describe("QUARTERS_BENEFITS", () => {
	it("has exactly 4 benefits, each with a key and label", () => {
		expect(QUARTERS_BENEFITS).toHaveLength(4);
		for (const benefit of QUARTERS_BENEFITS) {
			expect(benefit.key).toBeTruthy();
			expect(benefit.label).toBeTruthy();
		}
	});

	it("only extra-token carries a bonusDowntimeTokens field", () => {
		const withBonus = QUARTERS_BENEFITS.filter((benefit) => benefit.bonusDowntimeTokens);
		expect(withBonus.map((benefit) => benefit.key)).toEqual(["extra-token"]);
	});

	it("extra-token's bonusDowntimeTokens grants exactly 1", () => {
		const extraToken = QUARTERS_BENEFITS.find((benefit) => benefit.key === "extra-token");
		expect(extraToken.bonusDowntimeTokens.max).toBe(1);
		expect(extraToken.bonusDowntimeTokens.description).toBeTruthy();
	});
});

describe("findQuartersBenefit", () => {
	it("finds a benefit by key", () => {
		expect(findQuartersBenefit("b", FIXTURE_BENEFITS).label).toBe("B");
	});

	it("returns null for an unknown key", () => {
		expect(findQuartersBenefit("nope", FIXTURE_BENEFITS)).toBeNull();
	});

	it("resolves against the real catalog by default", () => {
		expect(findQuartersBenefit("extra-token").label).toBe(QUARTERS_BENEFITS[0].label);
	});
});

describe("resolveQuartersBenefits", () => {
	it("resolves stored keys to benefit definitions in order", () => {
		const benefits = resolveQuartersBenefits(["b", "a"], FIXTURE_BENEFITS);
		expect(benefits.map((b) => b.key)).toEqual(["b", "a"]);
	});

	it("drops a key that no longer resolves, rather than yielding a hole", () => {
		const benefits = resolveQuartersBenefits(["a", "deleted"], FIXTURE_BENEFITS);
		expect(benefits.map((b) => b.key)).toEqual(["a"]);
	});

	it("defaults to an empty list when no keys are given", () => {
		expect(resolveQuartersBenefits()).toEqual([]);
	});
});
