import { describe, expect, it, vi } from "vitest";

import { configureMoveCustomization } from "../scripts/moves/move-customization-dialogs.js";

function fakeMoveCustomizationHtml(values) {
	return {
		find: (selector) => {
			const value = values[selector];
			return { val: () => value, 0: value ?? document.createElement("div") };
		}
	};
}

describe("configureMoveCustomization", () => {
	it("renders the editor template pre-filled from the passed-in move's current name, and mounts the description in a ProseMirror editor", async () => {
		const promise = configureMoveCustomization({ key: "the-scout:bullheaded", name: "Bullheaded", description: "Stubborn." });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(
			expect.stringContaining("move-customization-editor"),
			{ name: "Bullheaded" }
		);

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		await dialogOptions.render(fakeMoveCustomizationHtml({}));

		expect(TextEditor.create).toHaveBeenCalledWith(
			{ target: expect.any(Object) },
			"Stubborn."
		);

		dialogOptions.close();
		await promise;
	});

	it("resolves the trimmed name/description when Save is clicked with a name", async () => {
		const promise = configureMoveCustomization({ key: "the-scout:bullheaded", name: "Bullheaded", description: "Stubborn." });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		await dialogOptions.render(fakeMoveCustomizationHtml({}));
		ProseMirror.dom.serializeString.mockReturnValueOnce("  Even more stubborn.  ");

		dialogOptions.buttons.save.callback(fakeMoveCustomizationHtml({
			"[name='name']": "  Stubborn Streak  "
		}));

		expect(await promise).toEqual({ name: "Stubborn Streak", description: "Even more stubborn." });
	});

	it("warns and resolves null when Save is clicked with a blank name", async () => {
		const promise = configureMoveCustomization({ key: "the-scout:bullheaded", name: "Bullheaded", description: "Stubborn." });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		await dialogOptions.render(fakeMoveCustomizationHtml({}));
		dialogOptions.buttons.save.callback(fakeMoveCustomizationHtml({
			"[name='name']": "   "
		}));

		expect(await promise).toBeNull();
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it("resolves null when Cancel is clicked, and defers editor cleanup to close", async () => {
		const editorInstance = { view: { dom: document.createElement("div"), state: { doc: { content: "stub-doc-content" } } }, destroy: vi.fn() };
		TextEditor.create.mockResolvedValueOnce(editorInstance);

		const promise = configureMoveCustomization({ key: "the-scout:bullheaded", name: "Bullheaded", description: "Stubborn." });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		await dialogOptions.render(fakeMoveCustomizationHtml({}));
		dialogOptions.buttons.cancel.callback();

		expect(await promise).toBeNull();
		expect(editorInstance.destroy).not.toHaveBeenCalled();

		dialogOptions.close();
		expect(editorInstance.destroy).toHaveBeenCalledTimes(1);
	});

	it("resolves null and destroys the editor when the dialog is dismissed without a button click", async () => {
		const editorInstance = { view: { dom: document.createElement("div"), state: { doc: { content: "stub-doc-content" } } }, destroy: vi.fn() };
		TextEditor.create.mockResolvedValueOnce(editorInstance);

		const promise = configureMoveCustomization({ key: "the-scout:bullheaded", name: "Bullheaded", description: "Stubborn." });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		await dialogOptions.render(fakeMoveCustomizationHtml({}));
		dialogOptions.close();

		expect(await promise).toBeNull();
		expect(editorInstance.destroy).toHaveBeenCalledTimes(1);
	});

	it("resolves null without crashing when the dialog is dismissed before the editor has mounted", async () => {
		const promise = configureMoveCustomization({ key: "the-scout:bullheaded", name: "Bullheaded", description: "Stubborn." });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.close();

		expect(await promise).toBeNull();
	});

	it("mounts the editor with an empty string when the move has no description", async () => {
		const promise = configureMoveCustomization({ key: "the-scout:bullheaded", name: "Bullheaded", description: undefined });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		await dialogOptions.render(fakeMoveCustomizationHtml({}));

		expect(TextEditor.create).toHaveBeenCalledWith({ target: expect.any(Object) }, "");

		dialogOptions.close();
		await promise;
	});

	it("falls back to the move's original description when Save is clicked before the editor has mounted", async () => {
		const promise = configureMoveCustomization({ key: "the-scout:bullheaded", name: "Bullheaded", description: "Stubborn." });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeMoveCustomizationHtml({
			"[name='name']": "Stubborn Streak"
		}));

		expect(await promise).toEqual({ name: "Stubborn Streak", description: "Stubborn." });
	});
});
