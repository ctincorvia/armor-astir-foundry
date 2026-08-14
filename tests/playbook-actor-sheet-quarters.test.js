import { beforeEach, describe, expect, it, vi } from "vitest";

import { SUPPORT_PLAYBOOK_SLUGS, QUARTERS_BENEFITS } from "../scripts/playbook/quarters.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

beforeEach(() => {
	game.actors.filter.mockReset();
	game.actors.filter.mockImplementation(() => []);
});

describe("PlaybookActorSheet#getData - isSupport", () => {
	it.each(SUPPORT_PLAYBOOK_SLUGS)("is true for %s", (slug) => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug } } };

		expect(sheet.getData().isSupport).toBe(true);
	});

	it("is false for a non-Support playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-witch" } } };

		expect(sheet.getData().isSupport).toBe(false);
	});

	it("is false with no playbook set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		expect(sheet.getData().isSupport).toBe(false);
	});
});

describe("PlaybookActorSheet#_quartersData", () => {
	it("defaults name/description to empty and every benefit unchecked/enabled with nothing stored", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet._quartersData();

		expect(data.name).toBe("");
		expect(data.description).toBe("");
		expect(data.benefits).toEqual(
			QUARTERS_BENEFITS.map((b) => ({ key: b.key, label: b.label, checked: false, disabled: false }))
		);
	});

	it("reflects stored name/description and marks picked benefits checked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					quarters: { name: "The Nook", description: "A quiet corner.", benefits: ["extra-token"] }
				}
			}
		};

		const data = sheet._quartersData();

		expect(data.name).toBe("The Nook");
		expect(data.description).toBe("A quiet corner.");
		expect(data.benefits.find((b) => b.key === "extra-token")).toEqual({
			key: "extra-token",
			label: QUARTERS_BENEFITS[0].label,
			checked: true,
			disabled: false
		});
	});

	it("disables every unpicked benefit once QUARTERS_BENEFIT_MAX (2) are picked", () => {
		const sheet = new PlaybookActorSheet();
		const picked = ["extra-token", "cheap-advancement"];
		sheet.actor = { system: { attributes: { quarters: { benefits: picked } } } };

		const data = sheet._quartersData();

		for (const benefit of data.benefits) {
			if (picked.includes(benefit.key)) {
				expect(benefit.checked).toBe(true);
				expect(benefit.disabled).toBe(false);
			} else {
				expect(benefit.checked).toBe(false);
				expect(benefit.disabled).toBe(true);
			}
		}
	});

	it("reports showCarrierSelect false with no Carrier in the world", () => {
		game.actors.filter.mockImplementation(() => []);
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._quartersData().showCarrierSelect).toBe(false);
		expect(sheet._quartersData().carrierOptions).toEqual([]);
	});

	it("reports showCarrierSelect false with exactly 1 Carrier in the world", () => {
		game.actors.filter.mockImplementation((fn) => [{ id: "c1", name: "The Wanderer", type: "armor-astir.carrier" }].filter(fn));
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._quartersData().showCarrierSelect).toBe(false);
	});

	it("reports showCarrierSelect true with 2+ Carriers, listing each as an option", () => {
		const carrier1 = { id: "c1", name: "The Wanderer", type: "armor-astir.carrier" };
		const carrier2 = { id: "c2", name: "The Anchor", type: "armor-astir.carrier" };
		game.actors.filter.mockImplementation((fn) => [carrier1, carrier2].filter(fn));
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { carrierId: "c2" } } };

		const data = sheet._quartersData();

		expect(data.showCarrierSelect).toBe(true);
		expect(data.carrierOptions).toEqual([{ id: "c1", name: "The Wanderer" }, { id: "c2", name: "The Anchor" }]);
		expect(data.carrierId).toBe("c2");
	});

	it("defaults carrierId to empty string when unset", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._quartersData().carrierId).toBe("");
	});

	it("falls back to empty description and no picked benefits for a stored Quarters object missing those fields", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { quarters: { name: "Only Name" } } } };

		const data = sheet._quartersData();

		expect(data.name).toBe("Only Name");
		expect(data.description).toBe("");
		expect(data.benefits.every((b) => b.checked === false && b.disabled === false)).toBe(true);
	});
});

