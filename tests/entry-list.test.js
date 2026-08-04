import { describe, expect, it } from "vitest";
import { addEntry, removeEntry, updateEntryField } from "../scripts/world-actors/entry-list.js";

describe("addEntry", () => {
	it("appends a new entry with a generated id and the given defaults", () => {
		const result = addEntry([{ id: "existing" }], { name: "", description: "" });

		expect(result).toEqual([{ id: "existing" }, { id: "test-id", name: "", description: "" }]);
	});

	it("does not mutate the original list", () => {
		const list = [{ id: "existing" }];

		addEntry(list, { name: "" });

		expect(list).toEqual([{ id: "existing" }]);
	});
});

describe("removeEntry", () => {
	it("drops the entry with the matching id", () => {
		const result = removeEntry([{ id: "a" }, { id: "b" }], "a");

		expect(result).toEqual([{ id: "b" }]);
	});

	it("leaves the list unchanged when no entry matches", () => {
		const list = [{ id: "a" }];

		expect(removeEntry(list, "missing")).toEqual(list);
	});
});

describe("updateEntryField", () => {
	it("updates only the matching entry's field", () => {
		const result = updateEntryField(
			[{ id: "a", name: "Old" }, { id: "b", name: "Other" }],
			"a",
			"name",
			"New"
		);

		expect(result).toEqual([{ id: "a", name: "New" }, { id: "b", name: "Other" }]);
	});

	it("leaves every entry unchanged when no entry matches", () => {
		const list = [{ id: "a", name: "Old" }];

		expect(updateEntryField(list, "missing", "name", "New")).toEqual(list);
	});
});
