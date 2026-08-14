import { describe, expect, it, vi } from "vitest";

import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { ADVANCEMENT_TOP, ADVANCEMENT_BOTTOM } from "../scripts/playbook/advancements.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { TRAITS } from "../scripts/core/traits.js";
import { ASTIR_PART_CATALOG } from "../scripts/frames/astir.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const ARCANE_AUGMENTS = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:arcane-augments");
const LET_LOOSE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:let-loose");
const PATRON = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-witch:patron");
const I_KNOW_YOU = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-revenant:i-know-you");
const MASTER_SERVANT = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-attendant:master-servant");
const INFORMATION_NETWORK = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-captain:information-network");
const STANDARDISED_PARTS = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:standardised-parts");

describe("PlaybookActorSheet#getData - traits", () => {
	it("defaults every trait to value 0, no bonus, and enabled when system.stats is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.traits).toEqual(
			TRAITS.map(({ key, label }) => ({ key, label, value: 0, bonus: 0, total: 0, disabled: false }))
		);
	});

	it("reflects each trait's stored value and disabled flag", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {
					defy: { value: 2 },
					channel: { value: 0, disabled: true }
				}
			}
		};

		const data = sheet.getData();

		expect(data.traits.find((t) => t.key === "defy")).toEqual({ key: "defy", label: "DEFY", value: 2, bonus: 0, total: 2, disabled: false });
		expect(data.traits.find((t) => t.key === "channel")).toEqual({ key: "channel", label: "CHANNEL", value: 0, bonus: 0, total: 0, disabled: true });
	});

	it("adds Arcane Augments' +1 CHANNEL per Danger into bonus/total, capped at +3", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 1 } },
				attributes: {
					playbookMoves: [ARCANE_AUGMENTS.key],
					dangers: [
						{ id: "1", type: "risk", label: "Exposed" },
						{ id: "2", type: "peril", label: "Cornered" },
						{ id: "3", type: "risk", label: "Followed" },
						{ id: "4", type: "risk", label: "Watched" }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.traits.find((t) => t.key === "channel")).toEqual({ key: "channel", label: "CHANNEL", value: 1, bonus: 3, total: 4, disabled: false });
	});

	it("adds Let Loose's uncapped per-Burden bonus to whichever Trait the player chose", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 0 } },
				attributes: {
					playbookMoves: [LET_LOOSE.key],
					burdens: [{ id: "1", label: "A" }, { id: "2", label: "B" }],
					traitBonusChoices: { [LET_LOOSE.key]: "sense" }
				}
			}
		};

		const data = sheet.getData();

		expect(data.traits.find((t) => t.key === "sense")).toEqual({ key: "sense", label: "SENSE", value: 0, bonus: 2, total: 2, disabled: false });
	});

	it("adds Patron's +1 CHANNEL once Influence reaches 1, with no other bonus on CHANNEL", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 2 } },
				attributes: { playbookMoves: [PATRON.key], witch: { influence: 1 } }
			}
		};

		const data = sheet.getData();

		expect(data.traits.find((t) => t.key === "channel")).toEqual({ key: "channel", label: "CHANNEL", value: 2, bonus: 1, total: 3, disabled: false });
	});

	it("stacks Patron's +1 CHANNEL on top of an existing CHANNEL bonus from another traitBonus move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 1 } },
				attributes: {
					playbookMoves: [PATRON.key, ARCANE_AUGMENTS.key],
					witch: { influence: 1 },
					dangers: [{ id: "1", type: "risk", label: "Exposed" }]
				}
			}
		};

		const data = sheet.getData();

		// Arcane Augments' own +1 per Danger (1 Danger here) plus Patron's flat +1.
		expect(data.traits.find((t) => t.key === "channel")).toEqual({ key: "channel", label: "CHANNEL", value: 1, bonus: 2, total: 3, disabled: false });
	});

	it("adds no Patron bonus below 1 Influence, even with Patron picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 2 } },
				attributes: { playbookMoves: [PATRON.key], witch: { influence: 0 } }
			}
		};

		const data = sheet.getData();

		expect(data.traits.find((t) => t.key === "channel")).toEqual({ key: "channel", label: "CHANNEL", value: 2, bonus: 0, total: 2, disabled: false });
	});

	it("omits allyBonus from every trait by default, with no ally summoned", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { talk: { value: 0 } } } };

		const data = sheet.getData();

		expect(data.traits.every((t) => !("allyBonus" in t))).toBe(true);
	});

	it("adds the summoned ally's own allyBonus (+3) to the trait row matching its trait", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { talk: { value: 0 } },
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", trait: "talk" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			}
		};

		const data = sheet.getData();

		expect(data.traits.find((t) => t.key === "talk").allyBonus).toBe(3);
	});

	it("drops the summoned ally's allyBonus to +1 once the one-time bonus has been used", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { talk: { value: 0 } },
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", trait: "talk" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: true }
				}
			}
		};

		const data = sheet.getData();

		expect(data.traits.find((t) => t.key === "talk").allyBonus).toBe(1);
	});

	it("leaves a different, non-matching trait row without allyBonus even with an ally summoned", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { talk: { value: 0 }, clash: { value: 0 } },
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", trait: "talk" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			}
		};

		const data = sheet.getData();

		expect("allyBonus" in data.traits.find((t) => t.key === "clash")).toBe(false);
	});

	it("appends a FAMILIARITY trait row reflecting the actor's own stat once I Know You is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 0 }, familiarity: { value: 1 } },
				attributes: { playbookMoves: [I_KNOW_YOU.key] }
			}
		};

		const data = sheet.getData();

		expect(data.traits.find((t) => t.key === "familiarity")).toEqual({
			key: "familiarity",
			label: "FAMILIARITY",
			value: 1,
			bonus: 0,
			total: 1,
			disabled: false
		});
	});

	it("defaults the FAMILIARITY trait row to 3 once I Know You is picked but system.stats.familiarity is absent", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { channel: { value: 0 } }, attributes: { playbookMoves: [I_KNOW_YOU.key] } }
		};

		const data = sheet.getData();

		expect(data.traits.find((t) => t.key === "familiarity")).toEqual({
			key: "familiarity",
			label: "FAMILIARITY",
			value: 3,
			bonus: 0,
			total: 3,
			disabled: false
		});
	});

	it("omits the FAMILIARITY trait row when I Know You isn't picked, even for another Revenant move", () => {
		const sheet = new PlaybookActorSheet();
		const NEVER_QUITE_FREE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-revenant:never-quite-free");
		sheet.actor = {
			system: {
				stats: { channel: { value: 0 } },
				attributes: { playbookMoves: [NEVER_QUITE_FREE.key] }
			}
		};

		const data = sheet.getData();

		expect(data.traits.find((t) => t.key === "familiarity")).toBeUndefined();
	});
});

