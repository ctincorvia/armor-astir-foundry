import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Only a handful of test files touch the DOM; they opt in with a
		// `// @vitest-environment happy-dom` docblock rather than all 111 paying for one.
		environment: "node",
		pool: "threads",
		setupFiles: ["tests/setup.js"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov"],
			include: ["scripts/**/*.js"],
			thresholds: {
				lines: 100,
				branches: 100,
				functions: 100,
				statements: 100
			}
		}
	}
});
