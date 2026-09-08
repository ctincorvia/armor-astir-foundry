import { describe, expect, it } from "vitest";

import { configureMoveCustomization } from "../scripts/moves/move-customization-dialogs.js";

function fakeMoveCustomizationHtml(values) {
	return { find: (selector) => ({ val: () => values[selector] }) };
}

describe("configureMoveCustomization", () => {
	it("renders the editor template pre-filled from the passed-in move's current name/description", async () => {
		const promise = configureMoveCustomization({ key: "the-scout:bullheaded", name: "Bullheaded", description: "Stubborn." });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(
			expect.stringContaining("move-customization-editor"),
			{ name: "Bullheaded", description: "Stubborn." }
		);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves the trimmed name/description when Save is clicked with a name", async () => {
		const promise = configureMoveCustomization({ key: "the-scout:bullheaded", name: "Bullheaded", description: "Stubborn." });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeMoveCustomizationHtml({
			"[name='name']": "  Stubborn Streak  ",
			"[name='description']": "  Even more stubborn.  "
		}));

		expect(await promise).toEqual({ name: "Stubborn Streak", description: "Even more stubborn." });
	});

	it("warns and resolves null when Save is clicked with a blank name", async () => {
		const promise = configureMoveCustomization({ key: "the-scout:bullheaded", name: "Bullheaded", description: "Stubborn." });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeMoveCustomizationHtml({
			"[name='name']": "   ",
			"[name='description']": "Stubborn."
		}));

		expect(await promise).toBeNull();
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it("resolves null when Cancel is clicked", async () => {
		const promise = configureMoveCustomization({ key: "the-scout:bullheaded", name: "Bullheaded", description: "Stubborn." });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.cancel.callback();

		expect(await promise).toBeNull();
	});

	it("resolves null when the dialog is dismissed without a button click", async () => {
		const promise = configureMoveCustomization({ key: "the-scout:bullheaded", name: "Bullheaded", description: "Stubborn." });
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});
});