describe("PlaybookActorSheet#getData - advancements", () => {
	it("defaults every top and bottom item to unchecked when attributes are missing", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.advancements.top.every((item) => item.checked === false)).toBe(true);
		expect(data.advancements.bottom.every((item) => item.checked === false)).toBe(true);
	});

	it("defaults topCount to 0 and unlocked to false when nothing is checked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.advancements.topCount).toBe(0);
		expect(data.advancements.unlocked).toBe(false);
	});

	it("reflects a stored true value on the matching top item only", () => {
		const key = ADVANCEMENT_TOP[1].key;
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { advancements: { [key]: true } } } };

		const data = sheet.getData();

		expect(data.advancements.top.find((item) => item.key === key).checked).toBe(true);
		expect(
			data.advancements.top.filter((item) => item.key !== key).every((item) => item.checked === false)
		).toBe(true);
	});

	it("counts exactly the checked top keys", () => {
		const sheet = new PlaybookActorSheet();
		const advancements = { [ADVANCEMENT_TOP[0].key]: true, [ADVANCEMENT_TOP[1].key]: true };
		sheet.actor = { system: { stats: {}, attributes: { advancements } } };

		const data = sheet.getData();

		expect(data.advancements.topCount).toBe(2);
	});

	it("keeps the bottom group locked when topCount is one below the threshold", () => {
		const sheet = new PlaybookActorSheet();
		const advancements = {};
		ADVANCEMENT_TOP.slice(0, 2).forEach((item) => {
			advancements[item.key] = true;
		});
		sheet.actor = { system: { stats: {}, attributes: { advancements } } };

		const data = sheet.getData();

		expect(data.advancements.topCount).toBe(2);
		expect(data.advancements.unlocked).toBe(false);
		expect(data.advancements.bottom.every((item) => item.locked === true)).toBe(true);
	});

	it("unlocks the bottom group once topCount reaches the threshold", () => {
		const sheet = new PlaybookActorSheet();
		const advancements = {};
		ADVANCEMENT_TOP.slice(0, 3).forEach((item) => {
			advancements[item.key] = true;
		});
		sheet.actor = { system: { stats: {}, attributes: { advancements } } };

		const data = sheet.getData();

		expect(data.advancements.topCount).toBe(3);
		expect(data.advancements.unlocked).toBe(true);
		expect(data.advancements.bottom.every((item) => item.locked === false)).toBe(true);
	});

	it("stays unlocked when every top item is checked", () => {
		const sheet = new PlaybookActorSheet();
		const advancements = {};
		ADVANCEMENT_TOP.forEach((item) => {
			advancements[item.key] = true;
		});
		sheet.actor = { system: { stats: {}, attributes: { advancements } } };

		const data = sheet.getData();

		expect(data.advancements.topCount).toBe(ADVANCEMENT_TOP.length);
		expect(data.advancements.unlocked).toBe(true);
	});

	it("keeps a bottom item's stored checked state even while its row is locked", () => {
		const bottomKey = ADVANCEMENT_BOTTOM[0].key;
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { advancements: { [bottomKey]: true } } } };

		const data = sheet.getData();

		expect(data.advancements.unlocked).toBe(false);
		const item = data.advancements.bottom.find((entry) => entry.key === bottomKey);
		expect(item.checked).toBe(true);
		expect(item.locked).toBe(true);
	});

	it("exposes the unlock threshold", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.advancements.unlockThreshold).toBe(3);
	});
});

