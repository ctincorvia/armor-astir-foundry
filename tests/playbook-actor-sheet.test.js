import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/actor-creation.js", async (importOriginal) => ({
	...(await importOriginal()),
	swapActorPlaybook: vi.fn()
}));

vi.mock("../scripts/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	postMoveDescription: vi.fn(),
	rollMove: vi.fn()
}));

import { PLAYBOOKS, swapActorPlaybook } from "../scripts/actor-creation.js";
import { BASIC_MOVES, SPECIAL_MOVES, configureMoveRoll, postMoveDescription, rollMove } from "../scripts/moves.js";
import { ADVANCEMENT_TOP, ADVANCEMENT_BOTTOM } from "../scripts/advancements.js";
import { PlaybookActorSheet, registerPlaybookActorSheet, TRAITS } from "../scripts/playbook-actor-sheet.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const BITE_THE_DUST = BASIC_MOVES.find((m) => m.key === "bite-the-dust");
const LEAD_A_SORTIE = SPECIAL_MOVES.find((m) => m.key === "lead-a-sortie");
const SUBSYSTEMS = SPECIAL_MOVES.find((m) => m.key === "subsystems");
const B_PLOT = SPECIAL_MOVES.find((m) => m.key === "b-plot");

beforeEach(() => {
	swapActorPlaybook.mockClear();
	configureMoveRoll.mockClear();
	postMoveDescription.mockClear();
	rollMove.mockClear();
});

describe("PlaybookActorSheet", () => {
	it("extends the core ActorSheet", () => {
		expect(PlaybookActorSheet.prototype instanceof ActorSheet).toBe(true);
	});
});

describe("PlaybookActorSheet.defaultOptions", () => {
	it("merges the playbook sheet's classes/template/size onto the base options", () => {
		const options = PlaybookActorSheet.defaultOptions;

		expect(options).toEqual({
			classes: ["armor-astir", "sheet", "actor", "playbook"],
			template: "modules/armor-astir/templates/playbook-actor-sheet.hbs",
			width: 620,
			height: "auto",
			tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "moves" }]
		});
	});
});

describe("registerPlaybookActorSheet", () => {
	it("registers the sheet as the default character sheet on init", () => {
		registerPlaybookActorSheet();

		expect(Hooks.once).toHaveBeenCalledWith("init", expect.any(Function));

		const callback = Hooks.once.mock.calls.at(-1)[1];
		callback();

		expect(Actors.registerSheet).toHaveBeenCalledWith("pbta", PlaybookActorSheet, {
			types: ["character"],
			makeDefault: true
		});
	});
});

describe("PlaybookActorSheet#getData", () => {
	it("adds the playbook list and the actor's current playbook id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[1].name } } };

		const data = sheet.getData();

		expect(data.playbooks).toBe(PLAYBOOKS);
		expect(data.currentPlaybookId).toBe(PLAYBOOKS[1].packId);
	});

	it("falls back to null when the actor has no playbook set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData();

		expect(data.currentPlaybookId).toBeNull();
	});
});

describe("PlaybookActorSheet#activateListeners", () => {
	it("binds a change handler to the playbook select", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".playbook-select");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onPlaybookChange", () => {
	it("swaps the actor to the selected playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		sheet._onPlaybookChange({ currentTarget: { value: PLAYBOOKS[1].packId } });

		expect(swapActorPlaybook).toHaveBeenCalledWith(sheet.actor, PLAYBOOKS[1]);
	});

	it("does nothing for an unrecognized value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: {} } };

		sheet._onPlaybookChange({ currentTarget: { value: "not-a-real-pack" } });

		expect(swapActorPlaybook).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#getData - traits", () => {
	it("defaults every trait to value 0 and enabled when system.stats is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.traits).toEqual(TRAITS.map(({ key, label }) => ({ key, label, value: 0, disabled: false })));
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

		expect(data.traits.find((t) => t.key === "defy")).toEqual({ key: "defy", label: "DEFY", value: 2, disabled: false });
		expect(data.traits.find((t) => t.key === "channel")).toEqual({ key: "channel", label: "CHANNEL", value: 0, disabled: true });
	});
});

