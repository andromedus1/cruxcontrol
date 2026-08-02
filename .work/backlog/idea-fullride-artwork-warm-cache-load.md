---
id: idea-fullride-artwork-warm-cache-load
created: 2026-08-02
updated: 2026-08-02
tags: [ui, perf]
---

Harden the private Fullride raster artwork against an SVG image warm-cache load event
that could theoretically fire before React attaches `onLoad`. The current behavior
degrades safely to the complete schematic board, but it may retain 305 schematic bodies
and miss the intended one-raster rendering path. Consider an explicit decode/ready probe
or a documented browser guarantee when this work is scoped.