describe("PlaybookActorSheet#activateListeners - advancements", () => {
	it("binds a change handler to the advancement checkboxes", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".advancement-checkbox");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onAdvancementToggle", () => {
	it("writes true to the matching top advancement key when checked", () => {
		const key = ADVANCEMENT_TOP[0].key;
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAdvancementToggle({ currentTarget: { checked: true, dataset: { advancementKey: key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ [`system.attributes.advancements.${key}`]: true });
	});

	it("writes false to the matching top advancement key when unchecked", () => {
		const key = ADVANCEMENT_TOP[0].key;
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { advancements: { [key]: true } } }, update: vi.fn() };

		sheet._onAdvancementToggle({ currentTarget: { checked: false, dataset: { advancementKey: key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ [`system.attributes.advancements.${key}`]: false });
	});

	it("writes to the matching bottom advancement key", () => {
		const key = ADVANCEMENT_BOTTOM[0].key;
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAdvancementToggle({ currentTarget: { checked: true, dataset: { advancementKey: key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ [`system.attributes.advancements.${key}`]: true });
	});
});

describe("PlaybookActorSheet#getData - spotlight", () => {
	it("defaults to value 0 with every step unfilled when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.spotlight).toEqual({
			value: 0,
			steps: [1, 2, 3, 4, 5, 6].map((step) => ({ step, filled: false }))
		});
	});

	it("reflects the actor's stored spotlight value, filling steps up to it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 3 } } } };

		const data = sheet.getData();

		expect(data.spotlight).toEqual({
			value: 3,
			steps: [
				{ step: 1, filled: true },
				{ step: 2, filled: true },
				{ step: 3, filled: true },
				{ step: 4, filled: false },
				{ step: 5, filled: false },
				{ step: 6, filled: false }
			]
		});
	});
});

