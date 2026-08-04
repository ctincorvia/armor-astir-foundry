// Pure array helpers shared by every world actor sheet's id-keyed lists (Carrier's Crew
// Members, Authority's Assets/Actors, Cause's Factions, and the fixed-slot Pillars/Divisions
// arrays) — see world-actor-sheet.js, which is the only caller. Kept free of any Foundry API
// beyond randomID so the CRUD logic itself is testable without stubbing actor.update.
export function addEntry(list, defaults) {
	return [...list, { id: foundry.utils.randomID(), ...defaults }];
}

export function removeEntry(list, id) {
	return list.filter((entry) => entry.id !== id);
}

export function updateEntryField(list, id, field, value) {
	return list.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry));
}
