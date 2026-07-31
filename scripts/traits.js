// Every playbook shares these six traits; only their per-playbook value and (for CHANNEL,
// which not every playbook grants yet) disabled state live in system.stats. Centralized here
// rather than duplicated per-playbook like system.details.callsign.label, since unlike the
// callsign label these never vary between playbooks. Split out from playbook-actor-sheet.js so
// moves.js can reference trait labels without importing the sheet module (which imports moves.js).
export const TRAITS = [
	{ key: "defy", label: "DEFY" },
	{ key: "sense", label: "SENSE" },
	{ key: "clash", label: "CLASH" },
	{ key: "talk", label: "TALK" },
	{ key: "know", label: "KNOW" },
	{ key: "channel", label: "CHANNEL" }
];