describe("PlaybookActorSheet#activateListeners - spotlight step", () => {
	it("binds a click handler to the spotlight step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".spotlight-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onSpotlightStep", () => {
	it("fills the track up to a clicked step above the current value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 1 } } }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "4" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 4 });
	});

	it("empties the track down to a clicked step below the current value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 5 } } }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "2" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 2 });
	});

	it("decrements by one when clicking the current top (highest filled) step", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 3 } } }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "3" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 2 });
	});

	it("clears to 0 when clicking step 1 while it's the only filled step", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 1 } } }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 0 });
	});

	it("treats a missing spotlight value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "2" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 2 });
	});

	it("clamps a step beyond the track's max and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 6 } } }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "7" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#getData - downtimeTokens", () => {
	it("defaults value to the flat max (2) when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.downtimeTokens).toEqual({ value: 2, max: 2 });
	});

	it("reflects the actor's stored value against the flat max", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { downtimeTokens: { value: 1 } } } };

		const data = sheet.getData();

		expect(data.downtimeTokens).toEqual({ value: 1, max: 2 });
	});
});

describe("PlaybookActorSheet#activateListeners - downtime tokens step", () => {
	it("binds a click handler to the downtime tokens step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".downtime-tokens-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onDowntimeTokensStep", () => {
	it("increments the value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { downtimeTokens: { value: 1 } } }, update: vi.fn() };

		sheet._onDowntimeTokensStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.downtimeTokens.value": 2 });
	});

	it("decrements the value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { downtimeTokens: { value: 1 } } }, update: vi.fn() };

		sheet._onDowntimeTokensStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.downtimeTokens.value": 0 });
	});

	it("clamps at DOWNTIME_TOKENS_MAX", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { downtimeTokens: { value: 2 } } }, update: vi.fn() };

		sheet._onDowntimeTokensStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at DOWNTIME_TOKENS_MIN", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { downtimeTokens: { value: 0 } } }, update: vi.fn() };

		sheet._onDowntimeTokensStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing downtimeTokens value as starting at the max", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onDowntimeTokensStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.downtimeTokens.value": 1 });
	});
});

