import { WITCH_BOONS, chooseWitchBoons, pickRandomBoons } from "../witch.js";

// The Witch's Patron domain (Influence, held Boons, the random grant, the manual picker,
// Relinquish) — its own file, the same "one domain, one file" treatment Astir got
// (astir-mixin.js), since it's a self-contained domain with its own actor-state shape
// (system.attributes.witch) and no reusable generic mechanism to piggyback on (unlike Ace Crew,
// which reuses entry-list.js directly and so stays folded into tracking-mixin.js). See witch.js
// for the Boons catalog itself and playbook-moves.js's Patron/Whims/Relinquish moves for the
// rules text this mechanizes.
export const PatronSheetMixin = {
	_witchInfluence() {
		return this.actor.system.attributes?.witch?.influence ?? 0;
	},
	// Just the held keys — the Boon definitions live in witch.js, so stored data never goes stale
	// against edited rules text, same convention playbookMoves already follows.
	_witchBoons() {
		return this.actor.system.attributes?.witch?.boons ?? [];
	},
	// getData's Patron section (Social tab, gated on isWitch) — every catalog Boon, flagged with
	// whether this actor currently holds it, so the template can render the full list with a
	// `held` CSS toggle rather than only the ones actually owned.
	_witchData() {
		const held = this._witchBoons();
		return {
			influence: this._witchInfluence(),
			boons: WITCH_BOONS.map((boon) => ({ ...boon, held: held.includes(boon.key) }))
		};
	},
	// A plain manual counter, uncapped like Downtime Tokens/Power — the Patron move's own text has
	// no upper bound on Influence, and its lower bound is the usual resource floor of 0.
	_onWitchInfluenceStep(event) {
		const { delta } = event.currentTarget.dataset;
		const current = this._witchInfluence();
		const next = Math.max(0, current + Number(delta));
		if (next === current) return;
		this.actor.update({ "system.attributes.witch.influence": next });
	},
	// Shared by both grant paths below (Patron's own random grant, Whims' manual choice) — merges
	// in only the keys not already held, the same "don't duplicate an existing entry" guard
	// _onPlaybookMoveAdd already applies to playbookMoves.
	async _addWitchBoons(keys) {
		const current = this._witchBoons();
		const additions = keys.filter((key) => !current.includes(key));
		if (!additions.length) return;
		await this.actor.update({ "system.attributes.witch.boons": [...current, ...additions] });
	},
	// "Your patron offers you two boons at random whenever someone leads a Sortie" — see
	// moves-mixin.js's _onMoveResolved, which calls this whenever this actor rolls Lead a Sortie
	// with the Patron move picked. No button of its own, matching how Alchemical Suite's Potions
	// grant has none either.
	async _grantRandomWitchBoons() {
		await this._addWitchBoons(pickRandomBoons(WITCH_BOONS, 2, this._witchBoons()));
	},
	// Whims' "you may choose your boons instead of rolling next time" — opens the manual picker and
	// merges whatever was chosen, same dedupe-merge _grantRandomWitchBoons already gets for free
	// via _addWitchBoons.
	async _onWitchBoonsChoose() {
		const keys = await chooseWitchBoons(WITCH_BOONS, 2, this._witchBoons());
		if (!keys) return;
		await this._addWitchBoons(keys);
	},
	// Relinquish's mechanizable half — "losing them until you receive boons again." Fixing the
	// damaged Astir part and clearing the peril stay narrated (see playbook-moves.js's Relinquish
	// move comment); this only ever clears the held Boons list.
	_onWitchBoonsRelinquish() {
		if (!this._witchBoons().length) return;
		this.actor.update({ "system.attributes.witch.boons": [] });
	}
};
