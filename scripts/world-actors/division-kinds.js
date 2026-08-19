// A Division's kind determines its outcomes (one passive, always in effect, and a list of active
// outcomes the Authority can trigger) — catalog-in-code, key-on-actor (see claude.md, "Recurring
// conventions") so edited outcome text reaches existing Authorities without a data migration.
// Entirely display-only, resolved fresh in authority-actor-sheet.js's getData and rendered
// read-only — same convention as astir-parts.js's partType field.
//
// TODO: the three entries below are placeholders. Replace label/passive/active with the real
// Division kinds and their outcome text once that content is written.
export const DIVISION_KINDS = [
	{
		key: "kind-a",
		label: "TODO Kind A",
		passive: "<p>TODO — replace with the real passive outcome text.</p>",
		active: [
			"TODO — replace with the first real active outcome text.",
			"TODO — replace with the second real active outcome text."
		]
	},
	{
		key: "kind-b",
		label: "TODO Kind B",
		passive: "<p>TODO — replace with the real passive outcome text.</p>",
		active: [
			"TODO — replace with the first real active outcome text.",
			"TODO — replace with the second real active outcome text."
		]
	},
	{
		key: "kind-c",
		label: "TODO Kind C",
		passive: "<p>TODO — replace with the real passive outcome text.</p>",
		active: [
			"TODO — replace with the first real active outcome text.",
			"TODO — replace with the second real active outcome text."
		]
	}
];

export function findDivisionKind(key) {
	return DIVISION_KINDS.find((kind) => kind.key === key) ?? null;
}