describe("PlaybookActorSheet#_bonusDowntimeTokensData", () => {
	it("returns an empty array when no picked move/part/equipment carries bonusDowntimeTokens", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._bonusDowntimeTokensData()).toEqual([]);
	});

	it("returns one entry, defaulted to its own max, for a picked granting move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [MASTER_SERVANT.key] } } };

		expect(sheet._bonusDowntimeTokensData()).toEqual([
			{
				moveKey: MASTER_SERVANT.key,
				name: MASTER_SERVANT.name,
				description: MASTER_SERVANT.bonusDowntimeTokens.description,
				value: MASTER_SERVANT.bonusDowntimeTokens.max,
				max: MASTER_SERVANT.bonusDowntimeTokens.max
			}
		]);
	});

	it("reflects a stored value over the default-to-max value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [MASTER_SERVANT.key],
					bonusDowntimeTokens: { [MASTER_SERVANT.key]: { value: 0 } }
				}
			}
		};

		expect(sheet._bonusDowntimeTokensData()[0]).toEqual(
			expect.objectContaining({ moveKey: MASTER_SERVANT.key, value: 0, max: MASTER_SERVANT.bonusDowntimeTokens.max })
		);
	});

	it("keeps two granting moves' pools independently valued, in picked order", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [MASTER_SERVANT.key, INFORMATION_NETWORK.key],
					bonusDowntimeTokens: { [INFORMATION_NETWORK.key]: { value: 0 } }
				}
			}
		};

		const data = sheet._bonusDowntimeTokensData();

		expect(data.map((entry) => entry.moveKey)).toEqual([MASTER_SERVANT.key, INFORMATION_NETWORK.key]);
		expect(data[0].value).toBe(MASTER_SERVANT.bonusDowntimeTokens.max);
		expect(data[1].value).toBe(0);
	});

	it("returns a part-sourced row for Standardised Parts installed on the Astir only", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", parts: [STANDARDISED_PARTS.key] } } }
		};

		expect(sheet._bonusDowntimeTokensData()).toEqual([
			{
				moveKey: STANDARDISED_PARTS.key,
				name: STANDARDISED_PARTS.name,
				description: STANDARDISED_PARTS.bonusDowntimeTokens.description,
				value: STANDARDISED_PARTS.bonusDowntimeTokens.max,
				max: STANDARDISED_PARTS.bonusDowntimeTokens.max
			}
		]);
	});

	it("returns a part-sourced row for Standardised Parts installed on an Ardent only", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { ardents: [{ id: "ar1", parts: [STANDARDISED_PARTS.key] }] } }
		};

		expect(sheet._bonusDowntimeTokensData()).toEqual([
			expect.objectContaining({ moveKey: STANDARDISED_PARTS.key })
		]);
	});

	it("dedupes to a single row when Standardised Parts is installed on both the Astir and an Ardent", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", parts: [STANDARDISED_PARTS.key] },
					ardents: [{ id: "ar1", parts: [STANDARDISED_PARTS.key] }]
				}
			}
		};

		expect(sheet._bonusDowntimeTokensData()).toHaveLength(1);
	});

	it("returns an equipment-sourced row, defaulted to its own max", () => {
		const sheet = new PlaybookActorSheet();
		const item = {
			id: "eq1",
			kind: "gear",
			name: "Artificers",
			bonusDowntimeTokens: { max: 1, description: "Repairs, or magic or mechanical long-term projects." }
		};
		sheet.actor = { system: { attributes: { equipment: [item] } } };

		expect(sheet._bonusDowntimeTokensData()).toEqual([
			{ equipmentId: "eq1", name: "Artificers", description: item.bonusDowntimeTokens.description, value: 1, max: 1 }
		]);
	});

	it("reflects an equipment entry's own stored bonusDowntimeTokensValue over its max", () => {
		const sheet = new PlaybookActorSheet();
		const item = {
			id: "eq1",
			kind: "gear",
			name: "Artificers",
			bonusDowntimeTokens: { max: 1, description: "Repairs only." },
			bonusDowntimeTokensValue: 0
		};
		sheet.actor = { system: { attributes: { equipment: [item] } } };

		expect(sheet._bonusDowntimeTokensData()[0]).toEqual(expect.objectContaining({ equipmentId: "eq1", value: 0 }));
	});
});

