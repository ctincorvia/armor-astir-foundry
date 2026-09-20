// @vitest-environment happy-dom
/**
 * Cascade tests for the dark theme, run against the REAL styles/tokens.css and
 * styles/theme-dark.css.
 *
 * Why this file exists (it's the only CSS test in the repo): every rule in theme-dark.css exists
 * solely to out-specify a stylesheet with no theme awareness -- pbta's, or core Foundry's. That is
 * a silent failure mode. A selector that doesn't match produces no error, no warning, and no
 * devtools strikethrough; the page just keeps the other stylesheet's value. Exactly that shipped
 * once already: the chat-card background rule required `.theme-dark` *on* `#chat`, but core themes
 * `#interface` instead, so cards stayed pbta-white while the text rule beside it (which only
 * needed a themed ancestor) correctly went light -- white card, near-white text.
 *
 * happy-dom is already this project's test environment and resolves var(), :is(), :has() and
 * :where() with real cascade semantics, so the competing rules can simply be put in front of it.
 *
 * The pbta and core rules below are reproduced verbatim from the installed copies, cited per
 * block -- neither package is a dependency of this repo, so they can't be imported. If a rule
 * here ever stops matching what's installed, that's worth knowing: these are precisely the
 * selectors theme-dark.css is pitched against.
 */
import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach } from "vitest";

// Every stylesheet, in the exact order module.json loads them -- order is load-bearing here
// (tokens.css first, theme-dark.css last), so reading it from the manifest keeps this honest
// rather than hardcoding a list that could drift from what Foundry actually serves.
const moduleStyles = JSON.parse(readFileSync("module.json", "utf8")).styles;
const MODULE_CSS = moduleStyles.map(path => readFileSync(path, "utf8")).join("\n");

/** pbta 1.2.0, styles/dist/pbta.css -- the three rules that paint this module's surfaces. */
const PBTA_CSS = `
.vtt :not(.application,.image-popout,.journal-sheet) .window-content { background-color: rgb(255,255,255); }
.vtt #chat .message { background-color: rgb(255,255,255); }
.vtt .window-app input, .vtt .window-app select, .vtt .window-app textarea { background-color: rgb(255,255,255); }
`;

/**
 * Core Foundry v14, public/css/foundry2.css. Headings carry a direct colour declaration, and the
 * token it reads resolves *light-theme* inside anything marked theme-light -- which is every
 * ApplicationV1 window (forced by core) and the chat log (hardcoded in its template).
 */
const CORE_CSS = `
.theme-light { --color-text-primary: rgb(25,24,19); }
.theme-dark { --color-text-primary: rgb(232,234,237); }
h1, h2 { color: var(--color-text-emphatic); }
h3, h4 { color: var(--color-text-primary); }
`;

const COLOR = {
	surfaceDark: "#1e2126",
	white: "#ffffff",
	inkDark: "#e8eaed",
	fieldDark: "#171a1e",
	moonstoneLight: "#9fc4d2", // --aa-primary-strong under the dark theme
	amethystDark: "#3d1f4e",   // --aa-primary-strong under the light theme
	coreDarkText: "#191813"   // what core's h3 rule resolves to inside a theme-light window
};

/** happy-dom returns whichever notation the winning declaration used; normalise to #rrggbb. */
function hex(value) {
	const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
	if (rgb) return "#" + rgb.slice(1, 4).map(n => Number(n).toString(16).padStart(2, "0")).join("");
	const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
	if (short) return "#" + short.slice(1, 4).map(c => c + c).join("").toLowerCase();
	return value.toLowerCase();
}

/** An ApplicationV1 window. Core force-adds "themed theme-light" to every one of these. */
const sheet = (classes = "sheet actor") => `
<div class="app window-app armor-astir ${classes} themed theme-light">
	<section class="window-content" id="content">
		<h3 id="heading">Section</h3>
		<input id="field" type="text" />
	</section>
</div>`;