describe("PlaybookActorSheet#getData - overheating", () => {
	it("is visible when channel is missing from stats (reads as enabled)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.overheating).toEqual({ visible: true, value: false });
	});

	it("is visible when channel is explicitly enabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		expect(data.overheating.visible).toBe(true);
	});

	it("is hidden when channel is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		expect(data.overheating.visible).toBe(false);
	});

	it("reflects the actor's stored overheating value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { overheating: { value: true } } } };

		const data = sheet.getData();

		expect(data.overheating.value).toBe(true);
	});
});

describe("PlaybookActorSheet#activateListeners - overheating", () => {
	it("binds a change handler to the overheating checkbox", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".overheating-checkbox");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onOverheatingToggle", () => {
	it("writes the checkbox's checked state to the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onOverheatingToggle({ currentTarget: { checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.overheating.value": true });
	});

	it("writes false when the checkbox is unchecked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { overheating: { value: true } } }, update: vi.fn() };

		sheet._onOverheatingToggle({ currentTarget: { checked: false } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.overheating.value": false });
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

describe("PlaybookActorSheet#getData - power", () => {
	it("is visible when channel is missing from stats (reads as enabled)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.power).toEqual({ visible: true, value: 0 });
	});

	it("is hidden when channel is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		expect(data.power.visible).toBe(false);
	});

	it("reflects the actor's stored power value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { power: { value: 3 } } } };

		const data = sheet.getData();

		expect(data.power.value).toBe(3);
	});
});

describe("PlaybookActorSheet#activateListeners - power step", () => {
	it("binds a click handler to the power step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".power-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onPowerStep", () => {
	it("increments the power value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { power: { value: 1 } } }, update: vi.fn() };

		sheet._onPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.power.value": 2 });
	});

	it("decrements the power value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { power: { value: 1 } } }, update: vi.fn() };

		sheet._onPowerStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.power.value": 0 });
	});

	it("treats a missing power value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };

		sheet._onPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.power.value": 1 });
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { power: { value: 4 } } }, update: vi.fn() };

		sheet._onPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { power: { value: 0 } } }, update: vi.fn() };

		sheet._onPowerStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
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

describe("PlaybookActorSheet#getData - dangers", () => {
	it("defaults to an empty list, not at max, and able to add when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.dangers).toEqual({ max: 3, list: [], atMax: false, canAdd: true });
	});

	it("marks each danger as a peril or a risk based on its stored type", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "Exposed position" },
						{ id: "2", type: "risk", label: "Low on ammo" }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.dangers.list).toEqual([
			{ id: "1", type: "peril", label: "Exposed position", isPeril: true },
			{ id: "2", type: "risk", label: "Low on ammo", isPeril: false }
		]);
	});

	it("reports atMax and hides canAdd once the actor has 3 dangers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					dangers: [
						{ id: "1", type: "risk", label: "a" },
						{ id: "2", type: "risk", label: "b" },
						{ id: "3", type: "risk", label: "c" }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.dangers.atMax).toBe(true);
		expect(data.dangers.canAdd).toBe(false);
	});
});