describe("PlaybookActorSheet#_onBonusDowntimeTokenStep - moveKey (moves and parts)", () => {
	it("increments the value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [MASTER_SERVANT.key],
					bonusDowntimeTokens: { [MASTER_SERVANT.key]: { value: 0 } }
				}
			},
			update: vi.fn()
		};

		sheet._onBonusDowntimeTokenStep({ currentTarget: { dataset: { moveKey: MASTER_SERVANT.key, delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.bonusDowntimeTokens.${MASTER_SERVANT.key}.value`]: 1
		});
	});

	it("decrements the value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [MASTER_SERVANT.key],
					bonusDowntimeTokens: { [MASTER_SERVANT.key]: { value: 1 } }
				}
			},
			update: vi.fn()
		};

		sheet._onBonusDowntimeTokenStep({ currentTarget: { dataset: { moveKey: MASTER_SERVANT.key, delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.bonusDowntimeTokens.${MASTER_SERVANT.key}.value`]: 0
		});
	});

	it("clamps at the granting source's own max", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [MASTER_SERVANT.key],
					bonusDowntimeTokens: { [MASTER_SERVANT.key]: { value: MASTER_SERVANT.bonusDowntimeTokens.max } }
				}
			},
			update: vi.fn()
		};

		sheet._onBonusDowntimeTokenStep({ currentTarget: { dataset: { moveKey: MASTER_SERVANT.key, delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at DOWNTIME_TOKENS_MIN", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [MASTER_SERVANT.key],
					bonusDowntimeTokens: { [MASTER_SERVANT.key]: { value: 0 } }
				}
			},
			update: vi.fn()
		};

		sheet._onBonusDowntimeTokenStep({ currentTarget: { dataset: { moveKey: MASTER_SERVANT.key, delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing stored value as starting at the max", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [MASTER_SERVANT.key] } },
			update: vi.fn()
		};

		sheet._onBonusDowntimeTokenStep({ currentTarget: { dataset: { moveKey: MASTER_SERVANT.key, delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.bonusDowntimeTokens.${MASTER_SERVANT.key}.value`]:
				MASTER_SERVANT.bonusDowntimeTokens.max - 1
		});
	});

	it("no-ops when moveKey doesn't resolve to a currently-picked move or installed part", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } }, update: vi.fn() };

		sheet._onBonusDowntimeTokenStep({ currentTarget: { dataset: { moveKey: MASTER_SERVANT.key, delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("no-ops when moveKey resolves to a picked move without the flag", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [PATRON.key] } }, update: vi.fn() };

		sheet._onBonusDowntimeTokenStep({ currentTarget: { dataset: { moveKey: PATRON.key, delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("increments a part-sourced pool (Standardised Parts installed on the Astir)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", parts: [STANDARDISED_PARTS.key] },
					bonusDowntimeTokens: { [STANDARDISED_PARTS.key]: { value: 0 } }
				}
			},
			update: vi.fn()
		};

		sheet._onBonusDowntimeTokenStep({ currentTarget: { dataset: { moveKey: STANDARDISED_PARTS.key, delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.bonusDowntimeTokens.${STANDARDISED_PARTS.key}.value`]: 1
		});
	});
});

describe("PlaybookActorSheet#_onBonusDowntimeTokenStep - equipmentId", () => {
	it("increments the value, leaving a different equipment entry untouched", () => {
		const sheet = new PlaybookActorSheet();
		const item = { id: "eq1", kind: "gear", name: "Artificers", bonusDowntimeTokens: { max: 1, description: "" }, bonusDowntimeTokensValue: 0 };
		const other = { id: "eq2", kind: "gear", name: "Rope" };
		sheet.actor = { system: { attributes: { equipment: [item, other] } }, update: vi.fn() };

		sheet._onBonusDowntimeTokenStep({ currentTarget: { dataset: { equipmentId: "eq1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...item, bonusDowntimeTokensValue: 1 }, other]
		});
	});

	it("decrements the value", () => {
		const sheet = new PlaybookActorSheet();
		const item = { id: "eq1", kind: "gear", name: "Artificers", bonusDowntimeTokens: { max: 1, description: "" }, bonusDowntimeTokensValue: 1 };
		sheet.actor = { system: { attributes: { equipment: [item] } }, update: vi.fn() };

		sheet._onBonusDowntimeTokenStep({ currentTarget: { dataset: { equipmentId: "eq1", delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...item, bonusDowntimeTokensValue: 0 }]
		});
	});

	it("clamps at the entry's own max", () => {
		const sheet = new PlaybookActorSheet();
		const item = { id: "eq1", kind: "gear", name: "Artificers", bonusDowntimeTokens: { max: 1, description: "" }, bonusDowntimeTokensValue: 1 };
		sheet.actor = { system: { attributes: { equipment: [item] } }, update: vi.fn() };

		sheet._onBonusDowntimeTokenStep({ currentTarget: { dataset: { equipmentId: "eq1", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at DOWNTIME_TOKENS_MIN", () => {
		const sheet = new PlaybookActorSheet();
		const item = { id: "eq1", kind: "gear", name: "Artificers", bonusDowntimeTokens: { max: 1, description: "" }, bonusDowntimeTokensValue: 0 };
		sheet.actor = { system: { attributes: { equipment: [item] } }, update: vi.fn() };

		sheet._onBonusDowntimeTokenStep({ currentTarget: { dataset: { equipmentId: "eq1", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing stored value as starting at the max", () => {
		const sheet = new PlaybookActorSheet();
		const item = { id: "eq1", kind: "gear", name: "Artificers", bonusDowntimeTokens: { max: 1, description: "" } };
		sheet.actor = { system: { attributes: { equipment: [item] } }, update: vi.fn() };

		sheet._onBonusDowntimeTokenStep({ currentTarget: { dataset: { equipmentId: "eq1", delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...item, bonusDowntimeTokensValue: 0 }]
		});
	});

	it("no-ops when equipmentId doesn't resolve to any entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };

		sheet._onBonusDowntimeTokenStep({ currentTarget: { dataset: { equipmentId: "nope", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("no-ops when equipmentId resolves to an entry without the flag", () => {
		const sheet = new PlaybookActorSheet();
		const item = { id: "eq1", kind: "gear", name: "Rope" };
		sheet.actor = { system: { attributes: { equipment: [item] } }, update: vi.fn() };

		sheet._onBonusDowntimeTokenStep({ currentTarget: { dataset: { equipmentId: "eq1", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_bonusDowntimeTokensData - Quarters extra-token benefit", () => {
	it("appends a keyed entry named after the Quarters when extra-token is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { quarters: { name: "The Nook", benefits: ["extra-token"] } } }
		};

		const data = sheet._bonusDowntimeTokensData();

		expect(data).toContainEqual({
			moveKey: "quarters:extra-token",
			name: "The Nook",
			description: "Quarters: an extra token when you enter Downtime.",
			value: 1,
			max: 1
		});
	});

	it("falls back to Quarters as the name when the Quarters itself is unnamed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { quarters: { benefits: ["extra-token"] } } } };

		expect(sheet._bonusDowntimeTokensData()[0].name).toBe("Quarters");
	});

	it("adds no entry when extra-token isn't picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { quarters: { benefits: [] } } } };

		expect(sheet._bonusDowntimeTokensData()).toEqual([]);
	});
});

describe("PlaybookActorSheet#_onBonusDowntimeTokenStep - Quarters extra-token benefit", () => {
	it("steps the Quarters-sourced pool via moveKey quarters:extra-token", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					quarters: { benefits: ["extra-token"] },
					bonusDowntimeTokens: { "quarters:extra-token": { value: 0 } }
				}
			},
			update: vi.fn()
		};

		sheet._onBonusDowntimeTokenStep({ currentTarget: { dataset: { moveKey: "quarters:extra-token", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.bonusDowntimeTokens.quarters:extra-token.value": 1
		});
	});
});

describe("PlaybookActorSheet#activateListeners - trait steps", () => {
	it("binds a click handler to the trait step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".trait-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onTraitStep", () => {
	it("increments the trait's value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { defy: { value: 0 } } }, update: vi.fn() };

		sheet._onTraitStep({ currentTarget: { dataset: { trait: "defy", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.stats.defy.value": 1 });
	});

	it("decrements the trait's value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { defy: { value: 0 } } }, update: vi.fn() };

		sheet._onTraitStep({ currentTarget: { dataset: { trait: "defy", delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.stats.defy.value": -1 });
	});

	it("treats a missing stat as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} }, update: vi.fn() };

		sheet._onTraitStep({ currentTarget: { dataset: { trait: "defy", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.stats.defy.value": 1 });
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { defy: { value: 3 } } }, update: vi.fn() };

		sheet._onTraitStep({ currentTarget: { dataset: { trait: "defy", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { defy: { value: -3 } } }, update: vi.fn() };

		sheet._onTraitStep({ currentTarget: { dataset: { trait: "defy", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});
