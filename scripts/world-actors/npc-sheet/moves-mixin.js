import { chooseNpcMove, findPlaybookMove, resolvePlaybookMoves } from "../../moves/playbook-moves.js";
import { postMoveDescription } from "../../moves/move-roll.js";

// The Moves tab — an NPC never rolls, so this is just an attach/detach list plus the two chat/
// rules-text buttons shared with the rest of the sheet (see claude.md's Domain conventions: no
// traits/hold/uses tracking, since none of that machinery applies without a roll).
export const NpcMovesSheetMixin = {
	_npcMoves() {
		return this.actor.system.attributes?.npcMoves ?? [];
	},
	_movesData() {
		return resolvePlaybookMoves(this._npcMoves()).map((move) => ({ key: move.key, name: move.name }));
	},
	async _onMoveAdd() {
		const current = this._npcMoves();
		const key = await chooseNpcMove(current);
		if (!key || current.includes(key)) return;

		this.actor.update({ "system.attributes.npcMoves": [...current, key] });
	},
	_onMoveRemove(event) {
		const { move: key } = event.currentTarget.dataset;
		const current = this._npcMoves();
		if (!current.includes(key)) return;

		this.actor.update({ "system.attributes.npcMoves": current.filter((k) => k !== key) });
	},
	async _onMoveDescription(event) {
		const { move: key } = event.currentTarget.dataset;
		const move = findPlaybookMove(key);
		if (!move) return;

		await postMoveDescription(this.actor, move);
	}
};
