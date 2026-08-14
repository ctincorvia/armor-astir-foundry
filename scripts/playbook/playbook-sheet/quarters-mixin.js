import { QUARTERS_BENEFITS, QUARTERS_BENEFIT_MAX, resolveQuartersBenefits } from "../quarters.js";
import { findCarrierActors } from "../../world-actors/carrier-actor-sheet.js";

// Quarters (Equipment tab, isSupport-gated — see quarters.js) — a singleton object field on the
// actor (system.attributes.quarters), not an id-keyed list, since a character has at most one set
// of Quarters. Modeled after home-mixin.js's own singleton-field treatment.
export const QuartersSheetMixin = {
	_quarters() {
		return this.actor.system.attributes?.quarters ?? { name: "", description: "", benefits: [] };
	},
	// Returns null when the "extra-token" benefit isn't picked, so callers can spread it in
	// conditionally (see progression-mixin.js's _bonusDowntimeTokenKeyedSources and
	// frames-mixin.js's _onRefreshSortie).
	_quartersExtraTokenSource() {
		const quarters = this._quarters();
		if (!quarters.benefits?.includes("extra-token")) return null;
		const benefit = QUARTERS_BENEFITS.find((b) => b.key === "extra-token");
		return { key: "quarters:extra-token", name: quarters.name || "Quarters", bonusDowntimeTokens: benefit.bonusDowntimeTokens };
	},
	_quartersData() {
		const quarters = this._quarters();
		const carriers = findCarrierActors();
		const picked = quarters.benefits ?? [];
		return {
			name: quarters.name ?? "",
			description: quarters.description ?? "",
			benefits: QUARTERS_BENEFITS.map((b) => ({
				key: b.key,
				label: b.label,
				checked: picked.includes(b.key),
				disabled: !picked.includes(b.key) && picked.length >= QUARTERS_BENEFIT_MAX
			})),
			showCarrierSelect: carriers.length > 1,
			carrierOptions: carriers.map((c) => ({ id: c.id, name: c.name })),
			carrierId: this.actor.system.attributes?.carrierId ?? ""
		};
	},
	_onQuartersNameChange(event) {
		this.actor.update({ "system.attributes.quarters.name": event.currentTarget.value.trim() });
	},
	_onQuartersDescriptionChange(event) {
		this.actor.update({ "system.attributes.quarters.description": event.currentTarget.value.trim() });
	},
	// Defensive revert on a stray 3rd-pick event — the real enforcement is _quartersData's
	// `disabled` flag baked into the checkbox's HTML `disabled` attribute (mirrors
	// _onAdvancementToggle's own "disabled shouldn't fire, but guard anyway" stance in
	// progression-mixin.js).
	_onQuartersBenefitToggle(event) {
		const { benefit: key } = event.currentTarget.dataset;
		const checked = event.currentTarget.checked;
		const current = this._quarters().benefits ?? [];
		if (checked && current.length >= QUARTERS_BENEFIT_MAX && !current.includes(key)) {
			event.currentTarget.checked = false;
			return;
		}
		const next = checked ? [...new Set([...current, key])] : current.filter((k) => k !== key);
		this.actor.update({ "system.attributes.quarters.benefits": next });
	},
	_onQuartersCarrierChange(event) {
		this.actor.update({ "system.attributes.carrierId": event.currentTarget.value || null });
	}
};
