import { describe, expect, it } from "vitest";

import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { ASTIR_PART_CATALOG } from "../scripts/frames/astir.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const INPUT_CHANNEL = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:input-channel");
const FACILITATOR = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-diplomat:facilitator");
const TURN_UNEARTHLY = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-paradigm:turn-unearthly");
const ARCANE_GENERATOR = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-artificer:arcane-generator");
const COUNTERSPELL = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-artificer:counterspell");
const CLASSICAL_SPELLCASTING = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:classical-spellcasting");

describe("PlaybookActorSheet#_moveTraits", () => {
	it("leaves a non-crew fixedTrait untouched", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };
		const move = { traits: [], fixedTraits: [{ key: "cargo", label: "CARGO", value: 3 }] };

		expect(sheet._moveTraits(move)).toEqual([{ key: "cargo", label: "CARGO", value: 3 }]);
	});

	it("offers +CHANNEL on any move when piloted with Input Channel installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 2, disabled: true } },
				attributes: { astir: { id: "a1", parts: [INPUT_CHANNEL.key], piloted: true } }
			}
		};
		const move = { traits: ["clash"] };

		expect(sheet._moveTraits(move)).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "channel", label: "CHANNEL", value: 2 }
		]);
	});

	it("does not offer +CHANNEL when not piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 2, disabled: true } },
				attributes: { astir: { id: "a1", parts: [INPUT_CHANNEL.key], piloted: false } }
			}
		};

		expect(sheet._moveTraits({ traits: ["clash"] })).toEqual([{ key: "clash", label: "CLASH", value: 1 }]);
	});

	it("does not offer +CHANNEL without Input Channel installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 2, disabled: true } },
				attributes: { astir: { id: "a1", parts: [], piloted: true } }
			}
		};

		expect(sheet._moveTraits({ traits: ["clash"] })).toEqual([{ key: "clash", label: "CLASH", value: 1 }]);
	});

	it("treats a missing channel stat value as 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [INPUT_CHANNEL.key], piloted: true } }
			}
		};

		expect(sheet._moveTraits({ traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "channel", label: "CHANNEL", value: 0 }
		]);
	});

	it("does not add a second CHANNEL entry when the move already rolls it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 2, disabled: false } },
				attributes: { astir: { id: "a1", parts: [INPUT_CHANNEL.key], piloted: true } }
			}
		};

		expect(sheet._moveTraits({ traits: ["channel"] })).toEqual([{ key: "channel", label: "CHANNEL", value: 2 }]);
	});

	it("offers +TALK on Read the Room when Facilitator is picked (addsTraitToMove)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 1 }, talk: { value: 2 } },
				attributes: { playbookMoves: [FACILITATOR.key] }
			}
		};
		const readTheRoom = { key: "read-the-room", traits: ["sense"] };

		expect(sheet._moveTraits(readTheRoom)).toEqual([
			{ key: "sense", label: "SENSE", value: 1 },
			{ key: "talk", label: "TALK", value: 2 }
		]);
	});

	it("does not add +TALK to a different move just because Facilitator is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, talk: { value: 2 } },
				attributes: { playbookMoves: [FACILITATOR.key] }
			}
		};

		expect(sheet._moveTraits({ key: "exchange-blows", traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 }
		]);
	});

	it("leaves Read the Room's traits untouched without Facilitator picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { sense: { value: 1 }, talk: { value: 2 } }, attributes: { playbookMoves: [] } }
		};
		const readTheRoom = { key: "read-the-room", traits: ["sense"] };

		expect(sheet._moveTraits(readTheRoom)).toEqual([{ key: "sense", label: "SENSE", value: 1 }]);
	});

	it("does not add a second TALK entry when the target move already rolls it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { talk: { value: 2 } },
				attributes: { playbookMoves: [FACILITATOR.key] }
			}
		};

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["talk"] })).toEqual([
			{ key: "talk", label: "TALK", value: 2 }
		]);
	});

	it("treats a missing talk stat value as 0 for an added trait", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { sense: { value: 1 } }, attributes: { playbookMoves: [FACILITATOR.key] } }
		};

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["sense"] })).toEqual([
			{ key: "sense", label: "SENSE", value: 1 },
			{ key: "talk", label: "TALK", value: 0 }
		]);
	});

	it("offers +CHANNEL on both Exchange Blows and Strike Decisively when Turn Unearthly is picked (addsTraitToMove.moveKeys)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 3 } },
				attributes: { playbookMoves: [TURN_UNEARTHLY.key] }
			}
		};

		expect(sheet._moveTraits({ key: "exchange-blows", traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "channel", label: "CHANNEL", value: 3 }
		]);
		expect(sheet._moveTraits({ key: "strike-decisively", traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "channel", label: "CHANNEL", value: 3 }
		]);
	});

	it("does not add +CHANNEL to an unrelated move just because Turn Unearthly is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 1 }, channel: { value: 3 } },
				attributes: { playbookMoves: [TURN_UNEARTHLY.key] }
			}
		};

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["sense"] })).toEqual([
			{ key: "sense", label: "SENSE", value: 1 }
		]);
	});

	it("offers +CHANNEL on any move when Arcane Generator is picked and the Astir is piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 2, disabled: true } },
				attributes: {
					playbookMoves: [ARCANE_GENERATOR.key],
					astir: { id: "a1", parts: [], piloted: true }
				}
			}
		};

		expect(sheet._moveTraits({ traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "channel", label: "CHANNEL", value: 2 }
		]);
	});

	it("does not offer +CHANNEL from Arcane Generator when an Ardent is piloted instead of the Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 2, disabled: true } },
				attributes: {
					playbookMoves: [ARCANE_GENERATOR.key],
					astir: { id: "a1", parts: [], piloted: false },
					ardents: [{ id: "ar1", parts: [], piloted: true }]
				}
			}
		};

		expect(sheet._moveTraits({ traits: ["clash"] })).toEqual([{ key: "clash", label: "CLASH", value: 1 }]);
	});

	it("offers +KNOW on both Exchange Blows and Strike Decisively when Counterspell is picked (addsTraitToMove.moveKeys)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, know: { value: 2 } },
				attributes: { playbookMoves: [COUNTERSPELL.key] }
			}
		};

		expect(sheet._moveTraits({ key: "exchange-blows", traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "know", label: "KNOW", value: 2 }
		]);
		expect(sheet._moveTraits({ key: "strike-decisively", traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "know", label: "KNOW", value: 2 }
		]);
	});

	it("does not add +KNOW to an unrelated move just because Counterspell is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 1 }, know: { value: 2 } },
				attributes: { playbookMoves: [COUNTERSPELL.key] }
			}
		};

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["sense"] })).toEqual([
			{ key: "sense", label: "SENSE", value: 1 }
		]);
	});

	it("offers +CHANNEL on the chosen Basic Move when Classical Spellcasting is picked and unmounted (addsTraitToMove.chooseMove)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 1 }, channel: { value: 2 } },
				attributes: {
					playbookMoves: [CLASSICAL_SPELLCASTING.key],
					addsTraitToMoveChoices: { [CLASSICAL_SPELLCASTING.key]: "read-the-room" }
				}
			}
		};

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["sense"] })).toEqual([
			{ key: "sense", label: "SENSE", value: 1 },
			{ key: "channel", label: "CHANNEL", value: 2 }
		]);
	});

	it("does not add +CHANNEL to a Basic Move that isn't the one chosen", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 1 }, channel: { value: 2 } },
				attributes: {
					playbookMoves: [CLASSICAL_SPELLCASTING.key],
					addsTraitToMoveChoices: { [CLASSICAL_SPELLCASTING.key]: "weather-the-storm" }
				}
			}
		};

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["sense"] })).toEqual([
			{ key: "sense", label: "SENSE", value: 1 }
		]);
	});

	it("does not offer +CHANNEL from Classical Spellcasting's chooseMove while a frame is mounted, even with a valid choice", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 1 }, channel: { value: 2 } },
				attributes: {
					playbookMoves: [CLASSICAL_SPELLCASTING.key],
					addsTraitToMoveChoices: { [CLASSICAL_SPELLCASTING.key]: "read-the-room" },
					astir: { id: "a1", parts: [], piloted: true }
				}
			}
		};

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["sense"] })).toEqual([
			{ key: "sense", label: "SENSE", value: 1 }
		]);
	});

	it("does not offer +CHANNEL from Classical Spellcasting's chooseMove with no stored choice yet", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 1 }, channel: { value: 2 } },
				attributes: { playbookMoves: [CLASSICAL_SPELLCASTING.key] }
			}
		};

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["sense"] })).toEqual([
			{ key: "sense", label: "SENSE", value: 1 }
		]);
	});
});

