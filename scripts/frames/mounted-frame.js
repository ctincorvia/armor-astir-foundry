import { ARDENT_DEFAULT_NAME } from "./ardent.js";

// The display name of whichever frame (Astir or one Ardent) this actor is currently piloting,
// or null when nothing is mounted — mirrors frames-mixin.js's _frames()/_mountedFrame() naming
// (Astir: Callsign, falling back to the actor's own name; Ardent: its own stored name, falling
// back to ARDENT_DEFAULT_NAME), but as a plain function so chat-posting code that only has the
// actor (not the sheet) can reuse it.
export function getMountedFrameName(actor) {
	if (actor.system?.attributes?.astir?.piloted) {
		return actor.system.details?.callsign?.value || actor.name;
	}
	const ardent = (actor.system?.attributes?.ardents ?? []).find((entry) => entry.piloted);
	if (ardent) {
		return ardent.name || ARDENT_DEFAULT_NAME;
	}
	return null;
}
