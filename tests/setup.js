import { vi } from "vitest";

// Minimal stand-ins for the Foundry VTT globals that module code touches.
// Extend these as real scripts start using more of the Foundry API.
vi.stubGlobal("Hooks", {
	once: vi.fn(),
	on: vi.fn(),
	off: vi.fn(),
	call: vi.fn(),
	callAll: vi.fn()
});

vi.stubGlobal("game", {
	settings: {
		register: vi.fn(),
		get: vi.fn(),
		set: vi.fn()
	},
	i18n: {
		localize: (key) => key
	},
	packs: {
		get: vi.fn()
	}
});

vi.stubGlobal("foundry", {
	utils: {
		mergeObject: (...objects) => Object.assign({}, ...objects)
	}
});

// Legacy V1 Application classes are exposed as bare globals by Foundry (not under
// foundry.appv1) on the pbta-supported core version this module targets.
vi.stubGlobal("ActorSheet", class ActorSheet {
	static get defaultOptions() {
		return {};
	}

	getData() {
		return {};
	}

	activateListeners() {}
});

vi.stubGlobal("Actors", {
	registerSheet: vi.fn()
});

vi.stubGlobal("Actor", {
	create: vi.fn()
});

vi.stubGlobal("Dialog", vi.fn().mockImplementation(function (data) {
	this.data = data;
	this.render = vi.fn();
}));

vi.stubGlobal("ui", {
	notifications: {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn()
	}
});

// total is getter-only in real Foundry (backed by the internal _total field, with no setter),
// so module code writes roll._total directly rather than roll.total — mirrored here so tests
// exercise the same shape rather than a plain writable property that would mask a real bug.
const RollMock = vi.fn().mockImplementation(function (formula, data) {
	this.formula = formula;
	this.data = data;
	this._total = 0;
	this.terms = [];
	this.dice = [{ results: [], modifiers: [] }];
	this.evaluate = vi.fn().mockResolvedValue(this);
	this.toMessage = vi.fn().mockResolvedValue(undefined);
	Object.defineProperty(this, "total", { get: () => this._total, configurable: true });
});
vi.stubGlobal("Roll", RollMock);

vi.stubGlobal("ChatMessage", {
	create: vi.fn(),
	getSpeaker: vi.fn()
});

vi.stubGlobal("renderTemplate", vi.fn().mockResolvedValue(""));
