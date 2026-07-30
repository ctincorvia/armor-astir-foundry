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
	}
});
