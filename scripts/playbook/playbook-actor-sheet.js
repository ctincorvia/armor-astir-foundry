import { PLAYBOOKS, swapActorPlaybook } from "../actor-creation.js";
import { availableApproaches } from "../core/approaches.js";
import { gravityTriggerForPlaybook } from "./gravity-triggers.js";
import { defaultConsiderText, defaultLookText } from "./playbook-flavor.js";
import { TRAITS } from "../core/traits.js";
import { mergeSpentTags } from "../equipment/equipment.js";
import { SUPPORT_PLAYBOOK_SLUGS } from "./quarters.js";
import { findStartingGearPool } from "../equipment/starting-gear.js";
import { findStartingMovePool } from "../moves/starting-moves.js";
import { findAstirMove } from "../frames/astir.js";
import { ARDENT_TIER_MAX, ARDENT_TIER_MIN } from "../frames/ardent.js";
import { WEAPON_MOVES } from "../moves/all-moves.js";
import { TrackingSheetMixin } from "./playbook-sheet/tracking-mixin.js";
import { ProgressionSheetMixin } from "./playbook-sheet/progression-mixin.js";
import { ArdentSheetMixin } from "./playbook-sheet/ardent-mixin.js";
import { FramesSheetMixin } from "./playbook-sheet/frames-mixin.js";
import { AstirSheetMixin } from "./playbook-sheet/astir-mixin.js";
import { EquipmentSheetMixin } from "./playbook-sheet/equipment-mixin.js";
import { MovesSheetMixin } from "./playbook-sheet/moves-mixin.js";
import { MoveTraitsSheetMixin } from "./playbook-sheet/move-traits-mixin.js";
import { MoveGrantsSheetMixin } from "./playbook-sheet/move-grants-mixin.js";
import { MoveTrackingSheetMixin } from "./playbook-sheet/move-tracking-mixin.js";
import { MoveRollSheetMixin } from "./playbook-sheet/move-roll-mixin.js";
import { PatronSheetMixin } from "./playbook-sheet/patron-mixin.js";
import { ArcanistSheetMixin } from "./playbook-sheet/arcanist-mixin.js";
import { HomeSheetMixin } from "./playbook-sheet/home-mixin.js";
import { SummonerSheetMixin } from "./playbook-sheet/summoner-mixin.js";
import { QuartersSheetMixin } from "./playbook-sheet/quarters-mixin.js";

export const PLAYBOOK_SHEET_TEMPLATE = "modules/armor-astir/templates/playbook-actor-sheet.hbs";

export { TRAITS };

export { mergeSpentTags };

