---
id: idea-actions-node24-majors
created: 2026-10-20
updated: 2026-10-20
tags: [infra]
---

The first live catalog-publish run (2026-10-20) warned that `actions/checkout` and
`actions/setup-python` target Node 20 and are being forced onto Node 24. CI also uses
`actions/checkout@v4`, `setup-node@v4`, `setup-java@v4`, `setup-python@v5` and
`upload-artifact@v4`; current majors are checkout v7, setup-python v7, setup-node v7,
setup-java v6 and upload-artifact v7. Bump them together in one reviewed change across
`ci.yml` and `catalog-publish.yml` (keeping SHA pins in the publish workflow), checking
each major's breaking changes, rather than piecemeal.
