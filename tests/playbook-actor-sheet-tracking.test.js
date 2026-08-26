import { describe, expect, it, vi } from "vitest";

import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { HOOK_DEPTHS } from "../scripts/playbook/playbook-sheet/tracking-mixin.js";

describe("PlaybookActorSheet#getData - dangers", () => {
	it("defaults to an empty list, not at max, and able to add when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.dangers).toEqual({ max: 3, list: [], atMax: false, canAdd: true, addOpen: false });
	});

	it("reports addOpen once toggled open, while still below max", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };
		sheet._dangerAddOpen = true;

		const data = sheet.getData();

		expect(data.dangers.addOpen).toBe(true);
	});

	it("hides addOpen once at max, even if toggled open", () => {
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
		sheet._dangerAddOpen = true;

		const data = sheet.getData();

		expect(data.dangers.addOpen).toBe(false);
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

		expect(html.find).toHaveBeenCalledWith(".danger-add-toggle");
		expect(html.find).toHaveBeenCalledWith(".danger-add");
		expect(html.find).toHaveBeenCalledWith(".danger-remove");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onDangerAddToggle", () => {
	it("flips _dangerAddOpen and re-renders", () => {
		const sheet = new PlaybookActorSheet();
		sheet.render = vi.fn();

		sheet._onDangerAddToggle();

		expect(sheet._dangerAddOpen).toBe(true);
		expect(sheet.render).toHaveBeenCalledTimes(1);

		sheet._onDangerAddToggle();

		expect(sheet._dangerAddOpen).toBe(false);
		expect(sheet.render).toHaveBeenCalledTimes(2);
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

	// Players add dangers one at a time in practice, so a successful add closes the row back up
	// rather than leaving it open for another entry.
	it("closes the add-danger row once a danger is successfully added", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { dangers: [] } }, update: vi.fn() };
		sheet._dangerAddOpen = true;
		const { ...event } = fakeDangerAddEvent({ label: "Exposed position", type: "peril" });

		sheet._onDangerAdd(event);

		expect(sheet._dangerAddOpen).toBe(false);
	});

	it("leaves the add-danger row open when the label is blank", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { dangers: [] } }, update: vi.fn() };
		sheet._dangerAddOpen = true;
		const { ...event } = fakeDangerAddEvent({ label: "   " });

		sheet._onDangerAdd(event);

		expect(sheet._dangerAddOpen).toBe(true);
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

describe("PlaybookActorSheet#getData - burdens", () => {
	it("defaults to an empty list when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet.getData().burdens).toEqual({ list: [] });
	});

	it("exposes the actor's stored burdens as-is, with no derived per-entry shape", () => {
		const sheet = new PlaybookActorSheet();
		const burdens = [{ id: "1", label: "A lingering injury" }, { id: "2", label: "A promise made" }];
		sheet.actor = { system: { attributes: { burdens } } };

		expect(sheet.getData().burdens).toEqual({ list: burdens });
	});
});

describe("PlaybookActorSheet#activateListeners - burdens", () => {
	it("binds handlers to the add, remove and label controls", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".burden-add");
		expect(html.find).toHaveBeenCalledWith(".burden-remove");
		expect(html.find).toHaveBeenCalledWith(".burden-label-input");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onBurdenAdd", () => {
	it("appends a new burden with a generated id and blank label", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { burdens: [] } }, update: vi.fn() };

		sheet._onBurdenAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.burdens": [{ id: "test-id", label: "" }]
		});
	});

	it("appends to, rather than replaces, existing burdens", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { burdens: [{ id: "existing", label: "Existing" }] } },
			update: vi.fn()
		};

		sheet._onBurdenAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.burdens": [{ id: "existing", label: "Existing" }, { id: "test-id", label: "" }]
		});
	});

	it("treats a missing burdens array as starting empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onBurdenAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.burdens": [{ id: "test-id", label: "" }]
		});
	});
});

describe("PlaybookActorSheet#_onBurdenRemove", () => {
	it("removes the burden matching the clicked button's id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: { burdens: [{ id: "1", label: "A" }, { id: "2", label: "B" }] }
			},
			update: vi.fn()
		};

		sheet._onBurdenRemove({ currentTarget: { dataset: { burdenId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.burdens": [{ id: "2", label: "B" }]
		});
	});
});

describe("PlaybookActorSheet#_onBurdenLabelChange", () => {
	it("writes the trimmed label to the matching burden", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { burdens: [{ id: "1", label: "" }] } },
			update: vi.fn()
		};

		sheet._onBurdenLabelChange({ currentTarget: { dataset: { burdenId: "1" }, value: "  A lingering injury  " } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.burdens": [{ id: "1", label: "A lingering injury" }]
		});
	});

	it("leaves every other burden untouched", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { burdens: [{ id: "1", label: "A" }, { id: "2", label: "B" }] } },
			update: vi.fn()
		};

		sheet._onBurdenLabelChange({ currentTarget: { dataset: { burdenId: "2" }, value: "Changed" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.burdens": [{ id: "1", label: "A" }, { id: "2", label: "Changed" }]
		});
	});
});

