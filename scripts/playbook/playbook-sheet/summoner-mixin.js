import { addEntry, removeEntry, updateEntryField } from "../../world-actors/entry-list.js";
import { resolvePlaybookMoves } from "../../moves/playbook-moves.js";
import { astirMaxPower } from "../../frames/astir.js";
import { APPROACHES } from "../../core/approaches.js";
import { TRAITS } from "../../core/traits.js";
import { ALL_MOVES } from "../../moves/all-moves.js";

// Prompts which bound ally to summon when more than one exists — mirrors chooseCarrier
// (carrier-actor-sheet.js) and chooseFrame (ardent.js) exactly (promise/Dialog/resolve-null
// shape), only ever called by _onEidolonDriveSummon when there's a real choice to make.
export function chooseSummonAlly(allies) {
	return new Promise((resolve) => {
		const buttons = {};
		for (const ally of allies) {
			const name = ally.name || "Unnamed Ally";
			const approachLabel = APPROACHES.find((a) => a.key === ally.approach)?.label;
			const traitLabel = TRAITS.find((t) => t.key === ally.trait)?.label;
			const details = [approachLabel, traitLabel].filter(Boolean).join(", ");
			const power = ally.powerInvested ?? 0;
			const label = details ? `${name} — ${details} (Power ${power})` : `${name} (Power ${power})`;
			buttons[ally.id] = { label, callback: () => resolve(ally.id) };
		}

		new Dialog({
			title: "Summon an Ally",
			content: "<p>Which bound ally are you summoning?</p>",
			buttons,
			close: () => resolve(null)
		}, { classes: ["armor-astir"] }).render(true);
	});
}

