import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONFLICT_SCENE_DIALOG_TEMPLATE, showConflictSceneDetails } from "../scripts/world-actors/conflict-scene-dialog.js";
import { CONFLICT_SCENES } from "../scripts/world-actors/conflict-scenes.js";

const [FIRST, SECOND] = CONFLICT_SCENES;

beforeEach(() => {
	vi.resetAllMocks();
	// resetAllMocks wipes the default Dialog/renderTemplate implementations stubbed in tests/setup.js.
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
		this.close = vi.fn(() => this.data.close?.());
	});
	renderTemplate.mockResolvedValue("");
});

describe("showConflictSceneDetails", () => {
	it("opens a Dialog with the scene's name as title and renderTemplate's resolved content", async () => {
		renderTemplate.mockResolvedValue("<div>scene content</div>");

		const promise = showConflictSceneDetails(FIRST);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(CONFLICT_SCENE_DIALOG_TEMPLATE, FIRST);

		const dialogData = Dialog.mock.calls.at(-1)[0];
		expect(dialogData.title).toBe("Conflict Scene");
		expect(dialogData.content).toBe("<div>scene content</div>");
		expect(Dialog.mock.calls.at(-1)[1]).toEqual({ classes: ["armor-astir", "conflict-scene-dialog"] });

		dialogData.close();

		await expect(promise).resolves.toBeUndefined();
	});

	it("resolves when the Close button's callback is invoked, same as closing the dialog", async () => {
		const promise = showConflictSceneDetails(SECOND);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.close.callback();

		await expect(promise).resolves.toBeUndefined();
	});

	it("closes the first dialog and resolves its promise when a second call supersedes it", async () => {
		const firstPromise = showConflictSceneDetails(FIRST);
		await Promise.resolve();
		await Promise.resolve();
		const firstDialog = Dialog.mock.instances.at(-1);

		const secondPromise = showConflictSceneDetails(SECOND);
		await Promise.resolve();
		await Promise.resolve();

		expect(firstDialog.close).toHaveBeenCalled();
		await expect(firstPromise).resolves.toBeUndefined();

		const secondDialogData = Dialog.mock.calls.at(-1)[0];
		expect(renderTemplate).toHaveBeenLastCalledWith(CONFLICT_SCENE_DIALOG_TEMPLATE, SECOND);

		secondDialogData.close();
		await expect(secondPromise).resolves.toBeUndefined();
	});

	it("does not re-close the first dialog once it has already closed itself", async () => {
		const firstPromise = showConflictSceneDetails(FIRST);
		await Promise.resolve();
		await Promise.resolve();
		const firstDialog = Dialog.mock.instances.at(-1);
		Dialog.mock.calls.at(-1)[0].close();
		await firstPromise;

		const secondPromise = showConflictSceneDetails(SECOND);
		await Promise.resolve();
		await Promise.resolve();
		const secondDialog = Dialog.mock.instances.at(-1);

		expect(firstDialog.close).not.toHaveBeenCalled();
		expect(secondDialog.close).not.toHaveBeenCalled();

		secondDialog.close();
		await expect(secondPromise).resolves.toBeUndefined();
	});
});
