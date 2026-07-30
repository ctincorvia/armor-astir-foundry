import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { promises as fs } from "fs";

const MODULE_ROOT = process.cwd();
const yaml = false;

const packs = await fs.readdir("./src/packs");
for (const pack of packs) {
	if (pack === ".gitattributes") continue;
	console.log("Packing " + pack);
	await compilePack(
		`${MODULE_ROOT}/src/packs/${pack}`,
		`${MODULE_ROOT}/packs/${pack}`,
		{ yaml }
	);
}
