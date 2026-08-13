import { APPROACHES } from "../core/approaches.js";
import { TIER_MIN, TIER_MAX } from "../equipment/equipment.js";

export const NPC_SHEET_TEMPLATE = "modules/armor-astir/templates/npc-actor-sheet.hbs";
export const NPC_ACTOR_TYPE = "armor-astir.npc";

// The NPC is the minimal "something in the world with a Tier" actor (see docs/domains/world-actors.md, "World
// actors") — name, description, a freely-picked Approach, and Tier, nothing else. Its purpose is
// to be a valid target for Tier- and Approach-comparison rules (see moves-mixin.js's
// _targetTierAdvantage/_targetMatchupEffect and target-tier.js) rather than to model a full NPC
// the way a Playbook character is modeled.
// Extends ActorSheet directly, not WorldActorSheet: an NPC has no entry-list at all, so inheriting
// WorldActorSheet's list-CRUD machinery would add nothing but unused surface.
export class NpcActorSheet extends ActorSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["armor-astir", "sheet", "actor", "npc"],
			template: NPC_SHEET_TEMPLATE,
			width: 480,
			height: "auto"
		});
	}

	getData(options) {
		const data = super.getData(options);
		data.description = this.actor.system.details?.description?.value ?? "";
		data.approach = this.actor.system.attributes?.approach ?? "";
		data.approachOptions = APPROACHES;
		const tierValue = this.actor.system.attributes?.tier ?? TIER_MIN;
		data.tier = { value: tierValue, min: TIER_MIN, max: TIER_MAX };
		return data;
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find(".npc-approach-select").on("change", this._onApproachChange.bind(this));
		html.find(".tier-step").on("click", this._onTierStep.bind(this));
	}

	_onApproachChange(event) {
		this.actor.update({ "system.attributes.approach": event.currentTarget.value });
	}

	_onTierStep(event) {
		const { delta } = event.currentTarget.dataset;
		const current = this.actor.system.attributes?.tier ?? TIER_MIN;
		const next = Math.min(TIER_MAX, Math.max(TIER_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.attributes.tier": next });
	}
}

export function registerNpcActorSheet() {
	Hooks.once("init", () => {
		Actors.registerSheet("armor-astir", NpcActorSheet, {
			types: ["armor-astir.npc"],
			makeDefault: true,
			label: "NPC"
		});
	});
}
