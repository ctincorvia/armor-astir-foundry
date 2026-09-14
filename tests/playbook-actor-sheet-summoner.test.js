import { describe, expect, it } from "vitest";

import { APPROACHES } from "../scripts/core/approaches.js";
import { TRAITS } from "../scripts/core/traits.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { BINDING, HELPING_HANDS, BONDED_IN_BLOOD, SPRITECRAFT } from "./helpers/move-fixtures.js";

describe("PlaybookActorSheet#_boundAllies/_eidolonDrive/_downtimeAlly", () => {
	it("default to their empty/blank shapes when unset", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._boundAllies()).toEqual([]);
		expect(sheet._eidolonDrive()).toEqual({ summonedAllyId: null, bonusUsed: false });
		expect(sheet._downtimeAlly()).toBeNull();
	});

	it("return the stored values when set", () => {
		const sheet = new PlaybookActorSheet();
		const ally = { id: "a1", name: "Vex", approach: "profane", trait: "channel", powerInvested: 2 };
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [ally],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: true },
					downtimeAlly: { name: "Pip", powerInvested: 1 }
				}
			}
		};

		expect(sheet._boundAllies()).toEqual([ally]);
		expect(sheet._eidolonDrive()).toEqual({ summonedAllyId: "a1", bonusUsed: true });
		expect(sheet._downtimeAlly()).toEqual({ name: "Pip", powerInvested: 1 });
	});
});

describe("PlaybookActorSheet#_summonedAlly", () => {
	it("is null when eidolonDrive is unset", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._summonedAlly()).toBeNull();
	});

	it("resolves the bound ally matching the stored summonedAllyId", () => {
		const sheet = new PlaybookActorSheet();
		const ally = { id: "a1", name: "Vex", trait: "talk" };
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [ally],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			}
		};

		expect(sheet._summonedAlly()).toEqual(ally);
	});

	it("is null when the stored summonedAllyId no longer resolves (e.g. Released)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			}
		};

		expect(sheet._summonedAlly()).toBeNull();
	});
});

describe("PlaybookActorSheet#_bindingMove/_helpingHandsMove", () => {
	it("are undefined when neither move is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._bindingMove()).toBeUndefined();
		expect(sheet._helpingHandsMove()).toBeUndefined();
	});

	it("resolve to their move objects once picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BINDING.key, HELPING_HANDS.key] } } };

		expect(sheet._bindingMove()).toEqual(BINDING);
		expect(sheet._helpingHandsMove()).toEqual(HELPING_HANDS);
	});
});

describe("PlaybookActorSheet#_grantsFreeAllies", () => {
	it("is false with no granting move picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._grantsFreeAllies()).toBe(false);
	});

	it("is true with only Bonded In Blood picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BONDED_IN_BLOOD.key] } } };

		expect(sheet._grantsFreeAllies()).toBe(true);
	});

	it("is true with only Spritecraft picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [SPRITECRAFT.key] } } };

		expect(sheet._grantsFreeAllies()).toBe(true);
	});
});

describe("PlaybookActorSheet#_boundAlliesData", () => {
	it("is null without Binding picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._boundAlliesData()).toBeNull();
	});

	it("exposes the full APPROACHES/TRAITS catalogs, not a playbook-restricted subset", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BINDING.key] } } };

		const data = sheet._boundAlliesData();

		expect(data.approaches).toEqual(APPROACHES);
		expect(data.traits).toEqual(TRAITS);
	});

	it("disables Invest without an Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BINDING.key] } } };

		expect(sheet._boundAlliesData().canInvest).toBe(false);
	});

	it("enables Invest with an Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BINDING.key], astir: { power: 2 } } } };

		expect(sheet._boundAlliesData().canInvest).toBe(true);
	});

	it("disables canMarkFree without Bonded In Blood or Spritecraft picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BINDING.key] } } };

		expect(sheet._boundAlliesData().canMarkFree).toBe(false);
	});

	it("enables canMarkFree once Bonded In Blood is picked alongside Binding", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BINDING.key, BONDED_IN_BLOOD.key] } } };

		expect(sheet._boundAlliesData().canMarkFree).toBe(true);
	});

	it("maps each ally with defaults and flags the currently-summoned one", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [BINDING.key],
					boundAllies: [
						{ id: "a1", name: "Vex" },
						{ id: "a2", name: "Ossa", approach: "profane", trait: "know", powerInvested: 2 },
						{ id: "a3", name: "Rook", free: true }
					],
					eidolonDrive: { summonedAllyId: "a2", bonusUsed: false }
				}
			}
		};

		const { list } = sheet._boundAlliesData();

		expect(list).toEqual([
			{ id: "a1", name: "Vex", approach: "", trait: "", powerInvested: 0, free: false, summoned: false },
			{ id: "a2", name: "Ossa", approach: "profane", trait: "know", powerInvested: 2, free: false, summoned: true },
			{ id: "a3", name: "Rook", approach: "", trait: "", powerInvested: 0, free: true, summoned: false }
		]);
	});
});

describe("PlaybookActorSheet#_downtimeAllyData", () => {
	it("is null without Helping Hands picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._downtimeAllyData()).toBeNull();
	});

	it("reports exists: false with nothing bound yet", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [HELPING_HANDS.key] } } };

		expect(sheet._downtimeAllyData()).toEqual({ exists: false, canInvest: false, name: "", powerInvested: 0 });
	});

	it("reports the bound ally's own fields once set, and canInvest with an Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [HELPING_HANDS.key],
					downtimeAlly: { name: "Pip", powerInvested: 1 },
					astir: { power: 3 }
				}
			}
		};

		expect(sheet._downtimeAllyData()).toEqual({ exists: true, canInvest: true, name: "Pip", powerInvested: 1 });
	});
});