describe("PlaybookActorSheet#activateListeners - dangers", () => {
	it("binds click handlers to the danger add and remove buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".danger-add");
		expect(html.find).toHaveBeenCalledWith(".danger-remove");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

// Fakes the DOM traversal _onDangerAdd uses to read the label/type inputs sitting next to the
// clicked Add button (closest(".danger-add-controls") -> querySelector(...)), since there's no
// single value to encode on the button's own dataset the way every other control on this sheet
// does.
function fakeDangerAddEvent({ label, type = "risk" }) {
	const labelInput = { value: label };
	const typeSelect = { value: type };
	return {
		currentTarget: {
			closest: () => ({
				querySelector: (selector) => (selector === ".danger-label-input" ? labelInput : typeSelect)
			})
		},
		labelInput
	};
}

describe("PlaybookActorSheet#_onDangerAdd", () => {
	it("appends a new danger with a generated id and clears the label input", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { dangers: [] } }, update: vi.fn() };
		const { labelInput, ...event } = fakeDangerAddEvent({ label: "Exposed position", type: "peril" });

		sheet._onDangerAdd(event);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [{ id: "test-id", type: "peril", label: "Exposed position" }]
		});
		expect(labelInput.value).toBe("");
	});

	it("appends to, rather than replaces, existing dangers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { dangers: [{ id: "existing", type: "risk", label: "Low on ammo" }] } },
			update: vi.fn()
		};
		const { ...event } = fakeDangerAddEvent({ label: "Losing blood", type: "peril" });

		sheet._onDangerAdd(event);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [
				{ id: "existing", type: "risk", label: "Low on ammo" },
				{ id: "test-id", type: "peril", label: "Losing blood" }
			]
		});
	});

	it("trims the label and does nothing when it's blank", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { dangers: [] } }, update: vi.fn() };
		const { ...event } = fakeDangerAddEvent({ label: "   " });

		sheet._onDangerAdd(event);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing once the actor already has the maximum dangers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					dangers: [
						{ id: "1", type: "risk", label: "a" },
						{ id: "2", type: "risk", label: "b" },
						{ id: "3", type: "risk", label: "c" }
					]
				}
			},
			update: vi.fn()
		};
		const { ...event } = fakeDangerAddEvent({ label: "One more" });

		sheet._onDangerAdd(event);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing dangers array as starting empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };
		const { ...event } = fakeDangerAddEvent({ label: "First danger", type: "risk" });

		sheet._onDangerAdd(event);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [{ id: "test-id", type: "risk", label: "First danger" }]
		});
	});
});

describe("PlaybookActorSheet#_onDangerRemove", () => {
	it("removes the danger matching the clicked button's id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					dangers: [
						{ id: "1", type: "risk", label: "a" },
						{ id: "2", type: "peril", label: "b" }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onDangerRemove({ currentTarget: { dataset: { dangerId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [{ id: "2", type: "peril", label: "b" }]
		});
	});

	it("leaves the list untouched when the id doesn't match any danger", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { dangers: [{ id: "1", type: "risk", label: "a" }] } },
			update: vi.fn()
		};

		sheet._onDangerRemove({ currentTarget: { dataset: { dangerId: "not-a-real-id" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [{ id: "1", type: "risk", label: "a" }]
		});
	});
});

describe("PlaybookActorSheet#getData - gravity clocks", () => {
	it("defaults to an empty list and able to add when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.gravityClocks).toEqual({ max: 5, canAdd: true, list: [] });
	});

	it("expands each clock's stored progress into a Spotlight-style steps array", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: [
						{ id: "1", label: "The Council Turns", progress: 2, value: 1 },
						{ id: "2", label: "Fuel Runs Out", progress: 0, value: 3 }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.gravityClocks.list).toEqual([
			{
				id: "1",
				label: "The Council Turns",
				progress: 2,
				value: 1,
				progressSteps: [
					{ step: 1, filled: true },
					{ step: 2, filled: true },
					{ step: 3, filled: false },
					{ step: 4, filled: false },
					{ step: 5, filled: false },
					{ step: 6, filled: false }
				]
			},
			{
				id: "2",
				label: "Fuel Runs Out",
				progress: 0,
				value: 3,
				progressSteps: [1, 2, 3, 4, 5, 6].map((step) => ({ step, filled: false }))
			}
		]);
	});

	it("treats a clock with no stored progress as starting at 0 when expanding steps", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "New clock", value: 1 }] } }
		};

		const data = sheet.getData();

		expect(data.gravityClocks.list[0].progressSteps).toEqual([1, 2, 3, 4, 5, 6].map((step) => ({ step, filled: false })));
	});

	it("hides canAdd once the actor has 5 gravity clocks", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, label: "", progress: 0, value: 1 }))
				}
			}
		};

		const data = sheet.getData();

		expect(data.gravityClocks.canAdd).toBe(false);
	});
});

