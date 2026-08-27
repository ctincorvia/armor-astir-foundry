import { beforeEach, describe, expect, it, vi } from "vitest";

import { DOWNTIME_SCENE_DIALOG_TEMPLATE, showDowntimeSceneDetails } from "../scripts/playbook/downtime-scene-dialog.js";
import { DOWNTIME_SCENE_KINDS } from "../scripts/playbook/downtime-scenes.js";

const FADE = DOWNTIME_SCENE_KINDS.find((kind) => kind.key === "fade");
const WORKSHOP_LAB = DOWNTIME_SCENE_KINDS.find((kind) => kind.key === "workshop-lab");

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

describe("showDowntimeSceneDetails", () => {
	it("opens a Dialog with the scene kind's name as title and renderTemplate's resolved content", async () => {
		renderTemplate.mockResolvedValue("<div>scene content</div>");

		const promise = showDowntimeSceneDetails(FADE);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(DOWNTIME_SCENE_DIALOG_TEMPLATE, FADE);

		const dialogData = Dialog.mock.calls.at(-1)[0];
		expect(dialogData.title).toBe(FADE.name);
		expect(dialogData.content).toBe("<div>scene content</div>");
		expect(Dialog.mock.calls.at(-1)[1]).toEqual({ classes: ["armor-astir", "downtime-scene-dialog"] });

		dialogData.close();

		await expect(promise).resolves.toBeUndefined();
	});

	it("resolves when the Close button's callback is invoked, same as closing the dialog", async () => {
		const promise = showDowntimeSceneDetails(WORKSHOP_LAB);
		await Promise.resolve();
		await Promise.resolve();

		const dialogData = Dialog.mock.calls.at(-1)[0];
		dialogData.buttons.close.callback();

		await expect(promise).resolves.toBeUndefined();
	});

	it("closes the first dialog and resolves its promise when a second call supersedes it", async () => {
		const firstPromise = showDowntimeSceneDetails(FADE);
		await Promise.resolve();
		await Promise.resolve();
		const firstDialog = Dialog.mock.instances.at(-1);

		const secondPromise = showDowntimeSceneDetails(WORKSHOP_LAB);
		await Promise.resolve();
		await Promise.resolve();

		expect(firstDialog.close).toHaveBeenCalled();
		await expect(firstPromise).resolves.toBeUndefined();

		expect(Dialog.mock.calls.length).toBe(2);
		const secondDialogData = Dialog.mock.calls.at(-1)[0];
		expect(secondDialogData.title).toBe(WORKSHOP_LAB.name);

		secondDialogData.close();
		await expect(secondPromise).resolves.toBeUndefined();
	});

	it("does not re-close the first dialog once it has already closed itself", async () => {
		const firstPromise = showDowntimeSceneDetails(FADE);
		await Promise.resolve();
		await Promise.resolve();
		const firstDialog = Dialog.mock.instances.at(-1);
		Dialog.mock.calls.at(-1)[0].close();
		await firstPromise;

		const secondPromise = showDowntimeSceneDetails(WORKSHOP_LAB);
		await Promise.resolve();
		await Promise.resolve();
		const secondDialog = Dialog.mock.instances.at(-1);

		expect(firstDialog.close).not.toHaveBeenCalled();
		expect(secondDialog.close).not.toHaveBeenCalled();

		secondDialog.close();
		await expect(secondPromise).resolves.toBeUndefined();
	});
});
