---
source_handle: kcs-boardlib-head-2026-10
fetched: 2026-10-19
source_url: https://github.com/lemeryfertitta/BoardLib/tree/4fa8a2e44be522114fd8b29ec00a4f3e9a823fca
provenance: source-direct
substrate_confidence: source-direct
---

# BoardLib at HEAD (main = 4fa8a2e4, committed 2026-03-17T20:52:02Z, "Bump version from 0.14.1 to 0.15.1")

Read via GitHub API (contents at that SHA) on 2026-10-19. Files read in full: src/boardlib/api/aurora.py (726 lines), src/boardlib/db/aurora.py (194 lines), src/boardlib/__main__.py (340 lines), README.md.

## Repo state
- Default branch main; not archived; repo (API reported pushed_at 2026-03-17T20:52:36Z). No commits after 2026-03-17 as of 2026-10-19 (commit list newest-first begins 4fa8a2e4).
- PyPI latest release: 0.15.1, summary "Utilities for interacting with climbing board APIs".
- Most recent commits touching api/aurora.py: 7538226c (2026-03-14, "Replaced --raw with --composite..."), 978659f1 (2026-03-14), b2c826b4 (2026-03-07) - all image-download features, none a Kilter endpoint migration.
- Commit 5528b8ec (2026-02-22) "set genereic "User-Agent" in https header of session to establish sucessful connection with server" - diff touches src/boardlib/api/moon.py (MoonBoard), not Aurora.

## Sync request shape (api/aurora.py, function sync)
- BASE_SYNC_DATE = "1970-01-01 00:00:00.000000"; DEFAULT_MAX_SYNC_PAGES = 100.
- HOST_BASES kilter -> "kilterboardapp"; WEB_HOSTS[board] = "https://{host_base}.com" (so https://kilterboardapp.com). Images from "https://api.{host_base}.com/img/{image_filename}".
- sync(): POST {WEB_HOSTS[board]}/sync ; headers Accept: application/json, User-Agent "Kilter%20Board/202 CFNetwork/1568.100.1 Darwin/24.0.0", Content-Type application/x-www-form-urlencoded; if token: Cookie "token=<token>". Body built manually as "table=last_sync_date&table2=..." (comment in code: "Build URL-encoded form data manually - Aurora expects this format!").
- Response: JSON object; key "_complete" popped (loop ends when true); other keys are table names -> list of row dicts; also "shared_syncs" and (when token) "user_syncs" lists of {table_name, last_synchronized_at}. After each page the code sets payload_dict[table_name] = last_synchronized_at for every table present in the request payload, then re-POSTs until _complete or max_pages.
- Initial cursors for the database command come from the local SQLite table: "SELECT table_name, last_synchronized_at FROM shared_syncs" (db/aurora.py get_shared_syncs).

## Auth
- login(): POST {WEB_HOSTS[board]}/sessions JSON {username, password, tou:"accepted", pp:"accepted", ua:"app"}; returns response.json()["session"]; __main__.get_aurora_login_token returns login_info["token"]; HTTP 422 -> "Invalid username or password".
- handle_database_command (__main__.py lines 68-100) always obtains a login token (get_aurora_login_token) before sync; if no --username is given it prints "No username provided, skipping database synchronization." and returns after (optionally) downloading the APK DB. So in BoardLib the database sync is account-authenticated, though sync() itself accepts token=None.

## Local apply semantics (db/aurora.py)
- sync_shared_tables: for each table in the response, ROW_INSERTERS.get(table, insert_rows_default); default = "INSERT OR REPLACE INTO {table} VALUES (...)" with columns from PRAGMA table_info.
- climb_stats special-case insert_rows_climb_stats: display_difficulty = benchmark_difficulty if truthy else difficulty_average; docstring "When a row has no display_difficulty, this means the row should be deleted"; rows with no display_difficulty are DELETEd by (climb_uuid, angle). No generic deletion handling for other tables is present in this module (no tombstone logic found for climbs).

## Bootstrapped DB source
- download_database: GET https://d.apkpure.net/b/APK/com.auroraclimbing.{kilterboard|...}?version=latest with browser UA; unzips bundle (nested .apk) and extracts assets/db.sqlite3. APP_PACKAGE_NAMES kilter -> "kilterboard".
- Other tables referenced by BoardLib code: shared_syncs, climb_stats, climbs (uuid, name), difficulty_grades (difficulty, boulder_name), product_sizes_layouts_sets (image_filename, layout_id, product_size_id), layouts, product_sizes.

## README (HEAD)
- "All Aurora Climbing based boards (Kilter, Tension, etc.)"; database command downloads sqlite then "will then use the sync API to synchronize it with the latest available data. The database will only contain the 'shared,' public data. User data is not synchronized."
- README contains no notice about the Kilter migration or Aurora shutdown.
