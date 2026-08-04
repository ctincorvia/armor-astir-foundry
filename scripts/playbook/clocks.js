// Generic, reusable narrative clocks — unlike Gravity Clocks (PlaybookActorSheet's own
// gravityClocks handling: a fixed-6-step array tied to the Social tab's Gravity Trigger section,
// with an extra secondary 1-3 value), a clock here carries its own step count and isn't tied to any
// one playbook, trigger, or move — any playbook can start one whenever the fiction calls for it
// (e.g. Commander's Withdraw: "start or advance a 4-step clock titled 'court-martialled'"). Pure
// array helpers, no Foundry API beyond randomID, same reasoning entry-list.js's own CRUD helpers
// give for reuse/testability.
export const CLOCK_STEPS_MIN = 2;
export const CLOCK_STEPS_MAX = 12;
export const CLOCK_STEPS_DEFAULT = 6;

export function addClock(list, { label = "", steps = CLOCK_STEPS_DEFAULT } = {}) {
	return [...list, { id: foundry.utils.randomID(), label, progress: 0, steps }];
}

export function removeClock(list, id) {
	return list.filter((clock) => clock.id !== id);
}

export function updateClockLabel(list, id, label) {
	return list.map((clock) => (clock.id === id ? { ...clock, label } : clock));
}

// Clamped to CLOCK_STEPS_MIN/MAX, and progress is pulled back down if it would otherwise exceed the
// new (smaller) step count — the same "never leave stored data past its own bound" care
// _onGravityClockStep already takes for Gravity's fixed track.
export function updateClockSteps(list, id, steps) {
	const clamped = Math.min(CLOCK_STEPS_MAX, Math.max(CLOCK_STEPS_MIN, Number(steps) || CLOCK_STEPS_MIN));
	return list.map((clock) => (clock.id === id
		? { ...clock, steps: clamped, progress: Math.min(clock.progress ?? 0, clamped) }
		: clock));
}

// Same click-to-set / click-top-to-decrement interaction as Gravity Clocks' own progress track (see
// PlaybookActorSheet#_onGravityClockStep) — clicking the currently-filled top step clears it back
// by one, clicking any other step fills up to it.
export function setClockProgress(list, id, step) {
	return list.map((clock) => {
		if (clock.id !== id) return clock;
		const progress = clock.progress ?? 0;
		const next = step === progress ? step - 1 : step;
		const clamped = Math.min(clock.steps ?? CLOCK_STEPS_DEFAULT, Math.max(0, next));
		return { ...clock, progress: clamped };
	});
}
