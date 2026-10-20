"""Artifact table definitions.

Column names match the Aurora-era Kilter tables the app already reads. Columns the
app never queries are nullable because Boardsesh omits them for climbs ingested from
Kilter's current backend; nothing is invented to satisfy a legacy NOT NULL.
"""

PRODUCT_ID = 7
LAYOUT_ID = 8
PRODUCT_SIZE_ID = 17
SET_IDS = (26, 27)

TABLES = {
    "products": """CREATE TABLE products (
    id INTEGER NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    is_listed BOOLEAN NOT NULL,
    password TEXT NULL DEFAULT NULL,
    min_count_in_frame INTEGER NULL DEFAULT NULL,
    max_count_in_frame INTEGER NULL DEFAULT NULL
)""",
    "product_sizes": """CREATE TABLE product_sizes (
    id INTEGER NOT NULL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    edge_left INTEGER NOT NULL,
    edge_right INTEGER NOT NULL,
    edge_bottom INTEGER NOT NULL,
    edge_top INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    image_filename TEXT NOT NULL,
    position INTEGER NOT NULL,
    is_listed BOOLEAN NOT NULL
)""",
    "products_angles": """CREATE TABLE products_angles (
    product_id INTEGER NOT NULL,
    angle INTEGER NOT NULL,
    PRIMARY KEY(product_id, angle)
)""",
    "layouts": """CREATE TABLE layouts (
    id INTEGER NOT NULL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    instagram_caption TEXT NOT NULL,
    is_mirrored BOOLEAN NOT NULL,
    is_listed BOOLEAN NOT NULL,
    password TEXT NULL DEFAULT NULL,
    created_at TEXT NOT NULL
)""",
    "sets": """CREATE TABLE sets (
    id INTEGER NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    hsm INTEGER NOT NULL
)""",
    "product_sizes_layouts_sets": """CREATE TABLE product_sizes_layouts_sets (
    id INTEGER NOT NULL PRIMARY KEY,
    product_size_id INTEGER NOT NULL,
    layout_id INTEGER NOT NULL,
    set_id INTEGER NOT NULL,
    image_filename TEXT NOT NULL,
    is_listed BOOLEAN NOT NULL,
    UNIQUE(product_size_id, layout_id, set_id)
)""",
    "placement_roles": """CREATE TABLE placement_roles (
    id INTEGER NOT NULL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    led_color TEXT NOT NULL,
    screen_color TEXT NOT NULL
)""",
    "holes": """CREATE TABLE holes (
    id INTEGER NOT NULL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    mirrored_hole_id INTEGER NULL DEFAULT NULL,
    mirror_group INTEGER NOT NULL DEFAULT 0
)""",
    "placements": """CREATE TABLE placements (
    id INTEGER NOT NULL PRIMARY KEY,
    layout_id INTEGER NOT NULL,
    hole_id INTEGER NOT NULL,
    set_id INTEGER NOT NULL,
    default_placement_role_id INTEGER NULL DEFAULT NULL,
    UNIQUE(layout_id, hole_id)
)""",
    "leds": """CREATE TABLE leds (
    id INTEGER NOT NULL PRIMARY KEY,
    product_size_id INTEGER NOT NULL,
    hole_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    UNIQUE(product_size_id, position)
)""",
    "difficulty_grades": """CREATE TABLE difficulty_grades (
    difficulty INTEGER NOT NULL PRIMARY KEY,
    boulder_name TEXT NOT NULL,
    route_name TEXT NOT NULL,
    is_listed BOOLEAN NOT NULL
)""",
    "climbs": """CREATE TABLE climbs (
    uuid TEXT NOT NULL PRIMARY KEY,
    layout_id INTEGER NOT NULL,
    setter_id INTEGER NULL,
    setter_username TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    hsm INTEGER NULL,
    edge_left INTEGER NOT NULL,
    edge_right INTEGER NOT NULL,
    edge_bottom INTEGER NOT NULL,
    edge_top INTEGER NOT NULL,
    angle INTEGER NULL DEFAULT NULL,
    frames_count INTEGER NOT NULL DEFAULT 1,
    frames_pace INTEGER NOT NULL DEFAULT 0,
    frames TEXT NOT NULL,
    is_draft BOOLEAN NOT NULL DEFAULT 0,
    is_listed BOOLEAN NOT NULL,
    created_at TEXT NOT NULL,
    is_nomatch BOOLEAN NOT NULL DEFAULT 0,
    upstream_frames TEXT NOT NULL
)""",
    "climb_stats": """CREATE TABLE climb_stats (
    climb_uuid TEXT NOT NULL,
    angle INTEGER NOT NULL,
    display_difficulty REAL NOT NULL,
    benchmark_difficulty REAL NULL DEFAULT NULL,
    ascensionist_count INTEGER NOT NULL,
    difficulty_average REAL NOT NULL,
    quality_average REAL NOT NULL,
    fa_username TEXT NULL,
    fa_at TEXT NULL,
    PRIMARY KEY (climb_uuid, angle)
)""",
    "upstream_climbs": """CREATE TABLE upstream_climbs (
    uuid TEXT NOT NULL PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('listed', 'unlisted', 'aliased')),
    canonical_uuid TEXT NULL
)""",
    "catalog_meta": """CREATE TABLE catalog_meta (
    key TEXT NOT NULL PRIMARY KEY,
    value TEXT NOT NULL
)""",
}


def create(connection, *names: str) -> None:
    for name in names:
        connection.execute(TABLES[name])
