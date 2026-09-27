import { CONFLICT_SCENES, findConflictScene } from "./conflict-scenes.js";
import { showConflictSceneDetails } from "./conflict-scene-dialog.js";
import { postConflictSceneDetails } from "./conflict-scene-chat.js";

// Merged onto AuthorityActorSheet and CauseActorSheet via Object.assign (not WorldActorSheet, since
// Carrier has no Conflict Scenes tab) — see docs/domains/world-actors.md, "Conflict Scenes".
export const ConflictScenesSheetMixin = {
	_conflictScenesData() {
		return CONFLICT_SCENES;
	},
	async _onConflictSceneInfo(event) {
		const scene = findConflictScene(event.currentTarget.dataset.sceneKey);
		if (!scene) return;

		await showConflictSceneDetails(scene);
	},
	async _onConflictSceneChat(event) {
		const scene = findConflictScene(event.currentTarget.dataset.sceneKey);
		if (!scene) return;

		await postConflictSceneDetails(this.actor, scene);
	}
};
