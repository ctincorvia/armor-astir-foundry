# Foundry Module Development Notes

## What a module is
- A Foundry module is a package folder placed in the user data modules directory.
- The module folder name must match the manifest `id` exactly.
- A module can add content, UI changes, new functionality, or translations.
- The baseline PBTA Foundry system source is available in a sibling directory and should be used as the reference environment for this module.
- A similar module for Masks: New Generation is also available in a sibling directory and can be used as a practical example for structure and patterns.

## Minimum structure
```text
Data/modules/<module-id>/
  module.json
```

A practical structure is:
```text
module.json
scripts/
styles/
templates/
lang/
packs/
```

## Minimum manifest
The module must include a valid `module.json` at the root.

Useful fields:
- `id`: unique lowercase identifier, usually hyphenated
- `title`: human-readable name shown in Foundry
- `description`: summary of the module
- `version`: version number for updates
- `authors`: author info
- `compatibility`: `minimum`, `verified`, optional `maximum`

Example:
```json
{
  "id": "armor-astir",
  "title": "Armor Astir",
  "description": "A Foundry module for the Armor Astir TRPG.",
  "version": "0.1.0",
  "authors": [{ "name": "Your Name" }],
  "compatibility": {
    "minimum": "10",
    "verified": "11"
  }
}
```

## How modules load code
- Add JavaScript via `scripts` or prefer `esmodules`.
- Example:
```json
{
  "esmodules": ["scripts/main.js"]
}
```
- Use Foundry hooks for startup behavior:
```js
Hooks.on("init", () => {
  console.log("Module initialized");
});

Hooks.on("ready", () => {
  console.log("Module ready");
});
```

## Useful manifest features
- `styles`: add CSS files
- `lang`: add localization files
- `packs`: include compendium content
- `relationships`: require other modules/systems/worlds
- `system`: restrict the module to specific systems
- `url`, `manifest`, `download`: useful for distribution and updates

## Practical advice
- Keep the manifest valid JSON.
- Use a unique, lowercase `id`.
- Start simple: manifest + one script.
- Increment the version whenever you release changes.
- If the module depends on another package, declare it in `relationships`.

## Good first milestone
Build the smallest possible working module:
1. Create the folder and `module.json`
2. Add one script file
3. Load it with `esmodules` or `scripts`
4. Confirm it appears in Foundry and logs to the console
