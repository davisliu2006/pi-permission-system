# Changelog

## Unreleased

### Added

- Added experimental auto-classifier, `auto` permission, and `settings.auto_allow_criteria`.

## [0.3.0] — 2026-11-07

### Added

- Added `settings` to the config schema for non-permission settings.
- Added `settings.ai_model` config field to optionally override the model for small helper completions.

### Changed

- `deny` rules can now check complex bash segments.

## [0.2.0] — 2026-11-03

### Added

- Added bash splitting. A chained command like `cd dir && git status` now checks `cd dir` and `git status` separately. Bash wildcard can now generate multiple patterns at once (eg. `cd *; git status`).

### Changed

- Local permission config now loads from `.pi/pi-permissions.jsonc` instead of the project root, which is consistent with Pi local config conventions.
- Made `ai-purpose` responses more concise by adding examples to the prompt.
- Improved permission dialog UI by putting details in a custom TUI display instead of the selector title.

## [0.1.0] — 2026-11-01

Initial version.