describe("PlaybookActorSheet#activateListeners - gravity clocks", () => {
	it("binds handlers to the add, remove, label, value step, and progress step controls", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".gravity-clock-add");
		expect(html.find).toHaveBeenCalledWith(".gravity-clock-remove");
		expect(html.find).toHaveBeenCalledWith(".gravity-clock-label-input");
		expect(html.find).toHaveBeenCalledWith(".gravity-clock-value-step");
		expect(html.find).toHaveBeenCalledWith(".gravity-clock-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onGravityClockAdd", () => {
	it("appends a new clock with a generated id and default progress/value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { gravityClocks: [] } }, update: vi.fn() };

		sheet._onGravityClockAdd({});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "test-id", label: "", progress: 0, value: 1 }]
		});
	});

	it("appends to, rather than replaces, existing clocks", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "existing", label: "Existing", progress: 3, value: 2 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockAdd({});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [
				{ id: "existing", label: "Existing", progress: 3, value: 2 },
				{ id: "test-id", label: "", progress: 0, value: 1 }
			]
		});
	});

	it("treats a missing gravityClocks array as starting empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onGravityClockAdd({});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "test-id", label: "", progress: 0, value: 1 }]
		});
	});

	it("does nothing once the actor already has the maximum gravity clocks", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, label: "", progress: 0, value: 1 }))
				}
			},
			update: vi.fn()
		};

		sheet._onGravityClockAdd({});

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onGravityClockRemove", () => {
	it("removes the clock matching the clicked button's id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: [
						{ id: "1", label: "a", progress: 0, value: 1 },
						{ id: "2", label: "b", progress: 0, value: 1 }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onGravityClockRemove({ currentTarget: { dataset: { clockId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "2", label: "b", progress: 0, value: 1 }]
		});
	});

	it("leaves the list untouched when the id doesn't match any clock", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockRemove({ currentTarget: { dataset: { clockId: "not-a-real-id" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 0, value: 1 }]
		});
	});
});

describe("PlaybookActorSheet#_onGravityClockLabelChange", () => {
	it("trims and updates only the matching clock's label", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: [
						{ id: "1", label: "Old label", progress: 0, value: 1 },
						{ id: "2", label: "Untouched", progress: 0, value: 1 }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onGravityClockLabelChange({ currentTarget: { dataset: { clockId: "1" }, value: "  New label  " } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [
				{ id: "1", label: "New label", progress: 0, value: 1 },
				{ id: "2", label: "Untouched", progress: 0, value: 1 }
			]
		});
	});
});

describe("PlaybookActorSheet#_onGravityClockValueStep", () => {
	it("increments the matching clock's value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 0, value: 2 }]
		});
	});

	it("decrements the matching clock's value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 2 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 0, value: 1 }]
		});
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 3 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the id doesn't match any clock", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "not-a-real-id", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing value as starting at the minimum", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 0, value: 2 }]
		});
	});

	it("does not affect other clocks in the list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: [
						{ id: "1", label: "a", progress: 0, value: 1 },
						{ id: "2", label: "b", progress: 0, value: 2 }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [
				{ id: "1", label: "a", progress: 0, value: 2 },
				{ id: "2", label: "b", progress: 0, value: 2 }
			]
		});
	});
});

