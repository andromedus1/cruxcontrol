---
source_handle: boardlib
fetched: 2026-06-13
source_url: https://github.com/lemeryfertitta/BoardLib
provenance: source-direct
---

# lemeryfertitta/BoardLib — utilities for climbing board APIs

## Summary

Python package that downloads and syncs the Aurora Climbing (Kilter/Tension/…)
SQLite database. The `boardlib database <board_name> <database_path> --username
<board_username>` command first downloads a SQLite file, then uses the sync API
to bring it up to date; if a database already exists it skips the download and
only syncs. By default only "shared," public data is synchronized — user data is
not. The canonical reference implementation for the Kilter sync protocol.

## Key passages

- Command: "boardlib database <board_name> <database_path> --username <board_username>"
- "This command will first download a sqlite database file to the given path. After downloading, the database will then use the sync API to synchronize it with the latest available data."
- "The database will only contain the 'shared,' public data. User data is not synchronized."
- "the command will skip the download step and only perform the synchronization" (when a database already exists).
