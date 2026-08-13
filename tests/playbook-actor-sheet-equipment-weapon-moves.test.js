import { describe, expect, it } from "vitest";

import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

describe("PlaybookActorSheet#getData - weaponMoves", () => {
	it("lists exchange-blows and strike-decisively on every weapon entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: false, tooltip: null },
			{ key: "strike-decisively", name: "Strike Decisively", gated: false, tooltip: null }
		]);
	});

	it("gates weaponMoves the same way the Moves tab gates them", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0, disabled: true }, talk: { value: 0, disabled: true } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: true, tooltip: null },
			{ key: "strike-decisively", name: "Strike Decisively", gated: true, tooltip: null }
		]);
	});

	it("gates a mundane weapon's weaponMoves once the Astir is piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					astir: { id: "a1", tier: 3, parts: [], move: null, piloted: true },
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: true, tooltip: "Personal weapons are disabled when mounted. Dismount to use this weapon." },
			{ key: "strike-decisively", name: "Strike Decisively", gated: true, tooltip: "Personal weapons are disabled when mounted. Dismount to use this weapon." }
		]);
	});

	it("gates a disabled weapon's own weaponMoves, with a default tooltip", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					equipment: [
						{ id: "eq1", kind: "weapon", disabled: true, name: "Broken Rifle", description: "", tags: [], spent: [], scale: "foot", tier: 1 }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: true, tooltip: "This weapon is disabled." },
			{ key: "strike-decisively", name: "Strike Decisively", gated: true, tooltip: "This weapon is disabled." }
		]);
	});

	it("does not attach weaponMoves to gear", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					equipment: [{ id: "eq1", kind: "gear", name: "Rations", description: "", tags: [], spent: [] }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.gear[0].weaponMoves).toBeUndefined();
	});

	it("gates an Astir weapon's weaponMoves when the Astir isn't piloted, regardless of its own gating", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					astir: { id: "a1", tier: 3, parts: [], move: null, piloted: false },
					equipment: [
						{ id: "eq1", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.astir.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: true, tooltip: "Astir and Ardent weapons are disabled while unmounted. Mount up to use this weapon." },
			{ key: "strike-decisively", name: "Strike Decisively", gated: true, tooltip: "Astir and Ardent weapons are disabled while unmounted. Mount up to use this weapon." }
		]);
	});

	it("leaves an Astir weapon's weaponMoves gating to its own logic once piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					astir: { id: "a1", tier: 3, parts: [], move: null, piloted: true },
					equipment: [
						{ id: "eq1", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.astir.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: false, tooltip: null },
			{ key: "strike-decisively", name: "Strike Decisively", gated: false, tooltip: null }
		]);
	});

	it("explains cross-frame gating when an Ardent weapon is disabled because the Astir is piloted instead", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					astir: { id: "a1", tier: 3, parts: [], move: null, piloted: true },
					ardents: [{ id: "ar1", tier: 3, parts: [], piloted: false }],
					equipment: [
						{ id: "eq1", kind: "weapon", ardent: "ar1", name: "Spear", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.ardentWeapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: true, tooltip: "This weapon's frame isn't mounted. Dismount your current frame and mount this one to use this weapon." },
			{ key: "strike-decisively", name: "Strike Decisively", gated: true, tooltip: "This weapon's frame isn't mounted. Dismount your current frame and mount this one to use this weapon." }
		]);
	});
});