describe("PlaybookActorSheet#_onGravityClockStep", () => {
	it("fills the matching clock's track up to a clicked step above the current progress", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 1, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "4" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 4, value: 1 }]
		});
	});

	it("empties the matching clock's track down to a clicked step below the current progress", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 5, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "2" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 2, value: 1 }]
		});
	});

	it("decrements by one when clicking the current top (highest filled) step", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 3, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "3" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 2, value: 1 }]
		});
	});

	it("clamps a step beyond the track's max and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 6, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "7" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing progress value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "2" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", value: 1, progress: 2 }]
		});
	});

	it("does not affect other clocks in the list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: [
						{ id: "1", label: "a", progress: 1, value: 1 },
						{ id: "2", label: "b", progress: 3, value: 2 }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "4" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [
				{ id: "1", label: "a", progress: 4, value: 1 },
				{ id: "2", label: "b", progress: 3, value: 2 }
			]
		});
	});

	it("does nothing when the id doesn't match any clock", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "not-a-real-id", step: "2" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
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

describe("PlaybookActorSheet#getData - moves", () => {
	it("exposes basic moves grouped, with each move's currently enabled traits and values", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 1 }, talk: { value: -1 } } } };

		const data = sheet.getData();

		expect(data.moveGroups).toEqual([
			{
				label: "Basic Moves",
				moves: [
					{
						key: "exchange-blows",
						name: "Exchange Blows",
						traits: [
							{ key: "clash", label: "CLASH", value: 1 },
							{ key: "talk", label: "TALK", value: -1 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0
					},
					{
						key: "weather-the-storm",
						name: "Weather the Storm",
						traits: [
							{ key: "defy", label: "DEFY", value: 0 },
							{ key: "know", label: "KNOW", value: 0 },
							{ key: "sense", label: "SENSE", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0
					},
					{
						key: "read-the-room",
						name: "Read the Room",
						traits: [
							{ key: "sense", label: "SENSE", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: true,
						separateHoldPool: false,
						hold: 0
					},
					{
						key: "dispel-uncertainties",
						name: "Dispel Uncertainties",
						traits: [
							{ key: "know", label: "KNOW", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0
					},
					{
						key: "help-or-hinder",
						name: "Help or Hinder",
						traits: [],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0
					},
					{
						key: "weave-magic",
						name: "Weave Magic",
						// channel isn't in this actor's stats at all — same as any other missing stat,
						// that reads as enabled rather than gated (see availableMoveTraits).
						traits: [
							{ key: "channel", label: "CHANNEL", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0
					},
					{
						key: "cool-off",
						name: "Cool Off",
						traits: [
							{ key: "defy", label: "DEFY", value: 0 },
							{ key: "sense", label: "SENSE", value: 0 },
							{ key: "clash", label: "CLASH", value: 1 },
							{ key: "talk", label: "TALK", value: -1 },
							{ key: "know", label: "KNOW", value: 0 },
							{ key: "channel", label: "CHANNEL", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0
					},
					{
						key: "strike-decisively",
						name: "Strike Decisively",
						traits: [
							{ key: "clash", label: "CLASH", value: 1 },
							{ key: "talk", label: "TALK", value: -1 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0
					},
					{
						key: "bite-the-dust",
						name: "Bite the Dust",
						traits: [
							{ key: "defy", label: "DEFY", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0
					}
				]
			},
			{
				label: "Special Moves",
				moves: [
					{
						key: "lead-a-sortie",
						name: "Lead a Sortie",
						traits: [
							{ key: "know", label: "KNOW", value: 0 },
							{ key: "defy", label: "DEFY", value: 0 },
							{ key: "crew", label: "CREW", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0
					},
					{
						key: "subsystems",
						name: "Subsystems",
						traits: [],
						gated: false,
						rollable: false,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0
					},
					{
						key: "b-plot",
						name: "B-Plot",
						traits: [],
						// channel isn't in this actor's stats at all, which reads as enabled — so
						// b-plot is gated here, the mirror image of weave-magic above.
						gated: true,
						rollable: false,
						activatable: true,
						descriptionGated: true,
						trackHold: true,
						separateHoldPool: true,
						hold: 0
					}
				]
			}
		]);
	});

	it("omits a move's disabled traits from the trait list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 1, disabled: true }, talk: { value: 0 } } } };

		const data = sheet.getData();

		expect(data.moveGroups[0].moves[0].traits).toEqual([{ key: "talk", label: "TALK", value: 0 }]);
	});
});

describe("PlaybookActorSheet#getData - gated moves", () => {
	it("gates weave magic's Roll button when CHANNEL is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		const weaveMagic = data.moveGroups[0].moves.find((m) => m.key === "weave-magic");
		expect(weaveMagic.gated).toBe(true);
		expect(weaveMagic.traits).toEqual([]);
	});

	it("un-gates weave magic once CHANNEL is enabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		const weaveMagic = data.moveGroups[0].moves.find((m) => m.key === "weave-magic");
		expect(weaveMagic.gated).toBe(false);
		expect(weaveMagic.traits).toEqual([{ key: "channel", label: "CHANNEL", value: 1 }]);
	});

	it("never gates help or hinder, which has no stat traits by design", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.moveGroups[0].moves.find((m) => m.key === "help-or-hinder").gated).toBe(false);
	});

	it("gates b-plot when CHANNEL is enabled, the mirror image of weave magic", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "b-plot").gated).toBe(true);
	});

	it("gates b-plot when CHANNEL is missing from stats (reads as enabled)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "b-plot").gated).toBe(true);
	});

	it("un-gates b-plot once CHANNEL is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "b-plot").gated).toBe(false);
	});

	it("never gates lead a sortie or subsystems off CHANNEL, unlike b-plot", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "lead-a-sortie").gated).toBe(false);
		expect(data.moveGroups[1].moves.find((m) => m.key === "subsystems").gated).toBe(false);
	});

	it("also greys out b-plot's Description button when CHANNEL is enabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "b-plot").descriptionGated).toBe(true);
	});

	it("un-greys b-plot's Description button once CHANNEL is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "b-plot").descriptionGated).toBe(false);
	});

	it("never greys out weave magic's Description button, unlike b-plot", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		const weaveMagic = data.moveGroups[0].moves.find((m) => m.key === "weave-magic");
		expect(weaveMagic.gated).toBe(true);
		expect(weaveMagic.descriptionGated).toBe(false);
	});
});

