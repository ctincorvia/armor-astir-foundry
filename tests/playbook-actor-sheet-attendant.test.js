import { describe, expect, it, vi } from "vitest";

// Only resolvePlaybookMoves is wrapped, and only to inject one synthetic move behind a sentinel
// key the real catalog never issues — every other call (including every other test in this file)
// falls straight through to the real implementation. This is what lets the effectiveLabel fallback
// below be exercised at all: every real grantsApproachOverride value (just "profane" today) is a
// recognized APPROACHES key, so that branch is otherwise unreachable through real content, the same
// "key no longer resolves" defensive case playbook-actor-sheet.test.js's own frame-Approach
// fallback test covers via free-form stored data instead (a move's grantsApproachOverride, unlike a
// frame's Approach, is fixed catalog data, not player-editable).
vi.mock("../scripts/moves/playbook-moves.js", async (importOriginal) => {
	const original = await importOriginal();
	return {
		...original,
		resolvePlaybookMoves: (keys) => (
			keys.includes("test:unknown-approach-override")
				? [{ key: "test:unknown-approach-override", name: "Test Move", grantsApproachOverride: "unknown" }]
				: original.resolvePlaybookMoves(keys)
		)
	};
});

import { BASIC_MOVES } from "../scripts/moves/moves.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const SIGNED_SEALED = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-attendant:signed-sealed");
const MASTER_SERVANT = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-attendant:master-servant");
const STRIKE_DECISIVELY = BASIC_MOVES.find((m) => m.key === "strike-decisively");
const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const CLASSICAL_SPELLCASTING = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:classical-spellcasting");
const ADVANCED_EVOCATION = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:advanced-evocation");

// Signed & Sealed (The Attendant) — a picked-move approach override and a picked-move weapon-tag
// grant, both resolved generically off ALL_PLAYBOOK_MOVES' own grantsApproachOverride/
// grantsWeaponTags flags (see progression-mixin.js's _effectiveApproach and equipment-mixin.js's
// _weaponTagKeys/_grantedWeaponTagKeys), the same declarative-flag convention every other
// cross-cutting move flag in this codebase follows.
describe("PlaybookActorSheet#_effectiveApproach - Signed & Sealed", () => {
	it("overrides to profane with Signed & Sealed picked and no frame mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { approach: "mundane", playbookMoves: [SIGNED_SEALED.key] }
			}
		};

		expect(sheet._effectiveApproach()).toEqual({
			base: "mundane",
			effective: "profane",
			effectiveLabel: "Profane",
			fromFrame: false,
			fromMove: true,
			moveName: SIGNED_SEALED.name
		});
	});

	it("still lets a mounted frame's own Approach win over Signed & Sealed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					approach: "mundane",
					playbookMoves: [SIGNED_SEALED.key],
					astir: { id: "a1", piloted: true, approach: "elemental", name: "Astir" }
				}
			}
		};

		const result = sheet._effectiveApproach();
		expect(result.fromFrame).toBe(true);
		expect(result.effective).toBe("elemental");
		expect(result).not.toHaveProperty("fromMove");
	});

	it("falls back to the base approach with neither a mounted frame nor Signed & Sealed picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { approach: "mundane" } } };

		expect(sheet._effectiveApproach()).toEqual({
			base: "mundane",
			effective: "mundane",
			effectiveLabel: "Mundane",
			fromFrame: false
		});
	});

	it("falls back to the raw key as effectiveLabel when a granted override isn't a recognized Approach", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { approach: "mundane", playbookMoves: ["test:unknown-approach-override"] } }
		};

		expect(sheet._effectiveApproach()).toEqual({
			base: "mundane",
			effective: "unknown",
			effectiveLabel: "unknown",
			fromFrame: false,
			fromMove: true,
			moveName: "Test Move"
		});
	});
});

