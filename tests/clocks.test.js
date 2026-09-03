import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	CLOCK_STEPS_DEFAULT,
	CLOCK_STEPS_MAX,
	CLOCK_STEPS_MIN,
	addClock,
	removeClock,
	setClockProgress,
	updateClockLabel,
	updateClockSteps
} from "../scripts/core/clocks.js";

beforeEach(() => {
	vi.resetAllMocks();
	foundry.utils.randomID.mockReturnValue("test-id");
});

describe("CLOCK_STEPS_MIN/CLOCK_STEPS_MAX/CLOCK_STEPS_DEFAULT", () => {
	it("bounds a clock's step count at 2-12, defaulting to 6", () => {
		expect(CLOCK_STEPS_MIN).toBe(2);
		expect(CLOCK_STEPS_MAX).toBe(12);
		expect(CLOCK_STEPS_DEFAULT).toBe(6);
	});
});

describe("addClock", () => {
	it("appends a new clock with a generated id, empty progress, and the default step count", () => {
		expect(addClock([], {})).toEqual([{ id: "test-id", label: "", progress: 0, steps: CLOCK_STEPS_DEFAULT }]);
	});

	it("takes an explicit label and step count", () => {
		expect(addClock([], { label: "Court-Martialled", steps: 4 })).toEqual([
			{ id: "test-id", label: "Court-Martialled", progress: 0, steps: 4 }
		]);
	});

	it("leaves existing clocks untouched", () => {
		const existing = { id: "c1", label: "Existing", progress: 2, steps: 6 };
		expect(addClock([existing], {})).toEqual([existing, { id: "test-id", label: "", progress: 0, steps: CLOCK_STEPS_DEFAULT }]);
	});
});

describe("removeClock", () => {
	it("removes the matching clock, leaving others untouched", () => {
		const a = { id: "a", label: "A", progress: 0, steps: 6 };
		const b = { id: "b", label: "B", progress: 0, steps: 6 };
		expect(removeClock([a, b], "a")).toEqual([b]);
	});

	it("does nothing for an id that isn't present", () => {
		const a = { id: "a", label: "A", progress: 0, steps: 6 };
		expect(removeClock([a], "nope")).toEqual([a]);
	});
});

describe("updateClockLabel", () => {
	it("updates the matching clock's label, leaving other fields and other clocks untouched", () => {
		const a = { id: "a", label: "Old", progress: 2, steps: 6 };
		const b = { id: "b", label: "B", progress: 0, steps: 4 };
		expect(updateClockLabel([a, b], "a", "New")).toEqual([{ ...a, label: "New" }, b]);
	});
});

describe("updateClockSteps", () => {
	it("updates the matching clock's step count", () => {
		const clock = { id: "a", label: "A", progress: 2, steps: 6 };
		expect(updateClockSteps([clock], "a", 8)).toEqual([{ ...clock, steps: 8 }]);
	});

	it("clamps below CLOCK_STEPS_MIN up to the minimum", () => {
		const clock = { id: "a", label: "A", progress: 0, steps: 6 };
		expect(updateClockSteps([clock], "a", 1)).toEqual([{ ...clock, steps: CLOCK_STEPS_MIN }]);
	});

	it("clamps above CLOCK_STEPS_MAX down to the maximum", () => {
		const clock = { id: "a", label: "A", progress: 0, steps: 6 };
		expect(updateClockSteps([clock], "a", 99)).toEqual([{ ...clock, steps: CLOCK_STEPS_MAX }]);
	});

	it("treats a non-numeric value as the minimum", () => {
		const clock = { id: "a", label: "A", progress: 0, steps: 6 };
		expect(updateClockSteps([clock], "a", "not-a-number")).toEqual([{ ...clock, steps: CLOCK_STEPS_MIN }]);
	});

	it("pulls progress back down if it would otherwise exceed the new, smaller step count", () => {
		const clock = { id: "a", label: "A", progress: 5, steps: 6 };
		expect(updateClockSteps([clock], "a", 3)).toEqual([{ ...clock, steps: 3, progress: 3 }]);
	});

	it("leaves progress untouched when it still fits the new step count", () => {
		const clock = { id: "a", label: "A", progress: 2, steps: 6 };
		expect(updateClockSteps([clock], "a", 8)).toEqual([{ ...clock, steps: 8, progress: 2 }]);
	});

	it("leaves other clocks in the list untouched", () => {
		const a = { id: "a", label: "A", progress: 0, steps: 6 };
		const b = { id: "b", label: "B", progress: 1, steps: 4 };
		expect(updateClockSteps([a, b], "a", 8)).toEqual([{ ...a, steps: 8 }, b]);
	});

	it("treats a missing progress field as 0 when clamping", () => {
		const clock = { id: "a", label: "A", steps: 6 };
		expect(updateClockSteps([clock], "a", 3)).toEqual([{ ...clock, steps: 3, progress: 0 }]);
	});
});

describe("setClockProgress", () => {
	it("fills up to the clicked step", () => {
		const clock = { id: "a", label: "A", progress: 0, steps: 6 };
		expect(setClockProgress([clock], "a", 3)).toEqual([{ ...clock, progress: 3 }]);
	});

	it("clicking the currently-filled top step clears it back by one", () => {
		const clock = { id: "a", label: "A", progress: 3, steps: 6 };
		expect(setClockProgress([clock], "a", 3)).toEqual([{ ...clock, progress: 2 }]);
	});

	it("clamps at the clock's own step count, not a shared constant", () => {
		const clock = { id: "a", label: "A", progress: 0, steps: 4 };
		expect(setClockProgress([clock], "a", 4)).toEqual([{ ...clock, progress: 4 }]);
	});

	it("never drops below 0", () => {
		const clock = { id: "a", label: "A", progress: 0, steps: 6 };
		expect(setClockProgress([clock], "a", 0)).toEqual([{ ...clock, progress: 0 }]);
	});

	it("leaves other clocks untouched", () => {
		const a = { id: "a", label: "A", progress: 0, steps: 6 };
		const b = { id: "b", label: "B", progress: 1, steps: 6 };
		expect(setClockProgress([a, b], "a", 2)).toEqual([{ ...a, progress: 2 }, b]);
	});

	it("treats a missing progress field as 0", () => {
		const clock = { id: "a", label: "A", steps: 6 };
		expect(setClockProgress([clock], "a", 3)).toEqual([{ ...clock, progress: 3 }]);
	});

	it("treats a missing steps field as CLOCK_STEPS_DEFAULT", () => {
		const clock = { id: "a", label: "A", progress: 0 };
		expect(setClockProgress([clock], "a", CLOCK_STEPS_DEFAULT)).toEqual([{ ...clock, progress: CLOCK_STEPS_DEFAULT }]);
	});
});
