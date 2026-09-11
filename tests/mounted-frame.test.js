import { describe, expect, it } from "vitest";
import { getMountedFrameName } from "../scripts/frames/mounted-frame.js";
import { ARDENT_DEFAULT_NAME } from "../scripts/frames/ardent.js";

describe("getMountedFrameName", () => {
	it("returns null when the actor has no Astir and no Ardents", () => {
		const actor = { name: "Riley", system: { attributes: {} } };

		expect(getMountedFrameName(actor)).toBeNull();
	});

	it("returns null when the actor has no system data at all", () => {
		const actor = { name: "Riley" };

		expect(getMountedFrameName(actor)).toBeNull();
	});

	it("returns null when an Astir exists but isn't piloted and no Ardent is piloted either", () => {
		const actor = {
			name: "Riley",
			system: { attributes: { astir: { piloted: false }, ardents: [{ id: "a1", name: "Bucket", piloted: false }] } }
		};

		expect(getMountedFrameName(actor)).toBeNull();
	});

	it("returns the Callsign when the Astir is piloted and a Callsign is set", () => {
		const actor = {
			name: "Riley",
			system: {
				details: { callsign: { value: "Ghost" } },
				attributes: { astir: { piloted: true } }
			}
		};

		expect(getMountedFrameName(actor)).toBe("Ghost");
	});

	it("falls back to the actor's own name when the Astir is piloted with no Callsign set", () => {
		const actor = {
			name: "Riley",
			system: {
				details: { callsign: { value: "" } },
				attributes: { astir: { piloted: true } }
			}
		};

		expect(getMountedFrameName(actor)).toBe("Riley");
	});

	it("returns the piloted Ardent's own stored name", () => {
		const actor = {
			name: "Riley",
			system: {
				attributes: {
					astir: { piloted: false },
					ardents: [
						{ id: "a1", name: "Bucket", piloted: false },
						{ id: "a2", name: "Warden", piloted: true }
					]
				}
			}
		};

		expect(getMountedFrameName(actor)).toBe("Warden");
	});

	it("falls back to ARDENT_DEFAULT_NAME when the piloted Ardent's name is empty", () => {
		const actor = {
			name: "Riley",
			system: { attributes: { ardents: [{ id: "a1", name: "", piloted: true }] } }
		};

		expect(getMountedFrameName(actor)).toBe(ARDENT_DEFAULT_NAME);
	});
});
