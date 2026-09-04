import { APPROACHES } from "../core/approaches.js";
import { TIER_MIN, TIER_MAX } from "../equipment/equipment.js";
import { findAstirMove } from "../frames/astir.js";
import { NpcEquipmentSheetMixin } from "./npc-sheet/equipment-mixin.js";
import { NpcAstirSheetMixin } from "./npc-sheet/astir-mixin.js";
import { NpcArdentSheetMixin } from "./npc-sheet/ardent-mixin.js";

export const NPC_SHEET_TEMPLATE = "modules/armor-astir/templates/npc-actor-sheet.hbs";
export const NPC_ACTOR_TYPE = "armor-astir.npc";

// The NPC is the minimal "something in the world with a Tier" actor (see docs/domains/world-actors.md, "World
// actors") — name, description, a freely-picked Approach, and Tier, plus a Rival tracker and full
// Equipment/Astir/Ardent loadout support (see claude.md's Domain conventions and each npc-sheet/
// mixin's own comment for what's deliberately trimmed relative to the player Playbook sheet — an
// NPC never rolls, so none of the roll-dialog machinery those domains carry on the player sheet
// applies here).
// Extends ActorSheet directly, not WorldActorSheet: an NPC has no entry-list at all, so inheriting
// WorldActorSheet's list-CRUD machinery would add nothing but unused surface.
export class NpcActorSheet extends ActorSheet {
	// Matches pbta's own sheets — silences AppV1's v13+ deprecation warning with no behaviour change.
	static _warnedAppV1 = true;

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["armor-astir", "sheet", "actor", "npc"],
			template: NPC_SHEET_TEMPLATE,
			width: 480,
			height: "auto",
			tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "rival" }]
		});
	}

	getData(options) {
		const data = super.getData(options);
		data.description = this.actor.system.details?.description?.value ?? "";
		data.approach = this.actor.system.attributes?.approach ?? "";
		data.approachOptions = APPROACHES;
		const tierValue = this.actor.system.attributes?.tier ?? TIER_MIN;
		data.tier = { value: tierValue, min: TIER_MIN, max: TIER_MAX };
		const rival = this.actor.system.attributes?.rival ?? {};
		data.rival = {
			active: rival.active ?? false,
			target: rival.target ?? "",
			need: rival.need ?? "",
			want: rival.want ?? "",
			hold: rival.hold ?? 0
		};

		const equipment = this._equipment();
		const astir = this._astir();
		const astirParts = this._astirParts();
		const astirMove = astir?.move ? findAstirMove(astir.move) : null;
		const ardents = this._ardents();
		const astirWeapons = equipment
			.filter((item) => item.kind === "weapon" && item.astir)
			.map((item) => this._equipmentEntry(item, astir));
		const ardentWeaponEntriesById = new Map(ardents.map((ardent) => [
			ardent.id,
			equipment
				.filter((item) => item.kind === "weapon" && item.ardent === ardent.id)
				.map((item) => this._equipmentEntry(item, ardent))
		]));
		data.equipment = this._equipmentData(equipment, astirWeapons, ardentWeaponEntriesById, ardents);
		data.astir = this._astirData(astir, astirParts, astirMove, equipment, astirWeapons);
		data.ardents = this._ardentsData(ardents, equipment);
		return data;
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find(".npc-approach-select").on("change", this._onApproachChange.bind(this));
		html.find(".tier-step").on("click", this._onTierStep.bind(this));
		html.find(".rival-active-checkbox").on("change", this._onRivalActiveToggle.bind(this));
		html.find(".rival-hold-step").on("click", this._onRivalHoldStep.bind(this));
		html.find(".equipment-add").on("click", this._onEquipmentAdd.bind(this));
		html.find(".equipment-catalog-add").on("click", this._onEquipmentCatalogAdd.bind(this));
		html.find(".equipment-edit").on("click", this._onEquipmentEdit.bind(this));
		html.find(".equipment-remove").on("click", this._onEquipmentRemove.bind(this));
		html.find(".equipment-disabled-checkbox").on("change", this._onEquipmentDisabledToggle.bind(this));
		html.find(".move-info").on("click", this._onMoveInfo.bind(this));
		html.find(".astir-create").on("click", this._onAstirCreate.bind(this));
		html.find(".astir-delete").on("click", this._onAstirDelete.bind(this));
		html.find(".astir-core-select").on("change", this._onAstirCoreChange.bind(this));
		html.find(".astir-approach-select").on("change", this._onAstirApproachChange.bind(this));
		html.find(".astir-tier-step").on("click", this._onAstirTierStep.bind(this));
		html.find(".astir-power-step").on("click", this._onAstirPowerStep.bind(this));
		html.find(".astir-weapon-power-step").on("click", this._onAstirWeaponPowerStep.bind(this));
		html.find(".astir-overheating-checkbox").on("change", this._onAstirOverheatingToggle.bind(this));
		html.find(".astir-piloted-checkbox").on("change", this._onAstirPilotedToggle.bind(this));
		html.find(".astir-part-add").on("click", this._onAstirPartAdd.bind(this));
		html.find(".astir-part-remove").on("click", this._onAstirPartRemove.bind(this));
		html.find(".part-disabled-checkbox").on("change", this._onPartDisabledToggle.bind(this));
		html.find(".astir-move-add").on("click", this._onAstirMoveAdd.bind(this));
		html.find(".astir-move-remove").on("click", this._onAstirMoveRemove.bind(this));
		html.find(".astir-weapon-catalog-add").on("click", this._onAstirWeaponAdd.bind(this));
		html.find(".astir-weapon-add").on("click", this._onAstirWeaponCustomAdd.bind(this));
		html.find(".ardent-create").on("click", this._onArdentCreate.bind(this));
		html.find(".ardent-delete").on("click", this._onArdentDelete.bind(this));
		html.find(".ardent-name-input").on("change", this._onArdentNameChange.bind(this));
		html.find(".ardent-approach-select").on("change", this._onArdentApproachChange.bind(this));
		html.find(".ardent-tier-step").on("click", this._onArdentTierStep.bind(this));
		html.find(".ardent-piloted-checkbox").on("change", this._onArdentPilotedToggle.bind(this));
		html.find(".ardent-part-add").on("click", this._onArdentPartAdd.bind(this));
		html.find(".ardent-part-remove").on("click", this._onArdentPartRemove.bind(this));
		html.find(".ardent-weapon-catalog-add").on("click", this._onArdentWeaponAdd.bind(this));
		html.find(".ardent-weapon-add").on("click", this._onArdentWeaponCustomAdd.bind(this));
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

	_onRivalActiveToggle(event) {
		this.actor.update({ "system.attributes.rival.active": event.currentTarget.checked });
	}

	_onRivalHoldStep(event) {
		const { delta } = event.currentTarget.dataset;
		const current = this.actor.system.attributes?.rival?.hold ?? 0;
		const next = Math.max(0, current + Number(delta));
		if (next === current) return;
		this.actor.update({ "system.attributes.rival.hold": next });
	}

	// The Part Disabled checkbox's own write path — same manual-tracker shape as
	// _onEquipmentDisabledToggle (npc-sheet/equipment-mixin.js), keyed by moveUses.<partKey>.disabled
	// instead of an entry in the equipment array (see astir-mixin.js's _isPartDisabled).
	_onPartDisabledToggle(event) {
		const { part: key } = event.currentTarget.dataset;
		this.actor.update({ [`system.attributes.moveUses.${key}.disabled`]: event.currentTarget.checked });
	}
}
Object.assign(NpcActorSheet.prototype, NpcEquipmentSheetMixin, NpcAstirSheetMixin, NpcArdentSheetMixin);

export function registerNpcActorSheet() {
	Hooks.once("init", () => {
		Actors.registerSheet("armor-astir", NpcActorSheet, {
			types: ["armor-astir.npc"],
			makeDefault: true,
			label: "NPC"
		});
	});
}
