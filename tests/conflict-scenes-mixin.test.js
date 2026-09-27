import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/world-actors/conflict-scene-dialog.js", () => ({ showConflictSceneDetails: vi.fn() }));
vi.mock("../scripts/world-actors/conflict-scene-chat.js", () => ({ postConflictSceneDetails: vi.fn() }));

import { ConflictScenesSheetMixin } from "../scripts/world-actors/conflict-scenes-mixin.js";
import { CONFLICT_SCENES } from "../scripts/world-actors/conflict-scenes.js";
import { showConflictSceneDetails } from "../scripts/world-actors/conflict-scene-dialog.js";
import { postConflictSceneDetails } from "../scripts/world-actors/conflict-scene-chat.js";

const eventFor = (sceneKey) => ({ currentTarget: { dataset: { sceneKey } } });

beforeEach(() => {
	vi.clearAllMocks();
});

describe("ConflictScenesSheetMixin", () => {
	it("_conflictScenesData returns the whole catalog", () => {
		expect(ConflictScenesSheetMixin._conflictScenesData()).toBe(CONFLICT_SCENES);
	});

	it("_onConflictSceneInfo opens the dialog for a known scene key", async () => {
		await ConflictScenesSheetMixin._onConflictSceneInfo(eventFor("an-unfurling-plan"));

		expect(showConflictSceneDetails).toHaveBeenCalledWith(CONFLICT_SCENES[0]);
	});

	it("_onConflictSceneInfo does nothing for an unknown scene key", async () => {
		await ConflictScenesSheetMixin._onConflictSceneInfo(eventFor("nope"));

		expect(showConflictSceneDetails).not.toHaveBeenCalled();
	});

	it("_onConflictSceneChat posts the scene as the sheet's actor for a known scene key", async () => {
		const sheet = { ...ConflictScenesSheetMixin, actor: { id: "actor" } };

		await sheet._onConflictSceneChat(eventFor("an-unfurling-plan"));

		expect(postConflictSceneDetails).toHaveBeenCalledWith(sheet.actor, CONFLICT_SCENES[0]);
	});

	it("_onConflictSceneChat does nothing for an unknown scene key", async () => {
		const sheet = { ...ConflictScenesSheetMixin, actor: { id: "actor" } };

		await sheet._onConflictSceneChat(eventFor("nope"));

		expect(postConflictSceneDetails).not.toHaveBeenCalled();
	});
});