describe("PlaybookActorSheet#_moveTraits - Crew Support's CREW substitution", () => {
	it("offers a crew-support-crew option on any move once Crew Support has hold", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { sense: { value: 1 } },
				attributes: { moveTrackers: { "crew-support": { hold: 2 } } }
			}
		};

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["sense"] })).toEqual([
			{ key: "sense", label: "SENSE", value: 1 },
			{ key: "crew-support-crew", label: "CREW (Crew Support)", value: 0 }
		]);
	});

	it("does not offer the option without any Crew Support hold", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { sense: { value: 1 } }, attributes: {} } };

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["sense"] })).toEqual([
			{ key: "sense", label: "SENSE", value: 1 }
		]);
	});

	it("offers the option even on a move with no traits of its own (Help or Hinder)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: {}, attributes: { moveTrackers: { "crew-support": { hold: 1 } } } }
		};

		expect(sheet._moveTraits({ key: "help-or-hinder", traits: [] })).toEqual([
			{ key: "crew-support-crew", label: "CREW (Crew Support)", value: 0 }
		]);
	});

	it("does not duplicate CREW on Lead a Sortie, which already offers a real crew fixedTraits entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 0 }, defy: { value: 0 } }, attributes: { moveTrackers: { "crew-support": { hold: 1 } } } }
		};
		const leadASortie = {
			key: "lead-a-sortie",
			traits: ["know", "defy"],
			fixedTraits: [{ key: "crew", label: "CREW", value: 0 }]
		};

		const traits = sheet._moveTraits(leadASortie);

		expect(traits.filter((trait) => trait.key === "crew" || trait.key === "crew-support-crew")).toEqual([
			{ key: "crew", label: "CREW", value: 0 }
		]);
	});

	it("offers the CREW option to a Captain with zero Crew Support hold, labeled for In Command", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { slug: "the-captain" }, stats: { sense: { value: 1 } }, attributes: {} }
		};

		expect(sheet._moveTraits({ key: "read-the-room", traits: ["sense"] })).toEqual([
			{ key: "sense", label: "SENSE", value: 1 },
			{ key: "crew-support-crew", label: "CREW (In Command)", value: 0 }
		]);
	});

	it("does not duplicate CREW for a Captain on Lead a Sortie, which already offers a real crew fixedTraits entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { slug: "the-captain" },
				stats: { know: { value: 0 }, defy: { value: 0 } },
				attributes: {}
			}
		};
		const leadASortie = {
			key: "lead-a-sortie",
			traits: ["know", "defy"],
			fixedTraits: [{ key: "crew", label: "CREW", value: 0 }]
		};

		const traits = sheet._moveTraits(leadASortie);

		expect(traits.filter((trait) => trait.key === "crew" || trait.key === "crew-support-crew")).toEqual([
			{ key: "crew", label: "CREW", value: 0 }
		]);
	});

});
