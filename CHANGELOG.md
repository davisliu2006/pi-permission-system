# Changelog

## [0.2.0] — Unreleased

### Added

- Added bash splitting. A chained command like `cd dir && git status` now checks `cd dir` and `git status` seperately. Bash wildcard can now generate multiple patterns at once (eg. `cd *; git status`).

### Changed

- Local permission config now loads from `.pi/pi-permissions.jsonc` instead of the project root, which is consistent with Pi local config conventions.
- Made `ai-purpose` responses more concise by adding examples to the prompt.

## [0.1.0] — 2026-11-01

Initial version.