/**
 * The sidebar chat. Note where each theme class sits: core themes #interface unconditionally,
 * while the chat log itself is pinned theme-light by its own template
 * (templates/sidebar/tabs/chat/log.hbs). Getting this structure right is the whole point.
 */
const chat = () => `
<div id="interface" class="themed theme-dark">
	<section id="chat" class="tab sidebar-tab">
		<ol class="chat-log plain themed theme-light">
			<li class="chat-message message flexcol" id="ours">
				<div class="message-content">
					<div class="armor-astir-downtime-scene-chat">
						<h3 id="card-title" class="downtime-scene-chat-name">Command Deck</h3>
						<p id="card-body">body text</p>
					</div>
				</div>
			</li>
			<li class="chat-message message flexcol" id="theirs">
				<div class="message-content"><div class="some-other-module">unrelated</div></div>
			</li>
		</ol>
	</section>
</div>`;

function render({ html, dark }) {
	document.head.innerHTML = "";
	document.body.className = dark ? "vtt game theme-dark" : "vtt game theme-light";
	document.body.innerHTML = html;
	const style = document.createElement("style");
	// Source order mirrors the real page: system, then core, then this module's own sheets.
	style.textContent = PBTA_CSS + CORE_CSS + MODULE_CSS;
	document.head.appendChild(style);
}

const styleOf = (id, prop) => hex(getComputedStyle(document.getElementById(id))[prop]);

beforeEach(() => {
	document.head.innerHTML = "";
	document.body.innerHTML = "";
});

describe("dark theme -- chat cards", () => {
	it("repaints this module's chat message over pbta's white fill", () => {
		render({ html: chat(), dark: true });
		expect(styleOf("ours", "backgroundColor")).toBe(COLOR.surfaceDark);
	});

	it("leaves other packages' chat messages entirely alone", () => {
		render({ html: chat(), dark: true });
		expect(styleOf("theirs", "backgroundColor")).toBe(COLOR.white);
	});

	it("colours card body text, which cannot inherit through the theme-light chat log", () => {
		render({ html: chat(), dark: true });
		expect(styleOf("card-body", "color")).toBe(COLOR.inkDark);
	});

	it("colours the card title, which core declares directly on h3 and would leave dark", () => {
		render({ html: chat(), dark: true });
		expect(styleOf("card-title", "color")).toBe(COLOR.moonstoneLight);
	});
});

describe("dark theme -- sheets and dialogs", () => {
	it("repaints .window-content over pbta's white fill", () => {
		render({ html: sheet(), dark: true });
		expect(styleOf("content", "backgroundColor")).toBe(COLOR.surfaceDark);
	});

	it("keeps a sheet's own accent h3 rule rather than flattening it to plain ink", () => {
		render({ html: sheet("sheet actor"), dark: true });
		expect(styleOf("heading", "color")).toBe(COLOR.moonstoneLight);
	});

	it("gives dialog headings an ink floor -- dialogs never carry .sheet, so no accent rule hits them", () => {
		render({ html: sheet("downtime-scene-dialog"), dark: true });
		expect(styleOf("heading", "color")).toBe(COLOR.inkDark);
	});

	it("sinks form fields below the page, beating pbta's white input fill", () => {
		render({ html: sheet(), dark: true });
		expect(styleOf("field", "backgroundColor")).toBe(COLOR.fieldDark);
	});
});

describe("light theme -- unchanged", () => {
	it("leaves chat messages to pbta", () => {
		render({ html: chat().replace('id="interface" class="themed theme-dark"', 'id="interface" class="themed theme-light"'), dark: false });
		expect(styleOf("ours", "backgroundColor")).toBe(COLOR.white);
	});

	it("keeps the sheet's amethyst h3, not the dark theme's moonstone", () => {
		render({ html: sheet(), dark: false });
		expect(styleOf("heading", "color")).toBe(COLOR.amethystDark);
	});

	it("leaves form fields white", () => {
		render({ html: sheet(), dark: false });
		expect(styleOf("field", "backgroundColor")).toBe(COLOR.white);
	});
});
