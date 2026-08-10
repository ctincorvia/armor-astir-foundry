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
				? [{ key: "test:unknown-approach-override", grantsApproachOverride: "unknown" }]
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
			fromMove: true
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

		expect(sheet._effectiveApproach()).toEqual({ base: "mundane", effective: "mundane", fromFrame: false });
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
			fromMove: true
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

describe("PlaybookActorSheet#_availableReroll - Signed & Sealed's granted Decisive tag", () => {
	it("offers the Strike Decisively reroll off a mundane weapon with no stored decisive tag, once granted", () => {
		const sheet = new PlaybookActorSheet();
		const weapon = { id: "w1", kind: "weapon", name: "Fists", tags: ["melee"] };
		sheet.actor = {
			system: { attributes: { playbookMoves: [SIGNED_SEALED.key], equipment: [weapon] } }
		};

		expect(sheet._availableReroll(STRIKE_DECISIVELY, weapon)).toEqual({ equipmentId: "w1", tagKey: "decisive" });
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
