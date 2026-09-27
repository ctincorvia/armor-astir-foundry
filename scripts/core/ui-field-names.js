// Names under this prefix exist only so core AppV1 can restore focus by name across a re-render;
// a custom handler does the real write, so they're stripped from the form's own submit data.
export const UI_FIELD_PREFIX = "aa-ui:";

export function stripUiFields(data) {
	return Object.fromEntries(Object.entries(data).filter(([key]) => !key.startsWith(UI_FIELD_PREFIX)));
}
