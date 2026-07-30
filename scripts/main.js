export const MODULE_ID = "armor-astir";

export function registerInitHook() {
	Hooks.once("init", () => {
		console.log(`${MODULE_ID} | Initialized`);
	});
}

registerInitHook();
