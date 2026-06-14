---
source_handle: climbdex
fetched: 2026-06-13
source_url: https://github.com/lemeryfertitta/Climbdex
provenance: source-direct
---

# lemeryfertitta/Climbdex — search engine for training-board climbs

## Summary

Open-source search engine for Aurora-family boards (Kilter, Tension, Decoy,
Grasshopper, Touchstone). Its headline feature is filter-by-hold: select holds
(and cycle their role color) to find climbs containing them; filter state is
stored in URL query params so a search is bookmarkable. Climb databases are
downloaded/synced via BoardLib (`sync_db.sh`). Stack: Flask/Python backend
(gunicorn wsgi:app) with a Jinja-templated, JavaScript frontend. The prime
prior-art reference for board rendering + catalog filtering.

## Key passages

- "The climb databases are downloaded and synchronized using the BoardLib Python library."
- Filter-by-hold: "You can select holds to require them to be present in the resulting climbs, and click multiple times on a hold to change the color. Filters are stored in query params such that a specific search or setup can be bookmarked."
- Purpose: a search engine for boards using Aurora Climbing's software, "such as Kilter, Tension, and Decoy. The primary missing feature provided by this engine is a 'filter by hold' feature."
- Stack: Python/Flask backend run via "gunicorn wsgi:app"; Jinja templates + JavaScript frontend; SQLite databases via "sync_db.sh".