describe("PlaybookActorSheet#getData - hold", () => {
	it("marks trackHold true only for moves that define a hold track", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();
		const holdFlags = Object.fromEntries(data.moveGroups[0].moves.map((m) => [m.key, m.trackHold]));

		expect(holdFlags).toEqual({
			"exchange-blows": false,
			"weather-the-storm": false,
			"read-the-room": true,
			"dispel-uncertainties": false,
			"help-or-hinder": false,
			"weave-magic": false,
			"cool-off": false,
			"strike-decisively": false,
			"bite-the-dust": false
		});
	});

	it("reflects the actor's current hold value on every move, defaulting to 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, resources: { hold: { value: 2 } } } };

		const data = sheet.getData();

		for (const move of data.moveGroups[0].moves) {
			expect(move.hold).toBe(2);
		}
	});
});

describe("PlaybookActorSheet#getData - b-plot's separate hold pool", () => {
	it("reads b-plot's hold from system.attributes.bplotHold, not the shared resources.hold pool", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				resources: { hold: { value: 5 } },
				attributes: { bplotHold: { value: 2 } }
			}
		};

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "b-plot").hold).toBe(2);
		// Read the Room (a basic move) keeps reading the shared pool, unaffected by bplotHold.
		expect(data.moveGroups[0].moves.find((m) => m.key === "read-the-room").hold).toBe(5);
	});

	it("defaults b-plot's hold to 0 when bplotHold is missing", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "b-plot").hold).toBe(0);
	});
});

describe("PlaybookActorSheet#activateListeners - hold step", () => {
	it("binds a click handler to the hold step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".hold-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onHoldStep", () => {
	it("increments the hold value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { resources: { hold: { value: 1 } } }, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 2 });
	});

	it("decrements the hold value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { resources: { hold: { value: 1 } } }, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 0 });
	});

	it("treats a missing hold value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 1 });
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { resources: { hold: { value: 3 } } }, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { resources: { hold: { value: 0 } } }, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#activateListeners - bplot hold step", () => {
	it("binds a click handler to the bplot hold step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".bplot-hold-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onBplotHoldStep", () => {
	it("increments the bplot hold value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { bplotHold: { value: 1 } } }, update: vi.fn() };

		sheet._onBplotHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.bplotHold.value": 2 });
	});

	it("decrements the bplot hold value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { bplotHold: { value: 1 } } }, update: vi.fn() };

		sheet._onBplotHoldStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.bplotHold.value": 0 });
	});

	it("treats a missing bplot hold value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };

		sheet._onBplotHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.bplotHold.value": 1 });
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { bplotHold: { value: 3 } } }, update: vi.fn() };

		sheet._onBplotHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { bplotHold: { value: 0 } } }, update: vi.fn() };

		sheet._onBplotHoldStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does not affect the shared resources.hold field", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { bplotHold: { value: 1 } }, resources: { hold: { value: 5 } } },
			update: vi.fn()
		};

		sheet._onBplotHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.bplotHold.value": 2 });
		expect(sheet.actor.update).not.toHaveBeenCalledWith(expect.objectContaining({
			"system.resources.hold.value": expect.anything()
		}));
	});
});

