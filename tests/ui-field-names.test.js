import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UI_FIELD_PREFIX, stripUiFields } from "../scripts/core/ui-field-names.js";
import { WorldActorSheet } from "../scripts/world-actors/world-actor-sheet.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { NpcActorSheet } from "../scripts/world-actors/npc-actor-sheet.js";

describe("stripUiFields", () => {
	it("drops keys under the reserved prefix and keeps everything else", () => {
		expect(stripUiFields({
			name: "Vex",
			"system.details.description.value": "text",
			[`${UI_FIELD_PREFIX}divisions:d1:name`]: "The Wardens",
			[`${UI_FIELD_PREFIX}astir-core-select`]: "core"
		})).toEqual({ name: "Vex", "system.details.description.value": "text" });
	});
});

describe.each([
	["WorldActorSheet", WorldActorSheet],
	["PlaybookActorSheet", PlaybookActorSheet],
	["NpcActorSheet", NpcActorSheet]
])("%s#_getSubmitData", (_name, SheetClass) => {
	afterEach(() => {
		delete ActorSheet.prototype._getSubmitData;
	});

	it("strips reserved-prefix fields from core's submit data", () => {
		ActorSheet.prototype._getSubmitData = vi.fn(() => ({ name: "Vex", "aa-ui:schemes:c1:label": "Plot" }));
		const sheet = new SheetClass();

		expect(sheet._getSubmitData({ extra: 1 })).toEqual({ name: "Vex" });
		expect(ActorSheet.prototype._getSubmitData).toHaveBeenCalledWith({ extra: 1 });
	});
});

// Core AppV1 restores focus across a re-render only via form[focus.name], so an unnamed field
// loses focus whenever a change elsewhere re-renders the sheet.
describe("actor-sheet templates", () => {
	const templatesDir = join(import.meta.dirname, "..", "templates");
	const actorSheetTemplates = readdirSync(templatesDir, { recursive: true })
		.map((file) => file.replaceAll("\\", "/"))
		.filter((file) => file.endsWith(".hbs"))
		.filter((file) => /-actor-sheet\.hbs$/.test(file)
			|| /^(playbook-sheet|npc-sheet|authority-sheet|cause-sheet|world-actor-shared)\//.test(file));

	it("finds the actor-sheet templates", () => {
		expect(actorSheetTemplates.length).toBeGreaterThan(10);
	});

	it.each(actorSheetTemplates)("names every focusable field in %s", (file) => {
		const markup = readFileSync(join(templatesDir, file), "utf8");
		const unnamed = (markup.match(/<(input|textarea|select)\b[^>]*>/g) ?? [])
			.filter((tag) => !/type="(checkbox|radio)"/.test(tag))
			.filter((tag) => !/\sname="/.test(tag));

		expect(unnamed).toEqual([]);
	});
});
