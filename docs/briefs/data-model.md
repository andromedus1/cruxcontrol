---
description: Kilter Board SQLite schema, frames encoding, hold roles, grading system, and the sync/web API
type: brief
kind: research
updated: 2026-06-13
nav_priority: high
summary: >
  Technical primer for the Kilter data model: the bundled SQLite database
  (climbs, climb_stats, holes/placements, layouts/products/sizes), the frames
  string encoding for hold placements + roles, the grading system
  (difficulty_average, benchmark_difficulty, ascensionist_count, quality_average),
  the REST sync protocol at kilterboardapp.com/sync (incremental via shared_syncs
  timestamps), and the BLE protocol summary.
key_findings:
  - "Climbs encode hold placements + roles as a 'frames' string; roles are start/middle/finish/foot-only."
  - "climb_stats carries community grades per angle (difficulty_average) — the ML training target."
  - "POST kilterboardapp.com/sync drives incremental updates via shared_syncs timestamps; BoardLib bootstraps the SQLite DB."
  - "Schema and sync API are shared across the entire Aurora Climbing board family."
---

# Kilter Board Data Model: A Technical Primer

## Table of Contents

1. [Overview](#overview)
2. [Route/Problem Encoding](#routeproblem-encoding)
3. [Hold Types and Roles](#hold-types-and-roles)
4. [Grading System](#grading-system)
5. [The Kilter Board Database](#the-kilter-board-database)
6. [Board Layouts, Products, and Sizes](#board-layouts-products-and-sizes)
7. [Sharing, Syncing, and the Web API](#sharing-syncing-and-the-web-api)
8. [Bluetooth Protocol](#bluetooth-protocol)
9. [Key Open-Source Projects](#key-open-source-projects)

---

## Overview

The Kilter Board is an interactive LED-illuminated climbing training wall manufactured by Aurora Climbing. Climbers use a companion app (Android/iOS) to browse, set, and share climbing problems (boulder routes). When a climb is selected, the app communicates with the board via Bluetooth Low Energy (BLE) to illuminate the correct holds in color-coded roles (start, middle, finish, foot-only).

Under the hood, the entire system is built on:

- A **SQLite database** bundled inside the APK/app package, containing the full shared catalog of climbs, holds, board configurations, and grading data.
- A **REST-style sync API** at `https://kilterboardapp.com/sync` for incremental data synchronization.
- A **BLE protocol** for sending LED placement commands to the physical board.

All Aurora Climbing boards (Kilter, Tension, Decoy, Grasshopper, So iLL, Touchstone) share the same software architecture. Everything in this document applies to the entire Aurora family with only minor variations (different host names, hold sets, etc.).

---

## Route/Problem Encoding

### The "frames" String

Every climb is stored as a single string in the `climbs.frames` column. This string encodes which holds are used and what role each hold plays. The format is a concatenation of `p<placement_id>r<role_id>` pairs:

```
p1083r15p1117r15p1164r12p1185r12p1233r13p1282r13p1303r13p1372r13p1392r14p1505r15
```

Breaking this down into individual hold assignments:

| Token | Placement ID | Role ID | Meaning |
|-------|-------------|---------|---------|
| `p1083r15` | 1083 | 15 | Foot-only hold |
| `p1164r12` | 1164 | 12 | Start hold |
| `p1185r12` | 1185 | 12 | Start hold |
| `p1233r13` | 1233 | 13 | Middle/hand hold |
| `p1282r13` | 1282 | 13 | Middle/hand hold |
| `p1303r13` | 1303 | 13 | Middle/hand hold |
| `p1372r13` | 1372 | 13 | Middle/hand hold |
| `p1392r14` | 1392 | 14 | Finish hold |
| `p1505r15` | 1505 | 15 | Foot-only hold |

### Parsing the Frames String

To iterate over holds in a frames string:

```python
def iterframes(frames):
    """Yield (placement_id, role_id) tuples from a frames string."""
    for frame in frames.split("p")[1:]:
        placement, role = frame.split("r")
        yield int(placement), int(role)
```

**Placement IDs are always sorted in ascending order** within the frames string. This is important for pattern matching -- the Climbdex search engine uses SQL `LIKE` clauses with `%` wildcards between sorted placement IDs to find climbs containing specific holds.

### Multi-Frame Climbs

The `climbs` table also has `frames_count` and `frames_pace` columns. Most boulder problems have `frames_count = 1` (a single static frame). Values greater than 1 indicate LED animation sequences (e.g., illuminating holds progressively). In practice, nearly all community climbs are single-frame. When filtering for standard boulders, use `WHERE frames_count = 1`.

### How Placement IDs Map to Physical Holds

A **placement ID** is not the same as a physical hole on the board. The resolution chain is:

```
placement_id --> hole_id --> (x, y) coordinates
placement_id --> hole_id --> LED position (via leds table)
```

The `placements` table maps each `placement_id` to a `hole_id`, scoped by `layout_id` and `set_id`. This means the same physical hole can have different placement IDs depending on which layout and hold set it belongs to.

The `holes` table contains the actual physical coordinates (`x`, `y`) and a `mirrored_hole_id` for boards that support mirrored climbing (flipping the problem left-to-right).

### Edge Boundaries

Each climb also stores bounding-box edges: `edge_left`, `edge_right`, `edge_bottom`, `edge_top`. These are used to determine whether a climb fits on a particular board size. The `product_sizes` table similarly stores edge boundaries for each physical board dimension. The search query filters climbs by checking:

```sql
climbs.edge_left > product_sizes.edge_left
AND climbs.edge_right < product_sizes.edge_right
AND climbs.edge_bottom > product_sizes.edge_bottom
AND climbs.edge_top < product_sizes.edge_top
```

This is how nested board sizes work: a 7x10 board is a strict spatial subset of the 8x12, which is a subset of the 12x12. Any climb that fits within the smaller board's edges is available on that size.

---

## Hold Types and Roles

### Placement Roles

The `placement_roles` table defines the roles a hold can play in a climb. Each role has both a **screen color** (for the app UI) and an **LED color** (for the physical board). The four standard roles are:

| role_id | Name | LED Color (Hex) | Screen Color | Purpose |
|---------|------|-----------------|--------------|---------|
| 12 | Start | `00FF00` | Green | Starting hand holds -- climber begins with hands here |
| 13 | Middle | `00FFFF` | Cyan | Intermediate hand holds used during the climb |
| 14 | Finish | `FF00FF` | Magenta/Pink | Final hold(s) -- climb is complete when matched here |
| 15 | Foot | `FFB600` | Orange/Yellow | Foot-only holds -- hands may not use these |

**Note:** Role IDs are product-specific. The values 12-15 are for the Kilter Board product. Other Aurora boards (Tension, Decoy, etc.) may use different role IDs, but the same four-role model applies. The `placement_roles` table is keyed by `product_id`.

### Role Semantics in Climbing

- **Start holds** (green): The climber must begin with both hands on start holds. A valid attempt begins when the climber's feet leave the ground with hands on start holds.
- **Middle holds** (cyan): Any hold the climber uses between start and finish. These are the main body of the climb.
- **Finish hold** (magenta): The climber must "match" (hold with both hands) the finish hold to complete the problem.
- **Foot-only holds** (orange): These may only be used for feet. Using them as handholds violates the intended sequence. These add precision and technique requirements.

### The `placement_roles.position` Field

The `placement_roles` table also has a `position` column with integer values. This is referenced in Climbdex for distinguishing "hand holds" from "feet holds" when counting the number of hand moves in a climb. Position value `2` appears to indicate foot-only holds, used in SQL to count hand holds by excluding foot placements from the total.

---

## Grading System

### The `difficulty_grades` Table

The Kilter Board uses a **numeric difficulty scale** internally, stored in the `difficulty_grades` table with these key columns:

| Column | Type | Description |
|--------|------|-------------|
| `difficulty` | INTEGER | Internal numeric difficulty value |
| `boulder_name` | TEXT | Human-readable grade (e.g., "V3", "6A+") |
| `is_listed` | BOOLEAN | Whether this grade level is shown in the UI |

The internal scale runs from approximately **0 to 33+**, with each integer mapping to a specific V-scale (Hueco) or Font grade. The mapping from the `difficulty_grades` table is used throughout the system:

```python
def difficulty_to_grade(difficulty_mapping, difficulty):
    """Convert numeric difficulty to grade string like 'V4'."""
    return (
        difficulty_mapping.get(int(round(difficulty)), None)
        if difficulty is not None
        else None
    )
```

The approximate mapping (reconstructed from community data and ML datasets):

| Numeric Range | V-Scale | Font Scale |
|--------------|---------|------------|
| ~10 | V0 | 4A |
| ~12 | V1 | 5A |
| ~14 | V2 | 5C |
| ~16 | V3 | 6A |
| ~18 | V4 | 6B |
| ~20 | V5 | 6C |
| ~22 | V6 | 7A |
| ~24 | V7 | 7A+ |
| ~26 | V8 | 7B+ |
| ~28 | V9 | 7C |
| ~30 | V10 | 7C+ |
| ~33 | V13 | 8B |

The `is_listed` flag controls which grades are displayed as selectable options in the UI. Sub-grades and intermediate values exist but may not be listed.

### The `climb_stats` Table

Aggregate grading statistics are stored in `climb_stats`:

| Column | Type | Description |
|--------|------|-------------|
| `climb_uuid` | TEXT | References `climbs.uuid` |
| `angle` | INTEGER | Wall angle in degrees |
| `display_difficulty` | REAL | The displayed difficulty (benchmark if available, otherwise community average) |
| `difficulty_average` | REAL | Community consensus average difficulty |
| `benchmark_difficulty` | REAL/NULL | Curated benchmark grade, if the climb is a "classic" |
| `ascensionist_count` | INTEGER | Number of users who have sent (completed) this climb |
| `quality_average` | REAL | Average star rating from the community |

**Key relationships:**

- `display_difficulty` = `benchmark_difficulty` if the climb has been benchmarked; otherwise `display_difficulty` = `difficulty_average`.
- A climb with `benchmark_difficulty IS NOT NULL` is a "classic" or benchmark problem -- one whose grade has been curated/verified.
- The same climb can have different stats at different angles (a V4 at 40 degrees might be a V6 at 50 degrees), so `climb_stats` is keyed by `(climb_uuid, angle)`.

### How Community Grading Works

1. The **setter** assigns an initial grade when creating the climb.
2. When a user logs an **ascent**, they can vote on difficulty. The `difficulty` field in the ascent record captures what grade the climber thinks it should be.
3. The system computes `difficulty_average` from all ascent votes.
4. If a climb achieves enough consensus and quality, it may be given a `benchmark_difficulty` -- a curated "official" grade.
5. The Climbdex search engine also exposes a `difficulty_error` metric: `round(difficulty_average - round(display_difficulty), 2)`, measuring how much the community disagrees with the displayed grade.

### Grade Accuracy Filtering

A notable feature in Climbdex is the `grade_accuracy` filter, which limits results to climbs where:

```sql
ABS(ROUND(display_difficulty) - difficulty_average) <= $grade_accuracy
```

This lets users filter for climbs with high consensus (low accuracy value = everyone agrees on the grade).

### Known Grading Quirks

- Kilter Board grades are widely considered "soft" compared to outdoor grades -- roughly 1-2 V-grades easier than equivalent outdoor problems.
- The easy way to log an ascent automatically agrees with the setter's grade, biasing `difficulty_average` toward the original grade.
- Problems below V4 tend to have inconsistent difficulty because many are set at one angle and then the grade is extrapolated to other angles somewhat arbitrarily.

---

## The Kilter Board Database

### Storage and Access

The SQLite database is bundled as `assets/db.sqlite3` inside the Android APK file (`com.auroraclimbing.kilterboard`). On an Android device, the working copy lives at:

```
/data/data/com.auroraclimbing.kilterboard/
```

The database is approximately **85 MB** and contains the complete shared catalog of all public climbs, hold definitions, board configurations, and grade data.

**How to obtain the database:**
- Extract from the APK directly (BoardLib automates this by downloading from APKPure)
- Use `boardlib database kilter ./kilter.sqlite` to download and sync
- The database can also be synced incrementally via the API after initial download

### Core Tables

The database contains dozens of tables. Here are the most important ones, grouped by function:

#### Physical Board Definition

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `holes` | Physical hole positions on the board panel | `id`, `x`, `y`, `mirrored_hole_id` |
| `leds` | Maps holes to LED strip positions | `hole_id`, `position`, `product_size_id` |
| `placements` | Maps placement IDs to holes (scoped by layout/set) | `id`, `hole_id`, `layout_id`, `set_id` |
| `placement_roles` | Defines hold roles and their colors | `id`, `product_id`, `name`, `screen_color`, `led_color`, `position` |

#### Board Configuration Hierarchy

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `products` | Board product lines (Kilter Board, Tension, etc.) | `id`, `name` |
| `product_sizes` | Physical board dimensions | `id`, `product_id`, `name`, `description`, `edge_left`, `edge_right`, `edge_bottom`, `edge_top` |
| `products_angles` | Supported wall angles per product | `product_id`, `angle` |
| `layouts` | Board layouts (Original, Fullride, etc.) | `id`, `product_id`, `name`, `is_listed`, `is_mirrored`, `password` |
| `sets` | Hold set definitions (Mainline, Auxiliary, etc.) | `id`, `name` |
| `product_sizes_layouts_sets` | Junction table linking sizes, layouts, and sets | `product_size_id`, `layout_id`, `set_id`, `image_filename` |

#### Climb Data

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `climbs` | All published climbing problems | `uuid`, `layout_id`, `setter_id`, `setter_username`, `name`, `description`, `frames`, `frames_count`, `frames_pace`, `is_draft`, `is_listed`, `edge_left`, `edge_right`, `edge_bottom`, `edge_top` |
| `climb_stats` | Aggregated statistics per climb per angle | `climb_uuid`, `angle`, `display_difficulty`, `difficulty_average`, `benchmark_difficulty`, `ascensionist_count`, `quality_average` |
| `difficulty_grades` | Grade label lookup | `difficulty`, `boulder_name`, `is_listed` |
| `beta_links` | Video beta links (Instagram, etc.) | `climb_uuid`, `angle`, `foreign_username`, `link`, `is_listed` |

#### User Data (synced separately, requires auth)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `ascents` | Logged sends | `uuid`, `user_id`, `climb_uuid`, `angle`, `is_mirror`, `attempt_id`, `bid_count`, `quality`, `difficulty`, `is_benchmark`, `comment`, `climbed_at`, `is_listed` |
| `bids` | Logged attempts (burns) | `uuid`, `user_id`, `climb_uuid`, `angle`, `is_mirror`, `bid_count`, `comment`, `climbed_at` |
| `circuits` | User-created circuit collections | (various) |
| `walls` | Custom wall configurations | (various) |
| `kits` | Bluetooth device pairing info | (various) |

#### Sync Metadata

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `shared_syncs` | Tracks last sync time for each shared/public table | `table_name`, `last_synchronized_at` |
| `user_syncs` | Tracks last sync time for each user-specific table | `table_name`, `last_synchronized_at` |

### Entity Relationship Summary

```
products
  |-- product_sizes (physical board dimensions)
  |-- products_angles (supported angles)
  |-- layouts (hold arrangement patterns)
  |     |-- placements (hold positions per layout + set)
  |     |     |-- holes (physical x,y coordinates)
  |     |     |     |-- leds (LED strip position per product_size)
  |     |     |     |-- mirrored_hole_id (self-reference for mirror support)
  |     |-- climbs (problems defined on a layout)
  |           |-- climb_stats (per-angle statistics)
  |-- placement_roles (role definitions per product)
  |-- sets (hold set packs)
        |-- product_sizes_layouts_sets (junction: which sets apply to which size+layout)
```

---

## Board Layouts, Products, and Sizes

### The Configuration Hierarchy

Understanding the Kilter Board data model requires grasping a four-level hierarchy:

1. **Product** -- The board brand/model (e.g., "Kilter Board"). Each Aurora brand is a separate product.
2. **Layout** -- The hold arrangement pattern (e.g., "Original", "Fullride"). Defines which holes have placements.
3. **Set** -- A subset of holds within a layout (e.g., "Mainline", "Auxiliary"). Allows partial board installations.
4. **Product Size** -- The physical board dimensions (e.g., "7x10", "8x12", "12x12"). Defines spatial boundaries.

### Layouts Explained

**Original Layout:**
- The "standard" layout found in most commercial gyms.
- Available in sizes: 16x12, 12x12, 8x12, 7x10.
- These sizes are **nested** -- the 7x10 is spatially contained within the 8x12, which is contained within the 12x12. All problems from a smaller board automatically work on larger boards.
- Uses a standard 20cm (approximately 8 inch) square grid for hold t-nut positions.

**Fullride Layout (Home Wall):**
- Designed for home walls with higher hold density.
- Available in sizes: 10x12, 10x10, 8x12, 7x10.
- Has its own nested size hierarchy.
- Uses a denser grid by overlaying the Mainline (20cm grid) and Auxiliary (offset 20cm grid, resulting in ~4-5cm effective spacing between nearest holds) positions.

### Hold Sets

Within the Fullride layout, holds are divided into two independent sets:

- **Mainline Pack**: 165 bolt-on holds (for 7x10) on the standard 20cm grid. Tends toward more generous holds (crimps, edges, pinches, slopers, mini-jugs). Results in slightly easier climbing.
- **Auxiliary Pack**: 140 bolt-on holds (for 7x10) on the offset grid positions. Mostly thinner crimps, slopey edges, and pinches. Results in slightly harder climbing.
- **Full Ride = Mainline + Auxiliary**: Both packs installed together for maximum density.

Each pack can be installed independently and still creates a fully functional board. The `sets` table and `product_sizes_layouts_sets` junction table track which sets are available for each size/layout combination.

### The 7x10 Fullride Specifically

The **Fullride 7x10** (7 feet wide by 10 feet tall, no kickboard):

- **Total holds**: 305 bolt-on holds (165 Mainline + 140 Auxiliary)
- **Additional footholds**: 60 screw-on footholds
- **Total LEDs**: 450 LEDs
- **Grid**: Dual-density grid combining the standard 20cm spacing (Mainline) with interstitial positions (Auxiliary)
- **Supported angles**: 0 to 70 degrees overhanging (set physically by the wall angle; the app filters climbs by angle)

### Coordinate System

Hold positions in the `holes` table use an internal coordinate system with `x` and `y` integer values. These are **not pixel coordinates** directly but represent positions on the board grid. To render on screen:

- Scale factor: multiply by 7.5
- Y-axis is inverted with a 1170-pixel offset: `screen_y = 1170 - (y * 7.5)`

The coordinate system is consistent across all board sizes. Size boundaries are defined by the `edge_left`, `edge_right`, `edge_bottom`, `edge_top` values in `product_sizes`, which specify the spatial rectangle that a given board size occupies within the master coordinate space.

### Hold Numbering

Hold numbering in the placement system follows a specific pattern:

- **Normal holds** are numbered first, from lowest position (bottom of board) to highest (top of board).
- **Foot chips** (screw-on footholds) are numbered after the highest normal hold.
- **Exception**: The first row of kicker holds is treated as normal holds in the numbering sequence.

Within the database, the `placement.id` is the canonical identifier used in the frames string. This ID is specific to the combination of layout and set.

---

## Sharing, Syncing, and the Web API

### API Host

Each Aurora board has its own API host following the pattern:

| Board | Host |
|-------|------|
| Kilter | `https://kilterboardapp.com` |
| Tension | `https://tensionboardapp2.com` |
| Aurora | `https://auroraboardapp.com` |
| Decoy | `https://decoyboardapp.com` |
| Grasshopper | `https://grasshopperboardapp.com` |
| So iLL | `https://soillboardapp.com` |
| Touchstone | `https://touchstoneboardapp.com` |

Image assets are served from `https://api.kilterboardapp.com/img/<image_filename>`.

### Authentication

**Endpoint:** `POST /sessions`

```json
{
  "username": "user@example.com",
  "password": "secret",
  "tou": "accepted",
  "pp": "accepted",
  "ua": "app"
}
```

**Response:** Returns a session object containing a `token` used as a cookie for subsequent requests. The token is passed as `Cookie: token=<value>` header.

### The Sync Protocol

**Endpoint:** `POST /sync`

The sync mechanism is the core of data exchange. It works as an incremental, paginated synchronization protocol:

1. The client sends a `POST` to `/sync` with URL-encoded form data listing table names and their last-known sync timestamps:
   ```
   climbs=2024-01-15+12:00:00.000000&climb_stats=2024-01-15+12:00:00.000000&placements=1970-01-01+00:00:00.000000
   ```

2. The server responds with a JSON object containing new/updated rows for each requested table, plus sync metadata:
   ```json
   {
     "climbs": [ { "uuid": "...", "name": "...", "frames": "p1083r15p..." }, ... ],
     "climb_stats": [ { "climb_uuid": "...", "angle": 40, ... }, ... ],
     "shared_syncs": [ { "table_name": "climbs", "last_synchronized_at": "2024-02-01 ..." } ],
     "user_syncs": [ { "table_name": "ascents", "last_synchronized_at": "..." } ],
     "_complete": false
   }
   ```

3. If `_complete` is `false`, the client updates its sync timestamps from the `shared_syncs`/`user_syncs` arrays and issues another `/sync` request with the updated timestamps. This repeats until `_complete` is `true`.

4. Each batch of rows is inserted into the local SQLite database using `INSERT OR REPLACE`.

**Shared tables** (no auth required): climbs, climb_stats, placements, holes, leds, placement_roles, difficulty_grades, sets, layouts, product_sizes, products, products_angles, product_sizes_layouts_sets, beta_links, etc.

**User tables** (auth required): ascents, bids (attempts), circuits, walls, draft_climbs, user_syncs.

### Special Handling: `climb_stats` Sync

The `climb_stats` table has special insert logic. When a synced row has no `display_difficulty` (i.e., no ascents yet), the row is **deleted** from the local database rather than inserted. The `display_difficulty` is computed as:

```python
display_difficulty = benchmark_difficulty if benchmark_difficulty else difficulty_average
```

### Other API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/explore` | Explore/discover climbs (requires auth) |
| `PUT` | `/climbs/save` | Create or update a climb (requires auth) |
| `PUT` | `/ascents/save/{uuid}` | Log a completed ascent (requires auth) |
| `PUT` | `/bids/save` | Log an attempt/burn (requires auth) |
| `GET` | `/users/{user_id}` | Get user profile (requires auth) |
| `GET` | `/users/{user_id}/followers` | Get user's followers (requires auth) |
| `GET` | `/users/{user_id}/followees` | Get user's followees (requires auth) |
| `POST` | `/follows/save` | Follow/unfollow a user (requires auth) |
| `GET` | `/notifications` | Get notifications (requires auth) |
| `GET` | `/pins?gyms=1` | List gym locations with coordinates (public) |

### Creating a Climb via API

```json
PUT /climbs/save
{
  "uuid": "<generated-uuid-no-dashes>",
  "layout_id": 1,
  "setter_id": 12345,
  "name": "My Problem",
  "description": "A fun V4",
  "is_draft": false,
  "frames_count": 1,
  "frames_pace": 0,
  "frames": "p1164r12p1185r12p1233r13p1282r13p1392r14",
  "angle": 40
}
```

### Logging an Ascent

```json
PUT /ascents/save/{uuid}
{
  "user_id": 12345,
  "uuid": "<generated-uuid>",
  "climb_uuid": "<climb-uuid>",
  "angle": 40,
  "is_mirror": false,
  "attempt_id": 1,
  "bid_count": 3,
  "quality": 3,
  "difficulty": 18,
  "is_benchmark": false,
  "comment": "Fun one!",
  "climbed_at": "2024-06-15 14:30:00"
}
```

Note: the `difficulty` field here is the user's grade vote (numeric, from the `difficulty_grades` scale). The `quality` field is the star rating. `bid_count` is the number of attempts before sending. `attempt_id` tracks unique attempt sessions.

---

## Bluetooth Protocol

### BLE Service

The Kilter Board uses the Nordic UART Service (NUS) for BLE communication:

| UUID | Purpose |
|------|---------|
| `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` | Primary UART Service |
| `6E400002-B5A3-F393-E0A9-E50E24DCCA9E` | Write Characteristic (client to board) |
| `4488B571-7806-4DF6-BCFF-A2897E4953FF` | Advertisement Service |

### Board Name Convention

The BLE device name follows the format: `[AlphanumericName][#SerialNumber][@APILevel]`

Examples: `mykilterboard`, `board#2353@3`, `unit@2`

If the API level suffix is omitted, the board defaults to API level 2.

### Packet Structure

```
[0x01] [length] [checksum] [0x02] [payload...] [0x03]
```

- **Byte 1**: `0x01` -- packet header
- **Byte 2**: Data length (number of payload bytes)
- **Byte 3**: Checksum (sum of all payload bytes, masked to 8 bits, then bitwise inverted and masked again)
- **Byte 4**: `0x02` -- separator/start of payload
- **Bytes 5..N**: Payload data (hold positions and colors)
- **Final byte**: `0x03` -- packet footer

**Maximum packet size**: 260 bytes. BLE transmits in 20-byte chunks.

### Multi-Packet Messages

When a climb has more holds than fit in a single packet, the message is split across multiple packets. The first byte of the payload indicates the packet's position in the sequence:

| Position | API Level 2 | API Level 3 |
|----------|-------------|-------------|
| Only packet | `0x50` (P) | `0x54` (T) |
| First of many | `0x4E` (N) | `0x52` (R) |
| Middle | `0x4D` (M) | `0x51` (Q) |
| Last | `0x4F` (O) | `0x53` (S) |

### API Level 2: Hold Encoding (2 bytes per hold)

```
Byte 1: position & 0xFF        (lower 8 bits of LED position)
Byte 2: ((position >> 8) << 6) | (R << 4) | (G << 2) | B
         ^^ upper 2 bits ^^      ^^ 2-bit color channels ^^
```

- **Position range**: 10 bits (0-1023)
- **Color depth**: 2 bits per channel (R, G, B) = 64 total colors
- **Color mapping**: `0xFF` maps to `0b11`, `0x00` maps to `0b00`

### API Level 3: Hold Encoding (3 bytes per hold)

```
Byte 1: position & 0xFF        (lower 8 bits of LED position)
Byte 2: (position >> 8) & 0xFF (upper 8 bits of LED position)
Byte 3: (R << 5) | (G << 2) | B
          ^3 bits^  ^3 bits^  ^2 bits^
```

- **Position range**: 16 bits (0-65535)
- **Color depth**: 3 bits R, 3 bits G, 2 bits B = 256 total colors
- **Color formula**: `((R/32) << 5) | ((G/32) << 2) | (B/64)` where R, G, B are 0-255

### Example: Sending a Single Hold

Hold at LED position 161 (`0xA1`), color magenta (`#FF00FF`), API level 3:

- Position bytes: `0xA1, 0x00` (161 in little-endian 16-bit)
- Color byte: `((255/32) << 5) | ((0/32) << 2) | (255/64)` = `(7 << 5) | (0 << 2) | 3` = `0xE3`
- Payload: `0x54 0xA1 0x00 0xE3` (single-packet marker + hold data)
- Checksum: `(0x54 + 0xA1 + 0x00 + 0xE3) & 0xFF` = `0x78`, inverted = `~0x78 & 0xFF` = `0x87`
- Full packet: `01 04 87 02 54 A1 00 E3 03`

### Resolution: Frames String to BLE Packet

To light up a climb on the board, the app must:

1. Parse the frames string into `(placement_id, role_id)` pairs.
2. Look up each `placement_id` in the `placements` table to get `hole_id`.
3. Look up each `hole_id` in the `leds` table (filtered by `product_size_id`) to get the LED `position`.
4. Look up each `role_id` in the `placement_roles` table to get the `led_color` hex value.
5. Encode each `(position, color)` pair into 2 or 3 bytes per the API level.
6. Pack into one or more BLE packets and transmit.

---

## Key Open-Source Projects

### BoardLib
**Repository**: [github.com/lemeryfertitta/BoardLib](https://github.com/lemeryfertitta/BoardLib)

The definitive Python library for programmatic access to Aurora Climbing board data. Provides:
- Database download (extracts `db.sqlite3` from the APK)
- Incremental sync via the API
- Logbook export (ascents and attempts with grade resolution)
- Climb creation and ascent logging
- Support for all Aurora boards (Kilter, Tension, Decoy, Grasshopper, So iLL, Touchstone)

### Climbdex
**Repository**: [github.com/lemeryfertitta/Climbdex](https://github.com/lemeryfertitta/Climbdex)
**Live site**: [climbdex.com](https://climbdex.com)

A web-based search engine for training board climbs built on BoardLib's SQLite databases. Features advanced filtering by grade, angle, ascent count, quality, hold selection, grade accuracy, and setter name. Includes BLE integration for sending climbs directly to the board from the browser.

### fake_kilter_board
**Repository**: [github.com/1-max-1/fake_kilter_board](https://github.com/1-max-1/fake_kilter_board)

An ESP32-based Kilter Board simulator. Invaluable for understanding the BLE protocol -- documents both API level 2 and 3 packet formats, checksums, and multi-packet handling. Includes the LED position parser and SQLite database query logic.

### Grip Connect (Hangtime)
**Documentation**: [stevie-ray.github.io/hangtime-grip-connect](https://stevie-ray.github.io/hangtime-grip-connect/devices/kilterboard.html)

JavaScript/TypeScript library for BLE communication with Kilter Boards. Documents the `led()` API for sending hold positions and colors, role ID mappings, and the BLE service UUIDs.

### HuggingFace Datasets

- **[Vilin97/KilterBoard](https://huggingface.co/datasets/Vilin97/KilterBoard)**: ML-ready dataset with train/val/test splits. Contains climbs from Layout 1, Size 10, filtered for `ascensionist_count > 0`, `difficulty_numeric <= 30.5` (~V13), `3 <= num_holds <= 50`. Includes the reference tables: `difficulty_grades`, `placements`, `placement_roles`, `holes`.

- **[stfamod/Kilter-Board-Dataset](https://huggingface.co/datasets/stfamod/Kilter-Board-Dataset)**: Another ML dataset with climb sequences and vocabulary mappings.

### Kaggle
- **[atrbyg24/kilterboard](https://www.kaggle.com/datasets/atrbyg24/kilterboard)**: Kilter Board dataset with climb data.

### Climbology
**Repository**: [github.com/Rundstedtzz/climbology](https://github.com/Rundstedtzz/climbology)

AI-assisted beta design using a Neo4j graph database where holds are nodes (with properties: type, depth, coordinates, position, texture, hold_id, size) and moves are edges (with properties: movement type, start/end hold IDs, step number).

### bazun.me Blog
**URL**: [bazun.me/blog/kiterboard](https://bazun.me/blog/kiterboard)

One of the most thorough reverse-engineering write-ups of the Kilter Board system, covering the database schema, API endpoints, Bluetooth protocol, and coordinate system. Primary source for much of the community's understanding of the data model.

---

## Quick Reference: Reconstructing a Climb

Given a frames string like `p1164r12p1185r12p1233r13p1282r13p1392r14`:

```sql
-- 1. Parse frames into (placement_id, role_id) pairs
-- 2. Resolve to physical coordinates and LED positions:

SELECT
    p.id AS placement_id,
    pr.name AS role_name,
    '#' || pr.led_color AS led_color,
    h.x, h.y,
    l.position AS led_position
FROM placements p
JOIN holes h ON p.hole_id = h.id
JOIN leds l ON h.id = l.hole_id AND l.product_size_id = ?
JOIN placement_roles pr ON pr.id = ? AND pr.product_id = ?
WHERE p.id IN (1164, 1185, 1233, 1282, 1392)
AND p.layout_id = ?
AND p.set_id = ?;
```

This gives you everything needed to render the climb on screen (x, y coordinates + screen colors) or send it to the physical board (LED positions + LED colors).

---

## Sources

- [bazun.me/blog/kiterboard](https://bazun.me/blog/kiterboard) -- Reverse-engineering deep dive
- [BoardLib (GitHub)](https://github.com/lemeryfertitta/BoardLib) -- Python library source code
- [Climbdex (GitHub)](https://github.com/lemeryfertitta/Climbdex) -- Search engine source code
- [fake_kilter_board (GitHub)](https://github.com/1-max-1/fake_kilter_board) -- BLE protocol documentation
- [Grip Connect / Hangtime](https://stevie-ray.github.io/hangtime-grip-connect/devices/kilterboard.html) -- BLE library docs
- [Vilin97/KilterBoard (HuggingFace)](https://huggingface.co/datasets/Vilin97/KilterBoard) -- ML dataset
- [stfamod/Kilter-Board-Dataset (HuggingFace)](https://huggingface.co/datasets/stfamod/Kilter-Board-Dataset) -- ML dataset
- [Kilterboard (Kaggle)](https://www.kaggle.com/datasets/atrbyg24/kilterboard) -- Dataset
- [Setter Closet - Board Sizes](https://settercloset.com/pages/kb-board-sizes) -- Official board specs
- [Setter Closet - Layout Comparison](https://settercloset.com/pages/kb-layouts) -- Layout documentation
- [Setter Closet - Overview](https://settercloset.com/pages/kb-overview) -- Product overview
- [Climbology (GitHub)](https://github.com/Rundstedtzz/climbology) -- AI beta design
- [Declan-Stockdale-Garbutt/kilterboard_climbs (GitHub)](https://github.com/Declan-Stockdale-Garbutt/kilterboard_climbs) -- Data analysis
- [kilterboard.io](https://kilterboard.io/) -- Official web app
- [tim.wants.coffee/posts/kilterboard-app](https://tim.wants.coffee/posts/kilterboard-app/) -- Web app reverse engineering