describe("PlaybookActorSheet#activateListeners - moves", () => {
	it("binds click handlers to the move roll and description buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".move-roll");
		expect(html.find).toHaveBeenCalledWith(".move-activate");
		expect(html.find).toHaveBeenCalledWith(".move-description");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onMoveRoll", () => {
	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "not-a-real-move" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does nothing when the move has no enabled traits to roll with", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { disabled: true }, talk: { disabled: true } } } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does not roll when the roll dialog is dismissed without a selection", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 }, talk: { value: 0 } } } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).not.toHaveBeenCalled();
	});

	it("still opens the roll dialog for help or hinder, which has no stat traits at all", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "help-or-hinder" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			BASIC_MOVES.find((m) => m.key === "help-or-hinder"),
			[],
			{ lockedEffect: null }
		);
	});

	it("configures the roll, then rolls the move with the chosen trait and modifiers", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 1 }, talk: { value: 0 } } } };
		const talk = { key: "talk", label: "TALK", value: 0 };
		const config = { trait: talk, advantage: "advantage", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[
				{ key: "clash", label: "CLASH", value: 1 },
				{ key: "talk", label: "TALK", value: 0 }
			],
			{ lockedEffect: null }
		);
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, talk, config);
	});

	it("finds a special move (lead a sortie) by key, same as a basic move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 }, defy: { value: 0 } } } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			LEAD_A_SORTIE,
			[
				{ key: "know", label: "KNOW", value: 1 },
				{ key: "defy", label: "DEFY", value: 0 },
				{ key: "crew", label: "CREW", value: 0 }
			],
			{ lockedEffect: null }
		);
	});

	it("does nothing for subsystems, which has no traits, conditions, or fixed traits to roll", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "subsystems" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does nothing for b-plot, which has no traits, conditions, or fixed traits to roll", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onMoveRoll - bite the dust's locked Desperation", () => {
	const defy = { key: "defy", label: "DEFY", value: 0 };

	it("locks Desperation when at max Dangers and every one is a Peril", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "peril", label: "c" }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], { lockedEffect: "desperation" });
	});

	it("does not lock Desperation when at max Dangers but the types are mixed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "risk", label: "c" }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], { lockedEffect: null });
	});

	it("does not lock Desperation when below max Dangers, even if all are Perils", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], { lockedEffect: null });
	});

	it("never locks Desperation for a move without forcesDesperationAtMaxPerils, even at max Perils", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "peril", label: "c" }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[
				{ key: "clash", label: "CLASH", value: 0 },
				{ key: "talk", label: "TALK", value: 0 }
			],
			{ lockedEffect: null }
		);
	});
});

describe("PlaybookActorSheet#_onMoveActivate", () => {
	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "not-a-real-move" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for a move with no flat hold to grant, e.g. lead a sortie", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("adds b-plot's flat hold to the actor's bplotHold pool", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.bplotHold.value": 3 });
	});

	it("adds to, rather than replaces, an existing bplotHold value", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { bplotHold: { value: 1 } } }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.bplotHold.value": 3 });
	});

	it("clamps at the maximum and does not update the actor", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { bplotHold: { value: 3 } } }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does not affect the shared resources.hold field", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: {}, resources: { hold: { value: 5 } } },
			update: vi.fn()
		};

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(sheet.actor.update).not.toHaveBeenCalledWith(expect.objectContaining({
			"system.resources.hold.value": expect.anything()
		}));
	});
});

describe("PlaybookActorSheet#_onMoveDescription", () => {
	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "not-a-real-move" } } });

		expect(postMoveDescription).not.toHaveBeenCalled();
	});

	it("posts the move's description to chat", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS);
	});

	it("finds a special move (subsystems) by key, same as a basic move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "subsystems" } } });

		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, SUBSYSTEMS);
	});

	it("posts b-plot's description even when it's gated (CHANNEL enabled)", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, B_PLOT);
	});
});
