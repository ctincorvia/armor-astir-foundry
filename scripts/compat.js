// Zero imports (a leaf module, like module-id.js) so every domain folder can import this without
// an upward dependency. Resolution stays lazy, inside each function body — an eager top-level
// `foundry.applications.handlebars.renderTemplate` reference would throw at import time on v12,
// aborting the whole esmodules chain (see claude.md, "Reference environment").
function lookup(path) {
	let node = globalThis;
	for (const key of path.split(".")) {
		if (node === undefined || node === null) return undefined;
		node = node[key];
	}
	return node;
}

// Namespaced-first/global-fallback order silences v13+ deprecation warnings while still working
// on v12, where the namespaced path doesn't exist yet.
function api(path, globalName) {
	return lookup(path) ?? globalThis[globalName];
}

export function renderTemplate(...args) {
	return api("foundry.applications.handlebars.renderTemplate", "renderTemplate")(...args);
}

export function loadTemplates(...args) {
	return api("foundry.applications.handlebars.loadTemplates", "loadTemplates")(...args);
}

export function readTextFromFile(...args) {
	return api("foundry.utils.readTextFromFile", "readTextFromFile")(...args);
}

export function saveDataToFile(...args) {
	return api("foundry.utils.saveDataToFile", "saveDataToFile")(...args);
}

export function getRoute(...args) {
	return api("foundry.utils.getRoute", "getRoute")(...args);
}

export function generation() {
	return Number(lookup("game.release.generation") ?? 12);
}

export function chatRenderHook() {
	return generation() >= 13 ? "renderChatMessageHTML" : "renderChatMessage";
}

// A no-op passthrough on v12/AppV1 hooks (already jQuery); wraps the bare HTMLElement v13+'s
// renderChatMessageHTML hook passes so the rest of the module can stay jQuery-shaped.
export function toJQuery(target) {
	if (!(target instanceof HTMLElement)) return target;
	const jq = globalThis.jQuery;
	return jq ? jq(target) : target;
}
