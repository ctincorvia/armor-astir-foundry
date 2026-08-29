// A dependency-free leaf, the moves-domain counterpart to astir-parts.js's ASTIR_PART_CATALOG —
// every Director-authored custom Move (see scripts/custom-content/custom-content-moves-schema.js/
// custom-content-moves-validate.js) is pushed in here by custom-content-apply.js, alongside three
// other live arrays it must also reach (ALL_MOVES, ALL_PLAYBOOK_MOVES, ASTIR_MOVE_CATALOG — see
// docs/domains/reflavor.md's "Adding brand-new catalog entries" for why a custom Move needs all
// four). This array exists purely so both pickers (playbookMoveSections/astirMoveSections) have a
// single, always-current "every custom move" list to build their own Custom Moves section from,
// independent of which of the other three catalogs a given lookup happens to go through.
export const CUSTOM_MOVE_CATALOG = [];
