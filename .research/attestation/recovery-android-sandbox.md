---
source_handle: recovery-android-sandbox
fetched: 2026-10-09
source_url: https://source.android.com/docs/security/app-sandbox
provenance: source-direct
substrate_confidence: source-direct
---

# Android Application Sandbox

## Summary

Android separates app resources using per-app Linux identities and kernel controls.

## Anchored observations

- **Application Sandbox, opening paragraphs:** each app receives a unique UID. The
  kernel uses process identity and file permissions to isolate apps and system resources.
- **Application Sandbox, third paragraph:** an app cannot ordinarily read another
  app's data because its default privileges do not permit that access.
- **Kernel-level enforcement paragraph:** this applies to native code and framework
  applications; choosing a different app language does not remove the boundary.
