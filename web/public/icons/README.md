# PWA icons — PLACEHOLDERS

These icons are **placeholders** generated deterministically by
`web/scripts/gen-placeholder-icons.mjs` (a simple solid-background "CC" glyph).

They exist so the web manifest is valid and PWA installability prerequisites
pass. **Replace them with real branding at `epic-climb-browser`** when the
design system lands.

To regenerate: `node scripts/gen-placeholder-icons.mjs`

| File                    | Size    | Purpose            |
| ----------------------- | ------- | ------------------ |
| `icon-192.png`          | 192×192 | standard           |
| `icon-512.png`          | 512×512 | standard           |
| `icon-512-maskable.png` | 512×512 | maskable (purpose) |

`../favicon.svg` is the matching placeholder favicon.