describe("PlaybookActorSheet#_quartersExtraTokenSource", () => {
	it("returns null when extra-token isn't picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { quarters: { benefits: ["cheap-advancement"] } } } };

		expect(sheet._quartersExtraTokenSource()).toBeNull();
	});

	it("returns null with no Quarters at all", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._quartersExtraTokenSource()).toBeNull();
	});

	it("returns null when a stored Quarters object has no benefits field", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { quarters: { name: "The Nook" } } } };

		expect(sheet._quartersExtraTokenSource()).toBeNull();
	});

	it("returns the keyed source, name falling back to Quarters when unnamed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { quarters: { benefits: ["extra-token"] } } } };

		expect(sheet._quartersExtraTokenSource()).toEqual({
			key: "quarters:extra-token",
			name: "Quarters",
			bonusDowntimeTokens: QUARTERS_BENEFITS[0].bonusDowntimeTokens
		});
	});

	it("uses the Quarters' own stored name when set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { quarters: { name: "The Nook", benefits: ["extra-token"] } } }
		};

		expect(sheet._quartersExtraTokenSource().name).toBe("The Nook");
	});
});

describe("PlaybookActorSheet#_onQuartersNameChange", () => {
	it("writes the trimmed name", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onQuartersNameChange({ currentTarget: { value: "  The Nook  " } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.quarters.name": "The Nook" });
	});
});

describe("PlaybookActorSheet#_onQuartersDescriptionChange", () => {
	it("writes the trimmed description", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onQuartersDescriptionChange({ currentTarget: { value: "  A quiet corner.  " } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.quarters.description": "A quiet corner."
		});
	});
});

describe("PlaybookActorSheet#_onQuartersBenefitToggle", () => {
	it("adds a benefit key when checked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { quarters: { benefits: [] } } }, update: vi.fn() };

		sheet._onQuartersBenefitToggle({ currentTarget: { checked: true, dataset: { benefit: "extra-token" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.quarters.benefits": ["extra-token"]
		});
	});

	it("removes a benefit key when unchecked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { quarters: { benefits: ["extra-token", "cheap-advancement"] } } },
			update: vi.fn()
		};

		sheet._onQuartersBenefitToggle({ currentTarget: { checked: false, dataset: { benefit: "extra-token" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.quarters.benefits": ["cheap-advancement"]
		});
	});

	it("does not duplicate an already-picked key", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { quarters: { benefits: ["extra-token"] } } }, update: vi.fn() };

		sheet._onQuartersBenefitToggle({ currentTarget: { checked: true, dataset: { benefit: "extra-token" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.quarters.benefits": ["extra-token"]
		});
	});

	it("reverts the checkbox and does not update the actor when a 3rd benefit is checked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { quarters: { benefits: ["extra-token", "cheap-advancement"] } } },
			update: vi.fn()
		};
		const event = { currentTarget: { checked: true, dataset: { benefit: "increase-crew" } } };

		sheet._onQuartersBenefitToggle(event);

		expect(event.currentTarget.checked).toBe(false);
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("still allows unchecking one of two picked benefits at the cap", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { quarters: { benefits: ["extra-token", "cheap-advancement"] } } },
			update: vi.fn()
		};

		sheet._onQuartersBenefitToggle({ currentTarget: { checked: false, dataset: { benefit: "extra-token" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.quarters.benefits": ["cheap-advancement"]
		});
	});

	it("treats a missing benefits array as empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onQuartersBenefitToggle({ currentTarget: { checked: true, dataset: { benefit: "extra-token" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.quarters.benefits": ["extra-token"]
		});
	});

	it("treats a stored Quarters object with no benefits field as an empty list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { quarters: { name: "Only Name" } } }, update: vi.fn() };

		sheet._onQuartersBenefitToggle({ currentTarget: { checked: true, dataset: { benefit: "extra-token" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.quarters.benefits": ["extra-token"]
		});
	});

	it("does not revert or update when re-checking an already-picked benefit at the cap", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { quarters: { benefits: ["extra-token", "cheap-advancement"] } } },
			update: vi.fn()
		};
		const event = { currentTarget: { checked: true, dataset: { benefit: "extra-token" } } };

		sheet._onQuartersBenefitToggle(event);

		expect(event.currentTarget.checked).toBe(true);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.quarters.benefits": ["extra-token", "cheap-advancement"]
		});
	});
});

describe("PlaybookActorSheet#_onQuartersCarrierChange", () => {
	it("writes the selected Carrier id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onQuartersCarrierChange({ currentTarget: { value: "c2" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.carrierId": "c2" });
	});

	it("writes null when the select is cleared to the blank option", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { carrierId: "c1" } }, update: vi.fn() };

		sheet._onQuartersCarrierChange({ currentTarget: { value: "" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.carrierId": null });
	});
});

describe("PlaybookActorSheet#activateListeners - Quarters", () => {
	it("binds the four Quarters handlers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Icon" } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".quarters-name-input");
		expect(html.find).toHaveBeenCalledWith(".quarters-description-input");
		expect(html.find).toHaveBeenCalledWith(".quarters-benefit-checkbox");
		expect(html.find).toHaveBeenCalledWith(".quarters-carrier-select");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});