describe("PlaybookActorSheet#_weaponTagKeys / _equipmentEntry - Signed & Sealed", () => {
	it("unions messy and decisive onto a mundane weapon's own stored tags, deduped, when picked", () => {
		const sheet = new PlaybookActorSheet();
		const weapon = { id: "w1", kind: "weapon", name: "Sword Cane I", tags: ["melee", "decisive"] };
		sheet.actor = {
			system: { attributes: { playbookMoves: [SIGNED_SEALED.key], equipment: [weapon] } }
		};

		expect(sheet._weaponTagKeys(weapon)).toEqual(
			expect.arrayContaining(["melee", "decisive", "messy"])
		);
		// Deduped: decisive was already stored, so it appears exactly once.
		expect(sheet._weaponTagKeys(weapon).filter((key) => key === "decisive")).toHaveLength(1);

		const entry = sheet._equipmentEntry(weapon);
		expect(entry.tags.map((t) => t.key)).toEqual(
			expect.arrayContaining(["melee", "decisive", "messy"])
		);
	});

	it("renders only the weapon's own stored tags without Signed & Sealed picked", () => {
		const sheet = new PlaybookActorSheet();
		const weapon = { id: "w1", kind: "weapon", name: "Sword Cane I", tags: ["melee", "decisive"] };
		// Master & Servant is picked but carries no grantsWeaponTags of its own — exercises the
		// "picked move with nothing to grant" branch of _grantedWeaponTagKeys' own flatMap, distinct
		// from picking nothing at all.
		sheet.actor = {
			system: { attributes: { playbookMoves: [MASTER_SERVANT.key], equipment: [weapon] } }
		};

		expect(sheet._weaponTagKeys(weapon)).toEqual(["melee", "decisive"]);

		const entry = sheet._equipmentEntry(weapon);
		expect(entry.tags.map((t) => t.key)).toEqual(["melee", "decisive"]);
	});

	it("leaves gear untouched, even with Signed & Sealed picked", () => {
		const sheet = new PlaybookActorSheet();
		const gear = { id: "g1", kind: "gear", name: "Rations", tags: [] };
		sheet.actor = {
			system: { attributes: { playbookMoves: [SIGNED_SEALED.key], equipment: [gear] } }
		};

		expect(sheet._weaponTagKeys(gear)).toEqual([]);
	});
});

// Cantrips' Advanced Evocation — the same _weaponTagKeys mechanism above, but exercising
// grantsWeaponTagChoice (equipment-mixin.js's _grantedWeaponTagChoiceKeys) rather than
// Signed & Sealed's unscoped grantsWeaponTags: a per-actor chosen tag applied only to the one
// weapon it names by match, not every weapon on the sheet.
describe("PlaybookActorSheet#_weaponTagKeys - Advanced Evocation's chosen tag", () => {
	it("applies the chosen tag only to the named target weapon (Hand-casting), not other weapons", () => {
		const sheet = new PlaybookActorSheet();
		const handCasting = { id: "w1", kind: "weapon", name: "Hand-casting", tags: ["ranged", "area"] };
		const other = { id: "w2", kind: "weapon", name: "Sword Cane I", tags: ["melee"] };
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [CLASSICAL_SPELLCASTING.key, ADVANCED_EVOCATION.key],
					weaponTagChoices: { [ADVANCED_EVOCATION.key]: "impact" },
					equipment: [handCasting, other]
				}
			}
		};

		expect(sheet._weaponTagKeys(handCasting)).toEqual(
			expect.arrayContaining(["ranged", "area", "impact"])
		);
		expect(sheet._weaponTagKeys(other)).toEqual(["melee"]);
	});

	it("applies no extra tag with Advanced Evocation picked but no choice made yet", () => {
		const sheet = new PlaybookActorSheet();
		const handCasting = { id: "w1", kind: "weapon", name: "Hand-casting", tags: ["ranged", "area"] };
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [CLASSICAL_SPELLCASTING.key, ADVANCED_EVOCATION.key],
					equipment: [handCasting]
				}
			}
		};

		expect(sheet._weaponTagKeys(handCasting)).toEqual(["ranged", "area"]);
	});

	it("applies nothing at all without Advanced Evocation picked", () => {
		const sheet = new PlaybookActorSheet();
		const handCasting = { id: "w1", kind: "weapon", name: "Hand-casting", tags: ["ranged", "area"] };
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [CLASSICAL_SPELLCASTING.key],
					weaponTagChoices: { [ADVANCED_EVOCATION.key]: "impact" },
					equipment: [handCasting]
				}
			}
		};

		expect(sheet._weaponTagKeys(handCasting)).toEqual(["ranged", "area"]);
	});
});

