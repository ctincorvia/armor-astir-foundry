import { beforeEach, describe, expect, it, vi } from "vitest";

import { showCustomMoveFieldReference } from "../scripts/reflavor/reflavor-help.js";

// Dialog construction only happens once the async fetch/text chain resolves, so a plain
// Dialog.mock.calls.at(-1) read right after calling showCustomMoveFieldReference() can race the
// pending microtasks — vi.waitFor mirrors tests/actor-creation.test.js's own latestDialogOptions
// helper for the identical "an async continuation opens the next Dialog" shape.
async function latestDialogOptions() {
	const calls = await vi.waitFor(() => {
		expect(Dialog.mock.calls.length).toBeGreaterThan(0);
		return Dialog.mock.calls;
	});
	return calls.at(-1)[0];
}

beforeEach(() => {
	vi.resetAllMocks();
	// resetAllMocks wipes the default Dialog implementation stubbed in tests/setup.js.
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
		this.close = vi.fn(() => this.data.close?.());
	});
	vi.stubGlobal("fetch", vi.fn());
	vi.stubGlobal("getRoute", vi.fn((path) => path));
	vi.stubGlobal("showdown", undefined);
});

describe("showCustomMoveFieldReference", () => {
	it("fetches docs/custom-moves.md and renders it via showdown when available", async () => {
		fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("# Heading\n\nBody text.") });
		const makeHtml = vi.fn().mockReturnValue("<h1>Heading</h1><p>Body text.</p>");
		const Converter = vi.fn().mockImplementation(() => ({ makeHtml }));
		vi.stubGlobal("showdown", { Converter });

		const promise = showCustomMoveFieldReference();
		const dialogOptions = await latestDialogOptions();

		expect(fetch).toHaveBeenCalledWith("modules/armor-astir/docs/custom-moves.md");
		expect(Converter).toHaveBeenCalledWith({
			disableForced4SpacesIndentedSublists: true,
			noHeaderId: true,
			parseImgDimensions: true,
			strikethrough: true,
			tables: true,
			tablesHeaderId: true
		});
		expect(makeHtml).toHaveBeenCalledWith("# Heading\n\nBody text.");
		expect(dialogOptions.title).toBe("Custom Move Field Reference");
		expect(dialogOptions.content).toBe("<div class=\"custom-move-reference-content\"><h1>Heading</h1><p>Body text.</p></div>");
		expect(Dialog.mock.calls.at(-1)[1]).toEqual({ classes: ["armor-astir", "custom-move-reference-dialog"], width: 1200 });

		dialogOptions.close();
		await expect(promise).resolves.toBeUndefined();
	});

	it("falls back to a <pre>-wrapped raw-text render when window.showdown is unavailable", async () => {
		fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("# Heading\n\nBody text.") });

		const promise = showCustomMoveFieldReference();
		const dialogOptions = await latestDialogOptions();

		expect(dialogOptions.content).toBe("<div class=\"custom-move-reference-content\"><pre># Heading\n\nBody text.</pre></div>");

		dialogOptions.close();
		await promise;
	});

	it("opens a Dialog with a plain-English error message instead of throwing when the fetch itself rejects", async () => {
		fetch.mockRejectedValue(new Error("network down"));

		const promise = showCustomMoveFieldReference();
		const dialogOptions = await latestDialogOptions();

		expect(dialogOptions.content).toContain("Couldn't load the reference doc");
		expect(dialogOptions.content).toContain("docs/custom-moves.md");

		dialogOptions.close();
		await promise;
	});

	it("opens a Dialog with a plain-English error message instead of throwing when the response is not ok", async () => {
		fetch.mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve("") });

		const promise = showCustomMoveFieldReference();
		const dialogOptions = await latestDialogOptions();

		expect(dialogOptions.content).toContain("Couldn't load the reference doc");

		dialogOptions.close();
		await promise;
	});

	it("resolves when the Close button's callback is invoked, same as closing the dialog", async () => {
		fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("text") });

		const promise = showCustomMoveFieldReference();
		const dialogOptions = await latestDialogOptions();
		dialogOptions.buttons.close.callback();

		await expect(promise).resolves.toBeUndefined();
	});

	it("closes the first dialog and resolves its promise when a second call supersedes it", async () => {
		fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("text") });

		const firstPromise = showCustomMoveFieldReference();
		await latestDialogOptions();
		const firstDialog = Dialog.mock.instances.at(-1);

		const secondPromise = showCustomMoveFieldReference();
		await vi.waitFor(() => expect(Dialog.mock.calls.length).toBe(2));

		expect(firstDialog.close).toHaveBeenCalled();
		await expect(firstPromise).resolves.toBeUndefined();

		const secondDialogOptions = Dialog.mock.calls.at(-1)[0];
		secondDialogOptions.close();
		await expect(secondPromise).resolves.toBeUndefined();
	});

	it("does not re-close the first dialog once it has already closed itself", async () => {
		fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("text") });

		const firstPromise = showCustomMoveFieldReference();
		const firstDialogOptions = await latestDialogOptions();
		const firstDialog = Dialog.mock.instances.at(-1);
		firstDialogOptions.close();
		await firstPromise;

		const secondPromise = showCustomMoveFieldReference();
		await vi.waitFor(() => expect(Dialog.mock.calls.length).toBe(2));
		const secondDialog = Dialog.mock.instances.at(-1);

		expect(firstDialog.close).not.toHaveBeenCalled();
		expect(secondDialog.close).not.toHaveBeenCalled();

		const secondDialogOptions = Dialog.mock.calls.at(-1)[0];
		secondDialogOptions.close();
		await expect(secondPromise).resolves.toBeUndefined();
	});
});
