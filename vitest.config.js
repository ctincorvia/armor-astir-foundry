import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "happy-dom",
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