// All playbook actors are "character" type (see claude.md, "Domain conventions"). Every
// playbook shares the same name/callsign/photo header, so one sheet class and template
// serves all of them; a playbook that needs its own fields can extend this later.
export class PlaybookActorSheet extends ActorSheet {
	// Matches pbta's own sheets — silences AppV1's v13+ deprecation warning with no behaviour change.
	static _warnedAppV1 = true;

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["armor-astir", "sheet", "actor", "playbook"],
			template: PLAYBOOK_SHEET_TEMPLATE,
			// Matches styles/playbook-actor-sheet.css's min-width floor — keeping them in sync avoids
			// Foundry's tracked position starting narrower than the CSS floor allows it to render.
			width: 780,
			// Deliberately not "auto": core Application#setPosition special-cases options.height === "auto"
			// by re-measuring content and resetting el.style.height on every position update, including
			// every mousemove while dragging the resize handle — so the window could never be dragged
			// shorter than its content. Falls back to ActorSheet's own default (720, resizable: true);
			// core Foundry's own .window-content scroll (see styles/playbook-actor-sheet.css) covers
			// whatever the fixed height cuts off.
			tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "moves" }],
			// Without this, Application#_render has no selector to save/restore scroll position across
			// a re-render, so any actor.update() from *within* the sheet (a hold stepper, a move roll,
			// any tracked-resource click) reset the scroll position to 0 — visible as the sheet snapping
			// to the top on every such click. .window-content is the sheet's one scroll region (see
			// styles/playbook-actor-sheet.css — .sheet-body itself no longer scrolls independently),
			// matching pbta's own ActorSheet default.
			scrollY: [".window-content"]
		});
	}

	// Dangers' add-controls (label input + type select) are a mini form, not a one-click "add a
	// blank entry" action like the other header "+" buttons, so its "+" toggles the row open/shut
	// instead of opening a dialog. Transient UI state, not actor data — lives on the sheet instance
	// and resets whenever the sheet is fully closed and reopened.
	_dangerAddOpen = false;

	// A thin coordinator: shared cross-domain locals that feed more than one domain's data method
	// are computed once here (astir/ardents/equipment/frames/mountedFrame/astirParts/astirMove/
	// startingGearPool/startingMovePool/astirWeapons/ardentWeaponEntriesById/weaponMoves chain), and
	// each domain's own shaping lives in that domain's own mixin file (see claude.md's getData
	// decomposition notes) — see each _xData() method for its own section's rules-text comments.
	getData(options) {
		const data = super.getData(options);
		data.playbooks = PLAYBOOKS;
		data.currentPlaybookId = PLAYBOOKS.find((p) => p.name === this.actor.system.playbook?.name)?.packId ?? null;
		data.approachOptions = availableApproaches(this.actor.system.playbook?.slug);
		data.gravityTrigger = gravityTriggerForPlaybook(this.actor.system.playbook?.slug, this._playbookMoves());
		// Look/Consider editors on the Cosmetic tab start pre-filled with the playbook's own
		// flavor prompts (see playbook-flavor.js) until the player has saved text of their own —
		// once system.details.look/consider.value is set, that stored value wins. This is only
		// the *display* fallback for the brief window before _seedCosmeticDefaults' own write
		// resolves (see activateListeners) — real editing reads straight from the actor.
		const playbookSlug = this.actor.system.playbook?.slug;
		data.lookText = this.actor.system.details?.look?.value || defaultLookText(playbookSlug);
		data.considerText = this.actor.system.details?.consider?.value || defaultConsiderText(playbookSlug);
		// Gates the Ace Crew roster (Social tab) and the Custom Ardent's own "Add Ardent Feature"
		// controls (Astir & Ardents tab) — both exclusive to Commander (see ardent.js's
		// ARDENT_FEATURE_PARTS/ARDENT_FEATURE_WEAPONS and claude.md's Commander notes). No Handlebars
		// equality helper is registered in this module, so the comparison happens here instead.
		data.isCommander = playbookSlug === "the-commander";
		// Gates the Patron section (Social tab) — Influence stepper, Boons list, "Choose 2 Boons" and
		// "Relinquish Boons" — exclusive to The Witch (see witch.js/patron-mixin.js and claude.md's
		// Clocks section for the general "compute regardless, gate the render" precedent this and
		// isCommander both follow). Computed unconditionally below (data.witch), same as
		// data.aceCrew already is for isCommander.
		data.isWitch = playbookSlug === "the-witch";
		// Gates the Prepare Rituals section (Social tab) — Prepare/Adapt buttons, the Wardhold
		// readout, and the 3 ritual slots — exclusive to The Arcanist (see arcanist.js/arcanist-mixin.js).
		// Same "compute regardless, gate the render" stance as data.witch above.
		data.isArcanist = playbookSlug === "the-arcanist";
		// Gates the Tenets label + Shaken checkbox on the Social tab's Hooks section — exclusive to
		// The Paradigm (see claude.md's Tenets notes and tracking-mixin.js's HOOK_DEPTHS comment).
		// Computed here, same reason isCommander/isWitch are: no Handlebars equality helper is
		// registered in this module.
		data.isParadigm = playbookSlug === "the-paradigm";
		// Gates the "At the Helm" checkbox (Dangers panel) — exclusive to The Captain (see
		// tracking-mixin.js's _dangerMax/_onAtHelmToggle and playbook-moves.js's In Command). Same
		// "no Handlebars equality helper" reason isCommander/isWitch/isParadigm are computed here.
		data.isCaptain = playbookSlug === "the-captain";
		// Gates the Quarters section (Equipment tab) — the 7 Support playbooks only (see
		// quarters.js's SUPPORT_PLAYBOOK_SLUGS). Same "no Handlebars equality helper, compute
		// regardless, gate the render" pattern as isCommander/isWitch/isParadigm/isCaptain above.
		data.isSupport = SUPPORT_PLAYBOOK_SLUGS.includes(playbookSlug);
		data.quarters = this._quartersData();
		// The checkbox's own bound value — computed regardless of isCaptain, same "compute
		// regardless, gate the render" pattern data.aceCrew/data.witch already establish.
		data.atHelm = Boolean(this.actor.system.attributes?.atHelm);
		// Rendered next to the Tier readout in the header — see claude.md's Character Tier notes:
		// on-foot Tier and Approach are the same kind of "how you fight outside your Astir"
		// property. Derived fresh every render, not stored — see _conflictTier.
		data.tier = this._conflictTier();
		// The Approach counterpart to data.tier just above — see _effectiveApproach, which mirrors
		// _conflictTier's own mounted-frame fallback so a piloted Astir/Ardent with its own Approach
		// is what actually drives target-matchup Advantage, not the character's persisted one.
		data.approach = this._effectiveApproach();
		data.traits = this._traitsData();
		const astir = this._astir();
		data.spotlight = this._spotlightData();
		data.downtimeTokens = this._downtimeTokensData();
		data.bonusDowntimeTokens = this._bonusDowntimeTokensData();
		data.downtimeAbilities = this._downtimeAbilitiesData();
		const startingMovePool = findStartingMovePool(this.actor.system.playbook?.name);
		const astirParts = this._astirParts();
		const astirMove = astir?.move ? findAstirMove(astir.move) : null;
		const frames = this._frames();
		const mountedFrame = frames.find((frame) => frame.piloted) ?? null;
		const ardents = this._ardents();
		data.moveGroups = this._movesData(astir, astirParts, astirMove, mountedFrame, ardents, startingMovePool);
		// Spell Routines' dropdown options (Astir tab) — every move currently rendered anywhere in
		// moveGroups, deduped by key (see astir-mixin.js's _guidedMoveOptions). Classical
		// Spellcasting's own narrower dropdown (Moves tab) uses data.basicMoveOptions instead, set
		// alongside data.equipment below.
		data.guidedMoveOptions = this._guidedMoveOptions(data.moveGroups);
		// Classical Spellcasting's dropdown options (Moves tab) — every Basic Move, per its own
		// "Choose a Basic Move" rules text (see moves-mixin.js's _basicMoveOptions).
		data.basicMoveOptions = this._basicMoveOptions();
		// Custom-made equipment (see claude.md, "Domain conventions") — never picked from a list,
		// so unlike moves there's no shared catalog of equipment itself, only of the Tags that can
		// be attached to it (see equipment.js). One array partitioned by `kind` (and, for weapons,
		// by the astir flag) rather than several separate arrays, since add/edit/remove and tag
		// resolution are identical either way and only the render needs to tell them apart.
		const equipment = this._equipment();
		// The Equipment tab's per-weapon quick-roll buttons (see _onWeaponMoveRoll) — computed once
		// and attached to every weapon entry below, rather than living once under data.equipment
		// and cross-referenced from inside the weapons {{#each}}, which would need a riskier
		// `../equipment.weaponMoves` template lookup. Reusing _moveGroupMoves (rather than
		// hand-rolling gating) means these buttons inherit the exact same, already-tested `gated`
		// semantics as the Moves tab's own Roll buttons for free.
		// A weapon's quick-roll buttons only work while its own owning frame is the one currently
		// mounted (see docs/domains/frames.md's Piloted note and _weaponFrameId) — a mundane weapon's frame id is
		// null, so `frameWeaponMoves(null)` gates it whenever anything at all is mounted. Every
		// frame's set is derived independently from the same ungated base rather than negating one
		// another, so mounting frame A can never accidentally leave frame B's buttons enabled too.
		const baseWeaponMoves = this._moveGroupMoves(WEAPON_MOVES).map(({ key, name, gated }) => ({ key, name, gated }));
		const mountedFrameId = mountedFrame?.id ?? null;
		const frameWeaponMoves = (frameId) => baseWeaponMoves.map((move) => {
			const frameMismatch = mountedFrameId !== frameId;
			return {
				...move,
				gated: move.gated || frameMismatch,
				tooltip: frameMismatch ? this._weaponGateTooltip(frameId, mountedFrameId) : null
			};
		});
		const weaponMoves = frameWeaponMoves(null);
		const astirWeaponMoves = frameWeaponMoves("astir");
		const startingGearPool = findStartingGearPool(this.actor.system.playbook?.name);
		// Astir weapons (equipment entries flagged astir: true — see astir.js) are only ever
		// added/edited/removed from the Astir tab, but still surface here, read-only, per
		// claude.md — same computed entries feed both data.equipment.astirWeapons (Equipment tab)
		// and data.astir.weapons (Astir tab) below, so there's only one place resolving them. Each
		// Ardent's own weapons (equipment entries flagged ardent: "<ardentId>") get the same
		// treatment, grouped per Ardent — see ardentWeaponEntriesById below, shared between
		// data.equipment.ardentWeapons (flattened, Equipment tab) and each entry in data.ardents'
		// own .weapons (Astir & Ardents tab).
		const astirWeapons = equipment
			.filter((item) => item.kind === "weapon" && item.astir)
			.map((item) => this._equipmentEntry(item, astirWeaponMoves, astir));
		const ardentWeaponEntriesById = new Map(ardents.map((ardent) => [
			ardent.id,
			equipment
				.filter((item) => item.kind === "weapon" && item.ardent === ardent.id)
				.map((item) => this._equipmentEntry(item, frameWeaponMoves(ardent.id), ardent))
		]));
		data.equipment = this._equipmentData(equipment, weaponMoves, astirWeapons, ardentWeaponEntriesById, ardents, startingGearPool, mountedFrameId);
		data.astir = this._astirData(astir, astirParts, astirMove, equipment, astirWeapons);
		data.ardentTierMin = ARDENT_TIER_MIN;
		data.ardentTierMax = ARDENT_TIER_MAX;
		data.ardents = this._ardentsData(ardents, equipment, ardentWeaponEntriesById);
		data.controls = this._controlsData(frames, mountedFrame);
		data.dangers = this._dangersData();
		data.gravityClocks = this._gravityClocksData();
		data.burdens = this._burdensData();
		data.clocks = this._clocksData();
		data.aceCrew = this._aceCrewData();
		data.hooks = this._hooksData();
		data.witch = this._witchData();
		data.arcanist = this._arcanistData();
		// The Adrift's +HOME clock (Social tab) — gated on the actor having actually picked Love,
		// Love, Love, the same "object once a granting move/part is installed, else null" treatment
		// an Ardent's Repair Tokens already establishes for a conditionally-present section.
		data.home = this._homeMove() ? this._homeData() : null;
		// The Summoner's Bound Allies roster (Social tab) — same "object once a granting move is
		// installed, else null" gating as Home above (see summoner-mixin.js's _boundAlliesData).
		data.boundAllies = this._boundAlliesData();
		data.advancements = this._advancementsData();
		// Helping Hands' single Downtime Ally slot (Downtime tab) — same gating shape as Bound
		// Allies above, computed here alongside downtimeTokens since both live on the Downtime tab.
		data.downtimeAlly = this._downtimeAllyData();
		return data;
	}

	// Foundry's {{editor}} helper only uses getData's lookText/considerText for the read-only
	// preview shown before the player clicks to edit — the moment they do, FormApplication's own
	// _activateEditor re-reads system.details.look/consider.value straight off the real actor
	// document (client/apps/form.js), bypassing whatever getData computed. So the flavor-prompt
	// default has to actually be written to the actor the first time its sheet renders with
	// nothing stored there yet; after that, the editor's own save takes over and this never fires
	// again for that field. Checked against undefined rather than falsy so a player who
	// deliberately clears a field to "" doesn't have the prompt text resurrected on the next
	// render. Gated on isOwner so a GM or observer opening someone else's sheet never attempts a
	// write they don't have permission for.
	_seedCosmeticDefaults() {
		if (!this.actor.isOwner) return;
		const playbookSlug = this.actor.system.playbook?.slug;
		const updates = {};
		if (this.actor.system.details?.look?.value === undefined) {
			const look = defaultLookText(playbookSlug);
			if (look) updates["system.details.look.value"] = look;
		}
		if (this.actor.system.details?.consider?.value === undefined) {
			const consider = defaultConsiderText(playbookSlug);
			if (consider) updates["system.details.consider.value"] = consider;
		}
		if (Object.keys(updates).length) this.actor.update(updates);
	}

	activateListeners(html) {
		super.activateListeners(html);
		this._seedCosmeticDefaults();
		html.find(".playbook-select").on("change", this._onPlaybookChange.bind(this));
		html.find(".trait-step").on("click", this._onTraitStep.bind(this));
		html.find(".hold-step").on("click", this._onHoldStep.bind(this));
		html.find(".flat-hold-step").on("click", this._onFlatHoldStep.bind(this));
		html.find(".move-tracker-step").on("click", this._onMoveTrackerStep.bind(this));
		html.find(".spotlight-step").on("click", this._onSpotlightStep.bind(this));
		html.find(".downtime-tokens-step").on("click", this._onDowntimeTokensStep.bind(this));
		html.find(".bonus-downtime-tokens-step").on("click", this._onBonusDowntimeTokenStep.bind(this));
		html.find(".advancement-checkbox").on("change", this._onAdvancementToggle.bind(this));
		html.find(".danger-add-toggle").on("click", this._onDangerAddToggle.bind(this));
		html.find(".danger-add").on("click", this._onDangerAdd.bind(this));
		html.find(".danger-remove").on("click", this._onDangerRemove.bind(this));
		html.find(".at-helm-checkbox").on("change", this._onAtHelmToggle.bind(this));
		html.find(".burden-add").on("click", this._onBurdenAdd.bind(this));
		html.find(".burden-remove").on("click", this._onBurdenRemove.bind(this));
		html.find(".burden-label-input").on("change", this._onBurdenLabelChange.bind(this));
		html.find(".gravity-clock-add").on("click", this._onGravityClockAdd.bind(this));
		html.find(".gravity-clock-remove").on("click", this._onGravityClockRemove.bind(this));
		html.find(".gravity-clock-label-input").on("change", this._onGravityClockLabelChange.bind(this));
		html.find(".gravity-clock-value-step").on("click", this._onGravityClockValueStep.bind(this));
		html.find(".gravity-clock-step").on("click", this._onGravityClockStep.bind(this));
		html.find(".clock-add").on("click", this._onClockAdd.bind(this));
		html.find(".clock-remove").on("click", this._onClockRemove.bind(this));
		html.find(".clock-label-input").on("change", this._onClockLabelChange.bind(this));
		html.find(".clock-steps-input").on("change", this._onClockStepsChange.bind(this));
		html.find(".clock-step").on("click", this._onClockStep.bind(this));
		html.find(".ace-crew-add").on("click", this._onAceCrewAdd.bind(this));
		html.find(".ace-crew-remove").on("click", this._onAceCrewRemove.bind(this));
		html.find(".ace-crew-field").on("change", this._onAceCrewFieldChange.bind(this));
		html.find(".hook-add").on("click", this._onHookAdd.bind(this));
		html.find(".hook-remove").on("click", this._onHookRemove.bind(this));
		html.find(".hook-field").on("change", this._onHookFieldChange.bind(this));
		html.find(".witch-influence-step").on("click", this._onWitchInfluenceStep.bind(this));
		html.find(".witch-boons-random").on("click", this._grantRandomWitchBoons.bind(this));
		html.find(".witch-boons-choose").on("click", this._onWitchBoonsChoose.bind(this));
		html.find(".witch-boons-relinquish").on("click", this._onWitchBoonsRelinquish.bind(this));
		html.find(".arcanist-rituals-prepare").on("click", this._onPrepareRituals.bind(this));
		html.find(".arcanist-rituals-adapt").on("click", this._onAdaptRituals.bind(this));
		html.find(".home-value-step").on("click", this._onHomeValueStep.bind(this));
		html.find(".home-clock-step").on("click", this._onHomeProgressStep.bind(this));
		html.find(".bound-ally-add").on("click", this._onBoundAllyAdd.bind(this));
		html.find(".bound-ally-release").on("click", this._onBoundAllyRelease.bind(this));
		html.find(".bound-ally-field").on("change", this._onBoundAllyFieldChange.bind(this));
		html.find(".bound-ally-invest").on("click", this._onBoundAllyInvestPower.bind(this));
		html.find(".downtime-ally-add").on("click", this._onDowntimeAllyAdd.bind(this));
		html.find(".downtime-ally-release").on("click", this._onDowntimeAllyRelease.bind(this));
		html.find(".downtime-ally-name-input").on("change", this._onDowntimeAllyNameChange.bind(this));
		html.find(".downtime-ally-invest").on("click", this._onDowntimeAllyInvestPower.bind(this));
		html.find(".move-summon").on("click", this._onEidolonDriveSummon.bind(this));
		html.find(".move-variable-dice-roll").on("click", this._onVariableDiceRoll.bind(this));
		html.find(".starting-moves-add").on("click", this._onStartingMovesAdd.bind(this));
		html.find(".playbook-move-add").on("click", this._onPlaybookMoveAdd.bind(this));
		html.find(".playbook-move-remove").on("click", this._onPlaybookMoveRemove.bind(this));
		html.find(".move-use-checkbox").on("change", this._onMoveUseToggle.bind(this));
		html.find(".trait-bonus-select").on("change", this._onTraitBonusChoiceChange.bind(this));
		html.find(".adds-trait-move-select").on("change", this._onAddsTraitToMoveChoiceChange.bind(this));
		html.find(".weapon-tag-choice-select").on("change", this._onWeaponTagChoiceChange.bind(this));
		html.find(".move-roll").on("click", this._onMoveRoll.bind(this));
		html.find(".move-activate").on("click", this._onMoveActivate.bind(this));
		html.find(".move-description").on("click", this._onMoveDescription.bind(this));
		html.find(".move-info").on("click", this._onMoveInfo.bind(this));
		html.find(".equipment-add").on("click", this._onEquipmentAdd.bind(this));
		html.find(".equipment-catalog-add").on("click", this._onEquipmentCatalogAdd.bind(this));
		html.find(".starting-gear-add").on("click", this._onStartingGearAdd.bind(this));
		html.find(".equipment-edit").on("click", this._onEquipmentEdit.bind(this));
		html.find(".equipment-remove").on("click", this._onEquipmentRemove.bind(this));
		html.find(".equipment-tag-spent-checkbox").on("change", this._onEquipmentTagSpentToggle.bind(this));
		html.find(".equipment-disabled-checkbox").on("change", this._onEquipmentDisabledToggle.bind(this));
		html.find(".part-disabled-checkbox").on("change", this._onPartDisabledToggle.bind(this));
		html.find(".weapon-move-roll").on("click", this._onWeaponMoveRoll.bind(this));
		html.find(".quarters-name-input").on("change", this._onQuartersNameChange.bind(this));
		html.find(".quarters-description-input").on("change", this._onQuartersDescriptionChange.bind(this));
		html.find(".quarters-benefit-checkbox").on("change", this._onQuartersBenefitToggle.bind(this));
		html.find(".quarters-carrier-select").on("change", this._onQuartersCarrierChange.bind(this));
		html.find(".astir-create").on("click", this._onAstirCreate.bind(this));
		html.find(".astir-delete").on("click", this._onAstirDelete.bind(this));
		html.find(".astir-core-select").on("change", this._onAstirCoreChange.bind(this));
		html.find(".astir-approach-select").on("change", this._onAstirApproachChange.bind(this));
		html.find(".guided-move-select").on("change", this._onGuidedMoveChoiceChange.bind(this));
		html.find(".astir-tier-step").on("click", this._onAstirTierStep.bind(this));
		html.find(".astir-power-step").on("click", this._onAstirPowerStep.bind(this));
		html.find(".astir-weapon-power-step").on("click", this._onAstirWeaponPowerStep.bind(this));
		html.find(".astir-overheating-checkbox").on("change", this._onAstirOverheatingToggle.bind(this));
		html.find(".astir-piloted-checkbox").on("change", this._onAstirPilotedToggle.bind(this));
		html.find(".astir-potion-checkbox").on("change", this._onAstirPotionToggle.bind(this));
		html.find(".astir-part-add").on("click", this._onAstirPartAdd.bind(this));
		html.find(".astir-part-remove").on("click", this._onAstirPartRemove.bind(this));
		html.find(".astir-extra-part-add").on("click", this._onAstirExtraPartAdd.bind(this));
		html.find(".astir-extra-part-remove").on("click", this._onAstirExtraPartRemove.bind(this));
		html.find(".astir-move-add").on("click", this._onAstirMoveAdd.bind(this));
		html.find(".astir-move-remove").on("click", this._onAstirMoveRemove.bind(this));
		html.find(".astir-weapon-catalog-add").on("click", this._onAstirWeaponAdd.bind(this));
		html.find(".astir-weapon-add").on("click", this._onAstirWeaponCustomAdd.bind(this));
		html.find(".astir-extra-weapon-catalog-add").on("click", this._onAstirExtraWeaponAdd.bind(this));
		html.find(".astir-extra-weapon-add").on("click", this._onAstirExtraWeaponCustomAdd.bind(this));
		html.find(".ardent-create").on("click", this._onArdentCreate.bind(this));
		html.find(".ardent-delete").on("click", this._onArdentDelete.bind(this));
		html.find(".ardent-name-input").on("change", this._onArdentNameChange.bind(this));
		html.find(".ardent-approach-select").on("change", this._onArdentApproachChange.bind(this));
		html.find(".ardent-tier-step").on("click", this._onArdentTierStep.bind(this));
		html.find(".ardent-piloted-checkbox").on("change", this._onArdentPilotedToggle.bind(this));
		html.find(".ardent-part-add").on("click", this._onArdentPartAdd.bind(this));
		html.find(".ardent-part-remove").on("click", this._onArdentPartRemove.bind(this));
		html.find(".ardent-extra-part-add").on("click", this._onArdentExtraPartAdd.bind(this));
		html.find(".ardent-extra-part-remove").on("click", this._onArdentExtraPartRemove.bind(this));
		html.find(".ardent-weapon-catalog-add").on("click", this._onArdentWeaponAdd.bind(this));
		html.find(".ardent-weapon-add").on("click", this._onArdentWeaponCustomAdd.bind(this));
		html.find(".ardent-extra-weapon-catalog-add").on("click", this._onArdentExtraWeaponAdd.bind(this));
		html.find(".ardent-extra-weapon-add").on("click", this._onArdentExtraWeaponCustomAdd.bind(this));
		html.find(".ardent-feature-part-add").on("click", this._onArdentFeaturePartAdd.bind(this));
		html.find(".ardent-feature-weapon-add").on("click", this._onArdentFeatureWeaponAdd.bind(this));
		html.find(".controls-mount-up").on("click", this._onMountUp.bind(this));
		html.find(".controls-dismount").on("click", this._onDismount.bind(this));
		html.find(".controls-refresh-scene").on("click", this._onRefreshScene.bind(this));
		html.find(".controls-refresh-sortie").on("click", this._onRefreshSortie.bind(this));
	}

	_onPlaybookChange(event) {
		const playbook = PLAYBOOKS.find((p) => p.packId === event.currentTarget.value);
		if (!playbook) return;
		swapActorPlaybook(this.actor, playbook);
	}
}
Object.assign(
	PlaybookActorSheet.prototype,
	TrackingSheetMixin, ProgressionSheetMixin, ArdentSheetMixin, FramesSheetMixin,
	AstirSheetMixin, EquipmentSheetMixin, MovesSheetMixin, MoveTraitsSheetMixin, MoveGrantsSheetMixin,
	MoveTrackingSheetMixin, MoveRollSheetMixin, PatronSheetMixin, ArcanistSheetMixin, HomeSheetMixin,
	SummonerSheetMixin, QuartersSheetMixin
);

export function registerPlaybookActorSheet() {
	Hooks.once("init", () => {
		Actors.registerSheet("pbta", PlaybookActorSheet, {
			types: ["character"],
			makeDefault: true
		});
	});
}

export { registerMoveChatListeners, onRenderMoveChat } from "../moves/move-chat-listeners.js";