// The Summoner's own domain — Bound Allies (Binding), Eidolon Drive's Summon flow, and Helping
// Hands' single Downtime Ally slot. All three share one Power-invest/return shape against the
// Astir's own Power pool (see astir-mixin.js's _astirPowerUpdates/_regainAstirPower for the
// clamp-to-max precedent this mirrors), so they live together in one file rather than being split
// per-move the way, say, Astir vs Ardent got their own files — there's no reusable generic
// mechanism to factor out to, and each piece is small enough to read in one sitting here.
export const SummonerSheetMixin = {
	_boundAllies() {
		return this.actor.system.attributes?.boundAllies ?? [];
	},
	_eidolonDrive() {
		return this.actor.system.attributes?.eidolonDrive ?? { summonedAllyId: null, bonusUsed: false };
	},
	// The single "which bound ally is currently summoned" lookup, shared by moves-mixin.js's
	// _moveTraits (the roll-dialog trait option) and _moveGroupMoves (the move-card info line) so
	// the id→ally resolution only lives in one place. null whenever nothing is summoned, or when
	// the stored id no longer resolves (e.g. the ally was Released while somehow still marked
	// summoned — defensive, since _onBoundAllyRelease already clears eidolonDrive in that case).
	_summonedAlly() {
		const { summonedAllyId } = this._eidolonDrive();
		if (!summonedAllyId) return null;
		return this._boundAllies().find((ally) => ally.id === summonedAllyId) ?? null;
	},
	_downtimeAlly() {
		return this.actor.system.attributes?.downtimeAlly ?? null;
	},
	// Binding (see playbook-moves.js's grantsBoundAlliesRoster) — the "has this actor picked the
	// granting move" gate, doubling as a lookup, same pattern home-mixin.js's _homeMove establishes
	// for Adrift's own single-mandatory-move mechanic.
	_bindingMove() {
		return resolvePlaybookMoves(this._playbookMoves()).find((m) => m.grantsBoundAlliesRoster);
	},
	// Helping Hands (see playbook-moves.js's grantsDowntimeAllySlot) — same pattern as _bindingMove.
	_helpingHandsMove() {
		return resolvePlaybookMoves(this._playbookMoves()).find((m) => m.grantsDowntimeAllySlot);
	},
	// Bound Allies roster (Social tab) — null (section hidden) until Binding is picked, the same
	// "object once a granting move/part is installed, else null" convention Ardent Repair Tokens/
	// Adrift's Home clock already establish. Renders even with no Astir; canInvest gates the
	// per-entry Invest Power control, since there's no Power pool to draw from without one.
	_boundAlliesData() {
		if (!this._bindingMove()) return null;
		const astir = this._astir();
		const eidolonDrive = this._eidolonDrive();
		return {
			approaches: APPROACHES,
			traits: TRAITS,
			canInvest: Boolean(astir),
			list: this._boundAllies().map((ally) => ({
				id: ally.id,
				name: ally.name ?? "",
				approach: ally.approach ?? "",
				trait: ally.trait ?? "",
				powerInvested: ally.powerInvested ?? 0,
				summoned: ally.id === eidolonDrive.summonedAllyId
			}))
		};
	},
	// Helping Hands' single Downtime-only slot (Downtime tab) — same null-until-picked gating as
	// _boundAlliesData above. exists distinguishes "nothing bound yet" (show the Add control) from
	// an actual ally (show its fields + Invest/Release).
	_downtimeAllyData() {
		if (!this._helpingHandsMove()) return null;
		const ally = this._downtimeAlly();
		return {
			exists: Boolean(ally),
			canInvest: Boolean(this._astir()),
			name: ally?.name ?? "",
			powerInvested: ally?.powerInvested ?? 0
		};
	},
	// Bound Allies roster CRUD — reuses entry-list.js's pure helpers directly, the same thin-wrapper
	// treatment Ace Crew/Hooks already establish (tracking-mixin.js) rather than a second CRUD
	// implementation. Unlike Ace Crew's own add handler, there's no "is this playbook allowed to add
	// one" guard here either — the section is already hidden until Binding is picked (see
	// _boundAlliesData), matching Ace Crew's own unguarded precedent.
	_onBoundAllyAdd() {
		this.actor.update({
			"system.attributes.boundAllies": addEntry(this._boundAllies(), { name: "", approach: "", trait: "", powerInvested: 0 })
		});
	},
	_onBoundAllyFieldChange(event) {
		const { entryId, field } = event.currentTarget.dataset;
		this.actor.update({
			"system.attributes.boundAllies": updateEntryField(this._boundAllies(), entryId, field, event.currentTarget.value)
		});
	},
	// Invest Power — a one-way +1 stepper (per the rules text: Power is only ever returned via a
	// summon or a Release, never decremented directly), clamped so it can't push the Astir's own
	// Power below 0. A no-Astir actor's Power always reads 0 here, so the current<=0 guard already
	// covers that case without a separate branch.
	_onBoundAllyInvestPower(event) {
		const astir = this._astir();
		if (!astir) return;
		const current = astir.power ?? 0;
		if (current <= 0) return;
		const { entryId } = event.currentTarget.dataset;
		const allies = this._boundAllies();
		const ally = allies.find((a) => a.id === entryId);
		if (!ally) return;
		this.actor.update({
			"system.attributes.boundAllies": updateEntryField(allies, entryId, "powerInvested", (ally.powerInvested ?? 0) + 1),
			"system.attributes.astir.power": current - 1
		});
	},
	// Release — refunds the ally's full Power investment back to the Astir (clamped to its derived
	// max, the same clamp-to-max shape _regainAstirPower uses in astir-mixin.js), removes the
	// entry, and clears the active summon if this was the currently-summoned ally.
	_onBoundAllyRelease(event) {
		const { entryId } = event.currentTarget.dataset;
		const allies = this._boundAllies();
		const ally = allies.find((a) => a.id === entryId);
		if (!ally) return;
		const astir = this._astir();
		const updates = { "system.attributes.boundAllies": removeEntry(allies, entryId) };
		if (astir && ally.powerInvested) {
			const max = astirMaxPower(astir.parts ?? [], this._equipment());
			updates["system.attributes.astir.power"] = Math.min(max, (astir.power ?? 0) + ally.powerInvested);
		}
		if (this._eidolonDrive().summonedAllyId === entryId) {
			updates["system.attributes.eidolonDrive"] = { summonedAllyId: null, bonusUsed: false };
		}
		this.actor.update(updates);
	},
	// Downtime Ally CRUD — a single slot rather than an id-keyed list (see _downtimeAlly), so this
	// is bespoke rather than entry-list.js's generic helpers, the same reasoning Ardent Repair
	// Tokens' own manual handler gives for a per-entry field in claude.md's Ardents section.
	_onDowntimeAllyAdd() {
		if (this._downtimeAlly()) return;
		this.actor.update({ "system.attributes.downtimeAlly": { name: "", powerInvested: 0 } });
	},
	_onDowntimeAllyNameChange(event) {
		if (!this._downtimeAlly()) return;
		this.actor.update({ "system.attributes.downtimeAlly.name": event.currentTarget.value });
	},
	_onDowntimeAllyInvestPower() {
		const ally = this._downtimeAlly();
		const astir = this._astir();
		if (!ally || !astir) return;
		const current = astir.power ?? 0;
		if (current <= 0) return;
		this.actor.update({
			"system.attributes.downtimeAlly.powerInvested": (ally.powerInvested ?? 0) + 1,
			"system.attributes.astir.power": current - 1
		});
	},
	// Unlike Bound Allies' Release above, Helping Hands' own text says its Power "will sustain them
	// for as long as they are in your service" — read as "returned in full only on Release," so
	// there's no incremental per-summon return to mirror here, just this one refund-and-clear.
	_onDowntimeAllyRelease() {
		const ally = this._downtimeAlly();
		if (!ally) return;
		const astir = this._astir();
		const updates = { "system.attributes.downtimeAlly": null };
		if (astir && ally.powerInvested) {
			const max = astirMaxPower(astir.parts ?? [], this._equipment());
			updates["system.attributes.astir.power"] = Math.min(max, (astir.power ?? 0) + ally.powerInvested);
		}
		this.actor.update(updates);
	},
	// Eidolon Drive's Summon button (Astir Moves group — see moves-mixin.js's summonable flag).
	// Summons directly with exactly one bound ally; prompts via chooseSummonAlly with more than one
	// (mirrors chooseCarrier/chooseFrame's own "only prompt with a real choice" convention); no-ops
	// with zero — the button already renders disabled via _moveGroupMoves' summonGated, this is a
	// defensive guard in case a click still lands, same treatment _onMountUp gives its own
	// already-disabled-in-the-template case.
	async _onEidolonDriveSummon(event) {
		const move = ALL_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
		if (!move) return;
		const allies = this._boundAllies();
		if (!allies.length) return;
		// Mirrors _onMountUp's own precedent for guarding a handler against a click landing on an
		// already-disabled button — the Summon button is disabled via _moveGroupMoves' summonGated the
		// moment an ally is already active this Scene, but a click can still land on it, so this is
		// the defensive no-op backing that gating.
		if (this._eidolonDrive().summonedAllyId) return;

		// Every id offered by chooseSummonAlly's own buttons comes straight from `allies` itself, so
		// the lookup below can't miss once a real (non-null) id resolves — same closed-world
		// assumption onCreateEntryClick's own worldKind lookup relies on in actor-creation.js.
		let ally = allies[0];
		if (allies.length > 1) {
			const allyId = await chooseSummonAlly(allies);
			if (!allyId) return;
			ally = allies.find((a) => a.id === allyId);
		}

		const astir = this._astir();
		const updates = {
			"system.attributes.eidolonDrive": { summonedAllyId: ally.id, bonusUsed: false }
		};
		// Returns 1 Power to the summoned ally, mirroring _regainAstirPower's clamp-to-max shape in
		// astir-mixin.js — a no-Astir actor never has anything invested to begin with (Invest Power
		// is disabled without one, see _boundAlliesData), so there's nothing to return here either.
		if (astir) {
			updates["system.attributes.boundAllies"] = updateEntryField(
				allies, ally.id, "powerInvested", Math.max(0, (ally.powerInvested ?? 0) - 1)
			);
			const max = astirMaxPower(astir.parts ?? [], this._equipment());
			updates["system.attributes.astir.power"] = Math.min(max, (astir.power ?? 0) + 1);
		}
		await this.actor.update(updates);
	},
	// Flips Eidolon Drive's one-time +3 to the ongoing +1 the moment the player actually rolls with
	// the summoned ally's trait — see moves-mixin.js's _rollMove, which calls this the same way it
	// already calls home-mixin.js#_advanceHome for +HOME. No-ops once already used, or if the
	// summon was somehow cleared in between (Release, Refresh Sortie).
	async _consumeEidolonDriveBonus() {
		const eidolonDrive = this._eidolonDrive();
		if (!eidolonDrive.summonedAllyId || eidolonDrive.bonusUsed) return;
		await this.actor.update({ "system.attributes.eidolonDrive.bonusUsed": true });
	}
};