describe("PlaybookActorSheet#_availableReroll - Signed & Sealed's granted Decisive tag", () => {
	it("offers the Strike Decisively reroll off a mundane weapon with no stored decisive tag, once granted", () => {
		const sheet = new PlaybookActorSheet();
		const weapon = { id: "w1", kind: "weapon", name: "Fists", tags: ["melee"] };
		sheet.actor = {
			system: { attributes: { playbookMoves: [SIGNED_SEALED.key], equipment: [weapon] } }
		};

		expect(sheet._availableReroll(STRIKE_DECISIVELY, weapon)).toEqual({ equipmentId: "w1", tagKey: "decisive", spendKey: "decisive" });
	});

	it("offers no reroll from the same weapon without Signed & Sealed picked", () => {
		const sheet = new PlaybookActorSheet();
		const weapon = { id: "w1", kind: "weapon", name: "Fists", tags: ["melee"] };
		sheet.actor = {
			system: { attributes: { playbookMoves: [], equipment: [weapon] } }
		};

		expect(sheet._availableReroll(STRIKE_DECISIVELY, weapon)).toBeNull();
	});
});

describe("PlaybookActorSheet#_availableRerollTag", () => {
	it("resolves the tag's label and description when a reroll is available", () => {
		const sheet = new PlaybookActorSheet();
		const weapon = { id: "w1", kind: "weapon", name: "Riot Shield", tags: ["defensive"] };
		sheet.actor = {
			system: { attributes: { playbookMoves: [], equipment: [weapon] } }
		};

		expect(sheet._availableRerollTag(EXCHANGE_BLOWS, weapon)).toEqual({
			tagLabel: "Defensive",
			description: "Defensive weaponry is excellent for keeping foes at a distance, parrying their blows, " +
				"or suppressing them. Once per Scene, you may reroll a failed exchange blows when using it."
		});
	});

	it("returns null when no reroll tag is available", () => {
		const sheet = new PlaybookActorSheet();
		const weapon = { id: "w1", kind: "weapon", name: "Fists", tags: ["blitz"] };
		sheet.actor = {
			system: { attributes: { playbookMoves: [], equipment: [weapon] } }
		};

		expect(sheet._availableRerollTag(EXCHANGE_BLOWS, weapon)).toBeNull();
	});

	it("returns null once the weapon's reroll tag is already spent", () => {
		const sheet = new PlaybookActorSheet();
		const weapon = { id: "w1", kind: "weapon", name: "Riot Shield", tags: ["defensive"], spent: ["defensive"] };
		sheet.actor = {
			system: { attributes: { playbookMoves: [], equipment: [weapon] } }
		};

		expect(sheet._availableRerollTag(EXCHANGE_BLOWS, weapon)).toBeNull();
	});

	it("resolves Signed & Sealed's granted Decisive tag correctly", () => {
		const sheet = new PlaybookActorSheet();
		const weapon = { id: "w1", kind: "weapon", name: "Fists", tags: ["melee"] };
		sheet.actor = {
			system: { attributes: { playbookMoves: [SIGNED_SEALED.key], equipment: [weapon] } }
		};

		expect(sheet._availableRerollTag(STRIKE_DECISIVELY, weapon)).toEqual({
			tagLabel: "Decisive",
			description: "Decisive weaponry is precise and powerful, excellent for ending fights. Once per " +
				"Scene, you may reroll a failed strike decisively when using it."
		});
	});
});
