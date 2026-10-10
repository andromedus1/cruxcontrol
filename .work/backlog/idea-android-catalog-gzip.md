---
id: idea-android-catalog-gzip
created: 2026-10-10
updated: 2026-10-10
tags: [data, infra]
---

# Android packaging changes the catalog file identity

The first packaged Android catalog probe returned HTTP 404 for the manifest's
`/catalog/kilter-7x10.v1.db.gz`, despite the exact 5,122,102-byte gzip being present
in `android/app/src/main/assets/public/catalog`. APK inspection showed only
`assets/public/catalog/kilter-7x10.v1.db` (12,410,880 bytes): the asset build expanded
the gzip and removed its suffix. The committed manifest still names and hashes the
gzip. Source-directory checks alone therefore cannot validate the dogfood package.
Reproduced in API36 WebView133 after native-library commit `5fd0a2c`. No personal
data involved. This blocks the already-scoped Android catalog feature.