describe("PlaybookActorSheet#getData - hooks", () => {
	it("defaults to an empty list when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet.getData().hooks).toEqual({ depths: HOOK_DEPTHS, list: [] });
	});

	it("exposes the actor's stored hooks as-is, with no derived per-entry shape", () => {
		const sheet = new PlaybookActorSheet();
		const hooks = [
			{ id: "1", description: "A debt owed to a stranger", depth: "loose" },
			{ id: "2", description: "A promise to a dying friend", depth: "deep" }
		];
		sheet.actor = { system: { attributes: { hooks } } };

		expect(sheet.getData().hooks).toEqual({ depths: HOOK_DEPTHS, list: hooks });
	});
});

describe("PlaybookActorSheet#activateListeners - hooks", () => {
	it("binds handlers to the add, remove and field controls", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".hook-add");
		expect(html.find).toHaveBeenCalledWith(".hook-remove");
		expect(html.find).toHaveBeenCalledWith(".hook-field");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onHookAdd", () => {
	it("appends a new hook with a generated id, blank description, and normal depth", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { hooks: [] } }, update: vi.fn() };

		sheet._onHookAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.hooks": [{ id: "test-id", description: "", depth: "normal" }]
		});
	});

	it("appends to, rather than replaces, existing hooks", () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "h1", description: "An old rivalry", depth: "loose" };
		sheet.actor = { system: { attributes: { hooks: [existing] } }, update: vi.fn() };

		sheet._onHookAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.hooks": [existing, { id: "test-id", description: "", depth: "normal" }]
		});
	});

	it("treats a missing hooks array as starting empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onHookAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.hooks": [{ id: "test-id", description: "", depth: "normal" }]
		});
	});
});

describe("PlaybookActorSheet#_onHookRemove", () => {
	it("removes the matching hook, leaving others untouched", () => {
		const sheet = new PlaybookActorSheet();
		const a = { id: "h1", description: "An old rivalry", depth: "loose" };
		const b = { id: "h2", description: "A debt owed", depth: "deep" };
		sheet.actor = { system: { attributes: { hooks: [a, b] } }, update: vi.fn() };

		sheet._onHookRemove({ currentTarget: { dataset: { entryId: "h1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.hooks": [b] });
	});
});

describe("PlaybookActorSheet#_onHookFieldChange", () => {
	it("updates the matching hook's description field, leaving others untouched", () => {
		const sheet = new PlaybookActorSheet();
		const a = { id: "h1", description: "", depth: "normal" };
		const b = { id: "h2", description: "Unchanged", depth: "loose" };
		sheet.actor = { system: { attributes: { hooks: [a, b] } }, update: vi.fn() };

		sheet._onHookFieldChange({
			currentTarget: { dataset: { entryId: "h1", field: "description" }, value: "A debt owed to a stranger" }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.hooks": [{ id: "h1", description: "A debt owed to a stranger", depth: "normal" }, b]
		});
	});

	it("updates the matching hook's depth field, leaving others untouched", () => {
		const sheet = new PlaybookActorSheet();
		const a = { id: "h1", description: "A debt owed", depth: "normal" };
		const b = { id: "h2", description: "Unchanged", depth: "loose" };
		sheet.actor = { system: { attributes: { hooks: [a, b] } }, update: vi.fn() };

		sheet._onHookFieldChange({
			currentTarget: { dataset: { entryId: "h1", field: "depth" }, value: "deep" }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.hooks": [{ id: "h1", description: "A debt owed", depth: "deep" }, b]
		});
	});

	it("writes a boolean, not the raw string value, for a checkbox field like shaken", () => {
		const sheet = new PlaybookActorSheet();
		const a = { id: "h1", description: "A vow", depth: "normal", shaken: false };
		const b = { id: "h2", description: "Unchanged", depth: "loose" };
		sheet.actor = { system: { attributes: { hooks: [a, b] } }, update: vi.fn() };

		sheet._onHookFieldChange({
			currentTarget: { dataset: { entryId: "h1", field: "shaken" }, type: "checkbox", checked: true, value: "on" }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.hooks": [{ id: "h1", description: "A vow", depth: "normal", shaken: true }, b]
		});
	});
});

describe("PlaybookActorSheet#getData - gravity clocks", () => {
	it("defaults to an empty list and able to add when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.gravityClocks).toEqual({ max: 4, canAdd: true, list: [] });
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
